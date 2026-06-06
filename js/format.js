/* Utilidades de formato (moneda, fechas, fechas relativas) */
const Format = (function () {
  function money(amount, moneda = 'USD') {
    const locale = moneda === 'ARS' ? 'es-AR' : 'en-US';
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency', currency: moneda,
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      }).format(amount || 0);
    } catch (e) {
      return moneda + ' ' + Number(amount || 0).toFixed(2);
    }
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
