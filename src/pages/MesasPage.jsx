import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { cx } from '../styles/tokens';
import MesaCanvas from '../components/MesaCanvas';
import { ShoppingCart, Settings, Plus, Trash2, X, Pencil, Check } from 'lucide-react';

export default function MesasPage() {
  const api = useApi();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [pisos, setPisos] = useState([]);
  const [mesas, setMesas] = useState([]);
  const [selectedPiso, setSelectedPiso] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  // Config modal (for pisos)
  const [showConfig, setShowConfig] = useState(false);
  const [configPisos, setConfigPisos] = useState([]);
  const [newPisoNombre, setNewPisoNombre] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

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
    // Polling only in view mode
    if (!isEditing) {
      const interval = setInterval(fetchEstado, 10000);
      return () => clearInterval(interval);
    }
  }, [fetchEstado, isEditing]);

  const mesasFiltradas = useMemo(() =>
    selectedPiso ? mesas.filter(m => m.piso_id === selectedPiso) : mesas,
    [mesas, selectedPiso]
  );

  // === Canvas handlers ===

  const handleMesaClick = async (mesa) => {
    if (mesa.sesion_id) {
      navigate(`/mesas/${mesa.id}`);
      return;
    }
    try {
      await api.post(`/mesas/${mesa.id}/abrir`, { comensales: 1 });
      navigate(`/mesas/${mesa.id}`);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Error al abrir mesa');
    }
  };

  const handleCreateMesa = async ({ pos_x, pos_y, ancho, alto }) => {
    if (!selectedPiso) return;
    try {
      const res = await api.post('/mesas', { piso_id: selectedPiso, pos_x, pos_y, ancho, alto });
      const mesa = res?.data || res;
      setMesas(prev => [...prev, mesa]);
      toast.success(`Mesa ${mesa.numero} creada`);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Error creando mesa');
    }
  };

  const handleMoveMesa = async (id, { pos_x, pos_y }) => {
    try {
      const res = await api.put(`/mesas/${id}`, { pos_x, pos_y });
      const updated = res?.data || res;
      setMesas(prev => prev.map(m => m.id === id ? { ...m, ...updated } : m));
    } catch {
      toast.error('Error moviendo mesa');
    }
  };

  const handleResizeMesa = async (id, { ancho, alto }) => {
    try {
      const res = await api.put(`/mesas/${id}`, { ancho, alto });
      const updated = res?.data || res;
      setMesas(prev => prev.map(m => m.id === id ? { ...m, ...updated } : m));
    } catch {
      toast.error('Error redimensionando mesa');
    }
  };

  const handleDeleteMesa = async (id) => {
    try {
      await api.del(`/mesas/${id}`);
      setMesas(prev => prev.filter(m => m.id !== id));
      toast.success('Mesa eliminada');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Error eliminando mesa');
    }
  };

  // === Piso config ===

  const openConfig = async () => {
    try {
      const res = await api.get('/mesas/config');
      const data = res?.data || res;
      setConfigPisos(data.pisos || []);
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
      setPisos(prev => [...prev, piso]);
      if (!selectedPiso) setSelectedPiso(piso.id);
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
      setPisos(prev => prev.filter(p => p.id !== pisoId));
      setMesas(prev => prev.filter(m => m.piso_id !== pisoId));
      if (selectedPiso === pisoId) setSelectedPiso(pisos.find(p => p.id !== pisoId)?.id || null);
      toast.success('Piso eliminado');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Error eliminando piso');
    } finally {
      setSavingConfig(false);
    }
  };

  const closeConfig = () => {
    setShowConfig(false);
    fetchEstado();
  };

  // === Render ===

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
        <div className={cx.skeleton + ' rounded-xl'} style={{ height: 'calc(100vh - 220px)' }} />
      </div>
    );
  }

  // No floors configured
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
          <p className="text-stone-400 text-sm mb-6">Crea pisos y dibuja la distribución de tu local.</p>
          <button onClick={openConfig} className={cx.btnPrimary}>
            Configurar pisos
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
              <h2 className="text-lg font-bold text-stone-800">Pisos del local</h2>
              <button onClick={closeConfig} className={cx.btnIcon}><X size={18} /></button>
            </div>

            <div className="space-y-3 mb-6">
              {configPisos.map(piso => (
                <div key={piso.id} className="flex items-center justify-between px-4 py-3 bg-stone-50 rounded-xl">
                  <span className="font-medium text-stone-800 text-sm">{piso.nombre}</span>
                  <button
                    onClick={() => deletePiso(piso.id)}
                    className="text-stone-400 hover:text-rose-500 transition-colors"
                    disabled={savingConfig}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <h1 className="text-xl font-bold text-stone-800">Mesas</h1>
        <div className="flex gap-2">
          <button onClick={openConfig} className={cx.btnGhost + ' flex items-center gap-1.5'}>
            <Settings size={16} /> Pisos
          </button>
          {isEditing ? (
            <button
              onClick={() => setIsEditing(false)}
              className={cx.btnPrimary + ' flex items-center gap-1.5'}
            >
              <Check size={16} /> Listo
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className={cx.btnSecondary + ' flex items-center gap-1.5'}
            >
              <Pencil size={16} /> Editar
            </button>
          )}
          {!isEditing && (
            <button onClick={() => navigate('/pos')} className={cx.btnSecondary + ' flex items-center gap-2'}>
              <ShoppingCart size={16} /> Caja Rápida
            </button>
          )}
        </div>
      </div>

      {/* Floor tabs */}
      {pisos.length > 1 && (
        <div className="inline-flex bg-stone-200/70 rounded-full p-1 mb-4">
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

      {/* Canvas */}
      <MesaCanvas
        mesas={mesasFiltradas}
        isEditing={isEditing}
        onCreateMesa={handleCreateMesa}
        onMoveMesa={handleMoveMesa}
        onResizeMesa={handleResizeMesa}
        onDeleteMesa={handleDeleteMesa}
        onMesaClick={handleMesaClick}
      />

      {/* Config modal */}
      {showConfig && renderConfigModal()}
    </div>
  );
}
