import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { cx } from '../styles/tokens';
import { formatCurrency } from '../utils/format';
import CustomSelect from '../components/CustomSelect';
import { TrendingUp, AlertTriangle, CheckCircle, Target, Zap, Package, Settings, ChevronRight, Search } from 'lucide-react';

const SEMAFORO_COLORS = {
  optimo: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Óptimo' },
  moderado: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Moderado' },
  minimo: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500', label: 'Mínimo' },
  bajo: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500', label: 'Bajo' },
  sin_categoria: { bg: 'bg-stone-50', text: 'text-stone-500', dot: 'bg-stone-300', label: 'Sin categoría' },
};

export default function MargenesPage() {
  const api = useApi();
  const toast = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [categorizando, setCategorizando] = useState(false);
  const [filtro, setFiltro] = useState('todos'); // todos, bajo, minimo, moderado, optimo, sin_categoria
  const [search, setSearch] = useState('');
  const [showConfig, setShowConfig] = useState(false);

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/margenes/dashboard');
      setData(res?.data || res);
    } catch {
      toast.error('Error cargando márgenes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboard(); }, []); // eslint-disable-line

  const handleAutoCategorizar = async () => {
    setCategorizando(true);
    try {
      const res = await api.post('/margenes/auto-categorizar');
      const d = res?.data || res;
      toast.success(`${d.applied} productos categorizados de ${d.total}`);
      fetchDashboard();
    } catch {
      toast.error('Error auto-categorizando');
    } finally {
      setCategorizando(false);
    }
  };

  const handleChangeCategoria = async (productoId, categoriaId) => {
    try {
      await api.put(`/margenes/producto/${productoId}`, { categoria_margen_id: categoriaId || null });
      fetchDashboard();
    } catch {
      toast.error('Error actualizando categoría');
    }
  };

  const productosFiltrados = useMemo(() => {
    if (!data?.productos) return [];
    let list = data.productos;
    if (filtro !== 'todos') list = list.filter(p => p.semaforo === filtro);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => p.nombre.toLowerCase().includes(q));
    }
    return list;
  }, [data, filtro, search]);

  const catOptions = useMemo(() => {
    if (!data?.categorias) return [];
    return [
      { value: null, label: 'Sin categoría' },
      ...data.categorias.map(c => ({ value: c.id, label: c.nombre })),
    ];
  }, [data]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className={cx.skeleton + ' h-8 w-48 mb-6'} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[1,2,3,4].map(i => <div key={i} className={cx.skeleton + ' h-24 rounded-xl'} />)}
        </div>
        <div className={cx.skeleton + ' h-96 rounded-xl'} />
      </div>
    );
  }

  const stats = data?.stats || {};

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-stone-800">Márgenes</h1>
          <p className="text-xs text-stone-400 mt-0.5">Rentabilidad de tus productos por categoría</p>
        </div>
        <div className="flex gap-2">
          {stats.sinCategoria > 0 && (
            <button
              onClick={handleAutoCategorizar}
              disabled={categorizando}
              className={cx.btnSecondary + ' flex items-center gap-2'}
            >
              {categorizando ? (
                <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
              ) : (
                <Zap size={16} />
              )}
              Auto-categorizar ({stats.sinCategoria})
            </button>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}
          className={cx.card + ' p-4 cursor-pointer' + (filtro === 'todos' ? ' ring-2 ring-stone-400' : '')}
          onClick={() => setFiltro('todos')}>
          <div className="flex items-center gap-2 mb-1">
            <Package size={14} className="text-stone-500" />
            <span className="text-xs text-stone-500">Total</span>
          </div>
          <p className="text-2xl font-bold text-stone-800">{stats.total}</p>
        </motion.div>

        {[
          { key: 'optimo', icon: CheckCircle, count: stats.optimos, color: 'emerald' },
          { key: 'moderado', icon: Target, count: stats.moderados, color: 'amber' },
          { key: 'bajo', icon: AlertTriangle, count: stats.bajos + (stats.minimos || 0), color: 'rose' },
          { key: 'sin_categoria', icon: Search, count: stats.sinCategoria, color: 'stone' },
        ].map((s, i) => (
          <motion.div key={s.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * (i + 1) }}
            className={cx.card + ' p-4 cursor-pointer' + (filtro === s.key ? ` ring-2 ring-${s.color}-400` : '')}
            onClick={() => setFiltro(filtro === s.key ? 'todos' : s.key)}>
            <div className="flex items-center gap-2 mb-1">
              <s.icon size={14} className={`text-${s.color}-500`} />
              <span className="text-xs text-stone-500">{SEMAFORO_COLORS[s.key]?.label || s.key}</span>
            </div>
            <p className={`text-2xl font-bold text-${s.color}-700`}>{s.count || 0}</p>
          </motion.div>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={cx.input + ' text-sm max-w-sm'}
          placeholder="Buscar producto..."
        />
      </div>

      {/* Products list */}
      <div className={cx.card + ' overflow-hidden'}>
        {/* Table header */}
        <div className="grid grid-cols-[1fr_140px_80px_80px_80px_40px] gap-2 px-4 py-2.5 bg-stone-50 border-b border-stone-100">
          <span className={cx.th}>Producto</span>
          <span className={cx.th}>Categoría</span>
          <span className={cx.th + ' text-right'}>Costo</span>
          <span className={cx.th + ' text-right'}>Precio</span>
          <span className={cx.th + ' text-right'}>Margen</span>
          <span className={cx.th} />
        </div>

        {productosFiltrados.length === 0 ? (
          <div className="py-12 text-center">
            <Package size={28} className="text-stone-300 mx-auto mb-2" />
            <p className="text-stone-400 text-sm">{search ? 'Sin resultados' : 'No hay productos en este filtro'}</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {productosFiltrados.map(p => {
              const sem = SEMAFORO_COLORS[p.semaforo] || SEMAFORO_COLORS.sin_categoria;
              return (
                <div key={p.id} className="grid grid-cols-[1fr_140px_80px_80px_80px_40px] gap-2 items-center px-4 py-2.5 hover:bg-stone-50/50">
                  {/* Name */}
                  <div className="flex items-center gap-2 min-w-0">
                    {p.imagen_url ? (
                      <img src={p.imagen_url} className="w-7 h-7 rounded-lg object-cover flex-shrink-0" alt="" />
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-stone-100 flex items-center justify-center flex-shrink-0">
                        <Package size={12} className="text-stone-300" />
                      </div>
                    )}
                    <span className="text-sm font-medium text-stone-800 truncate">{p.nombre}</span>
                  </div>

                  {/* Category selector */}
                  <CustomSelect
                    options={catOptions}
                    value={p.categoria_margen_id}
                    onChange={(val) => handleChangeCategoria(p.id, val)}
                    placeholder="Categoría"
                    compact
                  />

                  {/* Cost */}
                  <span className="text-xs text-stone-500 text-right">{formatCurrency(p.costo_neto)}</span>

                  {/* Price */}
                  <span className="text-xs text-stone-800 font-medium text-right">{formatCurrency(p.precio_final)}</span>

                  {/* Margin with semaphore */}
                  <div className="flex items-center justify-end gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${sem.dot}`} />
                    <span className={`text-xs font-semibold ${sem.text}`}>
                      {p.margen_pct?.toFixed(1)}%
                    </span>
                  </div>

                  {/* Arrow */}
                  <ChevronRight size={14} className="text-stone-300" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
