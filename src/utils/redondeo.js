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
 * precioComercial (presentacion comercial del precio cobrado) vive AQUI, como
 * fuente de verdad unica espejo del back. utils/format.js lo RE-EXPORTA para no
 * romper imports existentes (DashboardPage, etc.).
 */

export function round2(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function round4(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10000) / 10000;
}

/**
 * precioComercial — presentacion comercial del PRECIO COBRADO (con IGV ya incluido).
 *
 * Redondea el precio final para facilitar el cobro en efectivo (en Peru no
 * circulan monedas de 1-9 centimos). Se aplica DESPUES del IGV: el precio que
 * entra aqui ya incluye IGV; el desglose base/IGV (desglosarIGV) se calcula
 * sobre el resultado YA redondeado. NO altera el precio_final guardado del
 * producto — es solo el precio que se muestra y se cobra.
 *
 * Modos (campo empresas/usuarios.precio_decimales):
 *   'variable' (DEFAULT): hacia ARRIBA al multiplo de S/0.10. Nunca pierde
 *                         margen. Ej: 21.24 -> 21.30.
 *   'cercano'           : al S/0.10 mas CERCANO. Ej: 21.24 -> 21.20, 21.26 -> 21.30.
 *   'enteros'           : al SOL mas cercano. Ej: 21.24 -> 21.
 *   'exacto'            : SIN redondeo, con centimos a 2 decimales. Ej: 21.24 -> 21.24.
 *
 * 'decimales' se mantiene como alias historico de 'variable' (no romper datos
 * antiguos). Valores no finitos o <= 0 colapsan a 0 (avisos no bloqueantes).
 *
 * @param {number} precio  precio CON IGV (el precio cobrado).
 * @param {string} modo    'variable' | 'cercano' | 'enteros' | 'exacto'.
 * @returns {number}
 */
export function precioComercial(precio, modo = 'variable') {
  if (!Number.isFinite(precio) || precio <= 0) return 0;

  // Normalizar a 2 decimales primero, para matar ruido de punto flotante
  // (16.0099999 -> 16.01) antes de decidir el redondeo comercial.
  const p = round2(precio);

  switch (modo) {
    case 'exacto':
      return p; // ya esta a 2 decimales
    case 'enteros':
      return Math.round(p); // al sol mas cercano
    case 'cercano':
      return Math.round(p * 10) / 10; // al 0.10 mas cercano
    case 'variable':
    case 'decimales': // alias historico
    default:
      return Math.ceil(p * 10) / 10; // hacia arriba al 0.10
  }
}
