/* Dashboard / Balance */
(function () {
  let ivgChart = null;

  function statCard({ label, icon, value, sub, tone, pill }) {
    return `<div class="card stat">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div class="label">${icon} ${label}</div>
        <div class="pill" style="background:${pill}">${icon}</div>
      </div>
      <div class="value ${tone || ''}">${value}</div>
      <div class="sub">${sub || ''}</div>
    </div>`;
  }

  function renderSummary() {
    const comp = Analytics.comparativaMensual();
    const cont = document.getElementById('summaryCards');
    if (!comp.msgs.length) { cont.innerHTML = ''; cont.style.display = 'none'; return; }
    cont.style.display = 'grid';
    cont.innerHTML = comp.msgs.slice(0, 3).map((m) =>
      `<div class="summary-card ${m.good ? 'good' : 'bad'}">
        <div class="s-emoji">${m.emoji}</div>
        <div class="s-text"><strong>${m.title}</strong><span>${m.sub}</span></div>
      </div>`
    ).join('');
  }

  function renderStats() {
    const pat = Analytics.patrimonioUSD();
    const cr = Analytics.criptoResumen();
    const bal = pat.balance;
    document.getElementById('statCards').innerHTML =
      statCard({
        label: 'Patrimonio total', icon: '🏦', pill: 'var(--accent-soft)',
        value: Format.usd(pat.total),
        sub: `Efectivo ${Format.usd(pat.efectivoUSD)} + Cripto ${Format.usd(pat.cripto)}`,
      }) +
      statCard({
        label: 'Efectivo', icon: '💵', pill: 'var(--green-soft)',
        value: `${Format.money(bal.USD, 'USD')}`,
        sub: `+ ${Format.money(bal.ARS, 'ARS')} en pesos`,
      }) +
      statCard({
        label: 'Inversiones cripto', icon: '📈', pill: 'var(--amber-soft)',
        value: Format.usd(cr.actual),
        sub: `<span class="${cr.pl >= 0 ? 'pos' : 'neg'}">${cr.pl >= 0 ? '▲' : '▼'} ${Format.usd(Math.abs(cr.pl))} (${Format.pct(cr.plPct)})</span>`,
        tone: '',
      });
  }

  function renderDisciplina() {
    const s = Store.getState();
    const semana = Gamification.semanaActividad(s);
    document.getElementById('weekDots').innerHTML = semana.map((d) =>
      `<div class="d ${d.on ? 'on' : ''} ${d.today ? 'today' : ''}">
        <span>${d.label}</span><span class="chk">${d.on ? '✓' : '·'}</span>
      </div>`
    ).join('');
    const racha = Gamification.rachaActual(s);
    const hoy = s.stats.diasActividad[new Date().toISOString().slice(0, 10)];
    document.getElementById('disciplinaMsg').innerHTML = hoy
      ? `¡Hoy ya registraste! Llevás <strong>${racha}</strong> días seguidos. No cortes la racha 🔥`
      : `Todavía no cargaste nada hoy. <strong>Cargá un gasto</strong> para mantener tu racha de ${racha} días.`;
  }

  function renderScore() {
    const score = Analytics.scoreSalud();
    const color = score >= 75 ? 'var(--green)' : score >= 45 ? 'var(--amber)' : 'var(--red)';
    document.getElementById('scoreGauge').innerHTML =
      `<div class="gauge" style="background:conic-gradient(${color} ${score * 3.6}deg, var(--bg) 0)">
        <div class="inner"><div class="g-num">${score}</div><div class="g-lbl">/ 100</div></div>
      </div>`;
    const msg = score >= 75 ? '¡Excelente! Tus finanzas están muy sanas.'
      : score >= 45 ? 'Vas bien. Subí tu tasa de ahorro para mejorar.'
      : 'Hay margen: intentá gastar menos de lo que ingresás.';
    document.getElementById('scoreMsg').textContent = msg;
  }

  function renderCatBars() {
    const cats = Analytics.gastosPorCategoria(Analytics.thisMonth());
    const cont = document.getElementById('catBars');
    if (!cats.length) { cont.innerHTML = '<p class="empty">Sin gastos este mes todavía.</p>'; return; }
    const max = cats[0].valor;
    cont.innerHTML = cats.map((c) =>
      `<div class="row">
        <div>${c.icono} ${c.nombre}</div>
        <div class="track"><div class="fill" style="width:${(c.valor / max) * 100}%;background:${c.color}"></div></div>
        <div class="num">${Format.usd(c.valor)}</div>
      </div>`
    ).join('');
  }

  function renderIvg() {
    const m = Analytics.thisMonth();
    const ing = Analytics.ingresosUSD(m);
    const gas = Analytics.gastosUSD(m);
    const ctx = document.getElementById('ivgChart');
    if (ivgChart) ivgChart.destroy();
    ivgChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Ingresos', 'Gastos', 'Ahorro'],
        datasets: [{
          data: [ing, gas, ing - gas],
          backgroundColor: ['#16a34a', '#e11d48', '#5b6cff'],
          borderRadius: 8, barThickness: 54,
        }],
      },
      options: {
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => Format.usd(c.raw) } } },
        scales: { y: { ticks: { callback: (v) => '$' + v }, grid: { color: '#eef0f6' } }, x: { grid: { display: false } } },
      },
    });
  }

  function renderRecent() {
    const s = Store.getState();
    const movs = [
      ...s.gastos.map((g) => ({ ...g, kind: 'gasto' })),
      ...s.ingresos.map((i) => ({ ...i, kind: 'ingreso' })),
    ].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 8);
    document.getElementById('recentBody').innerHTML = movs.map((m) => {
      const esGasto = m.kind === 'gasto';
      const det = esGasto ? `${m.categoria}${m.descripcion ? ' · ' + m.descripcion : ''}` : `${m.fuente}${m.descripcion ? ' · ' + m.descripcion : ''}`;
      const tipo = esGasto ? `<span class="badge ${m.tipo}">${m.tipo}</span>` : `<span class="badge usd">ingreso</span>`;
      const signo = esGasto ? '-' : '+';
      return `<tr>
        <td>${Format.date(m.fecha)}</td>
        <td>${det}</td>
        <td>${tipo}</td>
        <td class="num ${esGasto ? 'neg' : 'pos'}">${signo}${Format.money(m.monto, m.moneda)}</td>
      </tr>`;
    }).join('');
  }

  function renderAll() {
    renderSummary(); renderStats(); renderDisciplina(); renderScore();
    renderCatBars(); renderIvg(); renderRecent();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await Layout.init('dashboard');
    renderAll();
    Store.onChange(renderAll);
  });
})();
