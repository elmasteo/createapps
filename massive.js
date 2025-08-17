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

    const registrosValidos = excelData.filter(row => row.code && row.owner_name);
    logMessage(
      `Archivo cargado: ${file.name} - ${registrosValidos.length} registros válidos`,
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

  if (cfg.fijos) {
    Object.assign(campos, deepClone(cfg.fijos));
  }

  if (cfg.usa_noccapi) {
    campos.carrier_noccapi = cfg.carrier; // "PSE"
  }

  return {
    carrier: cfg.carrier,
    tipo,
    campos,
  };
}

function buildProcesadores(row) {
  const procs = [];

  if (hasAny(row, ["CBCO_cb_commerce_id", "CBCO_cb_terminal_code"])) {
    procs.push(
      mergeFixed("CBCO", {
        cb_commerce_id: row["CBCO_cb_commerce_id"],
        cb_terminal_code: row["CBCO_cb_terminal_code"],
      })
    );
  }

  if (hasAny(row, ["RB_rb_idAdquiriente", "RB_rb_idTerminal"])) {
    procs.push(
      mergeFixed("RB", {
        rb_idAdquiriente: row["RB_rb_idAdquiriente"],
        rb_idTerminal: row["RB_rb_idTerminal"],
      })
    );
  }

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

  return procs.filter(Boolean);
}

document.getElementById("sendData").addEventListener("click", async () => {
  if (excelData.length === 0) {
    logMessage("No hay datos cargados desde Excel", "error");
    return;
  }

  for (let i = 0; i < excelData.length; i++) {
    const row = excelData[i];
    const code = (row["code"] || "").toString().trim();
    const ownerName = (row["owner_name"] || "").toString().trim();

    if (!code || !ownerName) {
      // 🚫 Omitir en silencio
      continue;
    }

    const procesadores = buildProcesadores(row);
    if (procesadores.length === 0) {
      // 🚫 Omitir en silencio
      continue;
    }

    const payload = {
      name: ownerName,
      code,
      owner_name: ownerName,
      callback_url: row["callback_url"] || "",
      use_ccapi_announce: true,
      http_notifications_enabled: true,
      currency: row["currency"] || "",
      tipo_integracion: row["tipo_integracion"] || "SERVER/CLIENT",
      procesadores,
      ambiente: row["ambiente"] || "stg",
    };

    try {
      const res = await fetch("/.netlify/functions/crearAppsv2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());

      const json = await res.json();

      // ✅ Loguear la respuesta COMPLETA, bien formateada
      logMessage(
        `✅ Fila ${i + 1}: Enviado correctamente\n` +
          `🟢 Respuesta completa:\n${JSON.stringify(json, null, 2)}`,
        "ok"
      );
    } catch (err) {
      logMessage(
        `❌ Fila ${i + 1}: Error al enviar\n` +
          `🔴 Error: ${err.message}`,
        "error"
      );
    }
  }
});

function logMessage(msg, type) {
  const logDiv = document.getElementById("logmassive");
  const pre = document.createElement("pre"); // usar <pre> para formato multilínea
  pre.className = type;
  pre.textContent = msg;
  logDiv.appendChild(pre);
  logDiv.scrollTop = logDiv.scrollHeight;
}
