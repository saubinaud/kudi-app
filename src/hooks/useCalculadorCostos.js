import { useMemo } from 'react';
import { round2 } from '../utils/redondeo';
import { calcularCostoNeto } from '../utils/costeo';
import { derivarPrecios, margenAPorcentaje } from '../utils/precios';

/**
 * Calculador de costos — PRECIO ES LA VERDAD, MARGEN ES DERIVADO.
 *
 * El COSTO se calcula con la FUENTE DE VERDAD UNICA utils/costeo.calcularCostoNeto
 * (espejo identico del back services/costeo). Incluye insumos(con merma) + empaque +
 * pack + MO + CIF, igual que la ficha-tecnica y el recalculo automatico. Asi el
 * costo_neto del cotizador == el de la ficha == el que persiste el recalculo.
 *
 * Este hook construye la estructura NORMALIZADA desde el estado del cotizador y
 * deriva precio/margen alrededor del costo. NO duplica la aritmetica de costeo.
 *
 * @param {Array} preparaciones - recetas (estado del cotizador)
 * @param {Array} materiales - empaque (estado del cotizador)
 * @param {number} precioFinal - precio del producto (input del usuario)
 * @param {number} igvRate - IGV en porcentaje (ej: 18)
 * @param {string} tipoPresentacion - 'unidad' o 'entero'
 * @param {number} unidadesPorProducto - porciones si es entero
 * @param {number|null} precioFinalPorcion - precio por porción (input del usuario)
 * @param {number} comisionPct - comisión POS/canal
 * @param {number} costoPackItems - costo EFECTIVO total de los componentes del pack (ya fresco)
 * @param {number} costoBaseManual - costo base de productos no_transformable / pack sin componentes
 * @param {object} opts - { mo:{tarifa,tiempo_activo_min}, cif:{gas,overhead} } (futuro: MO/CIF en cotizador)
 */
