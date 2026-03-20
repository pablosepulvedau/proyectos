/* =========================================
   BAKERY COST CALCULATOR - APP
   ========================================= */

// ── PLANES ───────────────────────────────────
const PLANES = {
  free: {
    nombre: 'Gratis', emoji: '🆓',
    maxIng: 5, maxRec: 2, imprimir: false,
    precio: 'Gratis', color: '#95a5a6',
    features: ['Hasta 5 ingredientes', 'Hasta 2 recetas', 'Cálculo de costos básico'],
  },
  panadero: {
    nombre: 'Panadero', emoji: '🥖',
    maxIng: 50, maxRec: 20, imprimir: true,
    precio: '$9.99 / mes', color: '#e67e22',
    features: ['Hasta 50 ingredientes', 'Hasta 20 recetas', 'Cálculo completo', 'Imprimir y exportar'],
  },
  pro: {
    nombre: 'Pro', emoji: '⭐',
    maxIng: Infinity, maxRec: Infinity, imprimir: true,
    precio: '$19.99 / mes', color: '#c0392b',
    features: ['Ingredientes ilimitados', 'Recetas ilimitadas', 'Cálculo completo', 'Imprimir y exportar', 'Soporte prioritario'],
  },
};

let currentPlan = 'free';

function planActual()       { return PLANES[currentPlan]; }
function puedeAgregarIng()  { return state.ingredientes.length < planActual().maxIng; }
function puedeAgregarRec()  { return state.recetas.length < planActual().maxRec; }

function actualizarPlanBadge() {
  const plan = planActual();
  const badge = document.getElementById('plan-badge');
  badge.textContent = `${plan.emoji} ${plan.nombre}`;
  badge.style.background = plan.color;
}

function mostrarModalUpgrade(motivo) {
  document.getElementById('upgrade-motivo').textContent = motivo;
  document.getElementById('upgrade-contacto').classList.add('hidden');
  document.getElementById('upgrade-planes').innerHTML = Object.entries(PLANES).map(([key, plan]) => `
    <div class="upgrade-plan-card ${key === currentPlan ? 'plan-actual' : ''}">
      <div class="upgrade-plan-header" style="background:${plan.color}">
        <span>${plan.emoji} ${plan.nombre}</span>
        <strong>${plan.precio}</strong>
      </div>
      <ul>${plan.features.map(f => `<li>✓ ${f}</li>`).join('')}</ul>
      ${key === currentPlan
        ? '<div class="plan-actual-badge">Plan actual</div>'
        : `<button class="upgrade-btn" style="background:${plan.color}" onclick="mostrarContacto('${plan.nombre}', '${plan.precio}')">Contratar →</button>`}
    </div>
  `).join('');
  abrirModal('modal-upgrade');
}

// ── AUTH ────────────────────────────────────
const auth = firebase.auth();
const db   = firebase.firestore();
const googleProvider    = new firebase.auth.GoogleAuthProvider();
const microsoftProvider = new firebase.auth.OAuthProvider('microsoft.com');
const facebookProvider  = new firebase.auth.FacebookAuthProvider();

let currentUser = null;

