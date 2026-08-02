// Fuente ÚNICA para consultar un documento (DNI/RUC) y autocompletar datos del cliente.
// Cascada: 1) BD local de clientes  ->  2) RENIEC (DNI) / SUNAT (RUC).
// La usan POS, Clientes y el alta rápida de cliente en Ventas para no duplicar lógica.
//
// tipo: 'DNI' | 'RUC'
// Devuelve siempre un objeto: { encontrado, fuente, nombre, email, telefono }
//   fuente: 'local' | 'reniec' | 'sunat' | null
//   RENIEC/SUNAT solo devuelven el nombre; email/telefono quedan vacíos (no existen ahí).
export async function consultarDocumento(api, tipo, numero) {
  const vacio = { encontrado: false, fuente: null, nombre: '', email: '', telefono: '' };
  if (!numero) return vacio;

  // 1) Base de datos local (clientes ya registrados) — trae también email/telefono.
  try {
    const local = await api.get(`/clientes/buscar?q=${numero}`).catch(() => ({ data: [] }));
    const found = (local?.data || local || []).find(c => c.num_doc === numero);
    if (found) {
      return {
        encontrado: true,
        fuente: 'local',
        nombre: found.razon_social || found.nombre || '',
        email: found.email || '',
        telefono: found.telefono || '',
      };
    }
  } catch (_) { /* seguimos a RENIEC/SUNAT */ }

  // 2) RENIEC (DNI) / SUNAT (RUC) — requiere PERUAPI_KEY en el backend.
  try {
    const endpoint = tipo === 'DNI' ? `/facturacion/buscar-dni/${numero}` : `/facturacion/buscar-ruc/${numero}`;
    const r = await api.get(endpoint);
    const d = r?.data || r;
    if (d && (d.nombre_completo || d.razon_social || d.nombre)) {
      return {
        encontrado: true,
        fuente: tipo === 'DNI' ? 'reniec' : 'sunat',
        nombre: d.nombre_completo || d.razon_social || d.nombre || '',
        email: '',
        telefono: '',
      };
    }
  } catch (_) { /* no encontrado en ningún lado */ }

  return vacio;
}
