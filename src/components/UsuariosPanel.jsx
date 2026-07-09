import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { cx } from '../styles/tokens';
import CustomSelect from './CustomSelect';
import ConfirmDialog from './ConfirmDialog';
import { UserPlus, Crown, ShieldCheck, Store, Eye, X, Copy, Trash2, ChefHat, Link2, SlidersHorizontal, RotateCcw } from 'lucide-react';

const ROL_INFO = {
  owner: { label: 'Dueño', icon: Crown, color: 'bg-amber-50 text-amber-700', desc: 'Acceso total' },
  manager: { label: 'Gerente', icon: ShieldCheck, color: 'bg-sky-50 text-sky-700', desc: 'Ventas, finanzas, productos' },
  cashier: { label: 'Cajero', icon: Store, color: 'bg-emerald-50 text-emerald-700', desc: 'Ventas y pedidos' },
  vendedor: { label: 'Vendedor', icon: Store, color: 'bg-indigo-50 text-indigo-700', desc: 'Ventas, pedidos, clientes' },
  repartidor: { label: 'Repartidor', icon: Store, color: 'bg-orange-50 text-orange-700', desc: 'Solo entregas' },
  contador: { label: 'Contador', icon: ShieldCheck, color: 'bg-teal-50 text-teal-700', desc: 'Finanzas y reportes (solo lectura)' },
  kitchen: { label: 'Cocina', icon: ChefHat, color: 'bg-violet-50 text-violet-700', desc: 'Solo ve recetas' },
  viewer: { label: 'Visor', icon: Eye, color: 'bg-stone-100 text-stone-600', desc: 'Solo lectura' },
};

