import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { cx } from '../styles/tokens';
import { formatCurrency } from '../utils/format';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  Plus, X, Trash2, Pencil, Truck, MapPin, Check, CheckCheck, Package,
} from 'lucide-react';
import SegmentedControl from '../components/SegmentedControl';

export default function CanalesPage() {
  const api = useApi();
  const toast = useToast();

  const [canales, setCanales] = useState([]);
  const [productos, setProductos] = useState([]);
  const [activeTab, setActiveTab] = useState('directa');
  const [loading, setLoading] = useState(true);

  // Product-channel state
  const [preciosCanal, setPreciosCanal] = useState({});
  const [productosEnCanal, setProductosEnCanal] = useState(new Set());

  // Zonas de envío
  const [zonas, setZonas] = useState([]);
  const [showZonaForm, setShowZonaForm] = useState(false);
  const [zonaForm, setZonaForm] = useState({});
  const [zonaEditingId, setZonaEditingId] = useState(null);

  // Create channel
  const [showCreate, setShowCreate] = useState(false);
  const [showAddProducts, setShowAddProducts] = useState(false);
  const [createForm, setCreateForm] = useState({ nombre: '', comision_pct: '' });

  // Edit channel
  const [editingCanal, setEditingCanal] = useState(null);
  const [editForm, setEditForm] = useState({ nombre: '', comision_pct: '' });

  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmDeselectAll, setConfirmDeselectAll] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [editPrice, setEditPrice] = useState('');

  // ─── Data Loading ───

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [canalesRes, prodsRes, zonasRes] = await Promise.all([
        api.get('/canales').catch(() => ({ data: [] })),
        api.get('/productos').catch(() => ({ data: [] })),
        api.get('/canales/zonas').catch(() => ({ data: [] })),
      ]);
      setCanales(canalesRes.data || []);
      setProductos((prodsRes.data || []).filter(p => !p.locked));
      setZonas(zonasRes.data || []);
    } catch {
      // silently handled
    } finally {
      setLoading(false);
    }
  }

  // Load channel prices when switching tabs
  useEffect(() => {
    if (activeTab === 'directa' || activeTab === 'zonas') return;
    loadCanalPrecios(activeTab);
  }, [activeTab, productos]);

  const loadCanalPrecios = useCallback((canalId) => {
    const preciosMap = {};
    const enCanal = new Set();
    for (const p of productos) {
      const cp = (p.precios_canal || []).find(c => c.canal_id === parseInt(canalId));
      if (cp) {
        preciosMap[p.id] = parseFloat(cp.precio_override);
        enCanal.add(p.id);
      }
    }
    setPreciosCanal(preciosMap);
    setProductosEnCanal(enCanal);
  }, [productos]);

  // ─── Channel CRUD ───

  async function createCanal() {
    if (!createForm.nombre?.trim()) { toast.error('Nombre es requerido'); return; }
    setSaving(true);
    try {
      const body = {
        nombre: createForm.nombre.trim(),
        comision_pct: parseFloat(createForm.comision_pct) || 0,
      };
      await api.post('/canales', body);
      toast.success('Canal creado');
      const res = await api.get('/canales');
      const newCanales = res.data || [];
      setCanales(newCanales);
      // Switch to new tab
      const newCanal = newCanales.find(c => c.nombre === body.nombre);
      if (newCanal) setActiveTab(String(newCanal.id));
      setShowCreate(false);
      setCreateForm({ nombre: '', comision_pct: '' });
    } catch (err) {
      toast.error(err.message || 'Error creando canal');
    } finally {
      setSaving(false);
    }
  }

  async function saveEditCanal() {
    if (!editForm.nombre?.trim()) { toast.error('Nombre es requerido'); return; }
    setSaving(true);
    try {
      await api.put(`/canales/${editingCanal.id}`, {
        nombre: editForm.nombre.trim(),
        comision_pct: parseFloat(editForm.comision_pct) || 0,
      });
      toast.success('Canal actualizado — precios recalculados');
      const [canalesRes, prodsRes] = await Promise.all([
        api.get('/canales'),
        api.get('/productos'),
      ]);
      setCanales(canalesRes.data || []);
      setProductos((prodsRes.data || []).filter(p => !p.locked));
      setEditingCanal(null);
      // Refresh channel view
      loadCanalPrecios(activeTab);
    } catch (err) {
      toast.error(err.message || 'Error actualizando canal');
    } finally {
      setSaving(false);
    }
  }

  async function deleteCanal() {
    if (!deleteTarget) return;
    try {
      await api.del(`/canales/${deleteTarget.id}`);
      toast.success('Canal eliminado');
      setCanales(prev => prev.filter(c => c.id !== deleteTarget.id));
      if (activeTab === String(deleteTarget.id)) setActiveTab('directa');
    } catch (err) {
      toast.error(err.message || 'Error eliminando canal');
    } finally {
      setDeleteTarget(null);
    }
  }

  // ─── Product-Channel Operations ───

  async function toggleProductoEnCanal(productoId, checked) {
    const canalId = parseInt(activeTab);
    try {
      if (checked) {
        const prod = productos.find(p => p.id === productoId);
        const canal = canales.find(c => c.id === canalId);
        const comision = parseFloat(canal?.comision_pct) || 0;
        const precio = comision < 100
          ? Math.round((parseFloat(prod.precio_final) / (1 - comision / 100)) * 100) / 100
          : parseFloat(prod.precio_final);
        await api.put(`/canales/precios/${productoId}`, { canal_id: canalId, precio_override: precio });
        toast.success('Producto agregado');
      } else {
        await api.put(`/canales/precios/${productoId}`, { canal_id: canalId, precio_override: null });
        toast.success('Producto removido');
      }
      // Reload products from server (single source of truth)
      const res = await api.get('/productos');
      const prods = (res.data || []).filter(p => !p.locked);
      setProductos(prods);
      // Recalculate canal view from fresh data
      const pm = {};
      const ec = new Set();
      for (const p of prods) {
        const cp = (p.precios_canal || []).find(c => c.canal_id === canalId);
        if (cp) { pm[p.id] = parseFloat(cp.precio_override); ec.add(p.id); }
      }
      setPreciosCanal(pm);
      setProductosEnCanal(ec);
    } catch (err) {
      toast.error(err.message || 'Error');
    }
  }

  async function updatePrecioCanal(productoId, nuevoPrecio) {
    const canalId = parseInt(activeTab);
    try {
      await api.put(`/canales/precios/${productoId}`, { canal_id: canalId, precio_override: parseFloat(nuevoPrecio) });
      setPreciosCanal(prev => ({ ...prev, [productoId]: parseFloat(nuevoPrecio) }));
      // Refresh productos
      const res = await api.get('/productos');
      setProductos((res.data || []).filter(p => !p.locked));
    } catch (err) {
      toast.error(err.message || 'Error actualizando precio');
    }
  }

  async function selectAll() {
    const canalId = parseInt(activeTab);
    const canal = canales.find(c => c.id === canalId);
    const comision = parseFloat(canal?.comision_pct) || 0;
    setSaving(true);
    try {
      for (const p of productos) {
        if (!productosEnCanal.has(p.id)) {
          const precio = comision < 100
            ? Math.round((parseFloat(p.precio_final) / (1 - comision / 100)) * 100) / 100
            : parseFloat(p.precio_final);
          await api.put(`/canales/precios/${p.id}`, { canal_id: canalId, precio_override: precio });
        }
      }
      const res = await api.get('/productos');
      setProductos((res.data || []).filter(p => !p.locked));
      loadCanalPrecios(activeTab);
      toast.success('Todos los productos agregados');
    } catch (err) {
      toast.error(err.message || 'Error agregando productos');
    } finally {
      setSaving(false);
    }
  }

  async function deselectAll() {
    const canalId = parseInt(activeTab);
    setSaving(true);
    try {
      for (const p of productos) {
        if (productosEnCanal.has(p.id)) {
          await api.put(`/canales/precios/${p.id}`, { canal_id: canalId, precio_override: null });
        }
      }
      const res = await api.get('/productos');
      setProductos((res.data || []).filter(p => !p.locked));
      setPreciosCanal({});
      setProductosEnCanal(new Set());
      toast.success('Todos los productos removidos');
    } catch (err) {
      toast.error(err.message || 'Error removiendo productos');
    } finally {
      setSaving(false);
    }
  }

  // ─── Zonas CRUD ───

  function openNewZona() {
    setZonaForm({ nombre: '', costo: '' });
    setZonaEditingId(null);
    setShowZonaForm(true);
  }

  function openEditZona(z) {
    setZonaForm({ nombre: z.nombre, costo: z.costo ?? '' });
    setZonaEditingId(z.id);
    setShowZonaForm(true);
  }

  function resetZonaForm() {
    setZonaForm({});
    setZonaEditingId(null);
    setShowZonaForm(false);
  }

  async function saveZona() {
    if (!zonaForm.nombre?.trim()) { toast.error('Nombre es requerido'); return; }
    setSaving(true);
    try {
      const body = {
        nombre: zonaForm.nombre.trim(),
        costo: parseFloat(zonaForm.costo) || 0,
      };
      if (zonaEditingId) {
        await api.put(`/canales/zonas/${zonaEditingId}`, body);
        toast.success('Zona actualizada');
      } else {
        await api.post('/canales/zonas', body);
        toast.success('Zona creada');
      }
      const res = await api.get('/canales/zonas');
      setZonas(res.data || []);
      resetZonaForm();
    } catch (err) {
      toast.error(err.message || 'Error guardando zona');
    } finally {
      setSaving(false);
    }
  }

  async function deleteZona() {
    if (!deleteTarget) return;
    try {
      await api.del(`/canales/zonas/${deleteTarget.id}`);
      toast.success('Zona eliminada');
      setZonas(prev => prev.filter(z => z.id !== deleteTarget.id));
    } catch (err) {
      toast.error(err.message || 'Error eliminando zona');
    } finally {
      setDeleteTarget(null);
    }
  }

  // ─── Helpers ───

  function startEditCanal(c) {
    setEditingCanal(c);
    setEditForm({ nombre: c.nombre, comision_pct: c.comision_pct ?? '' });
  }

  const activeCanal = canales.find(c => String(c.id) === activeTab);

  // ─── Loading ───

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto pb-12 space-y-4">
        <div className={cx.skeleton + ' h-10 w-48'} />
        <div className={cx.skeleton + ' h-12 w-full'} />
        <div className={cx.skeleton + ' h-64'} />
      </div>
    );
  }

  // ─── Render ───

  return (
    <div className="max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <h1 className="text-xl font-bold text-stone-900">Canales de venta</h1>
      </div>

      {/* Tab pills */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <SegmentedControl
          options={[
            { key: 'directa', label: 'Venta Directa' },
            ...canales.map(c => ({ key: String(c.id), label: `${c.nombre} ${c.comision_pct}%` })),
            { key: 'zonas', label: 'Zonas de envío' },
          ]}
          value={activeTab}
          onChange={setActiveTab}
          layoutId="canales-tab"
        />
        <button
          onClick={() => setShowCreate(true)}
          className="px-3 py-2 text-xs font-semibold rounded-lg bg-[var(--accent)] text-white hover:opacity-90 flex items-center gap-1"
        >
          <Plus size={12} /> Canal
        </button>
      </div>

      {/* ─── Create Channel Modal ─── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm max-w-[95vw] shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-stone-900">Nuevo canal</h3>
              <button onClick={() => setShowCreate(false)} className={cx.btnIcon}><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className={cx.label}>Nombre</label>
                <input
                  type="text"
                  value={createForm.nombre}
                  onChange={e => setCreateForm(f => ({ ...f, nombre: e.target.value }))}
                  className={cx.input}
                  placeholder="Rappi, PedidosYa..."
                />
              </div>
              <div>
                <label className={cx.label}>Comisión %</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={createForm.comision_pct}
                  onChange={e => setCreateForm(f => ({ ...f, comision_pct: e.target.value }))}
                  className={cx.input}
                  placeholder="30"
                />
                <p className="text-[10px] text-stone-400 mt-1">Ej: 30% = precio x 1.43</p>
              </div>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setShowCreate(false)} className={cx.btnSecondary}>Cancelar</button>
              <button onClick={createCanal} disabled={saving} className={cx.btnPrimary}>
                {saving ? 'Creando...' : 'Crear canal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Tab: Venta Directa ─── */}
      {activeTab === 'directa' && (
        <div>
          {productos.length === 0 ? (
            <div className={`${cx.card} p-12 text-center`}>
              <Truck size={40} className="text-stone-300 mx-auto mb-4" />
              <p className="text-stone-400 text-sm">No hay productos registrados</p>
            </div>
          ) : (
            <div className={cx.card + ' overflow-x-auto'}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200">
                    <th className={cx.th}>Producto</th>
                    <th className={cx.th + ' text-right'}>Precio tienda</th>
                  </tr>
                </thead>
                <tbody>
                  {productos.map(p => (
                    <tr key={p.id} className={cx.tr}>
                      <td className={cx.td + ' font-medium text-stone-800'}>{p.nombre}</td>
                      <td className={cx.td + ' text-right text-[var(--accent)] font-semibold'}>
                        {formatCurrency(p.precio_final)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Tab: Channel ─── */}
      {activeTab !== 'directa' && activeTab !== 'zonas' && activeCanal && (
        <div>
          {/* Channel info header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            {editingCanal?.id === activeCanal.id ? (
              /* Inline edit */
              <div className="flex items-center gap-2 flex-wrap flex-1">
                <input
                  type="text"
                  value={editForm.nombre}
                  onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))}
                  className={cx.input + ' !w-40'}
                  placeholder="Nombre"
                />
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={editForm.comision_pct}
                  onChange={e => setEditForm(f => ({ ...f, comision_pct: e.target.value }))}
                  className={cx.input + ' !w-24'}
                  placeholder="%"
                />
                <button onClick={saveEditCanal} disabled={saving} className={cx.btnPrimary + ' text-xs !px-3 !py-1.5'}>
                  {saving ? '...' : 'Guardar'}
                </button>
                <button onClick={() => setEditingCanal(null)} className={cx.btnGhost + ' text-xs !px-2 !py-1.5'}>
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cx.badge('bg-amber-50 text-amber-600')}>
                  Comisión: {activeCanal.comision_pct}%
                </span>
                <span className="text-xs text-stone-400">
                  {productosEnCanal.size} producto{productosEnCanal.size !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            <div className="flex gap-1 flex-wrap">
              <button onClick={selectAll} disabled={saving} className={cx.btnGhost + ' text-xs flex items-center gap-1'}>
                <CheckCheck size={12} /> Seleccionar todos
              </button>
              <button onClick={() => setConfirmDeselectAll(true)} disabled={saving} className={cx.btnGhost + ' text-xs'}>
                Deseleccionar
              </button>
              {!editingCanal && (
                <>
                  <button onClick={() => startEditCanal(activeCanal)} className={cx.btnGhost + ' text-xs flex items-center gap-1'}>
                    <Pencil size={12} /> Editar
                  </button>
                  <button
                    onClick={() => setDeleteTarget({ ...activeCanal, _type: 'canal' })}
                    className={cx.btnDanger + ' text-xs flex items-center gap-1'}
                  >
                    <Trash2 size={12} /> Eliminar
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Products in this channel */}
          {(() => {
            const prodsEnCanal = productos.filter(p => productosEnCanal.has(p.id));
            const prodsNoEnCanal = productos.filter(p => !productosEnCanal.has(p.id));
            const comision = parseFloat(activeCanal.comision_pct) || 0;

            return (
              <>
                {/* Add products button */}
                {prodsNoEnCanal.length > 0 && (
                  <button onClick={() => setShowAddProducts(true)} className={cx.btnPrimary + ' text-xs flex items-center gap-1 mb-3'}>
                    <Plus size={14} /> Agregar productos ({prodsNoEnCanal.length} disponibles)
                  </button>
                )}

                {prodsEnCanal.length === 0 ? (
                  <div className={`${cx.card} p-12 text-center`}>
                    <Package size={32} className="text-stone-300 mx-auto mb-3" />
                    <p className="text-stone-400 text-sm mb-3">No hay productos en este canal</p>
                    <button onClick={() => setShowAddProducts(true)} className={cx.btnPrimary + ' text-xs'}>
                      Agregar productos
                    </button>
                  </div>
                ) : (
                  <div className={cx.card + ' divide-y divide-stone-100'}>
                    {prodsEnCanal.map(p => {
                      const precio = parseFloat(preciosCanal[p.id]) || 0;
                      const sugerido = comision < 100 ? Math.round(parseFloat(p.precio_final) / (1 - comision / 100) * 100) / 100 : parseFloat(p.precio_final);
                      const costoNeto = parseFloat(p.costo_neto) || 0;
                      const subsidiando = precio > 0 && precio < sugerido * 0.99;
                      const cobraMas = precio > sugerido * 1.01;
                      const diffMonto = Math.abs(Math.round((precio - sugerido) * 100) / 100);
                      const diffPct = sugerido > 0 ? Math.abs(Math.round(((precio - sugerido) / sugerido) * 10000) / 100) : 0;
                      const margenCanal = precio > 0 && costoNeto > 0 ? Math.round((1 - costoNeto / precio) * 100) : null;

                      return (
                        <div key={p.id} className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-stone-800 truncate">{p.nombre}</p>
                              <p className="text-[10px] text-stone-400">
                                Tienda: {formatCurrency(p.precio_final)} · Sugerido: {formatCurrency(sugerido)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {editingRow === p.id ? (
                                <div className="flex items-center gap-1">
                                  <input type="number" className={cx.input + ' !py-1 !px-2 w-24 text-sm'}
                                    value={editPrice} onChange={e => setEditPrice(e.target.value)} autoFocus />
                                  <button onClick={() => { updatePrecioCanal(p.id, editPrice); setEditingRow(null); }}
                                    className="text-emerald-600 text-xs font-semibold">OK</button>
                                  <button onClick={() => setEditingRow(null)}
                                    className="text-stone-400 text-xs">X</button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  {precio !== sugerido && Math.abs(precio - sugerido) > 0.01 && (
                                    <button
                                      onClick={() => { updatePrecioCanal(p.id, sugerido); }}
                                      className="text-[9px] text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded font-semibold transition-colors"
                                      title={`Aplicar precio sugerido: ${formatCurrency(sugerido)}`}
                                    >
                                      Aplicar
                                    </button>
                                  )}
                                  <span className={`text-sm font-medium ${subsidiando ? 'text-amber-700' : 'text-stone-800'}`}>
                                    {formatCurrency(precio)}
                                  </span>
                                  <button onClick={() => { setEditingRow(p.id); setEditPrice(String(precio)); }}
                                    className="text-stone-400 hover:text-stone-600 transition-colors duration-100">
                                    <Pencil size={14} />
                                  </button>
                                </div>
                              )}
                              <button onClick={() => toggleProductoEnCanal(p.id, false)} className={cx.btnDanger + ' p-1'} title="Remover">
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                          {/* Badges: subsidio/markup + margen */}
                          <div className="flex items-center gap-2 mt-1 pl-0">
                            {subsidiando && (
                              <span className="text-[9px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                Subsidias {formatCurrency(diffMonto)} ({diffPct}%)
                              </span>
                            )}
                            {cobraMas && (
                              <span className="text-[9px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                +{formatCurrency(diffMonto)} sobre sugerido
                              </span>
                            )}
                            {margenCanal !== null && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                                margenCanal >= 30 ? 'text-emerald-600 bg-emerald-50' :
                                margenCanal >= 10 ? 'text-amber-600 bg-amber-50' :
                                'text-rose-600 bg-rose-50'
                              }`}>
                                Margen: {margenCanal}%
                              </span>
                            )}
                            {editingRow === p.id && parseFloat(editPrice) > 0 && costoNeto > 0 && (
                              <span className="text-[9px] text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded font-semibold">
                                Nuevo margen: {Math.round((1 - costoNeto / parseFloat(editPrice)) * 100)}%
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add products modal — card style */}
                {showAddProducts && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddProducts(false)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-w-[95vw] max-h-[85vh] flex flex-col">
                      <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
                        <div>
                          <h3 className="text-sm font-bold text-stone-900">Agregar productos a {activeCanal.nombre}</h3>
                          <p className="text-[11px] text-stone-400 mt-0.5">{prodsNoEnCanal.length} disponibles</p>
                        </div>
                        <button onClick={() => setShowAddProducts(false)} className={cx.btnIcon}><X size={16} /></button>
                      </div>
                      <div className="overflow-y-auto flex-1 p-4">
                        {prodsNoEnCanal.length === 0 ? (
                          <div className="text-center py-8">
                            <Check size={32} className="text-emerald-400 mx-auto mb-2" />
                            <p className="text-sm text-stone-400">Todos los productos ya están en este canal</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                            {prodsNoEnCanal.map(p => {
                              const calc = comision < 100 ? Math.round((parseFloat(p.precio_final) / (1 - comision / 100)) * 100) / 100 : parseFloat(p.precio_final);
                              return (
                                <button
                                  key={p.id}
                                  onClick={async () => { await toggleProductoEnCanal(p.id, true); }}
                                  className="bg-white rounded-xl border border-stone-200 p-2.5 text-center hover:border-[#16A34A] hover:shadow-md transition-colors duration-100 group"
                                >
                                  {p.imagen_url ? (
                                    <img src={p.imagen_url} className="w-full aspect-square object-cover rounded-lg mb-2" alt={p.nombre} />
                                  ) : (
                                    <div className="w-full aspect-square bg-stone-100 rounded-lg mb-2 flex items-center justify-center">
                                      <Package size={24} className="text-stone-300" />
                                    </div>
                                  )}
                                  <p className="text-xs font-medium text-stone-800 truncate">{p.nombre}</p>
                                  <p className="text-[10px] text-stone-400 mt-0.5">Tienda: {formatCurrency(p.precio_final)}</p>
                                  <p className="text-xs font-bold text-[var(--accent)] mt-0.5">{formatCurrency(calc)}</p>
                                  <div className="mt-1.5 text-[10px] text-stone-400 group-hover:text-[#16A34A] transition-colors duration-100">
                                    + Agregar
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* ─── Tab: Zonas de envío ─── */}
      {activeTab === 'zonas' && (
        <>
          <div className="flex justify-end mb-4">
            <button onClick={openNewZona} className={cx.btnPrimary + ' flex items-center gap-2'}>
              <Plus size={14} /> Nueva zona
            </button>
          </div>

          {/* Zona form */}
          {showZonaForm && (
            <div className={`${cx.card} p-5 mb-4`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-stone-900">
                  {zonaEditingId ? 'Editar zona' : 'Nueva zona'}
                </h3>
                <button onClick={resetZonaForm} className={cx.btnIcon}><X size={16} /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={cx.label}>Nombre</label>
                  <input
                    type="text"
                    value={zonaForm.nombre || ''}
                    onChange={e => setZonaForm(f => ({ ...f, nombre: e.target.value }))}
                    className={cx.input}
                    placeholder="Centro, Norte, Sur..."
                  />
                </div>
                <div>
                  <label className={cx.label}>Costo (S/)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={zonaForm.costo || ''}
                    onChange={e => setZonaForm(f => ({ ...f, costo: e.target.value }))}
                    className={cx.input}
                    placeholder="5.00"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={saveZona} disabled={saving} className={cx.btnPrimary}>
                  {saving ? 'Guardando...' : zonaEditingId ? 'Guardar cambios' : 'Crear zona'}
                </button>
                <button onClick={resetZonaForm} className={cx.btnSecondary}>Cancelar</button>
              </div>
            </div>
          )}

          {zonas.length === 0 ? (
            <div className={`${cx.card} p-12 text-center`}>
              <MapPin size={40} className="text-stone-300 mx-auto mb-4" />
              <p className="text-stone-400 text-sm">No hay zonas de envio registradas</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className={`${cx.card} hidden lg:block overflow-hidden`}>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-stone-100">
                      <th className={cx.th}>Nombre</th>
                      <th className={cx.th + ' text-right'}>Costo</th>
                      <th className={cx.th + ' w-24'}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {zonas.map(z => (
                      <tr key={z.id} className={cx.tr}>
                        <td className={cx.td + ' font-medium text-stone-900'}>{z.nombre}</td>
                        <td className={cx.td + ' text-right text-stone-600'}>{formatCurrency(z.costo)}</td>
                        <td className={cx.td}>
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => openEditZona(z)} className={cx.btnIcon}><Pencil size={14} /></button>
                            <button onClick={() => setDeleteTarget({ ...z, _type: 'zona' })} className={cx.btnIcon + ' hover:text-rose-600'}><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="lg:hidden space-y-3">
                {zonas.map(z => (
                  <div key={z.id} className={`${cx.card} p-4`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-stone-900">{z.nombre}</p>
                        <p className="text-xs text-stone-500 mt-0.5">{formatCurrency(z.costo)}</p>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => openEditZona(z)} className={cx.btnIcon}><Pencil size={14} /></button>
                        <button onClick={() => setDeleteTarget({ ...z, _type: 'zona' })} className={cx.btnIcon + ' hover:text-rose-600'}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Confirm deselect all */}
      <ConfirmDialog
        open={confirmDeselectAll}
        title="Deseleccionar todos"
        message="Se removerán todos los productos de este canal. Esta acción no se puede deshacer."
        confirmText="Deseleccionar"
        confirmStyle="danger"
        onConfirm={() => { deselectAll(); setConfirmDeselectAll(false); }}
        onCancel={() => setConfirmDeselectAll(false)}
      />

      {/* Confirm delete */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget?._type === 'zona' ? 'Eliminar zona' : 'Eliminar canal'}
        message={`¿Estás seguro de eliminar "${deleteTarget?.nombre}"?`}
        onConfirm={deleteTarget?._type === 'zona' ? deleteZona : deleteCanal}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
