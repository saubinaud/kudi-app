import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { cx } from '../styles/tokens';
import { formatCurrency } from '../utils/format';
import { precioComercial } from '../utils/redondeo';
import { desglosarIGV } from '../utils/igv';
import ProductGrid from '../components/ProductGrid';
import PagoSheet from '../components/PagoSheet';
import { API_BASE } from '../config/api';
import { ArrowLeft, Clock, Users, Minus, Plus, Trash2, X, Package, CheckCircle, Banknote, CreditCard, Smartphone, Send, FileText, ShoppingCart } from 'lucide-react';

function formatTimer(abiertaAt) {
  if (!abiertaAt) return '';
  const diff = Math.floor((Date.now() - new Date(abiertaAt).getTime()) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m`;
}

const METODOS_PAGO = [
  { key: 'efectivo', label: 'Efectivo', icon: Banknote },
  { key: 'yape', label: 'Yape', icon: Smartphone },
  { key: 'transferencia', label: 'Transfer.', icon: CreditCard },
];

export default function MesaDetailPage() {
  const { mesaId } = useParams();
  const api = useApi();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  // Mesa info (loaded immediately, no session needed)
  const [mesaInfo, setMesaInfo] = useState(null);
  // Session (null if mesa not yet opened)
  const [sesion, setSesion] = useState(null);
  // Items from DB (for existing session)
  const [dbItems, setDbItems] = useState([]);
  // Local items (not yet in DB, before first comandar)
  const [localItems, setLocalItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  // Products
  const [productos, setProductos] = useState([]);
  const [loadingProductos, setLoadingProductos] = useState(true);
  const [posSearch, setPosSearch] = useState('');

  // Variant modal
  const [variantModal, setVariantModal] = useState(null);

  // Actions
  const [comandando, setComandando] = useState(false);
  const [showPrecuenta, setShowPrecuenta] = useState(false);
  const [precuentaData, setPrecuentaData] = useState(null);
  const [showCobrar, setShowCobrar] = useState(false);
  const [cobrando, setCobrando] = useState(false);

  // Payment — el estado de pago (metodo, mixto, comision, vuelto) vive en <PagoSheet>,
  // compartido con el POS. Aqui solo el toggle Con/Sin IGV (afecta los montos).
  const [conIgv, setConIgv] = useState(user?.tipo_negocio !== 'informal');

  // Post-sale
  const [lastSaleId, setLastSaleId] = useState(null);
  const [lastSaleCode, setLastSaleCode] = useState(null);
  const [lastSaleItems, setLastSaleItems] = useState([]);
  const [emittingBoleta, setEmittingBoleta] = useState(false);
  const [lastSaleConIgv, setLastSaleConIgv] = useState(true); // sin IGV -> ticket referencial, no boleta

  const tasaIgvPOS = parseFloat(user?.igv_rate) || 0; // tasa real configurada (empresa), no se asume 18%
  const comisionPosPct = parseFloat(user?.comision_pos) || 0;
  // Redondeo comercial del precio cobrado (con IGV). DEFAULT 'variable'.
  const precioMode = user?.precio_decimales || 'variable';

  // Load mesa + session in one call, and products in parallel
  useEffect(() => {
    const load = async () => {
      try {
        const [mesaRes, prodRes] = await Promise.all([
          api.get(`/mesas/${mesaId}/sesion-activa`),
          api.get('/productos'),
        ]);
        const mesaData = mesaRes?.data || mesaRes;
        setMesaInfo(mesaData.mesa);
        if (mesaData.sesion) {
          // Check if this is a secondary (linked) session
          if (mesaData.sesion.sesion_principal_id) {
            // Find primary mesa and redirect
            const estadoRes = await api.get('/mesas/estado');
            const allMesas = (estadoRes?.data || estadoRes).mesas || [];
            const primary = allMesas.find(m => m.sesion_id === mesaData.sesion.sesion_principal_id);
            if (primary) {
              navigate(`/mesas/${primary.id}`, { replace: true });
              return;
            }
          }
          setSesion(mesaData.sesion);
          setDbItems(mesaData.items || []);
        }
        setProductos((prodRes?.data || prodRes || []).filter(p => p.tipo_producto !== 'no_transformable' || p.disponible_venta));
        setLoadingProductos(false);
      } catch (err) {
        console.error('Load mesa:', err);
        toast.error('Error cargando mesa');
        navigate(`/mesas${mesaInfo?.piso_id ? `?piso=${mesaInfo.piso_id}` : ''}`);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [mesaId]); // eslint-disable-line

  // Timer
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(iv);
  }, []);

  // All items (DB + local)
  const allItems = useMemo(() => [...dbItems, ...localItems], [dbItems, localItems]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    if (!posSearch) return productos;
    const q = posSearch.toLowerCase();
    return productos.filter(p => p.nombre.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q));
  }, [productos, posSearch]);

  // Precio cobrado (con IGV) redondeado comercialmente, coherente con el POS.
  const getDisplayPrice = (p) => precioComercial(parseFloat(p.precio_final) || 0, precioMode);

  // Add product (to local items if no session, or to DB if session exists)
  const addProduct = async (product) => {
    if (product.variantes?.length > 0) { setVariantModal(product); return; }
    const precio = precioComercial(parseFloat(product.precio_final) || 0, precioMode);

    if (sesion) {
      // Session exists: check for existing pending item
      const existing = dbItems.find(i => i.producto_id === product.id && !i.variante_id && i.estado === 'pendiente');
      if (existing) {
        try {
          const res = await api.put(`/mesas/sesion/${sesion.id}/items/${existing.id}`, { cantidad: parseFloat(existing.cantidad) + 1 });
          setDbItems(prev => prev.map(i => i.id === existing.id ? (res?.data || res) : i));
        } catch { toast.error('Error actualizando cantidad'); }
        return;
      }
      try {
        const res = await api.post(`/mesas/sesion/${sesion.id}/items`, {
          items: [{ producto_id: product.id, nombre: product.nombre, precio_unitario: precio, cantidad: 1 }]
        });
        const newItems = res?.data || res;
        setDbItems(prev => [...prev, ...(Array.isArray(newItems) ? newItems : [newItems])]);
      } catch { toast.error('Error agregando producto'); }
    } else {
      // No session: add to local items
      const existing = localItems.findIndex(i => i.producto_id === product.id && !i.variante_id);
      if (existing >= 0) {
        setLocalItems(prev => prev.map((it, idx) => idx === existing ? { ...it, cantidad: it.cantidad + 1 } : it));
        return;
      }
      setLocalItems(prev => [...prev, {
        _local: true, _id: Date.now(),
        producto_id: product.id, variante_id: null, nombre: product.nombre,
        precio_unitario: precio, cantidad: 1, descuento: 0, estado: 'pendiente',
      }]);
    }
  };

  const addVariant = async (product, variant) => {
    setVariantModal(null);
    const precioRaw = parseFloat(variant.precio_final) || parseFloat(product.precio_final) || 0;
    const precio = precioComercial(precioRaw, precioMode);
    const nombre = `${product.nombre} — ${variant.nombre}`;

    if (sesion) {
      const existing = dbItems.find(i => i.variante_id === variant.id && i.estado === 'pendiente');
      if (existing) {
        try {
          const res = await api.put(`/mesas/sesion/${sesion.id}/items/${existing.id}`, { cantidad: parseFloat(existing.cantidad) + 1 });
          setDbItems(prev => prev.map(i => i.id === existing.id ? (res?.data || res) : i));
        } catch { toast.error('Error actualizando cantidad'); }
        return;
      }
      try {
        const res = await api.post(`/mesas/sesion/${sesion.id}/items`, {
          items: [{ producto_id: product.id, variante_id: variant.id, nombre, precio_unitario: precio, cantidad: 1 }]
        });
        const newItems = res?.data || res;
        setDbItems(prev => [...prev, ...(Array.isArray(newItems) ? newItems : [newItems])]);
      } catch { toast.error('Error agregando variante'); }
    } else {
      const existing = localItems.findIndex(i => i.variante_id === variant.id);
      if (existing >= 0) {
        setLocalItems(prev => prev.map((it, idx) => idx === existing ? { ...it, cantidad: it.cantidad + 1 } : it));
        return;
      }
      setLocalItems(prev => [...prev, {
        _local: true, _id: Date.now(),
        producto_id: product.id, variante_id: variant.id, nombre,
        precio_unitario: precio, cantidad: 1, descuento: 0, estado: 'pendiente',
      }]);
    }
  };

  const updateItemQty = async (item, delta) => {
    const newQty = Math.max(1, parseFloat(item.cantidad) + delta);
    if (item._local) {
      setLocalItems(prev => prev.map(i => i._id === item._id ? { ...i, cantidad: newQty } : i));
    } else if (sesion) {
      try {
        const res = await api.put(`/mesas/sesion/${sesion.id}/items/${item.id}`, { cantidad: newQty });
        setDbItems(prev => prev.map(i => i.id === item.id ? (res?.data || res) : i));
      } catch { toast.error('Error'); }
    }
  };

  const removeItem = async (item) => {
    if (item._local) {
      setLocalItems(prev => prev.filter(i => i._id !== item._id));
    } else if (sesion) {
      try {
        await api.del(`/mesas/sesion/${sesion.id}/items/${item.id}`);
        setDbItems(prev => prev.filter(i => i.id !== item.id));
      } catch { toast.error('Error eliminando'); }
    }
  };

  // Comandar — creates session if needed
  const handleComandar = async () => {
    const pendientes = allItems.filter(i => i.estado === 'pendiente');
    if (pendientes.length === 0) { toast.error('No hay items pendientes'); return; }
    setComandando(true);
    try {
      let sessionId = sesion?.id;
      // Create session if it doesn't exist
      if (!sessionId) {
        const abrirRes = await api.post(`/mesas/${mesaId}/abrir`, { comensales: 1 });
        const newSesion = abrirRes?.data || abrirRes;
        sessionId = newSesion.id;
        setSesion(newSesion);
      }
      // Add local items to DB if any
      if (localItems.length > 0) {
        const res = await api.post(`/mesas/sesion/${sessionId}/items`, {
          items: localItems.map(i => ({
            producto_id: i.producto_id, variante_id: i.variante_id, nombre: i.nombre,
            precio_unitario: i.precio_unitario, cantidad: i.cantidad,
          }))
        });
        const created = res?.data || res;
        setDbItems(prev => [...prev, ...(Array.isArray(created) ? created : [created])]);
        setLocalItems([]);
      }
      // Comandar
      const res = await api.post(`/mesas/sesion/${sessionId}/comandar`);
      const data = res?.data || res;
      toast.success(`Comanda #${data.comanda_num} enviada`);
      // Refresh items
      const sesionRes = await api.get(`/mesas/sesion/${sessionId}`);
      const sesionData = sesionRes?.data || sesionRes;
      setSesion(sesionData);
      setDbItems(sesionData.items || []);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Error comandando');
    } finally {
      setComandando(false);
    }
  };

  // Precuenta
  const handlePrecuenta = async () => {
    if (!sesion) return;
    try {
      const res = await api.get(`/mesas/sesion/${sesion.id}/precuenta`);
      setPrecuentaData(res?.data || res);
      setShowPrecuenta(true);
    } catch { toast.error('Error generando precuenta'); }
  };

  // Total corriente del pedido (con IGV) — para el panel y el boton "Cobrar".
  const subtotal = useMemo(() =>
    allItems.reduce((sum, i) => sum + (parseFloat(i.precio_unitario) * parseFloat(i.cantidad)) - (parseFloat(i.descuento) || 0), 0),
    [allItems]
  );

  // IGV identico al POS: la tasa real se usa incluso para informal (simulacion).
  const esInformal = user?.tipo_negocio === 'informal';

  // Precio cobrado por item segun toggle Con/Sin IGV — ESPEJO del POS (itemPrecio/addToCart):
  //   informal: el precio guardado es la BASE -> Con IGV simula (x(1+tasa)); Sin IGV = base.
  //   formal:   el precio guardado YA incluye IGV -> Sin IGV = /(1+tasa).
  const precioCobradoItem = (precioFinal, con) => {
    const pf = precioComercial(parseFloat(precioFinal) || 0, precioMode);
    if (esInformal) return con ? precioComercial(pf * (1 + tasaIgvPOS), precioMode) : pf;
    return con ? pf : (tasaIgvPOS > 0 ? precioComercial(pf / (1 + tasaIgvPOS), precioMode) : pf);
  };

  const cobroDesglose = useMemo(() => {
    let cobrado = 0;
    for (const i of allItems) {
      cobrado += (precioCobradoItem(i.precio_unitario, conIgv) * parseFloat(i.cantidad)) - (parseFloat(i.descuento) || 0);
    }
    cobrado = Math.round(cobrado * 100) / 100;
    const { base, igv } = (conIgv && tasaIgvPOS > 0)
      ? desglosarIGV(cobrado, tasaIgvPOS)
      : { base: cobrado, igv: 0 };
    return { base, igv, cobrado };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allItems, conIgv, tasaIgvPOS, esInformal, precioMode]);

  const total = cobroDesglose.cobrado;

  const metodosPago = useMemo(() => [
    ...METODOS_PAGO,
    ...(comisionPosPct > 0 ? [{ key: 'tarjeta', label: `Tarjeta +${comisionPosPct}%`, icon: CreditCard }] : []),
  ], [comisionPosPct]);

  // Cobrar — recibe la decision de pago desde <PagoSheet>.
  const handleCobrar = async ({ conIgv: ventaConIgv, metodoPago: metodoPagoFinal, pagoDetalle, comisionTarjeta }) => {
    if (!sesion || allItems.length === 0) return;
    setCobrando(true);
    try {
      // El back es autoridad de precios: recibe la DECISION (con_igv) y la tasa
      // efectiva (igual que el POS, con fallback) y recalcula identico.
      const res = await api.post(`/mesas/sesion/${sesion.id}/cobrar`, {
        con_igv: ventaConIgv, igv_rate: tasaIgvPOS, metodo_pago: metodoPagoFinal, pago_detalle: pagoDetalle, comision_tarjeta: comisionTarjeta,
      });
      const venta = res?.data || res;
      setLastSaleId(venta.id);
      setLastSaleCode(venta.codigo_pedido || venta.nro_pedido);
      setLastSaleConIgv(ventaConIgv); // sin IGV -> ticket referencial; con IGV -> boleta
      // lastSaleItems para la boleta: precio cobrado + tasa efectiva por item (espejo del back).
      const itemIgvRate = ventaConIgv ? tasaIgvPOS : 0;
      setLastSaleItems(allItems.map(i => ({
        producto_id: i.producto_id, producto_nombre: i.nombre,
        cantidad: parseFloat(i.cantidad), precio_unitario: precioCobradoItem(i.precio_unitario, ventaConIgv),
        igv_rate: itemIgvRate, descuento: parseFloat(i.descuento) || 0,
      })));
      setShowCobrar(false);
      toast.success('Mesa cobrada');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Error cobrando');
    } finally {
      setCobrando(false);
    }
  };

  // Cancel
  const handleCancelar = async () => {
    if (sesion) {
      try { await api.del(`/mesas/sesion/${sesion.id}`); } catch {}
    }
    navigate(`/mesas${mesaInfo?.piso_id ? `?piso=${mesaInfo.piso_id}` : ''}`);
  };

  // Group items by comanda
  const groupedItems = useMemo(() => {
    const comandados = dbItems.filter(i => i.estado === 'comandado');
    const pendientesDb = dbItems.filter(i => i.estado === 'pendiente');
    const groups = {};
    for (const item of comandados) {
      const key = item.comanda_num || 0;
      if (!groups[key]) groups[key] = { num: key, comandado_at: item.comandado_at, items: [] };
      groups[key].items.push(item);
    }
    return {
      comandas: Object.values(groups).sort((a, b) => a.num - b.num),
      pendientes: [...pendientesDb, ...localItems],
    };
  }, [dbItems, localItems]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className={cx.skeleton + ' h-8 w-48 mb-6'} />
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
              {[1,2,3,4,5,6].map(i => <div key={i} className={cx.skeleton + ' aspect-square rounded-xl'} />)}
            </div>
          </div>
          <div className="lg:w-80 xl:w-96"><div className={cx.skeleton + ' h-96 rounded-xl'} /></div>
        </div>
      </div>
    );
  }

  if (!mesaInfo) return null;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(`/mesas${mesaInfo?.piso_id ? `?piso=${mesaInfo.piso_id}` : ''}`)} className={cx.btnIcon}><ArrowLeft size={20} /></button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-stone-800">
            Mesa {mesaInfo.numero}
            {mesaInfo.nombre && <span className="text-stone-400 font-normal text-sm ml-2">{mesaInfo.nombre}</span>}
          </h1>
          {sesion && (
            <div className="flex items-center gap-3 text-xs text-stone-500 mt-0.5">
              <span className="flex items-center gap-1"><Clock size={12} /> {formatTimer(sesion.abierta_at)}</span>
              <span className="flex items-center gap-1"><Users size={12} /> {sesion.comensales}</span>
            </div>
          )}
        </div>
        <button onClick={handleCancelar} className={cx.btnDanger + ' text-xs'}>
          {sesion ? 'Cancelar mesa' : 'Volver'}
        </button>
      </div>

      {/* Main layout */}
      <div className="flex flex-col lg:flex-row gap-4 pb-20 lg:pb-0">
        <ProductGrid
          products={filteredProducts}
          search={posSearch}
          onSearchChange={setPosSearch}
          onProductClick={addProduct}
          loading={loadingProductos}
          getDisplayPrice={getDisplayPrice}
        />

        {/* Session panel */}
        <div className="lg:w-80 xl:w-96 flex-shrink-0">
          <div className={cx.card + ' p-4 lg:sticky lg:top-4'}>
            <AnimatePresence mode="wait">
            {showCobrar ? (
            <motion.div key="cobro" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.15 }} className="space-y-4 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
              {/* Cobro INLINE — mismo diseño que el POS (no modal). */}
              <button onClick={() => setShowCobrar(false)} className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 transition-colors duration-100 -mb-1">
                <ArrowLeft size={12} /> Volver al pedido
              </button>
              <h3 className="font-bold text-stone-800 text-sm">Cobrar Mesa {mesaInfo.numero}</h3>
              <PagoSheet
                conIgv={conIgv}
                setConIgv={setConIgv}
                tasaIgv={tasaIgvPOS}
                precioMode={precioMode}
                base={cobroDesglose.base}
                igv={cobroDesglose.igv}
                comisionPosPct={comisionPosPct}
                metodosPago={metodosPago}
                confirmLabel="Confirmar cobro"
                confirming={cobrando}
                onConfirm={handleCobrar}
              />
            </motion.div>
            ) : (
            <motion.div key="pedido" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.15 }}>
            <h3 className="font-bold text-stone-800 text-sm mb-3 flex items-center justify-between">
              <span>Pedido · {allItems.length} items</span>
              <span className="text-base font-bold text-[var(--accent)]">{formatCurrency(subtotal)}</span>
            </h3>

            <div className="max-h-[50vh] overflow-y-auto space-y-3 mb-4">
              {groupedItems.comandas.map(comanda => (
                <div key={comanda.num}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">Comanda #{comanda.num}</span>
                    {comanda.comandado_at && (
                      <span className="text-[10px] text-stone-400">{new Date(comanda.comandado_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                  </div>
                  {comanda.items.map(item => (
                    <div key={item.id} className="flex items-center gap-2 py-1.5 border-b border-stone-100 last:border-0">
                      <div className="flex-1 min-w-0"><p className="text-xs font-medium text-stone-700 truncate">{item.nombre}</p></div>
                      <span className="text-xs text-stone-500">×{parseInt(item.cantidad)}</span>
                      <span className="text-xs font-semibold text-stone-800 w-16 text-right">{formatCurrency(parseFloat(item.precio_unitario) * parseFloat(item.cantidad))}</span>
                    </div>
                  ))}
                </div>
              ))}

              {groupedItems.pendientes.length > 0 && (
                <div>
                  <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">Pendientes</span>
                  {groupedItems.pendientes.map((item, idx) => (
                    <div key={item.id || item._id} className="flex items-center gap-2 py-1.5 border-b border-stone-100 last:border-0">
                      <div className="flex-1 min-w-0"><p className="text-xs font-medium text-stone-700 truncate">{item.nombre}</p></div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateItemQty(item, -1)} className="w-6 h-6 rounded bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500"><Minus size={12} /></button>
                        <span className="text-xs font-medium w-5 text-center">{parseInt(item.cantidad)}</span>
                        <button onClick={() => updateItemQty(item, 1)} className="w-6 h-6 rounded bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500"><Plus size={12} /></button>
                      </div>
                      <span className="text-xs font-semibold text-stone-800 w-16 text-right">{formatCurrency(parseFloat(item.precio_unitario) * parseFloat(item.cantidad))}</span>
                      <button onClick={() => removeItem(item)} className="text-stone-300 hover:text-rose-500 transition-colors"><X size={16} /></button>
                    </div>
                  ))}
                </div>
              )}

              {allItems.length === 0 && (
                <div className="py-8 text-center">
                  <Package size={20} className="text-stone-300 mx-auto mb-2" />
                  <p className="text-stone-400 text-xs">Selecciona productos para empezar</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-2">
              {groupedItems.pendientes.length > 0 && (
                <button onClick={handleComandar} disabled={comandando}
                  className={cx.btnSecondary + ' w-full flex items-center justify-center gap-2 min-h-[44px]'}>
                  {comandando ? <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" /> : <Send size={16} />}
                  Comandar ({groupedItems.pendientes.length})
                </button>
              )}
              {sesion && dbItems.length > 0 && (
                <>
                  <button onClick={handlePrecuenta} className={cx.btnGhost + ' w-full flex items-center justify-center gap-2 min-h-[44px]'}>
                    <FileText size={16} /> Precuenta
                  </button>
                  <button onClick={() => setShowCobrar(true)} className={cx.btnPrimary + ' w-full flex items-center justify-center gap-2 min-h-[44px] text-base'}>
                    <ShoppingCart size={16} /> Cobrar {formatCurrency(subtotal)}
                  </button>
                </>
              )}
            </div>
            </motion.div>
            )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Variant modal */}
      {variantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setVariantModal(null)} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xs p-5">
            <h3 className="font-bold text-stone-800 mb-3">{variantModal.nombre}</h3>
            <div className="space-y-2">
              {variantModal.variantes.map(v => (
                <button key={v.id} onClick={() => addVariant(variantModal, v)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-stone-200 hover:border-stone-400 hover:bg-stone-50 transition-colors">
                  <span className="text-sm font-medium text-stone-700">{v.nombre}</span>
                  <span className="text-sm font-bold text-[var(--accent)]">{formatCurrency(precioComercial(parseFloat(v.precio_final) || 0, precioMode))}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setVariantModal(null)} className={cx.btnGhost + ' w-full mt-3'}>Cancelar</button>
          </motion.div>
        </div>
      )}

      {/* Precuenta */}
      <AnimatePresence>
        {showPrecuenta && precuentaData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowPrecuenta(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="text-center mb-4">
                <h3 className="text-lg font-bold text-stone-900">Precuenta</h3>
                <p className="text-sm text-stone-500">Mesa {mesaInfo.numero}</p>
              </div>
              <div className="border-t border-b border-stone-200 py-3 mb-3 space-y-1.5">
                {(precuentaData.items || []).map(item => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-stone-700">{parseInt(item.cantidad)}× {item.nombre}</span>
                    <span className="font-medium text-stone-800">{formatCurrency(parseFloat(item.precio_unitario) * parseFloat(item.cantidad))}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1 text-sm">
                {precuentaData.totales?.igv > 0 && (
                  <>
                    <div className="flex justify-between text-stone-500"><span>Subtotal</span><span>{formatCurrency(precuentaData.totales.base)}</span></div>
                    <div className="flex justify-between text-stone-500"><span>IGV</span><span>{formatCurrency(precuentaData.totales.igv)}</span></div>
                  </>
                )}
                <div className="flex justify-between text-lg font-bold text-stone-900 pt-2 border-t border-stone-200">
                  <span>Total</span><span>{formatCurrency(precuentaData.totales?.total)}</span>
                </div>
              </div>
              <button onClick={() => setShowPrecuenta(false)} className={cx.btnSecondary + ' w-full mt-5'}>Cerrar</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Post-sale */}
      {lastSaleId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} className="text-emerald-600" /></div>
            <h3 className="text-xl font-bold text-stone-900 mb-1">Mesa cobrada</h3>
            {lastSaleCode && <p className="text-sm text-stone-500 font-mono mb-4">{lastSaleCode}</p>}
            <div className="space-y-2">
              {lastSaleConIgv ? (
              <button disabled={emittingBoleta} onClick={async () => {
                setEmittingBoleta(true);
                try {
                  const res = await api.post('/facturacion/emitir', { venta_id: lastSaleId, tipo: 'boleta', items: lastSaleItems });
                  const d = res?.data || res;
                  if (d.sunat?.success) toast.success(`Boleta: ${d.comprobante?.serie}-${d.comprobante?.correlativo}`);
                  else toast.error(`SUNAT: ${d.sunat?.message || 'Error'}`);
                } catch (err) { toast.error(err.message || 'Error'); }
                finally { setEmittingBoleta(false); navigate(`/mesas${mesaInfo?.piso_id ? `?piso=${mesaInfo.piso_id}` : ''}`); }
              }} className={cx.btnPrimary + ' w-full py-2.5 text-sm'}>
                {emittingBoleta ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Emitiendo...</span> : 'Emitir boleta'}
              </button>
              ) : (
              <button onClick={() => {
                window.open(`${API_BASE.replace('/api','')}/api/ticket/venta/${lastSaleId}?token=${localStorage.getItem('nodum_token')}`, '_blank');
                navigate(`/mesas${mesaInfo?.piso_id ? `?piso=${mesaInfo.piso_id}` : ''}`);
              }} className={cx.btnPrimary + ' w-full py-2.5 text-sm'} title="Venta sin IGV: no se emite comprobante oficial SUNAT">
                Ticket referencial
              </button>
              )}
              <button onClick={() => navigate(`/mesas${mesaInfo?.piso_id ? `?piso=${mesaInfo.piso_id}` : ''}`)} className={cx.btnGhost + ' w-full py-2.5 text-sm'}>Volver a mesas</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
