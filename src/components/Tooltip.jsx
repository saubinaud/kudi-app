import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Tooltip — aparece después de un delay al mantener el mouse sobre el children.
 * Usa portal + fixed positioning para nunca cortarse por overflow.
 */
export default function Tooltip({ text, delay = 1500, position = 'top', wide = false, children }) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const timerRef = useRef(null);
  const triggerRef = useRef(null);

  const calcPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const pos = {
      top: { x: rect.left + rect.width / 2, y: rect.top - 8 },
      bottom: { x: rect.left + rect.width / 2, y: rect.bottom + 8 },
      left: { x: rect.left - 8, y: rect.top + rect.height / 2 },
      right: { x: rect.right + 8, y: rect.top + rect.height / 2 },
    };
    setCoords(pos[position] || pos.top);
  }, [position]);

  const handleEnter = () => {
    timerRef.current = setTimeout(() => { calcPosition(); setShow(true); }, delay);
  };

  const handleLeave = () => {
    clearTimeout(timerRef.current);
    setShow(false);
  };

  const transformOrigin = {
    top: '-translate-x-1/2 -translate-y-full',
    bottom: '-translate-x-1/2',
    left: '-translate-x-full -translate-y-1/2',
    right: '-translate-y-1/2',
  };

  const motionProps = {
    top: { initial: { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0 } },
    bottom: { initial: { opacity: 0, y: -4 }, animate: { opacity: 1, y: 0 } },
    left: { initial: { opacity: 0, x: 4 }, animate: { opacity: 1, x: 0 } },
    right: { initial: { opacity: 0, x: -4 }, animate: { opacity: 1, x: 0 } },
  };

  if (!text) return children;

  return (
    <>
      <span ref={triggerRef} className="inline-flex" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
        {children}
      </span>
      {createPortal(
        <AnimatePresence>
          {show && (
            <motion.span
              className={`fixed z-[9999] px-2.5 py-1.5 rounded-lg bg-[#0A2F24] text-white text-[11px] font-medium pointer-events-none shadow-lg ${wide ? 'whitespace-normal leading-snug text-left' : 'whitespace-nowrap'} ${transformOrigin[position]}`}
              style={{ left: coords.x, top: coords.y, maxWidth: wide ? 260 : undefined }}
              initial={motionProps[position].initial}
              animate={motionProps[position].animate}
              exit={motionProps[position].initial}
              transition={{ duration: 0.12 }}
            >
              {text}
            </motion.span>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
