export function formatCurrency(n, decimals) {
  const simbolo = (typeof localStorage !== 'undefined' && localStorage.getItem('nodum_moneda_simbolo')) || 'S/';
  if (n == null || isNaN(n)) return `${simbolo} 0.00`;
  const val = Number(n);
  const d = decimals != null ? decimals : (Math.abs(val) < 1 && val !== 0 ? 3 : 2);
  return `${simbolo} ${val.toFixed(d)}`;
}

export function formatPercent(n) {
  if (n == null || isNaN(n)) return '0%';
  // DB stores decimal (0.5 = 50%), display as integer %
  const val = Number(n);
  const pct = val < 1 ? val * 100 : val;
  return `${pct.toFixed(1)}%`;
}

// precioComercial — fuente de verdad UNICA en utils/redondeo.js (espejo back/front).
// Se RE-EXPORTA aqui para no romper imports existentes (DashboardPage, etc.).
export { precioComercial } from './redondeo';
import { precioComercial as _precioComercial } from './redondeo';

// Helper to get both versions
export function preciosRecomendados(precio) {
  return {
    conDecimales: _precioComercial(precio, 'variable'),
    sinDecimales: _precioComercial(precio, 'enteros'),
  };
}

export function formatDate(d) {
  if (!d) return '-';
  const str = typeof d === 'string' ? d : String(d);
  // Date-only (YYYY-MM-DD) — no timezone shift
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, dd] = str.split('-');
    return `${dd}/${m}/${y}`;
  }
  const date = new Date(d);
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Lima' });
}

export function formatDateTime(d) {
  if (!d) return '-';
  const date = new Date(d);
  return date.toLocaleDateString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'America/Lima',
  });
}

// Shows date+time only when the time is meaningful (not midnight UTC = local sales without real time)
export function formatSmartDate(d) {
  if (!d) return '-';
  const date = new Date(d);
  const isMiddnightUTC = date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0;
  if (isMiddnightUTC) {
    return formatDate(d);
  }
  return formatDateTime(d);
}