export function useCalculadorCostos(preparaciones = [], materiales = [], precioFinal = 0, igvRate = 0, tipoPresentacion = 'unidad', unidadesPorProducto = 1, precioFinalPorcion = null, comisionPct = 0, costoPackItems = 0, costoBaseManual = 0, opts = {}) {
  const mo = opts.mo || null;
  const cif = opts.cif || null;
  return useMemo(() => {
    const unidades = tipoPresentacion === 'entero' ? (unidadesPorProducto || 1) : 1;

    // ── Estructura NORMALIZADA (misma que ficha-tecnica back y recalculo) ──
    // insumo del cotizador: costo_unitario = costo por unidad_medida.
    //   -> se entrega como precio_presentacion(=costo_unitario)/cantidad_presentacion(=1)
    //      para que costeo derive el costo por unidad base de forma simetrica al back.
    const prepsNorm = (preparaciones || []).map((prep) => ({
      capacidad: prep.capacidad,
      unidad_capacidad: prep.unidad || prep.unidad_capacidad,
      cantidad_por_unidad: prep.cantidad_por_unidad,
      porcion_unidad: prep.porcion_unidad || prep.unidad,
      merma_pct: prep.merma_pct,
      insumos: (prep.insumos || []).map((ins) => ({
        cantidad: ins.cantidad,
        merma_pct: ins.merma_pct,
        uso_unidad: ins.uso_unidad || ins.unidad_medida,
        unidad_medida: ins.unidad_medida,
        precio_presentacion: Number(ins.costo_unitario) || 0,
        cantidad_presentacion: 1,
      })),
    }));

    // material del cotizador: precio = costo por unidad (ya unitario).
    const matsNorm = (materiales || []).map((mat) => ({
      cantidad: mat.cantidad,
      precio_presentacion: Number(mat.precio) || 0,
      cantidad_presentacion: 1,
      empaque_tipo: mat.empaque_tipo || 'entero',
    }));

    // Pack items + costo base manual como aportes EFECTIVOS aditivos.
    const packItems = [];
    const packVal = Number(costoPackItems) || 0;
    const baseVal = Number(costoBaseManual) || 0;
    if (packVal) packItems.push({ cantidad: 1, costo_efectivo: packVal });
    if (baseVal) packItems.push({ cantidad: 1, costo_efectivo: baseVal });

    const costeo = calcularCostoNeto({
      preparaciones: prepsNorm,
      materiales: matsNorm,
      mo: mo || { tarifa: 0, tiempo_activo_min: 0 },
      cif: cif || { gas: 0, overhead: 0 },
      unidades,
      tipo_presentacion: tipoPresentacion,
      packItems,
    });

    const costoInsumosProducto = costeo.costoInsumos;
    const costoNetoProducto = costeo.costoNeto;
    const costoEmpaque = costeo.costoEmpaque;

    // Desglose de empaque para display (entero vs por-porcion). El TOTAL canonico
    // (costoEmpaque) lo da el modulo; aqui solo se reparte para mostrarlo.
    const costoEmpaqueEntero = round2((materiales || [])
      .filter((m) => (m.empaque_tipo || 'entero') === 'entero')
      .reduce((s, m) => s + (Number(m.precio) || 0) * (Number(m.cantidad) || 0), 0));
    const costoEmpaqueUnidad = round2((materiales || [])
      .filter((m) => m.empaque_tipo === 'unidad')
      .reduce((s, m) => s + (Number(m.precio) || 0) * (Number(m.cantidad) || 0), 0));

    // Por porción (entero): se reparte el costo total entre las porciones.
    const costoNetoPorcion = unidades > 1 ? round2(costoNetoProducto / unidades) : costoNetoProducto;
    const costoInsumosPorPorcion = unidades > 1 ? round2(costoInsumosProducto / unidades) : costoInsumosProducto;

    const igvDecimal = Number(igvRate) / 100;

    // PRECIO es el input del usuario — no se calcula
    const pf = Number(precioFinal) || 0;
    const comDec = Number(comisionPct) / 100;
    const pfSinComision = comDec > 0 && pf > 0 ? pf * (1 - comDec) : pf;
    // Derivacion canonica unica (precio_venta sin IGV + margen DECIMAL).
    // El precio que entra ya viene neto de comision (precio efectivo del negocio).
    const derivProd = derivarPrecios({ costoNeto: costoNetoProducto, precioFinal: pfSinComision, igvRate: igvDecimal });
    const precioVentaProducto = derivProd.precioVenta;
    const comisionMonto = pf - pfSinComision;

    // MARGEN se DERIVA del precio (nunca es input). El campo expuesto es de DISPLAY (en %);
    // el valor canonico (derivProd.margen) es decimal.
    const margen = margenAPorcentaje(derivProd.margen);

    // Por porción
    const pfp = precioFinalPorcion != null ? Number(precioFinalPorcion) : (unidades > 1 && pf > 0 ? round2(pf / unidades) : pf);
    const pfpSinComision = comDec > 0 && pfp > 0 ? pfp * (1 - comDec) : pfp;
    const derivPorcion = derivarPrecios({ costoNeto: costoNetoPorcion, precioFinal: pfpSinComision, igvRate: igvDecimal });
    const precioVentaPorcion = derivPorcion.precioVenta;
    const margenPorcion = margenAPorcentaje(derivPorcion.margen);

    return {
      costoInsumos: costoInsumosProducto,
      costoInsumosProducto,
      costoPackItems: packVal,
      costoBaseManual: baseVal,
      costoMo: costeo.costoMo,
      costoCif: costeo.costoCif,
      costoInsumosPorPorcion,
      costoEmpaqueEntero,
      costoEmpaqueUnidad,
      costoEmpaque,
      costoNeto: costoNetoProducto,
      costoNetoPorcion,
      margen,
      margenPorcion,
      unidades,
      precioVenta: precioVentaProducto,
      precioVentaPorcion,
      igvRate: Number(igvRate),
      igvMonto: precioVentaProducto * igvDecimal,
      comisionMonto,
      comisionPct: Number(comisionPct),
      precioFinal: pf,
      precioFinalPorcion: pfp,
    };
  }, [preparaciones, materiales, precioFinal, igvRate, tipoPresentacion, unidadesPorProducto, precioFinalPorcion, comisionPct, costoPackItems, costoBaseManual, mo, cif]);
}
