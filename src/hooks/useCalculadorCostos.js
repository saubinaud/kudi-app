import { useMemo } from 'react';

function normU(u) {
  if (!u) return '';
  if (u === 'l') return 'L';
  return u;
}

const FACTORES = {
  'g→kg': 0.001, 'kg→g': 1000,
  'g→oz': 0.03527, 'oz→g': 28.3495,
  'kg→oz': 35.274, 'oz→kg': 0.02835,
  'ml→L': 0.001, 'L→ml': 1000, 'cm→mt': 0.01, 'mt→cm': 100,
};

function convertirUnidad(valor, deUnidad, aUnidad) {
  const de = normU(deUnidad);
  const a = normU(aUnidad);
  if (!de || !a || de === a) return valor;
  const key = `${de}→${a}`;
  if (FACTORES[key]) return valor * FACTORES[key];
  return valor;
}

/**
 * Calculador de costos — PRECIO ES LA VERDAD, MARGEN ES DERIVADO.
 *
 * @param {Array} preparaciones - recetas con insumos
 * @param {Array} materiales - empaque
 * @param {number} precioFinal - precio del producto (input del usuario)
 * @param {number} igvRate - IGV en porcentaje (ej: 18)
 * @param {string} tipoPresentacion - 'unidad' o 'entero'
 * @param {number} unidadesPorProducto - porciones si es entero
 * @param {number|null} precioFinalPorcion - precio por porción (input del usuario)
 */
export function useCalculadorCostos(preparaciones = [], materiales = [], precioFinal = 0, igvRate = 0, tipoPresentacion = 'unidad', unidadesPorProducto = 1, precioFinalPorcion = null) {
  return useMemo(() => {
    // Cost for THE WHOLE PRODUCT from preparations
    const costoInsumosProducto = preparaciones.reduce((sum, prep) => {
      const prepCost = (prep.insumos || []).reduce((s, ins) => {
        const original = normU(ins.unidad_medida);
        const uso = normU(ins.uso_unidad);
        const factor = (uso && original && uso !== original) ? convertirUnidad(1, uso, original) : 1;
        const cu = factor > 0 ? (Number(ins.costo_unitario) || 0) * factor : (Number(ins.costo_unitario) || 0);
        const cantNeta = Number(ins.cantidad) || 0;
        const mermaPct = Number(ins.merma_pct) || 0;
        const cantBruta = mermaPct > 0 ? cantNeta / (1 - mermaPct / 100) : cantNeta;
        return s + cu * cantBruta;
      }, 0);

      const rendimiento = Number(prep.capacidad) || 0;
      const cantParaProducto = Number(prep.cantidad_por_unidad) || 0;
      const cantEnUnidadPrep = convertirUnidad(cantParaProducto, normU(prep.porcion_unidad || prep.unidad || ''), normU(prep.unidad || ''));

      if (rendimiento > 0 && cantEnUnidadPrep > 0) {
        const costoBase = (prepCost / rendimiento) * cantEnUnidadPrep;
        const mermaPrepPct = Number(prep.merma_pct) || 0;
        return sum + (mermaPrepPct > 0 ? costoBase * (1 + mermaPrepPct / 100) : costoBase);
      }
      return sum + prepCost;
    }, 0);

    const unidades = tipoPresentacion === 'entero' ? (unidadesPorProducto || 1) : 1;
    const costoInsumosPorPorcion = unidades > 1 ? costoInsumosProducto / unidades : costoInsumosProducto;

    // Empaque costs
    const costoEmpaqueEntero = materiales
      .filter((m) => (m.empaque_tipo || 'entero') === 'entero')
      .reduce((sum, mat) => sum + (Number(mat.precio) || 0) * (Number(mat.cantidad) || 0), 0);
    const costoEmpaqueUnidad = materiales
      .filter((m) => m.empaque_tipo === 'unidad')
      .reduce((sum, mat) => sum + (Number(mat.precio) || 0) * (Number(mat.cantidad) || 0), 0);

    const costoNetoProducto = costoInsumosProducto + costoEmpaqueEntero + (costoEmpaqueUnidad * unidades);
    const costoNetoPorcion = costoInsumosPorPorcion + costoEmpaqueUnidad;
    const igvDecimal = Number(igvRate) / 100;

    // PRECIO es el input del usuario — no se calcula
    const pf = Number(precioFinal) || 0;
    const precioVentaProducto = igvDecimal > 0 && pf > 0 ? pf / (1 + igvDecimal) : pf;

    // MARGEN se DERIVA del precio (nunca es input)
    const margen = precioVentaProducto > 0 && costoNetoProducto > 0
      ? (1 - costoNetoProducto / precioVentaProducto) * 100
      : 0;

    // Por porción
    const pfp = precioFinalPorcion != null ? Number(precioFinalPorcion) : (unidades > 1 && pf > 0 ? Math.round(pf / unidades * 100) / 100 : pf);
    const precioVentaPorcion = igvDecimal > 0 && pfp > 0 ? pfp / (1 + igvDecimal) : pfp;
    const margenPorcion = precioVentaPorcion > 0 && costoNetoPorcion > 0
      ? (1 - costoNetoPorcion / precioVentaPorcion) * 100
      : 0;

    return {
      costoInsumos: costoInsumosProducto,
      costoInsumosProducto,
      costoInsumosPorPorcion,
      costoEmpaqueEntero,
      costoEmpaqueUnidad,
      costoEmpaque: costoEmpaqueEntero + (costoEmpaqueUnidad * unidades),
      costoNeto: costoNetoProducto,
      costoNetoPorcion,
      margen,
      margenPorcion,
      unidades,
      precioVenta: precioVentaProducto,
      precioVentaPorcion,
      igvRate: Number(igvRate),
      igvMonto: precioVentaProducto * igvDecimal,
      precioFinal: pf,
      precioFinalPorcion: pfp,
    };
  }, [preparaciones, materiales, precioFinal, igvRate, tipoPresentacion, unidadesPorProducto, precioFinalPorcion]);
}
