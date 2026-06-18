let nodes = [];
let connections = [];

// ── Tabs ──────────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.app-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tab)
  );
  document.querySelectorAll('.panel').forEach(p =>
    p.classList.toggle('active', p.id === 'panel-' + tab)
  );
}

// ── Nodes ─────────────────────────────────────────────────────────────────
function addNode() {
  const input = document.getElementById('node-name');
  const val = input.value.trim();
  if (!val) return showError('node-error', 'Ingresa un nombre para el punto de entrega.');
  if (nodes.includes(val)) return showError('node-error', `El punto "${val}" ya existe.`);
  clearError('node-error');
  nodes.push(val);
  input.value = '';
  renderNodes();
  renderSelects();
}

function removeNode(name) {
  nodes = nodes.filter(n => n !== name);
  connections = connections.filter(c => c.from !== name && c.to !== name);
  renderNodes();
  renderSelects();
  renderConnections();
}

function renderNodes() {
  const list  = document.getElementById('node-list');
  const empty = document.getElementById('node-empty');

  if (!nodes.length) {
    list.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }

  empty.style.display = 'none';
  list.innerHTML = `<ol class="node-ol">
    ${nodes.map((n, i) => `
      <li class="node-item">
        <span class="node-num">${i + 1}</span>
        <i class="ti ti-map-pin-filled node-icon" aria-hidden="true"></i>
        <span class="node-name">${escapeHtml(n)}</span>
        <button class="node-del" onclick="removeNode(${JSON.stringify(n)})" aria-label="Eliminar ${escapeHtml(n)}">
          <i class="ti ti-trash"></i>
        </button>
      </li>
    `).join('')}
  </ol>`;
}

// ── Connections ───────────────────────────────────────────────────────────
function addConnection() {
  const from = document.getElementById('conn-from').value;
  const to   = document.getElementById('conn-to').value;
  const km   = parseFloat(document.getElementById('conn-km').value);

  if (!from || !to) return showError('conn-error', 'Selecciona los puntos de origen y destino.');
  if (from === to)  return showError('conn-error', 'El origen y el destino no pueden ser el mismo punto.');
  if (!km || km <= 0) return showError('conn-error', 'Ingresa una distancia válida mayor a 0.');

  const duplicate = connections.find(c =>
    (c.from === from && c.to === to) || (c.from === to && c.to === from)
  );
  if (duplicate) return showError('conn-error', 'Ya existe una conexión entre estos dos puntos.');

  clearError('conn-error');
  connections.push({ from, to, km });
  document.getElementById('conn-km').value = '';
  renderConnections();
}

function removeConnection(idx) {
  connections.splice(idx, 1);
  renderConnections();
}

function renderConnections() {
  const list  = document.getElementById('conn-list');
  const empty = document.getElementById('conn-empty');

  if (!connections.length) {
    list.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }

  empty.style.display = 'none';
  list.innerHTML = connections.map((c, i) => `
    <div class="conn-row">
      <span class="conn-from">${escapeHtml(c.from)}</span>
      <span class="conn-arrow"><i class="ti ti-arrow-right"></i></span>
      <span class="conn-to">${escapeHtml(c.to)}</span>
      <span class="badge-km">${c.km} km</span>
      <button class="conn-del" onclick="removeConnection(${i})" aria-label="Eliminar conexión">
        <i class="ti ti-trash"></i>
      </button>
    </div>
  `).join('');
}

// ── Route ─────────────────────────────────────────────────────────────────
function calcularRuta() {
  const from   = document.getElementById('ruta-from').value;
  const to     = document.getElementById('ruta-to').value;
  const result = document.getElementById('ruta-result');

  if (!from || !to) {
    result.innerHTML = emptyResult('Selecciona los puntos de origen y destino.');
    return;
  }
  if (from === to) {
    result.innerHTML = emptyResult('El origen y el destino deben ser puntos distintos.');
    return;
  }

  const paths = findAllPaths(from, to);

  if (!paths.length) {
    result.innerHTML = `
      <div class="result-card">
        <div class="result-label is-error">Sin ruta disponible</div>
        <p style="font-size:14px; color:var(--text-secondary);">No existe ninguna ruta entre <strong>${escapeHtml(from)}</strong> y <strong>${escapeHtml(to)}</strong>.</p>
      </div>`;
    return;
  }

  const shown = paths.slice(0, 5);
  result.innerHTML = `<div class="results-list">${shown.map((p, i) => buildResult(p.route, p.km, i === 0, i + 1)).join('')}</div>`;
}

function findAllPaths(from, to) {
  const paths = [];

  function dfs(current, path, totalKm, visited) {
    if (current === to) {
      paths.push({ route: [...path], km: totalKm });
      return;
    }
    connections.forEach(c => {
      let neighbor = null, edgeKm = 0;
      if (c.from === current && !visited.has(c.to)) {
        neighbor = c.to; edgeKm = c.km;
      } else if (c.to === current && !visited.has(c.from)) {
        neighbor = c.from; edgeKm = c.km;
      }
      if (neighbor !== null) {
        visited.add(neighbor);
        path.push(neighbor);
        dfs(neighbor, path, totalKm + edgeKm, visited);
        path.pop();
        visited.delete(neighbor);
      }
    });
  }

  const visited = new Set([from]);
  dfs(from, [from], 0, visited);
  return paths.sort((a, b) => a.km - b.km);
}

function buildResult(route, total, isBest, rank) {
  const stops = route.length - 2;
  const typeLabel = stops === 0
    ? 'Ruta directa'
    : `${stops} parada${stops !== 1 ? 's' : ''} intermedia${stops !== 1 ? 's' : ''}`;
  const rankLabel  = isBest ? 'Mejor ruta' : `Alternativa ${rank}`;
  const cardClass  = isBest ? 'best' : 'alt';
  const labelClass = isBest ? 'is-direct' : 'is-alt';

  const steps = route.map((n, i) => {
    const isEndpoint = i === 0 || i === route.length - 1;
    const pill = `<span class="route-node ${isEndpoint ? 'highlight' : ''}">${escapeHtml(n)}</span>`;
    return i === 0 ? pill : `<span class="route-arrow-icon"><i class="ti ti-arrow-right"></i></span>${pill}`;
  }).join('');

  return `
    <div class="result-card ${cardClass}">
      <div class="result-meta">
        <span class="result-label ${labelClass}">${rankLabel}</span>
        <span class="result-type">${typeLabel}</span>
      </div>
      <div class="route-steps">${steps}</div>
      <div class="result-distance">${round1(total)}<span>km totales</span></div>
    </div>`;
}

function emptyResult(msg) {
  return `<p class="result-empty">${escapeHtml(msg)}</p>`;
}

// ── Selects ───────────────────────────────────────────────────────────────
function renderSelects() {
  ['conn-from', 'conn-to', 'ruta-from', 'ruta-to'].forEach(id => {
    const sel = document.getElementById(id);
    const prev = sel.value;
    sel.innerHTML = nodes.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
    if (nodes.includes(prev)) sel.value = prev;
  });
}

// ── Utilities ─────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function round1(n) { return Math.round(n * 10) / 10; }

function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function clearError(id) {
  const el = document.getElementById(id);
  if (el) { el.textContent = ''; el.style.display = 'none'; }
}

// ── Init ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderNodes();
  renderSelects();
  renderConnections();

  document.getElementById('node-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') addNode();
  });
});
