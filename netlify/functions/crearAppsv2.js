/*const fetch = require('node-fetch');
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
*/
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
      currency, tipo_integracion, procesadores,
      ambiente, clave // <-- recibido del frontend
    } = JSON.parse(event.body);

    // URLs según el ambiente
    const CCAPI_URL = ambiente === 'produccion'
      ? 'https://ccapi.paymentez.com'
      : 'https://ccapi-stg.paymentez.com';

    const NOCCAPI_URL = ambiente === 'produccion'
      ? 'https://noccapi.paymentez.com/commons/v1/create-or-update-application/'
      : 'https://noccapi-stg.paymentez.com/commons/v1/create-or-update-application/';

    // Credenciales según el ambiente

      let CCAPI_USERNAME, CCAPI_PASSWORD;

    if (clave === process.env.CLAVE_SANTIAGO) {
      CCAPI_USERNAME = process.env.CCAPI_USERNAME;
      CCAPI_PASSWORD = ambiente === 'produccion'
        ? process.env.CCAPI_PASSWORD_PROD
        : process.env.CCAPI_PASSWORD;
    } else if (clave === process.env.CLAVE_GERMAN) {
      CCAPI_USERNAME = process.env.CCAPI_USERNAME_GERMAN;
      CCAPI_PASSWORD = ambiente === 'produccion'
        ? process.env.CCAPI_PASSWORD_GERMAN_PROD
        : process.env.CCAPI_PASSWORD_GERMAN;
    } else {
      return { statusCode: 403, body: 'Clave no autorizada' };
    }

    const app_key = ambiente === 'produccion'
      ? process.env.PAYMENTEZ_APP_KEY_PROD
      : process.env.PAYMENTEZ_APP_KEY;

    const app_code = ambiente === 'produccion'
      ? process.env.PAYMENTEZ_APP_CODE
      : process.env.PAYMENTEZ_APP_CODE;

    const CCAPI_PASSWORD = ambiente === 'produccion'
      ? process.env.CCAPI_PASSWORD_PROD
      : process.env.CCAPI_PASSWORD;
 
    const LOGIN_URL = `${CCAPI_URL}/v3/user/login/`;
    const loginRes = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: CCAPI_USERNAME,
        password: CCAPI_PASSWORD
      })
    });
