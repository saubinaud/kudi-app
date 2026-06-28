import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { cx } from '../styles/tokens';
import { formatCurrency } from '../utils/format';
import CustomSelect from '../components/CustomSelect';
import InfoTip from '../components/InfoTip';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  Calculator, Snowflake, RotateCcw, Users, Cog, ArrowLeft,
  Lock, Pencil, Save, X, Loader2, Info,
} from 'lucide-react';

const sym = () => (typeof localStorage !== 'undefined' && localStorage.getItem('nodum_moneda_simbolo')) || 'S/';

function fmtNum(n, d = 2) {
  if (n == null || isNaN(n)) return '0';
  return Number(n).toLocaleString('es-PE', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtMoney(n) {
  return formatCurrency(n);
}

function fmtTasa(n) {
  // tasa por hora: 4 decimales para no perder precisión
  if (n == null || isNaN(n)) return `${sym()} 0.0000`;
  return `${sym()} ${Number(n).toFixed(4)}`;
}

function fmtFechaLima(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('es-PE', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima',
    });
  } catch { return ''; }
}

export default function TasasPeriodoPage() {
  const { user } = useAuth();
  const api = useApi();
  const toast = useToast();
  const navigate = useNavigate();

  const [periodos, setPeriodos] = useState([]);
  const [loadingPeriodos, setLoadingPeriodos] = useState(true);
  const [periodoId, setPeriodoId] = useState(null);

  const [calc, setCalc] = useState(null);        // resultado /tasas/calcular (sin guardar)
  const [frozen, setFrozen] = useState(null);     // resultado /tasas/:periodo_id (congelado)
  const [calculating, setCalculating] = useState(false);
  const [loadingFrozen, setLoadingFrozen] = useState(false);

  // override al congelar
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [ovMo, setOvMo] = useState('');
  const [ovMaq, setOvMaq] = useState('');
  const [notas, setNotas] = useState('');
  const [freezing, setFreezing] = useState(false);
  const [confirmFreeze, setConfirmFreeze] = useState(false);

  // Cargar periodos
  useEffect(() => {
    api.get('/pl/periodos').then((res) => {
      const pers = res.data || res || [];
      setPeriodos(pers);
      if (pers.length > 0) setPeriodoId(pers[0].id);
    }).catch(() => toast.error('Error cargando períodos'))
      .finally(() => setLoadingPeriodos(false));
  }, []); // eslint-disable-line

  const periodoOptions = useMemo(
    () => periodos.map((p) => ({ value: p.id, label: p.nombre || `Período #${p.id}` })),
    [periodos]
  );

  const periodoActual = useMemo(
    () => periodos.find((p) => p.id === periodoId) || null,
    [periodos, periodoId]
  );

  // Cargar tasa congelada del período seleccionado
  const loadFrozen = useCallback(async (pid) => {
    if (!pid) return;
    setLoadingFrozen(true);
    setFrozen(null);
    setCalc(null);
    try {
      const res = await api.get(`/tasas/${pid}`);
      const data = res?.data ?? res;
      // backend devuelve null/objeto vacío si no hay congelada
      if (data && (data.id || data.tasa_mo_hora != null)) setFrozen(data);
      else setFrozen(null);
    } catch {
      // 404 = aún no congelada, no es error de usuario
      setFrozen(null);
    } finally {
      setLoadingFrozen(false);
    }
  }, [api]);

  useEffect(() => {
    if (periodoId) loadFrozen(periodoId);
  }, [periodoId]); // eslint-disable-line react-hooks/exhaustive-deps — loadFrozen depende de `api` (objeto nuevo por render); incluirlo causa bucle infinito

  const handleCalcular = async () => {
    if (!periodoId) { toast.error('Selecciona un período'); return; }
    setCalculating(true);
    try {
      const res = await api.post('/tasas/calcular', { periodo_id: periodoId });
      const data = res?.data ?? res;
      setCalc(data);
      // precargar overrides con los calculados
      setOvMo(data?.tasa_mo_hora != null ? String(Number(data.tasa_mo_hora).toFixed(4)) : '');
      setOvMaq(data?.tasa_maquina_hora != null ? String(Number(data.tasa_maquina_hora).toFixed(4)) : '');
      toast.success('Tasas recalculadas');
    } catch (err) {
      toast.error(err.message || 'Error al recalcular');
    } finally {
      setCalculating(false);
    }
  };

  const doFreeze = async () => {
    setConfirmFreeze(false);
    setFreezing(true);
    try {
      const body = { periodo_id: periodoId };
      // Solo enviar override si el usuario lo activó y difiere del calculado
      if (overrideOpen) {
        const moNum = ovMo !== '' ? Number(ovMo) : null;
        const maqNum = ovMaq !== '' ? Number(ovMaq) : null;
        if (moNum != null) body.tasa_mo_hora_override = moNum;
        if (maqNum != null) body.tasa_maquina_hora_override = maqNum;
      }
      if (notas.trim()) body.notas = notas.trim();
      const res = await api.post('/tasas/congelar', body);
      const data = res?.data ?? res;
      setFrozen(data && (data.id || data.tasa_mo_hora != null) ? data : null);
      setCalc(null);
      setOverrideOpen(false);
      setNotas('');
      await loadFrozen(periodoId);
      toast.success('Tasas congeladas para el período');
    } catch (err) {
      toast.error(err.message || 'Error al congelar');
    } finally {
      setFreezing(false);
    }
  };

  // ¿el override difiere de lo calculado?
  const overrideDiffers = useMemo(() => {
    if (!calc) return false;
    const moC = calc.tasa_mo_hora != null ? Number(Number(calc.tasa_mo_hora).toFixed(4)) : null;
    const maqC = calc.tasa_maquina_hora != null ? Number(Number(calc.tasa_maquina_hora).toFixed(4)) : null;
    const moO = ovMo !== '' ? Number(ovMo) : null;
    const maqO = ovMaq !== '' ? Number(ovMaq) : null;
    return moO !== moC || maqO !== maqC;
  }, [calc, ovMo, ovMaq]);

  const estaCerrado = periodoActual?.estado === 'cerrado';

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/pl')} className={cx.btnIcon} title="Volver a P&L">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-stone-900">Tasas del período</h2>
          <p className="text-stone-500 text-sm">
            Tasa de mano de obra y de hora-máquina (modelo de costeo por absorción)
          </p>
        </div>
      </div>

      {/* Banner explicativo */}
      <div className="mb-5 flex items-start gap-2 rounded-xl bg-[var(--accent-light)] border border-emerald-100 px-4 py-3">
        <Info size={16} className="text-[var(--accent)] mt-0.5 flex-shrink-0" />
        <p className="text-[12px] text-stone-600 leading-relaxed">
          <b>¿Para qué sirve?</b> Reparte tus gastos de <b>planilla</b> (mano de obra) y de
          <b> servicios/máquina</b> (CIF) entre las horas que produces al mes. Así obtienes un costo
          <b> por hora</b> de trabajo y de máquina, que luego se suma al costo de cada producto según
          el tiempo que toma hacerlo.
          <br /><br />
          Se calculan con los gastos del mes y tu capacidad teórica. Al <b>congelar</b> quedan fijas
          para ese período. <b>Todavía no se aplican</b> al costo de tus productos — por ahora es solo
          la configuración del modelo.
        </p>
      </div>

      {/* Selector de período */}
      <div className={cx.card + ' p-5 mb-4'}>
        <label className={cx.label}>Período</label>
        {loadingPeriodos ? (
          <div className={cx.skeleton + ' h-11'} />
        ) : periodoOptions.length === 0 ? (
          <p className="text-sm text-stone-400 py-2">
            No hay períodos. Crea uno registrando gastos o ventas en P&L.
          </p>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <CustomSelect
                value={periodoId}
                onChange={(v) => setPeriodoId(v)}
                options={periodoOptions}
                placeholder="Selecciona un período"
              />
            </div>
            <button
              onClick={handleCalcular}
              disabled={calculating || !periodoId}
              className={cx.btnSecondary + ' flex items-center justify-center gap-2 min-h-[44px]'}
            >
              {calculating
                ? <Loader2 size={16} className="animate-spin" />
                : <RotateCcw size={16} />}
              Recalcular tasas del período
            </button>
          </div>
        )}
        {periodoActual && (
          <p className="text-[11px] text-stone-400 mt-2">
            {estaCerrado
              ? 'Este período está cerrado.'
              : 'Período abierto: los gastos aún pueden cambiar hasta que lo cierres.'}
          </p>
        )}
      </div>

      {/* Tasa congelada (si existe) */}
      {loadingFrozen ? (
        <div className={cx.skeleton + ' h-40 mb-4'} />
      ) : frozen ? (
        <FrozenCard frozen={frozen} />
      ) : (
        <div className={cx.card + ' p-5 mb-4 border-dashed'}>
          <div className="flex items-center gap-2 text-stone-500">
            <Snowflake size={16} className="text-stone-400" />
            <p className="text-sm">
              Este período <b>no tiene tasas congeladas</b> todavía. Recalcula y congela para fijarlas.
            </p>
          </div>
        </div>
      )}

      {/* Resultado del cálculo (sin guardar) */}
      {calc && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className={cx.card + ' p-5 mb-4'}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
                <Calculator size={18} className="text-[var(--accent)]" />
                Tasas calculadas
              </h3>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                Sin congelar
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Tasa MO */}
              <TasaCard
                icon={Users}
                titulo="Tasa mano de obra / hora"
                tasa={calc.tasa_mo_hora}
                numeradorLabel={calc.mo_fuente === 'planilla'
                  ? 'Σ sueldos de producción (planilla)'
                  : 'Σ gastos operativo_mo (legacy)'}
                numerador={calc.sueldos_operativos}
                denomLabel="Horas-hombre del mes"
                denom={calc.horas_hombre_mes}
                tipMo
              />
              {/* Tasa máquina */}
              <TasaCard
                icon={Cog}
                titulo="Tasa hora-máquina"
                tasa={calc.tasa_maquina_hora}
                numeradorLabel="Σ CIF del mes"
                numerador={calc.cif_total}
                denomLabel="Horas-máquina del mes"
                denom={calc.horas_maquina_mes}
              />
            </div>

            {/* Breakdown de gastos por naturaleza */}
            <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
              <div className="rounded-lg bg-stone-50 px-3 py-2">
                <p className="text-stone-400 font-semibold uppercase text-[10px] tracking-wide">
                  {calc.mo_fuente === 'planilla' ? 'Sueldos producción (planilla)' : 'Gastos operativo_mo'}
                </p>
                <p className="text-stone-800 font-medium">{fmtMoney(calc.sueldos_operativos)}</p>
                {calc.mo_fuente === 'planilla' && (
                  <p className="text-stone-400 text-[10px] mt-0.5">
                    {calc.planilla?.n_produccion ?? 0} en planilla · fuente: Equipo
                  </p>
                )}
              </div>
              <div className="rounded-lg bg-stone-50 px-3 py-2">
                <p className="text-stone-400 font-semibold uppercase text-[10px] tracking-wide">
                  Gastos cif
                </p>
                <p className="text-stone-800 font-medium">{fmtMoney(calc.breakdown?.gastos_cif ?? calc.cif_total)}</p>
              </div>
            </div>

            {/* Override */}
            <div className="mt-5 border-t border-stone-100 pt-4">
              <button
                onClick={() => setOverrideOpen((o) => !o)}
                className="flex items-center gap-2 text-sm font-medium text-stone-600 hover:text-stone-800 min-h-[44px]"
              >
                <Pencil size={14} />
                {overrideOpen ? 'Ocultar ajuste manual' : 'Ajustar manualmente las tasas (opcional)'}
              </button>

              {overrideOpen && (
                <div className="mt-3 space-y-3">
                  <p className="text-[11px] text-stone-400 leading-relaxed">
                    Si editas un valor, se guardará tu cifra en lugar de la calculada y el período
                    quedará marcado como <b>override manual</b>. Deja los valores tal cual para congelar lo calculado.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={cx.label}>Tasa MO / hora ({sym()})</label>
                      <input
                        type="number" step="0.0001" min="0"
                        value={ovMo}
                        onChange={(e) => setOvMo(e.target.value)}
                        className={cx.input}
                      />
                    </div>
                    <div>
                      <label className={cx.label}>Tasa hora-máquina ({sym()})</label>
                      <input
                        type="number" step="0.0001" min="0"
                        value={ovMaq}
                        onChange={(e) => setOvMaq(e.target.value)}
                        className={cx.input}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={cx.label}>Notas (auditoría)</label>
                    <input
                      type="text"
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      placeholder="Ej: ajuste por horas extra de junio"
                      className={cx.input}
                    />
                  </div>
                  {overrideDiffers && (
                    <p className="text-[11px] text-amber-600 font-medium">
                      Se guardará con override manual (los valores difieren de los calculados).
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Congelar */}
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={() => setConfirmFreeze(true)}
                disabled={freezing || estaCerrado}
                className={cx.btnPrimary + ' flex items-center gap-2 min-h-[44px]'}
              >
                {freezing ? <Loader2 size={16} className="animate-spin" /> : <Snowflake size={16} />}
                {frozen ? 'Recongelar tasas' : 'Congelar tasas del período'}
              </button>
              <button
                onClick={() => { setCalc(null); setOverrideOpen(false); }}
                className={cx.btnSecondary + ' flex items-center gap-2 min-h-[44px]'}
              >
                <X size={16} /> Descartar
              </button>
            </div>
            {estaCerrado && (
              <p className="text-[11px] text-stone-400 mt-2">
                No puedes congelar: el período está cerrado.
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* Aviso capacidad faltante */}
      {(!user?.operarios_count || !user?.jornada_horas_dia || !user?.dias_laborables_mes) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-700 leading-relaxed">
          Para que la tasa de mano de obra sea correcta, configura tu <b>capacidad</b> (operarios,
          jornada y días laborables) en{' '}
          <button onClick={() => navigate('/perfil')} className="underline font-semibold">
            Perfil → Ajustes
          </button>.
        </div>
      )}

      <ConfirmDialog
        open={confirmFreeze}
        title={frozen ? 'Recongelar tasas' : 'Congelar tasas del período'}
        message={
          overrideOpen && overrideDiffers
            ? 'Vas a guardar tasas con un ajuste MANUAL. Quedarán fijas para este período hasta que las recongeles. ¿Continuar?'
            : 'Las tasas calculadas quedarán fijas para este período. Podrás recongelarlas si los gastos cambian. ¿Continuar?'
        }
        confirmText="Congelar"
        confirmStyle="primary"
        onConfirm={doFreeze}
        onCancel={() => setConfirmFreeze(false)}
      />
    </div>
  );
}

// ── Card de tasa calculada con insumos ──
function TasaCard({ icon: Icon, titulo, tasa, numeradorLabel, numerador, denomLabel, denom, tipMo }) {
  return (
    <div className="rounded-xl border border-stone-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className="text-stone-400" />
        <p className="text-[12px] font-semibold text-stone-600">{titulo}</p>
        {tipMo && (
          <InfoTip
            wide
            text="Mano de obra = costo laboral total (sueldos + AFP/EsSalud + beneficios) de las categorías marcadas como 'operativo_mo'. Se reparte sobre las horas-hombre teóricas del mes."
          />
        )}
      </div>
      <p className="text-2xl font-bold text-stone-900 tabular-nums">{fmtTasa(tasa)}</p>
      <p className="text-[11px] text-stone-400 mt-0.5">por hora</p>

      <div className="mt-3 space-y-1.5 text-[11px] border-t border-stone-100 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-stone-400">{numeradorLabel}</span>
          <span className="text-stone-700 font-medium tabular-nums">{fmtMoney(numerador)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-stone-400">{denomLabel}</span>
          <span className="text-stone-700 font-medium tabular-nums">{fmtNum(denom)} h</span>
        </div>
        <div className="flex items-center justify-between text-stone-300">
          <span>=</span>
          <span className="tabular-nums">
            {fmtMoney(numerador)} ÷ {fmtNum(denom)} h
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Card de tasa congelada ──
function FrozenCard({ frozen }) {
  const esManual = !!frozen.manual_override;
  return (
    <div className="rounded-xl border border-emerald-200 bg-[var(--accent-light)] p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
          <Lock size={16} className="text-[var(--accent)]" />
          Tasas congeladas
        </h3>
        {esManual && (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
            Override manual
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-lg bg-white/70 border border-emerald-100 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Users size={14} className="text-stone-400" />
            <p className="text-[11px] font-semibold text-stone-500">Tasa MO / hora</p>
          </div>
          <p className="text-xl font-bold text-stone-900 tabular-nums">{fmtTasa(frozen.tasa_mo_hora)}</p>
          <p className="text-[10px] text-stone-400 mt-1 tabular-nums">
            {fmtMoney(frozen.sueldos_operativos)} ÷ {fmtNum(frozen.horas_hombre_mes)} h
          </p>
        </div>
        <div className="rounded-lg bg-white/70 border border-emerald-100 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Cog size={14} className="text-stone-400" />
            <p className="text-[11px] font-semibold text-stone-500">Tasa hora-máquina</p>
          </div>
          <p className="text-xl font-bold text-stone-900 tabular-nums">{fmtTasa(frozen.tasa_maquina_hora)}</p>
          <p className="text-[10px] text-stone-400 mt-1 tabular-nums">
            {fmtMoney(frozen.cif_total)} ÷ {fmtNum(frozen.horas_maquina_mes)} h
          </p>
        </div>
      </div>

      {frozen.notas && (
        <p className="text-[12px] text-stone-600 mt-3 italic">“{frozen.notas}”</p>
      )}
      {frozen.congelada_at && (
        <p className="text-[10px] text-stone-400 mt-3">
          Congelada el {fmtFechaLima(frozen.congelada_at)}
        </p>
      )}
    </div>
  );
}
