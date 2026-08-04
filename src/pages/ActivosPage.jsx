import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { cx } from '../styles/tokens';
import { formatCurrency, formatDate } from '../utils/format';
import CustomSelect from '../components/CustomSelect';
import ConfirmDialog from '../components/ConfirmDialog';
import InfoTip from '../components/InfoTip';
import SegmentedControl from '../components/SegmentedControl';
import { Plus, X, Trash2, Pencil, Factory, Briefcase, Truck, Cog, Loader2, Check } from 'lucide-react';
import { sugerirVidaUtil } from '../utils/vidaUtilSunat';

const TIPOS = [
  { value: 'produccion', label: 'Producción', sub: 'Depreciación → CIF (costo de conversión)', icon: Factory },
  { value: 'administrativo', label: 'Administrativo', sub: 'Depreciación → línea D&A (entre EBITDA y EBIT)', icon: Briefcase },
  { value: 'ventas', label: 'Ventas / Reparto', sub: 'Depreciación → gastos de operación', icon: Truck },
];
const TIPO_OPTIONS = TIPOS.map((t) => ({ value: t.value, label: t.label }));
const tipoMeta = (v) => TIPOS.find((t) => t.value === v) || TIPOS[1];

const EMPTY = { nombre: '', tipo: 'administrativo', monto_total: '', valor_residual: '0', vida_util_meses: '60', fecha_compra: '' };

