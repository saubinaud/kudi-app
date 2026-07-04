import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const ToastContext = createContext(null);

let toastId = 0;

// Duración por tipo: los errores necesitan tiempo para leerse y actuar.
const DURATION = { success: 3500, error: 8000 };
// Al sacar el mouse de un toast pausado, remate corto antes de irse.
const RESUME_MS = 1500;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const remove = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const schedule = useCallback((id, ms) => {
    clearTimeout(timers.current.get(id));
    timers.current.set(id, setTimeout(() => remove(id), ms));
  }, [remove]);

  const addToast = useCallback((message, type = 'success') => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    schedule(id, DURATION[type] || DURATION.success);
  }, [schedule]);

  const toast = useCallback(
    (msg) => addToast(msg, 'success'),
    [addToast]
  );
  toast.error = useCallback((msg) => addToast(msg, 'error'), [addToast]);
  toast.success = useCallback((msg) => addToast(msg, 'success'), [addToast]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.2 }}
              // Hover = pausa: el toast se queda mientras el mouse esté encima.
              onMouseEnter={() => clearTimeout(timers.current.get(t.id))}
              onMouseLeave={() => schedule(t.id, RESUME_MS)}
              // Angosto a propósito: el texto envuelve y el cuadro crece hacia
              // abajo (más alto que ancho), no a lo largo de la pantalla.
              className={`w-64 px-4 py-3 rounded-xl text-sm font-medium shadow-lg break-words cursor-default ${
                t.type === 'error'
                  ? 'bg-rose-600 border border-rose-500 text-white'
                  : 'bg-stone-800 border border-stone-700 text-white'
              }`}
            >
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
