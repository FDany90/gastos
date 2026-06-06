/* Página de Ingresos */
(function () {
  function ingresoForm(existing) {
    const s = Store.getState();
    UI.formModal({
      title: existing ? 'Editar ingreso' : '💰 Registrar ingreso',
      submitLabel: existing ? 'Guardar' : 'Agregar (+20 XP)',
      fields: [
        { type: 'row', fields: [
          { name: 'monto', label: 'Monto', type: 'number', step: '0.01', min: 0, required: true, value: existing?.monto, placeholder: '0.00' },
          { name: 'moneda', label: 'Moneda', type: 'select', options: ['ARS', 'USD'], value: existing?.moneda || 'USD' },
        ] },
        { name: 'fuente', label: 'Fuente', type: 'select', value: existing?.fuente, options: s.fuentesIngreso },
        { type: 'row', fields: [
          { name: 'recurrente', label: '¿Recurrente?', type: 'select', value: existing ? String(existing.recurrente) : 'true',
            options: [{ value: 'true', label: 'Sí (todos los meses)' }, { value: 'false', label: 'No' }] },
          { name: 'fecha', label: 'Fecha', type: 'date', value: existing?.fecha || new Date().toISOString().slice(0, 10) },
        ] },
        { name: 'descripcion', label: 'Descripción', type: 'text', value: existing?.descripcion, placeholder: 'Ej: Sueldo de junio' },
      ],
      onSubmit: (v) => {
        if (!v.monto || v.monto <= 0) return;
        v.recurrente = v.recurrente === 'true';
        if (existing) { Store.updateIngreso(existing.id, v); UI.toast({ emoji: '✏️', title: 'Ingreso actualizado' }); }
        else { Store.addIngreso(v); UI.toast({ emoji: '🤑', title: '¡Ingreso registrado!', sub: '+20 XP' }); }
      },
    });
  }

  function dual(obj) {
    const a = obj.ARS || 0, u = obj.USD || 0;
    if (a && u) return { val: Format.money(a, 'ARS'), sub: '+ ' + Format.money(u, 'USD') };
    if (u && !a) return { val: Format.money(u, 'USD'), sub: '' };
    return { val: Format.money(a, 'ARS'), sub: '' };
  }

  function renderStats() {
    const m = Analytics.thisMonth();
    const ing = Analytics.ingresosPorMoneda(m);
    const gas = Analytics.gastosPorMoneda(m);
    const ah = Analytics.ahorroPorMoneda(m);
    const card = (icon, label, d, tone) =>
      `<div class="card stat"><div class="label">${icon} ${label}</div><div class="value ${tone || ''}">${d.val}</div>${d.sub ? `<div class="sub">${d.sub}</div>` : ''}</div>`;
    const ahTone = (ah.ARS < 0 || ah.USD < 0) ? 'neg' : 'pos';
    document.getElementById('ingStats').innerHTML =
      card('💰', 'Ingresos este mes', dual(ing)) +
      card('💸', 'Gastos este mes', dual(gas)) +
      card('🐷', 'Ahorro del mes', dual(ah), ahTone);
  }

  function renderTable() {
    const s = Store.getState();
    const rows = s.ingresos.slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
    const body = document.getElementById('ingBody');
    if (!rows.length) { body.innerHTML = '<tr><td colspan="6" class="empty">Todavía no registraste ingresos.</td></tr>'; return; }
    body.innerHTML = rows.map((i) => `<tr>
      <td>${Format.date(i.fecha)}</td>
      <td>${i.fuente} ${i.recurrenteId ? '<span title="Generado por un ingreso fijo">🔁</span>' : ''}</td>
      <td style="color:var(--text-soft)">${i.descripcion || '—'}</td>
      <td>${i.recurrente ? '<span class="badge fijo">🔁 mensual</span>' : '—'}</td>
      <td class="num pos">+${Format.money(i.monto, i.moneda)}</td>
      <td><div class="row-actions">
        <button class="icon-btn" data-edit="${i.id}">✏️</button>
        <button class="icon-btn del" data-del="${i.id}">🗑️</button>
      </div></td>
    </tr>`).join('');
    body.querySelectorAll('[data-edit]').forEach((b) =>
      b.onclick = () => ingresoForm(s.ingresos.find((x) => x.id === b.dataset.edit)));
    body.querySelectorAll('[data-del]').forEach((b) =>
      b.onclick = () => { if (confirm('¿Borrar este ingreso?')) { Store.deleteIngreso(b.dataset.del); UI.toast({ emoji: '🗑️', title: 'Ingreso eliminado' }); } });
  }

  /* ---------- Ingresos fijos (recurrentes: sueldo, etc.) ---------- */
  function recForm(existing) {
    const s = Store.getState();
    UI.formModal({
      title: existing ? 'Editar ingreso fijo' : '🔁 Nuevo ingreso fijo',
      submitLabel: existing ? 'Guardar' : 'Crear fijo',
      fields: [
        { name: 'nombre', label: 'Nombre', type: 'text', required: true, value: existing?.nombre, placeholder: 'Ej: Sueldo' },
        { type: 'row', fields: [
          { name: 'monto', label: 'Monto', type: 'number', step: '0.01', min: 0, required: true, value: existing?.monto, placeholder: '0.00' },
          { name: 'moneda', label: 'Moneda', type: 'select', options: ['ARS', 'USD'], value: existing?.moneda || 'USD' },
        ] },
        { type: 'row', fields: [
          { name: 'fuente', label: 'Fuente', type: 'select', value: existing?.fuente || 'Sueldo', options: s.fuentesIngreso },
          { name: 'diaMes', label: 'Día de cobro', type: 'number', min: 1, value: existing?.diaMes || 1, placeholder: '1' },
        ] },
      ],
      onSubmit: (v) => {
        if (!v.monto || v.monto <= 0 || !v.nombre) return;
        v.tipoMov = 'ingreso'; v.diaMes = Math.min(31, Math.max(1, parseInt(v.diaMes) || 1));
        if (existing) { Store.updateRecurrente(existing.id, v); UI.toast({ emoji: '✏️', title: 'Ingreso fijo actualizado' }); }
        else { Store.addRecurrente(v); UI.toast({ emoji: '🔁', title: '¡Ingreso fijo creado!', sub: 'Se carga solo cada mes' }); }
      },
    });
  }

  function renderRecurrentes() {
    const s = Store.getState();
    const recs = (s.recurrentes || []).filter((r) => r.tipoMov === 'ingreso');
    const card = document.getElementById('recCard');
    let html = `<div class="rec-head"><h3 style="margin:0">🔁 Ingresos fijos <span class="muted">— sueldo y demás, cada mes solos</span></h3>
      <button class="btn sm" id="addRec">+ Nuevo fijo</button></div>`;
    if (!recs.length) {
      html += `<p class="empty" style="padding:22px">Cargá tu sueldo una vez y se registra automáticamente todos los meses.</p>`;
    } else {
      html += recs.map((r) => `<div class="rec-item ${r.activo ? '' : 'off'}">
        <div class="rec-ico">💵</div>
        <div class="rec-main">
          <div class="rec-name">${r.nombre}${r.activo ? '' : ' <span class="muted">(pausado)</span>'}</div>
          <div class="rec-sub">${r.fuente || 'Sueldo'} · día ${r.diaMes}</div>
        </div>
        <div class="rec-amount pos">+${Format.money(r.monto, r.moneda)}<span class="muted" style="font-weight:500">/mes</span></div>
        <div class="rec-actions">
          <button class="icon-btn" data-toggle="${r.id}" title="${r.activo ? 'Pausar' : 'Activar'}">${r.activo ? '⏸️' : '▶️'}</button>
          <button class="icon-btn" data-edit="${r.id}" title="Editar">✏️</button>
          <button class="icon-btn del" data-del="${r.id}" title="Eliminar">🗑️</button>
        </div>
      </div>`).join('');
    }
    card.innerHTML = html;
    card.querySelector('#addRec').onclick = () => recForm(null);
    card.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => recForm(recs.find((x) => x.id === b.dataset.edit)));
    card.querySelectorAll('[data-toggle]').forEach((b) => b.onclick = () => {
      const r = recs.find((x) => x.id === b.dataset.toggle);
      Store.updateRecurrente(r.id, { activo: !r.activo });
    });
    card.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => {
      if (confirm('¿Eliminar este ingreso fijo? Los meses ya cargados quedan en tu historial.')) {
        Store.deleteRecurrente(b.dataset.del); UI.toast({ emoji: '🗑️', title: 'Ingreso fijo eliminado' });
      }
    });
  }

  function renderAll() { renderStats(); renderRecurrentes(); renderTable(); }

  document.addEventListener('DOMContentLoaded', async () => {
    await Layout.init('ingresos');
    renderAll();
    document.getElementById('addBtn').onclick = () => ingresoForm(null);
    Store.onChange(renderAll);
  });
})();
