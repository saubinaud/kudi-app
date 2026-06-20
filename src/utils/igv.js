/**
 * Desglose IGV interno — fuente de verdad UNICA para el front (ESM).
 * Espejo identico de /tmp/kudi-api/src/utils/igv.js (CommonJS) en el back.
 *
 * REPLICA EXACTA de la formula validada del POS ("sobre_total"):
 *   base  = round2(subtotal / (1 + tasa))
 *   igv   = round2(subtotal - base)
 *   total = round2(subtotal)
 *
 * Si tasa <= 0  ->  { base: subtotal, igv: 0, total: subtotal } (sin redondear).
 *
 * Esta funcion NO decide CUANDO aplicar IGV (informal/formal, conIgv, canal):
 * esa logica vive en el call-site (validada por el fundador). Aqui SOLO se
 * extrae el desglose aritmetico, identico al actual.
 *
 * El parametro `metodo` queda reservado para la BOLETA SUNAT ('por_linea'),
 * que se calcula linea por linea en utils/facturacion.js. AQUI NO se implementa
 * 'por_linea' ni se toca la boleta — eso espera al CFO.
 */

import { round2 } from './redondeo.js';

/**
 * @param {number} subtotal  total con IGV incluido (precio mostrado).
 * @param {number} tasa      tasa de IGV (ej. 0.18). Si <= 0, no hay IGV.
 * @param {object} opts      { metodo: 'sobre_total' } (default). Reservado.
 * @returns {{ base: number, igv: number, total: number }}
 */
export function desglosarIGV(subtotal, tasa, opts = {}) {
  const metodo = opts.metodo || 'sobre_total';

  if (metodo !== 'sobre_total') {
    // 'por_linea' (boleta) aun no implementado aqui; el call-site no debe pedirlo.
    throw new Error(`desglosarIGV: metodo no soportado: ${metodo}`);
  }

  // tasa no finita (Infinity/NaN) NO es IGV valido: tratar como sin IGV en vez de
  // producir base=0,igv=subtotal (caso sorpresivo). Igual gate que tasa<=0.
  if (!(tasa > 0) || !Number.isFinite(tasa)) {
    return { base: subtotal, igv: 0, total: subtotal };
  }

  const base = round2(subtotal / (1 + tasa));
  const igv = round2(subtotal - base);
  const total = round2(subtotal);
  return { base, igv, total };
}
