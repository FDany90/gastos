/* Utilidades de formato (moneda, fechas, fechas relativas) */
const Format = (function () {
  function money(amount, moneda = 'USD') {
    const n = Number(amount || 0);
    // ARS -> "$ 1.234,56" (formato argentino)
    if (moneda === 'ARS') return '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    // USD -> "US$1,234.56" (prefijo claro para no confundir con pesos)
    return 'US$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function usd(a) { return money(a, 'USD'); }
  function crypto(qty) {
    return Number(qty || 0).toLocaleString('en-US', { maximumFractionDigits: 8 });
  }
  function pct(n, withSign = true) {
    const s = (withSign && n >= 0) ? '+' : '';
    return s + Number(n || 0).toFixed(1) + '%';
  }
  function date(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
  }
  function monthName(key) { // key 'YYYY-MM'
    const [y, m] = key.split('-');
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  }
  return { money, usd, crypto, pct, date, monthName };
})();
window.Format = Format;
