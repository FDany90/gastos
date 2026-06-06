/* ============================================================
   Store (Fase 2 · Supabase)
   - init(): trae todo a una caché en memoria (state).
   - getState(): sigue siendo SINCRÓNICO -> las páginas no cambian.
   - Las mutaciones escriben en Supabase y actualizan la caché
     (write-through). Los stats de gamificación van a stats_usuario.
   ============================================================ */
const Store = (function () {
  /* categorías/fuentes: constantes del cliente (no hay tabla para esto) */
  const CATEGORIAS_GASTO = [
    { nombre: 'Alquiler', icono: '🏠', color: '#5b6cff' },
    { nombre: 'Supermercado', icono: '🛒', color: '#16a34a' },
    { nombre: 'Transporte', icono: '🚗', color: '#0ea5e9' },
    { nombre: 'Comida/Delivery', icono: '🍔', color: '#f59e0b' },
    { nombre: 'Servicios', icono: '💡', color: '#8b5cf6' },
    { nombre: 'Salud', icono: '⚕️', color: '#ec4899' },
    { nombre: 'Ocio', icono: '🎮', color: '#ef4444' },
    { nombre: 'Suscripciones', icono: '📺', color: '#14b8a6' },
    { nombre: 'Otros', icono: '📦', color: '#6b7280' },
  ];
  const FUENTES_INGRESO = ['Sueldo', 'Freelance', 'Venta', 'Regalo', 'Reembolso', 'Otros'];

  let state = null;
  let userId = null;
  let statsRowId = null; // dueño de la fila de stats compartida
  const listeners = [];

  function emit() { listeners.forEach((f) => f(state)); }
  function onChange(fn) { listeners.push(fn); }
  function getState() { return state; }
  function todayISO() { return new Date().toISOString().slice(0, 10); }

  /* ---------- mapeo BD (snake_case) <-> app (camelCase) ---------- */
  const rowToGasto = (r) => ({ id: r.id, monto: Number(r.monto), moneda: r.moneda, tipo: r.tipo, categoria: r.categoria, descripcion: r.descripcion, fecha: r.fecha, recurrenteId: r.recurrente_id || null });
  const gastoToRow = (d) => ({ monto: d.monto, moneda: d.moneda, tipo: d.tipo, categoria: d.categoria, descripcion: d.descripcion || null, fecha: d.fecha });
  const rowToIngreso = (r) => ({ id: r.id, monto: Number(r.monto), moneda: r.moneda, fuente: r.fuente, recurrente: r.recurrente, descripcion: r.descripcion, fecha: r.fecha, recurrenteId: r.recurrente_id || null });
  const ingresoToRow = (d) => ({ monto: d.monto, moneda: d.moneda, fuente: d.fuente, recurrente: !!d.recurrente, descripcion: d.descripcion || null, fecha: d.fecha });
  const rowToRec = (r) => ({ id: r.id, tipoMov: r.tipo_mov, nombre: r.nombre, monto: Number(r.monto), moneda: r.moneda, categoria: r.categoria, fuente: r.fuente, tipo: r.tipo, diaMes: r.dia_mes, desde: r.desde, activo: r.activo });
  const recToRow = (d) => ({ tipo_mov: d.tipoMov || 'gasto', nombre: d.nombre, monto: d.monto, moneda: d.moneda, categoria: d.categoria || null, fuente: d.fuente || null, tipo: 'fijo', dia_mes: d.diaMes || 1, desde: d.desde, activo: d.activo !== false });
  const rowToInv = (r) => ({ id: r.id, simbolo: r.simbolo, nombre: r.nombre, cantidad: Number(r.cantidad), precioCompra: Number(r.precio_compra), precioActual: Number(r.precio_actual), fecha: r.fecha });
  const invToRow = (d) => ({ simbolo: d.simbolo, nombre: d.nombre || null, cantidad: d.cantidad, precio_compra: d.precioCompra, precio_actual: d.precioActual, fecha: d.fecha });
  const rowToMeta = (r) => ({ id: r.id, nombre: r.nombre, icono: r.icono, objetivo: Number(r.objetivo), actual: Number(r.actual), moneda: r.moneda, fechaLimite: r.fecha_limite });
  const metaToRow = (d) => ({ nombre: d.nombre, icono: d.icono || '🎯', objetivo: d.objetivo, actual: d.actual || 0, moneda: d.moneda, fecha_limite: d.fechaLimite || null });

  /* ---------- caché local (stale-while-revalidate) ----------
     Guarda lo último traído para dibujar al instante en la próxima
     página, mientras se refresca contra Supabase en segundo plano. */
  function cacheKey() { return 'gastosCache_' + (userId || 'anon'); }
  function saveCache() {
    if (!state) return;
    try {
      localStorage.setItem(cacheKey(), JSON.stringify({
        config: state.config, gastos: state.gastos, ingresos: state.ingresos,
        inversiones: state.inversiones, metas: state.metas, recurrentes: state.recurrentes, stats: state.stats,
      }));
    } catch (e) { /* almacenamiento lleno: ignorar */ }
  }
  function loadCache() {
    try {
      const raw = localStorage.getItem(cacheKey());
      if (!raw) return null;
      const c = JSON.parse(raw);
      return {
        config: c.config || { tipoCambioUSD: 1150, monedaPrincipal: 'USD' },
        categoriasGasto: CATEGORIAS_GASTO, fuentesIngreso: FUENTES_INGRESO,
        gastos: c.gastos || [], ingresos: c.ingresos || [], inversiones: c.inversiones || [],
        metas: c.metas || [], recurrentes: c.recurrentes || [],
        stats: c.stats || { xp: 0, rachaMax: 0, diasActividad: {}, logros: {}, metasCumplidas: {} },
      };
    } catch (e) { return null; }
  }

  /* ---------- bootstrap ---------- */
  async function init() {
    if (state) return state;
    // userId desde la sesión local (sin pegarle a la red); fallback a getUser
    userId = (window.Auth && Auth.user() && Auth.user().id) || (((await SB.auth.getUser()).data.user) || {}).id;
    if (!userId) throw new Error('Sin sesión');

    const cached = loadCache();
    if (cached) {
      state = cached;                 // render INSTANTÁNEO con lo cacheado
      fetchAll().then(() => { saveCache(); emit(); }).catch((e) => console.warn('refresh BD:', e.message));
      return state;                   // (la BD se sincroniza por detrás)
    }
    await fetchAll();                  // primera vez: sí esperamos
    saveCache();
    return state;
  }

  // Trae todo de Supabase, arma el state y genera recurrentes faltantes.
  async function fetchAll() {
    const [g, i, inv, m, st] = await Promise.all([
      SB.from('gastos').select('*').order('fecha', { ascending: false }),
      SB.from('ingresos').select('*').order('fecha', { ascending: false }),
      SB.from('inversiones').select('*').order('fecha', { ascending: false }),
      SB.from('metas').select('*').order('created_at', { ascending: true }),
      // stats COMPARTIDOS: tomamos la fila con más XP (la "principal"), no la de este dispositivo
      SB.from('stats_usuario').select('*').order('xp', { ascending: false }).limit(1).maybeSingle(),
    ]);

    let stats = st.data;
    if (!stats) {
      const def = { user_id: userId, xp: 0, racha_max: 0, dias_actividad: {}, logros: {}, metas_cumplidas: {}, tipo_cambio_usd: 1150 };
      const ins = await SB.from('stats_usuario').insert(def).select().single();
      stats = ins.data || def;
    }
    statsRowId = stats.user_id || userId; // todas las pantallas escriben en esta misma fila

    let recData = [];
    try {
      const rc = await SB.from('recurrentes').select('*').order('created_at', { ascending: true });
      if (!rc.error) recData = rc.data || [];
      else console.warn('recurrentes:', rc.error.message, '(¿corriste schema_recurrentes.sql?)');
    } catch (e) { console.warn('recurrentes no disponible:', e.message); }

    state = {
      config: { tipoCambioUSD: Number(stats.tipo_cambio_usd) || 1150, monedaPrincipal: 'USD' },
      categoriasGasto: CATEGORIAS_GASTO,
      fuentesIngreso: FUENTES_INGRESO,
      gastos: (g.data || []).map(rowToGasto),
      ingresos: (i.data || []).map(rowToIngreso),
      inversiones: (inv.data || []).map(rowToInv),
      metas: (m.data || []).map(rowToMeta),
      recurrentes: recData.map(rowToRec),
      stats: {
        xp: stats.xp || 0,
        rachaMax: stats.racha_max || 0,
        diasActividad: stats.dias_actividad || {},
        logros: stats.logros || {},
        metasCumplidas: stats.metas_cumplidas || {},
      },
    };

    try { await generarRecurrentes(); } catch (e) { console.error('generarRecurrentes:', e); }
  }

  /* ---------- recurrentes: generación de instancias mensuales ---------- */
  function thisMonthKey() { return new Date().toISOString().slice(0, 7); }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function mesesEntre(desde, hasta) { // ['YYYY-MM', ...] inclusive, tope 24 meses
    const out = [];
    let [y, m] = desde.split('-').map(Number);
    const [hy, hm] = hasta.split('-').map(Number);
    let guard = 0;
    while ((y < hy || (y === hy && m <= hm)) && guard < 24) {
      out.push(`${y}-${pad2(m)}`);
      m++; if (m > 12) { m = 1; y++; } guard++;
    }
    return out;
  }
  function fechaDeMes(mk, dia) {
    const [y, m] = mk.split('-').map(Number);
    const ultimo = new Date(y, m, 0).getDate();
    return `${mk}-${pad2(Math.min(dia || 1, ultimo))}`;
  }

  // Crea los movimientos faltantes de cada plantilla activa (idempotente).
  async function generarRecurrentes() {
    if (!state.recurrentes || !state.recurrentes.length) return;
    const tm = thisMonthKey();
    const pendientes = [];
    for (const r of state.recurrentes) {
      if (!r.activo || !r.desde) continue;
      const arr = r.tipoMov === 'ingreso' ? state.ingresos : state.gastos;
      for (const mk of mesesEntre(r.desde, tm)) {
        const existe = arr.some((x) => x.recurrenteId === r.id && (x.fecha || '').slice(0, 7) === mk);
        if (existe) continue;
        const fecha = fechaDeMes(mk, r.diaMes);
        if (r.tipoMov === 'ingreso') {
          pendientes.push({ table: 'ingresos', row: { monto: r.monto, moneda: r.moneda, fuente: r.fuente || 'Sueldo', recurrente: true, descripcion: r.nombre, fecha, user_id: userId, recurrente_id: r.id } });
        } else {
          pendientes.push({ table: 'gastos', row: { monto: r.monto, moneda: r.moneda, tipo: 'fijo', categoria: r.categoria || 'Otros', descripcion: r.nombre, fecha, user_id: userId, recurrente_id: r.id } });
        }
      }
    }
    for (const p of pendientes) {
      const { data, error } = await SB.from(p.table).insert(p.row).select().single();
      if (error) { console.error('generar', p.table, error.message); continue; }
      if (p.table === 'ingresos') state.ingresos.unshift(rowToIngreso(data));
      else state.gastos.unshift(rowToGasto(data));
    }
  }

  /* ---------- gamificación / persistencia de stats ---------- */
  function marcarActividadHoy() { state.stats.diasActividad[todayISO()] = true; }
  function addXP(n) { state.stats.xp = Math.max(0, (state.stats.xp || 0) + n); }

  async function saveStats() {
    const s = state.stats;
    const { error } = await SB.from('stats_usuario').upsert({
      user_id: statsRowId || userId,
      xp: s.xp, racha_max: s.rachaMax,
      dias_actividad: s.diasActividad, logros: s.logros, metas_cumplidas: s.metasCumplidas,
      tipo_cambio_usd: state.config.tipoCambioUSD,
      updated_at: new Date().toISOString(),
    });
    if (error) console.error('saveStats:', error.message);
  }

  async function persist(opts = {}) {
    let nuevos = [];
    if (window.Gamification) nuevos = Gamification.evaluate(state);
    await saveStats();
    saveCache();
    emit();
    if (!opts.silent && nuevos.length && window.UI) UI.celebrate(nuevos);
  }

  // Al iniciar: evalúa logros ya merecidos (sin festejar) y guarda solo si hubo cambios.
  async function syncInicial() {
    let nuevos = [];
    if (window.Gamification) nuevos = Gamification.evaluate(state);
    if (nuevos.length) await saveStats();
    saveCache();
    emit();
  }

  function fail(error) {
    console.error(error);
    if (window.UI) UI.toast({ emoji: '⚠️', title: 'No se pudo guardar', sub: (error && error.message) || 'Revisá tu conexión' });
  }

  /* ---------- Gastos ---------- */
  async function addGasto(data) {
    const { data: row, error } = await SB.from('gastos').insert({ ...gastoToRow(data), user_id: userId }).select().single();
    if (error) return fail(error);
    state.gastos.unshift(rowToGasto(row));
    marcarActividadHoy(); addXP(5); await persist();
  }
  async function updateGasto(id, data) {
    const { error } = await SB.from('gastos').update(gastoToRow(data)).eq('id', id);
    if (error) return fail(error);
    const g = state.gastos.find((x) => x.id === id); if (g) Object.assign(g, rowToGasto({ id, ...gastoToRow(data) }));
    await persist();
  }
  async function deleteGasto(id) {
    const { error } = await SB.from('gastos').delete().eq('id', id);
    if (error) return fail(error);
    state.gastos = state.gastos.filter((x) => x.id !== id); await persist();
  }

  /* ---------- Ingresos ---------- */
  async function addIngreso(data) {
    const { data: row, error } = await SB.from('ingresos').insert({ ...ingresoToRow(data), user_id: userId }).select().single();
    if (error) return fail(error);
    state.ingresos.unshift(rowToIngreso(row));
    marcarActividadHoy(); addXP(20); await persist();
  }
  async function updateIngreso(id, data) {
    const { error } = await SB.from('ingresos').update(ingresoToRow(data)).eq('id', id);
    if (error) return fail(error);
    const x = state.ingresos.find((y) => y.id === id); if (x) Object.assign(x, rowToIngreso({ id, ...ingresoToRow(data) }));
    await persist();
  }
  async function deleteIngreso(id) {
    const { error } = await SB.from('ingresos').delete().eq('id', id);
    if (error) return fail(error);
    state.ingresos = state.ingresos.filter((x) => x.id !== id); await persist();
  }

  /* ---------- Inversiones ---------- */
  async function addInversion(data) {
    const { data: row, error } = await SB.from('inversiones').insert({ ...invToRow(data), user_id: userId }).select().single();
    if (error) return fail(error);
    state.inversiones.unshift(rowToInv(row));
    marcarActividadHoy(); addXP(15); await persist();
  }
  async function updateInversion(id, data) {
    const { error } = await SB.from('inversiones').update(invToRow(data)).eq('id', id);
    if (error) return fail(error);
    const x = state.inversiones.find((y) => y.id === id); if (x) Object.assign(x, rowToInv({ id, ...invToRow(data) }));
    await persist();
  }
  async function deleteInversion(id) {
    const { error } = await SB.from('inversiones').delete().eq('id', id);
    if (error) return fail(error);
    state.inversiones = state.inversiones.filter((x) => x.id !== id); await persist();
  }

  /* ---------- Metas ---------- */
  async function addMeta(data) {
    const { data: row, error } = await SB.from('metas').insert({ ...metaToRow(data), user_id: userId }).select().single();
    if (error) return fail(error);
    state.metas.push(rowToMeta(row)); addXP(10); await persist();
  }
  async function updateMeta(id, data) {
    const { error } = await SB.from('metas').update(metaToRow(data)).eq('id', id);
    if (error) return fail(error);
    const m = state.metas.find((x) => x.id === id); if (m) Object.assign(m, rowToMeta({ id, ...metaToRow(data) }));
    await persist();
  }
  async function deleteMeta(id) {
    const { error } = await SB.from('metas').delete().eq('id', id);
    if (error) return fail(error);
    state.metas = state.metas.filter((x) => x.id !== id); await persist();
  }
  async function aporteMeta(id, monto) {
    const m = state.metas.find((x) => x.id === id); if (!m) return;
    const nuevo = Math.max(0, (m.actual || 0) + monto);
    const { error } = await SB.from('metas').update({ actual: nuevo }).eq('id', id);
    if (error) return fail(error);
    m.actual = nuevo; addXP(15); await persist();
  }

  /* ---------- Recurrentes (plantillas de gastos/ingresos fijos) ---------- */
  async function addRecurrente(data) {
    const payload = { ...recToRow(data), desde: data.desde || thisMonthKey() };
    const { data: row, error } = await SB.from('recurrentes').insert({ ...payload, user_id: userId }).select().single();
    if (error) return fail(error);
    state.recurrentes.push(rowToRec(row));
    await generarRecurrentes(); // crea ya el movimiento de este mes (y meses faltantes)
    addXP(10);
    await persist();
  }
  async function updateRecurrente(id, data) {
    const tpl = state.recurrentes.find((x) => x.id === id);
    if (!tpl) return;
    const { error } = await SB.from('recurrentes').update(recToRow({ ...tpl, ...data })).eq('id', id);
    if (error) return fail(error);
    Object.assign(tpl, data);
    // reflejar el cambio en el movimiento del mes EN CURSO (los meses pasados quedan históricos)
    const tm = thisMonthKey();
    const arr = tpl.tipoMov === 'ingreso' ? state.ingresos : state.gastos;
    const inst = arr.find((x) => x.recurrenteId === id && (x.fecha || '').slice(0, 7) === tm);
    if (inst) {
      if (tpl.tipoMov === 'ingreso') {
        await SB.from('ingresos').update({ monto: tpl.monto, moneda: tpl.moneda, fuente: tpl.fuente || 'Sueldo', descripcion: tpl.nombre }).eq('id', inst.id);
        Object.assign(inst, { monto: tpl.monto, moneda: tpl.moneda, fuente: tpl.fuente, descripcion: tpl.nombre });
      } else {
        await SB.from('gastos').update({ monto: tpl.monto, moneda: tpl.moneda, categoria: tpl.categoria, descripcion: tpl.nombre }).eq('id', inst.id);
        Object.assign(inst, { monto: tpl.monto, moneda: tpl.moneda, categoria: tpl.categoria, descripcion: tpl.nombre });
      }
    } else if (tpl.activo) {
      await generarRecurrentes(); // si se reactivó o aún no existía, generalo
    }
    await persist();
  }
  async function deleteRecurrente(id) {
    const { error } = await SB.from('recurrentes').delete().eq('id', id);
    if (error) return fail(error);
    state.recurrentes = state.recurrentes.filter((x) => x.id !== id);
    // los movimientos ya generados quedan como históricos (la FK pone recurrente_id en null)
    state.gastos.forEach((x) => { if (x.recurrenteId === id) x.recurrenteId = null; });
    state.ingresos.forEach((x) => { if (x.recurrenteId === id) x.recurrenteId = null; });
    await persist();
  }

  /* ---------- Config ---------- */
  async function setTipoCambio(v) {
    state.config.tipoCambioUSD = Number(v) || state.config.tipoCambioUSD;
    await persist();
  }

  /* ---------- Borrar todos mis datos ---------- */
  async function reset() {
    const TODO = (q) => q.gte('created_at', '2000-01-01'); // filtro que matchea todas las filas
    // recurrentes primero (FK): si no, las instancias quedan referenciadas
    await TODO(SB.from('recurrentes').delete());
    await Promise.all([
      TODO(SB.from('gastos').delete()),
      TODO(SB.from('ingresos').delete()),
      TODO(SB.from('inversiones').delete()),
      TODO(SB.from('metas').delete()),
    ]);
    state.gastos = []; state.ingresos = []; state.inversiones = []; state.metas = []; state.recurrentes = [];
    state.stats = { xp: 0, rachaMax: 0, diasActividad: {}, logros: {}, metasCumplidas: {} };
    await persist();
  }

  return {
    init, getState, onChange, syncInicial, persist, reset,
    addGasto, updateGasto, deleteGasto,
    addIngreso, updateIngreso, deleteIngreso,
    addInversion, updateInversion, deleteInversion,
    addMeta, updateMeta, deleteMeta, aporteMeta,
    addRecurrente, updateRecurrente, deleteRecurrente,
    setTipoCambio,
  };
})();
window.Store = Store;
