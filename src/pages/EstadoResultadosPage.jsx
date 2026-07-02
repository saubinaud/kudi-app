import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useApi } from '../hooks/useApi';
import { cx } from '../styles/tokens';
import { formatCurrency } from '../utils/format';
import PeriodoSelector from '../components/PeriodoSelector';
import InfoTip from '../components/InfoTip';

// Estado de Resultados (rediseño CFO) — cascada gastronómica NETA DE IGV.
// Consume /api/pl/estado-resultados (endpoint nuevo, paralelo a /pl/resumen).
export default function EstadoResultadosPage() {
  const api = useApi();
  const [periodos, setPeriodos] = useState([]);
  const [periodo, setPeriodo] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.get('/pl/periodos').then((r) => setPeriodos(r.data || [])).catch(() => {}); }, []);

  useEffect(() => {
    if (!periodo?.year || !periodo?.month) return;
    setLoading(true);
    api.get(`/pl/estado-resultados?year=${periodo.year}&month=${periodo.month}`)
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [periodo]);

  return (
    <div className="max-w-3xl mx-auto lg:px-10 lg:py-6 px-4 py-4">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-stone-800 flex items-center gap-2">
          Estado de resultados
          <InfoTip wide text="Tu P&L gastronómico, todo NETO de IGV (el IGV no es ganancia ni costo, es un traslado a SUNAT). Costo de ventas en 4 bloques, y la cascada hasta tu utilidad neta real." />
        </h1>
        <PeriodoSelector periodos={periodos} value={periodo} onChange={setPeriodo} />
      </div>

      {loading ? (
        <div className={cx.skeleton + ' h-96'} />
      ) : !data ? (
        <div className="text-center py-16 text-stone-400 text-sm">Sin datos para este período.</div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className={cx.card + ' overflow-hidden'}>
          {/* 1 · INGRESOS (desglose por carta — dimensión independiente del canal) */}
          <Section title="Ingresos por carta" />
          {data.ingresos.por_carta.map((c) => (
            <Row key={c.carta_id ?? 'sin-carta'} label={c.nombre} amount={c.neto} indent />
          ))}
          {data.ingresos.descuentos > 0 && <Row label="(−) Descuentos" amount={-data.ingresos.descuentos} indent muted />}
          <Subtotal label="Ventas netas" amount={data.ingresos.ventas_netas} />

          {/* 2 · COSTO DE VENTAS */}
          <Section title="Costo de ventas" note={`${data.margenes.bruto_pct}% margen bruto`} />
          <Row label="A · Food cost (insumos + empaques)" amount={-data.costo_ventas.food_cost} indent />
          <Row
            label="B · Conversión (MO + CIF)"
            amount={-data.costo_ventas.conversion}
            indent
            sub={`MO ${formatCurrency(data.costo_ventas.conversion_detalle.mo)} · CIF ${formatCurrency(data.costo_ventas.conversion_detalle.cif_total)}`}
          />
          <Row label="C · Mercadería (reventa)" amount={-data.costo_ventas.mercaderia} indent />
          <Row label="D · Mermas y desmedros" amount={-data.costo_ventas.mermas} indent />
          <Subtotal label="Utilidad bruta" amount={data.utilidad_bruta} strong />

          {/* 3 · GASTOS */}
          <Section title="Gastos de operación / venta" />
          <Row label="Gastos de operación" amount={-data.gastos.operacion} indent
            sub={`Comisiones ${formatCurrency(data.gastos.operacion_detalle.comisiones)} · Planilla atención ${formatCurrency(data.gastos.operacion_detalle.planilla_operativa)}`} />
          <Section title="Gastos de administración" />
          <Row label="Gastos de administración" amount={-data.gastos.administracion} indent
            sub={`Planilla admin ${formatCurrency(data.gastos.administracion_detalle.planilla_administrativa)}`} />
          <Subtotal label="EBITDA" amount={data.ebitda} note={`${data.margenes.ebitda_pct}%`} strong />

          {/* 4 · D&A → EBIT */}
          <Row label="(−) Depreciación y amortización admin." amount={-data.depreciacion_amortizacion} indent muted />
          <Subtotal label="Utilidad operativa (EBIT)" amount={data.ebit} note={`${data.margenes.ebit_pct}%`} strong />

          {/* 5 · Financiero → UAI */}
          <Row label="(−) Gastos financieros" amount={-data.gasto_financiero} indent muted />
          <Subtotal label="Utilidad antes de impuestos" amount={data.uai} />

          {/* 6 · IR → NETA */}
          <Row label="(−) Impuesto a la Renta" amount={-data.impuesto_renta} indent muted />
          <div className="px-4 sm:px-6 py-4 border-t-2 border-stone-200 bg-stone-50/60 flex items-center justify-between">
            <span className="text-base font-bold text-stone-800 flex items-center gap-2">
              Utilidad neta
              {data.impuesto_renta === 0 && <InfoTip wide text="El Impuesto a la Renta no se calcula solo: regístralo desde Pagos con una categoría clasificada como 'Impuesto a la Renta', con el monto que declares." />}
            </span>
            <span className={`text-lg font-bold tabular-nums ${data.utilidad_neta >= 0 ? 'text-stone-900' : 'text-rose-600'}`}>
              {formatCurrency(data.utilidad_neta)}
              <span className="text-xs text-stone-500 ml-2 font-medium">({data.margenes.neto_pct}%)</span>
            </span>
          </div>
        </motion.div>
      )}

      <p className="text-[12px] text-stone-400 mt-3 text-center">Todas las cifras son netas de IGV. Vista nueva — en validación junto al CFO.</p>
    </div>
  );
}

function Section({ title, note }) {
  return (
    <div className="px-4 sm:px-6 pt-4 pb-1.5 flex items-center justify-between border-t border-stone-100 first:border-t-0">
      <span className={cx.label}>{title}</span>
      {note && <span className="text-[11px] text-stone-400 font-medium">{note}</span>}
    </div>
  );
}

function Row({ label, amount, indent, muted, sub, note }) {
  return (
    <div className={`px-4 sm:px-6 py-1.5 flex items-start justify-between ${indent ? 'pl-7 sm:pl-9' : ''}`}>
      <div className="min-w-0">
        <span className={`text-sm ${muted ? 'text-stone-500' : 'text-stone-700'}`}>{label}</span>
        {sub && <div className="text-[11px] text-stone-400">{sub}</div>}
      </div>
      <span className={`text-sm tabular-nums shrink-0 ml-3 ${amount < 0 ? 'text-stone-500' : 'text-stone-800'}`}>{formatCurrency(amount)}</span>
    </div>
  );
}

function Subtotal({ label, amount, note, strong }) {
  return (
    <div className="px-4 sm:px-6 py-2.5 border-t border-stone-200 bg-stone-50/40 flex items-center justify-between">
      <span className={`${strong ? 'text-sm font-bold text-stone-800' : 'text-sm font-semibold text-stone-700'}`}>{label}</span>
      <span className="flex items-baseline gap-2">
        {note && <span className="text-[11px] text-stone-400 font-medium">{note}</span>}
        <span className={`tabular-nums ${strong ? 'text-base font-bold' : 'text-sm font-semibold'} ${amount < 0 ? 'text-rose-600' : 'text-stone-900'}`}>{formatCurrency(amount)}</span>
      </span>
    </div>
  );
}
