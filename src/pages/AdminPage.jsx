import React, { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { cx } from '../styles/tokens';
import { formatDate, formatCurrency } from '../utils/format';
import {
  Users, UserPlus, Ban, CheckCircle, Copy, X, Settings, Trash2,
  BarChart3, CreditCard, Clock, TrendingUp, AlertCircle, Eye,
  Check, XCircle, Filter, MessageSquare, AlertTriangle, Bell, Send,
  ShieldCheck, FileText, Package, ShoppingCart, ChevronDown, ChevronUp,
} from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import CustomSelect from '../components/CustomSelect';

// ── Modules & permissions (copied from AdminUsuariosPage) ──
const ALL_MODULES = [
  { key: 'dashboard', label: 'Productos', group: 'Catalogo' },
  { key: 'cotizador', label: 'Nuevo producto', group: 'Catalogo', requires: ['insumos', 'materiales'] },
  { key: 'insumos', label: 'Insumos', group: 'Catalogo' },
  { key: 'materiales', label: 'Materiales', group: 'Catalogo' },
  { key: 'preparaciones', label: 'Recetas base', group: 'Catalogo' },
  { key: 'empaques', label: 'Empaques predet.', group: 'Catalogo' },
  { key: 'canales', label: 'Canales y Envio', group: 'Catalogo' },
  { key: 'ventas', label: 'Ventas', group: 'Ventas', requires: ['dashboard'] },
  { key: 'finanzas', label: 'Finanzas', group: 'Finanzas' },
  { key: 'facturacion', label: 'Facturacion', group: 'Facturacion', requires: ['ventas'] },
];
const DEFAULT_PERMISOS = ALL_MODULES.map((m) => m.key);

const TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { key: 'usuarios', label: 'Usuarios', icon: Users },
  { key: 'pagos', label: 'Pagos', icon: CreditCard },
  { key: 'registros', label: 'Registros', icon: Clock },
  { key: 'mensajes', label: 'Mensajes', icon: Bell },
  { key: 'feedback', label: 'Feedback', icon: MessageSquare },
  { key: 'errores', label: 'Errores', icon: AlertTriangle },
];

// ── Permission helpers ──
const cyclePermiso = (permisos, key) => {
  const hasKey = permisos.includes(key);
  const hasVitrina = permisos.includes(`~${key}`);
  if (hasKey) return [...permisos.filter(p => p !== key), `~${key}`];
  if (hasVitrina) return permisos.filter(p => p !== `~${key}`);
  const result = [...permisos, key];
  const mod = ALL_MODULES.find(m => m.key === key);
  if (mod?.requires) {
    for (const dep of mod.requires) {
      if (!result.includes(dep)) result.push(dep);
    }
  }
  return result;
};

const getPermisoState = (permisos, key) => {
  if (permisos.includes(key)) return 'full';
  if (permisos.includes(`~${key}`)) return 'vitrina';
  return 'hidden';
};

const PERM_LABELS = { full: 'Completo', vitrina: 'Vitrina', hidden: 'Oculto' };
const PERM_COLORS = { full: 'bg-emerald-100 text-emerald-700', vitrina: 'bg-amber-100 text-amber-700', hidden: 'bg-stone-100 text-stone-400' };

// ── Relative time ──
function timeAgo(dateStr) {
  if (!dateStr) return '-';
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now - d;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `hace ${days}d`;
  return formatDate(dateStr);
}

