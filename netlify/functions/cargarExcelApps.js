const XLSX = require('xlsx');
const fetch = require('node-fetch');

// Copiamos la configuración de procesadores al backend
const procesadoresConfig = {
  CBCO: {
    carrier: "67",
    campos: {
      cb_commerce_id: { tipo: 'texto' },
      cb_terminal_code: { tipo: 'texto' }
    },
    fijos: {
      cb_acquirer_id: "1",
      cb_using: true,
      cb_v2: true
    }
  },
  RB: {
    carrier: "27",
    campos: {
      rb_idAdquiriente: { tipo: 'texto' },
      rb_idTerminal: { tipo: 'texto' }
    },
    fijos: {
      rb_capacidadPIN: "Virtual",
      rb_modoCapturaPAN: "Manual",
      rb_password: "R3d3b4n$.",
      rb_tipoTerminal: "WEB",
      rb_username: "0013974936",
      rb_wsdl_cancelacion_url: "http://cdn-checkout-1.paymentez.com.s3.amazonaws.com/backend/redeban_prod/CompraCancelacion/CompraElectronicaCancelacionService.wsdl",
      rb_wsdl_compra_url: "http://cdn-checkout-1.paymentez.com.s3.amazonaws.com/backend/redeban_prod/compraElectronica/CompraElectronicaService.wsdl",
      rb_using: true
    }
  },
  PR: {
    carrier: "34",
    campos: {
      pr_retailer_id: { tipo: 'texto' },
      pr_acceptor_location_id: { tipo: 'texto' },
      pr_fiid: { tipo: 'texto' },
      pr_merchant_type: { tipo: 'texto' },
      pr_acceptor_name: { tipo: 'texto' }
    },
    fijos: {
      pr_using: true
    }
  },
  PSE: {
    carrier: "PSE",
    usa_noccapi: true,
    campos: {
      commerce_id: { tipo: 'texto', label: 'Commerce ID' },
      terminal_id: { tipo: 'texto', label: 'Terminal ID' },
      beneficiaryEntityName: { tipo: 'texto', label: 'Nombre Beneficiario' },
      beneficiaryEntityCIIUCategory: { tipo: 'texto', label: 'Categoría CIIU Beneficiario' },
      beneficiaryEntityIdentification: { tipo: 'texto', label: 'Documento Beneficiario' },
      beneficiaryEntityIdentificationType: { tipo: 'texto', label: 'Tipo Documento Beneficiario' }
    },
    fijos: {
      country_default: 'COL',
      currency_default: 'COP',
      max_amount: 1000000000,
      min_amount: 1,
      agreement: {
        is_v2: true
      }
    }
  }
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Método no permitido' };
  }

  try {
    const formDataBoundary = event.headers['content-type'].split('boundary=')[1];
    const bodyBuffer = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');

    // Parse multipart/form-data para extraer el archivo Excel
    const parts = bodyBuffer.toString().split(`--${formDataBoundary}`);
    const filePart = parts.find(p => p.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'));
    if (!filePart) {
      return { statusCode: 400, body: 'Archivo Excel no encontrado en la solicitud' };
    }

    const fileBuffer = Buffer.from(filePart.split('\r\n\r\n')[1].trim(), 'binary');

    // Leer Excel en memoria
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

    const results = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Reconstruir procesadores desde campos individuales
      const procesadores = [];
      for (const [procKey, procData] of Object.entries(procesadoresConfig)) {
        let tieneDatos = false;
        const camposDinamicos = {};

        for (const campoKey of Object.keys(procData.campos)) {
          const colName = `${procKey}_${campoKey}`;
          if (row[colName] && String(row[colName]).trim() !== "") {
            camposDinamicos[campoKey] = row[colName];
            tieneDatos = true;
          }
        }

        if (tieneDatos) {
          procesadores.push({
            carrier: procData.carrier,
            tipo: procKey,
            campos: { ...procData.fijos, ...camposDinamicos }
          });
        }
      }

      try {
        const payload = {
          name: row.name,
          code: row.code,
          owner_name: row.owner_name,
          callback_url: row.callback_url,
          use_ccapi_announce: true,
          http_notifications_enabled: true,
          currency: row.currency,
          tipo_integracion: row.tipo_integracion,
          ambiente: row.ambiente,
          procesadores
        };

        const res = await fetch(`${process.env.BASE_URL}/.netlify/functions/crearAppsv2`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const json = await res.json().catch(() => ({ error: 'Respuesta no JSON' }));

        results.push({
          fila: i + 1,
          status: res.status,
          response: json
        });
      } catch (err) {
        results.push({
          fila: i + 1,
          status: 500,
          error: err.message
        });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ total: rows.length, resultados: results })
    };

  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error procesando archivo Excel', detalle: e.message })
    };
  }
};
