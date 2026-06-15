import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SOURCES = {
  todoBien: '/kudi/todoBien.png',
  saludo: '/kudi/saludo.png',
  pensando: '/kudi/pensando.png',
  eureka: '/kudi/eureca.png',
  atencion: '/kudi/atencion.png',
  alerta: '/kudi/alerta.png',
  celebrando: '/kudi/celebrando.png',
  curioso: '/kudi/curioso.png',
};

/* Preload all expression images on first mount */
let preloaded = false;
function preloadAll() {
  if (preloaded) return;
  preloaded = true;
  Object.values(SOURCES).forEach((src) => {
    const img = new Image();
    img.src = src;
  });
}

/**
 * KudiBot v4 — 3D renders + framer-motion animations.
 *
 * @param {'saludo'|'pensando'|'eureka'|'atencion'|'todoBien'|'alerta'|'celebrando'|'curioso'} expression
 * @param {number}  size    — display size in px
 * @param {boolean} animate — float + entrance
 */
export default function KudiCharacter({
  expression = 'todoBien',
  size = 48,
  animate = true,
}) {
  const mountRef = useRef(false);

  useEffect(() => {
    preloadAll();
    mountRef.current = true;
  }, []);

  const src = SOURCES[expression] || SOURCES.todoBien;

  return (
    <motion.div
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        position: 'relative',
      }}
      animate={animate ? { y: [0, -4, 0] } : {}}
      transition={animate ? { duration: 3, repeat: Infinity, ease: 'easeInOut' } : {}}
    >
      <AnimatePresence mode="wait">
        <motion.img
          key={expression}
          src={src}
          alt={`Kudi — ${expression}`}
          draggable={false}
          style={{
            width: size,
            height: size,
            objectFit: 'contain',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        />
      </AnimatePresence>
    </motion.div>
  );
}
