import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { cx } from '../styles/tokens';
import { formatCurrency, formatDate } from '../utils/format';
import CustomSelect from '../components/CustomSelect';
import PeriodoSelector from '../components/PeriodoSelector';
import ConfirmDialog, { PromptDialog } from '../components/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import {
  FileText, Receipt, Eye, Ban, DollarSign, Trash2, RotateCcw,
  Settings, Upload, CheckCircle, Circle, AlertTriangle, Search, Printer, Truck,
} from 'lucide-react';
import { API_BASE } from '../config/api';

const TIPO_DOC_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: '01', label: 'Factura' },
  { value: '03', label: 'Boleta' },
];

const TIPO_LABELS = { '01': 'Factura', '03': 'Boleta' };

const ESTADO_LABELS = { emitido: 'Aceptado SUNAT', anulado: 'Anulado', error: 'Rechazado', pendiente: 'Pendiente' };

function estadoBadge(estado) {
  switch (estado) {
    case 'emitido': return cx.badge('bg-emerald-50 text-emerald-600');
    case 'anulado': return cx.badge('bg-stone-100 text-stone-500');
    case 'error': return cx.badge('bg-rose-50 text-rose-600');
    case 'pendiente': return cx.badge('bg-amber-50 text-amber-600');
    default: return cx.badge('bg-stone-100 text-stone-500');
  }
}

