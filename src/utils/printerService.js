// ============================================================
// printerService — CASCADA de impresión térmica, compatible con CUALQUIER
// navegador. Decide la mejor vía disponible y por ahí manda los bytes
// (que SIEMPRE genera el backend: /print/*/raw — fuente única escpos.js).
//
//   1º WebUSB        — Chrome/Edge desktop + Chrome Android (0 instalación)
//   2º Agente local  — Kudi Print en http://127.0.0.1:9631 (Arc, Safari,
//                      Firefox, Brave… cualquier navegador; USB o red local)
//   3º (el caller decide su fallback: TCP servidor o ticket HTML)
//
// Los navegadores permiten fetch a 127.0.0.1 desde páginas https (localhost
// está exento de mixed-content), así que el agente funciona en todos.
// ============================================================
import * as webusb from './webusbPrinter';

const AGENT_URL = 'http://127.0.0.1:9631';
const AGENT_TIMEOUT_MS = 900;

async function fetchAgente(path, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), AGENT_TIMEOUT_MS);
  try {
    return await fetch(`${AGENT_URL}${path}`, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

// Estado de las vías — para mostrar en la UI qué hay disponible.
// { webusb: bool, webusbConectada: bool, agente: false | {via, impresora} }
export async function detectarVias() {
  const estado = { webusb: webusb.soportaWebUSB(), webusbConectada: false, agente: false };
  if (estado.webusb) {
    try { estado.webusbConectada = webusb.impresoraConectada() || await webusb.autoDetectar(); } catch { /* noop */ }
  }
  try {
    const r = await fetchAgente('/status');
    if (r.ok) {
      const j = await r.json();
      if (j.ok) estado.agente = { via: j.via, impresora: j.impresora };
    }
  } catch { /* agente no corriendo */ }
  return estado;
}

// Imprime bytes base64 por la mejor vía. Devuelve la vía usada.
// Lanza error si ninguna vía directa está disponible (el caller hace su fallback).
export async function imprimirBase64(b64) {
  // 1º WebUSB
  if (webusb.soportaWebUSB()) {
    try {
      if (webusb.impresoraConectada() || await webusb.autoDetectar()) {
        await webusb.imprimirBase64(b64);
        return 'usb';
      }
    } catch { /* picker roto (Arc/Brave) o error de transferencia → probar agente */ }
  }
  // 2º Agente local
  try {
    const r = await fetchAgente('/print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bytes: b64 }),
    });
    if (r.ok) {
      const j = await r.json();
      if (j.ok) return 'agente';
      throw new Error(j.error || 'Agente falló');
    }
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error || 'Agente falló');
  } catch (e) {
    if (e.name === 'AbortError' || e.message?.includes('fetch')) {
      throw new Error('SIN_VIA_DIRECTA');
    }
    throw e;
  }
}

export function hayViaDirectaProbable() {
  // barato y síncrono: para decidir si intentar la cascada antes del fallback
  return true; // la cascada resuelve sola en <1s; siempre vale intentar
}

export { webusb };
