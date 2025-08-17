// massive.js
// Requiere que procesadores.js esté cargado ANTES para usar window.procesadoresConfig

let excelData = [];

document.getElementById("excelFile").addEventListener("change", handleFile);

function handleFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    excelData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

    logMessage(
      `Archivo cargado: ${file.name} - ${excelData.length} registros`,
      "ok"
    );
  };
  reader.readAsArrayBuffer(file);
}

function hasAny(row, keys) {
  return keys.some((k) => (row[k] ?? "").toString().trim() !== "");
}

function deepClone(obj) {
  try {
    // para navegadores modernos
    return typeof structuredClone === "function"
      ? structuredClone(obj)
      : JSON.parse(JSON.stringify(obj));
  } catch {
    return JSON.parse(JSON.stringify(obj));
  }
}

function mergeFixed(tipo, visibles) {
  const cfgAll = window.procesadoresConfig || {};
  const cfg = cfgAll[tipo];
  if (!cfg) return null;

  const campos = { ...visibles };

  // Mezclar fijos del procesador
  if (cfg.fijos) {
    Object.assign(campos, deepClone(cfg.fijos));
  }

  // Si usa NOCCAPI (p.ej. PSE), agregar marca para el backend
  if (cfg.usa_noccapi) {
    // En tu backend se valida carrier_noccapi === 'PSE'
    campos.carrier_noccapi = cfg.carrier; // "PSE"
  }

  return {
    carrier: cfg.carrier, // "67", "27", "34" o "PSE"
    tipo,                 // "CBCO", "RB", "PR", "PSE"
    campos,
  };
}

function buildProcesadores(row) {
  const procs = [];

  // --- CBCO ---
  if (hasAny(row, ["CBCO_cb_commerce_id", "CBCO_cb_terminal_code"])) {
    procs.push(
      mergeFixed("CBCO", {
        cb_commerce_id: row["CBCO_cb_commerce_id"],
        cb_terminal_code: row["CBCO_cb_terminal_code"],
      })
    );
  }

  // --- RB ---
  if (hasAny(row, ["RB_rb_idAdquiriente", "RB_rb_idTerminal"])) {
    procs.push(
      mergeFixed("RB", {
        rb_idAdquiriente: row["RB_rb_idAdquiriente"],
        rb_idTerminal: row["RB_rb_idTerminal"],
      })
    );
  }

  // --- PR (opcional si tienes columnas para PR) ---
  if (
    hasAny(row, [
      "PR_pr_retailer_id",
      "PR_pr_acceptor_location_id",
      "PR_pr_fiid",
      "PR_pr_merchant_type",
      "PR_pr_acceptor_name",
    ])
  ) {
    procs.push(
      mergeFixed("PR", {
        pr_retailer_id: row["PR_pr_retailer_id"],
        pr_acceptor_location_id: row["PR_pr_acceptor_location_id"],
        pr_fiid: row["PR_pr_fiid"],
        pr_merchant_type: row["PR_pr_merchant_type"],
        pr_acceptor_name: row["PR_pr_acceptor_name"],
      })
    );
  }

  // --- PSE ---
  if (
    hasAny(row, [
      "PSE_commerce_id",
      "PSE_terminal_id",
      "PSE_beneficiaryEntityName",
      "PSE_beneficiaryEntityCIIUCategory",
      "PSE_beneficiaryEntityIdentification",
      "PSE_beneficiaryEntityIdentificationType",
    ])
  ) {
    procs.push(
      mergeFixed("PSE", {
        commerce_id: row["PSE_commerce_id"],
        terminal_id: row["PSE_terminal_id"],
        beneficiaryEntityName: row["PSE_beneficiaryEntityName"],
        beneficiaryEntityCIIUCategory: row["PSE_beneficiaryEntityCIIUCategory"],
        beneficiaryEntityIdentification:
          row["PSE_beneficiaryEntityIdentification"],
        beneficiaryEntityIdentificationType:
          row["PSE_beneficiaryEntityIdentificationType"],
      })
    );
  }

  // limpiar nulos si faltó config
  return procs.filter(Boolean);
}

document.getElementById("sendData").addEventListener("click", async () => {
  if (excelData.length === 0) {
    logMessage("No hay datos cargados desde Excel", "error");
    return;
  }

  for (let i = 0; i < excelData.length; i++) {
    const row = excelData[i];

    // ✅ Validar antes de enviar
    const code = (row["code"] || "").toString().trim();
    const ownerName = (row["owner_name"] || "").toString().trim();

    if (!code || !ownerName) {
      logMessage(
        `Fila ${i + 1}: Omitida (faltan campos obligatorios: code / owner_name)`,
        "error"
      );
      continue;
    }

    const procesadores = buildProcesadores(row);
    if (procesadores.length === 0) {
      logMessage(
        `Fila ${i + 1}: Omitida (sin procesadores válidos)`,
        "error"
      );
      continue;
    }

    // 🚀 Armar payload como espera el backend
    const payload = {
      name: row["owner_name"] || "",
      code: row["code"] || "",
      owner_name: row["owner_name"] || "",
      callback_url: row["callback_url"] || "",
      use_ccapi_announce: true,
      http_notifications_enabled: true,
      currency: row["currency"] || "",
      tipo_integracion: row["tipo_integracion"] || "SERVER/CLIENT",
      procesadores: buildProcesadores(row),
      ambiente: row["ambiente"] || "stg" // opcional: o podrías poner un select en el HTML
    };

    try {
      const res = await fetch("/.netlify/functions/crearAppsv2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());

      const json = await res.json();
      // Toma el primer code de respuesta si hay varios (SERVER/CLIENT)
      const firstResultCode =
        json?.results?.find((r) => r?.response?.code)?.response?.code || "N/A";

      logMessage(
        `Fila ${i + 1}: Enviado correctamente - AppCode: ${firstResultCode}`,
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
