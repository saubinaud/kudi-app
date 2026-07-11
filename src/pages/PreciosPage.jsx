// @deprecated · HUÉRFANO (jul-2026) — no está ruteado ni enlazado.
// La gestión de cartas (crear/renombrar/borrar/asignar productos) ya vive en
// DashboardPage (config de cartas). Candidato a eliminar.
import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { cx } from '../styles/tokens';
import ConfirmDialog from '../components/ConfirmDialog';
import { Plus, Pencil, Trash2, X, Tags } from 'lucide-react';

const emptyForm = {
  nombre: '',
  descripcion: '',
};

export default function PreciosPage() {
  const api = useApi();
  const toast = useToast();

  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadCategorias = async () => {
    try {
      const res = await api.get('/precios/categorias');
      setCategorias(res?.data || res || []);
    } catch {
      toast.error('Error cargando categorías de precio');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCategorias(); }, []); // eslint-disable-line

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({
      nombre: c.nombre || '',
      descripcion: c.descripcion || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) { toast.error('Nombre es requerido'); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/precios/categorias/${editing.id}`, form);
        toast.success('Categoría actualizada');
      } else {
        await api.post('/precios/categorias', form);
        toast.success('Categoría creada');
      }
      setModalOpen(false);
      loadCategorias();
    } catch (err) {
      toast.error(err.message || 'Error guardando categoría');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.del(`/precios/categorias/${deleteTarget.id}`);
      toast.success('Categoría eliminada');
      loadCategorias();
    } catch {
      toast.error('Error eliminando categoría');
    } finally {
      setDeleteTarget(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto pb-12 space-y-4">
        <div className={cx.skeleton + ' h-10 w-48'} />
        <div className={cx.skeleton + ' h-64'} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <h1 className="text-xl font-bold text-stone-900">Categorías de Precio</h1>
        <button onClick={openNew} className={cx.btnPrimary + ' flex items-center gap-2'}>
          <Plus size={14} /> Nueva categoría
        </button>
      </div>

      {/* List */}
      {categorias.length === 0 ? (
        <div className={`${cx.card} p-12 text-center`}>
          <Tags size={40} className="text-stone-300 mx-auto mb-4" />
          <p className="text-stone-400 text-sm">No hay categorías de precio registradas</p>
          <p className="text-stone-300 text-xs mt-1">Crea categorías como Carta, Mayorista, B2B, etc.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className={`${cx.card} overflow-hidden hidden sm:block`}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className={cx.th}>Nombre</th>
                  <th className={cx.th}>Descripción</th>
                  <th className={cx.th + ' text-center'}>Productos</th>
                  <th className={cx.th + ' text-right'}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {categorias.map((c) => (
                  <tr key={c.id} className={cx.tr}>
                    <td className={cx.td + ' font-medium text-stone-900'}>{c.nombre}</td>
                    <td className={cx.td + ' text-stone-500'}>{c.descripcion || '-'}</td>
                    <td className={cx.td + ' text-center text-stone-500'}>{c.num_productos ?? 0}</td>
                    <td className={cx.td + ' text-right'}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(c)} className={cx.btnIcon + ' !p-1'}>
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setDeleteTarget(c)} className={cx.btnIcon + ' !p-1 hover:text-rose-600'}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {categorias.map((c) => (
              <div key={c.id} className={`${cx.card} p-4`}>
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-900 truncate">{c.nombre}</p>
                    {c.descripcion && <p className="text-[11px] text-stone-500 mt-0.5">{c.descripcion}</p>}
                    <p className="text-[11px] text-stone-400 mt-0.5">{c.num_productos ?? 0} productos</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    <button onClick={() => openEdit(c)} className={cx.btnIcon + ' !p-1'}>
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setDeleteTarget(c)} className={cx.btnIcon + ' !p-1 hover:text-rose-600'}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-stone-900">
                  {editing ? 'Editar categoría' : 'Nueva categoría'}
                </h3>
                <button onClick={() => setModalOpen(false)} className={cx.btnIcon}>
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className={cx.label}>Nombre *</label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={(e) => setForm(f => ({ ...f, nombre: e.target.value }))}
                    className={cx.input}
                    placeholder="Ej: Carta, Mayorista, B2B"
                  />
                </div>
                <div>
                  <label className={cx.label}>Descripción</label>
                  <textarea
                    value={form.descripcion}
                    onChange={(e) => setForm(f => ({ ...f, descripcion: e.target.value }))}
                    className={cx.input + ' min-h-[60px]'}
                    placeholder="Descripción opcional de la categoría..."
                    rows={2}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-5">
                <button onClick={handleSave} disabled={saving} className={cx.btnPrimary + ' flex-1'}>
                  {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear categoría'}
                </button>
                <button onClick={() => setModalOpen(false)} className={cx.btnSecondary}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar categoría"
        message={`¿Estás seguro de eliminar "${deleteTarget?.nombre}"? Los precios asociados también se eliminarán.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
