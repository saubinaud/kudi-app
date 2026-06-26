import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * InfoTip — ícono "ⓘ" con tooltip explicativo (microcopy de ayuda, no bloquea nada).
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * CÓMO SE MANEJAN ESTOS BLOQUES FLOTANTES (tooltip) — léelo antes de tocar:
 * El tooltip NUNCA debe desbordarse ni tapar contenido. Por eso NO usa
 * `position:absolute` dentro del flujo (que se recorta con overflow:hidden y se
 * sale del panel angosto). Usa el patrón canónico de Kudi para overlays
 * (igual que CustomSelect / StatusBadge):
 *
 *   1. Se renderiza en un PORTAL a `document.body` con `position: fixed`
 *      → escapa cualquier `overflow:hidden` y se mide en coordenadas de viewport.
 *   2. POSICIÓN HORIZONTAL: centrado en el ícono, pero CLAMPeado al viewport
 *      (left ∈ [MARGIN, vw - width - MARGIN]) → nunca se sale por izquierda/derecha.
 *   3. POSICIÓN VERTICAL: preferentemente ARRIBA del ícono; si no entra (parte
 *      superior del viewport), hace FLIP hacia ABAJO. Si tampoco entra abajo, se
 *      clampa → nunca se corta arriba/abajo.
 *   4. La FLECHA apunta al centro real del ícono (arrowLeft relativo al tooltip),
 *      no al centro del tooltip (que puede haberse desplazado por el clamp).
 *   5. Se RECALCULA en scroll (capture) y resize mientras está abierto.
 *
 * DIMENSIONES:
 *   - width:  normal = 224px (w-56), wide = 288px (w-72). Alto: dinámico (se mide).
 *   - GAP (ícono↔tooltip) = 8px · MARGIN (al borde del viewport) = 8px.
 *   - z-index 9999 (sobre todo). text-[11px], px-3 py-2.
 *
 * ACCESIBILIDAD/TOUCH: hover (mouse) + focus (tab/tap en tablet) abren el tooltip.
 * `pointer-events-none` en el tooltip (no roba el hover; se cierra al salir del ícono).
 * ──────────────────────────────────────────────────────────────────────────────
 */
const GAP = 8;
const MARGIN = 8;

export default function InfoTip({ text, wide = false, className = '' }) {
  const iconRef = useRef(null);
  const tipRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: -9999, left: -9999, placement: 'top', arrowLeft: 16 });

  const width = wide ? 288 : 224;

  const compute = useCallback(() => {
    const icon = iconRef.current;
    if (!icon) return;
    const r = icon.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const tipH = tipRef.current?.offsetHeight || 0;

    // Horizontal: centrar en el ícono y clampar al viewport.
    const iconCenter = r.left + r.width / 2;
    let left = iconCenter - width / 2;
    left = Math.max(MARGIN, Math.min(left, vw - width - MARGIN));

    // Vertical: preferir arriba; si no cabe, flip abajo; si tampoco, clamp.
    let placement = 'top';
    let top = r.top - GAP - tipH;
    if (top < MARGIN) { placement = 'bottom'; top = r.bottom + GAP; }
    if (placement === 'bottom' && top + tipH > vh - MARGIN) {
      top = Math.max(MARGIN, vh - tipH - MARGIN);
    }

    // Flecha: apunta al centro del ícono, relativa al tooltip ya clampeado.
    const arrowLeft = Math.max(12, Math.min(iconCenter - left, width - 12));

    setPos({ top, left, placement, arrowLeft });
  }, [width]);

  // Medir y posicionar después de renderizar el tooltip (ya conocemos su alto).
  useLayoutEffect(() => { if (open) compute(); }, [open, compute]);

  // Reposicionar si hay scroll/resize mientras está abierto.
  useEffect(() => {
    if (!open) return;
    const on = () => compute();
    window.addEventListener('scroll', on, true);
    window.addEventListener('resize', on);
    return () => {
      window.removeEventListener('scroll', on, true);
      window.removeEventListener('resize', on);
    };
  }, [open, compute]);

  return (
    <span
      ref={iconRef}
      tabIndex={0}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      className={`relative inline-flex ml-1 cursor-help align-middle ${className}`}
    >
      <span className="w-3.5 h-3.5 rounded-full bg-stone-200 text-stone-500 text-[9px] font-bold inline-flex items-center justify-center hover:bg-[var(--accent)] hover:text-white transition-colors">i</span>
      {open && createPortal(
        <span
          ref={tipRef}
          role="tooltip"
          style={{ position: 'fixed', top: pos.top, left: pos.left, width }}
          className="px-3 py-2 bg-stone-900 text-white text-[11px] rounded-xl shadow-2xl pointer-events-none text-center leading-relaxed normal-case z-[9999]"
        >
          {text}
          <span
            style={{ left: pos.arrowLeft }}
            className={`absolute -translate-x-1/2 border-4 border-transparent ${pos.placement === 'top' ? 'top-full border-t-stone-900' : 'bottom-full border-b-stone-900'}`}
          />
        </span>,
        document.body
      )}
    </span>
  );
}
