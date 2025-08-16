let appIndex = 0;

function addApp() {
  const c = document.createElement('div');
  c.className = 'app-container';
  c.innerHTML = `
    <button class="remove-app" onclick="removeApp(this)" title="Eliminar App">×</button>
    <h3>App ${appIndex + 1}</h3>
    <label>Código: <input name="code" /></label>
    <label>Owner: <input name="owner_name" /></label>
    <label>Callback URL: <input name="callback_url" /></label>
    <label>Moneda: <input name="currency" value="COP" /></label>
    <label>Tipo integración:
      <select name="tipo_integracion">
        <option value="SERVER/CLIENT">SERVER/CLIENT</option>
        <option value="PCI">PCI</option>
        <option value="LTP">LTP</option>
      </select>
    </label>
    <div class="procesadores"></div>
    <button type="button" onclick="addProcesador(this)">+ Procesador</button>
  `;
  document.getElementById('apps').appendChild(c);
  appIndex++;
  updateAppHeaders();
}

function removeApp(btn) {
  btn.parentElement.remove();
  const totalApps = document.querySelectorAll('.app-container').length;
  if (totalApps === 0) {
    appIndex = 0;
  }
  updateAppHeaders();
}

function updateAppHeaders() {
  const apps = document.querySelectorAll('.app-container');
  apps.forEach((app, i) => {
    const header = app.querySelector('h3');
    if (header) header.textContent = `App ${i + 1}`;
  });
}



    function addProcesador(btn) {
      if (!procesadoresConfig) return;
      const pdiv = document.createElement('div');
      pdiv.className = 'proc-container';
      pdiv.innerHTML = `
        <label>Procesador:
          <select name="tipo" onchange="renderCampos(this)">
            ${Object.keys(procesadoresConfig).map(k => `<option>${k}</option>`).join('')}
          </select>
        </label>
        <div class="campos"></div>
        <button type="button" onclick="this.parentElement.remove()">Eliminar Procesador</button>
      `;
      btn.closest('.app-container').querySelector('.procesadores').appendChild(pdiv);
      const select = pdiv.querySelector('[name="tipo"]');
      renderCampos(select);
    }

    function renderCampos(el) {
      const select = el.tagName === 'SELECT' ? el : el.parentElement.querySelector('[name="tipo"]');
      const proc = select.closest('.proc-container');
      const tipo = select.value;
      const spec = procesadoresConfig[tipo];
      const div = proc.querySelector('.campos');
      div.innerHTML = '';
      Object.entries(spec.campos).forEach(([field, def]) => {
        const label = def.label || field;

        if (def.valorFijo !== undefined) {
          const inp = document.createElement('input');
          inp.type = 'hidden';
          inp.name = field;
          inp.value = def.valorFijo;
          div.appendChild(inp);
        } else {
          const lbl = document.createElement('label');
          lbl.textContent = label;
          const inp = document.createElement('input');
          inp.name = field;
          lbl.appendChild(inp);
          div.appendChild(lbl);
        }
      });

    }

    async function enviarApps() {
      const log = document.getElementById('log');
      log.textContent = '';
      const apps = document.querySelectorAll('.app-container');
      for (const app of apps) {
        const ownerName = app.querySelector('[name="name"]')?.value || app.querySelector('[name="owner_name"]').value;

        const payload = {
          code: app.querySelector('[name="code"]').value,
          name: ownerName,
          owner_name: ownerName,
          callback_url: app.querySelector('[name="callback_url"]').value,
          currency: app.querySelector('[name="currency"]').value,
          tipo_integracion: app.querySelector('[name="tipo_integracion"]').value,
          use_ccapi_announce: true,
          http_notifications_enabled: true,
          procesadores: []
        };

        app.querySelectorAll('.proc-container').forEach(p => {
        const tipo = p.querySelector('[name="tipo"]').value;
        const campos = {};

        // Campos visibles del frontend
        p.querySelectorAll('input').forEach(i => {
          if (i.name) campos[i.name] = i.value === 'true' ? true : (i.value === 'false' ? false : i.value);
        });

        // Agregar campos fijos si existen
        const fijos = procesadoresConfig[tipo].fijos || {};
        for (const [k, v] of Object.entries(fijos)) {
          campos[k] = v;
        }

        // ✅ Incluir carrier_noccapi si es requerido
        if (procesadoresConfig[tipo].usa_noccapi) {
          campos.carrier_noccapi = procesadoresConfig[tipo].carrier;
        }

        payload.procesadores.push({
          tipo,
          carrier: procesadoresConfig[tipo].carrier,
          campos
        });
      });

        const resp = await fetch('/.netlify/functions/crearAppsv2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, ambiente: window.AMBIENTE }) // Enviamos el ambiente
      });


        const data = await resp.json();
        log.innerHTML += `<div><strong>App ${payload.code}</strong> → <pre>${JSON.stringify(data, null, 2)}</pre></div><hr>`;
      }
    }

    let procesadoresConfig = null;

    window.onload = function () {
      procesadoresConfig = window.procesadoresConfig;
      addApp();
    };