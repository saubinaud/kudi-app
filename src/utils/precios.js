/**
 * Derivacion precio_venta <-> margen — fuente de verdad UNICA (ESM, front).
 * Espejo identico de /tmp/kudi-api/src/services/precios.js (CommonJS) en el back.
 *
 * MODELO: PRECIO ES LA VERDAD, MARGEN ES DERIVADO.
 *   precio_final = la carta del negocio (input del usuario, NO se calcula aqui).
 *   precio_venta = precio_final sin IGV.
 *   margen       = ganancia sobre el precio de venta, en DECIMAL (0.33 = 33%).
 *
 * Formula canonica:
 *   precio_venta = igvRate>0 && precioFinal>0 ? round2(precioFinal / (1 + igvRate))
 *                                             : round2(precioFinal)
 *   margen       = precio_venta>0 && costoNeto>0
 *                    ? clamp(1 - costoNeto / precio_venta, -0.999999, 0.999999)
 *                    : 0
 *
 * REGLAS:
 *   - igvRate es DECIMAL real (0.18), del producto o de la empresa. NUNCA un 1.18/0.18 literal.
 *   - margen SIEMPRE en decimal. La conversion a % es solo display (margenAPorcentaje).
 *   - margen negativo permitido (clamp +/- 0.999999). Avisos no bloqueantes.
 */

import { round2, round4 } from './redondeo.js';

export const MARGEN_MIN = -0.999999;
export const MARGEN_MAX = 0.999999;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Deriva precio_venta y margen (decimal) desde costo_neto, precio_final e igv_rate.
 * @param {object} args
 * @param {number} args.costoNeto   - costo total del producto.
 * @param {number} args.precioFinal - precio de carta (con IGV si aplica).
 * @param {number} args.igvRate     - IGV en DECIMAL (0.18). 0 = sin IGV.
 * @returns {{ precioVenta: number, margen: number }} margen en DECIMAL.
 */
export function derivarPrecios({ costoNeto = 0, precioFinal = 0, igvRate = 0 } = {}) {
  const cn = Number(costoNeto) || 0;
  const pf = Number(precioFinal) || 0;
  const igv = Number(igvRate) || 0;

  const precioVenta = igv > 0 && pf > 0 ? round2(pf / (1 + igv)) : round2(pf);

  // margen a 4 decimales: misma precision que la cascada SQL de IGV (back auth.js
  // PUT /perfil usa ROUND(...,4)), para que productos.margen no derive segun la ruta.
  const margen = precioVenta > 0 && cn > 0
    ? round4(clamp(1 - cn / precioVenta, MARGEN_MIN, MARGEN_MAX))
    : 0;

  return { precioVenta, margen };
}

/** Convierte margen decimal -> porcentaje (solo display). */
export function margenAPorcentaje(m) {
  return (Number(m) || 0) * 100;
}
