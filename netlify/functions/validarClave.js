exports.handler = async (event) => {
  const { clave } = JSON.parse(event.body || '{}');

  const CLAVES_VALIDAS = [
  process.env.CLAVE_SANTIAGO,
]; 

  const accesoPermitido = CLAVES_VALIDAS.includes(clave);

  return {
    statusCode: 200,
    body: JSON.stringify({ autorizado: accesoPermitido })
  };
};