export default function ComprobantesPage() {
  const api = useApi();
  const toast = useToast();
  const { user } = useAuth();

  const [periodos, setPeriodos] = useState([]);
  const [rawPeriodos, setRawPeriodos] = useState([]);
  const [periodo, setPeriodo] = useState(null);
  const [comprobantes, setComprobantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [tipoFilter, setTipoFilter] = useState('');
  const [anularTarget, setAnularTarget] = useState(null);
  const [deleteRechazados, setDeleteRechazados] = useState(false);
  const [certFile, setCertFile] = useState(null);
  const [certPasswordPrompt, setCertPasswordPrompt] = useState(false);
  const [solValidation, setSolValidation] = useState(null);

  // Facturacion config state
  const [config, setConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [editingConfig, setEditingConfig] = useState(false);
  const [configForm, setConfigForm] = useState({});
  const [savingConfig, setSavingConfig] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [buscandoRuc, setBuscandoRuc] = useState(false);

  // Venta detail sidebar
  const [ventaDetalle, setVentaDetalle] = useState(null);
  const [loadingVenta, setLoadingVenta] = useState(false);

  const openVentaDetalle = async (ventaId) => {
    if (!ventaId) return;
    setLoadingVenta(true);
    try {
      const res = await api.get(`/pl/ventas/${ventaId}/detalle`);
      setVentaDetalle(res.data || res);
    } catch { toast.error('Error cargando venta'); }
    finally { setLoadingVenta(false); }
  };

  // Printer config state
  const [printerConfig, setPrinterConfig] = useState({ printer_ip: '', printer_port: 9100, printer_enabled: false });

  // Load facturacion config
  async function loadConfig() {
    try {
      const res = await api.get('/facturacion/config');
      setConfig(res.data || res);
    } catch { /* config not available yet */ }
    finally { setLoadingConfig(false); }
  }

  // Load periodos + config on mount
  useEffect(() => {
    loadConfig();
    api.get('/print/config').then(r => setPrinterConfig(r?.data || r || {})).catch(() => toast.error('Error cargando datos'));
    api.get('/pl/periodos').then(res => {
      const pers = res.data || res || [];
      setRawPeriodos(pers);
      setPeriodos([{ value: '', label: 'Todos' }, ...pers.map(p => ({ value: String(p.id), label: p.nombre }))]);
      // Default: show all comprobantes (no period filter)
      setPeriodo(null);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, []); // eslint-disable-line

  // Load comprobantes when periodo or filter changes
  const loadComprobantes = async () => {
    setLoadingData(true);
    try {
      let path = '/facturacion/comprobantes?limit=100';
      if (periodo) path = `/facturacion/comprobantes?year=${periodo.year}&month=${periodo.month}`;
      if (tipoFilter) path += `&tipo_doc=${tipoFilter}`;
      const res = await api.get(path);
      setComprobantes(res.data || res || []);
    } catch {
      toast.error('Error cargando comprobantes');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadComprobantes();
  }, [periodo, tipoFilter]); // eslint-disable-line

  // Summary
  const summary = useMemo(() => {
    let total = 0, facturas = 0, boletas = 0, rechazados = 0;
    comprobantes.forEach(c => {
      if (c.estado === 'error') { rechazados++; return; }
      if (c.estado !== 'anulado') {
        total += parseFloat(c.mto_total) || 0;
        if (c.tipo_doc === '01') facturas++;
        if (c.tipo_doc === '03') boletas++;
      }
    });
    return { total, facturas, boletas, rechazados };
  }, [comprobantes]);

  // View PDF
  const viewPdf = async (id) => {
    try {
      const res = await api.get(`/facturacion/pdf/${id}`);
      const data = res.data || res;
      if (!data.pdf) {
        toast.error('PDF no disponible');
        return;
      }
      const byteChars = atob(data.pdf);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      toast.error(err.message || 'Error obteniendo PDF');
    }
  };

  // Anular
  const handleAnular = async () => {
    if (!anularTarget) return;
    try {
      await api.post(`/facturacion/anular/${anularTarget.id}`);
      toast.success('Comprobante anulado');
      loadComprobantes();
    } catch (err) {
      toast.error(err.message || 'Error anulando');
    } finally {
      setAnularTarget(null);
    }
  };

  // Print ticket (thermal or fallback HTML)
  const handlePrint = async (comprobanteId) => {
    if (printerConfig.printer_enabled && printerConfig.printer_ip) {
      try {
        await api.post(`/print/ticket/${comprobanteId}`);
        toast.success('Ticket impreso');
      } catch (err) {
        toast.error(err.message || 'Error imprimiendo. Configura tu impresora en la sección de abajo.');
      }
    } else {
      // No thermal printer — download PDF directly
      const link = document.createElement('a');
      link.href = `${API_BASE.replace('/api','')}/api/ticket/${comprobanteId}/pdf?token=${localStorage.getItem('nodum_token')}`;
      link.download = '';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Descargando ticket PDF');
    }
  };

  // Buscar direccion fiscal desde RUC (SUNAT)
  async function buscarDireccionFiscal() {
    const ruc = user?.ruc;
    if (!ruc || ruc.length !== 11) {
      toast.error('Primero configura tu RUC en Perfil (11 dígitos)');
      return;
    }
    setBuscandoRuc(true);
    try {
      const res = await api.get(`/facturacion/buscar-ruc/${ruc}`);
      const d = res.data || res;
      if (d.direccion) {
        setConfigForm(prev => ({
          ...prev,
          direccion_fiscal: d.direccion || prev.direccion_fiscal,
          departamento: d.departamento || prev.departamento,
          provincia: d.provincia || prev.provincia,
          distrito: d.distrito || prev.distrito,
          ubigeo: d.ubigeo || prev.ubigeo,
        }));
        toast.success('Dirección encontrada');
      } else {
        toast.error('No se encontró dirección para este RUC');
      }
    } catch (err) {
      toast.error('Error buscando dirección');
    } finally {
      setBuscandoRuc(false);
    }
  }

  // Config handlers
  function startEditConfig() {
    setConfigForm({
      direccion_fiscal: config?.direccion_fiscal || '',
      departamento: config?.departamento || '',
      provincia: config?.provincia || '',
      distrito: config?.distrito || '',
      ubigeo: config?.ubigeo || '',
      sol_user: config?.sol_user || '',
      sol_pass: config?.sol_pass || '',
      correlativo_boleta: config?.correlativo_boleta || 0,
      correlativo_factura: config?.correlativo_factura || 0,
      tiene_local: config?.tiene_local !== false, // default true
      direccion_comercial: config?.direccion_comercial || '',
    });
    setEditingConfig(true);
  }

  async function handleSaveConfig() {
    setSavingConfig(true);
    try {
      await api.put('/facturacion/config', configForm);
      toast.success('Configuracion actualizada');
      setEditingConfig(false);
      loadConfig();
    } catch (err) {
      toast.error(err.message || 'Error guardando');
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleCertUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCertFile(file);
    setCertPasswordPrompt(true);
  }

  async function uploadCertWithPassword(password) {
    setCertPasswordPrompt(false);
    const file = certFile;
    setCertFile(null);
    if (!file) return;
    setUploadingCert(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result.split(',')[1];
          await api.post('/facturacion/certificado', {
            cert_base64: base64,
            cert_password: password,
          });
          toast.success('Certificado subido correctamente');
          loadConfig();
        } catch (err) {
          toast.error(err.message || 'Error subiendo certificado');
        } finally {
          setUploadingCert(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error('Error procesando archivo');
      setUploadingCert(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto pb-12 space-y-4">
        <div className={cx.skeleton + ' h-10 w-48'} />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className={cx.skeleton + ' h-24'} />)}
        </div>
        <div className={cx.skeleton + ' h-64'} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <FileText size={20} className="text-[var(--accent)]" />
          <h1 className="text-xl font-bold text-stone-900">Comprobantes</h1>
        </div>
        <div className="flex items-center gap-3">
          {rawPeriodos.length > 0 && (
            <PeriodoSelector
              periodos={rawPeriodos}
              value={periodo}
              onChange={setPeriodo}
              onCreatePeriodo={async (year, month) => {
                const MESES_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
                const inicio = `${year}-${String(month+1).padStart(2,'0')}-01`;
                const lastDay = new Date(year, month+1, 0).getDate();
                const fin = `${year}-${String(month+1).padStart(2,'0')}-${lastDay}`;
                try {
                  const res = await api.post('/pl/periodos', { nombre: `${MESES_FULL[month]} ${year}`, fecha_inicio: inicio, fecha_fin: fin });
                  const nuevo = res.data;
                  setRawPeriodos(prev => [nuevo, ...prev]);
                  setPeriodos(prev => [prev[0], { value: String(nuevo.id), label: nuevo.nombre }, ...prev.slice(1)]);
                } catch(e) { toast.error(e.message); }
              }}
            />
          )}
          <CustomSelect
            value={tipoFilter}
            onChange={setTipoFilter}
            options={TIPO_DOC_OPTIONS}
            placeholder="Tipo"
            className="w-36"
          />
        </div>
      </div>

      {/* Facturacion Setup Banner */}
      {config && !config.habilitado && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-800">Configuración de facturación electrónica</h3>
          </div>

          {/* Guide: Register as electronic issuer in SUNAT */}
          <div className="p-3 bg-white rounded-lg border border-amber-100 mb-3">
            <p className="text-xs font-bold text-stone-800 mb-2">Antes de empezar: Habilitarte en SUNAT como emisor electrónico</p>
            <p className="text-[11px] text-stone-600 mb-2">Este paso se hace una sola vez directamente en SUNAT. Sin esto, SUNAT rechazará tus comprobantes.</p>
            <div className="space-y-2">
              <div className="flex gap-2">
                <span className="text-[10px] font-bold text-[var(--accent)] shrink-0 w-4">1.</span>
                <p className="text-[11px] text-stone-600">Entra a <strong className="text-stone-800">clave.sol.gob.pe</strong> con tu RUC, usuario SOL y clave SOL</p>
              </div>
              <div className="flex gap-2">
                <span className="text-[10px] font-bold text-[var(--accent)] shrink-0 w-4">2.</span>
                <p className="text-[11px] text-stone-600">En el menú, ve a <strong className="text-stone-800">Empresas → Comprobantes de Pago Electrónicos</strong></p>
              </div>
              <div className="flex gap-2">
                <span className="text-[10px] font-bold text-[var(--accent)] shrink-0 w-4">3.</span>
                <p className="text-[11px] text-stone-600">Busca y selecciona <strong className="text-stone-800">"SEE - Desde los sistemas del contribuyente"</strong></p>
              </div>
              <div className="flex gap-2">
                <span className="text-[10px] font-bold text-[var(--accent)] shrink-0 w-4">4.</span>
                <p className="text-[11px] text-stone-600">Sube tu <strong className="text-stone-800">certificado digital (.p12)</strong> y registra un <strong className="text-stone-800">correo electrónico</strong> de contacto</p>
              </div>
              <div className="flex gap-2">
                <span className="text-[10px] font-bold text-[var(--accent)] shrink-0 w-4">5.</span>
                <p className="text-[11px] text-stone-600">Confirma la inscripción. <strong className="text-rose-600">IMPORTANTE: La habilitación se activa al día calendario siguiente.</strong> No podrás emitir el mismo día que te registras.</p>
              </div>
            </div>
          </div>

          {/* Guide: Steps in Kudi */}
          <p className="text-xs font-bold text-stone-800 mb-2">Después, configura aquí en Kudi:</p>
          <div className="space-y-2">
            {/* Step 1: RUC */}
            <div className="flex items-start gap-2">
              {config.direccion_fiscal ? <CheckCircle size={16} className="text-emerald-500 mt-0.5 shrink-0" /> : <Circle size={16} className="text-stone-300 mt-0.5 shrink-0" />}
              <div>
                <p className={`text-xs font-medium ${config.direccion_fiscal ? 'text-stone-700' : 'text-stone-400'}`}>Dirección fiscal</p>
                <p className="text-[10px] text-stone-400">Haz click en "Configurar" abajo. Puedes usar el botón "Buscar mi dirección" para auto-completar desde tu RUC.</p>
              </div>
            </div>

            {/* Step 2: SOL credentials */}
            <div className="flex items-start gap-2">
              {config.sol_user ? <CheckCircle size={16} className="text-emerald-500 mt-0.5 shrink-0" /> : <Circle size={16} className="text-stone-300 mt-0.5 shrink-0" />}
              <div>
                <p className={`text-xs font-medium ${config.sol_user ? 'text-stone-700' : 'text-stone-400'}`}>Usuario y clave SOL</p>
                <p className="text-[10px] text-stone-400">El mismo usuario y contraseña con los que entras a SUNAT. Kudi los usa para firmar y enviar tus comprobantes. Se guardan encriptados.</p>
              </div>
            </div>

            {/* Step 3: Certificate */}
            <div className="flex items-start gap-2">
              {config.certificado_subido ? <CheckCircle size={16} className="text-emerald-500 mt-0.5 shrink-0" /> : <Circle size={16} className="text-stone-300 mt-0.5 shrink-0" />}
              <div>
                <p className={`text-xs font-medium ${config.certificado_subido ? 'text-stone-700' : 'text-stone-400'}`}>Certificado digital (.p12)</p>
                <p className="text-[10px] text-stone-400">Descárgalo gratis desde SOL → Empresas → Certificado Digital Tributario (CDT). Te pedirá crear una contraseña de 8+ caracteres — anótala porque la necesitarás al subirlo aquí.</p>
              </div>
            </div>

            {/* Step 4: Auto-enabled */}
            <div className="flex items-start gap-2">
              {config.habilitado ? <CheckCircle size={16} className="text-emerald-500 mt-0.5 shrink-0" /> : <Circle size={16} className="text-stone-300 mt-0.5 shrink-0" />}
              <div>
                <p className={`text-xs font-medium ${config.habilitado ? 'text-stone-700' : 'text-stone-400'}`}>Facturación activa</p>
                <p className="text-[10px] text-stone-400">Se activa automáticamente cuando completes los 3 pasos anteriores. No necesitas hacer nada adicional.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Config card */}
      {!loadingConfig && config && (
        <div className={cx.card + ' p-4 mb-4'}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-stone-900">Configuracion de facturacion</h3>
            {!editingConfig && (
              <button onClick={() => startEditConfig()} className={cx.btnGhost + ' text-xs flex items-center gap-1'}>
                <Settings size={16} /> Configurar
              </button>
            )}
          </div>

          {editingConfig ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <button type="button" onClick={buscarDireccionFiscal} disabled={buscandoRuc}
                  className={cx.btnSecondary + ' text-xs flex items-center gap-1'}>
                  <Search size={16} /> {buscandoRuc ? 'Buscando...' : 'Buscar mi dirección (SUNAT)'}
                </button>
                <span className="text-[10px] text-stone-400">Auto-completa desde tu RUC</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={cx.label}>Direccion fiscal</label>
                  <input type="text" value={configForm.direccion_fiscal || ''} onChange={e => setConfigForm(p => ({...p, direccion_fiscal: e.target.value}))} className={cx.input} placeholder="Av. Principal 123" />
                </div>
                <div>
                  <label className={cx.label}>Departamento</label>
                  <input type="text" value={configForm.departamento || ''} onChange={e => setConfigForm(p => ({...p, departamento: e.target.value}))} className={cx.input} placeholder="Lima" />
                </div>
                <div>
                  <label className={cx.label}>Provincia</label>
                  <input type="text" value={configForm.provincia || ''} onChange={e => setConfigForm(p => ({...p, provincia: e.target.value}))} className={cx.input} placeholder="Lima" />
                </div>
                <div>
                  <label className={cx.label}>Distrito</label>
                  <input type="text" value={configForm.distrito || ''} onChange={e => setConfigForm(p => ({...p, distrito: e.target.value}))} className={cx.input} placeholder="Miraflores" />
                </div>
                <div>
                  <label className={cx.label}>Ubigeo (codigo INEI)</label>
                  <input type="text" value={configForm.ubigeo || ''} onChange={e => setConfigForm(p => ({...p, ubigeo: e.target.value}))} className={cx.input} placeholder="150122" maxLength={6} />
                </div>
              </div>

              {/* Tiene local comercial toggle */}
              <div className="p-3 bg-stone-50 rounded-lg mt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-stone-800">¿Tienes local comercial?</p>
                    <p className="text-[10px] text-stone-400 mt-0.5">Si no tienes local propio, no se mostrará dirección en tus comprobantes</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfigForm(p => ({ ...p, tiene_local: !p.tiene_local }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out focus:outline-none ${configForm.tiene_local ? 'bg-[var(--accent)]' : 'bg-stone-300'}`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-150 ease-in-out ${configForm.tiene_local ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
                {configForm.tiene_local && (
                  <div className="mt-3">
                    <label className={cx.label}>Dirección comercial (opcional, si es diferente a la fiscal)</label>
                    <input type="text" value={configForm.direccion_comercial || ''} onChange={e => setConfigForm(p => ({...p, direccion_comercial: e.target.value}))} className={cx.input} placeholder="Ej: Av. Comercio 456, Centro Comercial XYZ" />
                    <p className="text-[10px] text-stone-400 mt-1">Si la dejas vacía, se usará la dirección fiscal en tus comprobantes</p>
                  </div>
                )}
                {!configForm.tiene_local && (
                  <p className="text-[10px] text-amber-600 mt-2 font-medium">No se mostrará dirección en tus boletas, tickets ni facturas</p>
                )}
              </div>

              <div className="p-3 bg-amber-50 rounded-lg mt-2">
                <p className="text-xs text-amber-700 mb-2 font-medium">Credenciales SOL (requerido para emisión)</p>
                <p className="text-[10px] text-amber-600 mb-2">Usuario secundario SUNAT con permiso de emisión electrónica</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={cx.label}>Usuario SOL</label>
                    <input type="text" value={configForm.sol_user || ''} onChange={e => setConfigForm(p => ({...p, sol_user: e.target.value.toUpperCase()}))} className={cx.input} placeholder="USUARIO01" />
                  </div>
                  <div>
                    <label className={cx.label}>Contraseña SOL</label>
                    <input type="password" value={configForm.sol_pass || ''} onChange={e => setConfigForm(p => ({...p, sol_pass: e.target.value}))} className={cx.input} placeholder="********" />
                  </div>
                </div>
              </div>
              {solValidation && (
                <div className={`p-3 rounded-lg mt-2 text-sm ${solValidation.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {solValidation.message}
                </div>
              )}
              <div className="p-3 bg-stone-50 rounded-lg mt-2">
                <p className="text-xs text-stone-500 mb-2">Si ya emitías boletas o facturas con otro sistema, indica tu último número emitido para continuar la numeración.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={cx.label}>Último corr. boleta</label>
                    <input type="number" min="0" value={configForm.correlativo_boleta} onChange={e => setConfigForm(p => ({...p, correlativo_boleta: parseInt(e.target.value) || 0}))} className={cx.input} placeholder="0" />
                  </div>
                  <div>
                    <label className={cx.label}>Último corr. factura</label>
                    <input type="number" min="0" value={configForm.correlativo_factura} onChange={e => setConfigForm(p => ({...p, correlativo_factura: parseInt(e.target.value) || 0}))} className={cx.input} placeholder="0" />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={handleSaveConfig} disabled={savingConfig} className={cx.btnPrimary + ' text-sm'}>
                  {savingConfig ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  onClick={async () => {
                    // Save first, then validate
                    setSolValidation(null);
                    setSavingConfig(true);
                    try {
                      await api.put('/facturacion/config', configForm);
                      const res = await api.post('/facturacion/validar-sol');
                      if (res.data?.message) {
                        setSolValidation({ ok: true, message: res.data.message });
                      } else {
                        setSolValidation({ ok: false, message: res.error || 'No se pudo validar' });
                      }
                    } catch (err) {
                      setSolValidation({ ok: false, message: err.message || 'Error validando credenciales' });
                    } finally {
                      setSavingConfig(false);
                      loadConfig();
                    }
                  }}
                  disabled={savingConfig || !configForm.sol_user || !configForm.sol_pass}
                  className={cx.btnSecondary + ' text-sm flex items-center gap-1'}
                >
                  {savingConfig ? 'Validando...' : <><CheckCircle size={16} /> Validar SOL</>}
                </button>
                <button onClick={() => { setEditingConfig(false); setSolValidation(null); }} className={cx.btnGhost + ' text-sm'}>Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-stone-400">Direccion</span>
                <p className="text-stone-800 mt-0.5">{config?.direccion_fiscal || '-'}</p>
              </div>
              <div>
                <span className="text-stone-400">Distrito</span>
                <p className="text-stone-800 mt-0.5">{config?.distrito || '-'}</p>
              </div>
              <div>
                <span className="text-stone-400">Certificado</span>
                <p className={`mt-0.5 font-medium ${config?.certificado_subido ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {config?.certificado_subido ? 'Subido' : 'No subido'}
                </p>
              </div>
              <div>
                <span className="text-stone-400">Estado</span>
                <p className={`mt-0.5 font-medium ${config?.habilitado ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {config?.habilitado ? 'Habilitado' : 'No habilitado'}
                </p>
              </div>
            </div>
          )}

          {/* Certificate upload section */}
          {!config?.certificado_subido && (
            <div className="mt-3 p-3 bg-stone-50 rounded-lg">
              <p className="text-xs text-stone-600 mb-2">
                <strong>Certificado digital:</strong> Descargalo gratis desde SUNAT SOL - Empresas - Comprobantes - CDT. Sube el archivo .p12 aqui.
              </p>
              <div className="flex items-center gap-2">
                <input type="file" accept=".p12,.pfx" id="cert-upload" className="hidden" onChange={handleCertUpload} />
                <label htmlFor="cert-upload" className={cx.btnSecondary + ' text-xs cursor-pointer flex items-center gap-1'}>
                  <Upload size={16} /> Subir certificado .p12
                </label>
                {uploadingCert && <span className="text-xs text-stone-400">Subiendo...</span>}
              </div>
            </div>
          )}

          {/* Series info */}
          {config && (
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-stone-400">
              <span>Serie Factura: <strong className="text-stone-600">{config.serie_factura || 'F001'}</strong> ({config.correlativo_factura || 0})</span>
              <span>Serie Boleta: <strong className="text-stone-600">{config.serie_boleta || 'B001'}</strong> ({config.correlativo_boleta || 0})</span>
            </div>
          )}
        </div>
      )}

      {/* Printer config section */}
      {!loadingConfig && (
        <div className={cx.card + ' p-4 mb-4'}>
          <h3 className="font-bold text-stone-900 mb-3 flex items-center gap-2"><Printer size={16} /> Impresora termica</h3>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={printerConfig.printer_enabled}
                onChange={e => setPrinterConfig(p => ({...p, printer_enabled: e.target.checked}))}
                className="w-4 h-4 rounded" />
              <span className="text-sm text-stone-700">Activar impresion directa</span>
            </label>
            {printerConfig.printer_enabled && (
              <>
                <div>
                  <label className={cx.label}>IP de la impresora</label>
                  <input className={cx.input} value={printerConfig.printer_ip || ''}
                    onChange={e => setPrinterConfig(p => ({...p, printer_ip: e.target.value}))}
                    placeholder="192.168.1.100" />
                </div>
                <div>
                  <label className={cx.label}>Puerto</label>
                  <input className={cx.input} type="number" value={printerConfig.printer_port || 9100}
                    onChange={e => setPrinterConfig(p => ({...p, printer_port: parseInt(e.target.value) || 9100}))} />
                </div>
                <div className="flex gap-2">
                  <button onClick={async () => {
                    try {
                      await api.put('/print/config', printerConfig);
                      toast.success('Configuracion guardada');
                    } catch { toast.error('Error'); }
                  }} className={cx.btnPrimary + ' text-sm'}>Guardar</button>
                  <button onClick={async () => {
                    try {
                      await api.put('/print/config', printerConfig);
                      await api.post('/print/test');
                      toast.success('Prueba enviada a impresora');
                    } catch (err) { toast.error(err.message || 'No se pudo conectar'); }
                  }} className={cx.btnGhost + ' text-sm'}>Probar conexion</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        <div className={`${cx.card} p-4`}>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={20} className="text-[var(--accent)]" />
            <span className="text-xs font-semibold text-stone-500 tracking-wide uppercase">Total emitido</span>
          </div>
          <p className="text-xl font-bold text-stone-900">{formatCurrency(summary.total)}</p>
        </div>
        <div className={`${cx.card} p-4`}>
          <div className="flex items-center gap-2 mb-2">
            <FileText size={20} className="text-stone-400" />
            <span className="text-xs font-semibold text-stone-500 tracking-wide uppercase">Facturas</span>
          </div>
          <p className="text-xl font-bold text-stone-900">{summary.facturas}</p>
        </div>
        <div className={`${cx.card} p-4`}>
          <div className="flex items-center gap-2 mb-2">
            <Receipt size={20} className="text-stone-400" />
            <span className="text-xs font-semibold text-stone-500 tracking-wide uppercase">Boletas</span>
          </div>
          <p className="text-xl font-bold text-stone-900">{summary.boletas}</p>
        </div>
      </div>

      {summary.rechazados > 0 && (
        <div className="flex items-center justify-between bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 mb-5">
          <span className="text-sm text-rose-700">{summary.rechazados} comprobante{summary.rechazados > 1 ? 's' : ''} rechazado{summary.rechazados > 1 ? 's' : ''}</span>
          <button
            onClick={() => setDeleteRechazados(true)}
            className={cx.btnDanger + ' flex items-center gap-1 text-xs'}
          >
            <Trash2 size={16} /> Limpiar rechazados
          </button>
        </div>
      )}

      {/* Table */}
      {loadingData ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className={cx.skeleton + ' h-16'} />)}
        </div>
      ) : comprobantes.length === 0 ? (
        <div className={`${cx.card} p-12 text-center`}>
          <FileText size={40} className="text-stone-300 mx-auto mb-4" />
          <p className="text-stone-400 text-sm">No hay comprobantes en este periodo</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className={`${cx.card} hidden lg:block overflow-hidden`}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className={cx.th}>Serie-Correlativo</th>
                  <th className={cx.th}>Orden</th>
                  <th className={cx.th}>Tipo</th>
                  <th className={cx.th}>Producto</th>
                  <th className={cx.th}>Cliente</th>
                  <th className={cx.th + ' text-right'}>Total</th>
                  <th className={cx.th}>Estado</th>
                  <th className={cx.th}>Fecha</th>
                  <th className={cx.th + ' w-28'}></th>
                </tr>
              </thead>
              <tbody>
                {comprobantes.map((c) => (
                  <tr key={c.id} className={cx.tr}>
                    <td className={cx.td + ' font-mono text-sm font-medium text-stone-900'}>
                      {c.serie}-{c.correlativo}
                    </td>
                    <td className={cx.td}>
                      {c.nro_pedido ? (
                        <button onClick={() => openVentaDetalle(c.venta_id)}
                          className="text-xs font-mono font-semibold text-[#16A34A] hover:underline cursor-pointer">
                          {c.nro_pedido}
                        </button>
                      ) : <span className="text-stone-300 text-xs">—</span>}
                    </td>
                    <td className={cx.td + ' text-stone-600'}>{TIPO_LABELS[c.tipo_doc] || c.tipo_doc}</td>
                    <td className={cx.td + ' text-stone-600 text-xs'}>{c.producto_nombre || '-'}</td>
                    <td className={cx.td + ' text-stone-600 text-xs'}>{c.cliente_razon_social || '-'}</td>
                    <td className={cx.td + ' text-right font-semibold text-stone-900'}>{formatCurrency(c.mto_total)}</td>
                    <td className={cx.td}>
                      <span className={estadoBadge(c.estado)} title={c.estado === 'error' && c.sunat_message ? c.sunat_message : ''}>
                        {ESTADO_LABELS[c.estado] || c.estado}
                      </span>
                      {c.estado === 'error' && c.sunat_message && (
                        <p className="text-[10px] text-rose-400 mt-0.5 truncate max-w-[150px]" title={c.sunat_message}>{c.sunat_message}</p>
                      )}
                    </td>
                    <td className={cx.td + ' text-stone-500'}>{formatDate(c.fecha_emision || c.created_at)}</td>
                    <td className={cx.td}>
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => viewPdf(c.id)} className={cx.btnIcon} title="Ver PDF Lycet">
                          <Eye size={16} />
                        </button>
                        <a href={`${API_BASE.replace('/api','')}/api/ticket/${c.id}/pdf?token=${localStorage.getItem('nodum_token')}`}
                          className={cx.btnIcon} title="Descargar ticket PDF" download>
                          <FileText size={16} />
                        </a>
                        <button
                          onClick={() => handlePrint(c.id)}
                          className={cx.btnIcon}
                          title="Imprimir ticket"
                        >
                          <Printer size={16} />
                        </button>
                        {parseFloat(c.costo_envio) > 0 && (
                          <button
                            onClick={() => window.open(`${API_BASE.replace('/api','')}/api/ticket/${c.id}/delivery?token=${localStorage.getItem('nodum_token')}`, '_blank')}
                            className={cx.btnIcon}
                            title="Ticket de envío"
                          >
                            <Truck size={16} />
                          </button>
                        )}
                        {(c.estado === 'error' || c.estado === 'pendiente') && (
                          <button
                            onClick={async () => {
                              try {
                                const r = await api.post(`/facturacion/comprobantes/${c.id}/reintentar`);
                                const s = r.data?.sunat;
                                if (s?.success) { toast.success(`${c.serie}-${c.correlativo} emitido correctamente`); }
                                else { toast.error(s?.message || 'SUNAT rechazó nuevamente'); }
                                loadComprobantes();
                              } catch (err) { toast.error(err.message || 'Error reintentando'); }
                            }}
                            className={cx.btnIcon + ' hover:text-amber-600'} title={c.estado === 'pendiente' ? 'Validar con SUNAT' : 'Reintentar emisión'}
                          >
                            <RotateCcw size={16} />
                          </button>
                        )}
                        {c.estado === 'emitido' && (
                          <button onClick={() => setAnularTarget(c)} className={cx.btnIcon + ' hover:text-rose-600'} title="Anular">
                            <Ban size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-3">
            {comprobantes.map((c) => (
              <div key={c.id} className={cx.card + ' p-4'}>
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-900 font-mono">
                      {c.serie}-{c.correlativo}
                    </p>
                    <p className="text-xs text-stone-500 mt-0.5">
                      {TIPO_LABELS[c.tipo_doc] || c.tipo_doc} &middot; {formatDate(c.fecha_emision || c.created_at)}
                      {c.nro_pedido && (
                        <button onClick={() => openVentaDetalle(c.venta_id)}
                          className="ml-2 font-mono font-semibold text-[#16A34A] hover:underline">
                          {c.nro_pedido}
                        </button>
                      )}
                    </p>
                  </div>
                  <span className={estadoBadge(c.estado)}>{ESTADO_LABELS[c.estado] || c.estado}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div>
                    {c.producto_nombre && <p className="text-xs text-stone-700 font-medium">{c.producto_nombre}</p>}
                    <p className="text-xs text-stone-500 truncate">{c.cliente_razon_social || '-'}</p>
                    <p className="text-sm font-semibold text-stone-900 mt-0.5">{formatCurrency(c.mto_total)}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => viewPdf(c.id)} className={cx.btnGhost + ' text-xs flex items-center gap-1'}>
                      <Eye size={16} /> PDF
                    </button>
                    <a href={`${API_BASE.replace('/api','')}/api/ticket/${c.id}/pdf?token=${localStorage.getItem('nodum_token')}`}
                      className={cx.btnGhost + ' text-xs flex items-center gap-1'} download>
                      <FileText size={16} />
                    </a>
                    <button
                      onClick={() => handlePrint(c.id)}
                      className={cx.btnGhost + ' text-xs flex items-center gap-1'}
                      title="Imprimir ticket"
                    >
                      <Printer size={16} /> Ticket
                    </button>
                    {parseFloat(c.costo_envio) > 0 && (
                      <button
                        onClick={() => window.open(`${API_BASE.replace('/api','')}/api/ticket/${c.id}/delivery?token=${localStorage.getItem('nodum_token')}`, '_blank')}
                        className={cx.btnGhost + ' text-xs flex items-center gap-1'}
                        title="Ticket de envío"
                      >
                        <Truck size={16} /> Envío
                      </button>
                    )}
                    {(c.estado === 'error' || c.estado === 'pendiente') && (
                      <button
                        onClick={async () => {
                          try {
                            const r = await api.post(`/facturacion/comprobantes/${c.id}/reintentar`);
                            const s = r.data?.sunat;
                            if (s?.success) { toast.success(`${c.serie}-${c.correlativo} emitido correctamente`); }
                            else { toast.error(s?.message || 'SUNAT rechazó nuevamente'); }
                            loadComprobantes();
                          } catch (err) { toast.error(err.message || 'Error reintentando'); }
                        }}
                        className={cx.btnGhost + ' text-xs flex items-center gap-1 text-amber-600'}
                      >
                        <RotateCcw size={16} /> {c.estado === 'pendiente' ? 'Validar' : 'Reintentar'}
                      </button>
                    )}
                    {c.estado === 'emitido' && (
                      <button onClick={() => setAnularTarget(c)} className={cx.btnDanger + ' text-xs flex items-center gap-1'}>
                        <Ban size={16} /> Anular
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Confirm anular */}
      <ConfirmDialog
        open={!!anularTarget}
        title="Anular comprobante"
        message={`Estas seguro de anular el comprobante ${anularTarget?.serie}-${anularTarget?.correlativo}?`}
        onConfirm={handleAnular}
        onCancel={() => setAnularTarget(null)}
        confirmText="Anular"
      />

      {/* Confirm delete rechazados */}
      <ConfirmDialog
        open={deleteRechazados}
        title="Limpiar rechazados"
        message={`Se eliminaran ${summary.rechazados} comprobantes rechazados. Esta accion no se puede deshacer.`}
        confirmText="Eliminar rechazados"
        onConfirm={async () => {
          setDeleteRechazados(false);
          try {
            const res = await api.del('/facturacion/comprobantes/rechazados');
            toast.success(res.data?.message || 'Rechazados eliminados');
            loadComprobantes();
          } catch (err) { toast.error(err.message); }
        }}
        onCancel={() => setDeleteRechazados(false)}
      />

      {/* Cert password prompt */}
      <PromptDialog
        open={certPasswordPrompt}
        title="Contraseña del certificado"
        message="Ingresa la contraseña del archivo .p12 (dejalo vacio si no tiene)."
        placeholder="Contraseña"
        confirmText="Subir certificado"
        onConfirm={(pw) => uploadCertWithPassword(pw)}
        onCancel={() => { setCertPasswordPrompt(false); setCertFile(null); }}
      />
      {/* Venta detail sidebar */}
      <AnimatePresence>
      {(ventaDetalle || loadingVenta) && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setVentaDetalle(null)}
          />
          <motion.div
            className="fixed inset-0 z-[60] flex justify-end"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.15 }}
          >
          <div className="w-full sm:w-96 bg-white h-full shadow-xl flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <h3 className="font-bold text-stone-900 text-sm">Detalle de venta</h3>
              <button onClick={() => setVentaDetalle(null)} className="text-stone-400 hover:text-stone-600">
                <Ban size={16} />
              </button>
            </div>
            {loadingVenta ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
              </div>
            ) : ventaDetalle && (
              <div className="px-5 py-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold font-mono text-[#16A34A]">{ventaDetalle.nro_pedido}</span>
                  <span className="text-xs text-stone-400">{formatDate(ventaDetalle.fecha)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-stone-50 rounded-lg p-3">
                    <p className="text-[10px] text-stone-400 uppercase">Total</p>
                    <p className="font-bold text-stone-900">{formatCurrency(ventaDetalle.total)}</p>
                  </div>
                  <div className="bg-stone-50 rounded-lg p-3">
                    <p className="text-[10px] text-stone-400 uppercase">Método</p>
                    <p className="font-medium text-stone-700 capitalize">{ventaDetalle.metodo_pago || 'efectivo'}</p>
                  </div>
                </div>
                {ventaDetalle.cliente_nombre && (
                  <div className="text-sm">
                    <p className="text-[10px] text-stone-400 uppercase">Cliente</p>
                    <p className="text-stone-700">{ventaDetalle.cliente_nombre}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Items</p>
                  <div className="space-y-1.5">
                    {(ventaDetalle.items || []).map((item, i) => (
                      <div key={i} className="flex justify-between items-center bg-stone-50 rounded-lg px-3 py-2">
                        <div>
                          <p className="text-sm text-stone-800">{item.producto_nombre || item.nombre || 'Producto'}</p>
                          <p className="text-[10px] text-stone-400">{item.cantidad} x {formatCurrency(item.precio_unitario)}</p>
                        </div>
                        <span className="text-sm font-semibold text-stone-900">{formatCurrency(item.subtotal || (item.cantidad * item.precio_unitario))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          </motion.div>
        </>
      )}
      </AnimatePresence>
    </div>
  );
}
