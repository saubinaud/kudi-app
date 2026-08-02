import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { cx } from '../styles/tokens';
import CustomSelect from '../components/CustomSelect';
import ConfirmDialog from '../components/ConfirmDialog';
import InfoTip from '../components/InfoTip';
import { Plus, X, Trash2, Pencil, BookOpen, Search } from 'lucide-react';

// Cartas — dimensión independiente del canal (decisión CFO). La carta se asigna
// por PRODUCTO; el Estado de Resultados desglosa los ingresos según estas cartas.
export default function CartasPage() {
  const api = useApi();
  const toast = useToast();
  const [cartas, setCartas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [nombre, setNombre] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([api.get('/cartas'), api.get('/cartas/productos')]);
      setCartas(c.data || []);
      setProductos(p.data || []);
    } catch {
      toast.error('Error cargando cartas');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const cartaOptions = useMemo(() => ([
    { value: '', label: 'Sin carta' },
    ...cartas.filter((c) => c.activa).map((c) => ({ value: String(c.id), label: c.nombre })),
  ]), [cartas]);

  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return productos;
    return productos.filter((p) => p.nombre.toLowerCase().includes(q));
  }, [productos, busqueda]);

  const save = async () => {
    if (!nombre.trim()) return toast.error('Falta el nombre');
    setSaving(true);
    try {
      if (editing) await api.put(`/cartas/${editing.id}`, { nombre: nombre.trim() });
      else await api.post('/cartas', { nombre: nombre.trim(), orden: cartas.length });
      toast.success(editing ? 'Carta actualizada' : 'Carta creada');
      setShowModal(false);
      load();
    } catch (e) {
      toast.error(e.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.del(`/cartas/${deleteTarget.id}`);
      toast.success('Carta eliminada');
      setDeleteTarget(null);
      load();
    } catch {
      toast.error('No se pudo eliminar');
    }
  };

  const asignar = async (productoId, cartaId) => {
    try {
      await api.put('/cartas/asignar/producto', { producto_id: productoId, carta_id: cartaId ? parseInt(cartaId, 10) : null });
      setProductos((prev) => prev.map((p) => (p.id === productoId ? { ...p, carta_id: cartaId ? parseInt(cartaId, 10) : null } : p)));
      setCartas((prev) => prev); // conteos se refrescan al recargar; evitamos un fetch extra
    } catch {
      toast.error('No se pudo asignar');
    }
  };

  return (
    <div className="max-w-5xl mx-auto lg:px-10 lg:py-6 px-4 py-4">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-stone-800 flex items-center gap-2">
          Cartas
          <InfoTip wide text="Tus cartas o menús (Salón, Delivery, Catering, Eventos…). Asigna cada producto a una carta y el Estado de Resultados desglosará tus ingresos por carta. Es independiente del canal de venta." />
        </h1>
        <button onClick={() => { setEditing(null); setNombre(''); setShowModal(true); }} className={cx.btnPrimary + ' px-4 py-2 text-sm flex items-center gap-1.5 min-h-[44px]'}>
          <Plus size={16} /> Nueva carta
        </button>
      </div>

      {loading ? (
        <div className={cx.skeleton + ' h-64'} />
      ) : (
        <>
          {/* Cartas */}
          {cartas.filter((c) => c.activa).length === 0 ? (
            <div className="text-center py-10 text-stone-400 text-sm">Crea tu primera carta (ej. "Carta Salón", "Delivery").</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
              {cartas.filter((c) => c.activa).map((c, i) => (
                <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className={cx.card + ' px-4 py-3 flex items-center gap-3'}>
                  <div className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center text-stone-500 shrink-0">
                    <BookOpen size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-stone-800 truncate">{c.nombre}</div>
                    <div className="text-[12px] text-stone-400">{c.num_productos} producto{c.num_productos !== 1 ? 's' : ''}</div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => { setEditing(c); setNombre(c.nombre); setShowModal(true); }} className={cx.btnIcon} aria-label="Editar"><Pencil size={15} /></button>
                    <button onClick={() => setDeleteTarget(c)} className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" aria-label="Eliminar"><Trash2 size={15} /></button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Asignación de productos */}
          <div className="flex items-center justify-between mb-3 gap-3">
            <h2 className="text-sm font-semibold text-stone-700">Productos por carta</h2>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input className={cx.input + ' pl-8 py-1.5 text-sm w-48 md:w-64'} placeholder="Buscar producto…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </div>
          </div>
          <div className={cx.card + ' divide-y divide-stone-100'}>
            {productosFiltrados.length === 0 ? (
              <div className="text-center py-8 text-stone-400 text-sm">Sin productos.</div>
            ) : productosFiltrados.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-sm text-stone-700 flex-1 min-w-0 truncate">{p.nombre}</span>
                <div className="w-44 shrink-0">
                  <CustomSelect
                    compact
                    value={p.carta_id ? String(p.carta_id) : ''}
                    onChange={(v) => asignar(p.id, v)}
                    options={cartaOptions}
                    placeholder="Sin carta"
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && setShowModal(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.18 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-stone-800">{editing ? 'Editar carta' : 'Nueva carta'}</h2>
              <button onClick={() => setShowModal(false)} className={cx.btnIcon}><X size={18} /></button>
            </div>
            <label className={cx.label}>Nombre</label>
            <input className={cx.input + ' w-full min-h-[44px]'} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Carta Salón" autoFocus onKeyDown={(e) => e.key === 'Enter' && save()} />
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setShowModal(false)} className={cx.btnSecondary + ' px-4 py-2 text-sm'}>Cancelar</button>
              <button onClick={save} disabled={saving} className={cx.btnPrimary + ' px-5 py-2 text-sm disabled:opacity-50'}>{saving ? 'Guardando…' : (editing ? 'Guardar' : 'Crear')}</button>
            </div>
          </motion.div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar carta"
        message={`¿Eliminar "${deleteTarget?.nombre}"? Los productos asignados quedarán "Sin carta".`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
