import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cx } from '../styles/tokens';

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel, confirmText = 'Eliminar', confirmStyle = 'danger' }) {
  const btnClass = confirmStyle === 'danger' ? cx.btnDanger : cx.btnPrimary;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onCancel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          />
          <motion.div
            className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            <h3 className="text-lg font-bold text-stone-900 mb-2">{title}</h3>
            <p className="text-stone-500 text-sm mb-6">{message}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={onCancel} className={cx.btnSecondary}>
                Cancelar
              </button>
              <button onClick={onConfirm} className={btnClass}>
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function PromptDialog({ open, title, message, placeholder, onConfirm, onCancel, confirmText = 'Guardar', defaultValue = '' }) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, defaultValue]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onCancel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          />
          <motion.div
            className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            <h3 className="text-lg font-bold text-stone-900 mb-2">{title}</h3>
            {message && <p className="text-stone-500 text-sm mb-3">{message}</p>}
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) onConfirm(value.trim()); }}
              placeholder={placeholder || ''}
              className={cx.input + ' mb-5'}
            />
            <div className="flex gap-3 justify-end">
              <button onClick={onCancel} className={cx.btnSecondary}>
                Cancelar
              </button>
              <button onClick={() => value.trim() && onConfirm(value.trim())} disabled={!value.trim()} className={cx.btnPrimary}>
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
