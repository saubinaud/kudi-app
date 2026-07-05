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

// Fallback universal: abre una ventana 80mm imprimible con el navegador (para quien
// NO tiene impresora térmica directa — usa el diálogo de impresión del sistema).
// data = { items:[{nombre,cantidad,precio_unitario,subtotal?}], totales:{base,igv,total} }
export function imprimirPrecuentaHTML(titulo, data, logoUrl) {
  const fmt = (n) => 'S/' + (Number(n) || 0).toFixed(2);
  const items = (data?.items || []).map((it) => {
    const cant = parseFloat(it.cantidad) || 1;
    const imp = it.subtotal != null ? parseFloat(it.subtotal) : cant * (parseFloat(it.precio_unitario) || 0);
    return `<tr><td>${cant}× ${String(it.nombre || 'Producto').replace(/</g, '&lt;')}</td><td style="text-align:right">${fmt(imp)}</td></tr>`;
  }).join('');
  const t = data?.totales || {};
  const igvRow = t.igv > 0 ? `<tr><td>Subtotal</td><td style="text-align:right">${fmt(t.base)}</td></tr><tr><td>IGV</td><td style="text-align:right">${fmt(t.igv)}</td></tr>` : '';
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Precuenta</title>
    <style>@page{size:80mm auto;margin:3mm}body{width:72mm;margin:0 auto;font:12px/1.4 monospace;color:#000}
    h1{font-size:15px;text-align:center;margin:2px 0}.sub{text-align:center;font-size:11px;margin:0 0 6px}
    hr{border:none;border-top:1px dashed #000;margin:6px 0}table{width:100%;border-collapse:collapse}
    td{padding:1px 0}.tot td{font-weight:bold;font-size:14px;padding-top:4px}
    .logo{display:block;max-width:60mm;max-height:28mm;margin:0 auto 4px;object-fit:contain}</style></head>
    <body onload="(function(){var i=document.querySelector('.logo');if(i&&!i.complete){i.onload=i.onerror=function(){print();setTimeout(close,300)};}else{print();setTimeout(close,300)}})()">
    ${logoUrl ? `<img class="logo" src="${logoUrl}" onerror="this.remove()">` : ''}
    <h1>PRECUENTA</h1><p class="sub">${titulo || ''}<br>*** NO ES COMPROBANTE DE PAGO ***</p><hr>
    <table>${items}</table><hr><table>${igvRow}<tr class="tot"><td>TOTAL</td><td style="text-align:right">${fmt(t.total)}</td></tr></table>
    <p class="sub" style="margin-top:8px">Gracias por su preferencia</p></body></html>`;
  const w = window.open('', '_blank', 'width=380,height=600');
  if (w) { w.document.write(html); w.document.close(); }
}

export function hayViaDirectaProbable() {
  // barato y síncrono: para decidir si intentar la cascada antes del fallback
  return true; // la cascada resuelve sola en <1s; siempre vale intentar
}

export { webusb };
