import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { cx } from '../styles/tokens';
import { formatCurrency } from '../utils/format';
import { ShoppingCart, Settings, Plus, Trash2, X, Clock, Users } from 'lucide-react';

function formatTimer(abiertaAt) {
  if (!abiertaAt) return '';
  const diff = Math.floor((Date.now() - new Date(abiertaAt).getTime()) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m`;
}

export default function MesasPage() {
  const api = useApi();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [pisos, setPisos] = useState([]);
  const [mesas, setMesas] = useState([]);
  const [selectedPiso, setSelectedPiso] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [abriendo, setAbriendo] = useState(null);

  // Timer refresh
  const [, setTick] = useState(0);

  const fetchEstado = useCallback(async () => {
    try {
      const res = await api.get('/mesas/estado');
      const data = res?.data || res;
      setPisos(data.pisos || []);
      setMesas(data.mesas || []);
      if (!selectedPiso && data.pisos?.length > 0) {
        setSelectedPiso(data.pisos[0].id);
      }
    } catch (err) {
      console.error('Fetch mesas estado:', err);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    fetchEstado();
    const interval = setInterval(fetchEstado, 10000);
    return () => clearInterval(interval);
  }, [fetchEstado]);

  // Update timers every 30s
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const mesasFiltradas = useMemo(() =>
    selectedPiso ? mesas.filter(m => m.piso_id === selectedPiso) : mesas,
    [mesas, selectedPiso]
  );

  const handleMesaClick = async (mesa) => {
    if (mesa.sesion_id) {
      navigate(`/mesas/${mesa.id}`);
      return;
    }
    // Open new session
    setAbriendo(mesa.id);
    try {
      await api.post(`/mesas/${mesa.id}/abrir`, { comensales: 1 });
      navigate(`/mesas/${mesa.id}`);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Error al abrir mesa');
      setAbriendo(null);
    }
  };

  // Config modal state
  const [configPisos, setConfigPisos] = useState([]);
  const [configMesas, setConfigMesas] = useState([]);
  const [newPisoNombre, setNewPisoNombre] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  const openConfig = async () => {
    try {
      const res = await api.get('/mesas/config');
      const data = res?.data || res;
      setConfigPisos(data.pisos || []);
      setConfigMesas(data.mesas || []);
      setShowConfig(true);
    } catch {
      toast.error('Error cargando configuración');
    }
  };

  const addPiso = async () => {
    if (!newPisoNombre.trim()) return;
    setSavingConfig(true);
    try {
      const res = await api.post('/mesas/pisos', { nombre: newPisoNombre.trim() });
      const piso = res?.data || res;
      setConfigPisos(prev => [...prev, piso]);
      setNewPisoNombre('');
      toast.success('Piso creado');
    } catch {
      toast.error('Error creando piso');
    } finally {
      setSavingConfig(false);
    }
  };

  const deletePiso = async (pisoId) => {
    setSavingConfig(true);
    try {
      await api.del(`/mesas/pisos/${pisoId}`);
      setConfigPisos(prev => prev.filter(p => p.id !== pisoId));
      setConfigMesas(prev => prev.filter(m => m.piso_id !== pisoId));
      toast.success('Piso eliminado');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Error eliminando piso');
    } finally {
      setSavingConfig(false);
    }
  };

  const setMesaCount = async (pisoId, count) => {
    const current = configMesas.filter(m => m.piso_id === pisoId);
    const diff = count - current.length;
    if (diff === 0) return;
    setSavingConfig(true);
    try {
      if (diff > 0) {
        const res = await api.post('/mesas/batch', { piso_id: pisoId, cantidad: diff });
        const newMesas = res?.data || res;
        setConfigMesas(prev => [...prev, ...(Array.isArray(newMesas) ? newMesas : [])]);
      } else {
        // Remove from the end
        const toRemove = current.slice(diff);
        for (const mesa of toRemove) {
          await api.del(`/mesas/${mesa.id}`);
        }
        const removeIds = new Set(toRemove.map(m => m.id));
        setConfigMesas(prev => prev.filter(m => !removeIds.has(m.id)));
      }
      toast.success('Mesas actualizadas');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Error actualizando mesas');
    } finally {
      setSavingConfig(false);
    }
  };

  const closeConfig = () => {
    setShowConfig(false);
    fetchEstado();
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className={cx.skeleton + ' h-8 w-32'} />
          <div className="flex gap-2">
            <div className={cx.skeleton + ' h-10 w-28'} />
            <div className={cx.skeleton + ' h-10 w-32'} />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className={cx.skeleton + ' aspect-square rounded-2xl'} />
          ))}
        </div>
      </div>
    );
  }

  // No floors configured yet
  if (pisos.length === 0) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-stone-800">Mesas</h1>
          <button onClick={() => navigate('/pos')} className={cx.btnSecondary + ' flex items-center gap-2'}>
            <ShoppingCart size={16} /> Caja Rápida
          </button>
        </div>
        <div className={cx.card + ' p-16 text-center'}>
          <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Settings size={28} className="text-stone-400" />
          </div>
          <p className="text-stone-600 font-medium mb-1">Configura tus mesas</p>
          <p className="text-stone-400 text-sm mb-6">Crea pisos y define cuántas mesas tiene cada uno.</p>
          <button onClick={openConfig} className={cx.btnPrimary}>
            Configurar mesas
          </button>
        </div>
        {showConfig && renderConfigModal()}
      </div>
    );
  }

  function renderConfigModal() {
    return (
      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeConfig} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-stone-800">Configurar mesas</h2>
              <button onClick={closeConfig} className={cx.btnIcon}><X size={18} /></button>
            </div>

            {/* Existing floors */}
            <div className="space-y-4 mb-6">
              {configPisos.map(piso => {
                const mesasDelPiso = configMesas.filter(m => m.piso_id === piso.id);
                return (
                  <div key={piso.id} className={cx.card + ' p-4'}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-stone-800 text-sm">{piso.nombre}</span>
                      <button
                        onClick={() => deletePiso(piso.id)}
                        className="text-stone-400 hover:text-rose-500 transition-colors"
                        disabled={savingConfig}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className={cx.label + ' mb-0'}>Mesas</label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setMesaCount(piso.id, Math.max(0, mesasDelPiso.length - 1))}
                          disabled={savingConfig || mesasDelPiso.length === 0}
                          className="w-8 h-8 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center disabled:opacity-30 transition-colors"
                        >−</button>
                        <span className="w-8 text-center font-bold text-stone-800">{mesasDelPiso.length}</span>
                        <button
                          onClick={() => setMesaCount(piso.id, mesasDelPiso.length + 1)}
                          disabled={savingConfig}
                          className="w-8 h-8 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center disabled:opacity-30 transition-colors"
                        >+</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add new floor */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newPisoNombre}
                onChange={e => setNewPisoNombre(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addPiso()}
                className={cx.input}
                placeholder="Nombre del piso (ej: Terraza)"
              />
              <button
                onClick={addPiso}
                disabled={!newPisoNombre.trim() || savingConfig}
                className={cx.btnPrimary + ' whitespace-nowrap flex items-center gap-1.5'}
              >
                <Plus size={16} /> Agregar
              </button>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-xl font-bold text-stone-800">Mesas</h1>
        <div className="flex gap-2">
          <button onClick={openConfig} className={cx.btnGhost + ' flex items-center gap-1.5'}>
            <Settings size={16} /> Configurar
          </button>
          <button onClick={() => navigate('/pos')} className={cx.btnSecondary + ' flex items-center gap-2'}>
            <ShoppingCart size={16} /> Caja Rápida
          </button>
        </div>
      </div>

      {/* Floor tabs */}
      {pisos.length > 1 && (
        <div className="inline-flex bg-stone-200/70 rounded-full p-1 mb-5">
          {pisos.map(piso => {
            const isActive = piso.id === selectedPiso;
            return (
              <button
                key={piso.id}
                onClick={() => setSelectedPiso(piso.id)}
                className="relative z-10 px-5 py-[7px] text-xs font-medium whitespace-nowrap min-h-[36px]"
              >
                {isActive && (
                  <motion.div
                    layoutId="piso-pill"
                    className="absolute inset-0 bg-[#0A2F24] rounded-full shadow-sm"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className={`relative z-10 transition-colors duration-150 ${isActive ? 'text-white' : 'text-stone-500 hover:text-stone-700'}`}>
                  {piso.nombre}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Mesa grid */}
      {mesasFiltradas.length === 0 ? (
        <div className={cx.card + ' p-12 text-center'}>
          <p className="text-stone-400 text-sm">No hay mesas en este piso. Usa Configurar para agregar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {mesasFiltradas.map((mesa, index) => {
            const ocupada = !!mesa.sesion_id;
            const timer = ocupada ? formatTimer(mesa.abierta_at) : null;
            const isAbriendo = abriendo === mesa.id;

            return (
              <motion.button
                key={mesa.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => !isAbriendo && handleMesaClick(mesa)}
                disabled={isAbriendo}
                className={`relative rounded-2xl p-4 min-h-[120px] flex flex-col items-center justify-center text-center transition-colors duration-150 border-2 ${
                  ocupada
                    ? 'bg-emerald-50 border-emerald-400 shadow-sm'
                    : 'bg-stone-50 border-stone-200 hover:border-stone-400 hover:bg-white'
                } ${isAbriendo ? 'opacity-50' : ''}`}
              >
                {/* Mesa number */}
                <span className={`text-2xl font-bold ${ocupada ? 'text-emerald-700' : 'text-stone-400'}`}>
                  {mesa.numero}
                </span>

                {ocupada ? (
                  <>
                    {/* Timer */}
                    <div className="flex items-center gap-1 mt-1.5">
                      <Clock size={12} className="text-emerald-500" />
                      <span className="text-xs font-medium text-emerald-600">{timer}</span>
                    </div>
                    {/* Partial total */}
                    {parseFloat(mesa.total_parcial) > 0 && (
                      <span className="text-sm font-bold text-emerald-700 mt-1">
                        {formatCurrency(mesa.total_parcial)}
                      </span>
                    )}
                    {/* Items count */}
                    {parseInt(mesa.items_count) > 0 && (
                      <span className="absolute top-2 right-2 bg-emerald-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                        {mesa.items_count}
                      </span>
                    )}
                    {/* Pending badge */}
                    {parseInt(mesa.items_pendientes) > 0 && (
                      <span className="absolute top-2 left-2 bg-amber-400 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                        {mesa.items_pendientes}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-[11px] text-stone-400 mt-1">Libre</span>
                )}
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Config modal */}
      {showConfig && renderConfigModal()}
    </div>
  );
}
