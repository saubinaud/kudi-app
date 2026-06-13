import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { formatCurrency } from '../utils/format';
import { Clock, ZoomIn, ZoomOut, Maximize2, Trash2, Equal, Users } from 'lucide-react';
import { cx } from '../styles/tokens';

const CELL = 24;
const COLS = 40;
const ROWS = 28;
const MIN_SIZE = 2;
const CANVAS_W = COLS * CELL;
const CANVAS_H = ROWS * CELL;

function formatTimer(abiertaAt) {
  if (!abiertaAt) return '';
  const diff = Math.floor((Date.now() - new Date(abiertaAt).getTime()) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
  return `${m}m`;
}

export default function MesaCanvas({
  mesas,
  isEditing,
  onCreateMesa,
  onMoveMesa,
  onResizeMesa,
  onDeleteMesa,
  onUpdateCapacidad,
  onUniformar,
  onMesaClick,
  // Multi-select mode (for unir)
  multiSelect = false,
  selectedMesaIds = [],
  onToggleSelect,
  // Highlight filter (for disponibles)
  highlightIds = null,
}) {
  const containerRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [editingCapacidad, setEditingCapacidad] = useState(null);
  const [capacidadInput, setCapacidadInput] = useState('');

  // Interaction refs
  const drawingRef = useRef(null);
  const draggingRef = useRef(null);
  const resizingRef = useRef(null);
  const [, forceRender] = useState(0);
  const [tempPos, setTempPos] = useState({});

  // Timer
  const [, setTick] = useState(0);
  useEffect(() => {
    if (isEditing) return;
    const iv = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(iv);
  }, [isEditing]);

  const screenToGrid = useCallback((clientX, clientY) => {
    const container = containerRef.current;
    if (!container) return { col: 0, row: 0 };
    const rect = container.getBoundingClientRect();
    const x = (clientX - rect.left + container.scrollLeft) / zoom;
    const y = (clientY - rect.top + container.scrollTop) / zoom;
    return {
      col: Math.max(0, Math.min(COLS - 1, Math.floor(x / CELL))),
      row: Math.max(0, Math.min(ROWS - 1, Math.floor(y / CELL))),
    };
  }, [zoom]);

  const mesaAtGrid = useCallback((col, row) => {
    return mesas.find(m => {
      const x = m.pos_x ?? 0, y = m.pos_y ?? 0;
      const w = m.ancho ?? 3, h = m.alto ?? 2;
      return col >= x && col < x + w && row >= y && row < y + h;
    });
  }, [mesas]);

  // Pointer handlers
  const handlePointerDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.target.setPointerCapture(e.pointerId);
    const { col, row } = screenToGrid(e.clientX, e.clientY);

    // Multi-select mode (unir)
    if (multiSelect) {
      const mesa = mesaAtGrid(col, row);
      if (mesa) onToggleSelect?.(mesa.id);
      return;
    }

    if (isEditing) {
      const mesa = mesaAtGrid(col, row);
      if (mesa) {
        const mx = mesa.pos_x ?? 0, my = mesa.pos_y ?? 0;
        const mw = mesa.ancho ?? 3, mh = mesa.alto ?? 2;
        if (col === mx + mw - 1 && row === my + mh - 1) {
          resizingRef.current = { mesa, startCol: col, startRow: row, origW: mw, origH: mh };
          setSelectedId(mesa.id);
          forceRender(n => n + 1);
          return;
        }
        draggingRef.current = { mesa, startCol: col, startRow: row, origX: mx, origY: my };
        setSelectedId(mesa.id);
        setEditingCapacidad(null);
        forceRender(n => n + 1);
        return;
      }
      drawingRef.current = { startCol: col, startRow: row, endCol: col + 1, endRow: row + 1 };
      setSelectedId(null);
      setEditingCapacidad(null);
      forceRender(n => n + 1);
      return;
    }

    // View mode
    const mesa = mesaAtGrid(col, row);
    if (mesa) {
      // If mesa is linked (secondary in a group), redirect to primary
      if (mesa.sesion_principal_id) {
        const primary = mesas.find(m => m.sesion_id && !m.sesion_principal_id &&
          mesas.some(linked => linked.sesion_principal_id === m.sesion_id && linked.id === mesa.id));
        // Just click the mesa, the detail page handles the redirect
      }
      onMesaClick?.(mesa);
    }
  };

  const handlePointerMove = (e) => {
    if (!isEditing || multiSelect) return;
    const { col, row } = screenToGrid(e.clientX, e.clientY);

    if (drawingRef.current) {
      drawingRef.current = {
        ...drawingRef.current,
        endCol: Math.max(drawingRef.current.startCol + 1, Math.min(COLS, col + 1)),
        endRow: Math.max(drawingRef.current.startRow + 1, Math.min(ROWS, row + 1)),
      };
      forceRender(n => n + 1);
    }
    if (draggingRef.current) {
      const d = draggingRef.current;
      const dx = col - d.startCol, dy = row - d.startRow;
      const newX = Math.max(0, Math.min(COLS - (d.mesa.ancho ?? 3), d.origX + dx));
      const newY = Math.max(0, Math.min(ROWS - (d.mesa.alto ?? 2), d.origY + dy));
      setTempPos(prev => ({ ...prev, [d.mesa.id]: { pos_x: newX, pos_y: newY } }));
    }
    if (resizingRef.current) {
      const r = resizingRef.current;
      const newW = Math.max(MIN_SIZE, Math.min(COLS - (r.mesa.pos_x ?? 0), r.origW + col - r.startCol + 1 - 1));
      const newH = Math.max(MIN_SIZE, Math.min(ROWS - (r.mesa.pos_y ?? 0), r.origH + row - r.startRow + 1 - 1));
      setTempPos(prev => ({ ...prev, [r.mesa.id]: { ancho: newW, alto: newH } }));
    }
  };

  const handlePointerUp = (e) => {
    if (e) e.target.releasePointerCapture?.(e.pointerId);
    if (drawingRef.current) {
      const d = drawingRef.current;
      const x = Math.min(d.startCol, d.endCol - 1), y = Math.min(d.startRow, d.endRow - 1);
      const w = Math.abs(d.endCol - d.startCol), h = Math.abs(d.endRow - d.startRow);
      drawingRef.current = null;
      if (w >= MIN_SIZE && h >= MIN_SIZE) onCreateMesa?.({ pos_x: x, pos_y: y, ancho: w, alto: h });
      forceRender(n => n + 1);
    }
    if (draggingRef.current) {
      const d = draggingRef.current;
      const pos = tempPos[d.mesa.id];
      draggingRef.current = null;
      setTempPos({});
      if (pos && (pos.pos_x !== d.origX || pos.pos_y !== d.origY)) onMoveMesa?.(d.mesa.id, pos);
      forceRender(n => n + 1);
    }
    if (resizingRef.current) {
      const r = resizingRef.current;
      const pos = tempPos[r.mesa.id];
      resizingRef.current = null;
      setTempPos({});
      if (pos) onResizeMesa?.(r.mesa.id, pos);
      forceRender(n => n + 1);
    }
  };

  // Zoom
  const zoomIn = () => setZoom(z => Math.min(2, Math.round((z + 0.2) * 10) / 10));
  const zoomOut = () => setZoom(z => Math.max(0.4, Math.round((z - 0.2) * 10) / 10));
  const zoomFit = () => {
    if (!containerRef.current) return;
    const r = containerRef.current.getBoundingClientRect();
    setZoom(Math.round(Math.min((r.width - 16) / CANVAS_W, (r.height - 16) / CANVAS_H, 1.5) * 10) / 10);
  };
  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom(z => Math.min(2, Math.max(0.4, Math.round((z + (e.deltaY > 0 ? -0.1 : 0.1)) * 10) / 10)));
    }
  };

  // Keyboard delete
  useEffect(() => {
    const handleKey = (e) => {
      if (!isEditing || !selectedId || editingCapacidad) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onDeleteMesa?.(selectedId);
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isEditing, selectedId, onDeleteMesa, editingCapacidad]);

  // Capacidad edit
  const startEditCapacidad = (mesa) => {
    setEditingCapacidad(mesa.id);
    setCapacidadInput(String(mesa.capacidad ?? 4));
  };
  const saveCapacidad = () => {
    if (editingCapacidad && capacidadInput) {
      onUpdateCapacidad?.(editingCapacidad, parseInt(capacidadInput) || 4);
    }
    setEditingCapacidad(null);
  };

  const drawing = drawingRef.current;
  const drawRect = drawing ? (() => {
    const x = Math.min(drawing.startCol, drawing.endCol - 1), y = Math.min(drawing.startRow, drawing.endRow - 1);
    const w = Math.abs(drawing.endCol - drawing.startCol), h = Math.abs(drawing.endRow - drawing.startRow);
    return { x: x * CELL, y: y * CELL, w: w * CELL, h: h * CELL, valid: w >= MIN_SIZE && h >= MIN_SIZE };
  })() : null;

  return (
    <div className="relative">
      {/* Toolbar */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-lg border border-stone-200 p-1 shadow-sm">
        {isEditing && mesas.length > 1 && (
          <>
            <button onClick={() => onUniformar?.()} className={cx.btnIcon + ' !p-1.5'} title="Igualar tamaño"><Equal size={16} /></button>
            <div className="w-px h-4 bg-stone-200" />
          </>
        )}
        <button onClick={zoomOut} className={cx.btnIcon + ' !p-1.5'}><ZoomOut size={16} /></button>
        <span className="text-[10px] font-mono text-stone-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={zoomIn} className={cx.btnIcon + ' !p-1.5'}><ZoomIn size={16} /></button>
        <button onClick={zoomFit} className={cx.btnIcon + ' !p-1.5'}><Maximize2 size={16} /></button>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="overflow-auto rounded-xl border border-stone-200 bg-stone-50/80"
        style={{ height: 'calc(100vh - 220px)', minHeight: '400px' }}
        onWheel={handleWheel}
      >
        <div style={{ width: CANVAS_W * zoom, height: CANVAS_H * zoom, position: 'relative' }}>
          <div style={{
            transform: `scale(${zoom})`, transformOrigin: '0 0',
            width: CANVAS_W, height: CANVAS_H, position: 'absolute', top: 0, left: 0,
            backgroundImage: isEditing
              ? `linear-gradient(to right, rgba(214,211,209,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(214,211,209,0.15) 1px, transparent 1px)`
              : 'none',
            backgroundSize: `${CELL}px ${CELL}px`,
          }}>
            {mesas.map(mesa => {
              const tp = tempPos[mesa.id];
              const px = (tp?.pos_x ?? mesa.pos_x ?? 0) * CELL;
              const py = (tp?.pos_y ?? mesa.pos_y ?? 0) * CELL;
              const pw = (tp?.ancho ?? mesa.ancho ?? 3) * CELL;
              const ph = (tp?.alto ?? mesa.alto ?? 2) * CELL;
              const ocupada = !!mesa.sesion_id;
              const isSelected = selectedId === mesa.id;
              const isMultiSelected = multiSelect && selectedMesaIds.includes(mesa.id);
              const isDimmed = highlightIds && !highlightIds.includes(mesa.id);
              const isLinked = !!mesa.sesion_principal_id;
              const isDragging = draggingRef.current?.mesa?.id === mesa.id;

              return (
                <motion.div
                  key={mesa.id}
                  layout={!isDragging && !resizingRef.current}
                  transition={{ type: 'spring', stiffness: 500, damping: 35, duration: 0.15 }}
                  style={{ position: 'absolute', left: px, top: py, width: pw, height: ph, opacity: isDimmed ? 0.3 : 1 }}
                  className={`rounded-xl flex flex-col items-center justify-center text-center select-none transition-all duration-150 ${
                    multiSelect
                      ? isMultiSelected
                        ? 'bg-violet-50 border-2 border-violet-500 shadow-md'
                        : ocupada
                          ? 'bg-stone-100 border-2 border-stone-200 opacity-50'
                          : 'bg-white border-2 border-stone-200 hover:border-violet-300'
                      : isEditing
                        ? isSelected
                          ? 'bg-sky-50 border-2 border-sky-500 shadow-md'
                          : 'bg-white border-2 border-stone-200 hover:border-stone-300'
                        : ocupada
                          ? isLinked
                            ? 'bg-amber-50 border-2 border-amber-400 shadow-sm'
                            : 'bg-emerald-50 border-2 border-emerald-400 shadow-sm'
                          : 'bg-white border-2 border-stone-200 hover:border-stone-300 hover:shadow-sm'
                  } ${isDragging ? 'opacity-80 shadow-lg' : ''}`}
                >
                  {/* Number */}
                  <span className={`font-bold leading-none ${pw < CELL * 3 ? 'text-sm' : 'text-xl'} ${
                    multiSelect
                      ? isMultiSelected ? 'text-violet-700' : 'text-stone-400'
                      : isEditing
                        ? isSelected ? 'text-sky-700' : 'text-stone-500'
                        : ocupada ? (isLinked ? 'text-amber-700' : 'text-emerald-700') : 'text-stone-400'
                  }`}>
                    {mesa.numero}
                  </span>

                  {/* Capacity badge */}
                  {ph >= CELL * 2 && (
                    <div className={`flex items-center gap-0.5 mt-0.5 ${
                      isEditing && isSelected ? 'cursor-pointer' : ''
                    }`}
                      onClick={(e) => { if (isEditing && isSelected) { e.stopPropagation(); startEditCapacidad(mesa); } }}
                    >
                      <Users size={9} className="text-stone-400" />
                      {editingCapacidad === mesa.id ? (
                        <input
                          type="number"
                          value={capacidadInput}
                          onChange={e => setCapacidadInput(e.target.value)}
                          onBlur={saveCapacidad}
                          onKeyDown={e => e.key === 'Enter' && saveCapacidad()}
                          className="w-8 text-[10px] text-center bg-white border border-sky-300 rounded px-0.5"
                          min="1"
                          max="99"
                          autoFocus
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <span className="text-[10px] text-stone-400">{mesa.capacidad ?? 4}</span>
                      )}
                    </div>
                  )}

                  {/* View mode: timer & total */}
                  {!isEditing && !multiSelect && ocupada && !isLinked && ph >= CELL * 3 && (
                    <>
                      <div className="flex items-center gap-0.5 mt-0.5">
                        <Clock size={9} className="text-emerald-500" />
                        <span className="text-[9px] font-medium text-emerald-600">{formatTimer(mesa.abierta_at)}</span>
                      </div>
                      {parseFloat(mesa.total_parcial) > 0 && pw >= CELL * 3 && (
                        <span className="text-[10px] font-bold text-emerald-700">{formatCurrency(mesa.total_parcial)}</span>
                      )}
                    </>
                  )}

                  {/* Linked badge */}
                  {!isEditing && isLinked && (
                    <span className="text-[8px] text-amber-600 font-medium mt-0.5">unida</span>
                  )}

                  {/* Items badge */}
                  {!isEditing && ocupada && !isLinked && parseInt(mesa.items_count) > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                      {mesa.items_count}
                    </span>
                  )}

                  {/* Multi-select checkmark */}
                  {multiSelect && isMultiSelected && (
                    <span className="absolute -top-1.5 -right-1.5 bg-violet-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">✓</span>
                  )}

                  {/* Edit: delete button on mesa */}
                  {isEditing && isSelected && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteMesa?.(mesa.id); setSelectedId(null); }}
                      className="absolute -top-2.5 -right-2.5 w-6 h-6 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center shadow-sm z-20 transition-colors"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}

                  {/* Resize handle */}
                  {isEditing && isSelected && (
                    <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-sky-500 rounded-full cursor-se-resize shadow-sm" />
                  )}
                </motion.div>
              );
            })}

            {/* Drawing preview */}
            {drawRect && (
              <div
                style={{ position: 'absolute', left: drawRect.x, top: drawRect.y, width: drawRect.w, height: drawRect.h }}
                className={`rounded-xl border-2 border-dashed pointer-events-none ${
                  drawRect.valid ? 'border-emerald-400 bg-emerald-50/50' : 'border-rose-300 bg-rose-50/30'
                }`}
              />
            )}
          </div>

          {/* Interaction overlay */}
          <div
            style={{ position: 'absolute', inset: 0, zIndex: 10, touchAction: 'none' }}
            className={multiSelect ? 'cursor-pointer' : isEditing ? 'cursor-crosshair' : ''}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
        </div>
      </div>

      {isEditing && (
        <p className="text-[10px] text-stone-400 mt-2 text-center">
          Arrastra para crear · Click para seleccionar · Click capacidad para editar · Ctrl+Scroll para zoom
        </p>
      )}
    </div>
  );
}
