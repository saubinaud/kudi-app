// @deprecated · HUÉRFANO (jul-2026) — no está ruteado ni enlazado.
// Su contenido (historial de cierres de caja del POS) se absorbió en el
// "Arqueo del día" (PLCashflowPage → tab Arqueo, bloque "Cierre de caja (POS)").
// Candidato a eliminar.
import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { cx } from '../styles/tokens';
import { formatCurrency, formatDate } from '../utils/format';
import { Wallet, ChevronDown, ChevronUp, Clock, DollarSign, CheckCircle } from 'lucide-react';

function timeAgo(date) {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleString('es-PE', { timeZone: 'America/Lima', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function formatHora(date) {
  if (!date) return '-';
  return new Date(date).toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' });
}

export default function ArqueoPage() {
  const api = useApi();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [detalle, setDetalle] = useState({});

  // Filters
  const now = new Date();
  const [desde, setDesde] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA', { timeZone: 'America/Lima' }));
  const [hasta, setHasta] = useState(now.toLocaleDateString('en-CA', { timeZone: 'America/Lima' }));

  const load = async () => {
    try {
      const r = await api.get(`/arqueo/historial?desde=${desde}&hasta=${hasta}`);
      setItems(r.data || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [desde, hasta]);

  const toggleExpand = async (id) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!detalle[id]) {
      try {
        const r = await api.get(`/arqueo/${id}`);
        setDetalle(prev => ({ ...prev, [id]: r.data || r }));
      } catch {}
    }
  };

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className={cx.skeleton + ' h-20'} />)}</div>;

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-stone-900">Historial de Caja</h1>
        <div className="flex items-center gap-2">
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className={cx.input + ' text-xs !py-1.5 !px-2 w-32'} />
          <span className="text-stone-400 text-xs">a</span>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className={cx.input + ' text-xs !py-1.5 !px-2 w-32'} />
        </div>
      </div>

      {items.length === 0 ? (
        <div className={cx.card + ' p-10 text-center'}>
          <Wallet size={32} className="text-stone-300 mx-auto mb-2" />
          <p className="text-stone-400 text-sm">No hay registros de caja en este período</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => {
            const isOpen = expandedId === item.id;
            const d = detalle[item.id];
            const difEf = parseFloat(item.diferencia_efectivo) || 0;
            const difTr = parseFloat(item.diferencia_transferencia) || 0;

            return (
              <div key={item.id} className={cx.card + ' overflow-hidden'}>
                <button onClick={() => toggleExpand(item.id)} className="w-full text-left p-4 hover:bg-stone-50 transition-colors duration-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.estado === 'abierto' ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                        {item.estado === 'abierto' ? <Clock size={14} className="text-amber-600" /> : <CheckCircle size={14} className="text-emerald-600" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-stone-800">{timeAgo(item.abierto_at)}</p>
                        <p className="text-[10px] text-stone-400">
                          {item.estado === 'cerrado' ? `Cerrado ${formatHora(item.cerrado_at)}` : 'Abierta'}
                          {item.usuario_nombre ? ` · ${item.usuario_nombre}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {item.estado === 'cerrado' && (
                        <div className="text-right">
                          <p className="text-sm font-semibold text-stone-800">{formatCurrency(item.ventas_total)}</p>
                          <p className="text-[10px] text-stone-400">{item.cantidad_ventas} ventas</p>
                        </div>
                      )}
                      {item.estado === 'cerrado' && (difEf !== 0 || difTr !== 0) && (
                        <div className="text-right">
                          {difEf !== 0 && <p className={`text-[10px] font-semibold ${difEf > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>Ef: {difEf > 0 ? '+' : ''}{formatCurrency(difEf)}</p>}
                          {difTr !== 0 && <p className={`text-[10px] font-semibold ${difTr > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>Tr: {difTr > 0 ? '+' : ''}{formatCurrency(difTr)}</p>}
                        </div>
                      )}
                      {isOpen ? <ChevronUp size={14} className="text-stone-400" /> : <ChevronDown size={14} className="text-stone-400" />}
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-stone-100 bg-stone-50/30 p-4 space-y-4">
                    {/* Detalle cuadre */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className={cx.card + ' p-3'}>
                        <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold mb-2">Efectivo</p>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between"><span className="text-stone-500">Apertura</span><span className="text-stone-800">{formatCurrency(item.monto_apertura)}</span></div>
                          <div className="flex justify-between"><span className="text-stone-500">Ventas</span><span className="text-stone-800">{formatCurrency(item.ventas_efectivo)}</span></div>
                          <div className="flex justify-between border-t border-stone-200 pt-1"><span className="text-stone-500">Sistema</span><span className="text-stone-800 font-semibold">{formatCurrency(parseFloat(item.monto_apertura) + parseFloat(item.ventas_efectivo))}</span></div>
                          {item.cierre_efectivo_real != null && <div className="flex justify-between"><span className="text-stone-500">Real</span><span className="text-stone-800 font-semibold">{formatCurrency(item.cierre_efectivo_real)}</span></div>}
                          {difEf !== 0 && <div className="flex justify-between"><span className="text-stone-500">Diferencia</span><span className={`font-semibold ${difEf > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{difEf > 0 ? '+' : ''}{formatCurrency(difEf)}</span></div>}
                        </div>
                      </div>
                      <div className={cx.card + ' p-3'}>
                        <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold mb-2">Transferencias</p>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between"><span className="text-stone-500">Ventas</span><span className="text-stone-800">{formatCurrency(item.ventas_transferencia)}</span></div>
                          {item.cierre_transferencia_real != null && <div className="flex justify-between"><span className="text-stone-500">Real</span><span className="text-stone-800 font-semibold">{formatCurrency(item.cierre_transferencia_real)}</span></div>}
                          {difTr !== 0 && <div className="flex justify-between"><span className="text-stone-500">Diferencia</span><span className={`font-semibold ${difTr > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{difTr > 0 ? '+' : ''}{formatCurrency(difTr)}</span></div>}
                        </div>
                      </div>
                    </div>

                    {item.nota_cierre && (
                      <p className="text-xs text-stone-500 bg-stone-100 rounded-lg px-3 py-2">Nota: {item.nota_cierre}</p>
                    )}
                    {item.justificacion && (
                      <p className="text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2">Justificación: {item.justificacion}</p>
                    )}

                    {/* Ventas del turno */}
                    {d?.ventas && d.ventas.length > 0 && (
                      <div>
                        <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold mb-2">Ventas del turno ({d.ventas.length})</p>
                        <div className="space-y-1">
                          {d.ventas.map(v => (
                            <div key={v.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 text-xs">
                              <div>
                                <span className="text-stone-800 font-medium">{v.codigo_pedido || `#${v.id}`}</span>
                                <span className="text-stone-400 ml-2">{formatHora(v.created_at)}</span>
                                <span className="text-stone-400 ml-2">{v.cliente}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={cx.badge(v.metodo_pago === 'efectivo' ? 'bg-emerald-50 text-emerald-600' : 'bg-sky-50 text-sky-600')}>{v.metodo_pago}</span>
                                <span className="text-stone-800 font-semibold">{formatCurrency(v.total)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
