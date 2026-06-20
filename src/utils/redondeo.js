/**
 * Redondeo — fuente de verdad UNICA para el front (ESM).
 * Espejo identico de /tmp/kudi-api/src/utils/redondeo.js (CommonJS) en el back.
 *
 * Regla:
 *   round2 = montos / precios / totales       (2 decimales)
 *   round4 = costos unitarios intermedios      (4 decimales REALES)
 *
 * NO mezclar: un monto final usa round2; un costo de linea / costo_base usa round4.
 * Valores NaN o no finitos colapsan a 0 (avisos no bloqueantes).
 *
 * precioComercial (presentacion comercial de un precio) vive en utils/format.js,
 * porque es solo presentacion del front, no aritmetica de costos.
 */

export function round2(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function round4(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10000) / 10000;
}
