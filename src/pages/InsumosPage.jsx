import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { cx } from '../styles/tokens';
import { formatCurrency, formatDate } from '../utils/format';
import ConfirmDialog from '../components/ConfirmDialog';
import CustomSelect from '../components/CustomSelect';
import { Plus, Save, X, Trash2, Pencil, Search, TrendingUp, ChevronDown, ChevronRight, Pin } from 'lucide-react';
import { useTerminos } from '../context/TerminosContext';

const UNIDADES = ['g', 'kg', 'ml', 'L', 'uni', 'oz'];

const emptyRow = () => ({
  id: null,
  nombre: '',
  cantidad_presentacion: '',
  unidad_medida: 'g',
  precio_presentacion: '',
  _editing: true,
  _new: true,
});

function AddPresentacionForm({ insumoId, insumoNombre, onAdded }) {
  const [cantidad, setCantidad] = useState('');
  const [unidad, setUnidad] = useState('');
  const [precio, setPrecio] = useState('');
  const [saving, setSaving] = useState(false);
  const api = useApi();
  const toast = useToast();

  const autoNombre = cantidad && unidad ? `${insumoNombre} ${cantidad} ${unidad}` : '';

  const save = async () => {
    if (!cantidad) return;
    setSaving(true);
    try {
      await api.post(`/insumos/${insumoId}/presentaciones`, {
        cantidad: parseFloat(cantidad),
        unidad,
        precio: parseFloat(precio) || null,
      });
      toast.success('Presentación agregada');
      setCantidad(''); setUnidad(''); setPrecio('');
      onAdded();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="mt-3 pt-3 border-t border-stone-200">
      <p className="text-xs font-semibold text-stone-500 mb-2">Agregar presentación</p>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] text-stone-400 block mb-0.5">Cantidad</label>
          <input className={cx.input + ' text-sm'} type="number" min="0.001" step="0.001" placeholder="25" value={cantidad} onChange={e => setCantidad(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] text-stone-400 block mb-0.5">Unidad</label>
          <CustomSelect
            compact
            options={['g','kg','ml','L','uni','oz','cm','mt'].map(u => ({ value: u, label: u }))}
            value={unidad}
            onChange={v => setUnidad(v)}
            placeholder="--"
          />
        </div>
        <div>
          <label className="text-[10px] text-stone-400 block mb-0.5">Precio (S/)</label>
          <div className="flex gap-1">
            <input className={cx.input + ' text-sm flex-1'} type="number" step="0.01" placeholder="75.00" value={precio} onChange={e => setPrecio(e.target.value)} />
            <button onClick={save} disabled={saving || !cantidad}
              className={cx.btnPrimary + ' !px-3 !py-2 text-sm'}>+</button>
          </div>
        </div>
      </div>
      {autoNombre && <p className="text-[10px] text-stone-400 mt-1">Se creará como: <span className="font-medium text-stone-600">{autoNombre}</span></p>}
    </div>
  );
}

export default function InsumosPage() {
  const api = useApi();
  const toast = useToast();
  const t = useTerminos();
  const [insumos, setInsumos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [priceHistory, setPriceHistory] = useState(null);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    loadInsumos();
  }, []);

  const loadInsumos = async () => {
    try {
      const data = await api.get('/insumos');
      setInsumos((data.data || []).map((i) => ({
        ...i,
        cantidad_presentacion: parseFloat(i.cantidad_presentacion) || 0,
        precio_presentacion: parseFloat(i.precio_presentacion) || 0,
      })));
    } catch {
      toast.error('Error cargando insumos');
    } finally {
      setLoading(false);
    }
  };

  const addNew = () => {
    const row = emptyRow();
    setInsumos((prev) => [row, ...prev]);
    setEditingId('new');
    setEditData(row);
  };

  const startEdit = (ins) => {
    setEditingId(ins.id);
    setEditData({ ...ins });
  };

  const cancelEdit = () => {
    if (editingId === 'new') {
      setInsumos((prev) => prev.filter((i) => !i._new));
    }
    setEditingId(null);
    setEditData({});
  };

  const saveEdit = async () => {
    const { nombre, cantidad_presentacion, unidad_medida, precio_presentacion } = editData;
    if (!nombre?.trim()) { toast.error('Ingresa el nombre del insumo'); return; }
    if (!cantidad_presentacion || Number(cantidad_presentacion) <= 0) { toast.error('La cantidad de presentación debe ser mayor a 0'); return; }
    if (!precio_presentacion || Number(precio_presentacion) <= 0) { toast.error('El precio de presentación debe ser mayor a 0'); return; }

    try {
      if (editingId === 'new') {
        const data = await api.post('/insumos', {
          nombre,
          cantidad_presentacion: Number(cantidad_presentacion),
          unidad_medida,
          precio_presentacion: Number(precio_presentacion),
        });
        toast.success('Insumo creado');
        setInsumos((prev) => prev.map((i) => (i._new ? { ...(data.data), _editing: false } : i)));
      } else {
        const data = await api.put(`/insumos/${editingId}`, {
          nombre,
          cantidad_presentacion: Number(cantidad_presentacion),
          unidad_medida,
          precio_presentacion: Number(precio_presentacion),
        });
        if (data.recalculated?.length) {
          toast.success(`Insumo actualizado. ${data.recalculated.length} productos recalculados`);
        } else {
          toast.success('Insumo actualizado');
        }
        setInsumos((prev) => prev.map((i) => (i.id === editingId ? data.data : i)));
      }
      setEditingId(null);
      setEditData({});
      loadInsumos();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.del(`/insumos/${deleteTarget.id}`);
      toast.success('Insumo eliminado');
      setInsumos((prev) => prev.filter((i) => i.id !== deleteTarget.id));
    } catch (err) {
      toast.error(err.message || 'Error eliminando insumo');
    } finally {
      setDeleteTarget(null);
    }
  };

  const loadPriceHistory = async (insumoId) => {
    try {
      const data = await api.get(`/pl/insumo-precios/${insumoId}`);
      setPriceHistory(data.data || null);
    } catch {
      toast.error('Error cargando historial');
    }
  };

  const costoUnitario = (ins) => {
    // Use WAC (costo_base) if available, otherwise calculate from catalog
    if (ins.costo_base && Number(ins.costo_base) > 0) return Number(ins.costo_base);
    const pres = Number(ins.cantidad_presentacion) || 0;
    const precio = Number(ins.precio_presentacion) || 0;
    if (pres === 0) return 0;
    return precio / pres;
  };

  const tieneWAC = (ins) => ins.costo_base && Number(ins.costo_base) > 0;

  const costoCatalogo = (ins) => {
    const pres = Number(ins.cantidad_presentacion) || 0;
    const precio = Number(ins.precio_presentacion) || 0;
    if (pres === 0) return 0;
    return precio / pres;
  };

  const toggleExpanded = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filtered = insumos.filter(
    (i) =>
      i._new ||
      (i.nombre || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className={cx.skeleton + ' h-16'} />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900">{t.insumos}</h2>
          <p className="text-stone-500 text-sm mt-0.5">{insumos.filter((i) => !i._new).length} insumos registrados</p>
        </div>
        <button id="btn-nuevo-insumo" onClick={addNew} disabled={editingId !== null} className={cx.btnPrimary + ' flex items-center gap-2'}>
          <Plus size={16} />
          Nuevo Insumo
        </button>
      </div>

      {insumos.length > 0 && (
        <div className="mb-4 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            id="insumos-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar insumo..."
            className={cx.input + ' pl-9'}
          />
        </div>
      )}

      {/* Mobile cards */}
      <div id="insumos-list" className="space-y-3 lg:hidden">
        {filtered.map((ins, idx) => {
          const isEditing = editingId === (ins._new ? 'new' : ins.id);
          if (isEditing) {
            return (
              <div id="insumo-form" key={ins.id || `new-${idx}`} className={`${cx.card} p-4 border-[var(--accent)] space-y-3`}>
                <input id="insumo-nombre" type="text" value={editData.nombre} onChange={(e) => setEditData({ ...editData, nombre: e.target.value })} onBlur={(e) => { const v = e.target.value.trim(); if (v) setEditData({ ...editData, nombre: v.charAt(0).toUpperCase() + v.slice(1) }); }} placeholder="Nombre" className={cx.input} autoFocus />
                <div className="grid grid-cols-3 gap-2">
                  <input type="number" value={editData.cantidad_presentacion} onChange={(e) => setEditData({ ...editData, cantidad_presentacion: e.target.value })} placeholder="Cantidad" className={cx.input} />
                  <CustomSelect
                    value={editData.unidad_medida}
                    onChange={(v) => setEditData({ ...editData, unidad_medida: v })}
                    options={UNIDADES.map(u => ({ value: u, label: u }))}
                  />
                  <input id="insumo-precio" type="number" step="0.01" value={editData.precio_presentacion} onChange={(e) => setEditData({ ...editData, precio_presentacion: e.target.value })} placeholder="Precio" className={cx.input} />
                </div>
                <div className="flex gap-2">
                  <button id="insumo-save" onClick={saveEdit} className={cx.btnPrimary + ' flex-1 flex items-center justify-center gap-1'}><Save size={16} /> Guardar</button>
                  <button onClick={cancelEdit} className={cx.btnSecondary + ' flex items-center justify-center gap-1'}><X size={16} /></button>
                </div>
              </div>
            );
          }
          return (
            <div key={ins.id} className={`${cx.card} p-4`}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-stone-800 font-medium text-sm">{ins.nombre}</h3>
                  <p className="text-stone-500 text-xs mt-1">{ins.cantidad_presentacion} {ins.unidad_medida} - {formatCurrency(ins.precio_presentacion)}</p>
                </div>
                <div className="text-right">
                  <span className="text-[var(--accent)] text-sm font-semibold">
                    S/ {costoUnitario(ins).toFixed(3)}/{ins.unidad_base || ins.unidad_medida}
                  </span>
                  {tieneWAC(ins) && <p className="text-[10px] text-teal-600">WAC</p>}
                </div>
              </div>
              <div className="flex gap-2 mt-3 border-t border-stone-200 pt-3">
                <button onClick={() => loadPriceHistory(ins.id)} className={cx.btnGhost + ' flex items-center justify-center gap-1'} title="Historial de precios"><TrendingUp size={16} /></button>
                <button onClick={() => startEdit(ins)} className={cx.btnGhost + ' flex-1 flex items-center justify-center gap-1'}><Pencil size={16} /> Editar</button>
                <button onClick={() => setDeleteTarget(ins)} className={cx.btnDanger + ' flex items-center justify-center gap-1'}><Trash2 size={16} /></button>
              </div>
              {/* Mobile presentaciones */}
              {ins.presentaciones?.length > 0 && (
                <div className="mt-3 border-t border-stone-200 pt-3">
                  <button
                    onClick={() => toggleExpanded(ins.id)}
                    className="flex items-center gap-1 text-xs text-stone-500 font-medium"
                  >
                    {expanded[ins.id]
                      ? <ChevronDown size={16} />
                      : <ChevronRight size={16} />
                    }
                    {ins.presentaciones.length} presentacion{ins.presentaciones.length !== 1 ? 'es' : ''}
                  </button>
                  {expanded[ins.id] && (
                    <div className="mt-2 space-y-1">
                      {ins.presentaciones.map((p) => (
                        <div key={p.id} className="flex items-center justify-between text-xs text-stone-600 py-1">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={async () => {
                                if (p.es_principal) return;
                                try {
                                  await api.put(`/insumos/${ins.id}/presentaciones/${p.id}`, { es_principal: true });
                                  toast.success(`"${p.nombre}" es ahora la principal`);
                                  loadInsumos();
                                } catch (e) { toast.error(e.message); }
                              }}
                              className={`text-[9px] px-1 py-0.5 rounded ${p.es_principal ? 'text-emerald-600' : 'text-stone-300'}`}
                            >{p.es_principal ? '★' : '☆'}</button>
                            <span className="font-medium">{p.nombre}</span>
                          </div>
                          <span className="text-stone-400">{p.cantidad} {p.unidad} — S/ {parseFloat(p.precio || 0).toFixed(2)}</span>
                        </div>
                      ))}
                      <AddPresentacionForm insumoId={ins.id} insumoNombre={ins.nombre} onAdded={() => loadInsumos()} />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className={`${cx.card} hidden lg:block overflow-hidden`}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-stone-200">
              <th className={cx.th + ' w-8'}></th>
              <th className={cx.th}>Nombre</th>
              <th className={cx.th}>Presentacion</th>
              <th className={cx.th}>Unidad</th>
              <th className={cx.th}>Precio</th>
              <th className={cx.th}>Costo Unitario (WAC)</th>
              <th className={cx.th + ' text-right'}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((ins, idx) => {
              const isEditing = editingId === (ins._new ? 'new' : ins.id);
              if (isEditing) {
                return (
                  <tr key={ins.id || `new-${idx}`} className="border-b border-[var(--accent)]/30">
                    <td className={cx.td}></td>
                    <td className={cx.td}><input type="text" value={editData.nombre} onChange={(e) => setEditData({ ...editData, nombre: e.target.value })} onBlur={(e) => { const v = e.target.value.trim(); if (v) setEditData({ ...editData, nombre: v.charAt(0).toUpperCase() + v.slice(1) }); }} className={cx.input} autoFocus /></td>
                    <td className={cx.td}><input type="number" value={editData.cantidad_presentacion} onChange={(e) => setEditData({ ...editData, cantidad_presentacion: e.target.value })} className={cx.input} /></td>
                    <td className={cx.td}>
                      <CustomSelect
                        value={editData.unidad_medida}
                        onChange={(v) => setEditData({ ...editData, unidad_medida: v })}
                        options={UNIDADES.map(u => ({ value: u, label: u }))}
                      />
                    </td>
                    <td className={cx.td}><input type="number" step="0.01" value={editData.precio_presentacion} onChange={(e) => setEditData({ ...editData, precio_presentacion: e.target.value })} className={cx.input} /></td>
                    <td className={cx.td + ' text-[var(--accent)] font-semibold font-mono text-xs'}>
                      S/ {costoUnitario(editData).toFixed(3)}
                    </td>
                    <td className={cx.td + ' text-right'}>
                      <div className="flex justify-end gap-1">
                        <button onClick={saveEdit} className={cx.btnIcon + ' text-[var(--success)] hover:text-[var(--success)]'}><Save size={16} /></button>
                        <button onClick={cancelEdit} className={cx.btnIcon}><X size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              }
              return (
                <React.Fragment key={ins.id}>
                  <tr className={cx.tr}>
                    <td className={cx.td}>
                      {ins.presentaciones?.length > 0 && (
                        <button
                          onClick={() => toggleExpanded(ins.id)}
                          className="p-0.5 rounded hover:bg-stone-100 transition-colors duration-150 text-stone-400 hover:text-stone-600"
                          title={expanded[ins.id] ? 'Ocultar presentaciones' : 'Ver presentaciones'}
                        >
                          {expanded[ins.id]
                            ? <ChevronDown size={16} />
                            : <ChevronRight size={16} />
                          }
                        </button>
                      )}
                    </td>
                    <td className={cx.td + ' text-stone-800 font-medium'}>{ins.nombre}</td>
                    <td className={cx.td + ' text-stone-600'}>{ins.cantidad_presentacion}</td>
                    <td className={cx.td + ' text-stone-600'}>{ins.unidad_medida}</td>
                    <td className={cx.td + ' text-stone-600'}>{formatCurrency(ins.precio_presentacion)}</td>
                    <td className={cx.td + ' text-[var(--accent)] font-semibold font-mono text-xs'}>
                      S/ {costoUnitario(ins).toFixed(3)}/{ins.unidad_base || ins.unidad_medida}
                      {tieneWAC(ins) && <span className="text-[10px] text-teal-600 ml-1">WAC</span>}
                    </td>
                    <td className={cx.td + ' text-right'}>
                      <div className="flex justify-end gap-1">
                        <button onClick={() => loadPriceHistory(ins.id)} className={cx.btnIcon} title="Historial de precios"><TrendingUp size={16} /></button>
                        <button onClick={() => startEdit(ins)} className={cx.btnIcon}><Pencil size={16} /></button>
                        <button onClick={() => setDeleteTarget(ins)} className={cx.btnIcon + ' hover:text-rose-600'}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                  {expanded[ins.id] && ins.presentaciones?.length > 0 && (
                    <tr key={`${ins.id}-pres`}>
                      <td colSpan={7} className="px-4 py-3 bg-stone-50">
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Presentaciones</p>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-stone-200">
                                  <th className="text-left py-1 pr-4 text-[10px] font-semibold text-stone-400 uppercase flex-1">Nombre</th>
                                  <th className="text-right py-1 pr-4 text-[10px] font-semibold text-stone-400 uppercase w-24">Cantidad</th>
                                  <th className="text-left py-1 pr-4 text-[10px] font-semibold text-stone-400 uppercase w-20">Unidad</th>
                                  <th className="text-right py-1 pr-4 text-[10px] font-semibold text-stone-400 uppercase w-28">Precio</th>
                                  <th className="text-right py-1 pr-4 text-[10px] font-semibold text-stone-400 uppercase w-32">Costo/unidad</th>
                                  <th className="text-left py-1 text-[10px] font-semibold text-stone-400 uppercase w-24">Principal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {ins.presentaciones.map((p) => (
                                  <tr key={p.id} className="border-b border-stone-100 last:border-0">
                                    <td className="py-1.5 pr-4 text-stone-700 font-medium">{p.nombre}</td>
                                    <td className="py-1.5 pr-4 text-right text-stone-600">{p.cantidad}</td>
                                    <td className="py-1.5 pr-4 text-stone-500">{p.unidad}</td>
                                    <td className="py-1.5 pr-4 text-right text-stone-600">S/ {parseFloat(p.precio || 0).toFixed(2)}</td>
                                    <td className="py-1.5 pr-4 text-right font-mono text-xs text-stone-700">
                                      {p.precio_por_unidad ? `S/ ${parseFloat(p.precio_por_unidad).toFixed(3)}` : '—'}
                                    </td>
                                    <td className="py-1.5">
                                      <div className="flex items-center gap-2">
                                        {p.es_principal ? (
                                          <span className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600" title="Principal">
                                            <Pin size={16} />
                                          </span>
                                        ) : (
                                          <>
                                            <button onClick={async () => { try { await api.put(`/insumos/${ins.id}/presentaciones/${p.id}`, { es_principal: true }); toast.success('Principal actualizado'); loadInsumos(); } catch (e) { toast.error(e.message); } }}
                                              className="w-7 h-7 rounded-lg bg-stone-50 flex items-center justify-center text-stone-300 hover:bg-emerald-50 hover:text-emerald-500 transition-colors" title="Hacer principal">
                                              <Pin size={16} />
                                            </button>
                                            <button onClick={async () => { if (!confirm(`¿Eliminar "${p.nombre}"?`)) return; try { await api.del(`/insumos/${ins.id}/presentaciones/${p.id}`); toast.success('Eliminada'); loadInsumos(); } catch (e) { toast.error(e.message); } }}
                                              className="w-7 h-7 rounded-lg bg-stone-50 flex items-center justify-center text-stone-300 hover:bg-rose-50 hover:text-rose-500 transition-colors" title="Eliminar">
                                              <Trash2 size={16} />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <AddPresentacionForm insumoId={ins.id} insumoNombre={ins.nombre} onAdded={() => loadInsumos()} />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Price history modal */}
      <AnimatePresence>
      {priceHistory && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setPriceHistory(null)}
          />
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md max-w-[95vw] max-h-[80vh] overflow-y-auto p-6">
            <h3 className="text-lg font-bold text-stone-900 mb-1">{priceHistory.insumo?.nombre}</h3>
            <p className="text-xs text-stone-400 mb-4">Historial de precios de compra</p>

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              <div className="bg-stone-50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-stone-400 uppercase">WAC</p>
                <p className="text-sm font-bold text-stone-800">{formatCurrency(priceHistory.wac)}/{priceHistory.insumo?.unidad_base}</p>
              </div>
              <div className="bg-stone-50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-stone-400 uppercase">Ultimo</p>
                <p className="text-sm font-bold text-stone-800">{formatCurrency(priceHistory.ultimo_precio)}/{priceHistory.insumo?.unidad_base}</p>
              </div>
              <div className="bg-stone-50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-stone-400 uppercase">Rango</p>
                <p className="text-xs font-medium text-stone-600">{formatCurrency(priceHistory.precio_minimo)} - {formatCurrency(priceHistory.precio_maximo)}</p>
              </div>
            </div>

            {/* History table */}
            {priceHistory.num_compras > 0 && (
              <div className="border border-stone-100 rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-stone-50">
                      <th className="text-left px-3 py-2 text-[10px] font-semibold text-stone-400 uppercase">Fecha</th>
                      <th className="text-center px-3 py-2 text-[10px] font-semibold text-stone-400 uppercase">Cant.</th>
                      <th className="text-right px-3 py-2 text-[10px] font-semibold text-stone-400 uppercase">Precio</th>
                      <th className="text-right px-3 py-2 text-[10px] font-semibold text-stone-400 uppercase">Costo/base</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priceHistory.historial.map((h, i) => (
                      <tr key={i} className="border-t border-stone-50">
                        <td className="px-3 py-2 text-stone-600">{formatDate(h.fecha)}</td>
                        <td className="px-3 py-2 text-center text-stone-500">{parseFloat(h.cantidad)}</td>
                        <td className="px-3 py-2 text-right text-stone-800">{formatCurrency(h.precio_total)}</td>
                        <td className="px-3 py-2 text-right font-medium text-stone-800">{Number(h.costo_por_base).toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {priceHistory.num_compras === 0 && (
              <p className="text-center text-stone-400 text-sm py-8">Sin historial de compras</p>
            )}

            <button onClick={() => setPriceHistory(null)} className={cx.btnSecondary + ' w-full mt-4'}>Cerrar</button>
          </div>
          </motion.div>
        </>
      )}
      </AnimatePresence>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar insumo"
        message={`Estas seguro de eliminar "${deleteTarget?.nombre}"?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
