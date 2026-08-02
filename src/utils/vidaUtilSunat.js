// Sugerencia de vida útil por defecto según las tasas de depreciación de SUNAT
// (Ley del Impuesto a la Renta, Art. 39-40 y Art. 22 del Reglamento). El dueño puede
// editar el valor sugerido. Sirve para el módulo Activos: al escribir el nombre del
// equipo, Kudi propone la vida útil oficial.
//
// Tasas anuales oficiales → vida útil en meses:
//   Edificios/construcciones ......... 5%  → 240 meses
//   Equipos de cómputo ............... 25% → 48 meses
//   Vehículos de transporte / hornos . 20% → 60 meses
//   Maquinaria y equipo (general) .... 10% → 120 meses
//   Muebles y enseres / otros ........ 10% → 120 meses

const CATEGORIAS = [
  {
    key: 'computo', meses: 48, tasa: '25%', label: 'Equipos de cómputo',
    palabras: ['laptop', 'computadora', 'computador', 'pc', 'notebook', 'tablet', 'ipad', 'impresora', 'monitor', 'celular', 'telefono', 'teléfono', 'smartphone', 'servidor', 'router', 'escaner', 'escáner'],
  },
  {
    key: 'vehiculo', meses: 60, tasa: '20%', label: 'Vehículos de transporte',
    palabras: ['moto', 'motocicleta', 'motorizado', 'auto', 'automovil', 'automóvil', 'camioneta', 'furgon', 'furgón', 'vehiculo', 'vehículo', 'triciclo', 'mototaxi', 'scooter', 'bicicleta'],
  },
  {
    key: 'horno', meses: 60, tasa: '20%', label: 'Hornos',
    palabras: ['horno', 'hornos', 'horno industrial'],
  },
  {
    key: 'edificio', meses: 240, tasa: '5%', label: 'Edificios y construcciones',
    palabras: ['local', 'edificio', 'inmueble', 'construccion', 'construcción', 'terreno', 'planta'],
  },
  {
    key: 'maquinaria', meses: 120, tasa: '10%', label: 'Maquinaria y equipo',
    palabras: ['refrigeradora', 'refrigerador', 'congeladora', 'congelador', 'freezer', 'frigobar', 'batidora', 'licuadora', 'amasadora', 'mezcladora', 'sobadora', 'laminadora', 'cocina', 'campana', 'extractor', 'balanza', 'selladora', 'empacadora', 'cafetera', 'exhibidora', 'vitrina', 'conservadora', 'fermentadora', 'abatidor', 'procesadora', 'maquina', 'máquina', 'equipo', 'termoselladora', 'dispensador'],
  },
  {
    key: 'muebles', meses: 120, tasa: '10%', label: 'Muebles y enseres',
    palabras: ['mueble', 'mesa', 'silla', 'estante', 'estanteria', 'estantería', 'repisa', 'mostrador', 'anaquel', 'vitrina de madera', 'escritorio', 'gondola', 'góndola'],
  },
];

const DEFAULT = { key: 'otros', meses: 120, tasa: '10%', label: 'Otros bienes del activo fijo' };

// Devuelve { meses, tasa, label, key } sugerido para un nombre de activo, o null si el
// nombre es muy corto para inferir (para no sugerir a ciegas).
export function sugerirVidaUtil(nombre) {
  const n = (nombre || '').toLowerCase().trim();
  if (n.length < 3) return null;
  for (const cat of CATEGORIAS) {
    if (cat.palabras.some((p) => n.includes(p))) {
      return { meses: cat.meses, tasa: cat.tasa, label: cat.label, key: cat.key };
    }
  }
  return DEFAULT;
}
