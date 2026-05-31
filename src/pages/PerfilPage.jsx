import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { cx } from '../styles/tokens';
import { formatCurrency } from '../utils/format';
import { User, Lock, Save, Pencil, X, Upload, Loader2, Settings, CreditCard, Building2, Activity, Users } from 'lucide-react';
import CustomSelect from '../components/CustomSelect';
import { PAISES, getPaisByCode } from '../config/paises';
import { API_BASE } from '../config/api';
import ActividadPage from './ActividadPage';
import EquipoPage from './EquipoPage';

const PLAN_LABEL = { trial: 'Prueba gratuita', independiente: 'Independiente', emprendedor: 'Emprendedor', empresario: 'Empresario', pro: 'Pro' };
const PLAN_COLORS = { trial: 'bg-amber-50 text-amber-600', independiente: 'bg-blue-50 text-blue-600', emprendedor: 'bg-indigo-50 text-indigo-600', empresario: 'bg-emerald-50 text-emerald-600', pro: 'bg-emerald-50 text-emerald-600' };

const TABS = [
  { key: 'negocio', label: 'Mi negocio', icon: Building2 },
  { key: 'plan', label: 'Mi plan', icon: CreditCard },
  { key: 'equipo', label: 'Equipo', icon: Users },
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
      setUser(updatedUser);
      localStorage.setItem('nodum_user', JSON.stringify(updatedUser));
      localStorage.setItem('nodum_moneda_simbolo', updatedUser.simbolo || 'S/');
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
      const data = await api.put('/auth/ajustes', { tarifa_mo_global: ajustesForm.tarifa_mo_global !== '' ? Number(ajustesForm.tarifa_mo_global) : null, margen_minimo_global: Number(ajustesForm.margen_minimo_global) || 33 });
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
              <User size={24} className="text-white" />
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

      {/* ══════ Tab: Mi negocio ══════ */}
      {tab === 'negocio' && (
        <div className={cx.card + ' p-5'}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-stone-900">Datos del negocio</h3>
            {!editing && <button onClick={startEditing} className={cx.btnGhost + ' flex items-center gap-1'}><Pencil size={14} /> Editar</button>}
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
              <div className="flex gap-2 pt-2">
                <button onClick={handleSaveProfile} disabled={savingProfile} className={cx.btnPrimary + ' flex items-center gap-2'}>
                  {savingProfile ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save size={14} /> Guardar</>}
                </button>
                <button onClick={() => setEditing(false)} className={cx.btnSecondary}><X size={14} /> Cancelar</button>
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
            <a href={`#/onboarding?plan=${user?.plan === 'trial' || !user?.plan ? 'emprendedor' : user.plan}`}
              className={cx.btnPrimary + ' inline-flex items-center gap-2 text-sm'}>
              <CreditCard size={14} />
              {user?.plan && user.plan !== 'trial' ? 'Renovar plan' : 'Activar un plan'}
            </a>
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
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save size={14} /> Actualizar</>}
            </button>
          </form>
        </div>
      )}

      {/* ══════ Tab: Ajustes ══════ */}
      {tab === 'ajustes' && (
        <div className={cx.card + ' p-5'}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-stone-900">Ajustes globales</h3>
            {!editingAjustes && <button onClick={() => { setAjustesForm({ tarifa_mo_global: user?.tarifa_mo_global || '', margen_minimo_global: user?.margen_minimo_global || 33 }); setEditingAjustes(true); }} className={cx.btnGhost + ' flex items-center gap-1'}><Pencil size={14} /> Editar</button>}
          </div>
          {editingAjustes ? (
            <div className="space-y-4 max-w-sm">
              <div>
                <label className={cx.label}>Tarifa mano de obra / hora ({user?.simbolo || 'S/'})</label>
                <input type="number" step="0.01" min="0" placeholder="Ej: 15.00" value={ajustesForm.tarifa_mo_global} onChange={e => setAjustesForm({ ...ajustesForm, tarifa_mo_global: e.target.value })} className={cx.input} />
              </div>
              <div>
                <label className={cx.label}>Margen minimo objetivo (%)</label>
                <input type="number" step="0.1" min="0" max="99" value={ajustesForm.margen_minimo_global} onChange={e => setAjustesForm({ ...ajustesForm, margen_minimo_global: e.target.value })} className={cx.input} />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveAjustes} disabled={savingAjustes} className={cx.btnPrimary + ' flex items-center gap-2'}>
                  {savingAjustes ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save size={14} /> Guardar</>}
                </button>
                <button onClick={() => setEditingAjustes(false)} className={cx.btnSecondary}><X size={14} /> Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div><label className={cx.label}>Tarifa MO / hora</label><p className="text-stone-800 text-sm">{user?.tarifa_mo_global ? `${user?.simbolo || 'S/'} ${Number(user.tarifa_mo_global).toFixed(2)}` : 'No configurada'}</p></div>
              <div><label className={cx.label}>Margen minimo</label><p className="text-stone-800 text-sm">{user?.margen_minimo_global || 33}%</p></div>
            </div>
          )}
        </div>
      )}

      {/* ══════ Tab: Equipo ══════ */}
      {tab === 'equipo' && <EquipoPage />}

      {/* ══════ Tab: Actividad ══════ */}
      {tab === 'actividad' && <ActividadPage />}
    </div>
  );
}
