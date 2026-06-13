import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { cx } from '../styles/tokens';
import { formatCurrency } from '../utils/format';
import ProductGrid from '../components/ProductGrid';
import { ArrowLeft, Clock, Users, Minus, Plus, Trash2, X, Package, CheckCircle, Banknote, CreditCard, Smartphone, Send, FileText, ShoppingCart, AlertTriangle } from 'lucide-react';

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

  // Session
  const [sesion, setSesion] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  // Products
  const [productos, setProductos] = useState([]);
  const [loadingProductos, setLoadingProductos] = useState(true);
  const [posSearch, setPosSearch] = useState('');

  // Variant modal
  const [variantModal, setVariantModal] = useState(null);

  // Action states
  const [comandando, setComandando] = useState(false);
  const [showPrecuenta, setShowPrecuenta] = useState(false);
  const [precuentaData, setPrecuentaData] = useState(null);
  const [showCobrar, setShowCobrar] = useState(false);
  const [cobrando, setCobrando] = useState(false);

  // Payment
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [pagaCon, setPagaCon] = useState('');
  const [pagoMixto, setPagoMixto] = useState(false);
  const [pagoPartes, setPagoPartes] = useState([
    { metodo: 'efectivo', monto: '', pagada: false, sinComision: false },
    { metodo: 'efectivo', monto: '', pagada: false, sinComision: false },
  ]);
  const [sinComisionTarjeta, setSinComisionTarjeta] = useState(false);

  // Post-sale
  const [lastSaleId, setLastSaleId] = useState(null);
  const [lastSaleCode, setLastSaleCode] = useState(null);
  const [lastSaleItems, setLastSaleItems] = useState([]);
  const [emittingBoleta, setEmittingBoleta] = useState(false);

  const esInformal = user?.tipo_negocio === 'informal';
  const tasaIgvPOS = parseFloat(user?.igv_rate) || 0.18;
  const comisionPosPct = parseFloat(user?.comision_pos) || 0;

  const fetchSesion = useCallback(async () => {
    try {
      // First find the active session for this mesa
      const estadoRes = await api.get('/mesas/estado');
      const estadoData = estadoRes?.data || estadoRes;
      const mesa = (estadoData.mesas || []).find(m => m.id === parseInt(mesaId));
      if (!mesa?.sesion_id) {
        toast.error('Esta mesa no tiene sesión activa');
        navigate('/mesas');
        return;
      }
      // If this is a secondary (linked) mesa, redirect to the primary
      if (mesa.sesion_principal_id) {
        const primaryMesa = (estadoData.mesas || []).find(m =>
          m.sesion_id === mesa.sesion_principal_id
        );
        if (primaryMesa) {
          navigate(`/mesas/${primaryMesa.id}`, { replace: true });
          return;
        }
      }
      const res = await api.get(`/mesas/sesion/${mesa.sesion_id}`);
      const data = res?.data || res;
      setSesion(data);
      setItems(data.items || []);
    } catch (err) {
      console.error('Fetch sesion:', err);
      toast.error('Error cargando sesión');
      navigate('/mesas');
    } finally {
      setLoading(false);
    }
  }, [mesaId]); // eslint-disable-line

  useEffect(() => {
    fetchSesion();
    // Load products
    api.get('/productos')
      .then(res => setProductos((res?.data || res || []).filter(p => p.tipo_producto !== 'no_transformable' || p.disponible_venta)))
      .finally(() => setLoadingProductos(false));
  }, [fetchSesion]); // eslint-disable-line

  // Timer update
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  // Filtered products
  const filteredProducts = useMemo(() => {
    if (!posSearch) return productos;
    const q = posSearch.toLowerCase();
    return productos.filter(p =>
      p.nombre.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)
    );
  }, [productos, posSearch]);

  // Get display price for a product
  const getDisplayPrice = (p) => {
    const precio = parseFloat(p.precio_final) || 0;
    if (esInformal) return precio;
    return precio;
  };

  // Get cart price for a product (the actual price to use)
  const getItemPrice = (product) => {
    const precioBase = parseFloat(product.precio_final) || 0;
    return precioBase;
  };

  // Add product to session
  const addProduct = async (product) => {
    if (product.variantes?.length > 0) {
      setVariantModal(product);
      return;
    }
    // Check if item already exists (not yet commanded)
    const existing = items.find(i => i.producto_id === product.id && !i.variante_id && i.estado === 'pendiente');
    if (existing) {
      try {
        const res = await api.put(`/mesas/sesion/${sesion.id}/items/${existing.id}`, {
          cantidad: parseFloat(existing.cantidad) + 1
        });
        setItems(prev => prev.map(i => i.id === existing.id ? (res?.data || res) : i));
      } catch {
        toast.error('Error actualizando cantidad');
      }
      return;
    }
    try {
      const res = await api.post(`/mesas/sesion/${sesion.id}/items`, {
        items: [{
          producto_id: product.id,
          nombre: product.nombre,
          precio_unitario: getItemPrice(product),
          cantidad: 1,
        }]
      });
      const newItems = res?.data || res;
      setItems(prev => [...prev, ...(Array.isArray(newItems) ? newItems : [newItems])]);
    } catch {
      toast.error('Error agregando producto');
    }
  };

  const addVariant = async (product, variant) => {
    setVariantModal(null);
    const existing = items.find(i => i.variante_id === variant.id && i.estado === 'pendiente');
    if (existing) {
      try {
        const res = await api.put(`/mesas/sesion/${sesion.id}/items/${existing.id}`, {
          cantidad: parseFloat(existing.cantidad) + 1
        });
        setItems(prev => prev.map(i => i.id === existing.id ? (res?.data || res) : i));
      } catch {
        toast.error('Error actualizando cantidad');
      }
      return;
    }
    try {
      const precio = parseFloat(variant.precio_final) || parseFloat(product.precio_final) || 0;
      const res = await api.post(`/mesas/sesion/${sesion.id}/items`, {
        items: [{
          producto_id: product.id,
          variante_id: variant.id,
          nombre: `${product.nombre} — ${variant.nombre}`,
          precio_unitario: precio,
          cantidad: 1,
        }]
      });
      const newItems = res?.data || res;
      setItems(prev => [...prev, ...(Array.isArray(newItems) ? newItems : [newItems])]);
    } catch {
      toast.error('Error agregando variante');
    }
  };

  const updateItemQty = async (item, delta) => {
    const newQty = Math.max(1, parseFloat(item.cantidad) + delta);
    try {
      const res = await api.put(`/mesas/sesion/${sesion.id}/items/${item.id}`, { cantidad: newQty });
      setItems(prev => prev.map(i => i.id === item.id ? (res?.data || res) : i));
    } catch {
      toast.error('Error actualizando cantidad');
    }
  };

  const removeItem = async (item) => {
    try {
      await api.del(`/mesas/sesion/${sesion.id}/items/${item.id}`);
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Error eliminando item');
    }
  };

  // Comandar
  const handleComandar = async () => {
    const pendientes = items.filter(i => i.estado === 'pendiente');
    if (pendientes.length === 0) {
      toast.error('No hay items pendientes para comandar');
      return;
    }
    setComandando(true);
    try {
      const res = await api.post(`/mesas/sesion/${sesion.id}/comandar`);
      const data = res?.data || res;
      toast.success(`Comanda #${data.comanda_num} enviada`);
      // Update items locally
      setItems(prev => prev.map(i =>
        i.estado === 'pendiente'
          ? { ...i, estado: 'comandado', comanda_num: data.comanda_num, comandado_at: new Date().toISOString() }
          : i
      ));
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Error comandando');
    } finally {
      setComandando(false);
    }
  };

  // Precuenta
  const handlePrecuenta = async () => {
    try {
      const res = await api.get(`/mesas/sesion/${sesion.id}/precuenta`);
      setPrecuentaData(res?.data || res);
      setShowPrecuenta(true);
    } catch {
      toast.error('Error generando precuenta');
    }
  };

  // Totals
  const subtotal = useMemo(() => {
    return items.reduce((sum, i) =>
      sum + (parseFloat(i.precio_unitario) * parseFloat(i.cantidad)) - (parseFloat(i.descuento) || 0)
    , 0);
  }, [items]);

  const comisionTarjeta = useMemo(() => {
    if (comisionPosPct === 0) return 0;
    if (pagoMixto) {
      return pagoPartes.reduce((sum, p) => {
        if (p.metodo === 'tarjeta' && !p.sinComision) {
          return sum + Math.round((parseFloat(p.monto) || 0) * comisionPosPct) / 100;
        }
        return sum;
      }, 0);
    }
    return (metodoPago === 'tarjeta' && !sinComisionTarjeta)
      ? Math.round(subtotal * comisionPosPct) / 100 : 0;
  }, [pagoMixto, pagoPartes, metodoPago, sinComisionTarjeta, subtotal, comisionPosPct]);

  const total = Math.round((subtotal + comisionTarjeta) * 100) / 100;

  const metodosPago = useMemo(() => [
    ...METODOS_PAGO,
    ...(comisionPosPct > 0 ? [{ key: 'tarjeta', label: `Tarjeta +${comisionPosPct}%`, icon: CreditCard }] : []),
  ], [comisionPosPct]);

  // Cobrar
  const handleCobrar = async () => {
    if (items.length === 0) return;
    setCobrando(true);
    try {
      let metodoPagoFinal = metodoPago;
      let pagoDetalle = null;
      if (pagoMixto) {
        const partes = pagoPartes.filter(p => parseFloat(p.monto) > 0);
        if (partes.length > 0) {
          metodoPagoFinal = 'mixto';
          pagoDetalle = partes.map(p => {
            const base = parseFloat(p.monto);
            const comision = (p.metodo === 'tarjeta' && !p.sinComision) ? Math.round(base * comisionPosPct) / 100 : 0;
            return { metodo: p.metodo, monto: base, comision_tarjeta: comision };
          });
        }
      }

      const res = await api.post(`/mesas/sesion/${sesion.id}/cobrar`, {
        metodo_pago: metodoPagoFinal,
        pago_detalle: pagoDetalle,
        comision_tarjeta: comisionTarjeta,
      });
      const venta = res?.data || res;
      setLastSaleId(venta.id);
      setLastSaleCode(venta.codigo_pedido || venta.nro_pedido);
      setLastSaleItems(items.map(i => ({
        producto_id: i.producto_id,
        producto_nombre: i.nombre,
        cantidad: parseFloat(i.cantidad),
        precio_unitario: parseFloat(i.precio_unitario),
        descuento: parseFloat(i.descuento) || 0,
      })));
      setShowCobrar(false);
      toast.success('Mesa cobrada');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Error cobrando');
    } finally {
      setCobrando(false);
    }
  };

  // Cancel session
  const handleCancelar = async () => {
    try {
      await api.del(`/mesas/sesion/${sesion.id}`);
      toast.success('Sesión cancelada');
      navigate('/mesas');
    } catch {
      toast.error('Error cancelando sesión');
    }
  };

  // Group items by comanda
  const groupedItems = useMemo(() => {
    const comandados = items.filter(i => i.estado === 'comandado');
    const pendientes = items.filter(i => i.estado === 'pendiente');
    const groups = {};
    for (const item of comandados) {
      const key = item.comanda_num || 0;
      if (!groups[key]) groups[key] = { num: key, comandado_at: item.comandado_at, items: [] };
      groups[key].items.push(item);
    }
    return { comandas: Object.values(groups).sort((a, b) => a.num - b.num), pendientes };
  }, [items]);

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
          <div className="lg:w-80 xl:w-96">
            <div className={cx.skeleton + ' h-96 rounded-xl'} />
          </div>
        </div>
      </div>
    );
  }

  if (!sesion) return null;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate('/mesas')} className={cx.btnIcon}>
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-stone-800">
            Mesa {sesion.mesa_numero}
            {sesion.mesa_nombre && <span className="text-stone-400 font-normal text-sm ml-2">{sesion.mesa_nombre}</span>}
          </h1>
          <div className="flex items-center gap-3 text-xs text-stone-500 mt-0.5">
            <span className="flex items-center gap-1">
              <Clock size={12} /> {formatTimer(sesion.abierta_at)}
            </span>
            <span className="flex items-center gap-1">
              <Users size={12} /> {sesion.comensales} {sesion.comensales === 1 ? 'comensal' : 'comensales'}
            </span>
          </div>
        </div>
        <button onClick={handleCancelar} className={cx.btnDanger + ' text-xs'}>
          Cancelar mesa
        </button>
      </div>

      {/* Main layout: Products + Session panel */}
      <div className="flex flex-col lg:flex-row gap-4 pb-20 lg:pb-0">
        {/* LEFT: Product Grid */}
        <ProductGrid
          products={filteredProducts}
          search={posSearch}
          onSearchChange={setPosSearch}
          onProductClick={addProduct}
          loading={loadingProductos}
          getDisplayPrice={getDisplayPrice}
        />

        {/* RIGHT: Session panel */}
        <div className="lg:w-80 xl:w-96 flex-shrink-0">
          <div className={cx.card + ' p-4 lg:sticky lg:top-4'}>
            <h3 className="font-bold text-stone-800 text-sm mb-3 flex items-center justify-between">
              <span>Pedido · {items.length} items</span>
              <span className="text-base font-bold text-[var(--accent)]">{formatCurrency(subtotal)}</span>
            </h3>

            {/* Ordered items by comanda */}
            <div className="max-h-[50vh] overflow-y-auto space-y-3 mb-4">
              {groupedItems.comandas.map(comanda => (
                <div key={comanda.num}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">
                      Comanda #{comanda.num}
                    </span>
                    {comanda.comandado_at && (
                      <span className="text-[10px] text-stone-400">
                        {new Date(comanda.comandado_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  {comanda.items.map(item => (
                    <div key={item.id} className="flex items-center gap-2 py-1.5 border-b border-stone-100 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-stone-700 truncate">{item.nombre}</p>
                      </div>
                      <span className="text-xs text-stone-500 whitespace-nowrap">×{parseInt(item.cantidad)}</span>
                      <span className="text-xs font-semibold text-stone-800 whitespace-nowrap w-16 text-right">
                        {formatCurrency(parseFloat(item.precio_unitario) * parseFloat(item.cantidad))}
                      </span>
                    </div>
                  ))}
                </div>
              ))}

              {/* Pending items */}
              {groupedItems.pendientes.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">
                      Pendientes
                    </span>
                  </div>
                  {groupedItems.pendientes.map(item => (
                    <div key={item.id} className="flex items-center gap-2 py-1.5 border-b border-stone-100 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-stone-700 truncate">{item.nombre}</p>
                        {item.nota && <p className="text-[10px] text-stone-400 truncate">{item.nota}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateItemQty(item, -1)} className="w-6 h-6 rounded bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500">
                          <Minus size={12} />
                        </button>
                        <span className="text-xs font-medium w-5 text-center">{parseInt(item.cantidad)}</span>
                        <button onClick={() => updateItemQty(item, 1)} className="w-6 h-6 rounded bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500">
                          <Plus size={12} />
                        </button>
                      </div>
                      <span className="text-xs font-semibold text-stone-800 whitespace-nowrap w-16 text-right">
                        {formatCurrency(parseFloat(item.precio_unitario) * parseFloat(item.cantidad))}
                      </span>
                      <button onClick={() => removeItem(item)} className="text-stone-300 hover:text-rose-500 transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {items.length === 0 && (
                <div className="py-8 text-center">
                  <Package size={28} className="text-stone-300 mx-auto mb-2" />
                  <p className="text-stone-400 text-xs">Selecciona productos para empezar</p>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="space-y-2">
              {groupedItems.pendientes.length > 0 && (
                <button
                  onClick={handleComandar}
                  disabled={comandando}
                  className={cx.btnSecondary + ' w-full flex items-center justify-center gap-2 min-h-[44px]'}
                >
                  {comandando ? (
                    <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                  Comandar ({groupedItems.pendientes.length})
                </button>
              )}
              {items.length > 0 && (
                <>
                  <button
                    onClick={handlePrecuenta}
                    className={cx.btnGhost + ' w-full flex items-center justify-center gap-2 min-h-[44px]'}
                  >
                    <FileText size={16} /> Precuenta
                  </button>
                  <button
                    onClick={() => setShowCobrar(true)}
                    className={cx.btnPrimary + ' w-full flex items-center justify-center gap-2 min-h-[44px] text-base'}
                  >
                    <ShoppingCart size={18} /> Cobrar {formatCurrency(subtotal)}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Session panel — mobile (below grid) */}
      </div>

      {/* Variant modal */}
      {variantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setVariantModal(null)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xs p-5"
          >
            <h3 className="font-bold text-stone-800 mb-3">{variantModal.nombre}</h3>
            <div className="space-y-2">
              {variantModal.variantes.map(v => (
                <button
                  key={v.id}
                  onClick={() => addVariant(variantModal, v)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-stone-200 hover:border-stone-400 hover:bg-stone-50 transition-colors"
                >
                  <span className="text-sm font-medium text-stone-700">{v.nombre}</span>
                  <span className="text-sm font-bold text-[var(--accent)]">{formatCurrency(v.precio_final)}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setVariantModal(null)} className={cx.btnGhost + ' w-full mt-3'}>Cancelar</button>
          </motion.div>
        </div>
      )}

      {/* Precuenta modal */}
      <AnimatePresence>
        {showPrecuenta && precuentaData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowPrecuenta(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
            >
              <div className="text-center mb-4">
                <h3 className="text-lg font-bold text-stone-900">Precuenta</h3>
                <p className="text-sm text-stone-500">Mesa {sesion.mesa_numero}</p>
              </div>
              <div className="border-t border-b border-stone-200 py-3 mb-3 space-y-1.5">
                {(precuentaData.items || []).map(item => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-stone-700">
                      {parseInt(item.cantidad)}× {item.nombre}
                    </span>
                    <span className="font-medium text-stone-800">
                      {formatCurrency(parseFloat(item.precio_unitario) * parseFloat(item.cantidad))}
                    </span>
                  </div>
                ))}
              </div>
              <div className="space-y-1 text-sm">
                {precuentaData.totales?.igv > 0 && (
                  <>
                    <div className="flex justify-between text-stone-500">
                      <span>Subtotal</span>
                      <span>{formatCurrency(precuentaData.totales.base)}</span>
                    </div>
                    <div className="flex justify-between text-stone-500">
                      <span>IGV</span>
                      <span>{formatCurrency(precuentaData.totales.igv)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-lg font-bold text-stone-900 pt-2 border-t border-stone-200">
                  <span>Total</span>
                  <span>{formatCurrency(precuentaData.totales?.total)}</span>
                </div>
              </div>
              <button onClick={() => setShowPrecuenta(false)} className={cx.btnSecondary + ' w-full mt-5'}>
                Cerrar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cobrar modal */}
      <AnimatePresence>
        {showCobrar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCobrar(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-stone-900">Cobrar Mesa {sesion.mesa_numero}</h3>
                <button onClick={() => setShowCobrar(false)} className={cx.btnIcon}><X size={18} /></button>
              </div>

              {/* Total */}
              <div className="text-center mb-5">
                <p className="text-stone-500 text-xs mb-1">Total a cobrar</p>
                <p className="text-3xl font-bold text-stone-900">{formatCurrency(total)}</p>
                {comisionTarjeta > 0 && (
                  <p className="text-xs text-stone-400 mt-1">
                    Incluye comisión tarjeta: {formatCurrency(comisionTarjeta)}
                  </p>
                )}
              </div>

              {/* Payment method */}
              {!pagoMixto && (
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {metodosPago.map(m => {
                    const isActive = metodoPago === m.key;
                    return (
                      <button
                        key={m.key}
                        onClick={() => setMetodoPago(m.key)}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-colors min-h-[44px] ${
                          isActive ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        <m.icon size={18} className={isActive ? 'text-emerald-600' : 'text-stone-400'} />
                        <span className={`text-[10px] font-medium ${isActive ? 'text-emerald-700' : 'text-stone-500'}`}>
                          {m.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Change calculator for cash */}
              {!pagoMixto && metodoPago === 'efectivo' && (
                <div className="mb-4">
                  <label className={cx.label}>Paga con</label>
                  <input
                    type="number"
                    value={pagaCon}
                    onChange={e => setPagaCon(e.target.value)}
                    className={cx.input + ' text-center text-lg font-semibold'}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                  {pagaCon && parseFloat(pagaCon) > 0 && (
                    <p className={`text-center text-sm font-semibold mt-2 ${
                      parseFloat(pagaCon) >= total ? 'text-emerald-600' : 'text-rose-500'
                    }`}>
                      {parseFloat(pagaCon) >= total
                        ? `Vuelto: ${formatCurrency(parseFloat(pagaCon) - total)}`
                        : `Falta: ${formatCurrency(total - parseFloat(pagaCon))}`
                      }
                    </p>
                  )}
                </div>
              )}

              {/* Split payment toggle */}
              <button
                onClick={() => {
                  setPagoMixto(!pagoMixto);
                  if (!pagoMixto) {
                    const half = Math.round(total / 2 * 100) / 100;
                    setPagoPartes([
                      { metodo: 'efectivo', monto: String(half), pagada: false, sinComision: false },
                      { metodo: 'efectivo', monto: String(Math.round((total - half) * 100) / 100), pagada: false, sinComision: false },
                    ]);
                  }
                }}
                className={cx.btnGhost + ' w-full text-xs mb-4'}
              >
                {pagoMixto ? 'Pago simple' : 'Dividir cuenta'}
              </button>

              {/* Split payment parts */}
              {pagoMixto && (
                <div className="space-y-3 mb-4">
                  {pagoPartes.map((parte, idx) => (
                    <div key={idx} className={cx.card + ' p-3'}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-stone-600">Parte {idx + 1}</span>
                        {pagoPartes.length > 2 && (
                          <button onClick={() => setPagoPartes(prev => prev.filter((_, i) => i !== idx))} className="text-stone-300 hover:text-rose-500">
                            <X size={13} />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 mb-2">
                        {metodosPago.map(m => (
                          <button
                            key={m.key}
                            onClick={() => {
                              const next = [...pagoPartes];
                              next[idx] = { ...next[idx], metodo: m.key };
                              setPagoPartes(next);
                            }}
                            className={`flex flex-col items-center gap-0.5 p-2 rounded-lg border transition-colors text-center ${
                              parte.metodo === m.key ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200'
                            }`}
                          >
                            <m.icon size={14} className={parte.metodo === m.key ? 'text-emerald-600' : 'text-stone-400'} />
                            <span className="text-[9px]">{m.label}</span>
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        value={parte.monto}
                        onChange={e => {
                          const next = [...pagoPartes];
                          next[idx] = { ...next[idx], monto: e.target.value };
                          setPagoPartes(next);
                        }}
                        className={cx.input + ' text-center font-semibold'}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => setPagoPartes(prev => [...prev, { metodo: 'efectivo', monto: '', pagada: false, sinComision: false }])}
                    className={cx.btnGhost + ' w-full text-xs'}
                  >
                    + Agregar parte
                  </button>
                </div>
              )}

              {/* Confirm button */}
              <button
                onClick={handleCobrar}
                disabled={cobrando || items.length === 0}
                className={cx.btnPrimary + ' w-full py-3 text-base min-h-[48px]'}
              >
                {cobrando ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Procesando...
                  </span>
                ) : `Confirmar cobro ${formatCurrency(total)}`}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Post-sale success modal */}
      {lastSaleId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-stone-900 mb-1">Mesa cobrada</h3>
            {lastSaleCode && (
              <p className="text-sm text-stone-500 font-mono mb-4">{lastSaleCode}</p>
            )}
            <div className="space-y-2">
              <button
                disabled={emittingBoleta}
                onClick={async () => {
                  if (!lastSaleId || lastSaleItems.length === 0) return;
                  setEmittingBoleta(true);
                  try {
                    const res = await api.post('/facturacion/emitir', {
                      venta_id: lastSaleId,
                      tipo: 'boleta',
                      items: lastSaleItems,
                    });
                    const data = res?.data || res;
                    if (data.sunat?.success) {
                      toast.success(`Boleta emitida: ${data.comprobante?.serie}-${data.comprobante?.correlativo}`);
                    } else {
                      toast.error(`SUNAT: ${data.sunat?.message || 'Error al emitir'}`);
                    }
                  } catch (err) {
                    toast.error(err.message || 'Error emitiendo boleta');
                  } finally {
                    setEmittingBoleta(false);
                    navigate('/mesas');
                  }
                }}
                className={cx.btnPrimary + ' w-full py-2.5 text-sm'}
              >
                {emittingBoleta ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Emitiendo...
                  </span>
                ) : 'Emitir boleta'}
              </button>
              <button
                onClick={() => navigate('/mesas')}
                className={cx.btnGhost + ' w-full py-2.5 text-sm'}
              >
                Volver a mesas
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
