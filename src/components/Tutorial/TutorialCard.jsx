import { useRef, useLayoutEffect, useState } from 'react';
import { motion } from 'framer-motion';
import KudiCharacter from '../KudiCharacter';

const CARD_W = 360;
const GAP = 20;
const EDGE = 16;

function calcPosition(targetRect, position, cardH) {
  if (!targetRect || position === 'center') {
    return { top: '50%', left: '50%', x: '-50%', y: '-50%' };
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampX = (l) => Math.max(EDGE, Math.min(l, vw - CARD_W - EDGE));

  const positions = [position, 'bottom', 'top', 'right', 'left'];
  for (const pos of positions) {
    if (pos === 'bottom') {
      const t = targetRect.top + targetRect.height + GAP;
      if (t + cardH <= vh - EDGE) return { top: t, left: clampX(targetRect.left), x: 0, y: 0 };
    }
    if (pos === 'top') {
      const t = targetRect.top - GAP - cardH;
      if (t >= EDGE) return { top: t, left: clampX(targetRect.left), x: 0, y: 0 };
    }
    if (pos === 'right') {
      const l = targetRect.left + targetRect.width + GAP;
      if (l + CARD_W <= vw - EDGE) return { top: Math.max(EDGE, targetRect.top), left: l, x: 0, y: 0 };
    }
    if (pos === 'left') {
      const l = targetRect.left - GAP - CARD_W;
      if (l >= EDGE) return { top: Math.max(EDGE, targetRect.top), left: l, x: 0, y: 0 };
    }
  }

  return { top: '50%', left: '50%', x: '-50%', y: '-50%' };
}

export default function TutorialCard({
  step,
  targetRect,
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
}) {
  const cardRef = useRef(null);
  const [cardH, setCardH] = useState(220);

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [step]);

  const pos = calcPosition(targetRect, step.position || 'bottom', cardH);
  const isCenter = !step.target || step.position === 'center';
  const isWaiting = step.waitFor === 'click';
  const isLast = currentStep === totalSteps - 1;

  return (
    <motion.div
      ref={cardRef}
      className="fixed bg-white rounded-2xl shadow-2xl"
      style={{ zIndex: 10000, width: CARD_W, maxWidth: `calc(100vw - ${EDGE * 2}px)` }}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{
        opacity: 1,
        scale: 1,
        top: pos.top,
        left: pos.left,
        x: pos.x,
        y: pos.y,
      }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{
        opacity: { duration: 0.2 },
        scale: { duration: 0.2 },
        top: { type: 'spring', stiffness: 260, damping: 28 },
        left: { type: 'spring', stiffness: 260, damping: 28 },
      }}
    >
      {isCenter ? (
        /* ── Layout centrado (bienvenida) ── */
        <div className="flex flex-col items-center text-center p-6">
          <KudiCharacter expression={step.expression || 'todoBien'} size={80} animate />
          <h3 className="text-lg font-semibold text-stone-900 mt-3">{step.title}</h3>
          <p className="text-sm text-stone-500 leading-relaxed mt-1.5">{step.message}</p>

          <div className="flex gap-3 mt-5 w-full">
            {currentStep > 0 && (
              <button onClick={onPrev} className="flex-1 px-4 py-2 text-sm text-stone-500 hover:text-stone-700 hover:bg-stone-50 rounded-lg transition-colors">
                ← Anterior
              </button>
            )}
            <button onClick={onNext} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
              {isLast ? '¡Listo!' : 'Siguiente →'}
            </button>
          </div>

          {totalSteps > 1 && <Dots current={currentStep} total={totalSteps} />}
        </div>
      ) : (
        /* ── Layout con target ── */
        <div className="p-5">
          {/* Header */}
          <div className="flex items-center gap-3 mb-3">
            <KudiCharacter expression={step.expression || 'todoBien'} size={48} animate />
            <span className="text-xs text-stone-400 font-medium flex-1">
              Paso {currentStep + 1} de {totalSteps}
            </span>
            <button
              onClick={onSkip}
              className="w-7 h-7 flex items-center justify-center rounded-full text-stone-300 hover:text-stone-500 hover:bg-stone-100 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M 2 2 L 12 12 M 12 2 L 2 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <h3 className="text-[15px] font-semibold text-stone-900 mb-1">{step.title}</h3>
          <p className="text-sm text-stone-500 leading-relaxed mb-4">{step.message}</p>

          {/* Footer */}
          {isWaiting ? (
            <p className="text-xs text-green-600 font-medium animate-pulse">
              Haz clic en el elemento resaltado
            </p>
          ) : (
            <div className="flex items-center justify-between">
              <button
                onClick={onPrev}
                disabled={currentStep === 0}
                className="px-3 py-1.5 text-sm text-stone-400 hover:text-stone-600 disabled:opacity-0 disabled:pointer-events-none transition-colors"
              >
                ← Anterior
              </button>
              <button
                onClick={onNext}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
              >
                {isLast ? '¡Listo!' : 'Siguiente →'}
              </button>
            </div>
          )}

          {totalSteps > 1 && <Dots current={currentStep} total={totalSteps} />}
        </div>
      )}
    </motion.div>
  );
}

function Dots({ current, total }) {
  return (
    <div className="flex gap-1.5 justify-center mt-3">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${
            i <= current ? 'bg-green-500' : 'bg-stone-200'
          }`}
        />
      ))}
    </div>
  );
}
