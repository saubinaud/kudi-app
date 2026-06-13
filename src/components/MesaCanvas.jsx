import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { formatCurrency } from '../utils/format';
import { Clock, ZoomIn, ZoomOut, Maximize2, Trash2 } from 'lucide-react';
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
  onMesaClick,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [selectedId, setSelectedId] = useState(null);

  // Drawing state
  const [drawing, setDrawing] = useState(null);
  // Dragging state
  const [dragging, setDragging] = useState(null);
  // Resizing state
  const [resizing, setResizing] = useState(null);
  // Temp positions during drag/resize
  const [tempPos, setTempPos] = useState({});

  // Timer refresh
  const [, setTick] = useState(0);
  useEffect(() => {
    if (isEditing) return;
    const iv = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(iv);
  }, [isEditing]);

  // Convert screen coords to grid cell
  const screenToGrid = useCallback((clientX, clientY) => {
    const container = containerRef.current;
    if (!container) return { col: 0, row: 0 };
    const rect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft;
    const scrollTop = container.scrollTop;
    const x = (clientX - rect.left + scrollLeft) / zoom;
    const y = (clientY - rect.top + scrollTop) / zoom;
    return {
      col: Math.max(0, Math.min(COLS - 1, Math.floor(x / CELL))),
      row: Math.max(0, Math.min(ROWS - 1, Math.floor(y / CELL))),
    };
  }, [zoom]);

  // Check if a cell overlaps any existing mesa (exclude one by id)
  const overlaps = useCallback((x, y, w, h, excludeId) => {
    return mesas.some(m => {
      if (m.id === excludeId) return false;
      const mx = tempPos[m.id]?.pos_x ?? m.pos_x ?? 0;
      const my = tempPos[m.id]?.pos_y ?? m.pos_y ?? 0;
      const mw = tempPos[m.id]?.ancho ?? m.ancho ?? 3;
      const mh = tempPos[m.id]?.alto ?? m.alto ?? 2;
      return x < mx + mw && x + w > mx && y < my + mh && y + h > my;
    });
  }, [mesas, tempPos]);

  // Find mesa at grid position
  const mesaAtGrid = useCallback((col, row) => {
    return mesas.find(m => {
      const x = m.pos_x ?? 0, y = m.pos_y ?? 0;
      const w = m.ancho ?? 3, h = m.alto ?? 2;
      return col >= x && col < x + w && row >= y && row < y + h;
    });
  }, [mesas]);

  // Pointer handlers
  const handlePointerDown = (e) => {
    if (e.button !== 0) return; // left click only
    e.preventDefault();
    const { col, row } = screenToGrid(e.clientX, e.clientY);

    if (isEditing) {
      const mesa = mesaAtGrid(col, row);
      if (mesa) {
        // Check if clicking on resize handle (bottom-right 1x1 corner)
        const mx = mesa.pos_x ?? 0, my = mesa.pos_y ?? 0;
        const mw = mesa.ancho ?? 3, mh = mesa.alto ?? 2;
        if (col === mx + mw - 1 && row === my + mh - 1 && mw >= MIN_SIZE && mh >= MIN_SIZE) {
          setResizing({ mesa, startCol: col, startRow: row, origW: mw, origH: mh });
          setSelectedId(mesa.id);
          return;
        }
        // Start dragging existing mesa
        setDragging({
          mesa,
          startCol: col,
          startRow: row,
          origX: mx,
          origY: my,
        });
        setSelectedId(mesa.id);
        return;
      }
      // Start drawing new mesa
      setDrawing({ startCol: col, startRow: row, endCol: col + 1, endRow: row + 1 });
      setSelectedId(null);
      return;
    }

    // View mode: click mesa to open
    const mesa = mesaAtGrid(col, row);
    if (mesa) onMesaClick?.(mesa);
  };

  const handlePointerMove = (e) => {
    if (!isEditing) return;
    const { col, row } = screenToGrid(e.clientX, e.clientY);

    if (drawing) {
      setDrawing(prev => ({
        ...prev,
        endCol: Math.max(prev.startCol + 1, Math.min(COLS, col + 1)),
        endRow: Math.max(prev.startRow + 1, Math.min(ROWS, row + 1)),
      }));
    }

    if (dragging) {
      const dx = col - dragging.startCol;
      const dy = row - dragging.startRow;
      const newX = Math.max(0, Math.min(COLS - (dragging.mesa.ancho ?? 3), dragging.origX + dx));
      const newY = Math.max(0, Math.min(ROWS - (dragging.mesa.alto ?? 2), dragging.origY + dy));
      setTempPos(prev => ({
        ...prev,
        [dragging.mesa.id]: { pos_x: newX, pos_y: newY },
      }));
    }

    if (resizing) {
      const dw = col - resizing.startCol;
      const dh = row - resizing.startRow;
      const newW = Math.max(MIN_SIZE, Math.min(COLS - (resizing.mesa.pos_x ?? 0), resizing.origW + dw));
      const newH = Math.max(MIN_SIZE, Math.min(ROWS - (resizing.mesa.pos_y ?? 0), resizing.origH + dh));
      setTempPos(prev => ({
        ...prev,
        [resizing.mesa.id]: { ancho: newW, alto: newH },
      }));
    }
  };

  const handlePointerUp = () => {
    if (drawing) {
      const x = Math.min(drawing.startCol, drawing.endCol - 1);
      const y = Math.min(drawing.startRow, drawing.endRow - 1);
      const w = Math.abs(drawing.endCol - drawing.startCol);
      const h = Math.abs(drawing.endRow - drawing.startRow);
      if (w >= MIN_SIZE && h >= MIN_SIZE && !overlaps(x, y, w, h, null)) {
        onCreateMesa?.({ pos_x: x, pos_y: y, ancho: w, alto: h });
      }
      setDrawing(null);
    }

    if (dragging) {
      const pos = tempPos[dragging.mesa.id];
      if (pos && (pos.pos_x !== (dragging.mesa.pos_x ?? 0) || pos.pos_y !== (dragging.mesa.pos_y ?? 0))) {
        if (!overlaps(pos.pos_x, pos.pos_y, dragging.mesa.ancho ?? 3, dragging.mesa.alto ?? 2, dragging.mesa.id)) {
          onMoveMesa?.(dragging.mesa.id, pos);
        }
      }
      setDragging(null);
      setTempPos({});
    }

    if (resizing) {
      const pos = tempPos[resizing.mesa.id];
      if (pos) {
        if (!overlaps(resizing.mesa.pos_x ?? 0, resizing.mesa.pos_y ?? 0, pos.ancho, pos.alto, resizing.mesa.id)) {
          onResizeMesa?.(resizing.mesa.id, pos);
        }
      }
      setResizing(null);
      setTempPos({});
    }
  };

  // Zoom controls
  const zoomIn = () => setZoom(z => Math.min(2, Math.round((z + 0.2) * 10) / 10));
  const zoomOut = () => setZoom(z => Math.max(0.4, Math.round((z - 0.2) * 10) / 10));
  const zoomFit = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const zx = (rect.width - 16) / CANVAS_W;
    const zy = (rect.height - 16) / CANVAS_H;
    setZoom(Math.round(Math.min(zx, zy, 1.5) * 10) / 10);
  };

  // Wheel zoom
  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(z => Math.min(2, Math.max(0.4, Math.round((z + delta) * 10) / 10)));
    }
  };

  // Keyboard: delete selected mesa
  useEffect(() => {
    const handleKey = (e) => {
      if (!isEditing || !selectedId) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onDeleteMesa?.(selectedId);
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isEditing, selectedId, onDeleteMesa]);

  // Drawing preview rect
  const drawRect = drawing ? (() => {
    const x = Math.min(drawing.startCol, drawing.endCol - 1);
    const y = Math.min(drawing.startRow, drawing.endRow - 1);
    const w = Math.abs(drawing.endCol - drawing.startCol);
    const h = Math.abs(drawing.endRow - drawing.startRow);
    const valid = w >= MIN_SIZE && h >= MIN_SIZE;
    return { x: x * CELL, y: y * CELL, w: w * CELL, h: h * CELL, valid };
  })() : null;

  return (
    <div className="relative">
      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-lg border border-stone-200 p-1 shadow-sm">
        <button onClick={zoomOut} className={cx.btnIcon + ' !p-1.5'} title="Alejar"><ZoomOut size={16} /></button>
        <span className="text-[10px] font-mono text-stone-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={zoomIn} className={cx.btnIcon + ' !p-1.5'} title="Acercar"><ZoomIn size={16} /></button>
        <button onClick={zoomFit} className={cx.btnIcon + ' !p-1.5'} title="Ajustar"><Maximize2 size={16} /></button>
      </div>

      {/* Delete button for selected mesa */}
      {isEditing && selectedId && (
        <div className="absolute top-3 left-3 z-20">
          <button
            onClick={() => { onDeleteMesa?.(selectedId); setSelectedId(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 text-xs font-medium rounded-lg border border-rose-200 hover:bg-rose-100 transition-colors"
          >
            <Trash2 size={14} /> Eliminar mesa {mesas.find(m => m.id === selectedId)?.numero}
          </button>
        </div>
      )}

      {/* Canvas container */}
      <div
        ref={containerRef}
        className="overflow-auto rounded-xl border border-stone-200 bg-stone-50"
        style={{ height: 'calc(100vh - 220px)', minHeight: '400px' }}
        onWheel={handleWheel}
      >
        {/* Outer wrapper (defines scrollable area based on zoom) */}
        <div style={{ width: CANVAS_W * zoom, height: CANVAS_H * zoom, position: 'relative' }}>
          {/* Scaled canvas */}
          <div
            ref={canvasRef}
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: '0 0',
              width: CANVAS_W,
              height: CANVAS_H,
              position: 'absolute',
              top: 0,
              left: 0,
              backgroundImage: isEditing
                ? `linear-gradient(to right, rgba(214,211,209,0.4) 1px, transparent 1px), linear-gradient(to bottom, rgba(214,211,209,0.4) 1px, transparent 1px)`
                : 'none',
              backgroundSize: `${CELL}px ${CELL}px`,
            }}
          >
            {/* Rendered mesas */}
            {mesas.map(mesa => {
              const tp = tempPos[mesa.id];
              const px = (tp?.pos_x ?? mesa.pos_x ?? 0) * CELL;
              const py = (tp?.pos_y ?? mesa.pos_y ?? 0) * CELL;
              const pw = (tp?.ancho ?? mesa.ancho ?? 3) * CELL;
              const ph = (tp?.alto ?? mesa.alto ?? 2) * CELL;
              const ocupada = !!mesa.sesion_id;
              const isSelected = selectedId === mesa.id;
              const isDraggingThis = dragging?.mesa?.id === mesa.id;
              const isResizingThis = resizing?.mesa?.id === mesa.id;

              return (
                <motion.div
                  key={mesa.id}
                  layout={!isDraggingThis && !isResizingThis}
                  transition={{ type: 'spring', stiffness: 500, damping: 35, duration: 0.15 }}
                  style={{
                    position: 'absolute',
                    left: px,
                    top: py,
                    width: pw,
                    height: ph,
                  }}
                  className={`rounded-xl flex flex-col items-center justify-center text-center select-none transition-colors duration-100 ${
                    isEditing
                      ? isSelected
                        ? 'bg-sky-50 border-2 border-sky-500 shadow-md'
                        : 'bg-white border-2 border-stone-300 hover:border-stone-400'
                      : ocupada
                        ? 'bg-emerald-50 border-2 border-emerald-400 shadow-sm'
                        : 'bg-white border-2 border-stone-200 hover:border-stone-400 hover:shadow-sm'
                  } ${isEditing ? 'cursor-grab' : 'cursor-pointer'} ${isDraggingThis ? 'cursor-grabbing opacity-80 shadow-lg' : ''}`}
                >
                  <span className={`font-bold leading-none ${
                    pw < CELL * 3 ? 'text-sm' : 'text-xl'
                  } ${
                    isEditing
                      ? isSelected ? 'text-sky-700' : 'text-stone-600'
                      : ocupada ? 'text-emerald-700' : 'text-stone-400'
                  }`}>
                    {mesa.numero}
                  </span>

                  {/* View mode: status info */}
                  {!isEditing && ocupada && ph >= CELL * 2.5 && (
                    <>
                      <div className="flex items-center gap-0.5 mt-0.5">
                        <Clock size={10} className="text-emerald-500" />
                        <span className="text-[10px] font-medium text-emerald-600">{formatTimer(mesa.abierta_at)}</span>
                      </div>
                      {parseFloat(mesa.total_parcial) > 0 && pw >= CELL * 3 && (
                        <span className="text-[11px] font-bold text-emerald-700 mt-0.5">
                          {formatCurrency(mesa.total_parcial)}
                        </span>
                      )}
                    </>
                  )}

                  {/* Items badge */}
                  {!isEditing && ocupada && parseInt(mesa.items_count) > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                      {mesa.items_count}
                    </span>
                  )}

                  {/* Resize handle (edit mode, selected) */}
                  {isEditing && isSelected && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-sky-500 rounded-tl-md rounded-br-[10px] cursor-se-resize" />
                  )}
                </motion.div>
              );
            })}

            {/* Drawing preview */}
            {drawRect && (
              <div
                style={{
                  position: 'absolute',
                  left: drawRect.x,
                  top: drawRect.y,
                  width: drawRect.w,
                  height: drawRect.h,
                }}
                className={`rounded-xl border-2 border-dashed ${
                  drawRect.valid
                    ? 'border-emerald-400 bg-emerald-50/50'
                    : 'border-rose-300 bg-rose-50/30'
                } pointer-events-none`}
              />
            )}
          </div>

          {/* Interaction overlay (captures all pointer events, unscaled coordinates) */}
          <div
            style={{ position: 'absolute', inset: 0, zIndex: 10 }}
            className={isEditing ? 'cursor-crosshair' : ''}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
        </div>
      </div>

      {/* Edit mode hint */}
      {isEditing && (
        <p className="text-[10px] text-stone-400 mt-2 text-center">
          Arrastra para crear mesas · Click para seleccionar · Ctrl+Scroll para zoom
        </p>
      )}
    </div>
  );
}