// ── OVERLAY CONTROL ─────────────────────────
function hideAllOverlays() {
  ['login-overlay', 'profile-overlay', 'pending-overlay'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  document.getElementById('auth-section').classList.add('hidden');
}

function mostrarErrorLogin(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function showApp(data) {
  hideAllOverlays();
  currentPlan = data.plan || 'free';
  Object.assign(state, { ingredientes: [], recetas: [], nextIngId: 1, nextRecId: 1 });
  if (data.ingredientes) state.ingredientes = data.ingredientes;
  if (data.recetas)      state.recetas      = data.recetas;
  if (data.nextIngId)    state.nextIngId    = data.nextIngId;
  if (data.nextRecId)    state.nextRecId    = data.nextRecId;

  document.getElementById('auth-section').classList.remove('hidden');
  document.getElementById('user-name').textContent = currentUser.name || currentUser.email;
  const avatarEl = document.getElementById('user-avatar');
  if (currentUser.picture) {
    avatarEl.src = currentUser.picture;
  } else {
    const ini = (currentUser.name || currentUser.email || '?')[0].toUpperCase();
    avatarEl.src = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='36' height='36'><rect width='36' height='36' rx='18' fill='%23c0392b'/><text x='18' y='25' font-size='18' text-anchor='middle' fill='white' font-family='sans-serif'>${ini}</text></svg>`;
  }
  avatarEl.alt = currentUser.name || '';
  actualizarPlanBadge();
  cargarDemoData();
  renderTablaIngredientes();
  renderRecetas();
}

// ── AUTH STATE ──────────────────────────────
auth.onAuthStateChanged(async user => {
  if (!user) {
    currentUser = null;
    state.ingredientes = [];
    state.recetas      = [];
    hideAllOverlays();
    document.getElementById('login-overlay').classList.remove('hidden');
    document.getElementById('login-error').classList.add('hidden');
    return;
  }

  currentUser = {
    id:        user.uid,
    name:      user.displayName || '',
    email:     user.email || '',
    picture:   user.photoURL || '',
    providers: user.providerData.map(p => p.providerId),
  };

  try {
    const docRef = db.collection('users').doc(user.uid);
    const doc    = await docRef.get();

    if (!doc.exists) {
      // Nuevo usuario → mostrar formulario de perfil
      hideAllOverlays();
      document.getElementById('perfil-nombre').value = currentUser.name;
      document.getElementById('perfil-correo').value = currentUser.email;
      document.getElementById('profile-overlay').classList.remove('hidden');
      return;
    }

    const data = doc.data();

    // Parchar campos faltantes (compatibilidad con docs que perdieron nombre/email)
    const patch = { authProviders: currentUser.providers };
    if (!data.name    && currentUser.name)    patch.name    = currentUser.name;
    if (!data.email   && currentUser.email)   patch.email   = currentUser.email;
    if (!data.picture && currentUser.picture) patch.picture = currentUser.picture;
    docRef.update(patch).catch(err => console.warn('Patch usuario:', err.message));

    // Cargar app con datos fusionados (para reflejar el parche de inmediato)
    showApp({ ...data, ...patch });
  } catch (err) {
    console.error('Error en auth state:', err);
    hideAllOverlays();
    document.getElementById('login-overlay').classList.remove('hidden');
  }
});

// ── SIGN-IN HANDLERS ────────────────────────
function signInWithProvider(provider) {
  document.getElementById('login-error').classList.add('hidden');
  auth.signInWithPopup(provider).catch(err => {
    if (err.code === 'auth/popup-closed-by-user' ||
        err.code === 'auth/cancelled-popup-request') return;
    if (err.code === 'auth/account-exists-with-different-credential') {
      mostrarErrorLogin('Este correo está registrado con otro método de inicio de sesión.');
      return;
    }
    mostrarErrorLogin('Error: ' + err.message);
  });
}

document.getElementById('btn-google').addEventListener('click',    () => signInWithProvider(googleProvider));
document.getElementById('btn-microsoft').addEventListener('click', () => signInWithProvider(microsoftProvider));
document.getElementById('btn-facebook').addEventListener('click',  () => signInWithProvider(facebookProvider));

// Email/contraseña
let emailMode = 'signin';
document.getElementById('btn-toggle-mode').addEventListener('click', () => {
  emailMode = emailMode === 'signin' ? 'register' : 'signin';
  const reg = emailMode === 'register';
  document.getElementById('btn-email-submit').textContent  = reg ? 'Crear cuenta' : 'Iniciar sesión';
  document.getElementById('login-toggle-text').textContent = reg ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?';
  document.getElementById('btn-toggle-mode').textContent   = reg ? 'Iniciar sesión' : 'Registrarte';
  document.getElementById('login-confirm-wrap').classList.toggle('hidden', !reg);
  document.getElementById('login-error').classList.add('hidden');
});

document.getElementById('btn-email-submit').addEventListener('click', async () => {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  document.getElementById('login-error').classList.add('hidden');
  if (!email || !password) { mostrarErrorLogin('Ingresa correo y contraseña.'); return; }
  try {
    if (emailMode === 'signin') {
      await auth.signInWithEmailAndPassword(email, password);
    } else {
      const confirm = document.getElementById('login-confirm').value;
      if (password !== confirm) { mostrarErrorLogin('Las contraseñas no coinciden.'); return; }
      if (password.length < 6)  { mostrarErrorLogin('La contraseña debe tener al menos 6 caracteres.'); return; }
      await auth.createUserWithEmailAndPassword(email, password);
    }
  } catch (err) {
    const msgs = {
      'auth/wrong-password':           'Contraseña incorrecta.',
      'auth/user-not-found':           'No existe cuenta con este correo.',
      'auth/email-already-in-use':     'Este correo ya está registrado.',
      'auth/weak-password':            'La contraseña debe tener al menos 6 caracteres.',
      'auth/invalid-email':            'Correo electrónico inválido.',
      'auth/too-many-requests':        'Demasiados intentos. Intenta más tarde.',
      'auth/invalid-credential':       'Correo o contraseña incorrectos.',
    };
    mostrarErrorLogin(msgs[err.code] || err.message);
  }
});

// ── PROFILE FORM ────────────────────────────
document.getElementById('form-perfil').addEventListener('submit', async e => {
  e.preventDefault();
  const btn       = e.target.querySelector('button[type="submit"]');
  const nombre    = document.getElementById('perfil-nombre').value.trim();
  const telefono  = document.getElementById('perfil-telefono').value.trim();
  const direccion = document.getElementById('perfil-direccion').value.trim();
  const comuna    = document.getElementById('perfil-comuna').value.trim();
  const region    = document.getElementById('perfil-region').value;
  const pais      = document.getElementById('perfil-pais').value.trim() || 'Chile';
  if (!nombre) { alert('El nombre es requerido.'); return; }

  btn.disabled = true;
  btn.textContent = 'Guardando...';
  try {
    if (auth.currentUser && auth.currentUser.displayName !== nombre) {
      await auth.currentUser.updateProfile({ displayName: nombre });
      currentUser.name = nombre;
    }

    // Verificar invitación previa del administrador
    const emailKey  = (currentUser.email || '').toLowerCase();
    const inviteRef = db.collection('pending_invites').doc(emailKey || '_sin_email');
    const inviteDoc = await inviteRef.get();
    // Verificar si el admin pre-asignó un plan
    let plan = 'free';
    if (inviteDoc.exists) {
      plan = inviteDoc.data().plan || 'free';
      await inviteRef.delete();
    }

    await db.collection('users').doc(currentUser.id).set({
      name:          nombre,
      email:         currentUser.email,
      picture:       currentUser.picture,
      authProviders: currentUser.providers,
      phone:         telefono,
      address:       direccion,
      commune:       comuna,
      region,
      country:       pais,
      plan,
      status:        'active',   // acceso inmediato al plan gratis
      planSince: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      ingredientes: [], recetas: [], nextIngId: 1, nextRecId: 1,
    });

    showApp({ plan, ingredientes: [], recetas: [], nextIngId: 1, nextRecId: 1 });
  } catch (err) {
    console.error('Error al guardar perfil:', err);
    alert('Error: ' + err.message);
    btn.disabled = false;
    btn.textContent = 'Guardar y continuar →';
  }
});

// ── SIGN OUT ────────────────────────────────
document.getElementById('btn-signout').addEventListener('click',         () => auth.signOut());
document.getElementById('btn-signout-pending').addEventListener('click', () => auth.signOut());

// ── STATE ──────────────────────────────────
const state = {
  ingredientes: [],   // { id, nombre, unidad, costo }
  recetas: [],        // { id, nombre, unidades, ingredientes: [{ ingId, cantidad }] }
  nextIngId: 1,
  nextRecId: 1,
};

// ── PERSISTENCE ────────────────────────────
function saveState() {
  if (!currentUser) return;
  db.collection('users').doc(currentUser.id).set({
    ingredientes: state.ingredientes,
    recetas:      state.recetas,
    nextIngId:    state.nextIngId,
    nextRecId:    state.nextRecId,
  }, { merge: true }).catch(err => console.error('Error al guardar:', err));
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
  if (!puedeAgregarIng()) {
    mostrarModalUpgrade(`Tu plan ${planActual().nombre} permite máximo ${planActual().maxIng} ingredientes.`);
    return;
  }
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
  if (!puedeAgregarRec()) {
    mostrarModalUpgrade(`Tu plan ${planActual().nombre} permite máximo ${planActual().maxRec} recetas.`);
    return;
  }
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
  if (!planActual().imprimir) {
    mostrarModalUpgrade('La función de imprimir y exportar no está disponible en tu plan actual.');
    return;
  }
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

// ── CONTACTO UPGRADE ───────────────────────
window.mostrarContacto = function(planNombre, planPrecio) {
  const email   = currentUser?.email || '';
  const mensaje = `Hola, me interesa contratar el Plan ${planNombre} (${planPrecio}). Mi correo es: ${email}`;

  document.getElementById('upgrade-contacto').innerHTML = `
    <div class="contacto-box">
      <p>Para contratar el <strong>Plan ${planNombre}</strong>, escríbenos por cualquiera de estos medios:</p>
      <div class="contacto-opciones">
        <button class="contacto-btn contacto-email" onclick="
          navigator.clipboard.writeText('pisepulvedau@gmail.com');
          this.textContent='✓ Copiado';
          setTimeout(()=>this.textContent='📧 Copiar correo',2000)
        ">📧 Copiar correo</button>
        <a class="contacto-btn contacto-wa"
           href="https://wa.me/?text=${encodeURIComponent(mensaje)}"
           target="_blank">💬 Escribir por WhatsApp</a>
      </div>
      <p class="contacto-nota">Indica tu correo <strong>${email}</strong> y el plan que deseas. Te activamos el acceso en menos de 24 horas.</p>
    </div>
  `;
  document.getElementById('upgrade-contacto').classList.remove('hidden');
};

// ── INIT ───────────────────────────────────
// La carga inicial ocurre en onGoogleSignIn después de autenticar
