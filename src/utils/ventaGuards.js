// ventaGuards (front) — reglas de descuento y total de venta, FUENTE ÚNICA
// para todas las superficies que editan líneas de venta (POS, Ventas, Mesas).
// Espejo conceptual del back (kudi-api src/utils/ventaGuards.js): el descuento
// vive en [0..precio*cantidad] y ninguna venta se cobra con total <= 0.

// Descuento en soles topado a la línea: nunca negativo, nunca > precio*cantidad.
export function clampDescuentoMonto(precio, cantidad, val) {
  const max = (parseFloat(precio) || 0) * (parseFloat(cantidad) || 0);
  const v = parseFloat(val) || 0;
  return Math.min(max, Math.max(0, v));
}

// Descuento porcentual topado a [0..100].
export function clampDescuentoPct(val) {
  const v = parseFloat(val) || 0;
  return Math.min(100, Math.max(0, v));
}

// Monto en soles que corresponde a un % sobre la línea (redondeado a céntimos).
// base * (pct/100) redondeado a 2 decimales == Math.round(base * pct) / 100.
export function montoDesdePct(precio, cantidad, pct) {
  const base = (parseFloat(precio) || 0) * (parseFloat(cantidad) || 0);
  return Math.round(base * clampDescuentoPct(pct)) / 100;
}

// ¿El total es cobrable? (finito y > 0)
export function totalCobrable(total) {
  const t = parseFloat(total);
  return Number.isFinite(t) && t > 0;
}
