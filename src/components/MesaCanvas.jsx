import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { formatCurrency } from '../utils/format';
import { Clock, ZoomIn, ZoomOut, Maximize2, Trash2, Equal, Users, Copy } from 'lucide-react';
import { cx } from '../styles/tokens';

const CELL = 24;
const COLS = 120;
const ROWS = 80;
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
  mesas, isEditing,
  onCreateMesa, onMoveMesa, onResizeMesa, onDeleteMesa, onDuplicar,
  onUpdateCapacidad, onUpdateRedondeo, onUniformar,
  onMesaClick, onSelectMesa,
  multiSelect = false, selectedMesaIds = [], onToggleSelect,
  highlightIds = null,
}) {
  const containerRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [selectedId, setSelectedId] = useState(null);

  const drawingRef = useRef(null);
  const draggingRef = useRef(null);
  const resizingRef = useRef(null);
  const roundingRef = useRef(null);
  const [, forceRender] = useState(0);
  const [tempPos, setTempPos] = useState({});
  const [tempRedondeo, setTempRedondeo] = useState({});

  const [, setTick] = useState(0);
  useEffect(() => { if (!isEditing) { const iv = setInterval(() => setTick(t => t + 1), 30000); return () => clearInterval(iv); } }, [isEditing]);

  // Auto-fit on mount
  const didAutoFit = useRef(false);
  useEffect(() => {
    if (didAutoFit.current || !containerRef.current || mesas.length === 0) return;
    didAutoFit.current = true;
    let maxX = 0, maxY = 0;
    for (const m of mesas) { maxX = Math.max(maxX, (m.pos_x ?? 0) + (m.ancho ?? 3)); maxY = Math.max(maxY, (m.pos_y ?? 0) + (m.alto ?? 2)); }
    if (maxX === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    setZoom(Math.round(Math.max(0.4, Math.min(rect.width / ((maxX + 2) * CELL), rect.height / ((maxY + 2) * CELL), 1.5)) * 10) / 10);
  }, [mesas.length]); // eslint-disable-line

  const screenToGrid = useCallback((clientX, clientY) => {
    const c = containerRef.current;
    if (!c) return { col: 0, row: 0 };
    const r = c.getBoundingClientRect();
    return {
      col: Math.max(0, Math.min(COLS - 1, Math.floor((clientX - r.left + c.scrollLeft) / zoom / CELL))),
      row: Math.max(0, Math.min(ROWS - 1, Math.floor((clientY - r.top + c.scrollTop) / zoom / CELL))),
    };
  }, [zoom]);

  const mesaAtGrid = useCallback((col, row) => mesas.find(m => {
    const x = m.pos_x ?? 0, y = m.pos_y ?? 0, w = m.ancho ?? 3, h = m.alto ?? 2;
    return col >= x && col < x + w && row >= y && row < y + h;
  }), [mesas]);

  const checkOverlap = useCallback((x, y, w, h, excludeId = null) => mesas.some(m => {
    if (m.id === excludeId) return false;
    const mx = m.pos_x ?? 0, my = m.pos_y ?? 0, mw = m.ancho ?? 3, mh = m.alto ?? 2;
    return x < mx + mw && x + w > mx && y < my + mh && y + h > my;
  }), [mesas]);

  useEffect(() => { onSelectMesa?.(selectedId); }, [selectedId]); // eslint-disable-line

  // Pointer handlers
  const handlePointerDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.target.setPointerCapture(e.pointerId);
    const { col, row } = screenToGrid(e.clientX, e.clientY);

    if (multiSelect) { const m = mesaAtGrid(col, row); if (m) onToggleSelect?.(m.id); return; }

    if (isEditing) {
      const mesa = mesaAtGrid(col, row);
      if (mesa) {
        const mx = mesa.pos_x ?? 0, my = mesa.pos_y ?? 0, mw = mesa.ancho ?? 3, mh = mesa.alto ?? 2;
        if (col === mx + mw - 1 && row === my + mh - 1) {
          resizingRef.current = { mesa, startCol: col, startRow: row, origW: mw, origH: mh };
          setSelectedId(mesa.id); forceRender(n => n + 1); return;
        }
        draggingRef.current = { mesa, startCol: col, startRow: row, origX: mx, origY: my };
        setSelectedId(mesa.id); forceRender(n => n + 1); return;
      }
      drawingRef.current = { startCol: col, startRow: row, endCol: col + 1, endRow: row + 1 };
      setSelectedId(null); forceRender(n => n + 1); return;
    }

    const mesa = mesaAtGrid(col, row);
    if (mesa) onMesaClick?.(mesa);
  };

  const handlePointerMove = (e) => {
    if (!isEditing || multiSelect) return;
    const { col, row } = screenToGrid(e.clientX, e.clientY);
    if (drawingRef.current) {
      drawingRef.current = { ...drawingRef.current,
        endCol: Math.max(drawingRef.current.startCol + 1, Math.min(COLS, col + 1)),
        endRow: Math.max(drawingRef.current.startRow + 1, Math.min(ROWS, row + 1)),
      };
      forceRender(n => n + 1);
    }
    if (draggingRef.current) {
      const d = draggingRef.current;
      setTempPos(prev => ({ ...prev, [d.mesa.id]: {
        pos_x: Math.max(0, Math.min(COLS - (d.mesa.ancho ?? 3), d.origX + col - d.startCol)),
        pos_y: Math.max(0, Math.min(ROWS - (d.mesa.alto ?? 2), d.origY + row - d.startRow)),
      }}));
    }
    if (resizingRef.current) {
      const r = resizingRef.current;
      let newW = Math.max(MIN_SIZE, Math.min(COLS - (r.mesa.pos_x ?? 0), r.origW + col - r.startCol));
      let newH = Math.max(MIN_SIZE, Math.min(ROWS - (r.mesa.pos_y ?? 0), r.origH + row - r.startRow));
      // Circular mesa = force square (use larger dimension)
      const red = tempRedondeo[r.mesa.id] ?? r.mesa.redondeo ?? 15;
      if (red >= 45) { const size = Math.max(newW, newH); newW = size; newH = size; }
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
      if (w >= MIN_SIZE && h >= MIN_SIZE && !checkOverlap(x, y, w, h)) onCreateMesa?.({ pos_x: x, pos_y: y, ancho: w, alto: h });
      forceRender(n => n + 1);
    }
    if (draggingRef.current) {
      const d = draggingRef.current;
      const pos = tempPos[d.mesa.id];
      draggingRef.current = null;
      if (pos && (pos.pos_x !== d.origX || pos.pos_y !== d.origY) && !checkOverlap(pos.pos_x, pos.pos_y, d.mesa.ancho ?? 3, d.mesa.alto ?? 2, d.mesa.id))
        onMoveMesa?.(d.mesa.id, pos);
      setTimeout(() => setTempPos(prev => { const n = { ...prev }; delete n[d.mesa.id]; return n; }), 50);
      forceRender(n => n + 1);
    }
    if (resizingRef.current) {
      const r = resizingRef.current;
      const pos = tempPos[r.mesa.id];
      resizingRef.current = null;
      if (pos && !checkOverlap(r.mesa.pos_x ?? 0, r.mesa.pos_y ?? 0, pos.ancho, pos.alto, r.mesa.id))
        onResizeMesa?.(r.mesa.id, pos);
      setTimeout(() => setTempPos(prev => { const n = { ...prev }; delete n[r.mesa.id]; return n; }), 50);
      forceRender(n => n + 1);
    }
  };

  // Rounding handle drag (separate from overlay — rendered above it)
  const handleRoundStart = (e, mesa) => {
    e.stopPropagation();
    e.preventDefault();
    e.target.setPointerCapture(e.pointerId);
    const rect = containerRef.current.getBoundingClientRect();
    roundingRef.current = {
      mesa,
      startX: e.clientX,
      startY: e.clientY,
      origRedondeo: tempRedondeo[mesa.id] ?? mesa.redondeo ?? 15,
      maxRadius: Math.min((mesa.ancho ?? 3) * CELL, (mesa.alto ?? 2) * CELL) / 2,
    };
  };
  const handleRoundMove = (e) => {
    if (!roundingRef.current) return;
    const r = roundingRef.current;
    // Diagonal drag distance (inward = positive = more rounding)
    const dx = e.clientX - r.startX;
    const dy = e.clientY - r.startY;
    const dist = (dx + dy) / 2 / zoom; // average diagonal movement
    const pxChange = dist;
    const pctChange = (pxChange / r.maxRadius) * 50;
    const newRedondeo = Math.max(0, Math.min(50, Math.round(r.origRedondeo + pctChange)));
    setTempRedondeo(prev => ({ ...prev, [r.mesa.id]: newRedondeo }));
  };
  const handleRoundEnd = (e) => {
    if (!roundingRef.current) return;
    e.target.releasePointerCapture?.(e.pointerId);
    const r = roundingRef.current;
    const val = tempRedondeo[r.mesa.id];
    roundingRef.current = null;
    if (val !== undefined && val !== (r.mesa.redondeo ?? 15)) {
      onUpdateRedondeo?.(r.mesa.id, val);
    }
  };

  // Zoom
  const zoomIn = () => setZoom(z => Math.min(2, Math.round((z + 0.2) * 10) / 10));
  const zoomOut = () => setZoom(z => Math.max(0.3, Math.round((z - 0.2) * 10) / 10));
  const zoomFit = () => {
    if (!containerRef.current) return;
    let maxX = 0, maxY = 0;
    for (const m of mesas) { maxX = Math.max(maxX, (m.pos_x ?? 0) + (m.ancho ?? 3)); maxY = Math.max(maxY, (m.pos_y ?? 0) + (m.alto ?? 2)); }
    if (maxX === 0) { setZoom(1); return; }
    const rect = containerRef.current.getBoundingClientRect();
    setZoom(Math.round(Math.max(0.3, Math.min(rect.width / ((maxX + 2) * CELL), rect.height / ((maxY + 2) * CELL), 1.5)) * 10) / 10);
  };
  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom(z => Math.min(2, Math.max(0.3, Math.round((z + (e.deltaY > 0 ? -0.1 : 0.1)) * 10) / 10)));
    }
  };

  // Keyboard
  useEffect(() => {
    const h = (e) => {
      if (!isEditing || !selectedId) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onDeleteMesa?.(selectedId); setSelectedId(null); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isEditing, selectedId, onDeleteMesa]);

  // Linked mesas: find partner numbers
  const getLinkedLabel = (mesa) => {
    if (mesa.sesion_id && !mesa.sesion_principal_id) {
      const linked = mesas.filter(m => m.sesion_principal_id === mesa.sesion_id);
      if (linked.length > 0) return linked.map(m => m.numero).join(', ');
    }
    if (mesa.sesion_principal_id) {
      const primary = mesas.find(m => m.sesion_id === mesa.sesion_principal_id);
      if (primary) return String(primary.numero);
    }
    return null;
  };

  const drawing = drawingRef.current;
  const drawRect = drawing ? (() => {
    const x = Math.min(drawing.startCol, drawing.endCol - 1), y = Math.min(drawing.startRow, drawing.endRow - 1);
    const w = Math.abs(drawing.endCol - drawing.startCol), h = Math.abs(drawing.endRow - drawing.startRow);
    return { x: x * CELL, y: y * CELL, w: w * CELL, h: h * CELL, valid: w >= MIN_SIZE && h >= MIN_SIZE };
  })() : null;

  const selectedMesa = isEditing ? mesas.find(m => m.id === selectedId) : null;

  return (
    <div className="relative">
      {/* Toolbar */}
      <div className="absolute top-3 right-3 z-30 flex items-center gap-1 bg-white/95 backdrop-blur rounded-xl border border-stone-200/80 px-1.5 py-1 shadow-sm">
        {isEditing && mesas.length > 1 && (
          <><button onClick={() => onUniformar?.()} className={cx.btnIcon + ' !p-1.5'} title="Igualar tamaño"><Equal size={16} /></button><div className="w-px h-4 bg-stone-200" /></>
        )}
        <button onClick={zoomOut} className={cx.btnIcon + ' !p-1.5'}><ZoomOut size={16} /></button>
        <span className="text-[10px] font-mono text-stone-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={zoomIn} className={cx.btnIcon + ' !p-1.5'}><ZoomIn size={16} /></button>
        <button onClick={zoomFit} className={cx.btnIcon + ' !p-1.5'}><Maximize2 size={16} /></button>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="overflow-auto rounded-2xl border border-stone-200/80 bg-[#F8F8F6]"
        style={{ height: 'calc(100vh - 240px)', minHeight: '400px' }}
        onWheel={handleWheel}
      >
        <div style={{ width: CANVAS_W * zoom, height: CANVAS_H * zoom, position: 'relative' }}>
          <div style={{
            transform: `scale(${zoom})`, transformOrigin: '0 0',
            width: CANVAS_W, height: CANVAS_H, position: 'absolute', top: 0, left: 0,
            backgroundImage: isEditing
              ? `radial-gradient(circle, rgba(168,162,158,0.25) 1px, transparent 1px)`
              : `radial-gradient(circle, rgba(168,162,158,0.08) 1px, transparent 1px)`,
            backgroundSize: `${CELL}px ${CELL}px`,
          }}>
            {/* Link lines between united mesas */}
            <svg style={{ position: 'absolute', inset: 0, width: CANVAS_W, height: CANVAS_H, pointerEvents: 'none', zIndex: 1 }}>
              {mesas.filter(m => m.sesion_principal_id).map(sec => {
                const pri = mesas.find(m => m.sesion_id === sec.sesion_principal_id);
                if (!pri) return null;
                const pL = (pri.pos_x ?? 0) * CELL, pT = (pri.pos_y ?? 0) * CELL, pW = (pri.ancho ?? 3) * CELL, pH = (pri.alto ?? 2) * CELL;
                const sL = (sec.pos_x ?? 0) * CELL, sT = (sec.pos_y ?? 0) * CELL, sW = (sec.ancho ?? 3) * CELL, sH = (sec.alto ?? 2) * CELL;
                const pCx = pL + pW / 2, pCy = pT + pH / 2, sCx = sL + sW / 2, sCy = sT + sH / 2;
                let x1, y1, x2, y2;
                if (Math.abs(pCx - sCx) > Math.abs(pCy - sCy)) {
                  x1 = pCx < sCx ? pL + pW : pL; x2 = pCx < sCx ? sL : sL + sW;
                  const oT = Math.max(pT, sT), oB = Math.min(pT + pH, sT + sH);
                  y1 = y2 = oT < oB ? (oT + oB) / 2 : (pCy + sCy) / 2;
                } else {
                  y1 = pCy < sCy ? pT + pH : pT; y2 = pCy < sCy ? sT : sT + sH;
                  const oL = Math.max(pL, sL), oR = Math.min(pL + pW, sL + sW);
                  x1 = x2 = oL < oR ? (oL + oR) / 2 : (pCx + sCx) / 2;
                }
                return (
                  <g key={`link-${sec.id}`}>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#16A34A" strokeWidth="3" strokeLinecap="round" />
                    <circle cx={x1} cy={y1} r="5" fill="#16A34A" />
                    <circle cx={x2} cy={y2} r="5" fill="#16A34A" />
                    <circle cx={x1} cy={y1} r="2.5" fill="white" />
                    <circle cx={x2} cy={y2} r="2.5" fill="white" />
                  </g>
                );
              })}
            </svg>

            {/* Mesas */}
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
              const isDragging = draggingRef.current?.mesa?.id === mesa.id;
              const redondeo = tempRedondeo[mesa.id] ?? mesa.redondeo ?? 15;
              const borderRadius = `${redondeo}%`;
              const numScale = Math.max(1, 1.3 / zoom);
              const numSize = Math.min(pw * 0.5, ph * 0.45, 30 * numScale);
              const capSize = Math.max(10, 12 * Math.max(1, 1.2 / zoom));

              return (
                <motion.div
                  key={mesa.id}
                  layout={!isDragging && !resizingRef.current}
                  transition={{ type: 'spring', stiffness: 500, damping: 35, duration: 0.15 }}
                  style={{ position: 'absolute', left: px, top: py, width: pw, height: ph, opacity: isDimmed ? 0.25 : 1, borderRadius }}
                  className={`flex flex-col items-center justify-center text-center select-none overflow-visible transition-colors duration-150 ${
                    multiSelect
                      ? isMultiSelected ? 'bg-violet-50 border-2 border-violet-500 shadow-md'
                        : (mesa.sesion_id ? 'bg-stone-100 border-2 border-stone-200 opacity-40' : 'bg-white border border-stone-200 hover:border-violet-300')
                      : isEditing
                        ? isSelected ? 'bg-white border-2 border-[#16A34A] shadow-[0_0_0_3px_rgba(22,163,74,0.1)]'
                          : 'bg-white border border-stone-200 hover:border-stone-300'
                        : ocupada ? 'bg-gradient-to-b from-emerald-50 to-white border-2 border-emerald-500/60 shadow-sm'
                          : 'bg-white border border-stone-200/80 hover:border-stone-300'
                  } ${isDragging ? 'opacity-80 shadow-xl' : ''}`}
                >
                  <span style={{ fontSize: `${numSize}px` }}
                    className={`font-bold leading-none ${
                      multiSelect ? (isMultiSelected ? 'text-violet-700' : 'text-stone-400')
                      : isEditing ? (isSelected ? 'text-[#0A2F24]' : 'text-stone-500')
                      : ocupada ? 'text-[#0A2F24]' : 'text-stone-400'
                    }`}>{mesa.numero}</span>

                  {/* Capacity — clean, no pill */}
                  {ph >= CELL * 2 && (
                    <span style={{ fontSize: `${capSize}px` }}
                      className={`flex items-center gap-0.5 mt-0.5 font-medium ${ocupada ? 'text-emerald-600' : 'text-stone-400'}`}
                    >
                      <Users size={capSize} />{mesa.capacidad ?? 4}
                    </span>
                  )}

                  {/* Timer + total for occupied */}
                  {!isEditing && !multiSelect && ocupada && ph >= CELL * 3 && (
                    <div className="flex items-center gap-1 mt-0.5" style={{ transform: `scale(${Math.max(1, 1.1 / zoom)})`, transformOrigin: 'center' }}>
                      <Clock size={10} className="text-emerald-500" />
                      <span className="text-[10px] font-medium text-emerald-600">{formatTimer(mesa.abierta_at)}</span>
                      {parseFloat(mesa.total_parcial) > 0 && pw >= CELL * 3 && (
                        <span className="text-[10px] font-bold text-emerald-700 ml-1">{formatCurrency(mesa.total_parcial)}</span>
                      )}
                    </div>
                  )}

                  {/* Resize handle — touch-friendly 44px hit area */}
                  {isEditing && isSelected && (
                    <div className="absolute -bottom-3 -right-3 w-11 h-11 flex items-center justify-center cursor-se-resize">
                      <div className="w-4 h-4 bg-[#16A34A] rounded-full border-2 border-white shadow-md" />
                    </div>
                  )}

                  {/* Multi-select checkmark */}
                  {multiSelect && isMultiSelected && (
                    <span className="absolute -top-2 -right-2 bg-violet-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm">✓</span>
                  )}
                </motion.div>
              );
            })}

            {/* Drawing preview */}
            {drawRect && (
              <div style={{ position: 'absolute', left: drawRect.x, top: drawRect.y, width: drawRect.w, height: drawRect.h }}
                className={`rounded-xl border-2 border-dashed pointer-events-none ${drawRect.valid ? 'border-[#16A34A]/60 bg-emerald-50/40' : 'border-rose-300 bg-rose-50/30'}`} />
            )}
          </div>

          {/* Interaction overlay */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, touchAction: 'none' }}
            className={multiSelect ? 'cursor-pointer' : isEditing ? 'cursor-crosshair' : ''}
            onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} />

          {/* Floating: action buttons + rounding handle for selected mesa */}
          {isEditing && selectedMesa && (() => {
            // Use tempPos if being dragged, otherwise DB position
            const tp = tempPos[selectedMesa.id];
            const smx = (tp?.pos_x ?? selectedMesa.pos_x ?? 0) * CELL * zoom;
            const smy = (tp?.pos_y ?? selectedMesa.pos_y ?? 0) * CELL * zoom;
            const smw = (tp?.ancho ?? selectedMesa.ancho ?? 3) * CELL * zoom;
            const smh = (tp?.alto ?? selectedMesa.alto ?? 2) * CELL * zoom;
            const red = tempRedondeo[selectedMesa.id] ?? selectedMesa.redondeo ?? 15;
            const maxR = Math.min(smw, smh) / 2;
            const handleOffset = (red / 50) * maxR * 0.7;

            return (
              <>
                {/* Action buttons — top-right of mesa */}
                <div style={{ position: 'absolute', left: smx + smw - 60, top: smy - 14, zIndex: 25, pointerEvents: 'auto' }}>
                  <div className="flex gap-0.5 bg-white/95 backdrop-blur rounded-lg border border-stone-200/80 p-0.5 shadow-md">
                    <button onClick={() => onDuplicar?.(selectedMesa.id)}
                      className="w-7 h-7 hover:bg-stone-100 text-stone-500 hover:text-[#16A34A] rounded-md flex items-center justify-center transition-colors" title="Duplicar">
                      <Copy size={13} />
                    </button>
                    <button onClick={() => { onDeleteMesa?.(selectedMesa.id); setSelectedId(null); }}
                      className="w-7 h-7 hover:bg-stone-100 text-stone-500 hover:text-rose-500 rounded-md flex items-center justify-center transition-colors" title="Eliminar">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Rounding corner handle — top-left, touch-friendly */}
                <div
                  style={{
                    position: 'absolute',
                    left: smx + handleOffset - 22,
                    top: smy + handleOffset - 22,
                    width: 44, height: 44,
                    zIndex: 25,
                    touchAction: 'none',
                    pointerEvents: 'auto',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  className="cursor-[nw-resize] group"
                  onPointerDown={(e) => handleRoundStart(e, selectedMesa)}
                  onPointerMove={handleRoundMove}
                  onPointerUp={handleRoundEnd}
                  title="Arrastra para redondear esquinas"
                >
                  <div className="w-4 h-4 bg-[#16A34A] rounded-full border-2 border-white shadow-md group-hover:scale-150 group-active:scale-125 transition-transform" />
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {isEditing && (
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 mt-2.5 text-[11px] text-stone-500">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-3 border border-dashed border-[#16A34A]/50 rounded inline-block bg-emerald-50/50" />
            Arrastra para crear
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-[#16A34A] rounded-full inline-block shadow-sm" />
            Redondear esquinas
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-[#16A34A] rounded-full inline-block border-2 border-white shadow-sm" />
            Cambiar tamaño
          </span>
        </div>
      )}
    </div>
  );
}
