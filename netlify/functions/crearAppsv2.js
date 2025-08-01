const fetch = require('node-fetch');
const CryptoJS = require('crypto-js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Método no permitido' };
  }

  try {
    const {
      name, code, owner_name, callback_url,
      use_ccapi_announce, http_notifications_enabled,
      currency, tipo_integracion, procesadores, campos_extras
    } = JSON.parse(event.body);

    const CCAPI_URL = process.env.CCAPI_URL;
    const LOGIN_URL = `${CCAPI_URL}/v3/user/login/`;

    const loginRes = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: process.env.CCAPI_USERNAME,
        password: process.env.CCAPI_PASSWORD
      })
    });

    if (!loginRes.ok) {
      const text = await loginRes.text();
      return { statusCode: loginRes.status, body: `Login fallido: ${text}` };
    }

    const { token } = await loginRes.json();
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Token ${token}`
    };

    let integrations = [];

      if (tipo_integracion === 'SERVER/CLIENT') {
        integrations = [`${code}-SERVER`, `${code}-CLIENT`];
      } else if (tipo_integracion === 'LTP') {
        integrations = [`${code}-LTP`];
      } else {
        integrations = [code];
      }

    const responses = [];
    const createdApps = {};

    const globalCarriers = procesadores.map(p => ({
      carrier: p.carrier,
      prefix: p.tipo,
      max: 100000000.0,
      min: 1.0,
      order: 1
    }));

    for (const integrationCode of integrations) {
      const p = procesadores[0];

      // Combinar campos dinámicos y fijos si existen
      const camposCombinados = {
        ...(p.fijos || {}),
        ...(p.campos || {})
      };

      const appPayload = {
        name,
        code: integrationCode,
        owner_name,
        callback_url,
        use_ccapi_announce,
        http_notifications_enabled,
        currency,
        carrier: p.carrier,
        carriers: globalCarriers,
        ...JSON.parse(JSON.stringify(camposCombinados)),
        ...(tipo_integracion === 'PCI' ? { is_pci: true } : {}) // ⬅️ Aquí se agrega el campo condicionalmente
      };

      const res = await fetch(`${CCAPI_URL}/v3/application`, {
        method: 'POST',
        headers,
        body: JSON.stringify(appPayload)
      });

      let json;
      try {
        json = await res.json();
      } catch {
        const t = await res.text();
        json = { error: 'Respuesta no JSON', detalle: t };
      }

      responses.push({ integrationCode, procesador: p.tipo, status: res.status, response: json });

      if (res.ok) {
        createdApps[integrationCode] = json;
      }
    }

    let noccapiResponse = null;
    const serverCode = tipo_integracion === 'SERVER/CLIENT' ? `${code}-SERVER` : integrations[0];
    const serverData = createdApps[serverCode];

    if (serverData) {
      const authRes = await fetch('https://pg-micros.paymentez.com/v1/unixtime/');
      const { unixtime } = await authRes.json();

      const app_code = process.env.PAYMENTEZ_APP_CODE;
      const app_key = process.env.PAYMENTEZ_APP_KEY;

      const uniq = CryptoJS.SHA256(app_key + unixtime).toString();
      const tokenStr = Buffer.from(`${app_code};${unixtime};${uniq}`).toString('base64');

      const ccapiCarrier = {
        carrier: 'ccapi',
        commerce_id: tipo_integracion === 'SERVER/CLIENT'
          ? createdApps[`${code}-CLIENT`]?.code || ''
          : createdApps[code]?.code || '',
        terminal_id: tipo_integracion === 'SERVER/CLIENT'
          ? createdApps[`${code}-CLIENT`]?.key || ''
          : createdApps[code]?.key || '',
        country_default: 'COL',
        currency_default: currency,
        agreement: {},
        max_amount: 1000000000,
        min_amount: 1
      };

      const carriers = procesadores.some(p => p.carrier === 'PSE')
        ? [
            {
              carrier: 'PSE',
              commerce_id: campos_extras?.pse_commerce_id || '',
              terminal_id: campos_extras?.pse_terminal_id || '',
              country_default: 'COL',
              agreement: {
                ciiu: campos_extras?.beneficiaryEntityCIIUCategory || '',
                is_v2: true,
                beneficiaryData: {
                  beneficiaryEntityName: campos_extras?.beneficiaryEntityName || '',
                  beneficiaryEntityCIIUCategory: campos_extras?.beneficiaryEntityCIIUCategory || '',
                  beneficiaryEntityIdentification: campos_extras?.beneficiaryEntityIdentification || '',
                  beneficiaryEntityIdentificationType: campos_extras?.beneficiaryEntityIdentificationType || ''
                }
              },
              currency_default: 'COP',
              max_amount: 1000000000,
              min_amount: 1
            },
            ...(tipo_integracion === 'SERVER/CLIENT' ? [ccapiCarrier] : [])
          ]
        : [ccapiCarrier];

      const noccapiBody = {
        code: serverData.code,
        secret_key: serverData.key,
        owner: owner_name,
        currencies_allowed: [currency],
        whitelabel_owner: 'Paymentez',
        sms_notification: false,
        link_to_pay_data: {
          checkout_url: 'https://paymentez.link',
          link_to_pay_config: {}
        },
        carriers: {
          noccapi: carriers,
          ccapi: [{}]
        }
      };

      const noa = await fetch('https://noccapi-stg.paymentez.com/commons/v1/create-or-update-application/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'auth-token': tokenStr
        },
        body: JSON.stringify(noccapiBody)
      });

      noccapiResponse = await noa.json().catch(async () => ({ error: await noa.text() }));
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ results: responses, noccapiResponse })
    };

  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error inesperado', detalle: e.message })
    };
  }
};
