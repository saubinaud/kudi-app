import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { cx } from '../styles/tokens';
import MesaCanvas from '../components/MesaCanvas';
import SegmentedControl from '../components/SegmentedControl';
import { ShoppingCart, Settings, Plus, Trash2, X, Pencil, Check, LayoutGrid, ArrowRight, MousePointer2, Move, Sparkles, Users, Link2, Search, Minus } from 'lucide-react';

// Tutorial steps
const STEPS = [
  { key: 'welcome', title: 'Módulo de Mesas', desc: 'Organiza tu local, gestiona pedidos por mesa y cobra cuando el cliente esté listo.' },
  { key: 'piso', title: 'Crea tu primer piso', desc: 'Cada piso representa una zona de tu local: planta baja, terraza, segundo piso, etc.' },
  { key: 'draw', title: 'Dibuja tus mesas', desc: 'Arrastra sobre la cuadrícula para crear mesas. Puedes moverlas y cambiarles el tamaño.' },
  { key: 'done', title: '¡Todo listo!', desc: 'Tu local está configurado. Ahora puedes gestionar pedidos por mesa.' },
];

export default function MesasPage() {
  const api = useApi();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pisoFromUrl = searchParams.get('piso');

  const initialLoadDone = useRef(false);
  const [pisos, setPisos] = useState([]);
  const [mesas, setMesas] = useState([]);
  const [selectedPiso, setSelectedPiso] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  // Tutorial
  const [tutorialStep, setTutorialStep] = useState(null); // null = no tutorial
  const [tutorialPisoName, setTutorialPisoName] = useState('');
  const [tutorialCreating, setTutorialCreating] = useState(false);
  const [mesasCreatedInTutorial, setMesasCreatedInTutorial] = useState(0);

  // Unir mesas
  const [unirMode, setUnirMode] = useState(false);
  const [unirSelected, setUnirSelected] = useState([]);

  // Filtro disponibles
  const [showDisponibles, setShowDisponibles] = useState(false);
  const [disponiblesPersonas, setDisponiblesPersonas] = useState('');
  const [highlightIds, setHighlightIds] = useState(null);

  // Edit sidebar
  const [editMesaId, setEditMesaId] = useState(null);
  const [editForm, setEditForm] = useState({ numero: '', nombre: '', capacidad: '', redondeo: 15 });
  const [editCollapsed, setEditCollapsed] = useState(false);
  const editDragControls = useDragControls();

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
      setSelectedPiso(prev => {
        // Priority: keep current > URL param > first piso
        if (prev && data.pisos?.some(p => p.id === prev)) return prev;
        const fromUrl = pisoFromUrl ? parseInt(pisoFromUrl) : null;
        if (fromUrl && data.pisos?.some(p => p.id === fromUrl)) return fromUrl;
        return data.pisos?.[0]?.id || null;
      });
      // Determine if we should show tutorial (only on first load)
      if (!initialLoadDone.current && data.pisos?.length === 0 && data.mesas?.length === 0) {
        setTutorialStep(0); // welcome
      }
      initialLoadDone.current = true;
    } catch (err) {
      console.error('Fetch mesas estado:', err);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    fetchEstado();
    if (!isEditing && tutorialStep === null) {
      const interval = setInterval(fetchEstado, 10000);
      return () => clearInterval(interval);
    }
  }, [fetchEstado, isEditing, tutorialStep]);

  const mesasFiltradas = useMemo(() =>
    selectedPiso ? mesas.filter(m => m.piso_id === selectedPiso) : mesas,
    [mesas, selectedPiso]
  );

  // === Canvas handlers ===

  const handleMesaClick = (mesa) => {
    // If linked (secondary), redirect to primary
    if (mesa.sesion_principal_id) {
      const primary = mesas.find(m => m.sesion_id === mesa.sesion_principal_id);
      if (primary) { navigate(`/mesas/${primary.id}`); return; }
    }
    // Navigate to detail — session is created on first comandar, not here
    navigate(`/mesas/${mesa.id}`);
  };

  const handleDuplicarMesa = async (mesaId) => {
    const mesa = mesas.find(m => m.id === mesaId);
    if (!mesa) return;
    const pisoId = mesa.piso_id || selectedPiso; // robusto: no depende de selectedPiso (falla en onboarding)
    if (!pisoId) return;
    const w = mesa.ancho ?? 3, h = mesa.alto ?? 2;
    // Find first free spot: try right, then below, then further right
    const candidates = [
      { x: (mesa.pos_x ?? 0) + w + 1, y: mesa.pos_y ?? 0 },
      { x: mesa.pos_x ?? 0, y: (mesa.pos_y ?? 0) + h + 1 },
      { x: (mesa.pos_x ?? 0) + w + 1, y: (mesa.pos_y ?? 0) + h + 1 },
      { x: (mesa.pos_x ?? 0) + (w + 1) * 2, y: mesa.pos_y ?? 0 },
    ];
    const pisoMesas = mesas.filter(m => m.piso_id === pisoId);
    const overlaps = (x, y) => pisoMesas.some(m => {
      const mx = m.pos_x ?? 0, my = m.pos_y ?? 0, mw = m.ancho ?? 3, mh = m.alto ?? 2;
      return x < mx + mw && x + w > mx && y < my + mh && y + h > my;
    });
    const spot = candidates.find(c => !overlaps(c.x, c.y)) || candidates[0];
    try {
      const res = await api.post('/mesas', {
        piso_id: pisoId,
        pos_x: spot.x,
        pos_y: spot.y,
        ancho: w,
        alto: h,
        capacidad: mesa.capacidad ?? 4,
        nombre: mesa.nombre || null,
      });
      let newMesa = res?.data || res;
      // POST /mesas no acepta redondeo: copiarlo con un PUT posterior si la original lo tenía.
      if (mesa.redondeo != null && mesa.redondeo !== newMesa.redondeo) {
        try { await api.put(`/mesas/${newMesa.id}`, { redondeo: mesa.redondeo }); newMesa = { ...newMesa, redondeo: mesa.redondeo }; } catch {}
      }
      setMesas(prev => [...prev, newMesa]);
      toast.success(`Mesa ${newMesa.numero} creada`);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Error duplicando mesa');
    }
  };

  const handleCreateMesa = async ({ pos_x, pos_y, ancho, alto }) => {
    const pisoId = selectedPiso;
    if (!pisoId) return;
    try {
      const res = await api.post('/mesas', { piso_id: pisoId, pos_x, pos_y, ancho, alto });
      const mesa = res?.data || res;
      setMesas(prev => [...prev, mesa]);
      // Tutorial: track mesas created
      if (tutorialStep === 2) {
        setMesasCreatedInTutorial(prev => prev + 1);
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Error creando mesa');
    }
  };

  const handleMoveMesa = async (id, { pos_x, pos_y }) => {
    // Optimistic update — no snap-back
    setMesas(prev => prev.map(m => m.id === id ? { ...m, pos_x, pos_y } : m));
    try {
      await api.put(`/mesas/${id}`, { pos_x, pos_y });
    } catch {
      toast.error('Error moviendo mesa');
      fetchEstado();
    }
  };

  const handleResizeMesa = async (id, { ancho, alto }) => {
    setMesas(prev => prev.map(m => m.id === id ? { ...m, ancho, alto } : m));
    try {
      await api.put(`/mesas/${id}`, { ancho, alto });
    } catch {
      toast.error('Error redimensionando mesa');
    }
  };

  const handleDeleteMesa = async (id) => {
    try {
      await api.del(`/mesas/${id}`);
      setMesas(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Error eliminando mesa');
    }
  };

  // Uniformar: all mesas same size as the most common
  const handleUniformar = async () => {
    const currentMesas = mesasFiltradas;
    if (currentMesas.length < 2) return;
    // Find most common size
    const sizes = {};
    for (const m of currentMesas) {
      const key = `${m.ancho ?? 3}x${m.alto ?? 2}`;
      sizes[key] = (sizes[key] || 0) + 1;
    }
    const [bestW, bestH] = Object.entries(sizes)
      .sort((a, b) => b[1] - a[1])[0][0]
      .split('x').map(Number);
    // Apply to all
    for (const m of currentMesas) {
      if ((m.ancho ?? 3) !== bestW || (m.alto ?? 2) !== bestH) {
        try {
          await api.put(`/mesas/${m.id}`, { ancho: bestW, alto: bestH });
        } catch {}
      }
    }
    toast.success('Mesas uniformadas');
    fetchEstado();
  };

  // Edit sidebar
  const handleSelectMesa = (mesaId) => {
    if (!isEditing || !mesaId) { setEditMesaId(null); return; }
    const mesa = mesas.find(m => m.id === mesaId);
    if (mesa) {
      setEditMesaId(mesaId);
      setEditForm({ numero: String(mesa.numero), nombre: mesa.nombre || '', capacidad: String(mesa.capacidad ?? 4), redondeo: mesa.redondeo ?? 15 });
    } else {
      setEditMesaId(null);
    }
  };

  const saveEditMesa = async () => {
    if (!editMesaId) return;
    const mesa = mesas.find(m => m.id === editMesaId);
    if (!mesa) return;
    // Validate — don't send if fields are empty (user is still typing)
    const num = parseInt(editForm.numero);
    const cap = parseInt(editForm.capacidad);
    if (!num || num < 1 || !cap || cap < 1) return;
    try {
      const updates = {};
      if (num !== mesa.numero) updates.numero = num;
      if (editForm.nombre !== (mesa.nombre || '')) updates.nombre = editForm.nombre || null;
      if (cap !== (mesa.capacidad ?? 4)) updates.capacidad = cap;
      // redondeo is handled by corner drag handle, not sidebar
      if (Object.keys(updates).length === 0) return;
      const res = await api.put(`/mesas/${editMesaId}`, updates);
      const updated = res?.data || res;
      setMesas(prev => prev.map(m => m.id === editMesaId ? { ...m, ...updated } : m));
      toast.success('Mesa actualizada');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Error actualizando mesa');
    }
  };

  // Update capacidad
  const handleUpdateCapacidad = async (id, capacidad) => {
    try {
      await api.put(`/mesas/${id}`, { capacidad });
      setMesas(prev => prev.map(m => m.id === id ? { ...m, capacidad } : m));
    } catch {
      toast.error('Error actualizando capacidad');
    }
  };

  // Unir mesas
  const handleToggleUnirSelect = (mesaId) => {
    const mesa = mesas.find(m => m.id === mesaId);
    if (mesa?.sesion_id) return; // can't select occupied
    setUnirSelected(prev =>
      prev.includes(mesaId) ? prev.filter(id => id !== mesaId) : [...prev, mesaId]
    );
  };

  const handleConfirmarUnion = async () => {
    if (unirSelected.length < 2) return;
    try {
      const res = await api.post('/mesas/unir', { mesa_ids: unirSelected });
      const sesion = res?.data || res;
      toast.success('Mesas unidas');
      setUnirMode(false);
      setUnirSelected([]);
      navigate(`/mesas/${unirSelected[0]}`);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Error uniendo mesas');
    }
  };

  // Filtro disponibles — live, sin botón
  const updateDisponibles = useCallback((val) => {
    setDisponiblesPersonas(val);
    const personas = parseInt(val);
    if (!personas || personas < 1) { setHighlightIds(null); return; }
    // Disponible = sin sesión activa (ni primaria ni secundaria) + capacidad suficiente
    const libres = mesasFiltradas.filter(m => !m.sesion_id && (m.capacidad ?? 4) >= personas);
    setHighlightIds(libres.map(m => m.id));
  }, [mesasFiltradas]);

  const clearDisponibles = () => {
    setShowDisponibles(false);
    setDisponiblesPersonas('');
    setHighlightIds(null);
  };

  // === Tutorial handlers ===

  const handleTutorialCreatePiso = async () => {
    if (!tutorialPisoName.trim()) return;
    setTutorialCreating(true);
    try {
      const res = await api.post('/mesas/pisos', { nombre: tutorialPisoName.trim() });
      const piso = res?.data || res;
      setPisos([piso]);
      setSelectedPiso(piso.id);
      setTutorialStep(2); // go to draw step
      setIsEditing(true);
    } catch {
      toast.error('Error creando piso');
    } finally {
      setTutorialCreating(false);
    }
  };

  const finishTutorial = () => {
    setTutorialStep(null);
    setIsEditing(false);
    fetchEstado();
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

  // === TUTORIAL MODE ===
  if (tutorialStep !== null) {
    const step = STEPS[tutorialStep];

    return (
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-stone-800">Mesas</h1>
          <button onClick={() => navigate('/pos')} className={cx.btnGhost + ' flex items-center gap-2 text-sm'}>
            <ShoppingCart size={16} /> Caja Rápida
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {STEPS.map((s, i) => (
            <div
              key={s.key}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                i === tutorialStep ? 'w-8 bg-[#16A34A]' : i < tutorialStep ? 'w-4 bg-emerald-300' : 'w-4 bg-stone-200'
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* Step 0: Welcome */}
          {tutorialStep === 0 && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.25 }}
              className={cx.card + ' max-w-lg mx-auto p-10 text-center'}
            >
              <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <LayoutGrid size={36} className="text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-stone-900 mb-2">{step.title}</h2>
              <p className="text-stone-500 text-sm mb-8 max-w-sm mx-auto">{step.desc}</p>

              <div className="flex flex-col gap-3 items-center">
                <button
                  onClick={() => setTutorialStep(1)}
                  className={cx.btnPrimary + ' px-8 py-3 text-base flex items-center gap-2'}
                >
                  Comenzar <ArrowRight size={16} />
                </button>
                <button
                  onClick={finishTutorial}
                  className="text-stone-400 text-xs hover:text-stone-600 transition-colors"
                >
                  Configurar después
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 1: Create floor */}
          {tutorialStep === 1 && (
            <motion.div
              key="piso"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.25 }}
              className={cx.card + ' max-w-lg mx-auto p-10 text-center'}
            >
              <div className="w-14 h-14 bg-sky-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <span className="text-2xl font-bold text-sky-600">1</span>
              </div>
              <h2 className="text-xl font-bold text-stone-900 mb-2">{step.title}</h2>
              <p className="text-stone-500 text-sm mb-6">{step.desc}</p>

              <div className="max-w-xs mx-auto space-y-4">
                <div>
                  <label className={cx.label}>Nombre del piso</label>
                  <input
                    type="text"
                    value={tutorialPisoName}
                    onChange={e => setTutorialPisoName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleTutorialCreatePiso()}
                    className={cx.input + ' text-center'}
                    placeholder="ej: Planta baja"
                    autoFocus
                  />
                </div>
                <button
                  onClick={handleTutorialCreatePiso}
                  disabled={!tutorialPisoName.trim() || tutorialCreating}
                  className={cx.btnPrimary + ' w-full py-3 flex items-center justify-center gap-2'}
                >
                  {tutorialCreating ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>Continuar <ArrowRight size={16} /></>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Draw mesas */}
          {tutorialStep === 2 && (
            <motion.div
              key="draw"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.25 }}
            >
              {/* Floating tutorial card */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.25 }}
                className={cx.card + ' p-4 mb-4 flex items-center gap-4 border-emerald-200 bg-emerald-50/50'}
              >
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-bold text-emerald-600">2</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-stone-800 text-sm">{step.title}</p>
                  <p className="text-stone-500 text-xs mt-0.5">
                    {mesasCreatedInTutorial === 0
                      ? 'Haz clic en un punto y arrastra para crear tu primera mesa.'
                      : `${mesasCreatedInTutorial} mesa${mesasCreatedInTutorial > 1 ? 's' : ''} creada${mesasCreatedInTutorial > 1 ? 's' : ''}. Puedes crear más o continuar.`
                    }
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {mesasCreatedInTutorial === 0 && (
                    <div className="flex items-center gap-1.5 text-emerald-600 animate-pulse">
                      <MousePointer2 size={16} />
                      <Move size={16} />
                    </div>
                  )}
                  {mesasCreatedInTutorial > 0 && (
                    <button
                      onClick={() => setTutorialStep(3)}
                      className={cx.btnPrimary + ' flex items-center gap-1.5'}
                    >
                      Continuar <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              </motion.div>

              {/* Canvas */}
              <MesaCanvas
                mesas={mesasFiltradas}
                isEditing={true}
                onCreateMesa={handleCreateMesa}
                onMoveMesa={handleMoveMesa}
                onResizeMesa={handleResizeMesa}
                onDeleteMesa={handleDeleteMesa}
                onUniformar={handleUniformar}
                onMesaClick={() => {}}
              />
            </motion.div>
          )}

          {/* Step 3: Done */}
          {tutorialStep === 3 && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className={cx.card + ' max-w-lg mx-auto p-10 text-center'}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-6"
              >
                <Sparkles size={36} className="text-emerald-600" />
              </motion.div>
              <h2 className="text-2xl font-bold text-stone-900 mb-2">{step.title}</h2>
              <p className="text-stone-500 text-sm mb-3">{step.desc}</p>
              <p className="text-stone-400 text-xs mb-8">
                Tip: Puedes editar la distribución en cualquier momento con el botón "Editar".
              </p>
              <button
                onClick={finishTutorial}
                className={cx.btnPrimary + ' px-8 py-3 text-base flex items-center gap-2 mx-auto'}
              >
                <Check size={16} /> Empezar a usar
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // === NORMAL MODE (pisos exist) ===

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
              <button onClick={closeConfig} className={cx.btnIcon}><X size={16} /></button>
            </div>

            <div className="space-y-3 mb-6">
              {configPisos.map(piso => (
                <div key={piso.id} className="flex items-center gap-3 px-4 py-3 bg-stone-50 rounded-xl">
                  <input
                    type="text"
                    defaultValue={piso.nombre}
                    onBlur={async (e) => {
                      const val = e.target.value.trim();
                      if (!val || val === piso.nombre) return;
                      try {
                        await api.put(`/mesas/pisos/${piso.id}`, { nombre: val });
                        setConfigPisos(prev => prev.map(p => p.id === piso.id ? { ...p, nombre: val } : p));
                        setPisos(prev => prev.map(p => p.id === piso.id ? { ...p, nombre: val } : p));
                      } catch { toast.error('No se pudo renombrar el piso'); }
                    }}
                    className="font-medium text-stone-800 text-sm flex-1 bg-transparent border border-transparent hover:border-stone-200 focus:border-stone-300 rounded-lg px-2 py-1 focus:outline-none"
                  />
                  <div className="flex items-center gap-1.5">
                    <Users size={12} className="text-stone-400" />
                    <input
                      type="number"
                      value={piso.aforo || ''}
                      onChange={async (e) => {
                        const val = parseInt(e.target.value) || null;
                        try {
                          await api.put(`/mesas/pisos/${piso.id}`, { aforo: val });
                          setConfigPisos(prev => prev.map(p => p.id === piso.id ? { ...p, aforo: val } : p));
                          setPisos(prev => prev.map(p => p.id === piso.id ? { ...p, aforo: val } : p));
                        } catch {}
                      }}
                      className="w-14 px-2 py-1 text-xs text-center border border-stone-200 rounded-lg"
                      placeholder="Aforo"
                      min="1"
                    />
                  </div>
                  <button
                    onClick={() => deletePiso(piso.id)}
                    className="text-stone-400 hover:text-rose-500 transition-colors"
                    disabled={savingConfig}
                  >
                    <Trash2 size={16} />
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

  // Aforo info
  const currentPiso = pisos.find(p => p.id === selectedPiso);
  const ocupadas = mesasFiltradas.filter(m => !!m.sesion_id).length;
  const totalMesas = mesasFiltradas.length;
  const personasOcupadas = mesasFiltradas.filter(m => m.sesion_id).reduce((s, m) => s + (parseInt(m.comensales) || 0), 0);

  const libres = totalMesas - ocupadas;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-stone-800">Mesas</h1>
          {!isEditing && !unirMode && totalMesas > 0 && (
            <p className="text-xs text-stone-400 mt-0.5">
              {currentPiso?.nombre || 'Tu local'}{currentPiso?.aforo ? ` · Aforo ${currentPiso.aforo}` : ''}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {unirMode ? (
            <>
              <button onClick={() => { setUnirMode(false); setUnirSelected([]); }} className={cx.btnGhost + ' flex items-center gap-1.5'}>
                <X size={16} /> Cancelar
              </button>
              <button onClick={handleConfirmarUnion} disabled={unirSelected.length < 2}
                className={cx.btnPrimary + ' flex items-center gap-1.5'}>
                <Link2 size={16} /> Unir {unirSelected.length} mesas
              </button>
            </>
          ) : isEditing ? (
            <>
              <button onClick={openConfig} className={cx.btnGhost + ' flex items-center gap-1.5'}>
                <Settings size={16} /> Pisos
              </button>
              <button onClick={() => setIsEditing(false)} className={cx.btnPrimary + ' flex items-center gap-1.5'}>
                <Check size={16} /> Listo
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setUnirMode(true); setUnirSelected([]); }} className={cx.btnGhost + ' flex items-center gap-1.5'}>
                <Link2 size={16} /> Unir
              </button>
              <button onClick={() => setIsEditing(true)} className={cx.btnSecondary + ' flex items-center gap-1.5'}>
                <Pencil size={16} /> Editar
              </button>
              <button onClick={() => navigate('/pos')} className={cx.btnPrimary + ' flex items-center gap-2'}>
                <ShoppingCart size={16} /> Caja Rápida
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats bar — Kudi style */}
      {!isEditing && !unirMode && totalMesas > 0 && (
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-5 flex-1">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#0A2F24]" />
              <span className="text-sm font-semibold text-stone-800">{ocupadas}</span>
              <span className="text-xs text-stone-400">ocupadas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-stone-200 border border-stone-300" />
              <span className="text-sm font-semibold text-stone-800">{libres}</span>
              <span className="text-xs text-stone-400">libres</span>
            </div>
            {ocupadas > 0 && (
              <div className="h-4 w-px bg-stone-200" />
            )}
            {ocupadas > 0 && (
              <span className="text-xs text-stone-500">{personasOcupadas} personas</span>
            )}
          </div>

          {/* Buscar disponible — inline compact */}
          <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-full px-3 py-1.5">
            <Search size={12} className="text-stone-400" />
            <input
              type="number"
              value={disponiblesPersonas}
              onChange={e => updateDisponibles(e.target.value)}
              className="w-10 text-sm text-center bg-transparent outline-none placeholder:text-stone-300"
              placeholder="4"
              min="1"
            />
            <span className="text-xs text-stone-400">pers.</span>
          {highlightIds && (
              <span className="text-[10px] font-semibold text-[#16A34A]">{highlightIds.length}</span>
            )}
            {disponiblesPersonas && (
              <button onClick={clearDisponibles} className="text-stone-300 hover:text-stone-500"><X size={12} /></button>
            )}
          </div>
        </div>
      )}

      {/* Unir mode banner */}
      {unirMode && (
        <div className="flex items-center gap-3 mb-4 px-4 py-3 bg-violet-50 border border-violet-200 rounded-xl">
          <Link2 size={16} className="text-violet-600" />
          <span className="text-sm text-violet-800 font-medium">Selecciona las mesas a unir</span>
        </div>
      )}

      {/* Floor tabs */}
      {pisos.length > 1 && (
        <div className="mb-4">
          <SegmentedControl
            options={pisos.map(p => ({ key: p.id, label: p.nombre }))}
            value={selectedPiso}
            onChange={setSelectedPiso}
            layoutId="mesa-piso"
            size="sm"
          />
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
        onUpdateCapacidad={handleUpdateCapacidad}
        onUpdateRedondeo={async (id, val) => {
          setMesas(prev => prev.map(m => m.id === id ? { ...m, redondeo: val, ...(val >= 50 ? { alto: m.ancho ?? 3 } : {}) } : m));
          try { await api.put(`/mesas/${id}`, { redondeo: val, ...(val >= 50 ? { alto: (mesas.find(m => m.id === id)?.ancho ?? 3) } : {}) }); }
          catch { toast.error('Error'); fetchEstado(); }
        }}
        onDuplicar={handleDuplicarMesa}
        onUniformar={handleUniformar}
        onMesaClick={handleMesaClick}
        onSelectMesa={handleSelectMesa}
        multiSelect={unirMode}
        selectedMesaIds={unirSelected}
        onToggleSelect={handleToggleUnirSelect}
        highlightIds={highlightIds}
      />

      {/* Edit sidebar */}
      <AnimatePresence>
        {isEditing && editMesaId && (() => {
          const mesa = mesas.find(m => m.id === editMesaId);
          if (!mesa) return null;
          return (
            <motion.div
              key="edit-sidebar"
              drag
              dragMomentum={false}
              dragListener={false}
              dragControls={editDragControls}
              dragConstraints={{ top: -500, bottom: 500, left: -500, right: 500 }}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="fixed right-4 bottom-4 z-30"
              style={{ width: editCollapsed ? 'auto' : '260px' }}
            >
              <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xl overflow-hidden">
                {/* Header — drag handle + click to expand */}
                <div
                  className="flex items-center justify-between px-4 py-3 bg-stone-50/80 border-b border-stone-100 cursor-grab active:cursor-grabbing"
                  onPointerDown={(e) => editDragControls.start(e)}
                  onClick={() => editCollapsed && setEditCollapsed(false)}>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-[#16A34A]/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-[#16A34A]">{mesa.numero}</span>
                    </div>
                    <span className="text-sm font-semibold text-stone-800">Mesa {mesa.numero}</span>
                    {editCollapsed && <span className="text-xs text-stone-400">· click para editar</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    {!editCollapsed && (
                      <button onClick={(e) => { e.stopPropagation(); setEditCollapsed(true); }} className={cx.btnIcon + ' !p-1.5'}>
                        <Minus size={16} />
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); setEditMesaId(null); }} className={cx.btnIcon + ' !p-1.5'}><X size={16} /></button>
                  </div>
                </div>
                {/* Body — collapsible */}
                {!editCollapsed && (
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={cx.label}>Número</label>
                        <input type="number" value={editForm.numero} onChange={e => setEditForm(f => ({ ...f, numero: e.target.value }))}
                          className={cx.input + ' text-sm'} min="1" />
                      </div>
                      <div>
                        <label className={cx.label}>Capacidad</label>
                        <input type="number" value={editForm.capacidad} onChange={e => setEditForm(f => ({ ...f, capacidad: e.target.value }))}
                          className={cx.input + ' text-sm'} min="1" max="99" />
                      </div>
                    </div>
                    <div>
                      <label className={cx.label}>Nombre (opcional)</label>
                      <input type="text" value={editForm.nombre} onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))}
                        className={cx.input + ' text-sm'} placeholder="ej: Terraza 1" />
                    </div>
                    <button onClick={saveEditMesa} className={cx.btnPrimary + ' w-full min-h-[40px] text-sm'}>
                      Guardar
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Config modal */}
      {showConfig && renderConfigModal()}
    </div>
  );
}
