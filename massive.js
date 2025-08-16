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

    document.getElementById("sendData").addEventListener("click", async () => {
      if (excelData.length === 0) {
        logMessage("No hay datos cargados desde Excel", "error");
        return;
      }

      for (let i = 0; i < excelData.length; i++) {
        const row = excelData[i];
        try {
          const res = await fetch("/.netlify/functions/crearAppsv2", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(row)
          });

          if (!res.ok) throw new Error(await res.text());

          const json = await res.json();
          logMessage(`Fila ${i + 1}: Enviado correctamente - AppCode: ${json.appCode || 'N/A'}`, "ok");
        } catch (err) {
          logMessage(`Fila ${i + 1}: Error - ${err.message}`, "error");
        }
      }
    });

    function logMessage(msg, type) {
      const logDiv = document.getElementById("log");
      const p = document.createElement("p");
      p.className = type;
      p.textContent = msg;
      logDiv.appendChild(p);
      logDiv.scrollTop = logDiv.scrollHeight;
    }