/* ============================================================
   Analytics: cálculos derivados (todo se computa, nada se duplica).
   Convierte a USD usando el tipo de cambio de config.
   ============================================================ */
const Analytics = (function () {
  function S() { return Store.getState(); }
  function rate() { return S().config.tipoCambioUSD || 1; }

  function toUSD(monto, moneda) {
    if (moneda === 'USD') return monto;
    if (moneda === 'ARS') return monto / rate();
    return monto; // fallback
  }

  function monthKey(iso) { return iso.slice(0, 7); } // 'YYYY-MM'
  function thisMonth() { return new Date().toISOString().slice(0, 7); }
  function prevMonth() {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  }

  /* ---- gastos / ingresos en USD ---- */
  function gastosUSD(month, filtro = {}) {
    return S().gastos
      .filter((g) => (!month || monthKey(g.fecha) === month))
      .filter((g) => (!filtro.tipo || g.tipo === filtro.tipo))
      .filter((g) => (!filtro.categoria || g.categoria === filtro.categoria))
      .reduce((s, g) => s + toUSD(g.monto, g.moneda), 0);
  }
  function ingresosUSD(month) {
    return S().ingresos
      .filter((i) => (!month || monthKey(i.fecha) === month))
      .reduce((s, i) => s + toUSD(i.monto, i.moneda), 0);
  }

  /* ---- balance por moneda (efectivo, sin invertir) ---- */
  function balancePorMoneda() {
    const res = { ARS: 0, USD: 0 };
    S().ingresos.forEach((i) => { res[i.moneda] = (res[i.moneda] || 0) + i.monto; });
    S().gastos.forEach((g) => { res[g.moneda] = (res[g.moneda] || 0) - g.monto; });
    return res;
  }

  /* ---- cripto ---- */
  function criptoResumen() {
    let invertido = 0, actual = 0;
    const holdings = S().inversiones.map((c) => {
      const costo = c.cantidad * c.precioCompra;
      const valor = c.cantidad * c.precioActual;
      invertido += costo; actual += valor;
      return { ...c, costo, valor, pl: valor - costo, plPct: costo ? ((valor - costo) / costo) * 100 : 0 };
    });
    return { holdings, invertido, actual, pl: actual - invertido, plPct: invertido ? ((actual - invertido) / invertido) * 100 : 0 };
  }

  /* ---- patrimonio total unificado en USD ---- */
  function patrimonioUSD() {
    const bal = balancePorMoneda();
    const efectivoUSD = toUSD(bal.ARS, 'ARS') + bal.USD;
    const cripto = criptoResumen().actual;
    return { efectivoUSD, cripto, total: efectivoUSD + cripto, balance: bal };
  }

  /* ---- gastos por categoría (USD) ---- */
  function gastosPorCategoria(month) {
    const map = {};
    S().gastos
      .filter((g) => (!month || monthKey(g.fecha) === month))
      .forEach((g) => { map[g.categoria] = (map[g.categoria] || 0) + toUSD(g.monto, g.moneda); });
    const cats = S().categoriasGasto;
    return Object.entries(map)
      .map(([nombre, valor]) => {
        const c = cats.find((x) => x.nombre === nombre) || { color: '#6b7280', icono: '📦' };
        return { nombre, valor, color: c.color, icono: c.icono };
      })
      .sort((a, b) => b.valor - a.valor);
  }

  /* ---- fijo vs variable (USD) ---- */
  function fijoVsVariable(month) {
    return { fijo: gastosUSD(month, { tipo: 'fijo' }), variable: gastosUSD(month, { tipo: 'variable' }) };
  }

  /* ---- ahorro y tasa de ahorro ---- */
  function ahorroMes(month) { return ingresosUSD(month) - gastosUSD(month); }
  function tasaAhorro(month) {
    const ing = ingresosUSD(month);
    return ing > 0 ? (ahorroMes(month) / ing) * 100 : 0;
  }

  /* ---- comparativa mes actual vs anterior + mensajes motivadores ---- */
  function comparativaMensual() {
    const m = thisMonth(), p = prevMonth();
    const ahorroAct = ahorroMes(m), ahorroPrev = ahorroMes(p);
    const gastoAct = gastosUSD(m), gastoPrev = gastosUSD(p);
    const ingAct = ingresosUSD(m), ingPrev = ingresosUSD(p);
    const msgs = [];

    if (ahorroAct > 0) {
      const dif = ahorroPrev !== 0 ? ((ahorroAct - ahorroPrev) / Math.abs(ahorroPrev)) * 100 : 100;
      msgs.push({
        good: true, emoji: '💪',
        title: `Este mes ahorraste ${Format.usd(ahorroAct)}`,
        sub: ahorroPrev > 0 && dif >= 0 ? `Un ${dif.toFixed(0)}% más que el mes pasado` : '¡Vas en positivo!',
      });
    } else if (ahorroAct < 0) {
      msgs.push({ good: false, emoji: '⚠️', title: `Gastaste más de lo que ingresó`, sub: `Llevás ${Format.usd(ahorroAct)} este mes` });
    }

    if (gastoPrev > 0 && gastoAct < gastoPrev) {
      const menos = gastoPrev - gastoAct;
      msgs.push({ good: true, emoji: '📉', title: `Gastaste ${Format.usd(menos)} menos que el mes pasado`, sub: `Bajaste un ${(menos / gastoPrev * 100).toFixed(0)}% el gasto` });
    } else if (gastoPrev > 0 && gastoAct > gastoPrev) {
      msgs.push({ good: false, emoji: '📈', title: `Gastaste ${Format.usd(gastoAct - gastoPrev)} más que el mes pasado`, sub: 'Ojo con los gastos variables' });
    }

    if (ingAct > ingPrev && ingPrev > 0) {
      msgs.push({ good: true, emoji: '🤑', title: `Generaste ${Format.usd(ingAct - ingPrev)} más de ingresos`, sub: '¡Vas creciendo!' });
    }

    return { mes: m, prev: p, ahorroAct, ahorroPrev, gastoAct, gastoPrev, ingAct, ingPrev, msgs };
  }

  /* ---- "Pace": ¿vas gastando muy rápido este mes? ---- */
  function pace(month) {
    const m = month || thisMonth();
    const gasto = gastosUSD(m);
    const ahora = new Date();
    const diasMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate();
    const diaActual = m === thisMonth() ? ahora.getDate() : diasMes;
    const ingreso = ingresosUSD(m) || gastosUSD(prevMonth()) || 1;
    const ritmoProyectado = (gasto / diaActual) * diasMes;
    return { gasto, ingreso, diaActual, diasMes, proyectado: ritmoProyectado, excede: ritmoProyectado > ingreso };
  }

  /* ---- score de salud financiera 0-100 ---- */
  function scoreSalud() {
    const m = thisMonth();
    let score = 0;
    const tasa = tasaAhorro(m);              // hasta 45 pts
    score += Math.max(0, Math.min(45, tasa * 1.5));
    const ing = ingresosUSD(m);              // gasto fijo bajo respecto al ingreso: 25 pts
    const fijo = fijoVsVariable(m).fijo;
    if (ing > 0) score += Math.max(0, Math.min(25, (1 - fijo / ing) * 25));
    const cr = criptoResumen();              // tener inversiones: 15 pts
    if (cr.actual > 0) score += 15;
    const metasOk = S().metas.filter((x) => x.actual >= x.objetivo).length; // metas: 15 pts
    score += Math.min(15, metasOk * 7);
    return Math.round(Math.max(0, Math.min(100, score)));
  }

  /* ---- serie de ahorro por mes (para reportes) ---- */
  function serieMeses(n = 6) {
    const out = [];
    const base = new Date(); base.setDate(1);
    for (let k = n - 1; k >= 0; k--) {
      const d = new Date(base); d.setMonth(d.getMonth() - k);
      const key = d.toISOString().slice(0, 7);
      out.push({ key, ingresos: ingresosUSD(key), gastos: gastosUSD(key), ahorro: ahorroMes(key) });
    }
    return out;
  }

  return {
    toUSD, monthKey, thisMonth, prevMonth,
    gastosUSD, ingresosUSD, balancePorMoneda, criptoResumen, patrimonioUSD,
    gastosPorCategoria, fijoVsVariable, ahorroMes, tasaAhorro,
    comparativaMensual, pace, scoreSalud, serieMeses,
  };
})();
window.Analytics = Analytics;
