/* Página de Metas & Logros */
(function () {
  const ICONOS = ['🎯', '🛟', '✈️', '🏠', '🚗', '💻', '📱', '🎓', '💍', '🏖️', '🎄', '💎'];

  function metaForm(existing) {
    UI.formModal({
      title: existing ? 'Editar meta' : '🎯 Nueva meta de ahorro',
      submitLabel: existing ? 'Guardar' : 'Crear (+10 XP)',
      fields: [
        { name: 'nombre', label: 'Nombre de la meta', type: 'text', required: true, value: existing?.nombre, placeholder: 'Ej: Viaje, Auto, Fondo de emergencia' },
        { name: 'icono', label: 'Ícono', type: 'select', value: existing?.icono || '🎯', options: ICONOS.map((i) => ({ value: i, label: i })) },
        { type: 'row', fields: [
          { name: 'objetivo', label: 'Monto objetivo', type: 'number', step: '0.01', min: 0, required: true, value: existing?.objetivo },
          { name: 'moneda', label: 'Moneda', type: 'select', value: existing?.moneda || 'USD', options: ['USD', 'ARS'] },
        ] },
        { name: 'fechaLimite', label: 'Fecha límite (opcional)', type: 'date', value: existing?.fechaLimite },
      ],
      onSubmit: (v) => {
        if (!v.nombre || !v.objetivo) return;
        if (existing) { Store.updateMeta(existing.id, v); UI.toast({ emoji: '✏️', title: 'Meta actualizada' }); }
        else { Store.addMeta(v); UI.toast({ emoji: '🎯', title: '¡Meta creada!', sub: '+10 XP' }); }
      },
    });
  }

  function aporteForm(meta) {
    UI.formModal({
      title: `Sumar a "${meta.nombre}"`,
      submitLabel: 'Aportar (+15 XP)',
      fields: [{ name: 'monto', label: `¿Cuánto sumás? (${meta.moneda})`, type: 'number', step: '0.01', min: 0, required: true, placeholder: '0.00' }],
      onSubmit: (v) => {
        if (!v.monto) return;
        Store.aporteMeta(meta.id, v.monto);
        UI.toast({ emoji: '🐷', title: `Sumaste ${Format.money(v.monto, meta.moneda)}`, sub: '+15 XP' });
      },
    });
  }

  function renderLevel() {
    const s = Store.getState();
    const nv = Gamification.nivelInfo(s.stats.xp);
    const racha = Gamification.rachaActual(s);
    document.getElementById('levelPanel').innerHTML = `
      <div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap">
        <div class="lvl-emoji" style="width:58px;height:58px;font-size:30px;border-radius:14px">${nv.emoji}</div>
        <div style="flex:1;min-width:220px">
          <div style="font-size:18px;font-weight:800">${nv.nombre} <span style="color:var(--text-soft);font-weight:600;font-size:14px">· Nivel ${nv.nivel}</span></div>
          <div class="xp-bar" style="background:var(--bg);margin-top:10px"><span style="width:${nv.progreso}%"></span></div>
          <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-soft);margin-top:6px">
            <span>${nv.xp} XP</span>
            <span>${nv.siguiente ? `Faltan ${nv.faltan} XP para ${nv.siguiente.nombre}` : '¡Nivel máximo alcanzado!'}</span>
          </div>
        </div>
        <div class="streak-chip" style="background:#fff7ed;border-color:#fed7aa">
          <span class="flame">🔥</span><span class="n" style="color:#ea580c">${racha}</span>
          <span class="t" style="color:#c2682f">días seguidos<br>de disciplina</span>
        </div>
      </div>`;
  }

  function renderMetas() {
    const s = Store.getState();
    const grid = document.getElementById('metasGrid');
    if (!s.metas.length) { grid.innerHTML = '<p class="empty">Creá tu primera meta de ahorro 🎯</p>'; return; }
    grid.innerHTML = s.metas.map((m) => {
      const pct = Math.min(100, (m.actual / m.objetivo) * 100);
      const done = m.actual >= m.objetivo;
      return `<div class="card meta-card ${done ? 'done' : ''}">
        <div class="meta-top">
          <div class="meta-ico">${m.icono}</div>
          <div style="flex:1">
            <div class="meta-name">${m.nombre} ${done ? '✅' : ''}</div>
            <div class="meta-sub">${m.fechaLimite ? '📅 ' + Format.date(m.fechaLimite) : 'Sin fecha límite'}</div>
          </div>
          <div class="row-actions">
            <button class="icon-btn" data-edit="${m.id}">✏️</button>
            <button class="icon-btn del" data-del="${m.id}">🗑️</button>
          </div>
        </div>
        <div class="bar"><span style="width:${pct}%"></span></div>
        <div class="meta-foot">
          <strong>${Format.money(m.actual, m.moneda)} <span style="color:var(--text-soft);font-weight:500">/ ${Format.money(m.objetivo, m.moneda)}</span></strong>
          <span class="${done ? 'pos' : ''}">${pct.toFixed(0)}%</span>
        </div>
        ${done ? '' : `<button class="btn sm ghost" data-aporte="${m.id}" style="margin-top:14px;width:100%;justify-content:center">+ Sumar ahorro</button>`}
      </div>`;
    }).join('');
    grid.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => metaForm(s.metas.find((x) => x.id === b.dataset.edit)));
    grid.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => { if (confirm('¿Borrar esta meta?')) { Store.deleteMeta(b.dataset.del); UI.toast({ emoji: '🗑️', title: 'Meta eliminada' }); } });
    grid.querySelectorAll('[data-aporte]').forEach((b) => b.onclick = () => aporteForm(s.metas.find((x) => x.id === b.dataset.aporte)));
  }

  function renderLogros() {
    const s = Store.getState();
    const logros = Gamification.logrosEstado(s);
    const desbloqueados = logros.filter((l) => l.desbloqueado).length;
    document.getElementById('logrosCount').textContent = `(${desbloqueados}/${logros.length})`;
    document.getElementById('badgeGrid').innerHTML = logros.map((l) => `
      <div class="badge-item ${l.desbloqueado ? '' : 'locked'}">
        <div class="b-emoji">${l.desbloqueado ? l.emoji : '🔒'}</div>
        <div class="b-name">${l.nombre}</div>
        <div class="b-desc">${l.desc}</div>
        ${l.desbloqueado ? `<div class="b-date">✓ ${Format.date(l.fecha)}</div>` : ''}
      </div>`).join('');
  }

  function renderAll() { renderLevel(); renderMetas(); renderLogros(); }

  document.addEventListener('DOMContentLoaded', async () => {
    await Layout.init('metas');
    renderAll();
    document.getElementById('addMeta').onclick = () => metaForm(null);
    Store.onChange(renderAll);
  });
})();
