exports.handler = async (event) => {
  const { clave } = JSON.parse(event.body || '{}');

  const CLAVES_VALIDAS = [
    process.env.CLAVE_SANTIAGO,
    process.env.CLAVE_GERMAN
  ]; 

  const accesoPermitido = CLAVES_VALIDAS.map(c => c?.trim()).includes(clave?.trim());

  return {
    statusCode: 200,
    body: JSON.stringify({ autorizado: accesoPermitido })
  };
};
