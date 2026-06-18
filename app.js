var nodes = [];
var connections = [];

// ── Tabs ──────────────────────────────────────────────────────────────────
function switchTab(tab) {
  var tabs = document.querySelectorAll('.app-tab');
  for (var i = 0; i < tabs.length; i++) {
    if (tabs[i].dataset.tab === tab) {
      tabs[i].classList.add('active');
    } else {
      tabs[i].classList.remove('active');
    }
  }

  var panels = document.querySelectorAll('.panel');
  for (var i = 0; i < panels.length; i++) {
    if (panels[i].id === 'panel-' + tab) {
      panels[i].classList.add('active');
    } else {
      panels[i].classList.remove('active');
    }
  }
}

// ── Nodes ─────────────────────────────────────────────────────────────────
function addNode() {
  var input = document.getElementById('node-name');
  var val = input.value.trim();

  if (!val) {
    showError('node-error', 'Ingresa un nombre para el punto de entrega.');
    return;
  }

  var alreadyExists = false;
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i] === val) {
      alreadyExists = true;
      break;
    }
  }
  if (alreadyExists) {
    showError('node-error', 'El punto "' + val + '" ya existe.');
    return;
  }

  clearError('node-error');
  nodes.push(val);
  input.value = '';
  renderNodes();
  renderSelects();
}

function removeNode(name) {
  var newNodes = [];
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i] !== name) {
      newNodes.push(nodes[i]);
    }
  }
  nodes = newNodes;

  var newConnections = [];
  for (var i = 0; i < connections.length; i++) {
    if (connections[i].from !== name && connections[i].to !== name) {
      newConnections.push(connections[i]);
    }
  }
  connections = newConnections;

  renderNodes();
  renderSelects();
  renderConnections();
}

function renderNodes() {
  var list = document.getElementById('node-list');
  var empty = document.getElementById('node-empty');

  if (nodes.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }

  empty.style.display = 'none';
  var html = '<ol class="node-ol">';
  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i];
    html += '<li class="node-item">';
    html += '<span class="node-num">' + (i + 1) + '</span>';
    html += '<i class="ti ti-map-pin-filled node-icon" aria-hidden="true"></i>';
    html += '<span class="node-name">' + escapeHtml(n) + '</span>';
    html += '<button class="node-del" onclick="removeNode(' + JSON.stringify(n) + ')" aria-label="Eliminar ' + escapeHtml(n) + '">';
    html += '<i class="ti ti-trash"></i>';
    html += '</button>';
    html += '</li>';
  }
  html += '</ol>';
  list.innerHTML = html;
}

// ── Connections ───────────────────────────────────────────────────────────
function addConnection() {
  var from = document.getElementById('conn-from').value;
  var to   = document.getElementById('conn-to').value;
  var km   = parseFloat(document.getElementById('conn-km').value);

  if (!from || !to) {
    showError('conn-error', 'Selecciona los puntos de origen y destino.');
    return;
  }
  if (from === to) {
    showError('conn-error', 'El origen y el destino no pueden ser el mismo punto.');
    return;
  }
  if (!km || km <= 0) {
    showError('conn-error', 'Ingresa una distancia válida mayor a 0.');
    return;
  }

  var duplicate = false;
  for (var i = 0; i < connections.length; i++) {
    var c = connections[i];
    if ((c.from === from && c.to === to) || (c.from === to && c.to === from)) {
      duplicate = true;
      break;
    }
  }
  if (duplicate) {
    showError('conn-error', 'Ya existe una conexión entre estos dos puntos.');
    return;
  }

  clearError('conn-error');
  connections.push({ from: from, to: to, km: km });
  document.getElementById('conn-km').value = '';
  renderConnections();
}

function removeConnection(idx) {
  connections.splice(idx, 1);
  renderConnections();
}

function renderConnections() {
  var list  = document.getElementById('conn-list');
  var empty = document.getElementById('conn-empty');

  if (connections.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }

  empty.style.display = 'none';
  var html = '';
  for (var i = 0; i < connections.length; i++) {
    var c = connections[i];
    html += '<div class="conn-row">';
    html += '<span class="conn-from">' + escapeHtml(c.from) + '</span>';
    html += '<span class="conn-arrow"><i class="ti ti-arrow-right"></i></span>';
    html += '<span class="conn-to">' + escapeHtml(c.to) + '</span>';
    html += '<span class="badge-km">' + c.km + ' km</span>';
    html += '<button class="conn-del" onclick="removeConnection(' + i + ')" aria-label="Eliminar conexión">';
    html += '<i class="ti ti-trash"></i>';
    html += '</button>';
    html += '</div>';
  }
  list.innerHTML = html;
}

