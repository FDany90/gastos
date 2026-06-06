/* Página de Inversiones (cripto) */
(function () {
  let allocChart = null;
  const PALETTE = ['#f7931a', '#627eea', '#26a17b', '#5b6cff', '#16a34a', '#e11d48', '#8b5cf6'];

  function invForm(existing) {
    UI.formModal({
      title: existing ? 'Editar inversión' : '🚀 Nueva inversión cripto',
      submitLabel: existing ? 'Guardar' : 'Agregar (+15 XP)',
      fields: [
        { type: 'row', fields: [
          { name: 'simbolo', label: 'Símbolo', type: 'text', required: true, value: existing?.simbolo, placeholder: 'BTC' },
          { name: 'nombre', label: 'Nombre', type: 'text', value: existing?.nombre, placeholder: 'Bitcoin' },
        ] },
        { name: 'cantidad', label: 'Cantidad', type: 'number', step: '0.00000001', min: 0, required: true, value: existing?.cantidad, placeholder: '0.0' },
        { type: 'row', fields: [
          { name: 'precioCompra', label: 'Precio de compra (USD)', type: 'number', step: '0.01', min: 0, required: true, value: existing?.precioCompra },
          { name: 'precioActual', label: 'Precio actual (USD)', type: 'number', step: '0.01', min: 0, required: true, value: existing?.precioActual },
        ] },
        { name: 'fecha', label: 'Fecha de compra', type: 'date', value: existing?.fecha || new Date().toISOString().slice(0, 10) },
      ],
      onSubmit: (v) => {
        v.simbolo = (v.simbolo || '').toUpperCase();
        if (!v.simbolo || !v.cantidad) return;
        if (existing) { Store.updateInversion(existing.id, v); UI.toast({ emoji: '✏️', title: 'Inversión actualizada' }); }
        else { Store.addInversion(v); UI.toast({ emoji: '🚀', title: '¡Inversión registrada!', sub: '+15 XP' }); }
      },
    });
  }

  function renderStats() {
    const cr = Analytics.criptoResumen();
    const card = (icon, label, val, tone, sub) =>
      `<div class="card stat"><div class="label">${icon} ${label}</div><div class="value ${tone || ''}">${val}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
    document.getElementById('invStats').innerHTML =
      card('💰', 'Valor de la cartera', Format.usd(cr.actual)) +
      card('🏷️', 'Total invertido', Format.usd(cr.invertido)) +
      card('📈', 'Ganancia/Pérdida', `${cr.pl >= 0 ? '+' : ''}${Format.usd(cr.pl)}`, cr.pl >= 0 ? 'pos' : 'neg', `<span class="${cr.pl >= 0 ? 'pos' : 'neg'}">${Format.pct(cr.plPct)}</span>`);
  }

  function renderAlloc() {
    const cr = Analytics.criptoResumen();
    const ctx = document.getElementById('allocChart');
    if (allocChart) allocChart.destroy();
    if (!cr.holdings.length) { return; }
    allocChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: cr.holdings.map((h) => h.simbolo),
        datasets: [{ data: cr.holdings.map((h) => h.valor), backgroundColor: PALETTE, borderWidth: 0 }],
      },
      options: {
        cutout: '62%',
        plugins: { legend: { position: 'right' }, tooltip: { callbacks: { label: (c) => `${c.label}: ${Format.usd(c.raw)}` } } },
      },
    });
  }

  function renderTable() {
    const cr = Analytics.criptoResumen();
    const body = document.getElementById('invBody');
    if (!cr.holdings.length) { body.innerHTML = '<tr><td colspan="8" class="empty">Agregá tu primera inversión cripto.</td></tr>'; return; }
    body.innerHTML = cr.holdings.map((h, idx) => `<tr>
      <td><div class="coin"><span class="sym" style="background:${PALETTE[idx % PALETTE.length]}22;color:${PALETTE[idx % PALETTE.length]}">${h.simbolo.slice(0, 3)}</span>
        <div><strong>${h.simbolo}</strong><div style="font-size:12px;color:var(--text-soft)">${h.nombre || ''}</div></div></div></td>
      <td class="num">${Format.crypto(h.cantidad)}</td>
      <td class="num">${Format.usd(h.precioCompra)}</td>
      <td class="num">${Format.usd(h.precioActual)}</td>
      <td class="num">${Format.usd(h.costo)}</td>
      <td class="num">${Format.usd(h.valor)}</td>
      <td class="num ${h.pl >= 0 ? 'pos' : 'neg'}">${h.pl >= 0 ? '▲' : '▼'} ${Format.usd(Math.abs(h.pl))}<br><span style="font-size:12px">${Format.pct(h.plPct)}</span></td>
      <td><div class="row-actions">
        <button class="icon-btn" data-edit="${h.id}">✏️</button>
        <button class="icon-btn del" data-del="${h.id}">🗑️</button>
      </div></td>
    </tr>`).join('');
    const s = Store.getState();
    body.querySelectorAll('[data-edit]').forEach((b) =>
      b.onclick = () => invForm(s.inversiones.find((x) => x.id === b.dataset.edit)));
    body.querySelectorAll('[data-del]').forEach((b) =>
      b.onclick = () => { if (confirm('¿Borrar esta inversión?')) { Store.deleteInversion(b.dataset.del); UI.toast({ emoji: '🗑️', title: 'Inversión eliminada' }); } });
  }

  function renderAll() { renderStats(); renderAlloc(); renderTable(); }

  document.addEventListener('DOMContentLoaded', async () => {
    await Layout.init('inversiones');
    renderAll();
    document.getElementById('addBtn').onclick = () => invForm(null);
    Store.onChange(renderAll);
  });
})();
