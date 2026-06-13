import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Tooltip — aparece después de un delay al mantener el mouse sobre el children.
 *
 * @param {string} text — texto del tooltip
 * @param {number} delay — ms antes de mostrar (default 1500)
 * @param {'top'|'bottom'|'left'|'right'} position — dirección del tooltip
 * @param {ReactNode} children — elemento que activa el tooltip
 */
export default function Tooltip({ text, delay = 1500, position = 'top', children }) {
  const [show, setShow] = useState(false);
  const timerRef = useRef(null);

  const handleEnter = () => {
    timerRef.current = setTimeout(() => setShow(true), delay);
  };

  const handleLeave = () => {
    clearTimeout(timerRef.current);
    setShow(false);
  };

  const posStyles = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const motionOrigin = {
    top: { initial: { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0 } },
    bottom: { initial: { opacity: 0, y: -4 }, animate: { opacity: 1, y: 0 } },
    left: { initial: { opacity: 0, x: 4 }, animate: { opacity: 1, x: 0 } },
    right: { initial: { opacity: 0, x: -4 }, animate: { opacity: 1, x: 0 } },
  };

  if (!text) return children;

  return (
    <span className="relative inline-flex" onMouseEnter={handleEnter} onMouseLeave={handleLeave} onFocus={handleEnter} onBlur={handleLeave}>
      {children}
      <AnimatePresence>
        {show && (
          <motion.span
            className={`absolute z-[100] px-2.5 py-1.5 rounded-lg bg-[#0A2F24] text-white text-[11px] font-medium whitespace-nowrap pointer-events-none shadow-lg ${posStyles[position]}`}
            initial={motionOrigin[position].initial}
            animate={motionOrigin[position].animate}
            exit={motionOrigin[position].initial}
            transition={{ duration: 0.12 }}
          >
            {text}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