// ══════════════════════════════════════════════════════════════
// Tab 1: Dashboard
// ══════════════════════════════════════════════════════════════
function DashboardTab({ onNavigate }) {
  const api = useApi();
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get('/admin/stats');
        setStats(data.data || data);
      } catch {
        toast.error('Error cargando estadisticas');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[1,2,3,4,5,6,7,8].map(i => <div key={i} className={cx.skeleton + ' h-24'} />)}</div>;
  if (!stats) return null;

  const cards = [
    { label: 'Total usuarios', value: stats.total_usuarios, icon: Users, color: 'text-stone-700', tab: 'usuarios' },
    { label: 'Registros hoy', value: stats.registros_hoy, icon: UserPlus, color: 'text-blue-600', tab: 'registros' },
    { label: 'Registros semana', value: stats.registros_semana, icon: TrendingUp, color: 'text-indigo-600', tab: 'registros' },
    { label: 'Trials activos', value: stats.trials_activos, icon: Clock, color: 'text-amber-600', tab: 'usuarios' },
    { label: 'Trials expirados', value: stats.trials_expirados, icon: AlertCircle, color: 'text-rose-500', tab: 'usuarios' },
    { label: 'Planes Pro', value: stats.planes_pro, icon: CheckCircle, color: 'text-emerald-600', tab: 'usuarios' },
    { label: 'Pagos pendientes', value: stats.pagos_pendientes, icon: CreditCard, color: 'text-amber-600', badge: stats.pagos_pendientes > 0, tab: 'pagos' },
    { label: 'Cert. .p12 subidos', value: stats.cert_subidos, icon: ShieldCheck, color: 'text-violet-600', tab: 'usuarios' },
    { label: 'Facturación activa', value: stats.fact_habilitadas, icon: FileText, color: 'text-teal-600', tab: 'usuarios' },
    { label: 'Total productos', value: stats.total_productos, icon: Package, color: 'text-stone-500' },
    { label: 'Total ventas', value: stats.total_ventas, icon: ShoppingCart, color: 'text-stone-500' },
    { label: 'Errores hoy', value: stats.errores_hoy, icon: AlertTriangle, color: stats.errores_hoy > 0 ? 'text-rose-500' : 'text-stone-400', badge: stats.errores_hoy > 0, tab: 'errores' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} onClick={() => c.tab && onNavigate?.(c.tab)}
          className={`${cx.card} p-5 relative ${c.tab ? 'cursor-pointer hover:shadow-md transition-shadow duration-150' : ''}`}>
          <div className="flex items-center justify-between mb-2">
            <c.icon size={18} className={c.color} />
            {c.badge && (
              <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                {c.value}
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-stone-800">{c.value ?? 0}</p>
          <p className="text-xs text-stone-400 mt-0.5">{c.label}</p>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Tab 2: Usuarios (ported from AdminUsuariosPage)
// ══════════════════════════════════════════════════════════════
const PLAN_OPTIONS = [
  { value: 'trial', label: 'Trial', color: 'bg-amber-50 text-amber-600' },
  { value: 'independiente', label: 'Independiente · S/80', color: 'bg-blue-50 text-blue-600' },
  { value: 'emprendedor', label: 'Emprendedor · S/100', color: 'bg-indigo-50 text-indigo-600' },
  { value: 'empresario', label: 'Empresario · S/180', color: 'bg-emerald-50 text-emerald-600' },
];
const PLAN_COLORS = { trial: 'bg-amber-50 text-amber-600', independiente: 'bg-blue-50 text-blue-600', emprendedor: 'bg-indigo-50 text-indigo-600', empresario: 'bg-emerald-50 text-emerald-600' };
const PLAN_LABEL = { trial: 'Trial', independiente: 'Independiente', emprendedor: 'Emprendedor', empresario: 'Empresario', pro: 'Pro' };

function UsuariosTab() {
  const api = useApi();
  const toast = useToast();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ email: '', nombre: '', rol: 'cliente', empresa: '', permisos: [...DEFAULT_PERMISOS], plan: 'trial', trial_days: '10' });
  const [onboardingLink, setOnboardingLink] = useState('');
  const [editPermisos, setEditPermisos] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [expandedUser, setExpandedUser] = useState(null);
  const [planEdit, setPlanEdit] = useState(null);
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try {
      const data = await api.get('/admin/usuarios');
      setUsers(data.data || []);
    } catch { toast.error('Error cargando usuarios'); }
    finally { setLoading(false); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createForm.email || !createForm.nombre) { toast.error('Email y nombre son requeridos'); return; }
    setCreating(true);
    try {
      const data = await api.post('/admin/usuarios', createForm);
      toast.success('Usuario creado');
      const d = data.data || data;
      if (d.onboarding_token) {
        const base = window.location.href.split('#')[0];
        setOnboardingLink(`${base}#/onboarding?token=${d.onboarding_token}`);
      }
      loadUsers();
    } catch (err) { toast.error(err.message); }
    finally { setCreating(false); }
  };

  const toggleStatus = async (user) => {
    const newEstado = user.estado === 'activo' ? 'inactivo' : 'activo';
    try {
      await api.patch(`/admin/usuarios/${user.id}/estado`, { estado: newEstado });
      toast.success(`Usuario ${newEstado === 'activo' ? 'reactivado' : 'suspendido'}`);
      loadUsers();
    } catch { toast.error('Error cambiando estado'); }
  };

  const copyLink = () => { navigator.clipboard.writeText(onboardingLink); toast.success('Link copiado al portapapeles'); };

  const toggleCreatePermiso = (key) => setCreateForm(prev => ({ ...prev, permisos: cyclePermiso(prev.permisos, key) }));
  const startEditPermisos = (u) => setEditPermisos({ userId: u.id, permisos: Array.isArray(u.permisos) ? [...u.permisos] : [...DEFAULT_PERMISOS] });
  const toggleEditPermiso = (key) => setEditPermisos(prev => ({ ...prev, permisos: cyclePermiso(prev.permisos, key) }));

  const savePermisos = async () => {
    if (!editPermisos) return;
    try {
      await api.patch(`/admin/usuarios/${editPermisos.userId}/permisos`, { permisos: editPermisos.permisos });
      toast.success('Permisos actualizados');
      setEditPermisos(null);
      loadUsers();
    } catch { toast.error('Error actualizando permisos'); }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    try {
      await api.del(`/admin/usuarios/${deleteTarget.id}`);
      toast.success('Usuario eliminado');
      setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
    } catch (err) { toast.error(err.message || 'Error eliminando usuario'); }
    finally { setDeleteTarget(null); }
  };

  const handleChangePlan = async (userId, newPlan) => {
    try {
      await api.patch(`/admin/usuarios/${userId}/plan`, {
        plan: newPlan,
        trial_ends_at: newPlan === 'trial' ? new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString() : null,
      });
      toast.success(`Plan cambiado a ${PLAN_LABEL[newPlan] || newPlan}`);
      setPlanEdit(null);
      loadUsers();
    } catch { toast.error('Error cambiando plan'); }
  };

  const toggleSort = (key) => {
    if (sortKey === key) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }
    else { setSortKey(key); setSortDir('desc'); }
  };
  const SortIcon = ({ k }) => sortKey === k ? <span className="ml-0.5 text-[9px]">{sortDir === 'asc' ? '▲' : '▼'}</span> : null;

  const sorted = [...users].sort((a, b) => {
    let va = a[sortKey], vb = b[sortKey];
    if (sortKey === 'total_productos' || sortKey === 'total_ventas') { va = Number(va) || 0; vb = Number(vb) || 0; }
    else if (sortKey === 'created_at' || sortKey === 'ultima_venta') { va = va ? new Date(va).getTime() : 0; vb = vb ? new Date(vb).getTime() : 0; }
    else { va = (va || '').toString().toLowerCase(); vb = (vb || '').toString().toLowerCase(); }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className={cx.skeleton + ' h-16'} />)}</div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <p className="text-stone-500 text-sm">{users.length} usuarios registrados</p>
        <button onClick={() => { setShowCreate(true); setOnboardingLink(''); }} className={cx.btnPrimary + ' flex items-center gap-2'}>
          <UserPlus size={16} /> Nuevo Usuario
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className={`${cx.card} p-6 mb-6 border-[var(--accent)]`}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-stone-900">Crear usuario</h3>
            <button onClick={() => { setShowCreate(false); setOnboardingLink(''); }} className={cx.btnIcon}><X size={16} /></button>
          </div>
          {onboardingLink ? (
            <div className="space-y-3">
              <p className="text-stone-500 text-sm">Enlace de onboarding generado:</p>
              <div className="flex gap-2">
                <input type="text" value={onboardingLink} readOnly className={cx.input + ' text-xs'} />
                <button onClick={copyLink} className={cx.btnSecondary + ' flex items-center gap-1'}><Copy size={14} /> Copiar</button>
              </div>
              <button onClick={() => { setShowCreate(false); setOnboardingLink(''); setCreateForm({ email: '', nombre: '', rol: 'cliente', empresa: '', permisos: [...DEFAULT_PERMISOS], plan: 'trial', trial_days: '10' }); }} className={cx.btnGhost}>Cerrar</button>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={cx.label}>Nombre</label>
                  <input type="text" value={createForm.nombre} onChange={e => setCreateForm({ ...createForm, nombre: e.target.value })} className={cx.input} required autoFocus />
                </div>
                <div>
                  <label className={cx.label}>Email</label>
                  <input type="email" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} className={cx.input} required />
                </div>
                <div>
                  <label className={cx.label}>Nombre comercial (opcional)</label>
                  <input type="text" value={createForm.empresa} onChange={e => setCreateForm({ ...createForm, empresa: e.target.value })} className={cx.input} placeholder="Nombre del negocio" />
                </div>
                <div>
                  <label className={cx.label}>Rol</label>
                  <select value={createForm.rol} onChange={e => setCreateForm({ ...createForm, rol: e.target.value })} className={cx.select}>
                    <option value="cliente">Cliente</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div>
                  <label className={cx.label}>Plan</label>
                  <CustomSelect value={createForm.plan} onChange={v => setCreateForm({ ...createForm, plan: v })} options={[{ value: 'trial', label: 'Prueba gratis' }, { value: 'pro', label: 'Pro (pagado)' }]} />
                </div>
                {createForm.plan === 'trial' && (
                  <div>
                    <label className={cx.label}>Dias de prueba</label>
                    <input type="number" min="1" max="365" value={createForm.trial_days} onChange={e => setCreateForm({ ...createForm, trial_days: e.target.value })} className={cx.input + ' max-w-[8rem]'} placeholder="14" />
                  </div>
                )}
              </div>
              <div>
                <label className={cx.label}>Modulos (click para cambiar: Completo → Vitrina → Oculto)</label>
                <div className="space-y-3 mt-2">
                  {['Catalogo', 'Ventas', 'Finanzas', 'Facturacion'].map(group => {
                    const mods = ALL_MODULES.filter(m => m.group === group);
                    return (
                      <div key={group}>
                        <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold mb-1">{group}</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                          {mods.map(m => {
                            const state = getPermisoState(createForm.permisos, m.key);
                            return (
                              <button key={m.key} type="button" onClick={() => toggleCreatePermiso(m.key)}
                                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${PERM_COLORS[state]} border-transparent hover:border-stone-300`}>
                                <span>{m.label}{m.requires ? ' *' : ''}</span>
                                <span className="text-[10px] font-bold uppercase">{PERM_LABELS[state]}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-[10px] text-stone-400">* Activa automaticamente sus dependencias</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={creating} className={cx.btnPrimary + ' flex items-center gap-2'}>
                  {creating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><UserPlus size={14} /> Crear</>}
                </button>
                <button type="button" onClick={() => setShowCreate(false)} className={cx.btnSecondary}>Cancelar</button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Mobile cards */}
      <div className="space-y-3 lg:hidden">
        {users.map(u => (
          <div key={u.id} className={`${cx.card} p-5`}>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-stone-800 font-medium text-sm">{u.nombre || u.email}</h3>
                <p className="text-stone-500 text-xs mt-0.5">{u.email}</p>
                <p className="text-stone-500 text-xs mt-1">{u.empresa_nombre || '-'}{u.giro_nombre ? ` · ${u.giro_nombre}` : ''}</p>
                {u.empresa_ruc && <p className="text-stone-400 text-[10px] mt-0.5">RUC: {u.empresa_ruc}</p>}
                {u.empresa_telefono && <p className="text-stone-400 text-[10px]">Tel: {u.empresa_telefono}</p>}
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-1">
                  {u.rol === 'admin' && <span className={cx.badge('bg-violet-50 text-violet-600')}>admin</span>}
                  <span className={cx.badge(u.estado === 'activo' ? 'bg-[var(--accent-light)] text-[var(--success)]' : u.estado === 'pendiente' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600')}>{u.estado}</span>
                  <span className={cx.badge(PLAN_COLORS[u.plan] || 'bg-stone-100 text-stone-600')}>{PLAN_LABEL[u.plan] || u.plan}</span>
                </div>
                <span className="text-[10px] text-stone-400">{timeAgo(u.created_at)}</span>
              </div>
            </div>
            {/* Activity stats */}
            <div className="flex flex-wrap gap-3 mt-3 text-[10px] text-stone-500">
              <span><Package size={10} className="inline mr-0.5" />{u.total_productos || 0} prod</span>
              <span><ShoppingCart size={10} className="inline mr-0.5" />{u.total_ventas || 0} ventas</span>
              {u.total_comprobantes > 0 && <span><FileText size={10} className="inline mr-0.5" />{u.total_comprobantes} boletas</span>}
              {u.certificado_subido && <span className="text-violet-600"><ShieldCheck size={10} className="inline mr-0.5" />Cert .p12</span>}
              {u.facturacion_habilitada && <span className="text-teal-600"><FileText size={10} className="inline mr-0.5" />Fact. activa</span>}
              {u.ultima_venta && <span>Última venta: {timeAgo(u.ultima_venta)}</span>}
            </div>
            {u.estado === 'pendiente' && u.onboarding_token && (
              <div className="mt-2 flex gap-2 items-center">
                <input type="text" readOnly value={`${window.location.href.split('#')[0]}#/onboarding?token=${u.onboarding_token}`} className={cx.input + ' text-[10px] flex-1'} />
                <button onClick={() => { navigator.clipboard.writeText(`${window.location.href.split('#')[0]}#/onboarding?token=${u.onboarding_token}`); toast.success('Link copiado'); }} className={cx.btnSecondary + ' text-xs flex items-center gap-1'}><Copy size={12} /> Copiar</button>
              </div>
            )}
            <div className="flex gap-2 mt-3 border-t border-stone-200 pt-3">
              <button onClick={() => startEditPermisos(u)} className={cx.btnGhost + ' flex-1 flex items-center justify-center gap-1'}><Settings size={13} /> Permisos</button>
              <button onClick={() => toggleStatus(u)} className={`${u.estado === 'activo' ? cx.btnDanger : cx.btnGhost + ' text-[var(--success)]'} flex-1 flex items-center justify-center gap-1`}>
                {u.estado === 'activo' ? <><Ban size={13} /> Suspender</> : <><CheckCircle size={13} /> Reactivar</>}
              </button>
              <button onClick={() => setDeleteTarget(u)} className={cx.btnDanger + ' flex items-center justify-center gap-1'}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className={`${cx.card} hidden lg:block overflow-x-auto`}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-stone-200">
              <th className={cx.th + ' cursor-pointer select-none'} onClick={() => toggleSort('nombre')}>Usuario<SortIcon k="nombre" /></th>
              <th className={cx.th + ' cursor-pointer select-none'} onClick={() => toggleSort('empresa_nombre')}>Negocio<SortIcon k="empresa_nombre" /></th>
              <th className={cx.th + ' cursor-pointer select-none'} onClick={() => toggleSort('plan')}>Plan<SortIcon k="plan" /></th>
              <th className={cx.th + ' text-center cursor-pointer select-none'} onClick={() => toggleSort('total_ventas')}>Actividad<SortIcon k="total_ventas" /></th>
              <th className={cx.th + ' text-center'}>Facturación</th>
              <th className={cx.th + ' cursor-pointer select-none'} onClick={() => toggleSort('created_at')}>Registro<SortIcon k="created_at" /></th>
              <th className={cx.th + ' text-right'}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(u => (
              <React.Fragment key={u.id}>
              <tr className={cx.tr}>
                {/* Usuario */}
                <td className={cx.td}>
                  <div>
                    <p className="text-stone-800 font-medium text-sm">{u.nombre || '-'}</p>
                    <p className="text-stone-400 text-[10px]">{u.email}</p>
                    {u.empresa_telefono && <p className="text-stone-400 text-[10px]">{u.empresa_telefono}</p>}
                  </div>
                </td>
                {/* Negocio */}
                <td className={cx.td}>
                  <p className="text-stone-700 text-sm">{u.empresa_nombre || '-'}</p>
                  {u.giro_nombre && <p className="text-stone-400 text-[10px]">{u.giro_nombre}</p>}
                  {u.empresa_ruc && <p className="text-stone-400 text-[10px]">RUC: {u.empresa_ruc}</p>}
                </td>
                {/* Plan + Estado */}
                <td className={cx.td}>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                      <span className={cx.badge(u.estado === 'activo' ? 'bg-[var(--accent-light)] text-[var(--success)]' : u.estado === 'pendiente' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600')}>{u.estado}</span>
                      {planEdit?.userId === u.id ? (
                        <div className="flex items-center gap-1">
                          {PLAN_OPTIONS.map(p => (
                            <button key={p.value} onClick={() => handleChangePlan(u.id, p.value)}
                              className={`${cx.badge(p.color)} cursor-pointer hover:opacity-80 ${u.plan === p.value ? 'ring-1 ring-stone-400' : ''}`}>
                              {p.label.split('·')[0].trim()}
                            </button>
                          ))}
                          <button onClick={() => setPlanEdit(null)} className="text-stone-400 hover:text-stone-600"><X size={12} /></button>
                        </div>
                      ) : (
                        <button onClick={() => setPlanEdit({ userId: u.id })} className={cx.badge(PLAN_COLORS[u.plan] || 'bg-stone-100 text-stone-600') + ' cursor-pointer hover:opacity-80'} title="Click para cambiar plan">
                          {PLAN_LABEL[u.plan] || u.plan}
                        </button>
                      )}
                      {u.rol === 'admin' && <span className={cx.badge('bg-violet-50 text-violet-600')}>admin</span>}
                    </div>
                    {u.plan === 'trial' && u.trial_ends_at && (
                      <span className="text-[10px] text-stone-400">
                        {new Date(u.trial_ends_at) > new Date() ? `Quedan ${Math.ceil((new Date(u.trial_ends_at) - new Date()) / 86400000)} días` : 'Trial vencido'}
                      </span>
                    )}
                    {u.estado === 'pendiente' && u.onboarding_token && (
                      <button onClick={() => { navigator.clipboard.writeText(`${window.location.href.split('#')[0]}#/onboarding?token=${u.onboarding_token}`); toast.success('Link copiado'); }} className="text-[10px] text-amber-600 hover:underline flex items-center gap-0.5"><Copy size={10} /> Copiar link</button>
                    )}
                  </div>
                </td>
                {/* Actividad */}
                <td className={cx.td + ' text-center'}>
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-stone-600" title="Productos"><Package size={11} className="inline mr-0.5 text-stone-400" />{u.total_productos || 0}</span>
                      <span className="text-stone-600" title="Ventas"><ShoppingCart size={11} className="inline mr-0.5 text-stone-400" />{u.total_ventas || 0}</span>
                    </div>
                    {u.ultima_venta && <span className="text-[10px] text-stone-400">Última: {timeAgo(u.ultima_venta)}</span>}
                  </div>
                </td>
                {/* Facturación */}
                <td className={cx.td + ' text-center'}>
                  <div className="flex flex-col items-center gap-0.5">
                    {u.facturacion_habilitada ? (
                      <span className={cx.badge('bg-teal-50 text-teal-600')}>Activa</span>
                    ) : u.certificado_subido ? (
                      <span className={cx.badge('bg-violet-50 text-violet-600')}>Cert .p12</span>
                    ) : u.tiene_sol ? (
                      <span className={cx.badge('bg-amber-50 text-amber-600')}>SOL</span>
                    ) : (
                      <span className="text-stone-300 text-[10px]">—</span>
                    )}
                    {u.total_comprobantes > 0 && <span className="text-[10px] text-stone-400">{u.total_comprobantes} comp.</span>}
                  </div>
                </td>
                {/* Registro */}
                <td className={cx.td + ' text-stone-400 text-xs'}>{timeAgo(u.created_at)}</td>
                {/* Acciones */}
                <td className={cx.td + ' text-right'}>
                  <div className="flex justify-end gap-1">
                    <button onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)} className={cx.btnIcon} title="Ver detalle">
                      {expandedUser === u.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                    <button onClick={() => startEditPermisos(u)} className={cx.btnIcon} title="Permisos"><Settings size={15} /></button>
                    <button onClick={() => toggleStatus(u)} className={u.estado === 'activo' ? cx.btnDanger : cx.btnGhost + ' text-[var(--success)]'}>{u.estado === 'activo' ? 'Suspender' : 'Reactivar'}</button>
                    <button onClick={() => setDeleteTarget(u)} className={cx.btnIcon + ' hover:text-rose-600'} title="Eliminar"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
              {/* Expanded row — empresa details */}
              {expandedUser === u.id && (
                <tr className="bg-stone-50/50">
                  <td colSpan={7} className="px-6 py-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold mb-1">Empresa</p>
                        <p className="text-stone-800">{u.empresa_nombre || '—'}</p>
                        {u.empresa_ruc && <p className="text-stone-500 text-xs">RUC: {u.empresa_ruc}</p>}
                      </div>
                      <div>
                        <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold mb-1">Contacto</p>
                        <p className="text-stone-700 text-xs">{u.email}</p>
                        {u.empresa_telefono && <p className="text-stone-700 text-xs">{u.empresa_telefono}</p>}
                      </div>
                      <div>
                        <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold mb-1">Giro</p>
                        <p className="text-stone-700 text-xs">{u.giro_nombre || '—'}</p>
                        {u.pais_code && <p className="text-stone-400 text-[10px]">País: {u.pais_code}</p>}
                      </div>
                      <div>
                        <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold mb-1">Métricas</p>
                        <p className="text-stone-700 text-xs">{u.total_productos || 0} productos · {u.total_ventas || 0} ventas</p>
                        {u.total_comprobantes > 0 && <p className="text-stone-700 text-xs">{u.total_comprobantes} comprobantes emitidos</p>}
                        {u.ultima_venta && <p className="text-stone-400 text-[10px]">Última venta: {timeAgo(u.ultima_venta)}</p>}
                        <p className="text-stone-400 text-[10px]">Registrado: {formatDate(u.created_at)}</p>
                      </div>
                    </div>
                    {/* Permisos inline */}
                    <div className="mt-3 pt-3 border-t border-stone-200">
                      <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold mb-1">Permisos</p>
                      <div className="flex flex-wrap gap-1">
                        {(Array.isArray(u.permisos) ? u.permisos : DEFAULT_PERMISOS).map(p => {
                          const isVitrina = p.startsWith('~');
                          const label = isVitrina ? p.slice(1) : p;
                          return <span key={p} className={`text-[10px] px-1.5 py-0.5 rounded ${isVitrina ? 'bg-amber-50 text-amber-600' : 'bg-stone-100 text-stone-600'}`}>{label}{isVitrina ? ' (vitrina)' : ''}</span>;
                        })}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Permisos modal */}
      {editPermisos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setEditPermisos(null)} />
          <div className={`${cx.card} relative p-6 w-full max-w-sm max-w-[95vw] mx-4`}>
            <h3 className="text-stone-800 font-semibold mb-2">Modulos</h3>
            <p className="text-xs text-stone-400 mb-4">Click para cambiar estado</p>
            <div className="space-y-3">
              {['Catalogo', 'Ventas', 'Finanzas', 'Facturacion'].map(group => {
                const mods = ALL_MODULES.filter(m => m.group === group);
                return (
                  <div key={group}>
                    <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold mb-1">{group}</p>
                    {mods.map(m => {
                      const state = getPermisoState(editPermisos.permisos, m.key);
                      return (
                        <button key={m.key} type="button" onClick={() => toggleEditPermiso(m.key)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${PERM_COLORS[state]} hover:opacity-80 mb-1`}>
                          <span>{m.label}</span>
                          <span className="text-[10px] font-bold uppercase">{PERM_LABELS[state]}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={savePermisos} className={cx.btnPrimary + ' flex-1'}>Guardar</button>
              <button onClick={() => setEditPermisos(null)} className={cx.btnSecondary + ' flex-1'}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar usuario"
        message={`Estas seguro de eliminar "${deleteTarget?.nombre || deleteTarget?.email}"? Se eliminaran todos sus datos.`}
        onConfirm={handleDeleteUser}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Tab 3: Pagos
// ══════════════════════════════════════════════════════════════
function PagosTab() {
  const api = useApi();
  const toast = useToast();
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todos');
  const [actionRow, setActionRow] = useState(null); // { id, type: 'aprobar'|'rechazar' }
  const [actionValue, setActionValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [imageModal, setImageModal] = useState(null);

  useEffect(() => { loadPagos(); }, []);

  const loadPagos = async () => {
    try {
      const data = await api.get('/admin/pagos');
      setPagos(data.data || data || []);
    } catch { toast.error('Error cargando pagos'); }
    finally { setLoading(false); }
  };

  const handleAprobar = async (id) => {
    setSubmitting(true);
    try {
      await api.patch(`/admin/pagos/${id}/aprobar`, { referencia_pago: actionValue });
      toast.success('Pago aprobado');
      setActionRow(null);
      setActionValue('');
      loadPagos();
    } catch (err) { toast.error(err.message || 'Error aprobando pago'); }
    finally { setSubmitting(false); }
  };

  const handleRechazar = async (id) => {
    setSubmitting(true);
    try {
      await api.patch(`/admin/pagos/${id}/rechazar`, { nota: actionValue });
      toast.success('Pago rechazado');
      setActionRow(null);
      setActionValue('');
      loadPagos();
    } catch (err) { toast.error(err.message || 'Error rechazando pago'); }
    finally { setSubmitting(false); }
  };

  const estadoBadge = (estado) => {
    const map = {
      pendiente: 'bg-amber-50 text-amber-600',
      aprobado: 'bg-emerald-50 text-emerald-600',
      rechazado: 'bg-rose-50 text-rose-600',
    };
    return cx.badge(map[estado] || 'bg-stone-100 text-stone-500');
  };

  const filtered = filtro === 'todos' ? pagos : pagos.filter(p => p.estado === filtro);

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className={cx.skeleton + ' h-16'} />)}</div>;

  return (
    <div>
      {/* Filter pills */}
      <div className="flex items-center gap-2 mb-4">
        <Filter size={14} className="text-stone-400" />
        {['todos', 'pendiente', 'aprobado', 'rechazado'].map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${filtro === f ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'pendiente' && pagos.filter(p => p.estado === 'pendiente').length > 0 && (
              <span className="ml-1.5 w-4 h-4 inline-flex items-center justify-center rounded-full bg-rose-500 text-white text-[9px] font-bold">
                {pagos.filter(p => p.estado === 'pendiente').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className={`${cx.card} p-10 text-center`}>
          <CreditCard size={32} className="mx-auto text-stone-300 mb-2" />
          <p className="text-stone-400 text-sm">No hay pagos {filtro !== 'todos' ? `con estado "${filtro}"` : ''}</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 lg:hidden">
            {filtered.map(p => (
              <div key={p.id} className={`${cx.card} p-5`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-stone-800 font-medium text-sm">{p.usuario_nombre || '-'}</p>
                    <p className="text-stone-400 text-xs">{p.usuario_email || '-'}</p>
                    {p.empresa_nombre && <p className="text-stone-500 text-xs mt-0.5">Empresa: {p.empresa_nombre}</p>}
                    <p className="text-stone-400 text-[10px] mt-1">{formatDate(p.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <span className={estadoBadge(p.estado)}>{p.estado}</span>
                    <p className="text-stone-800 font-semibold text-sm mt-1">{formatCurrency(p.monto)}</p>
                  </div>
                </div>
                {p.comprobante_url && (
                  <button onClick={() => setImageModal(p.comprobante_url)} className={cx.btnGhost + ' text-xs flex items-center gap-1 mt-2'}>
                    <Eye size={13} /> Ver comprobante
                  </button>
                )}
                {p.referencia_pago && <p className="text-[10px] text-emerald-600 mt-1">Ref: {p.referencia_pago}</p>}
                {p.nota && <p className="text-[10px] text-rose-500 mt-1">Nota: {p.nota}</p>}
                {p.estado === 'pendiente' && (
                  <div className="flex gap-2 mt-3 border-t border-stone-200 pt-3">
                    {actionRow?.id === p.id ? (
                      <div className="flex-1 space-y-2">
                        <input type="text" value={actionValue} onChange={e => setActionValue(e.target.value)}
                          placeholder={actionRow.type === 'aprobar' ? 'Referencia de pago' : 'Motivo de rechazo'}
                          className={cx.input + ' text-xs'} autoFocus />
                        <div className="flex gap-2">
                          <button disabled={submitting} onClick={() => actionRow.type === 'aprobar' ? handleAprobar(p.id) : handleRechazar(p.id)}
                            className={`${actionRow.type === 'aprobar' ? cx.btnPrimary : cx.btnDanger} text-xs flex-1`}>
                            {submitting ? 'Procesando...' : actionRow.type === 'aprobar' ? 'Confirmar' : 'Confirmar rechazo'}
                          </button>
                          <button onClick={() => { setActionRow(null); setActionValue(''); }} className={cx.btnGhost + ' text-xs'}>Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button onClick={() => { setActionRow({ id: p.id, type: 'aprobar' }); setActionValue(''); }}
                          className={cx.btnPrimary + ' text-xs flex-1 flex items-center justify-center gap-1'}><Check size={13} /> Aprobar</button>
                        <button onClick={() => { setActionRow({ id: p.id, type: 'rechazar' }); setActionValue(''); }}
                          className={cx.btnDanger + ' text-xs flex-1 flex items-center justify-center gap-1'}><XCircle size={13} /> Rechazar</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className={`${cx.card} hidden lg:block overflow-hidden`}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className={cx.th}>Fecha</th>
                  <th className={cx.th}>Usuario</th>
                  <th className={cx.th}>Empresa</th>
                  <th className={cx.th}>Plan</th>
                  <th className={cx.th}>Monto</th>
                  <th className={cx.th}>Estado</th>
                  <th className={cx.th}>Comprobante</th>
                  <th className={cx.th + ' text-right'}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className={cx.tr}>
                    <td className={cx.td + ' text-stone-400 text-xs'}>{formatDate(p.created_at)}</td>
                    <td className={cx.td}>
                      <p className="text-stone-800 font-medium text-sm">{p.usuario_nombre || '-'}</p>
                      <p className="text-stone-400 text-[10px]">{p.usuario_email || '-'}</p>
                    </td>
                    <td className={cx.td + ' text-stone-600 text-sm'}>{p.empresa_nombre || '-'}</td>
                    <td className={cx.td}>
                      <span className={cx.badge('bg-stone-100 text-stone-600')}>{p.plan || '-'}</span>
                    </td>
                    <td className={cx.td + ' text-stone-800 font-medium'}>{formatCurrency(p.monto)}</td>
                    <td className={cx.td}><span className={estadoBadge(p.estado)}>{p.estado}</span></td>
                    <td className={cx.td}>
                      {p.comprobante_url ? (
                        <button onClick={() => setImageModal(p.comprobante_url)} className={cx.btnGhost + ' text-xs flex items-center gap-1'}>
                          <Eye size={13} /> Ver
                        </button>
                      ) : <span className="text-stone-300 text-xs">-</span>}
                    </td>
                    <td className={cx.td + ' text-right'}>
                      {p.estado === 'pendiente' && (
                        actionRow?.id === p.id ? (
                          <div className="flex flex-col gap-2 items-end">
                            <input type="text" value={actionValue} onChange={e => setActionValue(e.target.value)}
                              placeholder={actionRow.type === 'aprobar' ? 'Referencia de pago' : 'Motivo de rechazo'}
                              className={cx.input + ' text-xs max-w-[200px]'} autoFocus />
                            <div className="flex gap-1">
                              <button disabled={submitting} onClick={() => actionRow.type === 'aprobar' ? handleAprobar(p.id) : handleRechazar(p.id)}
                                className={`${actionRow.type === 'aprobar' ? cx.btnPrimary : cx.btnDanger} text-xs`}>
                                {submitting ? '...' : 'Confirmar'}
                              </button>
                              <button onClick={() => { setActionRow(null); setActionValue(''); }} className={cx.btnGhost + ' text-xs'}>Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <button onClick={() => { setActionRow({ id: p.id, type: 'aprobar' }); setActionValue(''); }}
                              className={cx.btnPrimary + ' text-xs flex items-center gap-1'}><Check size={13} /> Aprobar</button>
                            <button onClick={() => { setActionRow({ id: p.id, type: 'rechazar' }); setActionValue(''); }}
                              className={cx.btnDanger + ' text-xs flex items-center gap-1'}><XCircle size={13} /> Rechazar</button>
                          </div>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Image modal */}
      {imageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setImageModal(null)} />
          <div className="relative max-w-lg w-full mx-4">
            <button onClick={() => setImageModal(null)} className="absolute -top-10 right-0 p-2 text-white/70 hover:text-white"><X size={20} /></button>
            <img src={imageModal} alt="Comprobante de pago" className="w-full rounded-xl shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Tab 4: Registros
// ══════════════════════════════════════════════════════════════
function RegistrosTab() {
  const api = useApi();
  const toast = useToast();
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get('/admin/registros');
        setRegistros(data.data || data || []);
      } catch { toast.error('Error cargando registros'); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className={cx.skeleton + ' h-14'} />)}</div>;

  if (registros.length === 0) {
    return (
      <div className={`${cx.card} p-10 text-center`}>
        <UserPlus size={32} className="mx-auto text-stone-300 mb-2" />
        <p className="text-stone-400 text-sm">No hay registros recientes</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {registros.map((r, i) => (
        <div key={r.id || i} className={`${cx.card} px-5 py-4 flex items-center gap-4`}>
          {/* Avatar */}
          <div className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center text-xs font-bold text-stone-500 shrink-0">
            {(r.nombre || r.email || '?').charAt(0).toUpperCase()}
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-stone-800 truncate">{r.nombre || '-'}</p>
              <span className={cx.badge(PLAN_COLORS[r.plan] || (r.plan && r.plan !== 'trial' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'))}>
                {PLAN_LABEL[r.plan] || r.plan || 'Trial'}
              </span>
              {r.estado && (
                <span className={cx.badge(r.estado === 'activo' ? 'bg-[var(--accent-light)] text-[var(--success)]' : r.estado === 'pendiente' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600')}>
                  {r.estado}
                </span>
              )}
            </div>
            <p className="text-xs text-stone-400 truncate">{r.email}</p>
            {(r.giro || r.empresa) && (
              <p className="text-xs text-stone-400 mt-0.5">{r.giro || r.empresa}</p>
            )}
          </div>
          {/* Timestamp */}
          <p className="text-xs text-stone-400 shrink-0">{timeAgo(r.created_at || r.fecha)}</p>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Main AdminPage
// ══════════════════════════════════════════════════════════════
export default function AdminPage() {
  const [tab, setTab] = useState('dashboard');

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-stone-900">Admin</h2>
        <p className="text-stone-500 text-sm mt-0.5">Panel de administracion</p>
      </div>

      {/* Tab pills */}
      <div className="flex items-center gap-1.5 mb-6 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap ${
              tab === t.key ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
            }`}>
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'dashboard' && <DashboardTab onNavigate={setTab} />}
      {tab === 'usuarios' && <UsuariosTab />}
      {tab === 'pagos' && <PagosTab />}
      {tab === 'registros' && <RegistrosTab />}
      {tab === 'mensajes' && <MensajesTab />}
      {tab === 'feedback' && <FeedbackTab />}
      {tab === 'errores' && <ErroresTab />}
    </div>
  );
}

// Tab 5: Mensajes (admin → usuarios)
function MensajesTab() {
  const api = useApi();
  const toast = useToast();
  const [mensajes, setMensajes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [respuestas, setRespuestas] = useState({});
  const [replyText, setReplyText] = useState('');

  // Form
  const [destino, setDestino] = useState(''); // userId or '' for broadcast
  const [asunto, setAsunto] = useState('');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/admin/mensajes'),
      api.get('/admin/usuarios'),
    ]).then(([m, u]) => {
      setMensajes(m.data || []);
      setUsuarios((u.data || []).filter(x => x.rol !== 'admin'));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSend = async () => {
    if (!mensaje.trim()) return;
    setSending(true);
    try {
      await api.post('/admin/mensajes', {
        para_usuario_id: destino ? parseInt(destino) : null,
        asunto: asunto.trim() || null,
        mensaje: mensaje.trim(),
      });
      toast.success(destino ? 'Mensaje enviado' : 'Mensaje enviado a todos');
      setAsunto(''); setMensaje(''); setDestino('');
      const r = await api.get('/admin/mensajes');
      setMensajes(r.data || []);
    } catch (err) { toast.error(err.message); }
    finally { setSending(false); }
  };

  const handleExpand = async (id) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!respuestas[id]) {
      try {
        const r = await api.get(`/admin/mensajes/${id}/respuestas`);
        setRespuestas(prev => ({ ...prev, [id]: r.data || [] }));
      } catch {}
    }
  };

  const handleReply = async (parentId) => {
    if (!replyText.trim()) return;
    try {
      await api.post(`/mensajes/${parentId}/responder`, { mensaje: replyText.trim() });
      setReplyText('');
      toast.success('Respuesta enviada');
      const r = await api.get(`/admin/mensajes/${parentId}/respuestas`);
      setRespuestas(prev => ({ ...prev, [parentId]: r.data || [] }));
    } catch (err) { toast.error(err.message); }
  };

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className={cx.skeleton + ' h-16'} />)}</div>;

  return (
    <div className="space-y-6">
      {/* Send form */}
      <div className={cx.card + ' p-5'}>
        <h3 className="text-sm font-semibold text-stone-800 mb-3 flex items-center gap-2"><Send size={14} /> Enviar mensaje</h3>
        <div className="space-y-3">
          <div>
            <label className={cx.label}>Destinatario</label>
            <select
              value={destino}
              onChange={e => setDestino(e.target.value)}
              className={cx.input}
            >
              <option value="">Todos los usuarios</option>
              {usuarios.map(u => (
                <option key={u.id} value={u.id}>{u.nombre || u.email} ({u.email})</option>
              ))}
            </select>
          </div>
          <div>
            <label className={cx.label}>Asunto</label>
            <input type="text" value={asunto} onChange={e => setAsunto(e.target.value)} className={cx.input} placeholder="Ej: Bienvenido a Kudi" />
          </div>
          <div>
            <label className={cx.label}>Mensaje</label>
            <textarea value={mensaje} onChange={e => setMensaje(e.target.value)} className={cx.input + ' min-h-[80px] resize-y'} placeholder="Escribe tu mensaje..." rows={3} />
          </div>
          <button onClick={handleSend} disabled={sending || !mensaje.trim()} className={cx.btnPrimary + ' flex items-center gap-2'}>
            {sending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send size={14} /> Enviar</>}
          </button>
        </div>
      </div>

      {/* Messages list */}
      <div>
        <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3">Mensajes enviados</h3>
        {mensajes.length === 0 ? (
          <div className={cx.card + ' p-8 text-center'}>
            <Bell size={32} className="text-stone-300 mx-auto mb-2" />
            <p className="text-stone-400 text-sm">No hay mensajes aún</p>
          </div>
        ) : (
          <div className="space-y-2">
            {mensajes.map(m => (
              <div key={m.id} className={cx.card + ' overflow-hidden'}>
                <button onClick={() => handleExpand(m.id)} className="w-full text-left p-4 hover:bg-stone-50 transition-colors duration-100">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {m.de_admin && <span className="text-[9px] px-1.5 py-0.5 bg-[#0A2F24] text-white rounded font-semibold">Admin</span>}
                        {!m.de_admin && <span className="text-[9px] px-1.5 py-0.5 bg-stone-200 text-stone-600 rounded">{m.de_nombre || m.de_email}</span>}
                        <span className="text-[10px] text-stone-400">{m.para_nombre ? `→ ${m.para_nombre}` : m.de_admin ? '→ Todos' : '→ Soporte'}</span>
                      </div>
                      <p className="text-sm font-medium text-stone-800 truncate">{m.asunto || 'Sin asunto'}</p>
                      <p className="text-xs text-stone-400 truncate">{m.mensaje.slice(0, 100)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {parseInt(m.respuestas) > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-full font-semibold">{m.respuestas}</span>
                      )}
                      <span className="text-[10px] text-stone-400">{formatDate(m.created_at)}</span>
                    </div>
                  </div>
                </button>
                {expandedId === m.id && (
                  <div className="px-4 pb-4 border-t border-stone-100 bg-stone-50/50">
                    <div className="py-3">
                      <p className="text-sm text-stone-700 whitespace-pre-wrap">{m.mensaje}</p>
                    </div>
                    {(respuestas[m.id] || []).map(r => (
                      <div key={r.id} className={`mb-2 p-3 rounded-lg ${r.de_admin ? 'bg-[#0A2F24]/5' : 'bg-white border border-stone-200'}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[10px] font-medium text-stone-500">{r.de_admin ? 'Admin' : (r.de_nombre || r.de_email)}</span>
                          <span className="text-[10px] text-stone-400">{formatDate(r.created_at)}</span>
                        </div>
                        <p className="text-xs text-stone-700">{r.mensaje}</p>
                      </div>
                    ))}
                    {/* Reply input */}
                    <div className="flex gap-2 mt-3 pt-3 border-t border-stone-200">
                      <input
                        type="text"
                        value={expandedId === m.id ? replyText : ''}
                        onChange={e => setReplyText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleReply(m.id)}
                        className={cx.input + ' text-sm flex-1'}
                        placeholder="Responder..."
                      />
                      <button
                        onClick={() => handleReply(m.id)}
                        disabled={!replyText.trim()}
                        className={cx.btnPrimary + ' !px-3 flex items-center gap-1'}
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Tab 6: Feedback
function FeedbackTab() {
  const api = useApi();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState(null);
  const [respuesta, setRespuesta] = useState('');

  useEffect(() => {
    api.get('/admin/feedback').then(r => setItems(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleRespond = async (id) => {
    try {
      await api.patch(`/admin/feedback/${id}`, { estado: 'resuelto', nota_admin: respuesta });
      toast.success('Respuesta enviada');
      setItems(prev => prev.map(f => f.id === id ? { ...f, estado: 'resuelto', nota_admin: respuesta } : f));
      setRespondingId(null);
      setRespuesta('');
    } catch { toast.error('Error'); }
  };

  const markSeen = async (id) => {
    try {
      await api.patch(`/admin/feedback/${id}`, { estado: 'visto' });
      setItems(prev => prev.map(f => f.id === id ? { ...f, estado: 'visto' } : f));
    } catch {}
  };

  const ESTADO_COLORS = { nuevo: 'bg-blue-50 text-blue-600', visto: 'bg-amber-50 text-amber-600', resuelto: 'bg-emerald-50 text-emerald-600' };
  const TIPO_COLORS = { sugerencia: 'bg-violet-50 text-violet-600', mejora: 'bg-sky-50 text-sky-600', bug: 'bg-rose-50 text-rose-600', otro: 'bg-stone-100 text-stone-500' };

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className={cx.skeleton + ' h-20'} />)}</div>;

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <div className={cx.card + ' p-8 text-center'}>
          <MessageSquare size={32} className="text-stone-300 mx-auto mb-2" />
          <p className="text-stone-400 text-sm">No hay feedback aún</p>
        </div>
      ) : items.map(f => (
        <div key={f.id} className={cx.card + ' p-4'}>
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <p className="text-sm font-medium text-stone-800">{f.usuario_nombre || 'Usuario'}</p>
              <p className="text-[10px] text-stone-400">{f.usuario_email} · {f.empresa_nombre || ''}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={cx.badge(TIPO_COLORS[f.tipo] || 'bg-stone-100 text-stone-500')}>{f.tipo}</span>
              <span className={cx.badge(ESTADO_COLORS[f.estado] || 'bg-stone-100 text-stone-500')}>{f.estado}</span>
            </div>
          </div>
          <p className="text-sm text-stone-700 mb-2">{f.mensaje}</p>
          <p className="text-[10px] text-stone-400 mb-2">{formatDate(f.created_at)}</p>
          {f.nota_admin && (
            <div className="bg-emerald-50 rounded-lg px-3 py-2 mb-2">
              <p className="text-xs text-emerald-800">{f.nota_admin}</p>
            </div>
          )}
          {respondingId === f.id ? (
            <div className="flex gap-2 mt-2">
              <input type="text" value={respuesta} onChange={e => setRespuesta(e.target.value)} className={cx.input + ' text-sm flex-1'} placeholder="Tu respuesta..." />
              <button onClick={() => handleRespond(f.id)} className={cx.btnPrimary + ' text-xs !px-3'}>Enviar</button>
              <button onClick={() => setRespondingId(null)} className={cx.btnGhost + ' text-xs'}>X</button>
            </div>
          ) : (
            <div className="flex gap-1">
              {f.estado === 'nuevo' && <button onClick={() => markSeen(f.id)} className={cx.btnGhost + ' text-xs'}>Marcar visto</button>}
              {f.estado !== 'resuelto' && <button onClick={() => { setRespondingId(f.id); setRespuesta(''); }} className={cx.btnGhost + ' text-xs'}>Responder</button>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Tab 6: Errores
function ErroresTab() {
  const api = useApi();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/errores').then(r => setItems(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className={cx.skeleton + ' h-16'} />)}</div>;

  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <div className={cx.card + ' p-8 text-center'}>
          <CheckCircle size={32} className="text-emerald-300 mx-auto mb-2" />
          <p className="text-stone-400 text-sm">Sin errores registrados</p>
        </div>
      ) : items.map(e => (
        <div key={e.id} className={cx.card + ' p-3'}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-mono text-rose-600">{e.metodo} {e.ruta}</span>
            <span className="text-[10px] text-stone-400">{formatDate(e.created_at)}</span>
          </div>
          <p className="text-sm text-stone-800">{e.mensaje}</p>
          {e.usuario_id && <p className="text-[10px] text-stone-400 mt-1">User #{e.usuario_id} · Empresa #{e.empresa_id}</p>}
        </div>
      ))}
    </div>
  );
}