// Gestión de accesos (usuarios con login). Extraído del antiguo EquipoPage para
// reusarse como pestaña "Usuarios" del módulo Equipo y dentro de Perfil.
// Mejora: al invitar, un desplegable lista el personal de planilla sin cuenta.
export default function UsuariosPanel() {
  const api = useApi();
  const toast = useToast();
  const { user } = useAuth();

  const [members, setMembers] = useState([]);
  const [personal, setPersonal] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', nombre: '', rol_empresa: 'cashier', personal_id: '' });
  const [saving, setSaving] = useState(false);
  const [inviteLink, setInviteLink] = useState('');

  // Editor de vistas (permisos de sidebar) por usuario
  const [vistas, setVistas] = useState([]);          // catálogo [{key,label,grupo}]
  const [vistasDefaults, setVistasDefaults] = useState({}); // rol -> [keys]
  const [openVistas, setOpenVistas] = useState(null); // memberId con el editor abierto
  const [vistasSel, setVistasSel] = useState([]);     // selección en edición
  const [savingVistas, setSavingVistas] = useState(false);

  useEffect(() => { loadAll(); }, []); // eslint-disable-line

  async function loadAll() {
    setLoading(true);
    try {
      const [memRes, perRes, visRes] = await Promise.all([
        api.get('/equipo'),
        api.get('/personal').catch(() => ({ data: [] })),
        api.get('/equipo/vistas').catch(() => ({ data: { vistas: [], defaults: {} } })),
      ]);
      setMembers(memRes.data || memRes || []);
      setPersonal(perRes.data || perRes || []);
      const vd = visRes.data || visRes || {};
      setVistas(vd.vistas || []);
      setVistasDefaults(vd.defaults || {});
    } catch { toast.error('Error cargando usuarios'); }
    finally { setLoading(false); }
  }

  const gruposVistas = [...new Set(vistas.map(v => v.grupo))];
  function abrirVistas(m) {
    setOpenVistas(openVistas === m.id ? null : m.id);
    setVistasSel(Array.isArray(m.permisos) ? [...m.permisos] : []);
  }
  function toggleVista(key) {
    setVistasSel(sel => sel.includes(key) ? sel.filter(k => k !== key) : [...sel, key]);
  }
  async function guardarVistas(m) {
    setSavingVistas(true);
    try {
      await api.patch(`/equipo/${m.id}/vistas`, { permisos: vistasSel });
      toast.success('Vistas actualizadas');
      setOpenVistas(null);
      loadAll();
    } catch (err) { toast.error(err.message || 'Error'); }
    finally { setSavingVistas(false); }
  }

  // Personal de planilla que todavía no tiene cuenta (para el desplegable de invitar).
  const personalSinCuenta = personal.filter((p) => !p.cuenta_usuario_id);

  async function handleInvite() {
    if (!inviteForm.email || !inviteForm.nombre) { toast.error('Nombre y email requeridos'); return; }
    setSaving(true);
    try {
      const res = await api.post('/equipo/invitar', {
        email: inviteForm.email,
        nombre: inviteForm.nombre,
        rol_empresa: inviteForm.rol_empresa,
        personal_id: inviteForm.personal_id || null,
      });
      const d = res.data || res;
      if (d.onboarding_token) {
        const base = window.location.href.split('#')[0];
        setInviteLink(`${base}#/onboarding?token=${d.onboarding_token}`);
      }
      toast.success('Invitacion creada');
      loadAll();
      setInviteForm({ email: '', nombre: '', rol_empresa: 'cashier', personal_id: '' });
    } catch (err) { toast.error(err.message || 'Error invitando'); }
    finally { setSaving(false); }
  }

  const [removeTarget, setRemoveTarget] = useState(null);
  const [editComision, setEditComision] = useState({});

  async function handleChangeRol(memberId, newRol, comisionPct) {
    try {
      await api.patch(`/equipo/${memberId}/rol`, { rol_empresa: newRol, comision_pct: comisionPct ?? 0 });
      toast.success('Rol actualizado');
      loadAll();
    } catch (err) { toast.error(err.message || 'Error'); }
  }

  async function handleSaveComision(memberId) {
    const member = members.find(m => m.id === memberId);
    if (!member) return;
    const pct = parseFloat(editComision[memberId]) || 0;
    try {
      await api.patch(`/equipo/${memberId}/rol`, { rol_empresa: member.rol_empresa, comision_pct: pct });
      toast.success('Comision actualizada');
      loadAll();
    } catch (err) { toast.error(err.message || 'Error'); }
  }

  async function doRemove() {
    const { id } = removeTarget;
    setRemoveTarget(null);
    try {
      await api.del(`/equipo/${id}`);
      toast.success('Miembro removido');
      loadAll();
    } catch (err) { toast.error(err.message || 'Error'); }
  }

  // Cuando se elige una persona del desplegable, autocompleta el nombre.
  function pickPersona(pid) {
    const p = personal.find((x) => String(x.id) === String(pid));
    setInviteForm((f) => ({ ...f, personal_id: pid, nombre: p ? p.nombre : f.nombre }));
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className={cx.skeleton + ' h-10 w-48'} />
        <div className={cx.skeleton + ' h-20'} />
        <div className={cx.skeleton + ' h-20'} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-stone-900">Usuarios con acceso</h3>
          <p className="text-xs text-stone-500 mt-0.5">{members.length} cuenta{members.length !== 1 ? 's' : ''} de acceso a Kudi</p>
        </div>
        {user?.rol_empresa === 'owner' && (
          <button onClick={() => { setShowInvite(true); setInviteLink(''); }} className={cx.btnPrimary + ' flex items-center gap-2 min-h-[44px]'}>
            <UserPlus size={16} /> Invitar
          </button>
        )}
      </div>

      {/* Member cards */}
      <div className="space-y-3">
        {members.map(m => {
          const info = ROL_INFO[m.rol_empresa] || ROL_INFO.viewer;
          const isMe = m.id === user?.id;
          return (
            <div key={m.id} className={cx.card + ' p-4'}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#0A2F24] text-white flex items-center justify-center text-sm font-bold">
                    {m.nombre?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-stone-900">{m.nombre}{isMe ? ' (tu)' : ''}</p>
                      <span className={cx.badge(info.color)}>{info.label}</span>
                      {m.estado === 'pendiente' && <span className={cx.badge('bg-amber-50 text-amber-600')}>Pendiente</span>}
                      {m.personal_id && <span className={cx.badge('bg-stone-100 text-stone-500') + ' flex items-center gap-0.5'}><Link2 size={10} /> en planilla</span>}
                    </div>
                    <p className="text-xs text-stone-400">{m.email}</p>
                  </div>
                </div>

                {user?.rol_empresa === 'owner' && !isMe && (
                  <div className="flex items-center gap-2">
                    <CustomSelect
                      compact
                      options={[
                        { value: 'manager', label: 'Gerente' },
                        { value: 'cashier', label: 'Cajero' },
                        { value: 'vendedor', label: 'Vendedor' },
                        { value: 'repartidor', label: 'Repartidor' },
                        { value: 'contador', label: 'Contador' },
                        { value: 'kitchen', label: 'Cocina' },
                        { value: 'viewer', label: 'Visor' },
                      ]}
                      value={m.rol_empresa}
                      onChange={(v) => handleChangeRol(m.id, v, m.rol_empresa === 'vendedor' ? (parseFloat(m.comision_pct) || 0) : 0)}
                    />
                    {m.rol_empresa === 'vendedor' && (
                      <div className="flex items-center gap-1">
                        <input
                          type="number" step="0.5" min="0" max="100"
                          value={editComision[m.id] ?? (parseFloat(m.comision_pct) || '')}
                          onChange={(e) => setEditComision(p => ({ ...p, [m.id]: e.target.value }))}
                          onBlur={() => handleSaveComision(m.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSaveComision(m.id); }}
                          className="w-16 bg-white rounded-lg px-2 py-1.5 text-xs text-center border border-stone-200"
                          placeholder="%" title="% comision"
                        />
                        <span className="text-xs text-stone-400">%</span>
                      </div>
                    )}
                    <button onClick={() => abrirVistas(m)} className={cx.btnSecondary + ' p-2'} title="Editar vistas">
                      <SlidersHorizontal size={14} />
                    </button>
                    <button onClick={() => setRemoveTarget({ id: m.id, nombre: m.nombre })} className={cx.btnDanger + ' p-2'} title="Remover">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Editor de vistas (qué ve este usuario en el menú) */}
              {openVistas === m.id && user?.rol_empresa === 'owner' && !isMe && (
                <div className="mt-3 pt-3 border-t border-stone-100">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-stone-600">Vistas que puede ver <span className="text-stone-400 font-normal">— {info.label} por defecto</span></p>
                    <button onClick={() => setVistasSel([...(vistasDefaults[m.rol_empresa] || [])])}
                      className="text-[11px] text-stone-400 hover:text-stone-600 flex items-center gap-1">
                      <RotateCcw size={11} /> Restablecer al rol
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-1">
                    {gruposVistas.map(g => (
                      <div key={g} className="mb-1">
                        <p className="text-[10px] uppercase tracking-wide text-stone-400 font-semibold mb-1">{g}</p>
                        {vistas.filter(v => v.grupo === g).map(v => (
                          <label key={v.key} className="flex items-center gap-2 py-1 cursor-pointer">
                            <input type="checkbox" checked={vistasSel.includes(v.key)} onChange={() => toggleVista(v.key)}
                              className="rounded border-stone-300 text-[var(--accent)] focus:ring-0" />
                            <span className="text-[13px] text-stone-700">{v.label}</span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 justify-end mt-3">
                    <button onClick={() => setOpenVistas(null)} className={cx.btnGhost + ' text-xs px-3 min-h-[40px]'}>Cancelar</button>
                    <button onClick={() => guardarVistas(m)} disabled={savingVistas} className={cx.btnPrimary + ' text-xs px-4 min-h-[40px] disabled:opacity-50'}>
                      {savingVistas ? 'Guardando…' : 'Guardar vistas'}
                    </button>
                  </div>
                </div>
              )}

              {m.estado === 'pendiente' && m.onboarding_token && (
                <div className="mt-3 flex items-center gap-2">
                  <input type="text" readOnly
                    value={`${window.location.href.split('#')[0]}#/onboarding?token=${m.onboarding_token}`}
                    className={cx.input + ' text-[10px] flex-1'} />
                  <button onClick={() => {
                    navigator.clipboard.writeText(`${window.location.href.split('#')[0]}#/onboarding?token=${m.onboarding_token}`);
                    toast.success('Link copiado');
                  }} className={cx.btnSecondary + ' flex items-center gap-1 text-xs min-h-[44px]'}>
                    <Copy size={12} /> Copiar
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowInvite(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-w-[95vw] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-stone-900">Invitar usuario</h3>
              <button onClick={() => setShowInvite(false)} className={cx.btnGhost}><X size={18} /></button>
            </div>

            {inviteLink ? (
              <div className="space-y-3">
                <p className="text-sm text-stone-600">Invitacion creada. Comparte este link:</p>
                <div className="flex gap-2">
                  <input type="text" readOnly value={inviteLink} className={cx.input + ' text-xs'} />
                  <button onClick={() => { navigator.clipboard.writeText(inviteLink); toast.success('Link copiado'); }}
                    className={cx.btnSecondary + ' flex items-center gap-1'}>
                    <Copy size={14} /> Copiar
                  </button>
                </div>
                <button onClick={() => { setShowInvite(false); setInviteLink(''); }} className={cx.btnGhost}>Cerrar</button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Desplegable: elegir persona de planilla ya creada */}
                {personalSinCuenta.length > 0 && (
                  <div>
                    <label className={cx.label}>Persona del equipo (opcional)</label>
                    <CustomSelect
                      value={inviteForm.personal_id || ''}
                      onChange={(v) => pickPersona(v)}
                      placeholder="Elegir de la planilla…"
                      options={[
                        { value: '', label: 'Sin vincular (nuevo)' },
                        ...personalSinCuenta.map((p) => ({ value: String(p.id), label: `${p.nombre}${p.rol ? ` — ${p.rol}` : ''}` })),
                      ]}
                    />
                    <p className="mt-1 text-[11px] text-stone-400">Vincula esta cuenta con alguien de tu planilla.</p>
                  </div>
                )}
                <div>
                  <label className={cx.label}>Nombre</label>
                  <input type="text" value={inviteForm.nombre} onChange={e => setInviteForm(p => ({...p, nombre: e.target.value}))}
                    className={cx.input} placeholder="Nombre del empleado" />
                </div>
                <div>
                  <label className={cx.label}>Email</label>
                  <input type="email" value={inviteForm.email} onChange={e => setInviteForm(p => ({...p, email: e.target.value}))}
                    className={cx.input} placeholder="email@ejemplo.com" />
                </div>
                <div>
                  <label className={cx.label}>Rol</label>
                  <CustomSelect
                    value={inviteForm.rol_empresa}
                    onChange={v => setInviteForm(p => ({...p, rol_empresa: v}))}
                    options={[
                      { value: 'manager', label: 'Gerente — ventas, finanzas, productos' },
                      { value: 'cashier', label: 'Cajero — ventas y pedidos' },
                      { value: 'vendedor', label: 'Vendedor — ventas, pedidos, clientes' },
                      { value: 'repartidor', label: 'Repartidor — solo entregas' },
                      { value: 'contador', label: 'Contador — finanzas (lectura)' },
                      { value: 'kitchen', label: 'Cocina — solo ve recetas' },
                      { value: 'viewer', label: 'Visor — solo lectura' },
                    ]}
                  />
                </div>
                <button onClick={handleInvite} disabled={saving} className={cx.btnPrimary + ' w-full min-h-[44px]'}>
                  {saving ? 'Invitando...' : 'Enviar invitacion'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!removeTarget}
        title="Remover usuario"
        message={`¿Remover el acceso de ${removeTarget?.nombre || ''}? Su registro en planilla (si lo tiene) se mantiene.`}
        confirmText="Remover"
        onConfirm={doRemove}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}
