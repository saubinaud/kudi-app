/**
 * Sistema de unidades normalizado (ESPEJO de /tmp/kudi-api/src/utils/unidades.js).
 * Cada tipo de medida tiene UNA unidad base:
 *   Peso    → gramo (g)
 *   Volumen → mililitro (ml)
 *   Conteo  → unidad (uni)
 *   Longitud→ centímetro (cm)
 *
 * Toda conversión se hace normalizando a la unidad base de la familia:
 *   valor_destino = valor * A_BASE[de] / A_BASE[a]
 *
 * Si las unidades pertenecen a familias distintas (p.ej. g <-> ml) NO se
 * inventa un número: se devuelve una señal de incompatibilidad.
 */

// Unidad base por unidad (define la familia)
export const UNIDAD_BASE = {
  g: 'g', kg: 'g', oz: 'g', lb: 'g', mg: 'g',
  ml: 'ml', L: 'ml', l: 'ml',
  uni: 'uni', docena: 'uni',
  cm: 'cm', mt: 'cm', m: 'cm',
};

// Factor para convertir 1 unidad → unidad base
export const A_BASE = {
  g: 1, kg: 1000, oz: 28.3495, lb: 453.592, mg: 0.001,
  ml: 1, L: 1000, l: 1000,
  uni: 1, docena: 12,
  cm: 1, mt: 100, m: 100,
};

/** Normaliza alias de unidad (l → L). */
export function normU(u) {
  if (!u) return '';
  if (u === 'l') return 'L';
  if (u === 'unid') return 'uni';   // typo comun de 'uni' (datos reales en materiales)
  return u;
}

/** Obtiene la unidad base (familia) para una unidad dada, o null si desconocida. */
export function getUnidadBase(unidad) {
  const u = normU(unidad);
  return UNIDAD_BASE[u] || null;
}

/** true si ambas unidades pertenecen a la misma familia (peso/volumen/conteo/longitud). */
export function mismaFamilia(u1, u2) {
  const b1 = getUnidadBase(u1);
  const b2 = getUnidadBase(u2);
  if (!b1 || !b2) return false;
  return b1 === b2;
}

/**
 * Convierte un valor de una unidad a otra DENTRO de la misma familia.
 *
 * - Si alguna unidad falta / es vacía o ambas son iguales → devuelve el valor tal cual.
 * - Si pertenecen a la misma familia → convierte vía base (simétrico):
 *     valor * A_BASE[de] / A_BASE[a]
 * - Si pertenecen a familias DISTINTAS → NO inventa un número:
 *     devuelve { incompatible: true, valor: null }.
 *
 * Para mantener compatibilidad con los call-sites que esperan un número,
 * el resultado es un objeto con .valueOf() => devuelve el número convertido
 * (NaN si incompatible), pero se recomienda inspeccionar .incompatible.
 *
 * Firma simple recomendada: usar convertir(valor, de, a) que devuelve número
 * o NaN; y mismaFamilia() para decidir el aviso.
 */
export function convertirUnidad(valor, deUnidad, aUnidad) {
  const de = normU(deUnidad);
  const a = normU(aUnidad);
  const v = Number(valor) || 0;

  // Sin info suficiente o misma unidad: passthrough (no convierte)
  if (!de || !a || de === a) return v;

  // Familias distintas: NO inventar valor
  if (!mismaFamilia(de, a)) {
    return NaN;
  }

  const fDe = A_BASE[de];
  const fA = A_BASE[a];
  if (!fA) return v;
  return v * fDe / fA;
}

/**
 * Versión explícita: devuelve { valor, incompatible }.
 * valor es null cuando incompatible === true.
 */
export function convertirUnidadDetallado(valor, deUnidad, aUnidad) {
  const de = normU(deUnidad);
  const a = normU(aUnidad);
  const v = Number(valor) || 0;

  if (!de || !a || de === a) return { valor: v, incompatible: false };
  if (!mismaFamilia(de, a)) return { valor: null, incompatible: true };

  const fA = A_BASE[a];
  if (!fA) return { valor: v, incompatible: false };
  return { valor: v * A_BASE[de] / fA, incompatible: false };
}

/**
 * Devuelve las unidades compatibles (misma familia) con la unidad dada.
 * Si no se reconoce, devuelve un set por defecto razonable.
 */
export function getUnidadesCompatibles(unidad) {
  const base = getUnidadBase(unidad);
  if (!base) return ['g', 'kg', 'ml', 'L', 'uni', 'oz'];
  // Orden de presentación por familia (las más comunes primero)
  const PRESENTACION = {
    g: ['g', 'kg', 'oz', 'lb', 'mg'],
    ml: ['ml', 'L'],
    uni: ['uni', 'docena'],
    cm: ['cm', 'm'],
  };
  return PRESENTACION[base] || [normU(unidad)];
}
