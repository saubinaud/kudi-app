import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { formatCurrency } from '../utils/format';
import { Clock, ZoomIn, ZoomOut, Maximize2, Trash2, Equal, Users, Copy, Link2 } from 'lucide-react';
import { cx } from '../styles/tokens';

const CELL = 24;
const COLS = 80;
const ROWS = 50;
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
  onDuplicar,
  onUpdateCapacidad,
  onUniformar,
  onMesaClick,
  onSelectMesa,
  multiSelect = false,
  selectedMesaIds = [],
  onToggleSelect,
  highlightIds = null,
}) {
  const containerRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [selectedId, setSelectedId] = useState(null);

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

  // Check overlap with existing mesas
  const checkOverlap = useCallback((x, y, w, h, excludeId = null) => {
    return mesas.some(m => {
      if (m.id === excludeId) return false;
      const mx = m.pos_x ?? 0, my = m.pos_y ?? 0, mw = m.ancho ?? 3, mh = m.alto ?? 2;
      return x < mx + mw && x + w > mx && y < my + mh && y + h > my;
    });
  }, [mesas]);

  // Notify parent of selection changes
  useEffect(() => {
    onSelectMesa?.(selectedId);
  }, [selectedId]); // eslint-disable-line

  const handlePointerDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.target.setPointerCapture(e.pointerId);
    const { col, row } = screenToGrid(e.clientX, e.clientY);

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
        forceRender(n => n + 1);
        return;
      }
      drawingRef.current = { startCol: col, startRow: row, endCol: col + 1, endRow: row + 1 };
      setSelectedId(null);
      forceRender(n => n + 1);
      return;
    }

    const mesa = mesaAtGrid(col, row);
    if (mesa) onMesaClick?.(mesa);
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
      setTempPos(prev => ({ ...prev, [d.mesa.id]: {
        pos_x: Math.max(0, Math.min(COLS - (d.mesa.ancho ?? 3), d.origX + dx)),
        pos_y: Math.max(0, Math.min(ROWS - (d.mesa.alto ?? 2), d.origY + dy)),
      }}));
    }
    if (resizingRef.current) {
      const r = resizingRef.current;
      setTempPos(prev => ({ ...prev, [r.mesa.id]: {
        ancho: Math.max(MIN_SIZE, Math.min(COLS - (r.mesa.pos_x ?? 0), r.origW + col - r.startCol)),
        alto: Math.max(MIN_SIZE, Math.min(ROWS - (r.mesa.pos_y ?? 0), r.origH + row - r.startRow)),
      }}));
    }
  };

  const handlePointerUp = (e) => {
    if (e) e.target.releasePointerCapture?.(e.pointerId);
    if (drawingRef.current) {
      const d = drawingRef.current;
      const x = Math.min(d.startCol, d.endCol - 1), y = Math.min(d.startRow, d.endRow - 1);
      const w = Math.abs(d.endCol - d.startCol), h = Math.abs(d.endRow - d.startRow);
      drawingRef.current = null;
      if (w >= MIN_SIZE && h >= MIN_SIZE && !checkOverlap(x, y, w, h)) onCreateMesa?.({ pos_x: x, pos_y: y, ancho: w, alto: h });
      forceRender(n => n + 1);
    }
    if (draggingRef.current) {
      const d = draggingRef.current;
      const pos = tempPos[d.mesa.id];
      draggingRef.current = null;
      // Keep tempPos — parent will update via optimistic update, then tempPos becomes stale
      if (pos && (pos.pos_x !== d.origX || pos.pos_y !== d.origY) && !checkOverlap(pos.pos_x, pos.pos_y, d.mesa.ancho ?? 3, d.mesa.alto ?? 2, d.mesa.id)) {
        onMoveMesa?.(d.mesa.id, pos);
      }
      // Clear tempPos after a short delay to let optimistic update propagate
      setTimeout(() => setTempPos(prev => { const n = { ...prev }; delete n[d.mesa.id]; return n; }), 50);
      forceRender(n => n + 1);
    }
    if (resizingRef.current) {
      const r = resizingRef.current;
      const pos = tempPos[r.mesa.id];
      resizingRef.current = null;
      if (pos && !checkOverlap(r.mesa.pos_x ?? 0, r.mesa.pos_y ?? 0, pos.ancho, pos.alto, r.mesa.id)) onResizeMesa?.(r.mesa.id, pos);
      setTimeout(() => setTempPos(prev => { const n = { ...prev }; delete n[r.mesa.id]; return n; }), 50);
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
      if (!isEditing || !selectedId) return;
      // Don't intercept when typing in inputs
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onDeleteMesa?.(selectedId);
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isEditing, selectedId, onDeleteMesa]);

  const drawing = drawingRef.current;
  const drawRect = drawing ? (() => {
    const x = Math.min(drawing.startCol, drawing.endCol - 1), y = Math.min(drawing.startRow, drawing.endRow - 1);
    const w = Math.abs(drawing.endCol - drawing.startCol), h = Math.abs(drawing.endRow - drawing.startRow);
    return { x: x * CELL, y: y * CELL, w: w * CELL, h: h * CELL, valid: w >= MIN_SIZE && h >= MIN_SIZE };
  })() : null;

  // Find linked mesa numbers for display
  const getLinkedLabel = (mesa) => {
    if (!mesa.sesion_principal_id && !mesa.sesion_id) return null;
    // This mesa is primary — find secondaries
    if (mesa.sesion_id && !mesa.sesion_principal_id) {
      const linked = mesas.filter(m => m.sesion_principal_id === mesa.sesion_id);
      if (linked.length > 0) return linked.map(m => m.numero).join('+');
    }
    // This mesa is secondary — find primary
    if (mesa.sesion_principal_id) {
      const primary = mesas.find(m => m.sesion_id === mesa.sesion_principal_id);
      if (primary) return String(primary.numero);
    }
    return null;
  };

  // Selected mesa for floating buttons position
  const selectedMesa = isEditing ? mesas.find(m => m.id === selectedId) : null;

  return (
    <div className="relative">
      {/* Toolbar */}
      <div className="absolute top-3 right-3 z-30 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-lg border border-stone-200 p-1 shadow-sm">
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
        style={{ height: 'calc(100vh - 240px)', minHeight: '400px' }}
        onWheel={handleWheel}
      >
        <div style={{ width: CANVAS_W * zoom, height: CANVAS_H * zoom, position: 'relative' }}>
          {/* Scaled canvas */}
          <div style={{
            transform: `scale(${zoom})`, transformOrigin: '0 0',
            width: CANVAS_W, height: CANVAS_H, position: 'absolute', top: 0, left: 0,
            backgroundImage: isEditing
              ? `linear-gradient(to right, rgba(214,211,209,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(214,211,209,0.12) 1px, transparent 1px)`
              : 'none',
            backgroundSize: `${CELL}px ${CELL}px`,
          }}>
            {/* Connection lines between united mesas */}
            <svg style={{ position: 'absolute', inset: 0, width: CANVAS_W, height: CANVAS_H, pointerEvents: 'none', zIndex: 1 }}>
              {mesas.filter(m => m.sesion_principal_id).map(secondary => {
                const primary = mesas.find(m => m.sesion_id === secondary.sesion_principal_id);
                if (!primary) return null;
                const sx = (secondary.pos_x ?? 0) * CELL + ((secondary.ancho ?? 3) * CELL) / 2;
                const sy = (secondary.pos_y ?? 0) * CELL + ((secondary.alto ?? 2) * CELL) / 2;
                const px = (primary.pos_x ?? 0) * CELL + ((primary.ancho ?? 3) * CELL) / 2;
                const py = (primary.pos_y ?? 0) * CELL + ((primary.alto ?? 2) * CELL) / 2;
                return (
                  <g key={`link-${secondary.id}`}>
                    <line x1={px} y1={py} x2={sx} y2={sy} stroke="#f59e0b" strokeWidth="3" strokeDasharray="6 4" opacity="0.7" />
                    <circle cx={(px + sx) / 2} cy={(py + sy) / 2} r="6" fill="#f59e0b" />
                    <circle cx={(px + sx) / 2} cy={(py + sy) / 2} r="3" fill="white" />
                  </g>
                );
              })}
            </svg>

            {mesas.map(mesa => {
              const tp = tempPos[mesa.id];
              const px = (tp?.pos_x ?? mesa.pos_x ?? 0) * CELL;
              const py = (tp?.pos_y ?? mesa.pos_y ?? 0) * CELL;
              const pw = (tp?.ancho ?? mesa.ancho ?? 3) * CELL;
              const ph = (tp?.alto ?? mesa.alto ?? 2) * CELL;
              const hasItems = parseInt(mesa.items_count) > 0;
              const ocupada = !!mesa.sesion_id && hasItems;
              const isSelected = selectedId === mesa.id;
              const isMultiSelected = multiSelect && selectedMesaIds.includes(mesa.id);
              const isDimmed = highlightIds && !highlightIds.includes(mesa.id);
              const isLinked = !!mesa.sesion_principal_id;
              const linkedLabel = getLinkedLabel(mesa);
              const isDragging = draggingRef.current?.mesa?.id === mesa.id;

              return (
                <motion.div
                  key={mesa.id}
                  layout={!isDragging && !resizingRef.current}
                  transition={{ type: 'spring', stiffness: 500, damping: 35, duration: 0.15 }}
                  style={{ position: 'absolute', left: px, top: py, width: pw, height: ph, opacity: isDimmed ? 0.25 : 1 }}
                  className={`rounded-xl flex flex-col items-center justify-center text-center select-none transition-all duration-150 overflow-visible ${
                    multiSelect
                      ? isMultiSelected
                        ? 'bg-violet-50 border-2 border-violet-500 shadow-md'
                        : (mesa.sesion_id ? 'bg-stone-100 border-2 border-stone-200 opacity-40' : 'bg-white border-2 border-stone-200 hover:border-violet-300')
                      : isEditing
                        ? isSelected
                          ? 'bg-sky-50 border-2 border-sky-500 shadow-md'
                          : 'bg-white border-2 border-stone-200 hover:border-stone-300'
                        : ocupada
                          ? 'bg-emerald-50 border-2 border-emerald-400'
                          : 'bg-white border-2 border-stone-200 hover:border-stone-300 hover:shadow-sm'
                  } ${isDragging ? 'opacity-80 shadow-lg' : ''}`}
                >
                  {/* Number */}
                  <span className={`font-bold leading-none ${pw < CELL * 3 ? 'text-sm' : 'text-xl'} ${
                    multiSelect ? (isMultiSelected ? 'text-violet-700' : 'text-stone-400')
                    : isEditing ? (isSelected ? 'text-sky-700' : 'text-stone-500')
                    : ocupada ? 'text-emerald-700' : 'text-stone-400'
                  }`}>
                    {mesa.numero}
                  </span>

                  {/* Capacity */}
                  {ph >= CELL * 2 && (
                    <div className="flex items-center gap-0.5 mt-0.5">
                      <Users size={8} className="text-stone-300" />
                      <span className="text-[9px] text-stone-400">{mesa.capacidad ?? 4}</span>
                    </div>
                  )}

                  {/* View: timer & total */}
                  {!isEditing && !multiSelect && ocupada && !isLinked && ph >= CELL * 3 && (
                    <>
                      <div className="flex items-center gap-0.5 mt-0.5">
                        <Clock size={8} className="text-emerald-500" />
                        <span className="text-[9px] font-medium text-emerald-600">{formatTimer(mesa.abierta_at)}</span>
                      </div>
                      {parseFloat(mesa.total_parcial) > 0 && pw >= CELL * 3 && (
                        <span className="text-[10px] font-bold text-emerald-700">{formatCurrency(mesa.total_parcial)}</span>
                      )}
                    </>
                  )}

                  {/* Linked badge — small indicator, line does the heavy lifting */}
                  {!isEditing && linkedLabel && (
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-10 bg-amber-500 text-white px-1.5 py-0.5 rounded-full shadow-sm">
                      <Link2 size={10} />
                    </div>
                  )}

                  {/* Multi-select checkmark */}
                  {multiSelect && isMultiSelected && (
                    <span className="absolute -top-2 -right-2 bg-violet-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm">✓</span>
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

          {/* Floating action buttons ABOVE overlay for selected mesa in edit mode */}
          {isEditing && selectedMesa && (
            <div
              style={{
                position: 'absolute',
                left: (selectedMesa.pos_x ?? 0) * CELL * zoom - 8,
                top: (selectedMesa.pos_y ?? 0) * CELL * zoom - 12,
                zIndex: 20,
                pointerEvents: 'auto',
              }}
            >
              <div className="flex gap-1">
                <button
                  onClick={() => onDuplicar?.(selectedMesa.id)}
                  className="w-7 h-7 bg-sky-500 hover:bg-sky-600 text-white rounded-full flex items-center justify-center shadow transition-colors"
                  title="Duplicar"
                >
                  <Copy size={12} />
                </button>
                <button
                  onClick={() => { onDeleteMesa?.(selectedMesa.id); setSelectedId(null); }}
                  className="w-7 h-7 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center shadow transition-colors"
                  title="Eliminar"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {isEditing && (
        <p className="text-[10px] text-stone-400 mt-2 text-center">
          Arrastra para crear · Click para seleccionar · Ctrl+Scroll para zoom
        </p>
      )}
    </div>
  );
}
