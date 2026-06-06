/* Página de Reportes */
(function () {
  let trendChart = null, catPie = null;
  const PALETTE = ['#5b6cff', '#16a34a', '#f59e0b', '#e11d48', '#8b5cf6', '#0ea5e9', '#14b8a6', '#ec4899', '#6b7280'];

  function renderComp() {
    const c = Analytics.comparativaMensual();
    const cont = document.getElementById('compCards');
    const msgs = c.msgs.length ? c.msgs : [{ good: true, emoji: '📊', title: 'Seguí registrando', sub: 'Con más datos vas a ver tu evolución' }];
    cont.innerHTML = msgs.slice(0, 3).map((m) =>
      `<div class="summary-card ${m.good ? 'good' : 'bad'}"><div class="s-emoji">${m.emoji}</div><div class="s-text"><strong>${m.title}</strong><span>${m.sub}</span></div></div>`
    ).join('');

    const delta = (act, prev, invert) => {
      const d = act - prev;
      const good = invert ? d < 0 : d > 0;
      const cls = d === 0 ? '' : good ? 'pos' : 'neg';
      const arrow = d === 0 ? '' : d > 0 ? '▲' : '▼';
      return `<td class="num ${cls}">${arrow} ${Format.usd(Math.abs(d))}</td>`;
    };
    document.getElementById('compBody').innerHTML = `
      <tr><td>💰 Ingresos</td><td class="num">${Format.usd(c.ingPrev)}</td><td class="num">${Format.usd(c.ingAct)}</td>${delta(c.ingAct, c.ingPrev, false)}</tr>
      <tr><td>💸 Gastos</td><td class="num">${Format.usd(c.gastoPrev)}</td><td class="num">${Format.usd(c.gastoAct)}</td>${delta(c.gastoAct, c.gastoPrev, true)}</tr>
      <tr><td>🐷 Ahorro</td><td class="num">${Format.usd(c.ahorroPrev)}</td><td class="num">${Format.usd(c.ahorroAct)}</td>${delta(c.ahorroAct, c.ahorroPrev, false)}</tr>`;
  }

  function renderTrend() {
    const serie = Analytics.serieMeses(6);
    const ctx = document.getElementById('trendChart');
    if (trendChart) trendChart.destroy();
    trendChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: serie.map((s) => Format.monthName(s.key).split(' ')[0]),
        datasets: [
          { label: 'Ingresos', data: serie.map((s) => s.ingresos), backgroundColor: '#16a34a', borderRadius: 6 },
          { label: 'Gastos', data: serie.map((s) => s.gastos), backgroundColor: '#e11d48', borderRadius: 6 },
          { label: 'Ahorro', type: 'line', data: serie.map((s) => s.ahorro), borderColor: '#5b6cff', backgroundColor: '#5b6cff', tension: .35, fill: false, pointRadius: 4 },
        ],
      },
      options: {
        plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (x) => `${x.dataset.label}: ${Format.usd(x.raw)}` } } },
        scales: { y: { ticks: { callback: (v) => '$' + v }, grid: { color: '#eef0f6' } }, x: { grid: { display: false } } },
      },
    });
  }

  function renderPie() {
    const cats = Analytics.gastosPorCategoria(Analytics.thisMonth());
    const ctx = document.getElementById('catPie');
    if (catPie) catPie.destroy();
    if (!cats.length) return;
    catPie = new Chart(ctx, {
      type: 'pie',
      data: { labels: cats.map((c) => c.nombre), datasets: [{ data: cats.map((c) => c.valor), backgroundColor: cats.map((c, i) => c.color || PALETTE[i % PALETTE.length]), borderWidth: 0 }] },
      options: { plugins: { legend: { position: 'right' }, tooltip: { callbacks: { label: (x) => `${x.label}: ${Format.usd(x.raw)}` } } } },
    });
  }

  function renderAll() { renderComp(); renderTrend(); renderPie(); }

  document.addEventListener('DOMContentLoaded', async () => {
    await Layout.init('reportes');
    const tc = document.getElementById('tcInput');
    tc.value = Store.getState().config.tipoCambioUSD;
    tc.onchange = () => { Store.setTipoCambio(tc.value); };
    document.getElementById('resetBtn').onclick = async () => {
      if (confirm('Esto borra TODOS tus datos en Supabase. Esta acción no se puede deshacer. ¿Seguir?')) {
        await Store.reset(); location.reload();
      }
    };
    renderAll();
    Store.onChange(renderAll);
  });
})();
