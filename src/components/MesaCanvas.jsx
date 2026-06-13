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

// Chair positions around a mesa
function getChairs(mesa, cell) {
  const x = (mesa.pos_x ?? 0) * cell;
  const y = (mesa.pos_y ?? 0) * cell;
  const w = (mesa.ancho ?? 3) * cell;
  const h = (mesa.alto ?? 2) * cell;
  const cap = mesa.capacidad ?? 4;
  const red = mesa.redondeo ?? 15;
  const isCircle = red >= 45;
  const chairGap = 4;
  const chairs = [];

  if (isCircle) {
    const cx = x + w / 2, cy = y + h / 2;
    const radius = w / 2 + 8;
    for (let i = 0; i < cap; i++) {
      const a = (i / cap) * Math.PI * 2 - Math.PI / 2;
      chairs.push({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a), rot: (a * 180 / Math.PI) + 90 });
    }
  } else {
    // Distribute along perimeter proportionally
    const sides = [
      { len: w, dir: 'top' }, { len: h, dir: 'right' },
      { len: w, dir: 'bottom' }, { len: h, dir: 'left' },
    ];
    const perim = 2 * (w + h);
    let counts = sides.map(s => Math.round(cap * s.len / perim));
    let total = counts.reduce((a, b) => a + b, 0);
    // Fix rounding — prefer long sides
    const sorted = [0,1,2,3].sort((a, b) => sides[b].len - sides[a].len);
    while (total < cap) { counts[sorted[total % 4]]++; total++; }
    while (total > cap) {
      for (let i = sorted.length - 1; i >= 0; i--) {
        if (counts[sorted[i]] > 0 && total > cap) { counts[sorted[i]]--; total--; }
      }
    }
    sides.forEach((s, si) => {
      const n = counts[si];
      if (n === 0) return;
      const spacing = s.len / (n + 1);
      for (let i = 0; i < n; i++) {
        const pos = spacing * (i + 1);
        switch (s.dir) {
          case 'top': chairs.push({ x: x + pos, y: y - 8, rot: 180 }); break;
          case 'bottom': chairs.push({ x: x + pos, y: y + h + 8, rot: 0 }); break;
          case 'left': chairs.push({ x: x - 8, y: y + pos, rot: 90 }); break;
          case 'right': chairs.push({ x: x + w + 8, y: y + pos, rot: 270 }); break;
        }
      }
    });
  }
  return chairs;
}

// SVG chair path (U-shape seat facing up = toward table)
const CHAIR_PATH = 'M-5,3 C-5,-2 -3,-4 0,-4 C3,-4 5,-2 5,3';

