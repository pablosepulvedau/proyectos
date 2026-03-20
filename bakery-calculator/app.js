/* =========================================
   BAKERY COST CALCULATOR - APP
   ========================================= */

// ── STATE ──────────────────────────────────
const state = {
  ingredientes: [],   // { id, nombre, unidad, costo }
  recetas: [],        // { id, nombre, unidades, ingredientes: [{ ingId, cantidad }] }
  nextIngId: 1,
  nextRecId: 1,
};

// ── PERSISTENCE ────────────────────────────
function saveState() {
  localStorage.setItem('bakery_state', JSON.stringify(state));
}

function loadState() {
  const saved = localStorage.getItem('bakery_state');
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved);
    Object.assign(state, parsed);
  } catch {}
}

// ── HELPERS ────────────────────────────────
function fmt(n) {
  return '$' + Number(n).toFixed(2);
}

function genId(prefix) {
  return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

function getIngById(id) {
  return state.ingredientes.find(i => i.id === id);
}

function getRecById(id) {
  return state.recetas.find(r => r.id === id);
}

// ── TABS ───────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'calculo') actualizarSelectRecetas();
  });
});

// ── INGREDIENTES ───────────────────────────
document.getElementById('form-ingrediente').addEventListener('submit', e => {
  e.preventDefault();
  const nombre = document.getElementById('ing-nombre').value.trim();
  const unidad = document.getElementById('ing-unidad').value;
  const costo  = parseFloat(document.getElementById('ing-costo').value);
  if (!nombre || isNaN(costo) || costo < 0) return;

  state.ingredientes.push({ id: genId('ing'), nombre, unidad, costo });
  saveState();
  renderTablaIngredientes();
  e.target.reset();
});

document.getElementById('buscar-ingrediente').addEventListener('input', function () {
  renderTablaIngredientes(this.value.toLowerCase());
});

