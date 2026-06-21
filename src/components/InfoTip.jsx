/**
 * InfoTip — ícono "ⓘ" con tooltip explicativo (P6: puntos de fuga de percepción).
 * Para aclarar números que son CORRECTOS pero un usuario no-experto puede leer como
 * error (ingresos netos ≪ brutos, utilidad negativa legítima, IGV, margen, etc.).
 * No bloquea nada; es solo microcopy de ayuda.
 */
export default function InfoTip({ text, wide = false, className = '' }) {
  return (
    <span className={`relative group inline-flex ml-1 cursor-help align-middle z-30 ${className}`}>
      <span className="w-3.5 h-3.5 rounded-full bg-stone-200 text-stone-500 text-[9px] font-bold inline-flex items-center justify-center group-hover:bg-[var(--accent)] group-hover:text-white transition-colors">i</span>
      <span className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-stone-900 text-white text-[11px] rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-center leading-relaxed z-40 normal-case ${wide ? 'w-72' : 'w-56'}`}>
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-stone-900" />
      </span>
    </span>
  );
}
