import { useEffect } from 'react';
import changelogRaw from '../data/changelog.json';

const changelog = changelogRaw.map(entry =>
  entry.fecha === 'auto'
    ? { ...entry, fecha: new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Lima' }) }
    : entry
);

const DOT_COLORS = {
  feat: 'bg-[#16A34A]',
  fix: 'bg-amber-400',
  improve: 'bg-blue-400',
};

export default function NovedadesPage() {
  // Mark as seen
  useEffect(() => {
    if (changelog.length > 0) {
      localStorage.setItem('kudi_last_seen_version', changelog[0].version);
    }
  }, []);

  return (
    <div className="max-w-[600px] mx-auto pb-20">
      <p className="text-[11px] font-bold text-stone-400 uppercase tracking-[2px] mb-12">Novedades</p>

      {changelog.map((update, idx) => (
        <div key={update.version}>
          {idx > 0 && <div className="h-px bg-stone-100 mb-12" />}

          <div className="mb-12">
            <p className="text-xs text-stone-400 font-medium mb-1.5">{update.fecha}</p>
            <h1 className="text-[26px] font-extrabold text-stone-900 leading-tight tracking-tight mb-3">{update.titulo}</h1>
            <p className="text-[15px] text-stone-500 leading-relaxed mb-5">{update.descripcion}</p>

            {update.imagen && (
              <div className="rounded-xl overflow-hidden border border-stone-200 mb-5">
                <img src={update.imagen} alt={update.titulo} className="w-full" />
              </div>
            )}

            {update.secciones.map((seccion, si) => (
              <div key={si} className="mt-6">
                <h2 className="text-base font-bold text-stone-900 mb-2.5">{seccion.titulo}</h2>
                <ul className="space-y-0">
                  {seccion.entries.map((entry, ei) => (
                    <li key={ei} className="relative pl-4 py-1.5 text-[14px] text-stone-600 leading-relaxed">
                      <span className={`absolute left-0 top-[11px] w-[6px] h-[6px] rounded-full ${DOT_COLORS[entry.tipo] || 'bg-stone-300'}`} />
                      {entry.texto}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
