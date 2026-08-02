// ============================================================
// FUENTE ÚNICA de permisos de VISTA en el front. La usan el sidebar (Layout) y la
// guarda de rutas. Estado por vista: 'full' | 'vitrina' (~perm, solo lectura) | 'hidden'.
// El array user.permisos viene del backend (login/me). owner y admin ven todo.
// ============================================================

// Default cuando permisos no es array (usuarios legacy / owner sin array explícito).
const DEFAULT_PERMISOS = ['dashboard', 'cotizador', 'insumos', 'materiales', 'preparaciones', 'empaques', 'canales', 'ventas', 'finanzas', 'facturacion'];
// Claves viejas guardadas en BD → clave nueva (compatibilidad).
const PERM_ALIASES = { pl: 'finanzas', cotizador: 'cotizador', proyeccion: 'ventas', perdidas: 'finanzas' };

export function estadoVista(user, perm) {
  if (!perm) return 'full';
  if (user?.rol === 'admin' || user?.rol_empresa === 'owner') return 'full';
  const raw = Array.isArray(user?.permisos) ? user.permisos : DEFAULT_PERMISOS;
  if (raw.includes(perm)) return 'full';
  if (raw.includes(`~${perm}`)) return 'vitrina';
  const alias = PERM_ALIASES[perm];
  if (alias && raw.includes(alias)) return 'full';
  if (alias && raw.includes(`~${alias}`)) return 'vitrina';
  return 'hidden';
}

// Ruta → vista (perm). Solo rutas con acceso restringido; las que no están acá
// son SIEMPRE permitidas (perfil, tutoriales, feedback, actividad, etc.).
const RUTA_PERM = {
  '/dashboard': 'dashboard', '/stock': 'dashboard', '/margenes': 'dashboard', '/ficha-tecnica': 'dashboard',
  '/cotizador': 'cotizador',
  '/insumos': 'insumos', '/materiales': 'materiales',
  '/preparaciones-predeterminadas': 'preparaciones', '/empaques-predeterminados': 'empaques',
  '/canales': 'canales',
  '/pos': 'ventas', '/mesas': 'ventas', '/pl/ventas': 'ventas', '/proyeccion': 'ventas',
  '/comprobantes': 'facturacion', '/clientes': 'facturacion',
  '/pl': 'finanzas', '/pl/resumen': 'finanzas', '/pl/estado-resultados': 'finanzas', '/pl/tasas': 'finanzas',
  '/pl/gastos': 'finanzas', '/pl/compras': 'finanzas', '/pl/cashflow': 'finanzas',
  '/perdidas': 'finanzas', '/proveedores': 'finanzas', '/comisiones': 'finanzas', '/equipo': 'finanzas',
};

function permDeRuta(pathname) {
  if (RUTA_PERM[pathname]) return RUTA_PERM[pathname];
  // rutas con parámetro (/mesas/5, /cotizador/3, /ficha-tecnica/7) → probar el base
  const base = pathname.replace(/\/[^/]+$/, '');
  if (base && RUTA_PERM[base]) return RUTA_PERM[base];
  return null; // ruta sin perm conocido → permitida
}

export function puedeVerRuta(user, pathname) {
  if (user?.rol === 'admin' || user?.rol_empresa === 'owner') return true;
  const perm = permDeRuta(pathname);
  if (!perm) return true;
  return estadoVista(user, perm) !== 'hidden';
}

// Primera ruta que el usuario SÍ puede ver (destino del redirect). /perfil siempre existe.
const PRIORIDAD = ['/dashboard', '/pos', '/pl/ventas', '/comprobantes', '/insumos', '/canales', '/pl/resumen'];
export function primeraRutaPermitida(user) {
  for (const p of PRIORIDAD) if (puedeVerRuta(user, p)) return p;
  return '/perfil';
}
