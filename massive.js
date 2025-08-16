let excelData = [];

document.getElementById("excelFile").addEventListener("change", handleFile);

function handleFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    excelData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

    logMessage(`Archivo cargado: ${file.name} - ${excelData.length} registros`, "ok");
  };
  reader.readAsArrayBuffer(file);
}

function buildProcesadores(row) {
  const procesadores = [];

  // --- CBCO ---
  if (row["CBCO_cb_commerce_id"] || row["CBCO_cb_terminal_code"]) {
    procesadores.push({
      carrier: "CBCO",
      tipo: "CBCO",
      campos: {
        cb_commerce_id: row["CBCO_cb_commerce_id"],
        cb_terminal_code: row["CBCO_cb_terminal_code"]
      }
    });
  }

  // --- RB ---
  if (row["RB_rb_idAdquiriente"] || row["RB_rb_idTerminal"]) {
    procesadores.push({
      carrier: "RB",
      tipo: "RB",
      campos: {
        rb_idAdquiriente: row["RB_rb_idAdquiriente"],
        rb_idTerminal: row["RB_rb_idTerminal"]
      }
    });
  }

  // --- PSE ---
  if (row["PSE_commerce_id"] || row["PSE_terminal_id"]) {
    procesadores.push({
      carrier: "PSE",
      tipo: "PSE",
      campos: {
        commerce_id: row["PSE_commerce_id"],
        terminal_id: row["PSE_terminal_id"],
        beneficiaryEntityName: row["PSE_beneficiaryEntityName"],
        beneficiaryEntityCIIUCategory: row["PSE_beneficiaryEntityCIIUCategory"],
        beneficiaryEntityIdentification: row["PSE_beneficiaryEntityIdentification"],
        beneficiaryEntityIdentificationType: row["PSE_beneficiaryEntityIdentificationType"],
        carrier_noccapi: "PSE" // para que el backend lo detecte
      }
    });
  }

  return procesadores;
}

document.getElementById("sendData").addEventListener("click", async () => {
  if (excelData.length === 0) {
    logMessage("No hay datos cargados desde Excel", "error");
    return;
  }

  for (let i = 0; i < excelData.length; i++) {
    const row = excelData[i];

    // 🚀 Armar payload como espera el backend
    const payload = {
      name: row["Nombre"] || "",
      code: row["Código"] || "",
      owner_name: row["Cliente"] || "",
      callback_url: row["Callback"] || "",
      use_ccapi_announce: true,
      http_notifications_enabled: true,
      currency: "COP",
      tipo_integracion: row["Tipo Integración"] || "SERVER/CLIENT",
      procesadores: buildProcesadores(row),
      ambiente: row["Ambiente"] || "stg" // opcional: o podrías poner un select en el HTML
    };

    try {
      const res = await fetch("/.netlify/functions/crearAppsv2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(await res.text());

      const json = await res.json();
      logMessage(
        `Fila ${i + 1}: Enviado correctamente - AppCode: ${json.results?.[0]?.response?.code || 'N/A'}`,
        "ok"
      );
    } catch (err) {
      logMessage(`Fila ${i + 1}: Error - ${err.message}`, "error");
    }
  }
});

function logMessage(msg, type) {
  const logDiv = document.getElementById("logmassive");
  const p = document.createElement("p");
  p.className = type;
  p.textContent = msg;
  logDiv.appendChild(p);
  logDiv.scrollTop = logDiv.scrollHeight;
}
