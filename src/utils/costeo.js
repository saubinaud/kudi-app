/**
 * costeo.js — FUENTE DE VERDAD UNICA del costeo de un producto (front, ESM).
 *
 * Espejo identico en logica de /tmp/kudi-api/src/services/costeo.js (CommonJS, back).
 * Reutiliza utils/unidades (convertirUnidad/mismaFamilia/getUnidadBase) y
 * utils/redondeo (round4 para costos, round2 para montos).
 *
 * Implementa la definicion COMPLETA y correcta (la del endpoint ficha-tecnica):
 * insumos(con merma) + empaque + mano de obra (MO) + CIF, con rendimiento/conversion
 * de unidades por preparacion. El front (cotizador en vivo), el back (ficha) y el
 * recalculo automatico construyen la misma estructura NORMALIZADA y llaman aqui:
 * el costo_neto coincide por construccion.
 *
 *   costoNeto = costoInsumos + costoEmpaque + costoPackItems + costoMo + costoCif
 *
 * Principios:
 *   - round4 en costos unitarios / lineas intermedias; round2 solo en montos finales.
 *   - Familias de unidad incompatibles NO inventan costo (aportan 0).
 *   - Avisos informativos NO bloqueantes: costo 0 es legitimo, nunca se lanza.
 */

import { convertirUnidad, mismaFamilia, getUnidadBase, normU } from './unidades.js';
import { round2, round4 } from './redondeo.js';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Costo de una linea de insumo (sin merma de prep). costo_base = costo por unidad base. */
export function costoInsumoLinea(ins) {
  const usoU = normU(ins.uso_unidad || ins.unidad_medida);
  const baseU = getUnidadBase(usoU);
  const cantNeta = num(ins.cantidad);
  const cantNetaBase = (usoU === baseU) ? cantNeta : convertirUnidad(cantNeta, usoU, baseU);
  const cantNetaBaseSafe = Number.isFinite(cantNetaBase) ? cantNetaBase : 0;

  let costoBase = num(ins.costo_base);
  if (!(costoBase > 0)) {
    const precio = num(ins.precio_presentacion);
    const cantPres = num(ins.cantidad_presentacion);
    const presU = normU(ins.unidad_medida || usoU);
    const presBaseU = getUnidadBase(presU);
    const cantPresBase = (presU === presBaseU) ? cantPres : convertirUnidad(cantPres, presU, presBaseU);
    costoBase = cantPresBase > 0 ? precio / cantPresBase : 0;
  }

  const mermaPct = num(ins.merma_pct);
  const cantBruta = mermaPct > 0 ? cantNetaBaseSafe / (1 - mermaPct / 100) : cantNetaBaseSafe;
  return round4(cantBruta * costoBase);
}

/** Costo de una preparacion aportado a 1 unidad de producto (con merma + rendimiento). */
export function costoPreparacion(prep) {
  const insumos = Array.isArray(prep.insumos) ? prep.insumos : [];
  const costoTanda = insumos.reduce((s, ins) => s + costoInsumoLinea(ins), 0);

  const rendimiento = num(prep.capacidad);
  const cantParaProducto = num(prep.cantidad_por_unidad);
  const rendU = normU(prep.unidad_capacidad || '');
  const porcionU = normU(prep.porcion_unidad || prep.unidad_capacidad || '');

  let costoPorcion;
  if (porcionU && rendU && porcionU !== rendU && !mismaFamilia(porcionU, rendU)) {
    costoPorcion = 0;
  } else {
    const cantEnUnidadPrep = convertirUnidad(cantParaProducto, porcionU, rendU);
    const cantSafe = Number.isFinite(cantEnUnidadPrep) ? cantEnUnidadPrep : 0;
    costoPorcion = (rendimiento > 0 && cantSafe > 0)
      ? (costoTanda / rendimiento) * cantSafe
      : costoTanda;
  }

  const mermaPrepPct = num(prep.merma_pct);
  const costoConMerma = mermaPrepPct > 0 ? costoPorcion * (1 + mermaPrepPct / 100) : costoPorcion;
  return round4(costoConMerma);
}

/** Costo de empaque de una linea de material. */
export function costoMaterialLinea(mat) {
  const cantidad = num(mat.cantidad);
  let cu = num(mat.costo_wac);
  if (!(cu > 0)) {
    const precio = num(mat.precio_presentacion);
    const cantPres = num(mat.cantidad_presentacion);
    cu = cantPres > 0 ? precio / cantPres : precio;
  }
  return round4(cantidad * cu);
}

/**
 * calcularCostoNeto(input) — interfaz unica de costeo (espejo del back).
 *
 * input = {
 *   preparaciones: [{ capacidad, unidad_capacidad, cantidad_por_unidad, porcion_unidad,
 *                     merma_pct, insumos: [{ cantidad, merma_pct, costo_base,
 *                                            uso_unidad, unidad_medida,
 *                                            precio_presentacion?, cantidad_presentacion? }] }],
 *   materiales:   [{ cantidad, precio_presentacion, cantidad_presentacion, costo_wac?, empaque_tipo }],
 *   mo:   { tarifa, tiempo_activo_min },
 *   cif:  { gas, overhead },
 *   unidades, tipo_presentacion,
 *   packItems: [{ cantidad, costo_efectivo }],
 * }
 *
 * Devuelve { costoInsumos, costoEmpaque, costoMo, costoCif, costoPackItems, costoNeto }.
 */
export function calcularCostoNeto(input = {}) {
  const preparaciones = Array.isArray(input.preparaciones) ? input.preparaciones : [];
  const materiales = Array.isArray(input.materiales) ? input.materiales : [];
  const packItems = Array.isArray(input.packItems) ? input.packItems : [];
  const mo = input.mo || {};
  const cif = input.cif || {};

  const unidades = input.tipo_presentacion === 'entero' ? Math.max(1, num(input.unidades) || 1) : 1;

  const costoInsumosProducto = round4(
    preparaciones.reduce((s, prep) => s + costoPreparacion(prep), 0)
  );

  const costoEmpaqueEntero = round4(
    materiales
      .filter((m) => (m.empaque_tipo || 'entero') === 'entero')
      .reduce((s, m) => s + costoMaterialLinea(m), 0)
  );
  const costoEmpaqueUnidad = round4(
    materiales
      .filter((m) => m.empaque_tipo === 'unidad')
      .reduce((s, m) => s + costoMaterialLinea(m), 0)
  );
  const costoEmpaque = round4(costoEmpaqueEntero + costoEmpaqueUnidad * unidades);

  const costoPackItems = round4(
    packItems.reduce((s, it) => s + num(it.costo_efectivo) * (num(it.cantidad) || 1), 0)
  );

  const tarifaMo = num(mo.tarifa);
  const tiempoActivo = num(mo.tiempo_activo_min);
  const costoMoTanda = (tiempoActivo / 60) * tarifaMo;
  const costoMo = round4(unidades > 0 ? costoMoTanda / unidades : costoMoTanda);

  const costoCif = round4(num(cif.gas) + num(cif.overhead));

  const costoNeto = round2(
    costoInsumosProducto + costoEmpaque + costoPackItems + costoMo + costoCif
  );

  return {
    costoInsumos: round2(costoInsumosProducto),
    costoEmpaque: round2(costoEmpaque),
    costoMo: round2(costoMo),
    costoCif: round2(costoCif),
    costoPackItems: round2(costoPackItems),
    costoNeto,
  };
}