export default function ActivosPage() {
  const api = useApi();
  const toast = useToast();
  const [activos, setActivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  // Auto-sugerencia de vida útil (SUNAT). vidaTocada = el usuario la editó a mano → no pisar.
  const [vidaTocada, setVidaTocada] = useState(false);
  const [sugVida, setSugVida] = useState(null);
  const [tab, setTab] = useState('bienes');

  const load = async () => {
    setLoading(true);
    try {
      // Solo bienes: las máquinas se gestionan en su propia pestaña (es_maquina=true).
      const res = await api.get('/activos?es_maquina=false');
      setActivos(res.data || []);
    } catch {
      toast.error('Error cargando activos');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const totales = useMemo(() => {
    const vig = activos.filter((a) => a.activo);
    return {
      capex: vig.reduce((s, a) => s + Number(a.monto_total || 0), 0),
      deprecMes: vig.reduce((s, a) => s + Number(a.depreciacion_mensual || 0), 0),
      count: vig.length,
    };
  }, [activos]);

  const openNew = () => { setEditing(null); setForm(EMPTY); setVidaTocada(false); setSugVida(null); setShowModal(true); };
  const openEdit = (a) => {
    setEditing(a);
    setForm({
      nombre: a.nombre, tipo: a.tipo,
      monto_total: String(a.monto_total), valor_residual: String(a.valor_residual),
      vida_util_meses: String(a.vida_util_meses),
      fecha_compra: a.fecha_compra ? String(a.fecha_compra).slice(0, 10) : '',
    });
    setVidaTocada(true); // ya tiene un valor guardado: no auto-sugerir encima
    setSugVida(null);
    setShowModal(true);
  };

  // Al escribir el nombre, sugerir la vida útil SUNAT (sin pisar si el usuario ya la editó).
  const onNombreChange = (nombre) => {
    const sug = sugerirVidaUtil(nombre);
    setSugVida(sug);
    setForm((f) => ({ ...f, nombre, ...(vidaTocada || !sug ? {} : { vida_util_meses: String(sug.meses) }) }));
  };

  const save = async () => {
    if (!form.nombre.trim()) return toast.error('Falta el nombre');
    const monto = parseFloat(form.monto_total);
    if (!Number.isFinite(monto) || monto <= 0) return toast.error('Monto inválido');
    const residual = parseFloat(form.valor_residual) || 0;
    if (residual < 0 || residual >= monto) return toast.error('El valor residual debe ser menor al monto');
    const vida = parseInt(form.vida_util_meses, 10);
    if (!Number.isInteger(vida) || vida <= 0) return toast.error('Vida útil inválida');
    setSaving(true);
    try {
      const payload = { nombre: form.nombre.trim(), tipo: form.tipo, monto_total: monto, valor_residual: residual, vida_util_meses: vida, fecha_compra: form.fecha_compra || undefined };
      if (editing) await api.put(`/activos/${editing.id}`, payload);
      else await api.post('/activos', payload);
      toast.success(editing ? 'Activo actualizado' : 'Activo registrado');
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
      await api.del(`/activos/${deleteTarget.id}`);
      toast.success('Activo dado de baja');
      setDeleteTarget(null);
      load();
    } catch {
      toast.error('No se pudo dar de baja');
    }
  };

  const deprecMensual = useMemo(() => {
    const m = parseFloat(form.monto_total) || 0;
    const r = parseFloat(form.valor_residual) || 0;
    const v = parseInt(form.vida_util_meses, 10) || 0;
    return v > 0 && m > r ? Math.round(((m - r) / v) * 100) / 100 : 0;
  }, [form]);

  return (
    <div className="max-w-5xl mx-auto lg:px-10 lg:py-6 px-4 py-4">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-stone-800 flex items-center gap-2">
          Activos
          <InfoTip wide text="Tus bienes duraderos (hornos, equipos, vehículos). El monto total impacta tu flujo de caja al comprarlo, pero en el Estado de Resultados solo entra la depreciación mes a mes según su vida útil. El tipo decide en qué línea del P&L cae." />
        </h1>
        {tab === 'bienes' && (
          <button onClick={openNew} className={cx.btnPrimary + ' px-4 py-2 text-sm flex items-center gap-1.5 min-h-[44px]'}>
            <Plus size={16} /> Nuevo activo
          </button>
        )}
      </div>

      {/* Pestañas: Bienes / Máquinas */}
      <div className="mb-6 overflow-x-auto pb-1">
        <SegmentedControl
          options={[{ key: 'bienes', label: 'Bienes', icon: Briefcase }, { key: 'maquinas', label: 'Máquinas', icon: Cog }]}
          value={tab}
          onChange={setTab}
          layoutId="activos-tab"
          size="sm"
        />
      </div>

      {tab === 'bienes' && (
      <>
      {/* Totales */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Stat label="Activos vigentes" value={totales.count} />
        <Stat label="CAPEX invertido" value={formatCurrency(totales.capex)} />
        <Stat label="Depreciación / mes" value={formatCurrency(totales.deprecMes)} tip="El desgaste de tus equipos repartido mes a mes durante su vida útil." />
      </div>

      {/* Lista */}
      {loading ? (
        <div className={cx.skeleton + ' h-64'} />
      ) : activos.length === 0 ? (
        <div className="text-center py-16 text-stone-400 text-sm">Aún no registraste activos. Empieza con tu equipo más caro.</div>
      ) : (
        <div className={cx.card + ' divide-y divide-stone-100'}>
          {activos.map((a, i) => {
            const meta = tipoMeta(a.tipo);
            const Icon = meta.icon;
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`flex items-center gap-3 px-4 py-3 ${!a.activo ? 'opacity-50' : ''}`}
              >
                <div className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center text-stone-500 shrink-0">
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-stone-800 truncate">{a.nombre}</div>
                  <div className="text-[12px] text-stone-400">{meta.label} · vida {a.vida_util_meses} m · compra {formatDate(a.fecha_compra)}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold text-stone-900 tabular-nums">{formatCurrency(a.monto_total)}</div>
                  <div className="text-[12px] text-stone-400 tabular-nums">{formatCurrency(a.depreciacion_mensual)}/mes</div>
                </div>
                {a.activo && (
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    <button onClick={() => openEdit(a)} className={cx.btnIcon} aria-label="Editar"><Pencil size={16} /></button>
                    <button onClick={() => setDeleteTarget(a)} className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" aria-label="Baja"><Trash2 size={16} /></button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
      </>
      )}

      {tab === 'maquinas' && <MaquinasConfig api={api} toast={toast} />}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && setShowModal(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.18 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-stone-800">{editing ? 'Editar activo' : 'Nuevo activo'}</h2>
              <button onClick={() => setShowModal(false)} className={cx.btnIcon}><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={cx.label}>Nombre</label>
                <input className={cx.input + ' w-full min-h-[44px]'} value={form.nombre} onChange={(e) => onNombreChange(e.target.value)} placeholder="Ej. Horno industrial" />
              </div>
              <div>
                <label className={cx.label}>Tipo</label>
                <CustomSelect value={form.tipo} onChange={(v) => setForm((f) => ({ ...f, tipo: v }))} options={TIPO_OPTIONS} />
                <p className="text-[12px] text-stone-400 mt-1">{tipoMeta(form.tipo).sub}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={cx.label}>Monto total (CAPEX)</label>
                  <input type="number" step="0.01" className={cx.input + ' w-full min-h-[44px]'} value={form.monto_total} onChange={(e) => setForm((f) => ({ ...f, monto_total: e.target.value }))} placeholder="0.00" />
                </div>
                <div>
                  <label className={cx.label}>Valor residual</label>
                  <input type="number" step="0.01" className={cx.input + ' w-full min-h-[44px]'} value={form.valor_residual} onChange={(e) => setForm((f) => ({ ...f, valor_residual: e.target.value }))} placeholder="0.00" />
                </div>
                <div>
                  <label className={cx.label}>Vida útil (meses)</label>
                  <input type="number" step="1" className={cx.input + ' w-full min-h-[44px]'} value={form.vida_util_meses} onChange={(e) => { setVidaTocada(true); setForm((f) => ({ ...f, vida_util_meses: e.target.value })); }} placeholder="60" />
                  {sugVida && (
                    <p className="text-[11px] text-stone-400 mt-1 leading-snug">
                      SUNAT sugiere <span className="font-medium text-stone-600">{sugVida.meses} m</span> · {sugVida.label} ({sugVida.tasa})
                      {String(sugVida.meses) !== String(form.vida_util_meses) && (
                        <button type="button" onClick={() => { setForm((f) => ({ ...f, vida_util_meses: String(sugVida.meses) })); setVidaTocada(false); }} className="ml-1 text-[var(--accent)] hover:underline">usar</button>
                      )}
                    </p>
                  )}
                </div>
                <div>
                  <label className={cx.label}>Fecha de compra</label>
                  <input type="date" className={cx.input + ' w-full min-h-[44px]'} value={form.fecha_compra} onChange={(e) => setForm((f) => ({ ...f, fecha_compra: e.target.value }))} />
                </div>
              </div>
              <div className="rounded-lg bg-stone-50 px-3 py-2.5 flex items-center justify-between">
                <span className="text-[12px] text-stone-500">Depreciación mensual (lineal)</span>
                <span className="text-sm font-semibold text-stone-800 tabular-nums">{formatCurrency(deprecMensual)}</span>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setShowModal(false)} className={cx.btnSecondary + ' px-4 py-2 text-sm'}>Cancelar</button>
              <button onClick={save} disabled={saving} className={cx.btnPrimary + ' px-5 py-2 text-sm disabled:opacity-50'}>{saving ? 'Guardando…' : (editing ? 'Guardar' : 'Registrar')}</button>
            </div>
          </motion.div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Dar de baja"
        message={`¿Dar de baja "${deleteTarget?.nombre}"? Dejará de depreciar; no se borra el histórico.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function Stat({ label, value, tip }) {
  return (
    <div className={cx.card + ' px-4 py-3'}>
      <div className="text-[11px] uppercase tracking-wider text-stone-400 font-semibold">{label}{tip && <InfoTip wide text={tip} />}</div>
      <div className="text-lg font-semibold text-stone-800 tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

// ── Máquinas (activo de producción: capacidad hora-máquina + consumo kW) ──
function MaquinasConfig({ api, toast }) {
  const [maquinas, setMaquinas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ nombre: '', horas_disponibles_mes: 160, consumo_kw: '' });
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
        horas_disponibles_mes: form.horas_disponibles_mes !== '' ? Number(form.horas_disponibles_mes) : 160,
        consumo_kw: Number(form.consumo_kw) || 0,
      });
      setMaquinas(prev => [...prev, r?.data || r]);
      setForm({ nombre: '', horas_disponibles_mes: 160, consumo_kw: '' });
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
    setEditForm({ nombre: m.nombre, horas_disponibles_mes: cleanHoras(m.horas_disponibles_mes ?? 160), consumo_kw: cleanHoras(m.consumo_kw ?? '') });
  };

  const handleSaveEdit = async (id) => {
    if (!editForm.nombre.trim()) { toast.error('Ponle un nombre a la máquina'); return; }
    setSavingEdit(true);
    try {
      const r = await api.put(`/maquinas/${id}`, {
        nombre: editForm.nombre.trim(),
        horas_disponibles_mes: editForm.horas_disponibles_mes !== '' ? Number(editForm.horas_disponibles_mes) : 160,
        consumo_kw: Number(editForm.consumo_kw) || 0,
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
      toast.success('Máquina dada de baja');
    } catch (err) { toast.error(err.message || 'Error eliminando'); }
  };

  if (loading) return <div className={cx.skeleton + ' h-48 rounded-xl'} />;

  return (
    <div className={cx.card + ' p-5'}>
      <div className="flex items-center gap-2 mb-1">
        <Cog size={18} className="text-stone-400" />
        <h3 className="text-lg font-semibold text-stone-900">Máquinas</h3>
      </div>
      <p className="text-xs text-stone-400 mb-4 leading-relaxed">
        Una máquina es un activo de producción con capacidad (horas disponibles al mes) y consumo de energía (kW).
        Sus horas reparten los <b>costos indirectos de fabricación (CIF)</b> por hora y alimentan la tasa hora-máquina en P&amp;L (Tasas del período).
        Su costo y depreciación se pueden completar como en cualquier activo.
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
                    <label className={cx.label}>Consumo (kW)</label>
                    <input type="number" step="0.1" min="0" inputMode="decimal" value={editForm.consumo_kw} onChange={e => setEditForm({ ...editForm, consumo_kw: e.target.value })} className={cx.input + ' text-sm'} placeholder="Ej: 2" />
                    <p className="text-[11px] text-stone-400 mt-1">Sirve para calcular el costo de luz de los productos que usan esta máquina.</p>
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
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm text-stone-600 tabular-nums">{Number(m.horas_disponibles_mes || 0).toLocaleString('es-PE', { maximumFractionDigits: 2 })} h/mes</span>
                    {Number(m.consumo_kw) > 0 && <span className="text-sm text-stone-500 tabular-nums">{Number(m.consumo_kw).toLocaleString('es-PE', { maximumFractionDigits: 2 })} kW</span>}
                    <button onClick={() => startEdit(m)} className={cx.btnIcon} title="Editar"><Pencil size={15} /></button>
                    <button onClick={() => setDelTarget(m)} className="p-2 text-stone-300 hover:text-rose-500 rounded-lg transition-colors" title="Dar de baja"><Trash2 size={15} /></button>
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
          <label className={cx.label}>Consumo (kW)</label>
          <input type="number" step="0.1" min="0" inputMode="decimal" value={form.consumo_kw} onChange={e => setForm({ ...form, consumo_kw: e.target.value })} className={cx.input + ' text-sm'} placeholder="Ej: 2" />
          <p className="text-[11px] text-stone-400 mt-1">Sirve para calcular el costo de luz de los productos que usan esta máquina.</p>
        </div>
        <button onClick={handleCreate} disabled={creating || !form.nombre.trim()} className={cx.btnPrimary + ' flex items-center gap-2 min-h-[44px]'}>
          {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Agregar máquina
        </button>
      </div>

      <ConfirmDialog
        open={!!delTarget}
        title="Dar de baja máquina"
        message={delTarget ? `¿Dar de baja "${delTarget.nombre}"? Sus horas dejarán de contar para la tasa hora-máquina.` : ''}
        confirmText="Dar de baja"
        confirmStyle="danger"
        onConfirm={handleDelete}
        onCancel={() => setDelTarget(null)}
      />
    </div>
  );
}
