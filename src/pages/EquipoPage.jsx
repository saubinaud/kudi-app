import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { cx } from '../styles/tokens';
import { formatCurrency } from '../utils/format';
import SegmentedControl from '../components/SegmentedControl';
import CustomSelect from '../components/CustomSelect';
import ConfirmDialog from '../components/ConfirmDialog';
import InfoTip from '../components/InfoTip';
import UsuariosPanel from '../components/UsuariosPanel';
import {
  Users, Plus, Pencil, Trash2, Check, X, Loader2, Factory, Headphones, Briefcase, Link2,
} from 'lucide-react';

// Las 3 secciones de la planilla. Cada una está predestinada a conectar con la
// naturaleza del gasto (conexión real pendiente — por ahora solo estructura).
const SECCIONES = [
  { key: 'produccion', label: 'Producción', sub: 'Mano de obra → costo de productos', icon: Factory, color: 'bg-violet-50 text-violet-600' },
  { key: 'operativa', label: 'Operativa', sub: 'Atención al cliente → gastos operativos', icon: Headphones, color: 'bg-sky-50 text-sky-600' },
  { key: 'administrativa', label: 'Administrativa', sub: 'Gestión → gastos administrativos', icon: Briefcase, color: 'bg-teal-50 text-teal-700' },
];

const TABS = [
  { key: 'todo', label: 'Todo' },
  { key: 'produccion', label: 'Producción' },
  { key: 'operativa', label: 'Operativa' },
  { key: 'administrativa', label: 'Administrativa' },
  { key: 'usuarios', label: 'Usuarios' },
];

