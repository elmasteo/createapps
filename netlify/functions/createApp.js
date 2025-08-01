const fetch = require('node-fetch');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Método no permitido' };
  }

  try {
    const {
      name,
      code,
      owner_name,
      callback_url,
      use_ccapi_announce,
      http_notifications_enabled,
      currency,
      tipo_integracion,
      procesadores // [{ tipo: "CBCO", carrier: 67, campos: { ... } }]
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
      const errText = await loginRes.text();
      return { statusCode: loginRes.status, body: `Login fallido: ${errText}` };
    }

    const { token } = await loginRes.json();
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Token ${token}`
    };

    const responses = [];

    const integrations = tipo_integracion === 'SERVER/CLIENT'
      ? [`${code}-SERVER`, `${code}-CLIENT`]
      : [code];

    for (const integrationCode of integrations) {
      for (const proc of procesadores) {
        const carrier = proc.carrier;
        const carriers = procesadores.map(p => ({
          carrier: p.carrier,
          prefix: p.tipo,
          max: 1000.0,
          min: 1.0,
          order: 1
        }));

        const appPayload = {
          name,
          code: integrationCode,
          owner_name,
          callback_url,
          use_ccapi_announce,
          http_notifications_enabled,
          currency,
          carrier,
          carriers,
          ...proc.campos // campos específicos del procesador
        };

        const res = await fetch(`${CCAPI_URL}/v3/application`, {
          method: 'POST',
          headers,
          body: JSON.stringify(appPayload)
        });

        let responseData;
          try {
            responseData = await res.json();
          } catch (jsonErr) {
            const errText = await res.text();
            responseData = { error: 'Respuesta no JSON', detalle: errText };
          }

        responses.push({
          integrationCode,
          procesador: proc.tipo,
          status: res.status,
          response: responseData
        });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ resultados: responses })
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error inesperado', detalle: e.message })
    };
  }
};