/*
    const LOGIN_URL = `${CCAPI_URL}/v3/user/login/`;
    const loginRes = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: process.env.CCAPI_USERNAME,
        password: CCAPI_PASSWORD
      })
    });
  */  
    if (!loginRes.ok) {
      const text = await loginRes.text();
      return { statusCode: loginRes.status, body: `Login fallido: ${text}` };
    }

    const { token } = await loginRes.json();
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Token ${token}`
    };

    // ... aquí sigue tu código actual pero usando las constantes CCAPI_URL, NOCCAPI_URL, app_key y app_code ya definidas ...


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
      if (createdApps[integrationCode]) continue;

      const camposApp = {};

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

        const campos = { ...(p.campos || {}) };

        if (p.tipo === 'CBCO') {
        campos['cb_unique_code'] = campos['cb_commerce_id'] || '';
      }


        Object.assign(camposApp, campos);
      }

      const appPayload = {
        name,
        code: integrationCode,
        owner_name,
        callback_url,
        use_ccapi_announce,
        http_notifications_enabled,
        currency,
        carrier: procesadores[0].carrier,
        carriers: globalCarriers,
        ...camposApp,
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
/*
      responses.push({
        integrationCode,
        procesador: 'multi',
        request: appPayload,
        status: res.status,
        response: json
      });
*/

      responses.push({
        integrationCode,
        status: res.status,
        response: json
      });

      if (res.ok) {
        createdApps[integrationCode] = json;
      }
    }

    // === NOCCAPI INTEGRATION ===
    let noccapiResponse = null;
    let carriers_noccapi = [];

    const serverCode = tipo_integracion === 'SERVER/CLIENT' ? `${code}-SERVER` : integrations[0];
    const serverData = createdApps[serverCode];

    if (serverData) {
      const authRes = await fetch('https://pg-micros.paymentez.com/v1/unixtime/');
      const { unixtime } = await authRes.json();
      /*
      const app_code = process.env.PAYMENTEZ_APP_CODE;
      const app_key = process.env.PAYMENTEZ_APP_KEY;
      */
      const uniq = CryptoJS.SHA256(app_key + unixtime).toString();
      const tokenStr = Buffer.from(`${app_code};${unixtime};${uniq}`).toString('base64');

      const hasOnlyPSE = procesadores.every(p => p.carrier === 'PSE');
      const cardCarriers = ['67', '27', '34']; // carriers que activan CCAPI
      const hasCardProcessor = procesadores.some(p => cardCarriers.includes(p.carrier));

      // Buscar el procesador tipo PSE
      const pseProcessor = procesadores.find(p => p.carrier === 'PSE' && p.campos?.carrier_noccapi === 'PSE');

      if (pseProcessor && pseProcessor.campos?.commerce_id && pseProcessor.campos?.terminal_id) {
        carriers_noccapi.push({
          carrier: 'PSE',
          commerce_id: pseProcessor.campos.commerce_id.trim(),
          terminal_id: pseProcessor.campos.terminal_id.trim(),
          country_default: 'COL',
          agreement: {
            ciiu: pseProcessor.campos?.beneficiaryEntityCIIUCategory || '',
            is_v2: true,
            beneficiaryData: {
              beneficiaryEntityName: pseProcessor.campos?.beneficiaryEntityName || '',
              beneficiaryEntityCIIUCategory: pseProcessor.campos?.beneficiaryEntityCIIUCategory || '',
              beneficiaryEntityIdentification: pseProcessor.campos?.beneficiaryEntityIdentification || '',
              beneficiaryEntityIdentificationType: pseProcessor.campos?.beneficiaryEntityIdentificationType || ''
            }
          },
          currency_default: 'COP',
          max_amount: 1000000000,
          min_amount: 1
        });
      } else {
        console.log('⚠️ NO se agregó carrier PSE - datos incompletos o no presentes en procesadores[].');
      }

      if (!hasOnlyPSE && (hasCardProcessor || tipo_integracion === 'PCI' || tipo_integracion === 'LTP')) {
        const clientData = createdApps[`${code}-CLIENT`] || {};
        const codeForCards = (tipo_integracion === 'PCI' || tipo_integracion === 'LTP')
          ? serverData.code
          : clientData.code || '';

        const keyForCards = (tipo_integracion === 'PCI' || tipo_integracion === 'LTP')
          ? serverData.key
          : clientData.key || '';

        if (codeForCards && keyForCards) {
          carriers_noccapi.push({
            carrier: 'ccapi',
            commerce_id: codeForCards,
            terminal_id: keyForCards,
            country_default: 'COL',
            currency_default: currency,
            agreement: {},
            max_amount: 1000000000,
            min_amount: 1
          });
        } else {
          console.log('⚠️ NO se agregó carrier ccapi - faltan code/key.');
        }
      }

      console.log('🧪 carriers_noccapi:', JSON.stringify(carriers_noccapi, null, 2));

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
          noccapi: carriers_noccapi,
          ccapi: []
        }
      };

      console.log('📤 Payload NOCCAPI:', JSON.stringify(noccapiBody, null, 2));

      const noa = await fetch(NOCCAPI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'auth-token': tokenStr
        },
        body: JSON.stringify(noccapiBody)
      });

      const noaJson = await noa.json().catch(async () => ({ error: await noa.text() }));
/*
      noccapiResponse = {
        payload: noccapiBody,
        response: noaJson
      };
    }

    

    return {
      statusCode: 200,
      body: JSON.stringify({ results: responses, noccapiResponse, debug: { carriers_noccapi } })
    };
*/

      noccapiResponse = {
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
