import { useMemo } from 'react';
import CustomSelect from './CustomSelect';
import ubigeoData from '../data/ubigeo.json';

export default function UbigeoSelect({ departamento, provincia, distrito, onChange, compact = true, className = '' }) {
  const departamentoOptions = useMemo(() =>
    ubigeoData.map(d => ({ value: d.departamento, label: d.departamento })),
    []
  );

  const provinciaOptions = useMemo(() => {
    if (!departamento) return [];
    const dep = ubigeoData.find(d => d.departamento === departamento);
    return (dep?.provincias || []).map(p => ({ value: p.provincia, label: p.provincia }));
  }, [departamento]);

  const distritoOptions = useMemo(() => {
    if (!departamento || !provincia) return [];
    const dep = ubigeoData.find(d => d.departamento === departamento);
    const prov = (dep?.provincias || []).find(p => p.provincia === provincia);
    return (prov?.distritos || []).map(d => ({ value: d, label: d }));
  }, [departamento, provincia]);

  const handleDepartamentoChange = (val) => {
    onChange({ departamento: val, provincia: '', distrito: '' });
  };

  const handleProvinciaChange = (val) => {
    onChange({ departamento, provincia: val, distrito: '' });
  };

  const handleDistritoChange = (val) => {
    onChange({ departamento, provincia, distrito: val });
  };

  return (
    <div className={`grid grid-cols-3 gap-1.5 ${className}`}>
      <CustomSelect
        compact={compact}
        options={departamentoOptions}
        value={departamento}
        onChange={handleDepartamentoChange}
        placeholder="Departamento"
      />
      <CustomSelect
        compact={compact}
        options={provinciaOptions}
        value={provincia}
        onChange={handleProvinciaChange}
        placeholder="Provincia"
      />
      <CustomSelect
        compact={compact}
        options={distritoOptions}
        value={distrito}
        onChange={handleDistritoChange}
        placeholder="Distrito"
      />
    </div>
  );
}