export default function MesaCanvas({
  mesas, isEditing,
  onCreateMesa, onMoveMesa, onResizeMesa, onDeleteMesa, onDuplicar,
  onUpdateCapacidad, onUpdateRedondeo, onUniformar,
  onMesaClick, onSelectMesa,
  multiSelect = false, selectedMesaIds = [], onToggleSelect,
  highlightIds = null,
}) {
  const containerRef = useRef(null);

  // Edit mode zoom (user-controlled)
  const [editZoom, setEditZoom] = useState(0.8);
  // View mode transform (auto-calculated)
  const [viewTx, setViewTx] = useState({ zoom: 1, ox: 0, oy: 0 });

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

  // === VIEW MODE: auto-fit to content ===
  useEffect(() => {
    if (isEditing || !containerRef.current || mesas.length === 0) return;
    const fit = () => {
      let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
      for (const m of mesas) {
        minX = Math.min(minX, m.pos_x ?? 0);
        minY = Math.min(minY, m.pos_y ?? 0);
        maxX = Math.max(maxX, (m.pos_x ?? 0) + (m.ancho ?? 3));
        maxY = Math.max(maxY, (m.pos_y ?? 0) + (m.alto ?? 2));
      }
      if (maxX === 0) return;
      const pad = 1;
      const cW = (maxX - minX + pad * 2) * CELL;
      const cH = (maxY - minY + pad * 2) * CELL;
      const r = containerRef.current.getBoundingClientRect();
      // Fit to container but cap at a reasonable max so mesas don't get huge
      const z = Math.min(r.width / cW, r.height / cH, 1.5);
      const ox = (r.width - cW * z) / 2 - (minX - pad) * CELL * z;
      const oy = (r.height - cH * z) / 2 - (minY - pad) * CELL * z;
      setViewTx({ zoom: z, ox, oy });
    };
    fit();
    const obs = new ResizeObserver(fit);
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [isEditing, mesas]);

  const activeZoom = isEditing ? editZoom : viewTx.zoom;

  const screenToGrid = useCallback((clientX, clientY) => {
    const c = containerRef.current;
    if (!c) return { col: 0, row: 0 };
    const r = c.getBoundingClientRect();
    const x = isEditing
      ? (clientX - r.left + c.scrollLeft) / editZoom
      : (clientX - r.left - viewTx.ox) / viewTx.zoom;
    const y = isEditing
      ? (clientY - r.top + c.scrollTop) / editZoom
      : (clientY - r.top - viewTx.oy) / viewTx.zoom;
    const col = Math.floor(x / CELL);
    const row = Math.floor(y / CELL);
    // In edit mode: clamp to canvas bounds (for drawing)
    // In view mode: don't clamp (let mesaAtGrid return null for empty areas)
    return isEditing
      ? { col: Math.max(0, Math.min(COLS - 1, col)), row: Math.max(0, Math.min(ROWS - 1, row)) }
      : { col, row };
  }, [editZoom, isEditing, viewTx]);

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

  // === POINTER HANDLERS ===
  const handlePointerDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.target.setPointerCapture(e.pointerId);
    const { col, row } = screenToGrid(e.clientX, e.clientY);

    if (multiSelect) { const m = mesaAtGrid(col, row); if (m) onToggleSelect?.(m.id); return; }

    if (isEditing) {
      const mesa = mesaAtGrid(col, row);
      if (mesa) {
        draggingRef.current = { mesa, startCol: col, startRow: row, origX: mesa.pos_x ?? 0, origY: mesa.pos_y ?? 0 };
        setSelectedId(mesa.id); forceRender(n => n + 1); return;
      }
      drawingRef.current = { startCol: col, startRow: row, endCol: col + 1, endRow: row + 1 };
      setSelectedId(null); forceRender(n => n + 1); return;
    }
    // View mode: just click
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
      const c = containerRef.current;
      const rect = c.getBoundingClientRect();
      const gridX = (e.clientX - rect.left + c.scrollLeft) / editZoom / CELL;
      const gridY = (e.clientY - rect.top + c.scrollTop) / editZoom / CELL;
      let newW = Math.max(MIN_SIZE, Math.round(gridX - (r.mesa.pos_x ?? 0)));
      let newH = Math.max(MIN_SIZE, Math.round(gridY - (r.mesa.pos_y ?? 0)));
      const red = tempRedondeo[r.mesa.id] ?? r.mesa.redondeo ?? 15;
      if (red >= 45) { const s = Math.max(newW, newH); newW = s; newH = s; }
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

  // Floating handle handlers
  const handleResizeStart = (e, mesa) => {
    e.stopPropagation(); e.preventDefault(); e.target.setPointerCapture(e.pointerId);
    resizingRef.current = { mesa, origW: mesa.ancho ?? 3, origH: mesa.alto ?? 2 };
  };
  const handleResizeMove = (e) => { if (resizingRef.current) handlePointerMove(e); };
  const handleResizeEnd = (e) => {
    if (!resizingRef.current) return;
    e.target.releasePointerCapture?.(e.pointerId);
    const r = resizingRef.current; const pos = tempPos[r.mesa.id];
    resizingRef.current = null;
    if (pos && !checkOverlap(r.mesa.pos_x ?? 0, r.mesa.pos_y ?? 0, pos.ancho, pos.alto, r.mesa.id))
      onResizeMesa?.(r.mesa.id, pos);
    setTimeout(() => setTempPos(prev => { const n = { ...prev }; delete n[r.mesa.id]; return n; }), 50);
    forceRender(n => n + 1);
  };

  const handleRoundStart = (e, mesa) => {
    e.stopPropagation(); e.preventDefault(); e.target.setPointerCapture(e.pointerId);
    roundingRef.current = { mesa, startX: e.clientX, startY: e.clientY, origRedondeo: tempRedondeo[mesa.id] ?? mesa.redondeo ?? 15,
      maxRadius: Math.min((mesa.ancho ?? 3) * CELL, (mesa.alto ?? 2) * CELL) / 2 };
  };
  const handleRoundMove = (e) => {
    if (!roundingRef.current) return;
    const r = roundingRef.current;
    const dist = ((e.clientX - r.startX) + (e.clientY - r.startY)) / 2 / activeZoom;
    setTempRedondeo(prev => ({ ...prev, [r.mesa.id]: Math.max(0, Math.min(50, Math.round(r.origRedondeo + (dist / r.maxRadius) * 50))) }));
  };
  const handleRoundEnd = (e) => {
    if (!roundingRef.current) return;
    e.target.releasePointerCapture?.(e.pointerId);
    const r = roundingRef.current; const val = tempRedondeo[r.mesa.id];
    roundingRef.current = null;
    if (val !== undefined && val !== (r.mesa.redondeo ?? 15)) onUpdateRedondeo?.(r.mesa.id, val);
  };

  // Zoom (edit mode only)
  const zoomIn = () => setEditZoom(z => Math.min(2, Math.round((z + 0.15) * 100) / 100));
  const zoomOut = () => setEditZoom(z => Math.max(0.25, Math.round((z - 0.15) * 100) / 100));
  const zoomFit = () => {
    if (!containerRef.current) return;
    let maxX = 0, maxY = 0;
    for (const m of mesas) { maxX = Math.max(maxX, (m.pos_x ?? 0) + (m.ancho ?? 3)); maxY = Math.max(maxY, (m.pos_y ?? 0) + (m.alto ?? 2)); }
    if (maxX === 0) { setEditZoom(0.8); return; }
    const r = containerRef.current.getBoundingClientRect();
    setEditZoom(Math.round(Math.max(0.25, Math.min(r.width / ((maxX + 3) * CELL), r.height / ((maxY + 3) * CELL), 1.5)) * 100) / 100);
  };
  const handleWheel = (e) => { if (!isEditing) return; if (e.ctrlKey || e.metaKey) { e.preventDefault(); setEditZoom(z => Math.min(2, Math.max(0.25, Math.round((z + (e.deltaY > 0 ? -0.08 : 0.08)) * 100) / 100))); } };

  // Keyboard
  useEffect(() => {
    const h = (e) => {
      if (!isEditing || !selectedId) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onDeleteMesa?.(selectedId); setSelectedId(null); }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [isEditing, selectedId, onDeleteMesa]);

  const drawing = drawingRef.current;
  const drawRect = drawing ? (() => {
    const x = Math.min(drawing.startCol, drawing.endCol - 1), y = Math.min(drawing.startRow, drawing.endRow - 1);
    const w = Math.abs(drawing.endCol - drawing.startCol), h = Math.abs(drawing.endRow - drawing.startRow);
    return { x: x * CELL, y: y * CELL, w: w * CELL, h: h * CELL, valid: w >= MIN_SIZE && h >= MIN_SIZE };
  })() : null;

  const selectedMesa = isEditing ? mesas.find(m => m.id === selectedId) : null;

  // === SHARED MESA RENDERER ===
  const renderMesaContent = (mesa, pw, ph, efectiveZoom) => {
    const hasItems = parseInt(mesa.items_count) > 0;
    const ocupada = !!mesa.sesion_id && hasItems;
    const numScale = Math.max(1, 1.3 / efectiveZoom);
    const numSize = Math.min(pw * 0.5, ph * 0.4, 32 * numScale);
    const capSize = Math.max(11, 13 * Math.max(1, 1.2 / efectiveZoom));

    return (
      <>
        <span style={{ fontSize: `${numSize}px` }}
          className={`font-bold leading-none tracking-tight ${
            multiSelect ? (selectedMesaIds.includes(mesa.id) ? 'text-violet-700' : 'text-stone-400')
            : isEditing ? (selectedId === mesa.id ? 'text-[#0A2F24]' : 'text-stone-400')
            : ocupada ? 'text-[#0A2F24]' : 'text-stone-600'
          }`}>{mesa.numero}</span>

        {ph >= CELL * 2 && (
          <span style={{ fontSize: `${capSize}px` }}
            className={`flex items-center gap-0.5 mt-0.5 font-medium ${ocupada && !isEditing ? 'text-emerald-600' : 'text-stone-400'}`}>
            <Users size={capSize * 0.9} />{mesa.capacidad ?? 4}
          </span>
        )}

        {!isEditing && !multiSelect && ocupada && ph >= CELL * 3 && (
          <div className="flex items-center gap-1 mt-1" style={{ transform: `scale(${Math.max(1, 1.1 / efectiveZoom)})`, transformOrigin: 'center' }}>
            <Clock size={10} className="text-emerald-600" />
            <span className="text-[10px] font-medium text-emerald-600">{formatTimer(mesa.abierta_at)}</span>
            {parseFloat(mesa.total_parcial) > 0 && pw >= CELL * 3 && (
              <span className="text-[10px] font-bold text-[#0A2F24] ml-1">{formatCurrency(mesa.total_parcial)}</span>
            )}
          </div>
        )}

        {/* Active indicator dot */}
        {!isEditing && ocupada && (
          <div className="absolute top-1.5 right-1.5">
            <div className="w-2 h-2 bg-[#16A34A] rounded-full" />
            <div className="w-2 h-2 bg-[#16A34A] rounded-full absolute inset-0 animate-ping opacity-40" />
          </div>
        )}

        {multiSelect && selectedMesaIds.includes(mesa.id) && (
          <span className="absolute -top-2 -right-2 bg-violet-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm">&#10003;</span>
        )}

        {isEditing && selectedId === mesa.id && (
          <div className="absolute -bottom-3 -right-3 w-11 h-11 flex items-center justify-center cursor-se-resize">
            <div className="w-4 h-4 bg-[#16A34A] rounded-full border-2 border-white shadow-md" />
          </div>
        )}
      </>
    );
  };

  const getMesaClasses = (mesa) => {
    const hasItems = parseInt(mesa.items_count) > 0;
    const ocupada = !!mesa.sesion_id && hasItems;
    const isSelected = selectedId === mesa.id;
    const isMultiSelected = multiSelect && selectedMesaIds.includes(mesa.id);

    if (multiSelect) {
      return isMultiSelected ? 'bg-violet-50 border-2 border-violet-500'
        : (mesa.sesion_id ? 'bg-stone-50 border border-stone-200 opacity-40' : 'bg-white border border-stone-200 hover:border-violet-300');
    }
    if (isEditing) {
      return isSelected ? 'bg-white border-2 border-[#16A34A]'
        : 'bg-stone-50 border border-stone-300 hover:border-stone-400';
    }
    if (ocupada) {
      return 'bg-gradient-to-br from-emerald-50 via-emerald-50/40 to-white border-2 border-emerald-400/70';
    }
    return 'bg-stone-50 border border-stone-300';
  };

  const getMesaShadow = (mesa) => {
    const hasItems = parseInt(mesa.items_count) > 0;
    const ocupada = !!mesa.sesion_id && hasItems;
    const isHighlighted = highlightIds && highlightIds.includes(mesa.id);
    if (isHighlighted) return '0 0 0 3px rgba(22,163,74,0.25), 0 2px 12px rgba(22,163,74,0.15)';
    if (selectedId === mesa.id) return '0 0 0 4px rgba(22,163,74,0.1)';
    if (ocupada) return '0 2px 12px rgba(22,163,74,0.12), 0 1px 4px rgba(0,0,0,0.06)';
    return '0 1px 4px rgba(0,0,0,0.06)';
  };

  // Link lines renderer
  const renderLinks = () => (
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
            <circle cx={x1} cy={y1} r="5" fill="#16A34A" /><circle cx={x1} cy={y1} r="2" fill="white" />
            <circle cx={x2} cy={y2} r="5" fill="#16A34A" /><circle cx={x2} cy={y2} r="2" fill="white" />
          </g>
        );
      })}
    </svg>
  );

  // Chairs SVG layer
  const renderChairs = () => (
    <svg style={{ position: 'absolute', inset: 0, width: CANVAS_W, height: CANVAS_H, pointerEvents: 'none', zIndex: 0 }}>
      {mesas.map(mesa => {
        const hasItems = parseInt(mesa.items_count) > 0;
        const ocupada = !!mesa.sesion_id && hasItems;
        const tp = tempPos[mesa.id];
        const m = tp ? { ...mesa, pos_x: tp.pos_x ?? mesa.pos_x, pos_y: tp.pos_y ?? mesa.pos_y, ancho: tp.ancho ?? mesa.ancho, alto: tp.alto ?? mesa.alto } : mesa;
        const chairs = getChairs(m, CELL);
        return chairs.map((ch, i) => (
          <g key={`chair-${mesa.id}-${i}`} transform={`translate(${ch.x},${ch.y}) rotate(${ch.rot})`}>
            <path d={CHAIR_PATH} fill={ocupada ? '#16A34A' : '#d6d3d1'} stroke={ocupada ? '#15803D' : '#a8a29e'} strokeWidth="1.5" strokeLinecap="round" />
          </g>
        ));
      })}
    </svg>
  );

  // === RENDER ===
  return (
    <div className="relative">
      {/* Toolbar — only in edit mode */}
      {isEditing && (
        <div className="absolute top-3 right-3 z-30 flex items-center gap-1 bg-white/95 backdrop-blur rounded-xl border border-stone-200/80 px-1.5 py-1 shadow-sm">
          {mesas.length > 1 && (
            <><button onClick={() => onUniformar?.()} className={cx.btnIcon + ' !p-1.5'} title="Igualar tamaño"><Equal size={16} /></button><div className="w-px h-4 bg-stone-200" /></>
          )}
          <button onClick={zoomOut} className={cx.btnIcon + ' !p-1.5'}><ZoomOut size={16} /></button>
          <span className="text-[10px] font-mono text-stone-500 w-10 text-center">{Math.round(editZoom * 100)}%</span>
          <button onClick={zoomIn} className={cx.btnIcon + ' !p-1.5'}><ZoomIn size={16} /></button>
          <button onClick={zoomFit} className={cx.btnIcon + ' !p-1.5'}><Maximize2 size={16} /></button>
        </div>
      )}

      {/* Canvas container */}
      <div ref={containerRef}
        className={`rounded-2xl border border-stone-200/60 bg-[#FAFAF8] ${isEditing ? 'overflow-auto' : 'overflow-hidden'}`}
        style={{ height: 'calc(100vh - 240px)', minHeight: '400px' }}
        onWheel={handleWheel}>

        {isEditing ? (
          /* === EDIT MODE: scrollable canvas === */
          <div style={{ width: CANVAS_W * editZoom, height: CANVAS_H * editZoom, position: 'relative' }}>
            <div style={{
              transform: `scale(${editZoom})`, transformOrigin: '0 0',
              width: CANVAS_W, height: CANVAS_H, position: 'absolute', top: 0, left: 0,
              backgroundImage: `radial-gradient(circle, rgba(168,162,158,0.22) 1px, transparent 1px)`,
              backgroundSize: `${CELL}px ${CELL}px`,
            }}>
              {renderChairs()}
              {renderLinks()}
              {mesas.map(mesa => {
                const tp = tempPos[mesa.id];
                const px = (tp?.pos_x ?? mesa.pos_x ?? 0) * CELL;
                const py = (tp?.pos_y ?? mesa.pos_y ?? 0) * CELL;
                const pw = (tp?.ancho ?? mesa.ancho ?? 3) * CELL;
                const ph = (tp?.alto ?? mesa.alto ?? 2) * CELL;
                const isDimmed = highlightIds && !highlightIds.includes(mesa.id);
                const redondeo = tempRedondeo[mesa.id] ?? mesa.redondeo ?? 15;
                return (
                  <motion.div key={mesa.id}
                    layout={!draggingRef.current && !resizingRef.current}
                    transition={{ type: 'spring', stiffness: 500, damping: 35, duration: 0.15 }}
                    style={{ position: 'absolute', left: px, top: py, width: pw, height: ph, opacity: isDimmed ? 0.4 : 1, borderRadius: `${redondeo}%`, boxShadow: getMesaShadow(mesa) }}
                    className={`flex flex-col items-center justify-center text-center select-none overflow-visible ${getMesaClasses(mesa)} ${draggingRef.current?.mesa?.id === mesa.id ? 'shadow-xl opacity-90' : ''}`}>
                    {renderMesaContent(mesa, pw, ph, editZoom)}
                  </motion.div>
                );
              })}
              {drawRect && (
                <div style={{ position: 'absolute', left: drawRect.x, top: drawRect.y, width: drawRect.w, height: drawRect.h }}
                  className={`rounded-xl border-2 border-dashed pointer-events-none ${drawRect.valid ? 'border-[#16A34A]/50 bg-emerald-50/30' : 'border-rose-300 bg-rose-50/20'}`} />
              )}
            </div>
            <div style={{ position: 'absolute', inset: 0, zIndex: 10, touchAction: 'none' }}
              className="cursor-crosshair" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} />

            {/* Floating handles */}
            {selectedMesa && (() => {
              const tp = tempPos[selectedMesa.id];
              const smx = (tp?.pos_x ?? selectedMesa.pos_x ?? 0) * CELL * editZoom;
              const smy = (tp?.pos_y ?? selectedMesa.pos_y ?? 0) * CELL * editZoom;
              const smw = (tp?.ancho ?? selectedMesa.ancho ?? 3) * CELL * editZoom;
              const smh = (tp?.alto ?? selectedMesa.alto ?? 2) * CELL * editZoom;
              const red = tempRedondeo[selectedMesa.id] ?? selectedMesa.redondeo ?? 15;
              const roundOff = (red / 50) * Math.min(smw, smh) / 2 * 0.7;
              return (
                <>
                  <div style={{ position: 'absolute', left: smx + smw - 66, top: smy - 16, zIndex: 25, pointerEvents: 'auto' }}>
                    <div className="flex gap-0.5 bg-white rounded-xl border border-stone-200/80 p-0.5 shadow-lg">
                      <button onClick={() => onDuplicar?.(selectedMesa.id)} title="Duplicar"
                        className="w-8 h-8 hover:bg-stone-50 text-stone-400 hover:text-[#16A34A] rounded-lg flex items-center justify-center transition-colors"><Copy size={14} /></button>
                      <button onClick={() => { onDeleteMesa?.(selectedMesa.id); setSelectedId(null); }} title="Eliminar"
                        className="w-8 h-8 hover:bg-stone-50 text-stone-400 hover:text-rose-500 rounded-lg flex items-center justify-center transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div style={{ position: 'absolute', left: smx + roundOff - 22, top: smy + roundOff - 22, width: 44, height: 44, zIndex: 25, touchAction: 'none', pointerEvents: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    className="cursor-[nw-resize] group" title="Redondear esquinas"
                    onPointerDown={(e) => handleRoundStart(e, selectedMesa)} onPointerMove={handleRoundMove} onPointerUp={handleRoundEnd}>
                    <div className="w-[14px] h-[14px] bg-[#16A34A] rounded-full border-[2.5px] border-white shadow-lg group-hover:scale-[1.4] group-active:scale-125 transition-transform" />
                  </div>
                  <div style={{ position: 'absolute', left: smx + smw - 22, top: smy + smh - 22, width: 44, height: 44, zIndex: 25, touchAction: 'none', pointerEvents: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    className="cursor-se-resize group" title="Cambiar tamaño"
                    onPointerDown={(e) => handleResizeStart(e, selectedMesa)} onPointerMove={handleResizeMove} onPointerUp={handleResizeEnd}>
                    <div className="w-[14px] h-[14px] bg-[#16A34A] rounded-full border-[2.5px] border-white shadow-lg group-hover:scale-[1.4] group-active:scale-125 transition-transform" />
                  </div>
                </>
              );
            })()}
          </div>
        ) : (
          /* === VIEW MODE: fixed, auto-fit, no scroll === */
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <div style={{
              transform: `translate(${viewTx.ox}px, ${viewTx.oy}px) scale(${viewTx.zoom})`,
              transformOrigin: '0 0',
              width: CANVAS_W, height: CANVAS_H,
              position: 'absolute', top: 0, left: 0,
            }}>
              {renderChairs()}
              {renderLinks()}
              {mesas.map(mesa => {
                const px = (mesa.pos_x ?? 0) * CELL, py = (mesa.pos_y ?? 0) * CELL;
                const pw = (mesa.ancho ?? 3) * CELL, ph = (mesa.alto ?? 2) * CELL;
                const isDimmed = highlightIds && !highlightIds.includes(mesa.id);
                const redondeo = mesa.redondeo ?? 15;
                return (
                  <motion.div key={mesa.id}
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: isDimmed ? 0.4 : 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.02 }}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    style={{ position: 'absolute', left: px, top: py, width: pw, height: ph, borderRadius: `${redondeo}%`, boxShadow: getMesaShadow(mesa), cursor: 'pointer' }}
                    className={`flex flex-col items-center justify-center text-center select-none overflow-visible ${getMesaClasses(mesa)}`}>
                    {renderMesaContent(mesa, pw, ph, viewTx.zoom)}
                  </motion.div>
                );
              })}
            </div>
            {/* Click overlay for view mode */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}
              className={multiSelect ? 'cursor-pointer' : ''}
              onPointerDown={handlePointerDown} />
          </div>
        )}
      </div>

      {isEditing && (
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 mt-2.5 text-[11px] text-stone-500">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-3 border border-dashed border-[#16A34A]/40 rounded inline-block bg-emerald-50/40" /> Arrastra para crear
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-[#16A34A] rounded-full inline-block shadow-sm" /> Redondear
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-[#16A34A] rounded-full inline-block border-2 border-white shadow-sm" /> Tamaño
          </span>
        </div>
      )}
    </div>
  );
}
