/* Página de Gastos: alta/edición/borrado + filtros */
(function () {
  const filtro = { tipo: 'todos', categoria: 'todos', moneda: 'todos' };

  function gastoForm(existing) {
    const s = Store.getState();
    UI.formModal({
      title: existing ? 'Editar gasto' : '➕ Nuevo gasto',
      submitLabel: existing ? 'Guardar' : 'Agregar (+5 XP)',
      fields: [
        { type: 'row', fields: [
          { name: 'monto', label: 'Monto', type: 'number', step: '0.01', min: 0, required: true, value: existing?.monto, placeholder: '0.00' },
          { name: 'moneda', label: 'Moneda', type: 'select', options: ['ARS', 'USD'], value: existing?.moneda },
        ] },
        { name: 'categoria', label: 'Categoría', type: 'select', value: existing?.categoria,
          options: s.categoriasGasto.map((c) => ({ value: c.nombre, label: `${c.icono} ${c.nombre}` })) },
        { type: 'row', fields: [
          { name: 'tipo', label: 'Tipo', type: 'select', value: existing?.tipo || 'variable',
            options: [{ value: 'variable', label: 'Variable' }, { value: 'fijo', label: 'Fijo' }] },
          { name: 'fecha', label: 'Fecha', type: 'date', value: existing?.fecha || new Date().toISOString().slice(0, 10) },
        ] },
        { name: 'descripcion', label: 'Descripción', type: 'text', value: existing?.descripcion, placeholder: '¿En qué fue?' },
      ],
      onSubmit: (v) => {
        if (!v.monto || v.monto <= 0) return;
        if (existing) { Store.updateGasto(existing.id, v); UI.toast({ emoji: '✏️', title: 'Gasto actualizado' }); }
        else { Store.addGasto(v); UI.toast({ emoji: '💸', title: 'Gasto registrado', sub: '+5 XP · ¡seguí la racha!' }); }
      },
    });
  }

  // Muestra cada moneda en lo suyo: ARS como valor principal, USD como sub (o viceversa).
  function dual(obj) {
    const a = obj.ARS || 0, u = obj.USD || 0;
    if (a && u) return { val: Format.money(a, 'ARS'), sub: '+ ' + Format.money(u, 'USD') };
    if (u && !a) return { val: Format.money(u, 'USD'), sub: '' };
    return { val: Format.money(a, 'ARS'), sub: '' };
  }

  function renderStats() {
    const m = Analytics.thisMonth();
    const fv = Analytics.fijoVariablePorMoneda(m);
    const total = { ARS: (fv.fijo.ARS || 0) + (fv.variable.ARS || 0), USD: (fv.fijo.USD || 0) + (fv.variable.USD || 0) };
    const cont = document.getElementById('gastoStats');
    const card = (icon, label, d) =>
      `<div class="card stat"><div class="label">${icon} ${label}</div><div class="value">${d.val}</div>${d.sub ? `<div class="sub">${d.sub}</div>` : ''}</div>`;
    cont.innerHTML =
      card('🧾', 'Total este mes', dual(total)) +
      card('📌', 'Fijos', dual(fv.fijo)) +
      card('🎲', 'Variables', dual(fv.variable));
  }

  function renderFiltroCat() {
    const s = Store.getState();
    const sel = document.getElementById('filtroCat');
    sel.innerHTML = '<option value="todos">Todas las categorías</option>' +
      s.categoriasGasto.map((c) => `<option value="${c.nombre}">${c.icono} ${c.nombre}</option>`).join('');
  }

  function renderTable() {
    const s = Store.getState();
    const cats = s.categoriasGasto;
    let rows = s.gastos.slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
    if (filtro.tipo !== 'todos') rows = rows.filter((g) => g.tipo === filtro.tipo);
    if (filtro.categoria !== 'todos') rows = rows.filter((g) => g.categoria === filtro.categoria);
    if (filtro.moneda !== 'todos') rows = rows.filter((g) => g.moneda === filtro.moneda);

    const body = document.getElementById('gastoBody');
    if (!rows.length) { body.innerHTML = '<tr><td colspan="6" class="empty">No hay gastos con estos filtros.</td></tr>'; return; }
    body.innerHTML = rows.map((g) => {
      const c = cats.find((x) => x.nombre === g.categoria) || { icono: '📦' };
      return `<tr>
        <td>${Format.date(g.fecha)}</td>
        <td>${c.icono} ${g.categoria} ${g.recurrenteId ? '<span title="Generado por un gasto fijo">🔁</span>' : ''}</td>
        <td style="color:var(--text-soft)">${g.descripcion || '—'}</td>
        <td><span class="badge ${g.tipo}">${g.tipo}</span></td>
        <td class="num neg">-${Format.money(g.monto, g.moneda)}</td>
        <td><div class="row-actions">
          <button class="icon-btn" data-edit="${g.id}">✏️</button>
          <button class="icon-btn del" data-del="${g.id}">🗑️</button>
        </div></td>
      </tr>`;
    }).join('');
    body.querySelectorAll('[data-edit]').forEach((b) =>
      b.onclick = () => gastoForm(s.gastos.find((x) => x.id === b.dataset.edit)));
    body.querySelectorAll('[data-del]').forEach((b) =>
      b.onclick = () => { if (confirm('¿Borrar este gasto?')) { Store.deleteGasto(b.dataset.del); UI.toast({ emoji: '🗑️', title: 'Gasto eliminado' }); } });
  }

  /* ---------- Gastos fijos (recurrentes) ---------- */
  function recForm(existing) {
    const s = Store.getState();
    UI.formModal({
      title: existing ? 'Editar gasto fijo' : '🔁 Nuevo gasto fijo',
      submitLabel: existing ? 'Guardar' : 'Crear fijo',
      fields: [
        { name: 'nombre', label: 'Nombre', type: 'text', required: true, value: existing?.nombre, placeholder: 'Ej: Alquiler, Netflix' },
        { type: 'row', fields: [
          { name: 'monto', label: 'Monto', type: 'number', step: '0.01', min: 0, required: true, value: existing?.monto, placeholder: '0.00' },
          { name: 'moneda', label: 'Moneda', type: 'select', options: ['ARS', 'USD'], value: existing?.moneda },
        ] },
        { type: 'row', fields: [
          { name: 'categoria', label: 'Categoría', type: 'select', value: existing?.categoria,
            options: s.categoriasGasto.map((c) => ({ value: c.nombre, label: `${c.icono} ${c.nombre}` })) },
          { name: 'diaMes', label: 'Día del mes', type: 'number', min: 1, value: existing?.diaMes || 1, placeholder: '1' },
        ] },
      ],
      onSubmit: (v) => {
        if (!v.monto || v.monto <= 0 || !v.nombre) return;
        v.tipoMov = 'gasto'; v.diaMes = Math.min(31, Math.max(1, parseInt(v.diaMes) || 1));
        if (existing) { Store.updateRecurrente(existing.id, v); UI.toast({ emoji: '✏️', title: 'Fijo actualizado', sub: 'Este mes y los próximos usan el nuevo valor' }); }
        else { Store.addRecurrente(v); UI.toast({ emoji: '🔁', title: '¡Gasto fijo creado!', sub: 'Se va a cargar solo cada mes' }); }
      },
    });
  }

  function renderRecurrentes() {
    const s = Store.getState();
    const cats = s.categoriasGasto;
    const recs = (s.recurrentes || []).filter((r) => r.tipoMov === 'gasto');
    const card = document.getElementById('recCard');
    let html = `<div class="rec-head"><h3 style="margin:0">🔁 Gastos fijos <span class="muted">— se cargan solos cada mes</span></h3>
      <button class="btn sm" id="addRec">+ Nuevo fijo</button></div>`;
    if (!recs.length) {
      html += `<p class="empty" style="padding:22px">Cargá tus gastos fijos (alquiler, suscripciones…) una sola vez y aparecen automáticamente cada mes.</p>`;
    } else {
      html += recs.map((r) => {
        const c = cats.find((x) => x.nombre === r.categoria) || { icono: '📦' };
        return `<div class="rec-item ${r.activo ? '' : 'off'}">
          <div class="rec-ico">${c.icono}</div>
          <div class="rec-main">
            <div class="rec-name">${r.nombre}${r.activo ? '' : ' <span class="muted">(pausado)</span>'}</div>
            <div class="rec-sub">${r.categoria || 'Otros'} · día ${r.diaMes}</div>
          </div>
          <div class="rec-amount">${Format.money(r.monto, r.moneda)}<span class="muted" style="font-weight:500">/mes</span></div>
          <div class="rec-actions">
            <button class="icon-btn" data-toggle="${r.id}" title="${r.activo ? 'Pausar' : 'Activar'}">${r.activo ? '⏸️' : '▶️'}</button>
            <button class="icon-btn" data-edit="${r.id}" title="Editar">✏️</button>
            <button class="icon-btn del" data-del="${r.id}" title="Eliminar">🗑️</button>
          </div>
        </div>`;
      }).join('');
    }
    card.innerHTML = html;
    card.querySelector('#addRec').onclick = () => recForm(null);
    card.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => recForm(recs.find((x) => x.id === b.dataset.edit)));
    card.querySelectorAll('[data-toggle]').forEach((b) => b.onclick = () => {
      const r = recs.find((x) => x.id === b.dataset.toggle);
      Store.updateRecurrente(r.id, { activo: !r.activo });
    });
    card.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => {
      if (confirm('¿Eliminar este gasto fijo? Los meses ya cargados quedan en tu historial.')) {
        Store.deleteRecurrente(b.dataset.del); UI.toast({ emoji: '🗑️', title: 'Gasto fijo eliminado' });
      }
    });
  }

  function renderAll() { renderStats(); renderRecurrentes(); renderTable(); }

  document.addEventListener('DOMContentLoaded', async () => {
    await Layout.init('gastos');
    renderFiltroCat();
    renderAll();
    document.getElementById('addBtn').onclick = () => gastoForm(null);
    document.querySelectorAll('#segTipo button').forEach((b) =>
      b.onclick = () => {
        document.querySelectorAll('#segTipo button').forEach((x) => x.classList.remove('active'));
        b.classList.add('active'); filtro.tipo = b.dataset.v; renderTable();
      });
    document.getElementById('filtroCat').onchange = (e) => { filtro.categoria = e.target.value; renderTable(); };
    document.getElementById('filtroMoneda').onchange = (e) => { filtro.moneda = e.target.value; renderTable(); };
    Store.onChange(renderAll);
  });
})();
