import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import changelog from '../data/changelog.json';

export default function UpdateBanner() {
  const [hasNew, setHasNew] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (changelog.length === 0) return;
    const lastSeen = localStorage.getItem('kudi_last_seen_version');
    setHasNew(!lastSeen || lastSeen !== changelog[0].version);
  }, [location.pathname]);

  if (!hasNew || location.pathname === '/novedades') return null;

  const latest = changelog[0];

  const handleClick = () => {
    localStorage.setItem('kudi_last_seen_version', latest.version);
    setHasNew(false);
    navigate('/novedades');
  };

  return (
    <button
      onClick={handleClick}
      className="w-full mx-1 mb-2 px-3 py-2.5 rounded-[10px] text-left transition-all duration-150 hover:border-[rgba(74,222,128,0.2)]"
      style={{
        background: 'linear-gradient(135deg, rgba(74,222,128,0.08), rgba(22,163,74,0.04))',
        border: '1px solid rgba(74,222,128,0.12)',
      }}
    >
      <div className="flex items-center gap-[7px] mb-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse flex-shrink-0" />
        <span className="text-xs font-semibold text-white/85">Novedades en Kudi</span>
      </div>
      <p className="text-[11px] text-white/35 pl-[13px] leading-snug">{latest.titulo}</p>
    </button>
  );
}
