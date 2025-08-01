const fetch = require('node-fetch');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Método no permitido' };
  }

  const {
    name,
    code,
    owner_name,
    callback_url,
    use_ccapi_announce,
    http_notifications_enabled,
    currency,
    tipo_integracion,
    procesadores, // [{ tipo: "CBCO", campos: { cb_acquirer_id, cb_commerce_id, ... } }]
    carrier,
    carriers
  } = JSON.parse(event.body);

  const CCAPI_URL = process.env.CCAPI_URL;
  const LOGIN_URL = `${CCAPI_URL}/v3/user/login/`;

  const tokenRes = await fetch(LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.CCAPI_USERNAME,
      password: process.env.CCAPI_PASSWORD,
    })
  });

  if (!tokenRes.ok) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Login fallido' }) };
  }

  const { token } = await tokenRes.json();
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
        ...proc.campos // insertar dinámicamente campos del procesador
      };

      const res = await fetch(`${CCAPI_URL}/v3/application`, {
        method: 'POST',
        headers,
        body: JSON.stringify(appPayload)
      });

      const data = await res.json();
      responses.push({
        integrationCode,
        procesador: proc.tipo,
        status: res.status,
        response: data
      });
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ resultados: responses })
  };
};
