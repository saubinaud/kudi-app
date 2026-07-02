import { useState, useMemo } from 'react';
import { cx } from '../styles/tokens';
import { formatCurrency } from '../utils/format';
import Tooltip from './Tooltip';
import { X } from 'lucide-react';

/**
 * PagoSheet — momento de pago COMPARTIDO entre POS y Mesas (fuente unica).
 *
 * Encapsula TODO lo del cobro: toggle Con/Sin IGV, metodo de pago, dividir
 * cuenta (mixto rico: marcar cobrado, distribuir, comision por parte), comision
 * tarjeta, calculadora de vuelto, desglose base/IGV/total y boton confirmar.
 *
 * Lo especifico de cada pantalla (POS: delivery/canal/cliente; Mesas: precuenta)
 * NO vive aqui — el contenido extra se pasa via `children` y se renderiza entre
 * los controles de pago y el desglose de totales.
 *
 * `conIgv` lo controla el PADRE porque los montos (base/igv) dependen de el.
 *
 * onConfirm recibe: { conIgv, metodoPago, pagoDetalle, comisionTarjeta }
 */
export default function PagoSheet({
  conIgv,
  setConIgv,
  tasaIgv = 0,
  precioMode = 'variable',
  base = 0,
  igv = 0,
  descuentos = 0,
  extras = [],            // [{ label, monto }] — ej. envio. Suma al total, no a la comision.
  comisionPosPct = 0,
  metodosPago = [],
  confirmLabel = 'Confirmar',
  confirming = false,
  onConfirm,
  children,
}) {
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [sinComisionTarjeta, setSinComisionTarjeta] = useState(false);
  const [pagoMixto, setPagoMixto] = useState(false);
  const [pagoPartes, setPagoPartes] = useState([
    { metodo: 'efectivo', monto: '', pagada: false, sinComision: false },
    { metodo: 'efectivo', monto: '', pagada: false, sinComision: false },
  ]);
  const [pagaCon, setPagaCon] = useState('');

  const subtotalCargo = Math.round((base + igv) * 100) / 100;       // lo cobrado (con o sin IGV)
  const extrasSum = extras.reduce((s, e) => s + (parseFloat(e.monto) || 0), 0);
  const targetTotal = Math.round((subtotalCargo + extrasSum) * 100) / 100; // total sin comision

  const comisionTarjeta = useMemo(() => {
    if (comisionPosPct === 0) return 0;
    if (pagoMixto) {
      return pagoPartes.reduce((s, p) =>
        p.metodo === 'tarjeta' && !p.sinComision
          ? s + Math.round((parseFloat(p.monto) || 0) * comisionPosPct) / 100
          : s, 0);
    }
    return (metodoPago === 'tarjeta' && !sinComisionTarjeta)
      ? Math.round(subtotalCargo * comisionPosPct) / 100
      : 0;
  }, [pagoMixto, pagoPartes, metodoPago, sinComisionTarjeta, subtotalCargo, comisionPosPct]);

  const total = Math.round((targetTotal + comisionTarjeta) * 100) / 100;

  // Mixto bloquea Confirmar hasta que TODAS las partes estén pagadas Y sumen el total
  // exacto (mismo criterio que el badge "Cuenta completa" de abajo). Antes solo se exigía
  // marcar como pagadas las partes ingresadas: se podía cobrar la mitad y confirmar.
  const sumPartesMixto = pagoMixto ? pagoPartes.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0) : 0;
  const mixtoIncompleto = pagoMixto && (
    pagoPartes.some(p => (parseFloat(p.monto) || 0) > 0 && !p.pagada)
    || Math.abs(Math.round((targetTotal - sumPartesMixto) * 100) / 100) >= 0.01
  );
  const tasaPct = parseFloat((tasaIgv * 100).toFixed(1));

  const handleConfirm = () => {
    let metodoPagoFinal = metodoPago;
    let pagoDetalle = null;
    if (pagoMixto) {
      const partes = pagoPartes.filter(p => parseFloat(p.monto) > 0);
      if (partes.length > 0) {
        metodoPagoFinal = 'mixto';
        pagoDetalle = partes.map(p => {
          const monto = parseFloat(p.monto);
          const comision = (p.metodo === 'tarjeta' && !p.sinComision) ? Math.round(monto * comisionPosPct) / 100 : 0;
          return { metodo: p.metodo, monto, comision_tarjeta: comision };
        });
      }
    }
    onConfirm({ conIgv, metodoPago: metodoPagoFinal, pagoDetalle, comisionTarjeta });
  };

  return (
    <div className="space-y-4">
      {/* Toggle IGV */}
      <div className="flex items-center justify-center gap-1">
        <button
          onClick={() => setConIgv(true)}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-l-lg transition-colors duration-100 ${conIgv ? 'bg-[#16A34A] text-white' : 'bg-stone-100 text-stone-400 hover:bg-stone-200'}`}
        >
          Con IGV
        </button>
        <button
          onClick={() => setConIgv(false)}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-r-lg transition-colors duration-100 ${!conIgv ? 'bg-[#0A2F24] text-white' : 'bg-stone-100 text-stone-400 hover:bg-stone-200'}`}
        >
          Sin IGV
        </button>
      </div>

      {/* Metodo de pago — oculto en pago mixto */}
      {!pagoMixto && (
        <div>
          <label className="text-xs text-stone-500 font-medium block mb-2">Método de pago</label>
          <div className={`grid gap-1.5 ${metodosPago.length > 3 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {metodosPago.map(m => (
              <button
                key={m.key}
                onClick={() => { setMetodoPago(m.key); if (m.key !== 'tarjeta') setSinComisionTarjeta(false); }}
                className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg border text-xs font-medium transition-colors duration-100 ${
                  metodoPago === m.key
                    ? 'border-[#16A34A] bg-emerald-50 text-[#16A34A]'
                    : 'border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50'
                }`}
              >
                <m.icon size={16} />
                {m.label}
              </button>
            ))}
          </div>
          {metodoPago === 'tarjeta' && (
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input type="checkbox" checked={sinComisionTarjeta} onChange={e => setSinComisionTarjeta(e.target.checked)} className="w-3.5 h-3.5 rounded" />
              <span className="text-[11px] text-stone-500">No cobrar comisión adicional</span>
            </label>
          )}
        </div>
      )}

      {/* Dividir cuenta */}
      <button
        onClick={() => {
          if (!pagoMixto) {
            const montoIngresado = parseFloat(pagaCon) || 0;
            const monto1 = montoIngresado > 0 ? Math.min(montoIngresado, targetTotal) : '';
            const restante = monto1 !== '' ? Math.round((targetTotal - monto1) * 100) / 100 : '';
            setPagoPartes([
              { metodo: metodoPago, monto: monto1 !== '' ? String(monto1) : '', pagada: false, sinComision: false },
              { metodo: 'efectivo', monto: restante > 0 ? String(restante) : '', pagada: false, sinComision: false },
            ]);
          }
          setPagoMixto(!pagoMixto);
        }}
        className={`w-full py-2.5 rounded-lg border text-xs font-semibold transition-colors duration-100 ${
          pagoMixto
            ? 'border-rose-300 bg-rose-50 text-rose-600 hover:bg-rose-100'
            : 'border-dashed border-stone-300 text-stone-400 hover:border-stone-400 hover:text-stone-600'
        }`}
      >
        {pagoMixto ? 'Cancelar división' : 'Dividir cuenta'}
      </button>

      {/* Subcuentas mixto */}
      {pagoMixto && (
        <div className="space-y-3">
          {pagoPartes.map((p, idx) => {
            const esTarjeta = p.metodo === 'tarjeta';
            const montoBase = parseFloat(p.monto) || 0;
            const comisionSub = (esTarjeta && !p.sinComision) ? Math.round(montoBase * comisionPosPct) / 100 : 0;
            return (
              <div key={idx} className={`rounded-xl p-3 space-y-2 transition-colors duration-100 ${p.pagada ? 'bg-emerald-50/50 border border-emerald-200' : 'bg-stone-50'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Subcuenta {idx + 1}</span>
                  {pagoPartes.length > 2 && !p.pagada && (
                    <button onClick={() => setPagoPartes(pagoPartes.filter((_, i) => i !== idx))} className="text-stone-300 hover:text-rose-500 transition-colors"><X size={13} /></button>
                  )}
                </div>
                <div className={`grid grid-cols-4 gap-1 ${p.pagada ? 'opacity-50 pointer-events-none' : ''}`}>
                  {metodosPago.map(m => (
                    <button key={m.key}
                      disabled={p.pagada}
                      onClick={() => { const next = [...pagoPartes]; next[idx] = { ...next[idx], metodo: m.key }; setPagoPartes(next); }}
                      className={`flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg border text-[10px] font-medium transition-colors duration-100 ${
                        p.metodo === m.key
                          ? 'border-[#16A34A] bg-emerald-50 text-[#16A34A]'
                          : 'border-stone-200 text-stone-400 hover:border-stone-300'
                      }`}>
                      <m.icon size={13} />
                      {m.key === 'tarjeta' ? 'Tarj.' : m.label}
                    </button>
                  ))}
                </div>
                {esTarjeta && (
                  <label className={`flex items-center gap-1.5 ${p.pagada ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
                    <input type="checkbox" checked={p.sinComision || false} disabled={p.pagada}
                      onChange={e => { const next = [...pagoPartes]; next[idx] = { ...next[idx], sinComision: e.target.checked }; setPagoPartes(next); }}
                      className="w-3 h-3 rounded" />
                    <span className="text-[10px] text-stone-500">No cobrar comisión</span>
                  </label>
                )}
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-400">S/</span>
                  <input type="number" step="1" min="0" value={p.monto} disabled={p.pagada}
                    onChange={e => { const next = [...pagoPartes]; next[idx] = { ...next[idx], monto: e.target.value }; setPagoPartes(next); }}
                    className={`w-full text-sm border border-stone-200 rounded-lg pl-8 pr-2 py-2 text-right font-semibold focus:outline-none focus:border-stone-400 ${p.pagada ? 'bg-stone-100 text-stone-400' : ''}`}
                    placeholder="0.00" />
                </div>
                {montoBase > 0 && (
                  <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-stone-200">
                    <div>
                      {esTarjeta && comisionSub > 0 && (
                        <p className="text-[10px] text-amber-600">+{formatCurrency(comisionSub)} comisión {comisionPosPct}%</p>
                      )}
                      <p className="text-xs font-bold text-stone-800">Cobrar: {formatCurrency(montoBase + comisionSub)}</p>
                    </div>
                    <button
                      onClick={() => { const next = [...pagoPartes]; next[idx] = { ...next[idx], pagada: !next[idx].pagada }; setPagoPartes(next); }}
                      className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors duration-100 ${
                        p.pagada
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                          : 'bg-stone-200 text-stone-500 hover:bg-stone-300'
                      }`}
                    >
                      {p.pagada ? '✓ Cobrado' : 'Marcar cobrado'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          <button onClick={() => {
            const sumExistente = pagoPartes.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0);
            const restante = Math.round((targetTotal - sumExistente) * 100) / 100;
            setPagoPartes([...pagoPartes, { metodo: 'efectivo', monto: restante > 0 ? String(restante) : '', pagada: false, sinComision: false }]);
          }}
            className="w-full py-1.5 border border-dashed border-stone-300 rounded-lg text-xs text-stone-400 hover:border-stone-400 hover:text-stone-600 transition-colors">
            + Agregar subcuenta
          </button>
          {(() => {
            const totalPartes = pagoPartes.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0);
            const diff = Math.round((targetTotal - totalPartes) * 100) / 100;
            const isComplete = Math.abs(diff) < 0.01;
            return (
              <div className="space-y-1.5">
                <div className={`text-center py-1.5 rounded-lg text-xs font-bold ${
                  diff > 0.01 ? 'bg-amber-50 text-amber-600' : diff < -0.01 ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                }`}>
                  {diff > 0.01 ? `Falta: ${formatCurrency(diff)}` : diff < -0.01 ? `Sobra: ${formatCurrency(Math.abs(diff))}` : 'Cuenta completa'}
                </div>
                {!isComplete && (
                  <button
                    onClick={() => {
                      const next = [...pagoPartes];
                      const sumCobradas = next.reduce((s, p) => p.pagada ? s + (parseFloat(p.monto) || 0) : s, 0);
                      const restanteParaPendientes = Math.round((targetTotal - sumCobradas) * 100) / 100;
                      if (restanteParaPendientes <= 0) {
                        for (let i = 0; i < next.length; i++) {
                          if (!next[i].pagada) next[i] = { ...next[i], monto: '0' };
                        }
                      } else {
                        const pendientes = next.map((p, i) => ({ idx: i, monto: parseFloat(p.monto) || 0 })).filter((_, i) => !next[i].pagada);
                        if (pendientes.length === 0) { setPagoPartes(next); return; }
                        const lastPendIdx = pendientes[pendientes.length - 1].idx;
                        const sumPendFijas = pendientes.reduce((s, p) => p.idx !== lastPendIdx ? s + p.monto : s, 0);
                        const ajuste = Math.round((restanteParaPendientes - sumPendFijas) * 100) / 100;
                        next[lastPendIdx] = { ...next[lastPendIdx], monto: ajuste > 0 ? String(ajuste) : '0' };
                      }
                      setPagoPartes(next);
                    }}
                    className="w-full py-1.5 rounded-lg text-xs font-semibold bg-stone-800 text-white hover:bg-stone-700 transition-colors"
                  >
                    Distribuir correctamente
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      )}

      <hr className="border-stone-100" />

      {/* Calculadora de vuelto (solo efectivo, no mixto) */}
      {metodoPago === 'efectivo' && !pagoMixto && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-500 whitespace-nowrap">Paga con:</span>
          <input type="number" step="0.01" min="0" value={pagaCon} onChange={e => setPagaCon(e.target.value)}
            className={cx.input + ' flex-1 text-right text-sm font-semibold'} placeholder={formatCurrency(total)} />
          {pagaCon && (() => {
            const vuelto = parseFloat(pagaCon) - total;
            return vuelto >= 0
              ? <span className="text-xs font-bold text-emerald-600 whitespace-nowrap">Vuelto: {formatCurrency(vuelto)}</span>
              : <span className="text-xs font-bold text-rose-500 whitespace-nowrap">Falta: {formatCurrency(Math.abs(vuelto))}</span>;
          })()}
        </div>
      )}

      {/* Contenido especifico de la pantalla (POS: delivery/cliente) */}
      {children}

      {/* Desglose tipo boleta + confirmar */}
      <div className="bg-stone-50 rounded-xl p-4 -mx-1">
        <div className="space-y-1 mb-2">
          <div className="flex justify-between text-xs">
            <span className="text-stone-400">Subtotal</span>
            <span className="text-stone-600">{formatCurrency(base)}</span>
          </div>
          {descuentos > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-stone-400">Descuentos</span>
              <span className="text-rose-500">-{formatCurrency(descuentos)}</span>
            </div>
          )}
          {igv > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-stone-400">IGV ({tasaPct}%)</span>
              <span className="text-stone-600">{formatCurrency(igv)}</span>
            </div>
          )}
          {extras.filter(e => (parseFloat(e.monto) || 0) > 0).map((e, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-stone-400">{e.label}</span>
              <span className="text-stone-600">{formatCurrency(parseFloat(e.monto) || 0)}</span>
            </div>
          ))}
          {comisionTarjeta > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-stone-400">Comisión tarjeta ({comisionPosPct}%)</span>
              <span className="text-stone-600">+{formatCurrency(comisionTarjeta)}</span>
            </div>
          )}
        </div>
        <div className="flex justify-between items-baseline mb-3 pt-1 border-t border-stone-200">
          <span className="text-stone-500 text-sm flex items-center gap-1.5">
            Total a cobrar
            {conIgv && precioMode !== 'exacto' && (
              <Tooltip
                delay={200}
                wide
                text="El precio se redondea a S/0.10 para facilitar el cobro (no hay monedas de 1-9 centimos). Por eso S/21.24 se cobra S/21.30. Configurable en tu perfil."
              >
                <span className="w-4 h-4 rounded-full bg-stone-200 text-stone-500 text-[10px] font-bold flex items-center justify-center cursor-help">?</span>
              </Tooltip>
            )}
          </span>
          <span className="text-2xl font-bold text-[#0A2F24]">{formatCurrency(total)}</span>
        </div>
        <button
          onClick={handleConfirm}
          disabled={confirming || mixtoIncompleto}
          className={`w-full py-3.5 text-sm font-semibold rounded-xl transition-colors duration-100 ${
            mixtoIncompleto ? 'bg-stone-300 text-stone-500 cursor-not-allowed' : cx.btnPrimary
          }`}
        >
          {confirming ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Procesando...
            </span>
          ) : confirmLabel}
        </button>
      </div>
    </div>
  );
}
