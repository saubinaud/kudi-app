import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { cx } from '../styles/tokens';
import { formatCurrency } from '../utils/format';
import { User, Lock, Save, Pencil, X, Upload, Loader2, Settings, CreditCard, Building2, Activity, Users, Plus, ToggleLeft, ToggleRight, RotateCcw, Cog, Trash2, Check } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import CustomSelect from '../components/CustomSelect';
import { PAISES, getPaisByCode } from '../config/paises';
import { API_BASE } from '../config/api';
import ActividadPage from './ActividadPage';
import UsuariosPanel from '../components/UsuariosPanel';
import SegmentedControl from '../components/SegmentedControl';

const PLAN_LABEL = { trial: 'Prueba gratuita', independiente: 'Independiente', emprendedor: 'Emprendedor', empresario: 'Empresario', pro: 'Pro' };
const PLAN_PRECIO = { independiente: 'S/ 80', emprendedor: 'S/ 100', empresario: 'S/ 180' };
const PLAN_COLORS = { trial: 'bg-amber-50 text-amber-600', independiente: 'bg-blue-50 text-blue-600', emprendedor: 'bg-indigo-50 text-indigo-600', empresario: 'bg-emerald-50 text-emerald-600', pro: 'bg-emerald-50 text-emerald-600' };

const TABS = [
  { key: 'negocio', label: 'Mi negocio', icon: Building2 },
  { key: 'plan', label: 'Mi plan', icon: CreditCard },
  { key: 'equipo', label: 'Usuarios', icon: Users },
  { key: 'actividad', label: 'Actividad', icon: Activity },
  { key: 'seguridad', label: 'Seguridad', icon: Lock },
  { key: 'ajustes', label: 'Ajustes', icon: Settings },
];

