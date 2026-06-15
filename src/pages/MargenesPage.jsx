import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { cx } from '../styles/tokens';
import { formatCurrency } from '../utils/format';
import CustomSelect from '../components/CustomSelect';
import SegmentedControl from '../components/SegmentedControl';
import { TrendingUp, AlertTriangle, CheckCircle, Target, Zap, Package, Settings, Search, Plus, Save, X, ToggleLeft, ToggleRight, ArrowUpRight } from 'lucide-react';

const SEMAFORO = {
  optimo: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Óptimo' },
  moderado: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Moderado' },
  minimo: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500', label: 'Mínimo' },
  bajo: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500', label: 'Bajo' },
  sin_categoria: { bg: 'bg-stone-50', text: 'text-stone-500', dot: 'bg-stone-300', label: 'Sin categoría' },
};

export default function MargenesPage() {
  const api = useApi();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [categorizando, setCategorizando] = useState(false);
  const [search, setSearch] = useState('');

  // Tabs: 'productos' | 'config'
  const [tab, setTab] = useState('productos');
  // Category filter
  const [catFiltro, setCatFiltro] = useState('todos');

  // Config state
  const [configCats, setConfigCats] = useState([]);
  const [savingConfig, setSavingConfig] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [catalogo, setCatalogo] = useState([]);
  const [showSugerencias, setShowSugerencias] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get('/margenes/dashboard');
      const d = res?.data || res;
      setData(d);
      setConfigCats((d.categorias || []).map(c => ({ ...c })));
    } catch { toast.error('Error cargando márgenes'); }
    finally { setLoading(false); }
  }, []); // eslint-disable-line

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);
  useEffect(() => { api.get('/margenes/catalogo').then(r => setCatalogo(r?.data || r || [])).catch(() => {}); }, []); // eslint-disable-line

  // Auto-categorizar
  const handleAutoCategorizar = async () => {
    setCategorizando(true);
    try {
      const res = await api.post('/margenes/auto-categorizar');
      const d = res?.data || res;
      toast.success(`${d.applied} productos categorizados de ${d.total}`);
      fetchDashboard();
    } catch { toast.error('Error'); }
    finally { setCategorizando(false); }
  };

  // Cambiar categoría de un producto
  const handleChangeCategoria = async (productoId, categoriaId) => {
    try {
      await api.put(`/margenes/producto/${productoId}`, { categoria_margen_id: categoriaId || null });
      fetchDashboard();
    } catch { toast.error('Error'); }
  };

  // Mejorar margen — navega al cotizador con margen óptimo como objetivo
  const handleMejorarMargen = (producto) => {
    const targetMargen = producto.margen_optimo || 60;
    navigate(`/cotizador/${producto.id}?margenObjetivo=${targetMargen}`);
  };

  // Config: save
  const handleSaveConfig = async () => {
    for (const c of configCats) {
      if (c.activo && (Number(c.margen_minimo) >= Number(c.margen_moderado) || Number(c.margen_moderado) >= Number(c.margen_optimo))) {
        toast.error(`${c.nombre}: mínimo < moderado < óptimo`);
        return;
      }
    }
    setSavingConfig(true);
    try {
      await api.put('/margenes/categorias', { categorias: configCats });
      toast.success('Configuración guardada');
      fetchDashboard();
    } catch { toast.error('Error'); }
    finally { setSavingConfig(false); }
  };

  const handleAddCat = async () => {
    if (!newCatName.trim()) return;
    try {
      const r = await api.post('/margenes/categorias', { nombre: newCatName.trim(), margen_minimo: 30, margen_moderado: 45, margen_optimo: 60 });
      setConfigCats(prev => [...prev, r?.data || r]);
      setNewCatName('');
      toast.success('Categoría creada');
    } catch { toast.error('Error'); }
  };

  const handleDeleteCat = async (id) => {
    try {
      await api.del(`/margenes/categorias/${id}`);
      setConfigCats(prev => prev.filter(c => c.id !== id));
      toast.success('Categoría eliminada');
    } catch { toast.error('Error'); }
  };

  // Filtered products
  const productosFiltrados = useMemo(() => {
    if (!data?.productos) return [];
    let list = data.productos;
    if (catFiltro !== 'todos') {
      list = list.filter(p => (p.categoria_nombre || 'Sin categoría') === catFiltro);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => p.nombre.toLowerCase().includes(q));
    }
    return list;
  }, [data, catFiltro, search]);

  // Category pill options
  const catPillOptions = useMemo(() => {
    if (!data?.categorias) return [{ key: 'todos', label: 'Todos' }];
    const cats = [{ key: 'todos', label: `Todos (${data.productos?.length || 0})` }];
    for (const c of data.categorias) {
      const count = (data.productos || []).filter(p => p.categoria_nombre === c.nombre).length;
      if (count > 0) cats.push({ key: c.nombre, label: `${c.nombre} (${count})` });
    }
    const sinCat = (data.productos || []).filter(p => !p.categoria_margen_id).length;
    if (sinCat > 0) cats.push({ key: 'Sin categoría', label: `Sin categoría (${sinCat})` });
    return cats;
  }, [data]);

  const catOptions = useMemo(() => {
    if (!data?.categorias) return [];
    return [
      { value: null, label: 'Sin categoría' },
      ...data.categorias.map(c => ({ value: c.id, label: c.nombre })),
    ];
  }, [data]);

  if (loading) return (
    <div className="max-w-7xl mx-auto">
      <div className={cx.skeleton + ' h-8 w-48 mb-6'} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[1,2,3,4].map(i => <div key={i} className={cx.skeleton + ' h-20 rounded-xl'} />)}
      </div>
      <div className={cx.skeleton + ' h-96 rounded-xl'} />
    </div>
  );

  const stats = data?.stats || {};

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-stone-800">Márgenes</h1>
          <p className="text-xs text-stone-400 mt-0.5">Rentabilidad de tus productos por categoría</p>
        </div>
        <div className="flex gap-2">
          {stats.sinCategoria > 0 && (
            <button onClick={handleAutoCategorizar} disabled={categorizando}
              className={cx.btnSecondary + ' flex items-center gap-2'}>
              {categorizando ? <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" /> : <Zap size={16} />}
              Auto-categorizar ({stats.sinCategoria})
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {[
          { label: 'Total', count: stats.total, icon: Package, color: 'stone' },
          { label: 'Óptimo', count: stats.optimos, icon: CheckCircle, color: 'emerald' },
          { label: 'Moderado', count: stats.moderados, icon: Target, color: 'amber' },
          { label: 'Bajo', count: (stats.bajos || 0) + (stats.minimos || 0), icon: AlertTriangle, color: 'rose' },
          { label: 'Sin categoría', count: stats.sinCategoria, icon: Search, color: 'stone' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className={cx.card + ' p-4'}>
            <div className="flex items-center gap-2 mb-1">
              <s.icon size={14} className={`text-${s.color}-500`} />
              <span className="text-[11px] text-stone-500 font-medium">{s.label}</span>
            </div>
            <p className="text-2xl font-bold text-stone-800">{s.count || 0}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabs: Productos | Configuración */}
      <div className="mb-5">
        <SegmentedControl
          options={[{ key: 'productos', label: 'Productos' }, { key: 'config', label: 'Configuración' }]}
          value={tab}
          onChange={setTab}
          layoutId="margenes-tab"
        />
      </div>

      {/* ═══ TAB: PRODUCTOS ═══ */}
      {tab === 'productos' && (
        <>
          {/* Category pills */}
          <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
            {catPillOptions.map(opt => (
              <button key={opt.key} onClick={() => setCatFiltro(opt.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  catFiltro === opt.key ? 'bg-[#0A2F24] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}>{opt.label}</button>
            ))}
          </div>

          {/* Search */}
          <div className="mb-4">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              className={cx.input + ' text-sm max-w-sm'} placeholder="Buscar producto..." />
          </div>

          {/* Products table */}
          <div className={cx.card + ' overflow-hidden'}>
            <div className="hidden md:grid grid-cols-[1fr_150px_80px_80px_80px_90px] gap-2 px-4 py-2.5 bg-stone-50 border-b border-stone-100">
              <span className={cx.th}>Producto</span>
              <span className={cx.th}>Categoría</span>
              <span className={cx.th + ' text-right'}>Costo</span>
              <span className={cx.th + ' text-right'}>Precio</span>
              <span className={cx.th + ' text-right'}>Margen</span>
              <span className={cx.th + ' text-center'}>Acción</span>
            </div>

            {productosFiltrados.length === 0 ? (
              <div className="py-12 text-center">
                <Package size={28} className="text-stone-300 mx-auto mb-2" />
                <p className="text-stone-400 text-sm">{search ? 'Sin resultados' : 'No hay productos'}</p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {productosFiltrados.map(p => {
                  const sem = SEMAFORO[p.semaforo] || SEMAFORO.sin_categoria;
                  const isBad = p.semaforo === 'bajo' || p.semaforo === 'minimo';
                  return (
                    <div key={p.id} className="grid grid-cols-[1fr_150px_80px_80px_80px_90px] gap-2 items-center px-4 py-2.5 hover:bg-stone-50/50">
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
                      <CustomSelect options={catOptions} value={p.categoria_margen_id}
                        onChange={(val) => handleChangeCategoria(p.id, val)} placeholder="Categoría" compact />
                      <span className="text-xs text-stone-500 text-right">{formatCurrency(p.costo_neto)}</span>
                      <span className="text-xs text-stone-800 font-medium text-right">{formatCurrency(p.precio_final)}</span>
                      <div className="flex items-center justify-end gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${sem.dot}`} />
                        <span className={`text-xs font-semibold ${sem.text}`}>{p.margen_pct?.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-center">
                        {isBad ? (
                          <button onClick={() => handleMejorarMargen(p)}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-full transition-colors">
                            <ArrowUpRight size={12} /> Mejorar
                          </button>
                        ) : (
                          <button onClick={() => navigate(`/cotizador/${p.id}`)}
                            className={cx.btnGhost + ' !p-1 !text-xs'}>Editar</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ TAB: CONFIGURACIÓN ═══ */}
      {tab === 'config' && (
        <div className={cx.card + ' p-5'}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-semibold text-stone-900">Márgenes por categoría</h3>
          </div>
          <p className="text-xs text-stone-400 mb-5">Define los márgenes objetivo. Los productos se evaluarán automáticamente con semáforo.</p>

          {configCats.length > 0 && (
            <div className="mb-5">
              {/* Header */}
              <div className="grid grid-cols-[36px_1fr_64px_64px_64px_28px] md:grid-cols-[36px_1fr_80px_80px_80px_28px] gap-2 items-center px-3 pb-2">
                <div />
                <span className={cx.th}>Categoría</span>
                <div className="flex flex-col items-center gap-0.5">
                  <div className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className={cx.th}>Mín %</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className={cx.th}>Mod %</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className={cx.th}>Ópt %</span>
                </div>
                <div />
              </div>

              {/* Rows */}
              <div className="divide-y divide-stone-100">
                {configCats.map(c => (
                  <div key={c.id} className={`grid grid-cols-[36px_1fr_64px_64px_64px_28px] md:grid-cols-[36px_1fr_80px_80px_80px_28px] gap-2 items-center px-3 py-3 ${c.activo ? '' : 'opacity-30'}`}>
                    <button onClick={() => setConfigCats(prev => prev.map(cc => cc.id === c.id ? { ...cc, activo: !cc.activo } : cc))}>
                      {c.activo ? <ToggleRight size={22} className="text-[#16A34A]" /> : <ToggleLeft size={22} className="text-stone-300" />}
                    </button>
                    <span className="text-sm font-medium text-stone-800 truncate">{c.nombre}</span>
                    <input type="number" min="0" max="99" value={c.margen_minimo}
                      onChange={e => setConfigCats(prev => prev.map(cc => cc.id === c.id ? { ...cc, margen_minimo: Number(e.target.value) } : cc))}
                      className="w-full text-center text-sm py-2 rounded-lg border border-stone-200 focus:outline-none focus:border-rose-400 min-h-[40px]" disabled={!c.activo} />
                    <input type="number" min="0" max="99" value={c.margen_moderado}
                      onChange={e => setConfigCats(prev => prev.map(cc => cc.id === c.id ? { ...cc, margen_moderado: Number(e.target.value) } : cc))}
                      className="w-full text-center text-sm py-2 rounded-lg border border-stone-200 focus:outline-none focus:border-amber-400 min-h-[40px]" disabled={!c.activo} />
                    <input type="number" min="0" max="99" value={c.margen_optimo}
                      onChange={e => setConfigCats(prev => prev.map(cc => cc.id === c.id ? { ...cc, margen_optimo: Number(e.target.value) } : cc))}
                      className="w-full text-center text-sm py-2 rounded-lg border border-stone-200 focus:outline-none focus:border-emerald-400 min-h-[40px]" disabled={!c.activo} />
                    <button onClick={() => handleDeleteCat(c.id)} className="text-stone-300 hover:text-rose-500 transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Agregar categoría con sugerencias del catálogo */}
          <div className="relative mb-5">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input type="text" value={newCatName}
                  onChange={e => { setNewCatName(e.target.value); setShowSugerencias(true); }}
                  onFocus={() => setShowSugerencias(true)}
                  onKeyDown={e => e.key === 'Enter' && handleAddCat()}
                  className={cx.input + ' text-sm'} placeholder="Buscar o crear categoría..." />
                {/* Sugerencias dropdown */}
                {showSugerencias && newCatName.length > 0 && (() => {
                  const existentes = configCats.map(c => c.nombre.toLowerCase());
                  const q = newCatName.toLowerCase();
                  const matches = catalogo.filter(c =>
                    c.nombre.toLowerCase().includes(q) && !existentes.includes(c.nombre.toLowerCase())
                  ).slice(0, 6);
                  if (matches.length === 0) return null;
                  return (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-50 overflow-hidden">
                      {matches.map(m => (
                        <button key={m.nombre}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setNewCatName(m.nombre);
                            setShowSugerencias(false);
                            // Auto-add with suggested margins
                            api.post('/margenes/categorias', {
                              nombre: m.nombre,
                              margen_minimo: m.min,
                              margen_moderado: m.mod,
                              margen_optimo: m.opt,
                            }).then(r => {
                              setConfigCats(prev => [...prev, r?.data || r]);
                              setNewCatName('');
                              toast.success(`${m.nombre} agregada con márgenes sugeridos`);
                            }).catch(() => toast.error('Error'));
                          }}
                          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-stone-50 text-left transition-colors border-b border-stone-100 last:border-0"
                        >
                          <div>
                            <span className="text-sm font-medium text-stone-800">{m.nombre}</span>
                            <span className="text-[10px] text-stone-400 ml-2">{m.keywords_count} productos</span>
                          </div>
                          <div className="flex gap-2 text-[10px]">
                            <span className="text-rose-500">{m.min}%</span>
                            <span className="text-amber-500">{m.mod}%</span>
                            <span className="text-emerald-500">{m.opt}%</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
              <button onClick={handleAddCat} disabled={!newCatName.trim()}
                className={cx.btnGhost + ' flex items-center gap-1 flex-shrink-0'}><Plus size={14} /> Crear</button>
            </div>
          </div>

          <button onClick={handleSaveConfig} disabled={savingConfig}
            className={cx.btnPrimary + ' flex items-center gap-2'}>
            {savingConfig ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
            Guardar configuración
          </button>
        </div>
      )}
    </div>
  );
}
