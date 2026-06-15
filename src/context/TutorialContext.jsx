import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'framer-motion';
import TutorialOverlay from '../components/Tutorial/TutorialOverlay';
import TutorialCard from '../components/Tutorial/TutorialCard';

const TutorialContext = createContext(null);

const STORAGE_KEY = 'kudi_tutorials';

function getCompleted() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}

function markCompleted(id) {
  const data = getCompleted();
  data[id] = true;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/* ── Hook interno: rect del target ── */
function useTargetRect(selector) {
  const [rect, setRect] = useState(null);

  useEffect(() => {
    if (!selector) { setRect(null); return; }

    const update = () => {
      const el = document.querySelector(selector);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      }
    };

    update();
    const t1 = setTimeout(update, 200);
    const t2 = setTimeout(update, 500);

    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [selector]);

  return rect;
}

/* ── Provider ── */
export function TutorialProvider({ children }) {
  const [state, setState] = useState({
    active: false,
    tutorialId: null,
    steps: [],
    currentStep: 0,
  });

  const step = state.active ? state.steps[state.currentStep] : null;
  const targetRect = useTargetRect(step?.target || null);
  const prevTargetRef = useRef(null);

  /* Navegar a la ruta del step si es necesario */
  useEffect(() => {
    if (!step?.route) return;
    const currentPath = window.location.hash.replace('#', '') || '/';
    if (currentPath !== step.route) {
      // We need to navigate - use window.location since we don't have navigate() in context
      window.location.hash = `#${step.route}`;
    }
  }, [step]);

  /* Elevar target por encima del overlay */
  useEffect(() => {
    // Restaurar el anterior
    if (prevTargetRef.current) {
      prevTargetRef.current.style.zIndex = '';
      prevTargetRef.current.style.position = '';
      prevTargetRef.current = null;
    }

    if (!step?.target) return;

    const find = () => {
      const el = document.querySelector(step.target);
      if (!el) return;

      const pos = getComputedStyle(el).position;
      if (pos === 'static') el.style.position = 'relative';
      el.style.zIndex = '9999';
      prevTargetRef.current = el;
    };

    find();
    const retry = setTimeout(find, 800);
    return () => clearTimeout(retry);
  }, [step?.target]);

  /* Limpiar al desactivar */
  useEffect(() => {
    if (!state.active && prevTargetRef.current) {
      prevTargetRef.current.style.zIndex = '';
      prevTargetRef.current.style.position = '';
      prevTargetRef.current = null;
    }
  }, [state.active]);

  /* waitFor: 'click' — listener en el target */
  const nextRef = useRef(null);
  const next = useCallback(() => {
    setState(s => {
      if (s.currentStep >= s.steps.length - 1) {
        markCompleted(s.tutorialId);
        return { ...s, active: false };
      }
      return { ...s, currentStep: s.currentStep + 1 };
    });
  }, []);
  nextRef.current = next;

  useEffect(() => {
    if (!step?.waitFor || step.waitFor !== 'click') return;

    const selector = step.waitTarget || step.target;
    if (!selector) return;

    let el = null;
    const handler = () => nextRef.current?.();

    const bind = () => {
      el = document.querySelector(selector);
      if (el) el.addEventListener('click', handler, { once: true });
    };

    bind();
    const retry = setTimeout(bind, 500);

    return () => {
      clearTimeout(retry);
      if (el) el.removeEventListener('click', handler);
    };
  }, [step]);

  /* onEnter callback */
  useEffect(() => {
    if (step?.onEnter) step.onEnter();
  }, [state.currentStep, state.active]);

  const start = useCallback((tutorialId, steps, { force = false } = {}) => {
    if (!force && getCompleted()[tutorialId]) return;
    setState({ active: true, tutorialId, steps, currentStep: 0 });
  }, []);

  const prev = useCallback(() => {
    setState(s => ({ ...s, currentStep: Math.max(0, s.currentStep - 1) }));
  }, []);

  const skip = useCallback(() => {
    setState(s => { markCompleted(s.tutorialId); return { ...s, active: false }; });
  }, []);

  const finish = useCallback(() => {
    setState(s => { markCompleted(s.tutorialId); return { ...s, active: false }; });
  }, []);

  const handleAction = useCallback((action) => {
    setState(s => {
      markCompleted(s.tutorialId);
      return { ...s, active: false };
    });
    if (action.route) {
      setTimeout(() => {
        window.location.hash = `#${action.route}`;
      }, 100);
    }
  }, []);

  const isCompleted = useCallback((id) => !!getCompleted()[id], []);

  const resetTutorial = useCallback((id) => {
    const data = getCompleted();
    delete data[id];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, []);

  const value = {
    ...state,
    step,
    totalSteps: state.steps.length,
    start, next, prev, skip, finish, isCompleted, resetTutorial,
  };

  return (
    <TutorialContext.Provider value={value}>
      {children}
      {createPortal(
        <AnimatePresence>
          {state.active && step && (
            <>
              <TutorialOverlay targetRect={targetRect} />
              <TutorialCard
                step={step}
                targetRect={targetRect}
                currentStep={state.currentStep}
                totalSteps={state.steps.length}
                onNext={next}
                onPrev={prev}
                onSkip={skip}
                onAction={handleAction}
              />
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error('useTutorial debe usarse dentro de TutorialProvider');
  return ctx;
}