export default function PerfilPage() {
  const { user, setUser } = useAuth();
  const api = useApi();
  const toast = useToast();
  const [tab, setTab] = useState('negocio');

  // Profile editing
  const [editing, setEditing] = useState(false);
  const [profileForm, setProfileForm] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Password
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [saving, setSaving] = useState(false);

  // Ajustes
  const [editingAjustes, setEditingAjustes] = useState(false);
  const [ajustesForm, setAjustesForm] = useState({});
  const [savingAjustes, setSavingAjustes] = useState(false);

  // Pagos
  const [pagos, setPagos] = useState([]);
  const [loadingPagos, setLoadingPagos] = useState(false);

  // Renovar
  const [showRenovar, setShowRenovar] = useState(false);
  const [renovarPlan, setRenovarPlan] = useState('');
  const [renovarComprobante, setRenovarComprobante] = useState('');
  const [uploadingComp, setUploadingComp] = useState(false);
  const [sendingRenovar, setSendingRenovar] = useState(false);
  const [qrZoom, setQrZoom] = useState(false);

  const [giros, setGiros] = useState([]);
  useEffect(() => {
    api.get('/auth/giros').then(res => {
      const data = res.data || res;
      setGiros((data.giros || []).map(g => ({ value: g.id, label: g.nombre })));
    }).catch(() => toast.error('Error cargando datos'));
  }, []);

  useEffect(() => {
    if (tab === 'plan' && pagos.length === 0) {
      setLoadingPagos(true);
      api.get('/auth/mis-pagos').then(r => setPagos(r.data || [])).catch(() => toast.error('Error cargando datos')).finally(() => setLoadingPagos(false));
    }
  }, [tab]);

  const startEditing = () => {
    setProfileForm({
      nombre: user?.nombre || '',
      nombre_comercial: user?.empresa || user?.nombre_comercial || '',
      ruc: user?.ruc || '',
      razon_social: user?.razon_social || '',
      igv_rate: user?.igv_rate != null ? (Number(user.igv_rate) < 1 ? parseFloat((Number(user.igv_rate) * 100).toFixed(2)) : Number(user.igv_rate)) : 18,
      pais: user?.pais || 'PE',
      tipo_negocio: user?.tipo_negocio || 'formal',
      precio_decimales: user?.precio_decimales || 'variable',
      giro_negocio_id: user?.giro_negocio_id || '',
    });
    setEditing(true);
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const data = await api.put('/auth/perfil', { ...profileForm });
      const updatedUser = data.data?.user || data.data;
      // MERGE, no reemplazar: el endpoint de perfil no devuelve plan/trial_ends_at/
      // comision_pos. Reemplazar los borraba y ocultaba modulos del sidebar (ej. Mesas
      // requiere plan 'empresario') hasta recargar. El merge preserva esos campos.
      const mergedUser = { ...user, ...updatedUser };
      setUser(mergedUser);
      localStorage.setItem('nodum_user', JSON.stringify(mergedUser));
      localStorage.setItem('nodum_moneda_simbolo', mergedUser.simbolo || 'S/');
      toast.success('Perfil actualizado');
      if (profileForm.giro_negocio_id !== (user?.giro_negocio_id || '')) { window.location.reload(); return; }
      setEditing(false);
    } catch (err) { toast.error(err.message || 'Error actualizando perfil'); }
    finally { setSavingProfile(false); }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('La imagen no debe superar 2MB'); return; }
    setUploadingLogo(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const token = localStorage.getItem('nodum_token');
        const res = await fetch(`${API_BASE}/auth/logo`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ image: reader.result }) });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        setUser({ ...user, logo_url: data.data.logo_url });
        localStorage.setItem('nodum_user', JSON.stringify({ ...user, logo_url: data.data.logo_url }));
        toast.success('Logo actualizado');
      } catch (err) { toast.error(err.message || 'Error subiendo logo'); }
      finally { setUploadingLogo(false); }
    };
    reader.readAsDataURL(file);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwForm.new_password.length < 6) { toast.error('Minimo 6 caracteres'); return; }
    if (pwForm.new_password !== pwForm.confirm_password) { toast.error('No coinciden'); return; }
    setSaving(true);
    try {
      await api.post('/auth/cambiar-password', { password_actual: pwForm.current_password, password_nueva: pwForm.new_password });
      toast.success('Contrasena actualizada');
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleSaveAjustes = async () => {
    setSavingAjustes(true);
    try {
      const data = await api.put('/auth/ajustes', {
        tarifa_mo_global: ajustesForm.tarifa_mo_global !== '' ? Number(ajustesForm.tarifa_mo_global) : null,
        margen_minimo_global: Number(ajustesForm.margen_minimo_global) || 33,
        comision_pos: ajustesForm.comision_pos !== '' ? Number(ajustesForm.comision_pos) : 0,
        impedir_venta_sin_stock: !!ajustesForm.impedir_venta_sin_stock,
        operarios_count: ajustesForm.operarios_count !== '' ? Number(ajustesForm.operarios_count) : 1,
        jornada_horas_dia: ajustesForm.jornada_horas_dia !== '' ? Number(ajustesForm.jornada_horas_dia) : 8,
        dias_laborables_mes: ajustesForm.dias_laborables_mes !== '' ? Number(ajustesForm.dias_laborables_mes) : 22,
      });
      setUser({ ...user, ...data.data });
      localStorage.setItem('nodum_user', JSON.stringify({ ...user, ...data.data }));
      toast.success('Ajustes actualizados');
      setEditingAjustes(false);
    } catch (err) { toast.error(err.message || 'Error'); }
    finally { setSavingAjustes(false); }
  };

  const igvDisplay = user?.igv_rate != null ? (Number(user.igv_rate) < 1 ? parseFloat((Number(user.igv_rate) * 100).toFixed(2)) : Number(user.igv_rate)) : 18;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header con logo */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative group">
          {user?.logo_url ? (
            <img src={user.logo_url} alt="Logo" className="w-14 h-14 rounded-2xl object-cover" />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-[var(--accent)] flex items-center justify-center">
              <User size={20} className="text-white" />
            </div>
          )}
          <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
            {uploadingLogo ? <Loader2 size={16} className="text-white animate-spin" /> : <Upload size={16} className="text-white" />}
            <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" disabled={uploadingLogo} />
          </label>
        </div>
        <div>
          <h2 className="text-xl font-bold text-stone-900">{user?.nombre || 'Mi Perfil'}</h2>
          <p className="text-stone-500 text-sm">{user?.email}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 overflow-x-auto pb-1">
        <SegmentedControl options={TABS.map(t => ({ key: t.key, label: t.label, icon: t.icon }))} value={tab} onChange={setTab} layoutId="perfil-tab" size="sm" />
      </div>

      {/* ══════ Tab: Mi negocio ══════ */}
      {tab === 'negocio' && (
        <div className={cx.card + ' p-5'}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-stone-900">Datos del negocio</h3>
            {!editing && <button onClick={startEditing} className={cx.btnGhost + ' flex items-center gap-1'}><Pencil size={16} /> Editar</button>}
          </div>

          {editing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={cx.label}>Nombre</label>
                  <input type="text" value={profileForm.nombre} onChange={e => setProfileForm({ ...profileForm, nombre: e.target.value })} className={cx.input} />
                </div>
                <div>
                  <label className={cx.label}>Nombre comercial</label>
                  <input type="text" value={profileForm.nombre_comercial} onChange={e => setProfileForm({ ...profileForm, nombre_comercial: e.target.value })} className={cx.input} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={cx.label}>RUC</label>
                  <input type="text" value={profileForm.ruc} onChange={e => setProfileForm({ ...profileForm, ruc: e.target.value })} className={cx.input} maxLength={11} />
                </div>
                <div>
                  <label className={cx.label}>Razon social</label>
                  <input type="text" value={profileForm.razon_social} onChange={e => setProfileForm({ ...profileForm, razon_social: e.target.value })} className={cx.input} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={cx.label}>IGV en tus precios</label>
                  {user?.igv_exonerada ? (
                    <div className="mt-1">
                      <span className={cx.badge('bg-emerald-50 text-emerald-600')}>Exonerada de IGV — Amazonía</span>
                      <p className="text-[10px] text-stone-400 mt-1.5 leading-relaxed">
                        Tu empresa está exonerada de IGV (Ley 27037): tus boletas oficiales salen sin IGV automáticamente. Esta condición la gestiona el equipo de Kudi.
                      </p>
                    </div>
                  ) : (
                    <>
                      <CustomSelect
                        value={profileForm.tipo_negocio === 'informal' ? `no_igv_${profileForm.igv_rate || 18}` : `formal_${profileForm.igv_rate}`}
                        onChange={(val) => {
                          if (val === 'no_igv_18') setProfileForm(prev => ({ ...prev, tipo_negocio: 'informal', igv_rate: 18 }));
                          else if (val === 'no_igv_10.5') setProfileForm(prev => ({ ...prev, tipo_negocio: 'informal', igv_rate: 10.5 }));
                          else if (val === 'formal_10.5') setProfileForm(prev => ({ ...prev, tipo_negocio: 'formal', igv_rate: 10.5 }));
                          else setProfileForm(prev => ({ ...prev, tipo_negocio: 'formal', igv_rate: 18 }));
                        }}
                        options={[
                          { value: 'formal_18', label: 'Mis precios incluyen IGV (18%)' },
                          { value: 'formal_10.5', label: 'Mis precios incluyen IGV (10.5%)' },
                          { value: 'no_igv_18', label: 'Mis precios NO incluyen IGV · Al boletear: 18%' },
                          { value: 'no_igv_10.5', label: 'Mis precios NO incluyen IGV · Al boletear: 10.5%' },
                        ]}
                      />
                      <p className="text-[10px] text-stone-400 mt-1.5 leading-relaxed">
                        {profileForm.tipo_negocio === 'informal'
                          ? 'Tus productos se crean al precio que pones. Al boletear, Kudi agrega el IGV automáticamente.'
                          : 'Tus precios ya incluyen IGV. El margen se calcula descontando el IGV.'}
                      </p>
                    </>
                  )}
                </div>
                <div>
                  <label className={cx.label}>Pais</label>
                  <CustomSelect
                    value={profileForm.pais}
                    onChange={v => setProfileForm({ ...profileForm, pais: v })}
                    options={PAISES.map(p => ({ value: p.code, label: `${p.name} (${p.simbolo})` }))}
                  />
                </div>
              </div>
              <div>
                <label className={cx.label}>Redondeo del precio cobrado</label>
                <CustomSelect
                  value={profileForm.precio_decimales || 'variable'}
                  onChange={v => setProfileForm({ ...profileForm, precio_decimales: v })}
                  options={[
                    { value: 'variable', label: 'Hacia arriba a S/0.10 (recomendado)' },
                    { value: 'cercano', label: 'Al S/0.10 mas cercano' },
                    { value: 'enteros', label: 'Al sol entero mas cercano' },
                    { value: 'exacto', label: 'Exacto, con centimos (sin redondeo)' },
                  ]}
                />
                <p className="text-[10px] text-stone-400 mt-1.5 leading-relaxed">
                  {{
                    variable: 'Redondea SIEMPRE hacia arriba al multiplo de S/0.10. Nunca pierdes margen y facilita el vuelto (no hay monedas de 1-9 centimos). Ej: S/21.24 se cobra S/21.30.',
                    cercano: 'Redondea al S/0.10 mas cercano (arriba o abajo). Ej: S/21.24 se cobra S/21.20; S/21.26 se cobra S/21.30.',
                    enteros: 'Redondea al sol entero mas cercano. Ej: S/21.24 se cobra S/21.',
                    exacto: 'No redondea: cobras el precio con centimos tal cual. Ej: S/21.24 se cobra S/21.24.',
                  }[profileForm.precio_decimales || 'variable']}
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleSaveProfile} disabled={savingProfile} className={cx.btnPrimary + ' flex items-center gap-2'}>
                  {savingProfile ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save size={16} /> Guardar</>}
                </button>
                <button onClick={() => setEditing(false)} className={cx.btnSecondary}><X size={16} /> Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div><label className={cx.label}>Nombre</label><p className="text-stone-800 text-sm">{user?.nombre || '-'}</p></div>
              <div><label className={cx.label}>Negocio</label><p className="text-stone-800 text-sm">{user?.empresa || '-'}</p></div>
              <div><label className={cx.label}>RUC</label><p className="text-stone-800 text-sm">{user?.ruc || '-'}</p></div>
              <div><label className={cx.label}>Razon social</label><p className="text-stone-800 text-sm">{user?.razon_social || '-'}</p></div>
              <div><label className={cx.label}>IGV</label><p className="text-stone-800 text-sm">{user?.tipo_negocio === 'informal' ? 'No incluye IGV' : `Incluye IGV (${igvDisplay}%)`}</p></div>
              <div><label className={cx.label}>Pais</label><p className="text-stone-800 text-sm">{getPaisByCode(user?.pais)?.name || user?.pais || '-'}</p></div>
              <div><label className={cx.label}>Redondeo</label><p className="text-stone-800 text-sm">{{
                variable: 'Hacia arriba a S/0.10',
                decimales: 'Hacia arriba a S/0.10',
                cercano: 'Al S/0.10 mas cercano',
                enteros: 'Al sol entero',
                exacto: 'Exacto (con centimos)',
              }[user?.precio_decimales || 'variable']}</p></div>
            </div>
          )}
        </div>
      )}

      {/* ══════ Tab: Mi plan ══════ */}
      {tab === 'plan' && (
        <div className="space-y-4">
          <div className={cx.card + ' p-5'}>
            <h3 className="text-lg font-semibold text-stone-900 mb-4">Plan actual</h3>
            <div className="flex items-center gap-3 mb-4">
              <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${PLAN_COLORS[user?.plan] || 'bg-stone-100 text-stone-600'}`}>
                {PLAN_LABEL[user?.plan] || user?.plan || 'Trial'}
              </span>
              {user?.plan === 'trial' && user?.trial_ends_at && (
                <span className="text-sm text-stone-500">
                  {new Date(user.trial_ends_at) > new Date()
                    ? `Vence el ${new Date(user.trial_ends_at).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', timeZone: 'America/Lima' })}`
                    : 'Trial vencido'}
                </span>
              )}
              {user?.plan && user.plan !== 'trial' && pagos.some(p => p.estado === 'aprobado') && (() => {
                const lastApproved = pagos.find(p => p.estado === 'aprobado');
                if (!lastApproved) return null;
                const renewDate = new Date(lastApproved.revisado_at || lastApproved.created_at);
                renewDate.setMonth(renewDate.getMonth() + 1);
                const daysLeft = Math.ceil((renewDate - new Date()) / (1000 * 60 * 60 * 24));
                return (
                  <span className={`text-sm ${daysLeft <= 5 ? 'text-amber-600 font-semibold' : 'text-stone-500'}`}>
                    Renovación: {renewDate.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', timeZone: 'America/Lima' })}
                    {daysLeft <= 5 && daysLeft > 0 && ` (${daysLeft} días)`}
                    {daysLeft <= 0 && ' — Vencido'}
                  </span>
                );
              })()}
            </div>
            {(user?.plan === 'trial' || !user?.plan) && (
              <p className="text-sm text-stone-500 mb-3">Activa un plan para productos ilimitados, caja, facturación y más.</p>
            )}
            <button onClick={() => setShowRenovar(true)}
              className={cx.btnPrimary + ' inline-flex items-center gap-2 text-sm'}>
              <CreditCard size={16} />
              {user?.plan && user.plan !== 'trial' ? 'Renovar plan' : 'Activar un plan'}
            </button>
          </div>

          <div className={cx.card + ' p-5'}>
            <h3 className="text-lg font-semibold text-stone-900 mb-4">Historial de pagos</h3>
            {loadingPagos ? (
              <div className="space-y-2">{[1,2].map(i => <div key={i} className={cx.skeleton + ' h-12'} />)}</div>
            ) : pagos.length === 0 ? (
              <p className="text-stone-400 text-sm">No hay pagos registrados</p>
            ) : (
              <div className="space-y-2">
                {pagos.map(p => (
                  <div key={p.id} className="flex items-center justify-between py-3 border-b border-stone-100 last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm text-stone-800 font-medium">{PLAN_LABEL[p.plan] || p.plan} · {formatCurrency(p.monto)}</p>
                      <p className="text-[10px] text-stone-400">
                        Pagado: {new Date(p.created_at).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Lima' })}
                        {p.revisado_at && <> · Aprobado: {new Date(p.revisado_at).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', timeZone: 'America/Lima' })}</>}
                      </p>
                      {p.referencia_pago && (
                        <p className="text-[10px] text-stone-500 font-mono mt-0.5">Ref: {p.referencia_pago}</p>
                      )}
                    </div>
                    <span className={cx.badge(p.estado === 'aprobado' ? 'bg-emerald-50 text-emerald-600' : p.estado === 'pendiente' ? 'bg-amber-50 text-amber-600' : p.estado === 'rechazado' ? 'bg-rose-50 text-rose-600' : 'bg-stone-100 text-stone-500')}>
                      {p.estado === 'aprobado' ? 'Aprobado' : p.estado === 'pendiente' ? 'Pendiente' : p.estado === 'rechazado' ? 'Rechazado' : p.estado}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════ Tab: Seguridad ══════ */}
      {tab === 'seguridad' && (
        <div className={cx.card + ' p-5'}>
          <h3 className="text-lg font-semibold text-stone-900 mb-4">Cambiar contrasena</h3>
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
            <div>
              <label className={cx.label}>Contrasena actual</label>
              <input type="password" value={pwForm.current_password} onChange={e => setPwForm({ ...pwForm, current_password: e.target.value })} className={cx.input} required />
            </div>
            <div>
              <label className={cx.label}>Nueva contrasena</label>
              <input type="password" value={pwForm.new_password} onChange={e => setPwForm({ ...pwForm, new_password: e.target.value })} className={cx.input} required minLength={6} />
            </div>
            <div>
              <label className={cx.label}>Confirmar</label>
              <input type="password" value={pwForm.confirm_password} onChange={e => setPwForm({ ...pwForm, confirm_password: e.target.value })} className={cx.input} required />
            </div>
            <button type="submit" disabled={saving} className={cx.btnPrimary + ' flex items-center gap-2'}>
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save size={16} /> Actualizar</>}
            </button>
          </form>
        </div>
      )}

      {/* ══════ Tab: Ajustes ══════ */}
      {tab === 'ajustes' && (
        <div className={cx.card + ' p-5'}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-stone-900">Ajustes globales</h3>
            {!editingAjustes && <button onClick={() => { setAjustesForm({ tarifa_mo_global: user?.tarifa_mo_global || '', margen_minimo_global: user?.margen_minimo_global || 33, comision_pos: user?.comision_pos || 0, impedir_venta_sin_stock: user?.impedir_venta_sin_stock || false, operarios_count: user?.operarios_count ?? 1, jornada_horas_dia: user?.jornada_horas_dia ?? 8, dias_laborables_mes: user?.dias_laborables_mes ?? 22 }); setEditingAjustes(true); }} className={cx.btnGhost + ' flex items-center gap-1'}><Pencil size={16} /> Editar</button>}
          </div>
          {editingAjustes ? (
            <div className="space-y-4 max-w-sm">
              <div>
                <label className={cx.label}>Tarifa mano de obra / hora ({user?.simbolo || 'S/'})</label>
                <input type="number" step="0.01" min="0" placeholder="Ej: 15.00" value={ajustesForm.tarifa_mo_global} onChange={e => setAjustesForm({ ...ajustesForm, tarifa_mo_global: e.target.value })} className={cx.input} />
                <p className="text-[11px] text-stone-400 mt-1">Valor manual usado hoy en el costeo. Puedes derivarlo de la tasa calculada en P&amp;L → Tasas del período.</p>
              </div>

              {/* ── Capacidad (modelo de costeo por absorción) ── */}
              <div className="border-t border-stone-100 pt-4">
                <p className="text-sm font-semibold text-stone-700 mb-1">Capacidad del taller</p>
                <p className="text-[11px] text-stone-400 mb-3 leading-relaxed">Capacidad <b>teórica</b> mensual. Define cuántas horas-hombre tienes disponibles para repartir el costo de mano de obra. No afecta todavía el costo de tus productos.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={cx.label}>Operarios</label>
                    <input type="number" step="1" min="1" value={ajustesForm.operarios_count} onChange={e => setAjustesForm({ ...ajustesForm, operarios_count: e.target.value })} className={cx.input} placeholder="1" />
                  </div>
                  <div>
                    <label className={cx.label}>Horas / día</label>
                    <input type="number" step="0.5" min="0" value={ajustesForm.jornada_horas_dia} onChange={e => setAjustesForm({ ...ajustesForm, jornada_horas_dia: e.target.value })} className={cx.input} placeholder="8" />
                  </div>
                  <div>
                    <label className={cx.label}>Días laborables / mes</label>
                    <input type="number" step="1" min="1" max="31" value={ajustesForm.dias_laborables_mes} onChange={e => setAjustesForm({ ...ajustesForm, dias_laborables_mes: e.target.value })} className={cx.input} placeholder="22" />
                  </div>
                </div>
                <div className="mt-3 rounded-lg bg-[var(--accent-light)] border border-emerald-100 px-3 py-2">
                  <p className="text-[11px] text-stone-500">Horas-hombre / mes (capacidad teórica)</p>
                  <p className="text-sm font-bold text-stone-800 tabular-nums">
                    {((Number(ajustesForm.operarios_count) || 0) * (Number(ajustesForm.jornada_horas_dia) || 0) * (Number(ajustesForm.dias_laborables_mes) || 0)).toLocaleString('es-PE', { maximumFractionDigits: 2 })} h
                  </p>
                  <p className="text-[10px] text-stone-400 mt-0.5">
                    {ajustesForm.operarios_count || 0} operarios × {ajustesForm.jornada_horas_dia || 0} h/día × {ajustesForm.dias_laborables_mes || 0} días
                  </p>
                </div>
              </div>

              <div>
                <label className={cx.label}>Margen minimo objetivo (%)</label>
                <input type="number" step="0.1" min="0" max="99" value={ajustesForm.margen_minimo_global} onChange={e => setAjustesForm({ ...ajustesForm, margen_minimo_global: e.target.value })} className={cx.input} />
              </div>
              <div>
                <label className={cx.label}>Comisión POS tarjeta (%)</label>
                <input type="number" step="0.1" min="0" max="20" value={ajustesForm.comision_pos} onChange={e => setAjustesForm({ ...ajustesForm, comision_pos: e.target.value })} className={cx.input} placeholder="Ej: 3.5" />
                <p className="text-[11px] text-stone-400 mt-1">Se suma al total cuando el cliente paga con tarjeta</p>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!ajustesForm.impedir_venta_sin_stock} onChange={e => setAjustesForm({ ...ajustesForm, impedir_venta_sin_stock: e.target.checked })} className="w-4 h-4 rounded" />
                  <span className="text-sm font-medium text-stone-700">Bloquear venta cuando no haya stock</span>
                </label>
                <p className="text-[11px] text-stone-400 mt-1">⚠️ <b>Desmarcado (recomendado):</b> se permite vender aunque no haya stock (queda en negativo, con aviso). <b>Marcado:</b> se bloquea la venta de productos sin stock disponible.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveAjustes} disabled={savingAjustes} className={cx.btnPrimary + ' flex items-center gap-2'}>
                  {savingAjustes ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save size={16} /> Guardar</>}
                </button>
                <button onClick={() => setEditingAjustes(false)} className={cx.btnSecondary}><X size={16} /> Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div><label className={cx.label}>Tarifa MO / hora</label><p className="text-stone-800 text-sm">{user?.tarifa_mo_global ? `${user?.simbolo || 'S/'} ${Number(user.tarifa_mo_global).toFixed(2)}` : 'No configurada'}</p></div>
              <div><label className={cx.label}>Margen minimo</label><p className="text-stone-800 text-sm">{user?.margen_minimo_global || 33}%</p></div>
              <div><label className={cx.label}>Comisión POS tarjeta</label><p className="text-stone-800 text-sm">{user?.comision_pos ? `${Number(user.comision_pos)}%` : 'No configurada'}</p></div>
              <div><label className={cx.label}>Venta sin stock</label><p className="text-stone-800 text-sm">{user?.impedir_venta_sin_stock ? 'Bloqueada' : 'Permitida'}</p></div>
              <div className="col-span-2 border-t border-stone-100 pt-3 mt-1">
                <label className={cx.label}>Capacidad del taller</label>
                <p className="text-stone-800 text-sm">
                  {user?.operarios_count ?? 1} operarios · {user?.jornada_horas_dia ?? 8} h/día · {user?.dias_laborables_mes ?? 22} días/mes
                </p>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  = {((Number(user?.operarios_count ?? 1)) * (Number(user?.jornada_horas_dia ?? 8)) * (Number(user?.dias_laborables_mes ?? 22))).toLocaleString('es-PE', { maximumFractionDigits: 2 })} horas-hombre / mes
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Máquinas */}
      {tab === 'ajustes' && <MaquinasConfig api={api} toast={toast} simbolo={user?.simbolo || 'S/'} />}

      {/* Márgenes por categoría */}
      {tab === 'ajustes' && <MargenesConfig api={api} toast={toast} />}

      {/* ══════ Tab: Equipo ══════ */}
      {tab === 'equipo' && <UsuariosPanel />}

      {/* ══════ Tab: Actividad ══════ */}
      {tab === 'actividad' && <ActividadPage />}

      {/* Lightbox QR */}
      <AnimatePresence>
      {qrZoom && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setQrZoom(false)}
          />
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 cursor-zoom-out"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            onClick={() => setQrZoom(false)}
          >
            <img src="/yape-qr.jpg" alt="QR Yape" className="relative max-w-[90vw] max-h-[80vh] rounded-xl shadow-2xl object-contain" />
          </motion.div>
        </>
      )}
      </AnimatePresence>

      {/* ══════ Modal: Renovar plan ══════ */}
      <AnimatePresence>
      {showRenovar && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setShowRenovar(false)}
          />
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-stone-900">Renovar plan</h3>
              <button onClick={() => setShowRenovar(false)} className="text-stone-400 hover:text-stone-600"><X size={16} /></button>
            </div>

            {/* Plan selector */}
            <div>
              <label className={cx.label}>Plan</label>
              <CustomSelect
                value={renovarPlan || user?.plan || 'emprendedor'}
                onChange={v => setRenovarPlan(v)}
                options={[
                  { value: 'independiente', label: 'Independiente — S/ 80/mes' },
                  { value: 'emprendedor', label: 'Emprendedor — S/ 100/mes' },
                  { value: 'empresario', label: 'Empresario — S/ 180/mes' },
                ]}
              />
            </div>

            {/* QR Yape */}
            <div className="text-center space-y-2">
              <p className="text-sm font-semibold text-stone-800">Paga con Yape</p>
              <p className="text-xs text-stone-500">
                Escanea el QR y paga <span className="font-bold text-[#16A34A]">{PLAN_PRECIO[renovarPlan || user?.plan || 'emprendedor']}</span>
              </p>
              <div className="flex flex-col items-center">
                <img
                  src="/yape-qr.jpg" alt="QR Yape"
                  className="w-44 h-44 rounded-xl border border-stone-200 object-contain cursor-zoom-in hover:shadow-lg transition-shadow duration-150"
                  onClick={() => setQrZoom(true)}
                  onError={e => { e.target.style.display = 'none'; }}
                />
                <p className="text-[10px] text-stone-400 mt-1">Toca para ampliar</p>
              </div>
            </div>

            {/* Upload comprobante */}
            <div>
              <label className={cx.label}>Sube tu comprobante de pago</label>
              <label className="block cursor-pointer">
                {renovarComprobante ? (
                  <div className="relative">
                    <img src={renovarComprobante} className="w-full max-h-32 object-contain rounded-xl border border-emerald-300" alt="Comprobante" />
                    <span className="absolute top-2 right-2 bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-full">Subido</span>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-stone-300 rounded-xl p-4 text-center hover:border-stone-400 transition-colors duration-150">
                    {uploadingComp ? (
                      <div className="flex items-center justify-center gap-2 text-stone-500 text-sm">
                        <Loader2 size={16} className="animate-spin" /> Subiendo...
                      </div>
                    ) : (
                      <>
                        <Upload size={16} className="mx-auto text-stone-400 mb-1" />
                        <p className="text-xs text-stone-500">Click para subir foto del pago</p>
                      </>
                    )}
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) { toast.error('Máximo 5MB'); return; }
                  setUploadingComp(true);
                  try {
                    const formData = new FormData();
                    formData.append('image', file);
                    const r = await fetch(`${API_BASE}/onboarding/comprobante`, { method: 'POST', body: formData });
                    const d = await r.json();
                    if (d.url) setRenovarComprobante(d.url);
                    else throw new Error('Error subiendo');
                  } catch { toast.error('Error subiendo comprobante'); }
                  finally { setUploadingComp(false); }
                }} />
              </label>
            </div>

            {/* Submit */}
            <button
              disabled={!renovarComprobante || sendingRenovar}
              onClick={async () => {
                setSendingRenovar(true);
                try {
                  await api.post('/auth/renovar', {
                    plan: renovarPlan || user?.plan || 'emprendedor',
                    comprobante_url: renovarComprobante,
                  });
                  toast.success('Solicitud de renovación enviada. Te notificaremos cuando sea aprobada.');
                  setShowRenovar(false);
                  setRenovarComprobante('');
                  // Reload pagos
                  api.get('/auth/mis-pagos').then(r => setPagos(r.data || [])).catch(() => {});
                } catch (err) { toast.error(err.message || 'Error enviando renovación'); }
                finally { setSendingRenovar(false); }
              }}
              className={cx.btnPrimary + ' w-full flex items-center justify-center gap-2'}
            >
              {sendingRenovar ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
              Enviar comprobante de pago
            </button>
          </div>
          </motion.div>
        </>
      )}
      </AnimatePresence>
    </div>
  );
}

// ── Márgenes por categoría ──
function MargenesConfig({ api, toast }) {
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newCat, setNewCat] = useState('');

  useEffect(() => {
    api.get('/margenes/categorias')
      .then(r => setCats((r?.data || r || []).sort((a, b) => a.orden - b.orden)))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line

  const handleSave = async () => {
    // Validate
    for (const c of cats) {
      if (c.activo && (c.margen_minimo >= c.margen_moderado || c.margen_moderado >= c.margen_optimo)) {
        toast.error(`${c.nombre}: mínimo < moderado < óptimo`);
        return;
      }
    }
    setSaving(true);
    try {
      await api.put('/margenes/categorias', { categorias: cats });
      toast.success('Márgenes guardados');
    } catch { toast.error('Error guardando'); }
    finally { setSaving(false); }
  };

  const handleAdd = async () => {
    if (!newCat.trim()) return;
    try {
      const r = await api.post('/margenes/categorias', { nombre: newCat.trim(), margen_minimo: 30, margen_moderado: 45, margen_optimo: 60 });
      setCats(prev => [...prev, r?.data || r]);
      setNewCat('');
    } catch { toast.error('Error creando categoría'); }
  };

  const handleDelete = async (id) => {
    try {
      await api.del(`/margenes/categorias/${id}`);
      setCats(prev => prev.filter(c => c.id !== id));
    } catch { toast.error('Error eliminando'); }
  };

  const update = (id, field, value) => {
    setCats(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  if (loading) return <div className={cx.skeleton + ' h-48 rounded-xl mt-4'} />;

  return (
    <div className={cx.card + ' p-5 mt-4'}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-lg font-semibold text-stone-900">Márgenes por categoría</h3>
      </div>
      <p className="text-xs text-stone-400 mb-4">Define los márgenes objetivo para evaluar la rentabilidad de tus productos.</p>

      {cats.length === 0 ? (
        <p className="text-sm text-stone-400 py-4 text-center">No hay categorías configuradas</p>
      ) : (
        <div className="space-y-2 mb-4">
          {/* Header */}
          <div className="grid grid-cols-[auto_1fr_72px_72px_72px_32px] gap-2 items-center px-2">
            <div className="w-8" />
            <span className={cx.th}>Categoría</span>
            <span className={cx.th + ' text-center'}>🔴 Mín</span>
            <span className={cx.th + ' text-center'}>🟡 Mod</span>
            <span className={cx.th + ' text-center'}>🟢 Ópt</span>
            <div />
          </div>

          {cats.map(c => (
            <div key={c.id}
              className={`grid grid-cols-[auto_1fr_72px_72px_72px_32px] gap-2 items-center px-2 py-2 rounded-lg transition-opacity ${c.activo ? '' : 'opacity-40'}`}>
              {/* Toggle */}
              <button onClick={() => update(c.id, 'activo', !c.activo)} className="w-8 text-stone-400 hover:text-[#16A34A]">
                {c.activo ? <ToggleRight size={20} className="text-[#16A34A]" /> : <ToggleLeft size={20} />}
              </button>
              {/* Name */}
              <span className="text-sm font-medium text-stone-700 truncate">{c.nombre}</span>
              {/* Min */}
              <input type="number" min="0" max="99" step="1"
                value={c.margen_minimo} onChange={e => update(c.id, 'margen_minimo', Number(e.target.value))}
                className="w-full text-center text-sm px-1 py-1.5 rounded-lg border border-rose-200 bg-rose-50/50 text-rose-700 focus:outline-none focus:border-rose-400"
                disabled={!c.activo} />
              {/* Mod */}
              <input type="number" min="0" max="99" step="1"
                value={c.margen_moderado} onChange={e => update(c.id, 'margen_moderado', Number(e.target.value))}
                className="w-full text-center text-sm px-1 py-1.5 rounded-lg border border-amber-200 bg-amber-50/50 text-amber-700 focus:outline-none focus:border-amber-400"
                disabled={!c.activo} />
              {/* Opt */}
              <input type="number" min="0" max="99" step="1"
                value={c.margen_optimo} onChange={e => update(c.id, 'margen_optimo', Number(e.target.value))}
                className="w-full text-center text-sm px-1 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50/50 text-emerald-700 focus:outline-none focus:border-emerald-400"
                disabled={!c.activo} />
              {/* Delete */}
              <button onClick={() => handleDelete(c.id)} className="text-stone-300 hover:text-rose-500 transition-colors">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add custom */}
      <div className="flex gap-2 mb-4">
        <input type="text" value={newCat} onChange={e => setNewCat(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          className={cx.input + ' text-sm flex-1'} placeholder="Nueva categoría..." />
        <button onClick={handleAdd} disabled={!newCat.trim()} className={cx.btnGhost + ' flex items-center gap-1'}>
          <Plus size={14} /> Agregar
        </button>
      </div>

      {/* Save */}
      <button onClick={handleSave} disabled={saving} className={cx.btnPrimary + ' flex items-center gap-2'}>
        {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
        Guardar márgenes
      </button>
    </div>
  );
}

// ── Máquinas (CIF por hora-máquina) ──
function MaquinasConfig({ api, toast, simbolo }) {
  const [maquinas, setMaquinas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ nombre: '', descripcion: '', horas_disponibles_mes: 160 });
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [delTarget, setDelTarget] = useState(null);

  useEffect(() => {
    api.get('/maquinas')
      .then(r => setMaquinas(r?.data || r || []))
      .catch(() => setMaquinas([]))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line

  const totalHoras = maquinas.reduce((s, m) => s + (Number(m.horas_disponibles_mes) || 0), 0);

  const handleCreate = async () => {
    if (!form.nombre.trim()) { toast.error('Ponle un nombre a la máquina'); return; }
    setCreating(true);
    try {
      const r = await api.post('/maquinas', {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        horas_disponibles_mes: form.horas_disponibles_mes !== '' ? Number(form.horas_disponibles_mes) : 160,
      });
      setMaquinas(prev => [...prev, r?.data || r]);
      setForm({ nombre: '', descripcion: '', horas_disponibles_mes: 160 });
      toast.success('Máquina agregada');
    } catch (err) { toast.error(err.message || 'Error creando máquina'); }
    finally { setCreating(false); }
  };

  // Normaliza un NUMERIC(12,4) del backend ("200.0000") a número humano (200, 18.5)
  // para que el input no muestre decimales basura.
  const cleanHoras = (v) => {
    if (v == null || v === '') return '';
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
  };

  const startEdit = (m) => {
    setEditId(m.id);
    setEditForm({ nombre: m.nombre, descripcion: m.descripcion || '', horas_disponibles_mes: cleanHoras(m.horas_disponibles_mes ?? 160) });
  };

  const handleSaveEdit = async (id) => {
    if (!editForm.nombre.trim()) { toast.error('Ponle un nombre a la máquina'); return; }
    setSavingEdit(true);
    try {
      const r = await api.put(`/maquinas/${id}`, {
        nombre: editForm.nombre.trim(),
        descripcion: editForm.descripcion?.trim() || null,
        horas_disponibles_mes: editForm.horas_disponibles_mes !== '' ? Number(editForm.horas_disponibles_mes) : 160,
      });
      const updated = r?.data || r;
      setMaquinas(prev => prev.map(m => m.id === id ? { ...m, ...updated } : m));
      setEditId(null);
      toast.success('Máquina actualizada');
    } catch (err) { toast.error(err.message || 'Error guardando'); }
    finally { setSavingEdit(false); }
  };

  const handleDelete = async () => {
    const id = delTarget?.id;
    setDelTarget(null);
    if (!id) return;
    try {
      await api.del(`/maquinas/${id}`);
      setMaquinas(prev => prev.filter(m => m.id !== id));
      toast.success('Máquina eliminada');
    } catch (err) { toast.error(err.message || 'Error eliminando'); }
  };

  if (loading) return <div className={cx.skeleton + ' h-48 rounded-xl mt-4'} />;

  return (
    <div className={cx.card + ' p-5 mt-4'}>
      <div className="flex items-center gap-2 mb-1">
        <Cog size={18} className="text-stone-400" />
        <h3 className="text-lg font-semibold text-stone-900">Máquinas</h3>
      </div>
      <p className="text-xs text-stone-400 mb-4 leading-relaxed">
        Las horas-máquina disponibles reparten los <b>costos indirectos de fabricación (CIF)</b> por hora.
        El total alimenta la tasa hora-máquina en P&amp;L → Tasas del período. No afecta todavía el costo de tus productos.
      </p>

      {/* Total */}
      <div className="mb-4 flex items-center justify-between rounded-lg bg-[var(--accent-light)] border border-emerald-100 px-4 py-2.5">
        <span className="text-sm font-medium text-stone-600">Horas-máquina / mes (total)</span>
        <span className="text-base font-bold text-stone-800 tabular-nums">
          {totalHoras.toLocaleString('es-PE', { maximumFractionDigits: 2 })} h
        </span>
      </div>

      {/* Lista */}
      {maquinas.length === 0 ? (
        <p className="text-sm text-stone-400 py-4 text-center">No hay máquinas configuradas todavía.</p>
      ) : (
        <div className="space-y-2 mb-4">
          {maquinas.map(m => (
            <div key={m.id} className="rounded-lg border border-stone-200 px-3 py-2.5">
              {editId === m.id ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-2">
                    <div>
                      <label className={cx.label}>Nombre de la máquina</label>
                      <input type="text" value={editForm.nombre} onChange={e => setEditForm({ ...editForm, nombre: e.target.value })} className={cx.input + ' text-sm'} placeholder="Ej: Horno industrial" />
                    </div>
                    <div>
                      <label className={cx.label}>Horas disponibles / mes</label>
                      <input type="number" step="0.5" min="0" inputMode="decimal" value={editForm.horas_disponibles_mes} onChange={e => setEditForm({ ...editForm, horas_disponibles_mes: e.target.value })} className={cx.input + ' text-sm'} placeholder="Ej: 200" />
                    </div>
                  </div>
                  <div>
                    <label className={cx.label}>Descripción (opcional)</label>
                    <input type="text" value={editForm.descripcion} onChange={e => setEditForm({ ...editForm, descripcion: e.target.value })} className={cx.input + ' text-sm'} placeholder="Ej: 2 hornos en paralelo" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleSaveEdit(m.id)} disabled={savingEdit} className={cx.btnPrimary + ' flex items-center gap-1.5 min-h-[44px]'}>
                      {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Guardar
                    </button>
                    <button onClick={() => setEditId(null)} className={cx.btnSecondary + ' min-h-[44px]'}><X size={14} /> Cancelar</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-800 truncate">{m.nombre}</p>
                    {m.descripcion && <p className="text-[11px] text-stone-400 truncate">{m.descripcion}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm text-stone-600 tabular-nums">{Number(m.horas_disponibles_mes || 0).toLocaleString('es-PE', { maximumFractionDigits: 2 })} h/mes</span>
                    <button onClick={() => startEdit(m)} className={cx.btnIcon} title="Editar"><Pencil size={15} /></button>
                    <button onClick={() => setDelTarget(m)} className="p-2 text-stone-300 hover:text-rose-500 rounded-lg transition-colors" title="Eliminar"><Trash2 size={15} /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Agregar */}
      <div className="border-t border-stone-100 pt-4">
        <p className="text-sm font-semibold text-stone-700 mb-2">Agregar máquina</p>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-2 mb-2">
          <div>
            <label className={cx.label}>Nombre de la máquina</label>
            <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className={cx.input + ' text-sm'} placeholder="Ej: Horno industrial" />
          </div>
          <div>
            <label className={cx.label}>Horas disponibles / mes</label>
            <input type="number" step="0.5" min="0" inputMode="decimal" value={form.horas_disponibles_mes} onChange={e => setForm({ ...form, horas_disponibles_mes: e.target.value })} className={cx.input + ' text-sm'} placeholder="Ej: 200" />
          </div>
        </div>
        <div className="mb-2">
          <label className={cx.label}>Descripción (opcional)</label>
          <input type="text" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} className={cx.input + ' text-sm'} placeholder="Ej: 2 hornos en paralelo" />
        </div>
        <button onClick={handleCreate} disabled={creating || !form.nombre.trim()} className={cx.btnPrimary + ' flex items-center gap-2 min-h-[44px]'}>
          {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Agregar máquina
        </button>
      </div>

      <ConfirmDialog
        open={!!delTarget}
        title="Eliminar máquina"
        message={delTarget ? `¿Eliminar "${delTarget.nombre}"? Sus horas dejarán de contar para la tasa hora-máquina.` : ''}
        confirmText="Eliminar"
        confirmStyle="danger"
        onConfirm={handleDelete}
        onCancel={() => setDelTarget(null)}
      />
    </div>
  );
}