function renderTablaIngredientes(filtro = '') {
  const tbody = document.getElementById('tbody-ingredientes');
  const lista = state.ingredientes.filter(i =>
    i.nombre.toLowerCase().includes(filtro)
  );

  if (lista.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No hay ingredientes registrados</td></tr>';
    return;
  }

  tbody.innerHTML = lista.map((ing, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${ing.nombre}</td>
      <td>${ing.unidad}</td>
      <td>${fmt(ing.costo)}</td>
      <td>
        <button class="btn-edit" onclick="abrirEditarIngrediente('${ing.id}')">Editar</button>
        <button class="btn btn-danger" onclick="eliminarIngrediente('${ing.id}')">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

// Modal editar ingrediente
let editingIngId = null;

window.abrirEditarIngrediente = function(id) {
  const ing = getIngById(id);
  if (!ing) return;
  editingIngId = id;
  document.getElementById('edit-ing-nombre').value = ing.nombre;
  document.getElementById('edit-ing-unidad').value = ing.unidad;
  document.getElementById('edit-ing-costo').value  = ing.costo;
  abrirModal('modal-ingrediente');
};

document.getElementById('btn-guardar-ing').addEventListener('click', () => {
  const ing = getIngById(editingIngId);
  if (!ing) return;
  ing.nombre = document.getElementById('edit-ing-nombre').value.trim();
  ing.unidad = document.getElementById('edit-ing-unidad').value;
  ing.costo  = parseFloat(document.getElementById('edit-ing-costo').value);
  saveState();
  renderTablaIngredientes();
  renderRecetas();
  actualizarCalculos();
  cerrarModales();
});

document.getElementById('btn-cancelar-ing').addEventListener('click', cerrarModales);

window.eliminarIngrediente = function(id) {
  const ing = getIngById(id);
  if (!ing) return;
  if (!confirm(`¿Eliminar "${ing.nombre}"? Se quitará de todas las recetas.`)) return;
  state.ingredientes = state.ingredientes.filter(i => i.id !== id);
  state.recetas.forEach(r => {
    r.ingredientes = r.ingredientes.filter(ri => ri.ingId !== id);
  });
  saveState();
  renderTablaIngredientes();
  renderRecetas();
};

// ── RECETAS ────────────────────────────────
document.getElementById('form-receta').addEventListener('submit', e => {
  e.preventDefault();
  const nombre   = document.getElementById('rec-nombre').value.trim();
  const unidades = parseInt(document.getElementById('rec-unidades').value);
  if (!nombre || isNaN(unidades) || unidades < 1) return;

  state.recetas.push({ id: genId('rec'), nombre, unidades, ingredientes: [] });
  saveState();
  renderRecetas();
  e.target.reset();
});

function renderRecetas() {
  const cont = document.getElementById('recetas-lista');
  if (state.recetas.length === 0) {
    cont.innerHTML = '<p class="empty-state">No hay recetas creadas aún</p>';
    return;
  }

  cont.innerHTML = state.recetas.map(rec => {
    const ingsHtml = rec.ingredientes.length === 0
      ? '<li style="color:var(--text-muted);font-style:italic">Sin ingredientes</li>'
      : rec.ingredientes.map(ri => {
          const ing = getIngById(ri.ingId);
          if (!ing) return '';
          const sub = ing.costo * ri.cantidad;
          return `<li>
            <span>${ing.nombre} — ${ri.cantidad} ${ing.unidad}</span>
            <span style="display:flex;gap:.4rem;align-items:center">
              ${fmt(sub)}
              <button class="btn btn-danger" style="padding:.15rem .5rem;font-size:.75rem"
                onclick="quitarIngredienteReceta('${rec.id}','${ri.ingId}')">×</button>
            </span>
          </li>`;
        }).join('');

    return `
      <div class="receta-card">
        <div class="receta-card-header">
          <div>
            <h4>${rec.nombre}</h4>
            <span class="lote-info">Lote: ${rec.unidades} unidad${rec.unidades !== 1 ? 'es' : ''}</span>
          </div>
        </div>
        <ul class="receta-ing-list">${ingsHtml}</ul>
        <div class="receta-card-actions">
          <button class="btn btn-primary btn-sm" onclick="abrirAgregarIngReceta('${rec.id}')">+ Ingrediente</button>
          <button class="btn btn-ghost btn-sm" onclick="editarUnidadesReceta('${rec.id}')">Editar lote</button>
          <button class="btn btn-danger btn-sm" onclick="eliminarReceta('${rec.id}')">Eliminar</button>
        </div>
      </div>
    `;
  }).join('');
}

window.quitarIngredienteReceta = function(recId, ingId) {
  const rec = getRecById(recId);
  if (!rec) return;
  rec.ingredientes = rec.ingredientes.filter(ri => ri.ingId !== ingId);
  saveState();
  renderRecetas();
  actualizarCalculos();
};

window.eliminarReceta = function(id) {
  const rec = getRecById(id);
  if (!rec) return;
  if (!confirm(`¿Eliminar la receta "${rec.nombre}"?`)) return;
  state.recetas = state.recetas.filter(r => r.id !== id);
  saveState();
  renderRecetas();
  actualizarSelectRecetas();
};

window.editarUnidadesReceta = function(id) {
  const rec = getRecById(id);
  if (!rec) return;
  const val = prompt(`Unidades por lote para "${rec.nombre}":`, rec.unidades);
  if (val === null) return;
  const n = parseInt(val);
  if (isNaN(n) || n < 1) { alert('Ingresa un número válido mayor a 0'); return; }
  rec.unidades = n;
  saveState();
  renderRecetas();
  actualizarCalculos();
};

// Modal agregar ingrediente a receta
let recetaActivaId = null;

window.abrirAgregarIngReceta = function(recId) {
  if (state.ingredientes.length === 0) {
    alert('Primero debes agregar ingredientes en la pestaña "Ingredientes".');
    return;
  }
  recetaActivaId = recId;
  const rec = getRecById(recId);
  document.getElementById('modal-receta-titulo').textContent = `Agregar ingrediente — ${rec.nombre}`;

  const select = document.getElementById('rec-ing-select');
  select.innerHTML = state.ingredientes.map(i =>
    `<option value="${i.id}">${i.nombre} (${i.unidad}) — ${fmt(i.costo)}</option>`
  ).join('');
  document.getElementById('rec-ing-cantidad').value = '';
  abrirModal('modal-receta-ing');
};

document.getElementById('btn-agregar-rec-ing').addEventListener('click', () => {
  const ingId    = document.getElementById('rec-ing-select').value;
  const cantidad = parseFloat(document.getElementById('rec-ing-cantidad').value);
  if (!recetaActivaId || !ingId || isNaN(cantidad) || cantidad <= 0) {
    alert('Ingresa una cantidad válida.');
    return;
  }

  const rec = getRecById(recetaActivaId);
  const existing = rec.ingredientes.find(ri => ri.ingId === ingId);
  if (existing) {
    existing.cantidad = cantidad;
  } else {
    rec.ingredientes.push({ ingId, cantidad });
  }

  saveState();
  renderRecetas();
  cerrarModales();
});

document.getElementById('btn-cancelar-rec-ing').addEventListener('click', cerrarModales);

// ── CÁLCULO ────────────────────────────────
function actualizarSelectRecetas() {
  const sel = document.getElementById('calc-receta');
  const prev = sel.value;
  sel.innerHTML = '<option value="">-- Seleccione una receta --</option>' +
    state.recetas.map(r => `<option value="${r.id}">${r.nombre}</option>`).join('');
  if (prev) sel.value = prev;
  actualizarCalculos();
}

document.getElementById('calc-receta').addEventListener('change', actualizarCalculos);

['costo-mano-obra','costo-energia','costo-empaque','costo-otros'].forEach(id => {
  document.getElementById(id).addEventListener('input', actualizarCalculos);
});

const margenSlider = document.getElementById('margen-ganancia');
const margenValor  = document.getElementById('margen-valor');
margenSlider.addEventListener('input', () => {
  margenValor.textContent = margenSlider.value + '%';
  actualizarCalculos();
});

function actualizarCalculos() {
  const recId = document.getElementById('calc-receta').value;
  const det   = document.getElementById('calculo-detalle');
  const vacio = document.getElementById('calculo-vacio');

  if (!recId) {
    det.classList.add('hidden');
    vacio.classList.remove('hidden');
    return;
  }

  const rec = getRecById(recId);
  if (!rec) return;

  det.classList.remove('hidden');
  vacio.classList.add('hidden');

  // Calcular costo ingredientes
  let totalIng = 0;
  const tbody = document.getElementById('tbody-ing-receta');
  if (rec.ingredientes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);font-style:italic">Sin ingredientes</td></tr>';
  } else {
    tbody.innerHTML = rec.ingredientes.map(ri => {
      const ing = getIngById(ri.ingId);
      if (!ing) return '';
      const sub = ing.costo * ri.cantidad;
      totalIng += sub;
      return `<tr>
        <td>${ing.nombre}</td>
        <td>${ri.cantidad}</td>
        <td>${ing.unidad}</td>
        <td>${fmt(sub)}</td>
      </tr>`;
    }).join('');
  }
  document.getElementById('total-ingredientes').textContent = fmt(totalIng);

  // Costos adicionales
  const manoObra = parseFloat(document.getElementById('costo-mano-obra').value) || 0;
  const energia  = parseFloat(document.getElementById('costo-energia').value)   || 0;
  const empaque  = parseFloat(document.getElementById('costo-empaque').value)    || 0;
  const otros    = parseFloat(document.getElementById('costo-otros').value)      || 0;

  const costoLote  = totalIng + manoObra + energia + otros + (empaque * rec.unidades);
  const costoUnit  = rec.unidades > 0 ? costoLote / rec.unidades : 0;
  const margen     = parseFloat(margenSlider.value) / 100;
  const precioVenta = costoUnit * (1 + margen);
  const gananciaUnit = precioVenta - costoUnit;
  const gananciaLote = gananciaUnit * rec.unidades;

  document.getElementById('res-costo-lote').textContent   = fmt(costoLote);
  document.getElementById('res-unidades').textContent     = rec.unidades;
  document.getElementById('res-costo-unidad').textContent = fmt(costoUnit);
  document.getElementById('res-precio-venta').textContent = fmt(precioVenta);
  document.getElementById('res-ganancia').textContent     = fmt(gananciaUnit);
  document.getElementById('res-ganancia-lote').textContent = fmt(gananciaLote);
}

// ── IMPRIMIR ────────────────────────────────
document.getElementById('btn-imprimir').addEventListener('click', () => {
  window.print();
});

// ── MODALES ────────────────────────────────
function abrirModal(id) {
  document.getElementById(id).classList.remove('hidden');
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function cerrarModales() {
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  document.getElementById('modal-overlay').classList.add('hidden');
  editingIngId = null;
  recetaActivaId = null;
}

document.getElementById('modal-overlay').addEventListener('click', cerrarModales);

// ── DEMO DATA ──────────────────────────────
function cargarDemoData() {
  if (state.ingredientes.length > 0) return; // ya hay datos

  const demos = [
    { nombre: 'Harina de trigo', unidad: 'kg',    costo: 1.20 },
    { nombre: 'Azúcar',          unidad: 'kg',    costo: 0.90 },
    { nombre: 'Mantequilla',     unidad: 'kg',    costo: 5.50 },
    { nombre: 'Huevos',          unidad: 'unidad',costo: 0.18 },
    { nombre: 'Leche',           unidad: 'L',     costo: 0.85 },
    { nombre: 'Cacao en polvo',  unidad: 'kg',    costo: 6.00 },
    { nombre: 'Polvo de hornear',unidad: 'g',     costo: 0.02 },
    { nombre: 'Vainilla',        unidad: 'ml',    costo: 0.05 },
  ];
  demos.forEach(d => {
    state.ingredientes.push({ id: genId('ing'), ...d });
  });

  // Receta demo: Torta de Chocolate
  const recId = genId('rec');
  const ings  = state.ingredientes;
  state.recetas.push({
    id: recId,
    nombre: 'Torta de Chocolate (molde 22cm)',
    unidades: 8,
    ingredientes: [
      { ingId: ings[0].id, cantidad: 0.25 },  // harina 250g
      { ingId: ings[1].id, cantidad: 0.2  },  // azúcar 200g
      { ingId: ings[2].id, cantidad: 0.1  },  // mantequilla 100g
      { ingId: ings[3].id, cantidad: 3    },  // 3 huevos
      { ingId: ings[4].id, cantidad: 0.15 },  // leche 150ml
      { ingId: ings[5].id, cantidad: 0.05 },  // cacao 50g
      { ingId: ings[6].id, cantidad: 5    },  // polvo hornear 5g
      { ingId: ings[7].id, cantidad: 5    },  // vainilla 5ml
    ]
  });

  saveState();
}

// ── INIT ───────────────────────────────────
loadState();
cargarDemoData();
renderTablaIngredientes();
renderRecetas();
