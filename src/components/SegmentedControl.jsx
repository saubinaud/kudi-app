import { motion } from 'framer-motion';

/**
 * SegmentedControl — pills con sliding indicator animado.
 *
 * @param {Array} options — [{ key, label, icon?: LucideIcon }]
 * @param {string} value — key activo
 * @param {function} onChange — (key) => void
 * @param {string} layoutId — único por instancia (evita conflictos entre controles)
 * @param {'dark'|'light'} variant — 'dark' = pill oscura, 'light' = pill blanca con sombra
 * @param {'sm'|'md'} size — tamaño
 */
export default function SegmentedControl({ options = [], value, onChange, layoutId = 'seg', variant = 'dark', size = 'md' }) {
  const pillClass = variant === 'dark'
    ? 'bg-[#0A2F24] rounded-full shadow-sm'
    : 'bg-white rounded-full shadow-sm';
  const activeText = variant === 'dark' ? 'text-white' : 'text-stone-900';
  const inactiveText = 'text-stone-500 hover:text-stone-700';
  const pad = size === 'sm' ? 'px-3 py-[5px] text-[11px]' : 'px-5 py-[7px] text-xs';

  return (
    <div className="inline-flex bg-stone-200/70 rounded-full p-1">
      {options.map(o => {
        const isActive = o.key === value;
        return (
          <button key={o.key ?? '__default'} onClick={() => onChange(o.key)}
            className={`relative z-10 ${pad} font-medium whitespace-nowrap`}
          >
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className={`absolute inset-0 ${pillClass}`}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className={`relative z-10 flex items-center gap-1.5 transition-colors duration-150 ${isActive ? activeText : inactiveText}`}>
              {o.icon && <o.icon size={size === 'sm' ? 13 : 14} />}
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
