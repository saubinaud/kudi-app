import { useState, useEffect } from 'react';
import { cx } from '../styles/tokens';
import { formatCurrency } from '../utils/format';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import PeriodoSelector from '../components/PeriodoSelector';

export default function AnalisisPage() {
  const api = useApi();
  const toast = useToast();

  const [ventasHora, setVentasHora] = useState([]);
  const [periodo, setPeriodo] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });

  useEffect(() => {
    api.get(`/analisis/ventas-hora?year=${periodo.year}&month=${periodo.month}`)
      .then(r => setVentasHora(r.data || []))
      .catch(() => toast.error('Error cargando análisis'));
  }, [periodo]); // eslint-disable-line

  const maxTotal = Math.max(...ventasHora.map(h => h.total), 1);
  const pico = ventasHora.reduce((a, b) => (b.total > (a?.total || 0) ? b : a), null);
  const totalVentas = ventasHora.reduce((s, h) => s + h.ventas, 0);
  const totalMonto = ventasHora.reduce((s, h) => s + h.total, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-stone-800">Análisis</h1>
        <PeriodoSelector value={periodo} onChange={setPeriodo} />
      </div>

      {ventasHora.length === 0 ? (
        <div className={`${cx.card} p-12 text-center`}>
          <p className="text-sm text-stone-500">Sin ventas en este período.</p>
        </div>
      ) : (
        <div className={`${cx.card} p-5`}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-bold text-stone-800">Ventas por hora</h2>
              <p className="text-xs text-stone-400 mt-0.5">{totalVentas} ventas · {formatCurrency(totalMonto)} en el período (hora de Lima)</p>
            </div>
            {pico && <span className="text-xs text-stone-500">Hora pico: <strong className="text-[var(--accent)]">{String(pico.hora).padStart(2, '0')}:00</strong> · {formatCurrency(pico.total)}</span>}
          </div>
          <div className="flex items-end gap-1.5 h-48">
            {ventasHora.map(h => (
              <div key={h.hora} className="flex-1 flex flex-col items-center gap-1 justify-end group">
                <span className="text-[9px] text-stone-500 opacity-0 group-hover:opacity-100 whitespace-nowrap">{formatCurrency(h.total)}</span>
                <div
                  className={`w-full rounded-t ${pico && h.hora === pico.hora ? 'bg-[var(--accent)]' : 'bg-teal-300'}`}
                  style={{ height: `${Math.max(4, (h.total / maxTotal) * 100)}%` }}
                  title={`${String(h.hora).padStart(2, '0')}:00 · ${h.ventas} ventas · ${formatCurrency(h.total)}`}
                />
                <span className="text-[9px] text-stone-400">{String(h.hora).padStart(2, '0')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
