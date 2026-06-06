/* ============================================================
   Gamification: niveles + XP, rachas y logros.
   Foco: premiar la DISCIPLINA de registrar y de ahorrar.
   ============================================================ */
const Gamification = (function () {
  /* ---------- niveles ---------- */
  const NIVELES = [
    { nivel: 1, nombre: 'Novato del Ahorro', emoji: '🌱', xpMin: 0 },
    { nivel: 2, nombre: 'Aprendiz', emoji: '📒', xpMin: 150 },
    { nivel: 3, nombre: 'Ahorrista', emoji: '🐷', xpMin: 400 },
    { nivel: 4, nombre: 'Organizado', emoji: '🗂️', xpMin: 750 },
    { nivel: 5, nombre: 'Disciplinado', emoji: '🎯', xpMin: 1200 },
    { nivel: 6, nombre: 'Inversor', emoji: '📈', xpMin: 1800 },
    { nivel: 7, nombre: 'Estratega', emoji: '♟️', xpMin: 2600 },
    { nivel: 8, nombre: 'Maestro de las Finanzas', emoji: '👑', xpMin: 3800 },
  ];

  function nivelInfo(xp) {
    let actual = NIVELES[0];
    for (const n of NIVELES) if (xp >= n.xpMin) actual = n;
    const siguiente = NIVELES.find((n) => n.xpMin > xp) || null;
    const base = actual.xpMin;
    const techo = siguiente ? siguiente.xpMin : actual.xpMin;
    const prog = siguiente ? Math.round(((xp - base) / (techo - base)) * 100) : 100;
    return {
      ...actual, xp,
      siguiente,
      faltan: siguiente ? siguiente.xpMin - xp : 0,
      progreso: Math.max(0, Math.min(100, prog)),
    };
  }

  /* ---------- racha (días consecutivos con actividad) ---------- */
  function rachaActual(state) {
    const dias = state.stats.diasActividad || {};
    let racha = 0;
    const d = new Date();
    // si hoy no hay actividad pero ayer sí, la racha sigue "viva" desde ayer
    if (!dias[d.toISOString().slice(0, 10)]) d.setDate(d.getDate() - 1);
    while (dias[d.toISOString().slice(0, 10)]) { racha++; d.setDate(d.getDate() - 1); }
    return racha;
  }

  function semanaActividad(state) {
    const dias = state.stats.diasActividad || {};
    const out = [];
    const hoy = new Date();
    const nombres = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    for (let k = 6; k >= 0; k--) {
      const d = new Date(hoy); d.setDate(hoy.getDate() - k);
      const key = d.toISOString().slice(0, 10);
      out.push({ label: nombres[d.getDay()], on: !!dias[key], today: k === 0 });
    }
    return out;
  }

  /* ---------- definición de logros ---------- */
  const LOGROS = [
    { id: 'primer_gasto', emoji: '✍️', nombre: 'Primer Registro', desc: 'Cargaste tu primer gasto', test: (s) => s.gastos.length >= 1 },
    { id: 'racha_3', emoji: '🔥', nombre: 'En Marcha', desc: '3 días seguidos registrando', test: (s) => rachaActual(s) >= 3 },
    { id: 'racha_7', emoji: '🔥', nombre: 'Semana de Fuego', desc: '7 días seguidos registrando', test: (s) => rachaActual(s) >= 7 || s.stats.rachaMax >= 7 },
    { id: 'racha_30', emoji: '🏅', nombre: 'Imparable', desc: '30 días seguidos de disciplina', test: (s) => rachaActual(s) >= 30 || s.stats.rachaMax >= 30 },
    { id: 'cargas_50', emoji: '📝', nombre: 'Constante', desc: '50 movimientos registrados', test: (s) => (s.gastos.length + s.ingresos.length) >= 50 },
    { id: 'cargas_100', emoji: '🧾', nombre: 'Contador Pro', desc: '100 movimientos registrados', test: (s) => (s.gastos.length + s.ingresos.length) >= 100 },
    { id: 'primer_sueldo', emoji: '💵', nombre: 'A Cobrar', desc: 'Registraste tu primer ingreso', test: (s) => s.ingresos.length >= 1 },
    { id: 'mes_positivo', emoji: '✅', nombre: 'Mes en Verde', desc: 'Cerraste el mes ahorrando', test: () => Analytics.ahorroMes(Analytics.thisMonth()) > 0 },
    { id: 'mes_austero', emoji: '📉', nombre: 'Mes Austero', desc: 'Gastaste menos que el mes pasado', test: () => { const c = Analytics.comparativaMensual(); return c.gastoPrev > 0 && c.gastoAct < c.gastoPrev; } },
    { id: 'mas_rico', emoji: '🤑', nombre: 'Más Rico', desc: 'Tu ahorro superó al del mes pasado', test: () => { const c = Analytics.comparativaMensual(); return c.ahorroAct > c.ahorroPrev && c.ahorroAct > 0; } },
    { id: 'ahorrador', emoji: '🐷', nombre: 'Buen Ahorrista', desc: 'Tasa de ahorro mayor al 20%', test: () => Analytics.tasaAhorro(Analytics.thisMonth()) >= 20 },
    { id: 'primer_cripto', emoji: '🚀', nombre: 'Inversor Cripto', desc: 'Cargaste tu primera inversión', test: (s) => s.inversiones.length >= 1 },
    { id: 'verde_cripto', emoji: '💎', nombre: 'Manos de Diamante', desc: 'Tu cartera cripto está en ganancia', test: () => Analytics.criptoResumen().pl > 0 },
    { id: 'primera_meta', emoji: '🎯', nombre: 'Meta Cumplida', desc: 'Completaste una meta de ahorro', test: (s) => s.metas.some((m) => m.actual >= m.objetivo) },
    { id: 'tres_metas', emoji: '🏆', nombre: 'Triple Corona', desc: 'Cumpliste 3 metas de ahorro', test: (s) => s.metas.filter((m) => m.actual >= m.objetivo).length >= 3 },
    { id: 'salud_80', emoji: '❤️', nombre: 'Finanzas Sanas', desc: 'Score de salud financiera 80+', test: () => Analytics.scoreSalud() >= 80 },
  ];

  /* ---------- evaluación (corre en cada persist) ---------- */
  function evaluate(state) {
    // mantener rachaMax al día
    const r = rachaActual(state);
    if (r > (state.stats.rachaMax || 0)) state.stats.rachaMax = r;

    // XP por completar metas (una sola vez por meta)
    state.metas.forEach((m) => {
      if (m.actual >= m.objetivo && !state.stats.metasCumplidas[m.id]) {
        state.stats.metasCumplidas[m.id] = true;
        state.stats.xp = (state.stats.xp || 0) + 250;
      }
    });

    const nuevos = [];
    LOGROS.forEach((l) => {
      const ya = state.stats.logros[l.id];
      let ok = false;
      try { ok = l.test(state); } catch (e) { ok = false; }
      if (ok && !ya) {
        state.stats.logros[l.id] = new Date().toISOString().slice(0, 10);
        state.stats.xp = (state.stats.xp || 0) + 50; // bonus por logro
        nuevos.push(l);
      }
    });
    return nuevos;
  }

  function logrosEstado(state) {
    return LOGROS.map((l) => ({ ...l, desbloqueado: !!state.stats.logros[l.id], fecha: state.stats.logros[l.id] || null }));
  }

  return { NIVELES, LOGROS, nivelInfo, rachaActual, semanaActividad, evaluate, logrosEstado };
})();
window.Gamification = Gamification;
