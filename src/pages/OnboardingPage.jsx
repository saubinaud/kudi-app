import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { API_BASE } from '../config/api';
import { cx } from '../styles/tokens';
import CustomSelect from '../components/CustomSelect';
import { Loader2 } from 'lucide-react';

const PLAN_LABELS = {
  independiente: { label: 'Plan Independiente', precio: 'S/ 80/mes' },
  emprendedor: { label: 'Plan Emprendedor', precio: 'S/ 100/mes' },
  empresario: { label: 'Plan Empresario', precio: 'S/ 180/mes' },
};

export default function OnboardingPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const inviteToken = params.get('token');
  const selectedPlan = params.get('plan'); // independiente, emprendedor, empresario, or null (trial)

  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);
  const [inviteData, setInviteData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [paises, setPaises] = useState([]);
  const [giros, setGiros] = useState([]);

  // Payment flow
  const [showPayment, setShowPayment] = useState(false);
  const [comprobanteUrl, setComprobanteUrl] = useState('');
  const [uploadingComprobante, setUploadingComprobante] = useState(false);
  const isPaidPlan = selectedPlan && ['independiente', 'emprendedor', 'empresario'].includes(selectedPlan);

  const [form, setForm] = useState({
    nombre: '',
    telefono: '',
    dni: '',
    ruc: '',
    razon_social: '',
    tipo_contribuyente: '',
    nombre_comercial: '',
    giro_negocio_id: '',
    igv_rate: '18',
    pais: 'PE',
    tipo_negocio: 'formal',
    password: '',
    password_confirm: '',
  });

  useEffect(() => {
    fetch(`${API_BASE}/auth/paises`)
      .then((r) => r.json())
      .then((data) => { if (data.success) setPaises(data.data); })
      .catch(() => {});
    setGiros([
      { value: 1, label: 'Panadería y Pastelería' },
      { value: 2, label: 'Restaurante / Dark Kitchen' },
      { value: 8, label: 'Cafetería de Especialidad' },
      { value: 3, label: 'Catering y Eventos' },
      { value: 4, label: 'Food Truck / Comida rápida' },
      { value: 5, label: 'Heladería' },
      { value: 6, label: 'Chocolatería / Confitería' },
      { value: 7, label: 'Cervecería Artesanal' },
      { value: 9, label: 'Jugos y Bebidas' },
      { value: 10, label: 'Procesadora de Alimentos' },
      { value: 20, label: 'Mermeladas y Conservas' },
      { value: 21, label: 'Salsas y Aderezos' },
      { value: 22, label: 'Café y Cacao' },
      { value: 28, label: 'Alimento para Mascotas' },
      { value: 29, label: 'Otro' },
    ]);
  }, []);

  useEffect(() => {
    if (!inviteToken) {
      setValidating(false);
      return;
    }
    fetch(`${API_BASE}/onboarding/validar?token=${inviteToken}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        setValid(true);
        setInviteData(data.data || data);
        const giroFromToken = data?.data?.giro_negocio_id || data?.giro_negocio_id;
        if (giroFromToken) {
          setForm(prev => ({ ...prev, giro_negocio_id: giroFromToken }));
        }
      })
      .catch(() => setValid(false))
      .finally(() => setValidating(false));
  }, [inviteToken]);

  const handleChange = (field) => (e) => {
    const val = e.target.value;
    setForm((prev) => ({ ...prev, [field]: val }));

    if (field === 'ruc' && val.length === 11) {
      fetch(`${API_BASE}/onboarding/consulta-ruc/${val}`)
        .then((r) => r.json())
        .then((data) => {
          setForm((prev) => ({
            ...prev,
            razon_social: data.razon_social || '',
            tipo_contribuyente: data.tipo_contribuyente || '',
          }));
        })
        .catch(() => {});
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.dni.length !== 8) {
      setError('El DNI debe tener 8 digitos');
      return;
    }
    if (form.ruc && form.ruc.length !== 11) {
      setError('El RUC debe tener 11 digitos');
      return;
    }
    if (form.password.length < 6) {
      setError('La contrasena debe tener al menos 6 caracteres');
      return;
    }
    if (form.password !== form.password_confirm) {
      setError('Las contrasenas no coinciden');
      return;
    }

    // If paid plan and not yet shown payment, show payment step first
    if (isPaidPlan && !showPayment) {
      setShowPayment(true);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/onboarding/completar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, token: inviteToken, plan: selectedPlan || 'trial', comprobante_url: comprobanteUrl || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || 'Error al completar registro');
      }
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen bg-[#0A2F24] flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize: '128px'}} />
        <Loader2 className="animate-spin text-white" size={32} />
      </div>
    );
  }

  // Public signup: no token → show request form
  if (!inviteToken || !valid) {
    return <SignupRequestForm giros={giros} selectedPlan={selectedPlan} />;
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#0A2F24] flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize: '128px'}} />
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-xl relative z-10">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <span className="text-emerald-600 text-2xl">&#10003;</span>
          </div>
          <h2 className="text-stone-800 text-lg font-semibold mb-2">Registro completado</h2>
          <p className="text-stone-500 text-sm">Redirigiendo al login...</p>
        </div>
      </div>
    );
  }

  const esInvitado = !!inviteData?.es_invitado;

  return (
    <div className="min-h-screen bg-[#0A2F24] flex items-center justify-center p-4 relative">
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none overflow-hidden" style={{backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize: '128px'}} />
      <div className="bg-white rounded-2xl w-full max-w-lg p-8 shadow-xl relative z-10">
        <div className="flex flex-col items-center mb-6">
          <img src="/logo-kudi.jpg" className="w-20 h-20 mx-auto mb-4 rounded-2xl" alt="Kudi" />
          <h1 className="text-2xl font-bold text-stone-900">Kudi</h1>
          <p className="text-stone-500 text-sm mt-1">{esInvitado ? 'Crea tu acceso' : 'Completa tu registro'}</p>
          {inviteData?.email && (
            <p className="text-stone-400 text-xs mt-1">{inviteData.email}</p>
          )}
        </div>

        {esInvitado && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4 text-center">
            <p className="text-sm font-semibold text-emerald-800">
              Te uniste a {inviteData?.empresa_nombre || 'tu equipo'}
            </p>
            <p className="text-xs text-emerald-600 mt-0.5">Solo completa tus datos para activar tu cuenta.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {showPayment && isPaidPlan && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-center">
              <p className="text-sm font-semibold text-emerald-800">{PLAN_LABELS[selectedPlan]?.label}</p>
              <p className="text-xs text-emerald-600">Completa el pago para activar tu cuenta</p>
            </div>
          )}
          <div className={showPayment ? 'hidden' : ''}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={cx.label}>Nombre completo</label>
              <input
                type="text"
                value={form.nombre}
                onChange={handleChange('nombre')}
                className={cx.input}
                required
              />
            </div>
            <div>
              <label className={cx.label}>Celular / WhatsApp</label>
              <input
                type="tel"
                value={form.telefono}
                onChange={handleChange('telefono')}
                className={cx.input}
                placeholder="999 999 999"
              />
            </div>
          </div>

          {!esInvitado && (
          <div>
            <label className={cx.label}>Nombre de tu negocio</label>
            <input
              type="text"
              value={form.nombre_comercial}
              onChange={handleChange('nombre_comercial')}
              className={cx.input}
              placeholder="Ej: Dulce Tentación, Flora Cafe..."
            />
          </div>
          )}

          <div className={esInvitado ? '' : 'grid grid-cols-2 gap-4'}>
            <div>
              <label className={cx.label}>DNI (8 digitos)</label>
              <input
                type="text"
                value={form.dni}
                onChange={handleChange('dni')}
                className={cx.input}
                maxLength={8}
                pattern="[0-9]{8}"
                required
              />
            </div>
            {!esInvitado && (
            <div>
              <label className={cx.label}>RUC (11 digitos)</label>
              <input
                type="text"
                value={form.ruc}
                onChange={handleChange('ruc')}
                className={cx.input}
                maxLength={11}
              />
            </div>
            )}
          </div>

          {form.razon_social && (
            <div className="bg-stone-100 rounded-xl p-3 space-y-1">
              <p className="text-xs text-stone-400">Razon social</p>
              <p className="text-sm text-stone-800">{form.razon_social}</p>
              {form.tipo_contribuyente && (
                <>
                  <p className="text-xs text-stone-400 mt-2">Tipo contribuyente</p>
                  <p className="text-sm text-stone-800">{form.tipo_contribuyente}</p>
                </>
              )}
            </div>
          )}

          {!esInvitado && (
          <div>
            <label className={cx.label}>Giro de negocio</label>
            <CustomSelect
              value={form.giro_negocio_id || ''}
              onChange={v => setForm({...form, giro_negocio_id: v})}
              options={giros}
              placeholder="¿Qué tipo de negocio tienes?"
            />
          </div>
          )}

          {!esInvitado && (
          <div>
            <label className={cx.label}>Pais</label>
            <CustomSelect
              value={form.pais}
              onChange={(code) => setForm((prev) => ({ ...prev, pais: code }))}
              options={paises.map(p => ({ value: p.code, label: `${p.nombre} (${p.simbolo} ${p.moneda})` }))}
            />
          </div>
          )}

          {!esInvitado && (
          <div>
            <label className={cx.label}>IGV en tus precios</label>
            <CustomSelect
              value={form.tipo_negocio === 'informal' ? `no_igv_${form.igv_rate || 18}` : `formal_${form.igv_rate}`}
              onChange={(val) => {
                if (val === 'no_igv_18') setForm(prev => ({ ...prev, tipo_negocio: 'informal', igv_rate: '18' }));
                else if (val === 'no_igv_10.5') setForm(prev => ({ ...prev, tipo_negocio: 'informal', igv_rate: '10.5' }));
                else if (val === 'formal_10.5') setForm(prev => ({ ...prev, tipo_negocio: 'formal', igv_rate: '10.5' }));
                else setForm(prev => ({ ...prev, tipo_negocio: 'formal', igv_rate: '18' }));
              }}
              options={[
                { value: 'formal_18', label: 'Mis precios incluyen IGV (18%)' },
                { value: 'formal_10.5', label: 'Mis precios incluyen IGV (10.5%)' },
                { value: 'no_igv_18', label: 'Mis precios NO incluyen IGV · Al boletear: 18%' },
                { value: 'no_igv_10.5', label: 'Mis precios NO incluyen IGV · Al boletear: 10.5%' },
              ]}
            />
            <p className="text-[10px] text-stone-400 mt-1 leading-relaxed">
              {form.tipo_negocio === 'informal'
                ? 'Tus productos se crean al precio que cobras. Al boletear, el IGV se agrega automáticamente.'
                : 'El IGV ya está dentro de tu precio de venta.'}
            </p>
          </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={cx.label}>Contrasena</label>
              <input
                type="password"
                name="new-password"
                autoComplete="new-password"
                value={form.password}
                onChange={handleChange('password')}
                className={cx.input}
                required
                minLength={6}
              />
            </div>
            <div>
              <label className={cx.label}>Confirmar</label>
              <input
                type="password"
                value={form.password_confirm}
                onChange={handleChange('password_confirm')}
                className={cx.input}
                required
              />
            </div>
          </div>

          </div>

          {error && (
            <div className="text-rose-600 text-sm bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {/* Payment step — shown after form validation for paid plans */}
          {showPayment && isPaidPlan ? (
            <div className="border-t border-stone-200 pt-5 space-y-4">
              <div className="text-center">
                <p className="text-sm font-semibold text-stone-800">Pago con Yape</p>
                <p className="text-xs text-stone-500 mt-1">
                  Escanea el QR y paga <span className="font-bold text-[#16A34A]">{PLAN_LABELS[selectedPlan]?.precio}</span>
                </p>
              </div>

              {/* QR Image */}
              <div className="flex justify-center">
                <img src="/yape-qr.jpg" alt="QR Yape" className="w-48 h-48 rounded-xl border border-stone-200 object-contain" onError={e => { e.target.style.display = 'none'; }} />
              </div>

              {/* Upload comprobante */}
              <div>
                <label className={cx.label}>Sube tu comprobante de pago</label>
                <label className="block cursor-pointer">
                  {comprobanteUrl ? (
                    <div className="relative">
                      <img src={comprobanteUrl} className="w-full max-h-40 object-contain rounded-xl border border-emerald-300" alt="Comprobante" />
                      <span className="absolute top-2 right-2 bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-full">Subido</span>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-stone-300 rounded-xl p-6 text-center hover:border-stone-400 transition-colors">
                      {uploadingComprobante ? (
                        <div className="flex items-center justify-center gap-2 text-stone-500 text-sm">
                          <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                          Subiendo...
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-stone-500">Click para subir foto del pago</p>
                          <p className="text-[10px] text-stone-400 mt-1">JPG, PNG (max 5MB)</p>
                        </>
                      )}
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) { setError('La imagen debe ser menor a 5MB'); return; }
                    setUploadingComprobante(true);
                    try {
                      const formData = new FormData();
                      formData.append('image', file);
                      const r = await fetch(`${API_BASE}/onboarding/comprobante`, { method: 'POST', body: formData });
                      const d = await r.json();
                      if (d.url) { setComprobanteUrl(d.url); setError(''); }
                      else throw new Error('Error subiendo imagen');
                    } catch (err) { setError(err.message); }
                    finally { setUploadingComprobante(false); }
                  }} />
                </label>
              </div>

              <button
                type="submit"
                disabled={loading || !comprobanteUrl}
                className={cx.btnPrimary + ' w-full flex items-center justify-center gap-2'}
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Completar registro'
                )}
              </button>
              <button type="button" onClick={() => setShowPayment(false)} className="w-full text-center text-xs text-stone-400 hover:text-stone-600">
                Volver a editar datos
              </button>
            </div>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className={cx.btnPrimary + ' w-full flex items-center justify-center gap-2'}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                isPaidPlan ? 'Siguiente — Pago' : 'Completar registro'
              )}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

// ─── Public signup request form (no token needed) ───
function SignupRequestForm({ giros, selectedPlan }) {
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [giroId, setGiroId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [token, setToken] = useState(null);

  const handleRequest = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !nombre) { setError('Email y nombre son requeridos'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/onboarding/solicitar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, nombre, giro_negocio_id: giroId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al solicitar acceso');
      const tk = data.data?.onboarding_token || data.onboarding_token;
      if (tk) {
        setToken(tk);
        // Redirect to onboarding with token
        const planParam = selectedPlan ? `&plan=${selectedPlan}` : '';
        window.location.href = `${window.location.origin}${window.location.pathname}#/onboarding?token=${tk}${planParam}`;
      } else {
        setSent(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-[#0A2F24] flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize: '128px'}} />
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-xl relative z-10">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <span className="text-emerald-600 text-2xl">&#10003;</span>
          </div>
          <h2 className="text-stone-800 text-lg font-semibold mb-2">Solicitud enviada</h2>
          <p className="text-stone-500 text-sm">Te contactaremos pronto con tu acceso.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A2F24] flex items-center justify-center p-4 relative">
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none overflow-hidden" style={{backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize: '128px'}} />
      <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-xl relative z-10">
        <div className="flex flex-col items-center mb-6">
          <img src="/logo-kudi.jpg" className="w-16 h-16 mx-auto mb-3 rounded-xl" alt="Kudi" />
          <h1 className="text-xl font-bold text-stone-900">{selectedPlan ? 'Regístrate en Kudi' : 'Prueba Kudi gratis'}</h1>
          <p className="text-stone-500 text-sm mt-1 text-center">
            {selectedPlan ? PLAN_LABELS[selectedPlan]?.label + ' — ' + PLAN_LABELS[selectedPlan]?.precio : '10 días gratis. Sin tarjeta de crédito.'}
          </p>
        </div>

        {selectedPlan && PLAN_LABELS[selectedPlan] && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-center">
            <p className="text-sm font-semibold text-emerald-800">{PLAN_LABELS[selectedPlan].label}</p>
            <p className="text-xs text-emerald-600">{PLAN_LABELS[selectedPlan].precio} — Pago con Yape después del registro</p>
          </div>
        )}

        <form onSubmit={handleRequest} className="space-y-4">
          <div>
            <label className={cx.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className={cx.input}
              placeholder="tu@negocio.com"
              required
            />
          </div>

          <div>
            <label className={cx.label}>Tu nombre</label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              className={cx.input}
              placeholder="Nombre completo"
              required
            />
          </div>

          <div>
            <label className={cx.label}>Rubro de tu negocio</label>
            <CustomSelect
              value={giroId}
              onChange={v => setGiroId(v)}
              options={giros}
              placeholder="Selecciona tu rubro..."
            />
          </div>

          {error && (
            <div className="text-rose-600 text-sm bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={cx.btnPrimary + ' w-full flex items-center justify-center gap-2'}
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              selectedPlan ? 'Registrarme y pagar' : 'Solicitar prueba gratuita'
            )}
          </button>

          <p className="text-center text-xs text-stone-400 mt-2">
            ¿Ya tienes cuenta? <a href="#/login" className="text-[#16A34A] font-medium">Inicia sesion</a>
          </p>
        </form>
      </div>
    </div>
  );
}