export default function EquipoPage() {
  const api = useApi();
  const toast = useToast();
  const { user } = useAuth();
  const simbolo = user?.simbolo || 'S/';

  const [tab, setTab] = useState('todo');
  const [personal, setPersonal] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadPersonal() {
    setLoading(true);
    try {
      const res = await api.get('/personal');
      setPersonal(res.data || res || []);
    } catch { toast.error('Error cargando personal'); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadPersonal(); }, []); // eslint-disable-line

  const totalPlanilla = useMemo(
    () => personal.reduce((s, p) => s + (Number(p.sueldo) || 0), 0),
    [personal]
  );

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header — sin subtítulo de página; el contexto va en un InfoTip */}
      <div className="flex items-center gap-2.5 mb-5">
        <Users size={22} className="text-stone-400" strokeWidth={1.75} />
        <h2 className="text-xl font-bold text-stone-900">Equipo</h2>
        <InfoTip wide text="Tu planilla organizada por sección. Cada persona con su rol y sueldo. Más adelante cada sección se conecta con tus gastos y el costeo: Producción → mano de obra, Operativa → gastos operativos, Administrativa → gastos administrativos." />
      </div>

      {/* Tabs */}
      <div className="mb-5">
        <SegmentedControl options={TABS} value={tab} onChange={setTab} layoutId="equipo-tab" size="sm" />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          {tab === 'usuarios' ? (
            <UsuariosPanel />
          ) : loading ? (
            <div className="space-y-3">
              <div className={cx.skeleton + ' h-28'} />
              <div className={cx.skeleton + ' h-28'} />
            </div>
          ) : (
            <>
              <PersonalManager
                seccion={tab}
                personal={personal}
                reload={loadPersonal}
                api={api}
                toast={toast}
                simbolo={simbolo}
              />
              {tab === 'todo' && personal.length > 0 && (
                <div className="mt-4 flex items-center justify-between rounded-xl bg-[var(--accent-light)] border border-emerald-100 px-5 py-3.5">
                  <span className="text-sm font-semibold text-stone-600">Total planilla / mes</span>
                  <span className="text-lg font-bold text-stone-800 tabular-nums">{formatCurrency(totalPlanilla)}</span>
                </div>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ── Gestión de personal por sección (un solo card, secciones divididas por líneas) ──
function PersonalManager({ seccion, personal, reload, api, toast, simbolo }) {
  const seccionesAMostrar = seccion === 'todo' ? SECCIONES : SECCIONES.filter((s) => s.key === seccion);

  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [addSeccion, setAddSeccion] = useState(null);
  const [addForm, setAddForm] = useState({ nombre: '', rol: '', sueldo: '' });
  const [creating, setCreating] = useState(false);
  const [delTarget, setDelTarget] = useState(null);

  const startEdit = (p) => {
    setAddSeccion(null);
    setEditId(p.id);
    setEditForm({ nombre: p.nombre, rol: p.rol || '', sueldo: p.sueldo != null ? Number(p.sueldo) : '', seccion: p.seccion });
  };

  const saveEdit = async (id) => {
    if (!editForm.nombre?.trim()) { toast.error('Ponle un nombre'); return; }
    setSavingEdit(true);
    try {
      await api.put(`/personal/${id}`, {
        nombre: editForm.nombre.trim(),
        rol: editForm.rol?.trim() || null,
        sueldo: editForm.sueldo !== '' ? Number(editForm.sueldo) : 0,
        seccion: editForm.seccion,
      });
      setEditId(null);
      toast.success('Guardado');
      await reload();
    } catch (err) { toast.error(err.message || 'Error guardando'); }
    finally { setSavingEdit(false); }
  };

  const openAdd = (secKey) => {
    setEditId(null);
    setAddSeccion(secKey);
    setAddForm({ nombre: '', rol: '', sueldo: '' });
  };

  const handleCreate = async () => {
    if (!addForm.nombre.trim()) { toast.error('Ponle un nombre'); return; }
    setCreating(true);
    try {
      await api.post('/personal', {
        nombre: addForm.nombre.trim(),
        rol: addForm.rol.trim() || null,
        sueldo: addForm.sueldo !== '' ? Number(addForm.sueldo) : 0,
        seccion: addSeccion,
      });
      setAddForm({ nombre: '', rol: '', sueldo: '' });
      setAddSeccion(null);
      toast.success('Persona agregada');
      await reload();
    } catch (err) { toast.error(err.message || 'Error creando'); }
    finally { setCreating(false); }
  };

  const handleDelete = async () => {
    const id = delTarget?.id;
    setDelTarget(null);
    if (!id) return;
    try {
      await api.del(`/personal/${id}`);
      toast.success('Persona eliminada');
      await reload();
    } catch (err) { toast.error(err.message || 'Error eliminando'); }
  };

  return (
    <div className={cx.card + ' divide-y divide-stone-100 overflow-hidden'}>
      {seccionesAMostrar.map((sec) => {
        const items = personal.filter((p) => p.seccion === sec.key);
        const subtotal = items.reduce((s, p) => s + (Number(p.sueldo) || 0), 0);
        const Icon = sec.icon;
        return (
          <div key={sec.key} className="px-5 py-4">
            {/* Header de sección */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-start gap-2.5 min-w-0">
                <span className={`flex-shrink-0 mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-lg ${sec.color}`}>
                  <Icon size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-900">{sec.label}</p>
                  <p className="text-[11px] text-stone-400">{sec.sub}</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-stone-800 tabular-nums">{formatCurrency(subtotal)}</p>
                <p className="text-[10px] text-stone-400">{items.length} persona{items.length !== 1 ? 's' : ''}</p>
              </div>
            </div>

            {/* Lista de personas — separadas por líneas, no cajas */}
            {items.length > 0 && (
              <div className="divide-y divide-stone-100 mb-1">
                {items.map((p, i) => (
                  editId === p.id ? (
                    <div key={p.id} className="py-3">
                      <div className="rounded-lg bg-stone-50/70 p-3 space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className={cx.label}>Nombre</label>
                            <input type="text" value={editForm.nombre} onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })} className={cx.input + ' text-sm'} placeholder="Nombre" />
                          </div>
                          <div>
                            <label className={cx.label}>Rol / título</label>
                            <input type="text" value={editForm.rol} onChange={(e) => setEditForm({ ...editForm, rol: e.target.value })} className={cx.input + ' text-sm'} placeholder="Ej: Chef" />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className={cx.label}>Sueldo / mes ({simbolo})</label>
                            <input type="number" step="0.01" min="0" inputMode="decimal" value={editForm.sueldo} onChange={(e) => setEditForm({ ...editForm, sueldo: e.target.value })} className={cx.input + ' text-sm'} placeholder="0.00" />
                          </div>
                          <div>
                            <label className={cx.label}>Sección</label>
                            <CustomSelect
                              value={editForm.seccion}
                              onChange={(v) => setEditForm({ ...editForm, seccion: v })}
                              options={SECCIONES.map((s) => ({ value: s.key, label: s.label }))}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-0.5">
                          <motion.button whileTap={{ scale: 0.97 }} onClick={() => saveEdit(p.id)} disabled={savingEdit} className={cx.btnPrimary + ' flex items-center gap-1.5 min-h-[44px]'}>
                            {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Guardar
                          </motion.button>
                          <button onClick={() => setEditId(null)} className={cx.btnSecondary + ' min-h-[44px]'}><X size={14} /> Cancelar</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15, delay: Math.min(i * 0.03, 0.2) }}
                      className="flex items-center justify-between gap-3 py-2.5 group"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-stone-800 truncate">{p.nombre}</p>
                          {p.cuenta_usuario_id && (
                            <span className={cx.badge('bg-stone-100 text-stone-500') + ' flex items-center gap-0.5'}><Link2 size={10} /> cuenta</span>
                          )}
                        </div>
                        {p.rol && <p className="text-[11px] text-stone-400 truncate">{p.rol}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-sm font-medium text-stone-700 tabular-nums">{formatCurrency(p.sueldo)}</span>
                        <button onClick={() => startEdit(p)} className={cx.btnIcon + ' lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-100'} title="Editar"><Pencil size={15} /></button>
                        <button onClick={() => setDelTarget(p)} className="p-2 text-stone-300 hover:text-rose-500 rounded-lg transition-colors duration-100 lg:opacity-0 lg:group-hover:opacity-100" title="Eliminar"><Trash2 size={15} /></button>
                      </div>
                    </motion.div>
                  )
                ))}
              </div>
            )}

            {items.length === 0 && addSeccion !== sec.key && (
              <p className="text-xs text-stone-400 py-1.5">Nadie en {sec.label.toLowerCase()} todavía.</p>
            )}

            {/* Agregar */}
            {addSeccion === sec.key ? (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className="mt-2 rounded-lg border border-dashed border-stone-300 p-3 space-y-2"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className={cx.label}>Nombre</label>
                    <input type="text" autoFocus value={addForm.nombre} onChange={(e) => setAddForm({ ...addForm, nombre: e.target.value })} className={cx.input + ' text-sm'} placeholder="Nombre de la persona" />
                  </div>
                  <div>
                    <label className={cx.label}>Rol / título</label>
                    <input type="text" value={addForm.rol} onChange={(e) => setAddForm({ ...addForm, rol: e.target.value })} className={cx.input + ' text-sm'} placeholder="Ej: Cocinero" />
                  </div>
                </div>
                <div>
                  <label className={cx.label}>Sueldo / mes ({simbolo})</label>
                  <input type="number" step="0.01" min="0" inputMode="decimal" value={addForm.sueldo} onChange={(e) => setAddForm({ ...addForm, sueldo: e.target.value })} className={cx.input + ' text-sm'} placeholder="0.00" />
                </div>
                <div className="flex gap-2">
                  <motion.button whileTap={{ scale: 0.97 }} onClick={handleCreate} disabled={creating || !addForm.nombre.trim()} className={cx.btnPrimary + ' flex items-center gap-1.5 min-h-[44px]'}>
                    {creating ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Agregar
                  </motion.button>
                  <button onClick={() => setAddSeccion(null)} className={cx.btnSecondary + ' min-h-[44px]'}><X size={14} /> Cancelar</button>
                </div>
              </motion.div>
            ) : (
              <button onClick={() => openAdd(sec.key)} className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent)] hover:opacity-80 transition-opacity duration-100 min-h-[44px]">
                <Plus size={15} /> Agregar a {sec.label}
              </button>
            )}
          </div>
        );
      })}

      <ConfirmDialog
        open={!!delTarget}
        title="Eliminar persona"
        message={delTarget ? `¿Eliminar a "${delTarget.nombre}" de la planilla?${delTarget.cuenta_usuario_id ? ' Su cuenta de acceso se desvincula (no se elimina).' : ''}` : ''}
        confirmText="Eliminar"
        confirmStyle="danger"
        onConfirm={handleDelete}
        onCancel={() => setDelTarget(null)}
      />
    </div>
  );
}
