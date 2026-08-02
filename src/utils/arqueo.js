// Helpers de arqueo — fuente única para interpretar los cierres de caja.
//
// Un cierre se considera "sin contar" si:
//  - el conteo real es NULL (flujo nuevo: se cerró sin ingresar el efectivo), o
//  - es el patrón viejo (cierre_real = 0 y la "diferencia" es exactamente
//    −(apertura + ventas) → el sistema restó contra 0 y marcó un faltante fantasma).
// Así los faltantes irreales se muestran como "sin contar" en vez de faltante,
// sin depender de un backfill de datos.

export function noContadoEf(cc) {
  const apert = Number(cc.monto_apertura) || 0;
  const vEf = Number(cc.ventas_efectivo) || 0;
  return cc.cierre_efectivo_real == null ||
    (Number(cc.cierre_efectivo_real) === 0 && Math.abs(Number(cc.diferencia_efectivo) + (apert + vEf)) < 0.01);
}

export function noContadoTr(cc) {
  const vTr = Number(cc.ventas_transferencia) || 0;
  return cc.cierre_transferencia_real == null ||
    (Number(cc.cierre_transferencia_real) === 0 && Math.abs(Number(cc.diferencia_transferencia) + vTr) < 0.01);
}
