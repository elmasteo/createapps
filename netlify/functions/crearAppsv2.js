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

    const globalCarriers = procesadores
      .filter(p => p.carrier !== 'PSE')
      .map(p => ({
        carrier: p.carrier,
        prefix: p.tipo,
        max: 100000000.0,
        min: 1.0,
        order: 1
      }));

    for (const integrationCode of integrations) {
      for (const p of procesadores) {
        if (p.carrier === 'PSE') {
          responses.push({
            integrationCode,
            procesador: p.tipo,
            status: 200,
            response: 'Procesador PSE: solo enviado a NOCCAPI, sin crear en CCAPI'
          });
          continue;
        }

        const camposCombinados = {
          ...(p.fijos || {}),
          ...(p.campos || {})
        };

        if (p.tipo === 'RB') {
          camposCombinados.merchant_id = camposCombinados.rb_idAdquiriente;
          camposCombinados.terminal_id = camposCombinados.rb_idTerminal;
        }

        if (p.tipo === 'CBCO') {
          camposCombinados.merchant_id = camposCombinados.cb_commerce_id;
          camposCombinados.terminal_id = camposCombinados.cb_terminal_code;
          camposCombinados.cb_commerce_id = camposCombinados.cb_unique_code;
        }

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
          ...camposCombinados,
          ...(tipo_integracion === 'PCI' ? { is_pci: true } : {})
        };

        console.log('📤 Payload CCAPI:', JSON.stringify(appPayload, null, 2));

        const res = await fetch(`${CCAPI_URL}/v3/application`, {
          method: 'POST',
          headers,
          body: JSON.stringify(appPayload)
        });

        let json;
        try {
          json = await res.json();
        } catch (err) {
          const t = await res.text();
          json = { error: 'Respuesta no JSON', detalle: t };
        }

        responses.push({
          integrationCode,
          procesador: p.tipo,
          request: appPayload,
          status: res.status,
          response: json
        });

        if (res.ok && !createdApps[integrationCode]) {
          createdApps[integrationCode] = json;
        }
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

      let carriers = [];

      const pseEnabled = procesadores.some(p => p.carrier === 'PSE');
      const pseCommerceId = campos_extras?.pse_commerce_id?.trim();
      const pseTerminalId = campos_extras?.pse_terminal_id?.trim();

      if (pseEnabled && pseCommerceId && pseTerminalId) {
        carriers.push({
          carrier: 'PSE',
          commerce_id: pseCommerceId,
          terminal_id: pseTerminalId,
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
        });

        if (tipo_integracion === 'SERVER/CLIENT' && procesadores.length > 1) {
          carriers.push(ccapiCarrier);
        }
      }

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

      console.log('📤 Payload NOCCAPI:', JSON.stringify(noccapiBody, null, 2));

      const noa = await fetch('https://noccapi-stg.paymentez.com/commons/v1/create-or-update-application/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'auth-token': tokenStr
        },
        body: JSON.stringify(noccapiBody)
      });

      const noaJson = await noa.json().catch(async () => ({ error: await noa.text() }));

      noccapiResponse = {
        payload: noccapiBody,
        response: noaJson
      };
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
