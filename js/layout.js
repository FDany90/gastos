/* ============================================================
   Layout + UI compartida: sidebar con nivel/racha, carga rápida
   global (FAB), sistema de modales reutilizable, toasts y confeti.
   ============================================================ */
const UI = (function () {
  /* ---------- modal genérico por configuración de campos ---------- */
  function buildField(f) {
    if (f.type === 'row') return `<div class="field-row">${f.fields.map(buildField).join('')}</div>`;
    const id = 'f_' + f.name;
    let input;
    if (f.type === 'select') {
      const opts = f.options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        const sel = f.value != null && String(f.value) === String(v) ? 'selected' : '';
        return `<option value="${v}" ${sel}>${l}</option>`;
      }).join('');
      input = `<select name="${f.name}" id="${id}" ${f.required ? 'required' : ''}>${opts}</select>`;
    } else {
      input = `<input type="${f.type || 'text'}" name="${f.name}" id="${id}" value="${f.value ?? ''}" ` +
        `${f.step ? `step="${f.step}"` : ''} ${f.min != null ? `min="${f.min}"` : ''} ` +
        `${f.placeholder ? `placeholder="${f.placeholder}"` : ''} ${f.required ? 'required' : ''}>`;
    }
    return `<div class="field"><label for="${id}">${f.label}</label>${input}</div>`;
  }
  function flatten(fields) {
    return fields.flatMap((f) => (f.type === 'row' ? flatten(f.fields) : [f]));
  }

  function formModal({ title, fields, submitLabel = 'Guardar', onSubmit }) {
    const root = document.getElementById('modalRoot');
    root.innerHTML = `
      <div class="modal-bg open">
        <form class="modal" id="modalForm" autocomplete="off">
          <h2>${title}</h2>
          ${fields.map(buildField).join('')}
          <div class="modal-actions">
            <button type="button" class="btn ghost" id="modalCancel">Cancelar</button>
            <button type="submit" class="btn">${submitLabel}</button>
          </div>
        </form>
      </div>`;
    const bg = root.querySelector('.modal-bg');
    const form = root.querySelector('#modalForm');
    const close = () => { root.innerHTML = ''; };
    root.querySelector('#modalCancel').onclick = close;
    bg.onclick = (e) => { if (e.target === bg) close(); };
    document.onkeydown = (e) => { if (e.key === 'Escape') close(); };
    form.onsubmit = (e) => {
      e.preventDefault();
      const vals = {};
      flatten(fields).forEach((f) => {
        const el = form.elements[f.name];
        if (!el) return;
        vals[f.name] = f.type === 'number' ? parseFloat(el.value || 0) : el.value;
      });
      onSubmit(vals); close();
    };
    // foco al primer campo => carga rápida
    const first = form.querySelector('input, select');
    if (first) first.focus();
  }

  /* ---------- toasts + confeti ---------- */
  function toast({ emoji = '✅', title, sub = '' }) {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<div class="emoji">${emoji}</div><div><strong>${title}</strong><span>${sub}</span></div>`;
    wrap.appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .4s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }, 3800);
  }
  function confetti() {
    const colors = ['#5b6cff', '#16a34a', '#f59e0b', '#e11d48', '#8b5cf6', '#0ea5e9'];
    for (let i = 0; i < 36; i++) {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = colors[i % colors.length];
      c.style.animation = `fall ${1 + Math.random() * 1.2}s ${Math.random() * 0.3}s ease-in forwards`;
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 2600);
    }
  }
  function celebrate(logros) {
    confetti();
    logros.forEach((l, i) => setTimeout(() => toast({ emoji: l.emoji, title: '¡Logro desbloqueado!', sub: `${l.nombre} · +50 XP` }), i * 350));
  }

  return { formModal, toast, confetti, celebrate };
})();
window.UI = UI;

/* ============================================================
   Layout: arma sidebar, estado de nivel/racha y la carga rápida.
   ============================================================ */
const Layout = (function () {
  const NAV = [
    { page: 'dashboard', href: 'index.html', ico: '🏠', label: 'Balance' },
    { page: 'gastos', href: 'gastos.html', ico: '💸', label: 'Gastos' },
    { page: 'ingresos', href: 'ingresos.html', ico: '💰', label: 'Ingresos' },
    { page: 'inversiones', href: 'inversiones.html', ico: '📈', label: 'Inversiones' },
    { page: 'metas', href: 'metas.html', ico: '🎯', label: 'Metas & Logros' },
    { page: 'reportes', href: 'reportes.html', ico: '📊', label: 'Reportes' },
  ];

  function renderSidebar(active) {
    const links = NAV.map((n) =>
      `<a href="${n.href}" class="${n.page === active ? 'active' : ''}"><span class="ico">${n.ico}</span>${n.label}</a>`
    ).join('');
    return `
      <div class="brand"><span class="logo">💸</span> GASTOS</div>
      <div class="nav-label">Menú</div>
      ${links}
      <div class="side-foot" id="sideFoot"></div>`;
  }

  function renderStatus() {
    const s = Store.getState();
    const nv = Gamification.nivelInfo(s.stats.xp);
    const racha = Gamification.rachaActual(s);
    const mt = document.getElementById('mtStreak');
    if (mt) mt.textContent = `🔥 ${racha}`;
    const foot = document.getElementById('sideFoot');
    if (!foot) return;
    const anon = window.Auth && Auth.isAnonymous();
    foot.innerHTML = `
      <div class="level-card">
        <div class="lvl-top">
          <div class="lvl-emoji">${nv.emoji}</div>
          <div>
            <div class="lvl-name">${nv.nombre}</div>
            <div class="lvl-num">Nivel ${nv.nivel} · ${nv.xp} XP</div>
          </div>
        </div>
        <div class="xp-bar"><span style="width:${nv.progreso}%"></span></div>
        <div class="xp-text">
          <span>${nv.siguiente ? 'Próx: ' + nv.siguiente.nombre : '¡Nivel máximo!'}</span>
          <span>${nv.siguiente ? 'faltan ' + nv.faltan : ''}</span>
        </div>
        <div class="streak-chip">
          <span class="flame">🔥</span>
          <span class="n">${racha}</span>
          <span class="t">${racha === 1 ? 'día seguido' : 'días seguidos'}<br>registrando</span>
        </div>
      </div>
      ${anon ? `<button class="acct-btn" id="secureBtn" title="Asegurá tus datos con email">🔒 Asegurar cuenta</button>` : ''}`;
    const sec = document.getElementById('secureBtn');
    if (sec) sec.onclick = secureAccount;
  }

  /* Convierte la cuenta anónima en permanente (email + contraseña) */
  function secureAccount() {
    UI.formModal({
      title: '🔒 Asegurar mi cuenta',
      submitLabel: 'Guardar',
      fields: [
        { name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'tu@email.com' },
        { name: 'password', label: 'Contraseña (mín. 6)', type: 'password', required: true, placeholder: '••••••' },
      ],
      onSubmit: async (v) => {
        if (!v.email || !v.password) return;
        try {
          await Auth.linkEmail(v.email, v.password);
          UI.toast({ emoji: '✅', title: 'Cuenta asegurada', sub: 'Revisá tu email si pide confirmación' });
          renderStatus();
        } catch (e) {
          UI.toast({ emoji: '⚠️', title: 'No se pudo asegurar', sub: e.message || '' });
        }
      },
    });
  }

  /* ---------- carga rápida de gasto (FAB, disponible en todas las páginas) ---------- */
  function quickAddGasto() {
    const s = Store.getState();
    UI.formModal({
      title: '⚡ Cargar gasto rápido',
      submitLabel: 'Guardar (+5 XP)',
      fields: [
        { type: 'row', fields: [
          { name: 'monto', label: 'Monto', type: 'number', step: '0.01', min: 0, required: true, placeholder: '0.00' },
          { name: 'moneda', label: 'Moneda', type: 'select', options: ['ARS', 'USD'] },
        ] },
        { name: 'categoria', label: 'Categoría', type: 'select', options: s.categoriasGasto.map((c) => ({ value: c.nombre, label: `${c.icono} ${c.nombre}` })) },
        { type: 'row', fields: [
          { name: 'tipo', label: 'Tipo', type: 'select', options: [{ value: 'variable', label: 'Variable' }, { value: 'fijo', label: 'Fijo' }] },
          { name: 'fecha', label: 'Fecha', type: 'date', value: new Date().toISOString().slice(0, 10) },
        ] },
        { name: 'descripcion', label: 'Descripción (opcional)', type: 'text', placeholder: '¿En qué fue?' },
      ],
      onSubmit: (v) => {
        if (!v.monto || v.monto <= 0) return;
        Store.addGasto(v);
        UI.toast({ emoji: '💸', title: 'Gasto registrado', sub: '+5 XP · ¡seguí la racha!' });
      },
    });
  }

  function mountFab() {
    if (document.querySelector('.fab')) return;
    const fab = document.createElement('button');
    fab.className = 'fab'; fab.title = 'Cargar gasto rápido (tecla A)'; fab.textContent = '+';
    fab.onclick = quickAddGasto;
    document.body.appendChild(fab);
    if (!document.getElementById('modalRoot')) {
      const mr = document.createElement('div'); mr.id = 'modalRoot'; document.body.appendChild(mr);
    }
    document.addEventListener('keydown', (e) => {
      const t = e.target.tagName;
      if (e.key.toLowerCase() === 'a' && t !== 'INPUT' && t !== 'SELECT' && t !== 'TEXTAREA' && !document.querySelector('.modal-bg')) {
        e.preventDefault(); quickAddGasto();
      }
    });
  }

  /* ---------- barra superior + drawer (mobile) ---------- */
  function mountMobile() {
    if (document.querySelector('.mobile-top')) return;
    const main = document.querySelector('.main');
    const sb = document.getElementById('sidebar');
    if (!main || !sb) return;

    const top = document.createElement('div');
    top.className = 'mobile-top';
    top.innerHTML = `<button class="ham" aria-label="Abrir menú">☰</button>
      <span class="mt-brand">💸 GASTOS</span>
      <span class="mt-streak" id="mtStreak">🔥 0</span>`;
    main.prepend(top);

    const scrim = document.createElement('div');
    scrim.className = 'scrim';
    document.body.appendChild(scrim);

    const close = () => { sb.classList.remove('open'); scrim.classList.remove('open'); };
    top.querySelector('.ham').onclick = () => { sb.classList.toggle('open'); scrim.classList.toggle('open'); };
    scrim.onclick = close;
    sb.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
  }

  function showAuthError() {
    const main = document.querySelector('.main');
    if (main) main.innerHTML =
      `<div class="card" style="max-width:580px;margin:48px auto">
        <h2 style="font-size:20px">⚠️ Falta activar el acceso anónimo</h2>
        <p style="margin-top:12px;color:var(--text-soft);line-height:1.7">
          En tu panel de Supabase entrá a <b>Authentication → Sign In / Providers</b>,
          activá <b>Anonymous sign-ins</b> y recargá esta página.<br><br>
          También revisá que <b>js/config.js</b> tenga tu URL y anon key correctas.
        </p>
      </div>`;
  }

  async function init(active) {
    const sb = document.getElementById('sidebar');
    if (sb) sb.innerHTML = renderSidebar(active);
    mountMobile();
    mountFab();

    const user = await Auth.ensureSession();
    if (!user) { showAuthError(); return new Promise(() => {}); } // frena: la página no sigue

    await Store.init();
    await Store.syncInicial();
    renderStatus();
    Store.onChange(renderStatus);
  }

  return { init, renderStatus, quickAddGasto };
})();
window.Layout = Layout;
