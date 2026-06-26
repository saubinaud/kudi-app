import { useState, useEffect, useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { cx } from '../styles/tokens';
import { formatCurrency } from '../utils/format';
import SegmentedControl from '../components/SegmentedControl';
import CustomSelect from '../components/CustomSelect';
import ConfirmDialog from '../components/ConfirmDialog';
import UsuariosPanel from '../components/UsuariosPanel';
import {
  Users, Plus, Pencil, Trash2, Check, X, Loader2, Factory, Headphones, Briefcase, Link2,
} from 'lucide-react';

// Las 3 secciones de la planilla. Cada una está predestinada a conectar con la
// naturaleza del gasto (conexión real pendiente — por ahora solo estructura).
const SECCIONES = [
  { key: 'produccion', label: 'Producción', sub: 'Mano de obra → costo de productos', icon: Factory, color: 'bg-violet-50 text-violet-600' },
  { key: 'operativa', label: 'Operativa', sub: 'Atención al cliente → gastos operativos', icon: Headphones, color: 'bg-sky-50 text-sky-600' },
  { key: 'administrativa', label: 'Administrativa', sub: 'Gestión → gastos administrativos', icon: Briefcase, color: 'bg-stone-100 text-stone-500' },
];
const SECCION_BY_KEY = Object.fromEntries(SECCIONES.map((s) => [s.key, s]));

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
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <Users size={20} className="text-stone-400" />
        <h2 className="text-xl font-bold text-stone-900">Equipo</h2>
      </div>
      <p className="text-stone-500 text-sm mb-5">
        Tu planilla organizada por sección. Cada persona y su sueldo; luego se conectará con tus gastos y el costeo.
      </p>

      {/* Tabs */}
      <div className="mb-5">
        <SegmentedControl options={TABS} value={tab} onChange={setTab} layoutId="equipo-tab" size="sm" />
      </div>

      {tab === 'usuarios' ? (
        <UsuariosPanel />
      ) : loading ? (
        <div className="space-y-3">
          <div className={cx.skeleton + ' h-24'} />
          <div className={cx.skeleton + ' h-24'} />
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
            <div className="mt-4 flex items-center justify-between rounded-xl bg-[var(--accent-light)] border border-emerald-100 px-4 py-3">
              <span className="text-sm font-medium text-stone-600">Total planilla / mes</span>
              <span className="text-base font-bold text-stone-800 tabular-nums">{formatCurrency(totalPlanilla)}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Gestión de personal por sección ──
function PersonalManager({ seccion, personal, reload, api, toast, simbolo }) {
  const seccionesAMostrar = seccion === 'todo' ? SECCIONES : SECCIONES.filter((s) => s.key === seccion);

  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [addSeccion, setAddSeccion] = useState(null); // key de la sección donde se está agregando
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
    <div className="space-y-4">
      {seccionesAMostrar.map((sec) => {
        const items = personal.filter((p) => p.seccion === sec.key);
        const subtotal = items.reduce((s, p) => s + (Number(p.sueldo) || 0), 0);
        const Icon = sec.icon;
        return (
          <div key={sec.key} className={cx.card + ' p-5'}>
            {/* Header de sección */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <span className={`flex-shrink-0 mt-0.5 inline-flex items-center justify-center w-7 h-7 rounded-lg ${sec.color}`}>
                  <Icon size={15} />
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

            {/* Lista */}
            {items.length === 0 && addSeccion !== sec.key ? (
              <p className="text-xs text-stone-400 py-2">Nadie en esta sección todavía.</p>
            ) : (
              <div className="space-y-2">
                {items.map((p) => (
                  <div key={p.id} className="rounded-lg border border-stone-200 px-3 py-2.5">
                    {editId === p.id ? (
                      <div className="space-y-2">
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
                        <div className="flex gap-2">
                          <button onClick={() => saveEdit(p.id)} disabled={savingEdit} className={cx.btnPrimary + ' flex items-center gap-1.5 min-h-[44px]'}>
                            {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Guardar
                          </button>
                          <button onClick={() => setEditId(null)} className={cx.btnSecondary + ' min-h-[44px]'}><X size={14} /> Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-stone-800 truncate">{p.nombre}</p>
                            {p.cuenta_usuario_id && (
                              <span className={cx.badge('bg-stone-100 text-stone-500') + ' flex items-center gap-0.5'}><Link2 size={10} /> cuenta</span>
                            )}
                          </div>
                          {p.rol && <p className="text-[11px] text-stone-400 truncate">{p.rol}</p>}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-sm text-stone-700 tabular-nums">{formatCurrency(p.sueldo)}</span>
                          <button onClick={() => startEdit(p)} className={cx.btnIcon} title="Editar"><Pencil size={15} /></button>
                          <button onClick={() => setDelTarget(p)} className="p-2 text-stone-300 hover:text-rose-500 rounded-lg transition-colors" title="Eliminar"><Trash2 size={15} /></button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Agregar */}
            {addSeccion === sec.key ? (
              <div className="mt-3 rounded-lg border border-dashed border-stone-300 p-3 space-y-2">
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
                  <button onClick={handleCreate} disabled={creating || !addForm.nombre.trim()} className={cx.btnPrimary + ' flex items-center gap-1.5 min-h-[44px]'}>
                    {creating ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Agregar
                  </button>
                  <button onClick={() => setAddSeccion(null)} className={cx.btnSecondary + ' min-h-[44px]'}><X size={14} /> Cancelar</button>
                </div>
              </div>
            ) : (
              <button onClick={() => openAdd(sec.key)} className="mt-3 flex items-center gap-1.5 text-sm font-medium text-[var(--accent)] hover:opacity-80 min-h-[44px]">
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