// ── Route ─────────────────────────────────────────────────────────────────
function calcularRuta() {
  var from   = document.getElementById('ruta-from').value;
  var to     = document.getElementById('ruta-to').value;
  var result = document.getElementById('ruta-result');

  if (!from || !to) {
    result.innerHTML = emptyResult('Selecciona los puntos de origen y destino.');
    return;
  }
  if (from === to) {
    result.innerHTML = emptyResult('El origen y el destino deben ser puntos distintos.');
    return;
  }

  var paths = findAllPaths(from, to);

  if (paths.length === 0) {
    result.innerHTML =
      '<div class="result-card">' +
        '<div class="result-label is-error">Sin ruta disponible</div>' +
        '<p style="font-size:14px; color:var(--text-secondary);">No existe ninguna ruta entre <strong>' + escapeHtml(from) + '</strong> y <strong>' + escapeHtml(to) + '</strong>.</p>' +
      '</div>';
    return;
  }

  var html = '<div class="results-list">';
  for (var i = 0; i < paths.length && i < 5; i++) {
    html += buildResult(paths[i].route, paths[i].km, i === 0, i + 1);
  }
  html += '</div>';
  result.innerHTML = html;
}

function findAllPaths(from, to) {
  var paths   = [];
  var visited = [from];

  function dfs(current, path, totalKm) {
    if (current === to) {
      var routeCopy = [];
      for (var j = 0; j < path.length; j++) {
        routeCopy.push(path[j]);
      }
      paths.push({ route: routeCopy, km: totalKm });
      return;
    }

    for (var i = 0; i < connections.length; i++) {
      var c        = connections[i];
      var neighbor = null;
      var edgeKm   = 0;

      if (c.from === current) {
        var seen = false;
        for (var k = 0; k < visited.length; k++) {
          if (visited[k] === c.to) { seen = true; break; }
        }
        if (!seen) {
          neighbor = c.to;
          edgeKm   = c.km;
        }
      } else if (c.to === current) {
        var seen = false;
        for (var k = 0; k < visited.length; k++) {
          if (visited[k] === c.from) { seen = true; break; }
        }
        if (!seen) {
          neighbor = c.from;
          edgeKm   = c.km;
        }
      }

      if (neighbor !== null) {
        visited.push(neighbor);
        path.push(neighbor);
        dfs(neighbor, path, totalKm + edgeKm);
        path.pop();
        visited.pop();
      }
    }
  }

  dfs(from, [from], 0);

  // Ordenar de menor a mayor km (bubble sort)
  for (var i = 0; i < paths.length - 1; i++) {
    for (var j = 0; j < paths.length - 1 - i; j++) {
      if (paths[j].km > paths[j + 1].km) {
        var temp    = paths[j];
        paths[j]     = paths[j + 1];
        paths[j + 1] = temp;
      }
    }
  }

  return paths;
}

function buildResult(route, total, isBest, rank) {
  var stops = route.length - 2;

  var typeLabel;
  if (stops === 0) {
    typeLabel = 'Ruta directa';
  } else if (stops === 1) {
    typeLabel = '1 parada intermedia';
  } else {
    typeLabel = stops + ' paradas intermedias';
  }

  var rankLabel;
  var cardClass;
  var labelClass;
  if (isBest) {
    rankLabel  = 'Mejor ruta';
    cardClass  = 'best';
    labelClass = 'is-direct';
  } else {
    rankLabel  = 'Alternativa ' + rank;
    cardClass  = 'alt';
    labelClass = 'is-alt';
  }

  var steps = '';
  for (var i = 0; i < route.length; i++) {
    var n          = route[i];
    var nodeClass  = (i === 0 || i === route.length - 1) ? 'route-node highlight' : 'route-node';
    var pill       = '<span class="' + nodeClass + '">' + escapeHtml(n) + '</span>';
    if (i === 0) {
      steps += pill;
    } else {
      steps += '<span class="route-arrow-icon"><i class="ti ti-arrow-right"></i></span>' + pill;
    }
  }

  var html = '<div class="result-card ' + cardClass + '">';
  html += '<div class="result-meta">';
  html += '<span class="result-label ' + labelClass + '">' + rankLabel + '</span>';
  html += '<span class="result-type">' + typeLabel + '</span>';
  html += '</div>';
  html += '<div class="route-steps">' + steps + '</div>';
  html += '<div class="result-distance">' + round1(total) + '<span>km totales</span></div>';
  html += '</div>';
  return html;
}

function emptyResult(msg) {
  return '<p class="result-empty">' + escapeHtml(msg) + '</p>';
}

// ── Selects ───────────────────────────────────────────────────────────────
function renderSelects() {
  var ids = ['conn-from', 'conn-to', 'ruta-from', 'ruta-to'];
  for (var i = 0; i < ids.length; i++) {
    var sel  = document.getElementById(ids[i]);
    var prev = sel.value;
    var html = '';
    for (var j = 0; j < nodes.length; j++) {
      html += '<option value="' + escapeHtml(nodes[j]) + '">' + escapeHtml(nodes[j]) + '</option>';
    }
    sel.innerHTML = html;

    var stillExists = false;
    for (var j = 0; j < nodes.length; j++) {
      if (nodes[j] === prev) {
        stillExists = true;
        break;
      }
    }
    if (stillExists) {
      sel.value = prev;
    }
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function showError(id, msg) {
  var el = document.getElementById(id);
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
  }
}

function clearError(id) {
  var el = document.getElementById(id);
  if (el) {
    el.textContent = '';
    el.style.display = 'none';
  }
}

// ── Init ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  renderNodes();
  renderSelects();
  renderConnections();

  document.getElementById('node-name').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      addNode();
    }
  });
});
