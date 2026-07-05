// ============================================================
// webusbPrinter — transporte WebUSB hacia la ticketera térmica (ESC/POS).
// El navegador NO genera bytes: los pide al backend (/print/*/raw, fuente
// única escpos.js) y los transporta al endpoint OUT de la impresora USB.
//
// Flujo: conectar() una sola vez (diálogo de Chrome) → el permiso queda
// guardado → autoDetectar() la reconecta sola en cada sesión (getDevices()).
// Soportado: Chrome/Edge desktop y Chrome Android (tablets). Safari no.
// Validado en hardware: LN-POS80-BX (jul-2026).
// ============================================================

let device = null;
let epOut = null;
let ifaceNum = null;

export function soportaWebUSB() {
  return typeof navigator !== 'undefined' && !!navigator.usb;
}

export function impresoraConectada() {
  return !!(device && device.opened && epOut != null);
}

export function nombreImpresora() {
  return device ? (device.productName || 'Impresora USB') : null;
}

async function abrir(d) {
  await d.open();
  if (d.configuration === null) await d.selectConfiguration(1);
  for (const iface of d.configuration.interfaces) {
    for (const alt of iface.alternates) {
      const out = alt.endpoints.find((e) => e.direction === 'out');
      if (out) {
        ifaceNum = iface.interfaceNumber;
        epOut = out.endpointNumber;
        await d.claimInterface(ifaceNum);
        device = d;
        return true;
      }
    }
  }
  try { await d.close(); } catch { /* noop */ }
  throw new Error('La impresora no expone un canal de escritura USB');
}

// Reconexión silenciosa con un dispositivo ya autorizado. No abre diálogos.
export async function autoDetectar() {
  if (!soportaWebUSB()) return false;
  if (impresoraConectada()) return true;
  try {
    const previos = await navigator.usb.getDevices();
    if (previos.length === 0) return false;
    return await abrir(previos[0]);
  } catch {
    return false;
  }
}

// Primera vez: abre el selector de Chrome (requiere gesto del usuario).
export async function conectar() {
  if (!soportaWebUSB()) throw new Error('Este navegador no soporta impresión USB directa (usa Chrome)');
  const d = await navigator.usb.requestDevice({ filters: [] });
  return abrir(d);
}

export async function desconectar() {
  if (device) {
    try { await device.close(); } catch { /* noop */ }
  }
  device = null; epOut = null; ifaceNum = null;
}

// Imprime bytes ESC/POS (base64 del backend). Devuelve true si salió.
export async function imprimirBase64(b64) {
  if (!impresoraConectada()) {
    const ok = await autoDetectar();
    if (!ok) throw new Error('Impresora USB no conectada');
  }
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const r = await device.transferOut(epOut, bytes);
  if (r.status !== 'ok') throw new Error(`Transferencia USB: ${r.status}`);
  return true;
}
