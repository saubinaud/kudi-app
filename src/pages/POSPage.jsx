import { useState, useEffect, useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { cx } from '../styles/tokens';
import { formatCurrency } from '../utils/format';
import CustomSelect from '../components/CustomSelect';
import UbigeoSelect from '../components/UbigeoSelect';
import { X, Package, CheckCircle, Minus, Plus, ShoppingCart, Banknote, CreditCard, Smartphone, ArrowLeft, Trash2, MapPin, Store, Truck as TruckIcon, User, ChevronRight, AlertTriangle, Lock, DollarSign, Clock } from 'lucide-react';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function POSPage() {
  const api = useApi();
  const { user } = useAuth();
  const toast = useToast();

  // Products
  const [productos, setProductos] = useState([]);
  const [loadingProductos, setLoadingProductos] = useState(true);

  // Cartas (price categories)
  const [cartas, setCartas] = useState([]);
  const [selectedCarta, setSelectedCarta] = useState(null); // null = "Todos"

  // Search
  const [posSearch, setPosSearch] = useState('');

  // Cart
  const [cartItems, setCartItems] = useState([]);
  const [conIgv, setConIgv] = useState(user?.tipo_negocio !== 'informal'); // informal = sin IGV por defecto
  const itemPrecio = (item) => conIgv
    ? (item.precio_con_igv || item.precio || 0)
    : (item.precio_sin_igv || item.precio_con_igv || item.precio || 0);

  // Variant selector modal
  const [variantModal, setVariantModal] = useState(null);

  // Checkout
  const [showCheckout, setShowCheckout] = useState(false);
  const [showClientSidebar, setShowClientSidebar] = useState(false);
  const [posCliente, setPosCliente] = useState({ tipo_doc: 'DNI', num_doc: '', nombre: '', email: '', telefono: '' });
  const [clienteEncontrado, setClienteEncontrado] = useState(false);
  const [buscandoDoc, setBuscandoDoc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [sinComisionTarjeta, setSinComisionTarjeta] = useState(false);
  const [pagaCon, setPagaCon] = useState(''); // calculadora de vuelto
  const [pagoMixto, setPagoMixto] = useState(false);
  const [pagoPartes, setPagoPartes] = useState([{ metodo: 'efectivo', monto: '' }, { metodo: 'yape', monto: '' }]);

  // Arqueo de caja (non-blocking)
  const [caja, setCaja] = useState(null);
  const [showAbrirCaja, setShowAbrirCaja] = useState(false);
  const [showCerrarCaja, setShowCerrarCaja] = useState(false);
  const [cajaMontoApertura, setCajaMontoApertura] = useState('');
  const [cajaCierreEfectivo, setCajaCierreEfectivo] = useState('');
  const [cajaCierreTransf, setCajaCierreTransf] = useState('');
  const [cajaNota, setCajaNota] = useState('');
  const [savingCaja, setSavingCaja] = useState(false);
  const [cajaDismissed, setCajaDismissed] = useState(false);

  const loadCaja = () => api.get('/arqueo/actual').then(r => setCaja(r.data || null)).catch(() => {});
  useEffect(() => { loadCaja(); }, []);

  // Delivery
  const [tipoEntrega, setTipoEntrega] = useState('recojo'); // recojo | delivery
  const [zonas, setZonas] = useState([]);
  const [zonaSeleccionada, setZonaSeleccionada] = useState(null);
  const [direccion, setDireccion] = useState({ departamento: '', provincia: '', distrito: '', direccion: '', referencia: '' });

  // Post-sale success
  const [lastSaleId, setLastSaleId] = useState(null);
  const [lastSaleCode, setLastSaleCode] = useState(null);
  const [emittingBoleta, setEmittingBoleta] = useState(false);
  const [lastSaleItems, setLastSaleItems] = useState([]);
  const [lastClienteId, setLastClienteId] = useState(null);

  // Fetch products + zonas on mount
  useEffect(() => {
    setLoadingProductos(true);
    Promise.all([
      api.get('/productos'),
      api.get('/precios/categorias'),
      api.get('/canales/zonas').catch(() => ({ data: [] })),
    ]).then(([prodRes, catRes, zonasRes]) => {
      setProductos((prodRes.data || []).filter(p => p.tipo_producto !== 'no_transformable' || p.disponible_venta));
      setCartas(catRes.data || catRes || []);
      setZonas(zonasRes.data || []);
    }).catch(() => toast.error('Error cargando productos'))
      .finally(() => setLoadingProductos(false));
  }, []); // eslint-disable-line

  // Enriched products
  const enrichedProductos = useMemo(() =>
    productos.map(p => ({ ...p, value: p.id, label: p.nombre })),
    [productos]
  );

  // Filtered products by carta + search
  const posFilteredProducts = useMemo(() => {
    let list = enrichedProductos;

    // Filter by carta: only show products that have a price in this carta
    if (selectedCarta) {
      list = list.filter(p =>
        (p.precios_categoria || []).some(pc => pc.categoria_id === selectedCarta)
      );
    }

    // Search filter
    if (posSearch) {
      const q = posSearch.toLowerCase();
      list = list.filter(p =>
        p.nombre.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [enrichedProductos, posSearch, selectedCarta]);

  // Cart totals — desglose tipo boleta
  const esInformal = user?.tipo_negocio === 'informal';
  const tasaIgvPOS = parseFloat(user?.igv_rate) || 0.18; // tasa real, incluso para informal

  const cartSubtotal = useMemo(() =>
    cartItems.reduce((s, i) => s + itemPrecio(i) * i.cantidad - (parseFloat(i.descuento) || 0), 0),
    [cartItems, conIgv]
  );

  // Base (sin IGV) e IGV del carrito
  const cartDesglose = useMemo(() => {
    if (!conIgv || tasaIgvPOS === 0) {
      // Sin IGV: todo es base, no hay IGV
      return { base: cartSubtotal, igv: 0, total: cartSubtotal };
    }
    if (esInformal) {
      // Informal + Con IGV: el precio mostrado YA tiene IGV sumado
      // Base = total / (1 + tasa), IGV = total - base
      const base = Math.round(cartSubtotal / (1 + tasaIgvPOS) * 100) / 100;
      const igv = Math.round((cartSubtotal - base) * 100) / 100;
      return { base, igv, total: cartSubtotal };
    }
    // Formal: precio incluye IGV
    const base = Math.round(cartSubtotal / (1 + tasaIgvPOS) * 100) / 100;
    const igv = Math.round((cartSubtotal - base) * 100) / 100;
    return { base, igv, total: cartSubtotal };
  }, [cartSubtotal, conIgv, tasaIgvPOS, esInformal]);

  const costoEnvio = useMemo(() => {
    if (tipoEntrega !== 'delivery' || !zonaSeleccionada) return 0;
    const zona = zonas.find(z => z.id === zonaSeleccionada);
    return parseFloat(zona?.costo) || 0;
  }, [tipoEntrega, zonaSeleccionada, zonas]);
  const comisionPosPct = parseFloat(user?.comision_pos) || 0;
  const comisionTarjeta = (metodoPago === 'tarjeta' && !sinComisionTarjeta) ? Math.round(cartSubtotal * comisionPosPct) / 100 : 0;
  const cartTotal = cartSubtotal + costoEnvio + comisionTarjeta;

  // Cart helpers
  const updateCartQty = (index, delta) => {
    setCartItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], cantidad: Math.max(1, next[index].cantidad + delta) };
      return next;
    });
  };

  const removeFromCart = (index) => {
    setCartItems(prev => prev.filter((_, i) => i !== index));
  };

  const addToCart = (product) => {
    if (product.variantes?.length > 0) {
      setVariantModal(product);
      return;
    }
    const existing = cartItems.findIndex(i => i.producto_id === (product.id || product.value) && !i.variante_id);
    if (existing >= 0) {
      updateCartQty(existing, 1);
      return;
    }
    // Use carta price if a carta is selected
    const precioBase = parseFloat(product.precio_final) || 0;
    const igvProducto = parseFloat(product.igv_rate) || 0;
    const esInformal = user?.tipo_negocio === 'informal';
    // Informal: precio ya es sin IGV → calcular con IGV usando tasa estándar 18%
    // Formal: precio ya incluye IGV → precio_venta es sin IGV
    const tasaIgv = esInformal ? tasaIgvPOS : igvProducto;
    let precioConIgv = esInformal ? Math.ceil(precioBase * (1 + tasaIgv) * 10) / 10 : precioBase;
    let precioSinIgv = esInformal ? precioBase : (parseFloat(product.precio_venta) || precioBase);
    if (selectedCarta) {
      const cartaPrecio = (product.precios_categoria || []).find(pc => pc.categoria_id === selectedCarta);
      if (cartaPrecio) {
        const cp = parseFloat(cartaPrecio.precio) || precioBase;
        precioConIgv = esInformal ? Math.ceil(cp * (1 + tasaIgv) * 10) / 10 : cp;
        precioSinIgv = esInformal ? cp : (tasaIgv > 0 ? Math.round(cp / (1 + tasaIgv)) : cp);
      }
    }
    setCartItems(prev => [...prev, {
      producto_id: product.id || product.value,
      variante_id: null,
      nombre: product.nombre || product.label,
      variante_nombre: null,
      tipo_producto: product.tipo_producto || null,
      imagen_url: product.imagen_url || null,
      precio_con_igv: precioConIgv,
      precio_sin_igv: precioSinIgv,
      cantidad: 1,
      descuento: 0,
      descuento_tipo: 'monto',
      descuento_pct: 0,
      stock_actual: parseFloat(product.stock_actual) || 0,
      control_stock: product.control_stock || false,
    }]);
  };

  const addVariantToCart = (product, variant) => {
    setVariantModal(null);
    const existing = cartItems.findIndex(i => i.variante_id === variant.id);
    if (existing >= 0) {
      updateCartQty(existing, 1);
      return;
    }
    setCartItems(prev => [...prev, {
      producto_id: product.id || product.value,
      variante_id: variant.id,
      nombre: product.nombre || product.label,
      variante_nombre: variant.nombre,
      tipo_producto: product.tipo_producto || null,
      imagen_url: product.imagen_url || null,
      precio_con_igv: (() => {
        const vp = parseFloat(variant.precio_final) || parseFloat(product.precio_final) || 0;
        return user?.tipo_negocio === 'informal' ? Math.ceil(vp * (1 + tasaIgvPOS) * 10) / 10 : vp;
      })(),
      precio_sin_igv: user?.tipo_negocio === 'informal'
        ? (parseFloat(variant.precio_final) || parseFloat(product.precio_final) || 0)
        : (parseFloat(variant.precio_venta) || parseFloat(product.precio_venta) || parseFloat(variant.precio_final) || 0),
      cantidad: 1,
      descuento: 0,
      descuento_tipo: 'monto',
      descuento_pct: 0,
      stock_actual: parseFloat(variant.stock_actual ?? product.stock_actual) || 0,
      control_stock: product.control_stock || false,
    }]);
  };

  // DNI/RUC lookup — 1) BD local → 2) RENIEC/SUNAT → 3) manual
  const buscarDocumento = async (tipo, numero) => {
    setBuscandoDoc(true);
    setClienteEncontrado(false);
    try {
      // Step 1: buscar en BD local
      const local = await api.get(`/clientes/buscar?q=${numero}`).catch(() => ({ data: [] }));
      const found = (local?.data || local || []).find(c => c.num_doc === numero);
      if (found) {
        setPosCliente(prev => ({ ...prev, nombre: found.razon_social || found.nombre || '', email: found.email || '', telefono: found.telefono || '' }));
        setClienteEncontrado(true);
        toast.success('Cliente encontrado en tu base de datos');
        setBuscandoDoc(false);
        return;
      }

      // Step 2: buscar en RENIEC/SUNAT
      const endpoint = tipo === 'DNI' ? `/facturacion/buscar-dni/${numero}` : `/facturacion/buscar-ruc/${numero}`;
      const r = await api.get(endpoint);
      const d = r?.data || r;
      if (d && (d.nombre_completo || d.razon_social || d.nombre)) {
        setPosCliente(prev => ({ ...prev, nombre: d.nombre_completo || d.razon_social || d.nombre || '' }));
        setClienteEncontrado(true);
        toast.success(tipo === 'DNI' ? 'Encontrado en RENIEC' : 'Encontrado en SUNAT');
        setBuscandoDoc(false);
        return;
      }
    } catch {
      // Not found anywhere
    }
    toast.error('No encontrado — ingresa los datos manualmente');
    setBuscandoDoc(false);
  };

  // Checkout submit
  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    setSaving(true);
    try {
      // Create or find client if doc number provided
      let clienteId = null;
      if (posCliente.num_doc) {
        try {
          const clienteRes = await api.post('/clientes', {
            tipo_doc: posCliente.tipo_doc === 'RUC' ? '6' : '1',
            num_doc: posCliente.num_doc,
            razon_social: posCliente.nombre || 'VARIOS',
            email: posCliente.email || null,
            telefono: posCliente.telefono || null,
          });
          clienteId = (clienteRes?.data || clienteRes)?.id || null;
        } catch { /* client might already exist */ }

        // Try to find existing
        if (!clienteId) {
          try {
            const busq = await api.get(`/clientes/buscar?q=${posCliente.num_doc}`);
            const found = busq?.data || busq || [];
            if (found.length > 0) clienteId = found[0].id;
          } catch {}
        }
      }

      // Determinar método de pago
      let metodoPagoFinal = metodoPago;
      let pagoDetalle = null;
      if (pagoMixto) {
        const partes = pagoPartes.filter(p => parseFloat(p.monto) > 0);
        if (partes.length > 0) {
          metodoPagoFinal = 'mixto';
          pagoDetalle = partes.map(p => ({ metodo: p.metodo, monto: parseFloat(p.monto) }));
        }
      }

      const payload = {
        fecha: todayStr(),
        cliente_id: clienteId,
        tipo_venta: 'directo',
        metodo_pago: metodoPagoFinal,
        pago_detalle: pagoDetalle,
        comision_tarjeta: comisionTarjeta,
        items: cartItems.map(i => ({
          producto_id: i.producto_id,
          variante_id: i.variante_id || null,
          cantidad: i.cantidad,
          precio_unitario: itemPrecio(i),
          descuento: i.descuento || 0,
          descuento_tipo: i.descuento_tipo || 'monto',
          descuento_pct: i.descuento_pct || 0,
        })),
        descuento_global: 0,
      };

      const result = await api.post('/pl/ventas', payload);
      const saleData = result?.data || result;
      setLastSaleId(saleData?.id);
      setLastSaleCode(saleData?.codigo_pedido);
      toast.success('Venta registrada');
      if (caja) loadCaja(); // refresh counters
      setLastSaleItems(cartItems.map(i => ({
        producto_id: i.producto_id,
        producto_nombre: i.nombre,
        cantidad: i.cantidad,
        precio_unitario: itemPrecio(i),
        descuento: parseFloat(i.descuento) || 0,
      })));
      setLastClienteId(clienteId);
      setCartItems([]);
      setPosCliente({ tipo_doc: 'DNI', num_doc: '', nombre: '', email: '', telefono: '' });
      setClienteEncontrado(false);
      setMetodoPago('efectivo');
      setSinComisionTarjeta(false);
      setPagaCon('');
      setPagoMixto(false);
      setPagoPartes([{ metodo: 'efectivo', monto: '' }, { metodo: 'yape', monto: '' }]);
      setTipoEntrega('recojo');
      setZonaSeleccionada(null);
      setDireccion({ departamento: '', provincia: '', distrito: '', direccion: '', referencia: '' });
      setShowCheckout(false);
      setShowClientSidebar(false);
    } catch (err) {
      toast.error(err.message || 'Error registrando venta');
    } finally {
      setSaving(false);
    }
  };

  // Discount helpers
  const toggleDescuentoTipo = (index) => {
    const next = [...cartItems];
    const item = next[index];
    const newTipo = item.descuento_tipo === 'monto' ? 'pct' : 'monto';
    next[index] = { ...item, descuento_tipo: newTipo, descuento: 0, descuento_pct: 0 };
    setCartItems(next);
  };

  const updateDescuento = (index, rawVal) => {
    const val = parseFloat(rawVal) || 0;
    const next = [...cartItems];
    const item = next[index];
    if (item.descuento_tipo === 'pct') {
      const monto = itemPrecio(item) * item.cantidad * val / 100;
      next[index] = { ...item, descuento_pct: val, descuento: Math.round(monto * 100) / 100 };
    } else {
      next[index] = { ...item, descuento: val, descuento_pct: 0 };
    }
    setCartItems(next);
  };

  const METODOS_PAGO = [
    { key: 'efectivo', label: 'Efectivo', icon: Banknote },
    { key: 'yape', label: 'Yape', icon: Smartphone },
    { key: 'transferencia', label: 'Transfer.', icon: CreditCard },
    ...(comisionPosPct > 0 ? [{ key: 'tarjeta', label: `Tarjeta +${comisionPosPct}%`, icon: CreditCard }] : []),
  ];

  // Cart panel — reused on both desktop and mobile
  const renderCart = (isMobile = false) => (
    <div className={cx.card + ' flex flex-col overflow-hidden' + (!isMobile ? ' lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]' : '')}>
      {/* Cart header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#0A2F24] flex items-center justify-center">
            <ShoppingCart size={15} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-stone-900 text-sm leading-none">Carrito</h3>
            <p className="text-[11px] text-stone-400 mt-0.5">{cartItems.length} {cartItems.length === 1 ? 'producto' : 'productos'}</p>
          </div>
        </div>
        {cartItems.length > 0 && (
          <button
            onClick={() => setCartItems([])}
            className="text-[11px] text-stone-400 hover:text-rose-500 transition-colors duration-100"
          >
            Vaciar
          </button>
        )}
      </div>

      {/* Toggle IGV */}
      <div className="flex items-center justify-center gap-1 mx-4 mt-3">
        <button
          onClick={() => setConIgv(true)}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-l-lg transition-colors duration-100 ${conIgv ? 'bg-[#16A34A] text-white' : 'bg-stone-100 text-stone-400 hover:bg-stone-200'}`}
        >
          Con IGV
        </button>
        <button
          onClick={() => setConIgv(false)}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-r-lg transition-colors duration-100 ${!conIgv ? 'bg-[#0A2F24] text-white' : 'bg-stone-100 text-stone-400 hover:bg-stone-200'}`}
        >
          Sin IGV
        </button>
      </div>

      {cartItems.some(ci => ci.tipo_producto === 'pack') && (
        <div className="mx-4 mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
          Los packs descuentan stock de sus componentes al vender.
        </div>
      )}

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto px-4 py-3 min-h-[120px]">
        {cartItems.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart size={32} className="text-stone-200 mx-auto mb-3" />
            <p className="text-stone-400 text-sm">Selecciona productos</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {cartItems.map((item, i) => {
              const lineTotal = itemPrecio(item) * item.cantidad - (parseFloat(item.descuento) || 0);
              return (
                <div key={i} className="bg-stone-50/80 rounded-xl p-3 group">
                  <div className="flex gap-2.5">
                    {/* Thumbnail */}
                    {item.imagen_url ? (
                      <img src={item.imagen_url} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" alt="" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-stone-200 flex items-center justify-center flex-shrink-0">
                        <Package size={14} className="text-stone-400" />
                      </div>
                    )}
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-sm font-medium text-stone-800 truncate leading-tight">{item.nombre}</p>
                        <button onClick={() => removeFromCart(i)} className="text-stone-300 hover:text-rose-500 transition-colors duration-100 opacity-0 group-hover:opacity-100 -mt-0.5 flex-shrink-0">
                          <Trash2 size={13} />
                        </button>
                      </div>
                      {item.variante_nombre && <p className="text-[10px] text-stone-400 -mt-0.5">{item.variante_nombre}</p>}
                      <div className="flex items-center justify-between mt-1.5">
                        <p className="text-xs text-stone-500">{formatCurrency(itemPrecio(item))} c/u</p>
                        <p className="text-sm font-semibold text-stone-900">{formatCurrency(lineTotal)}</p>
                      </div>
                    </div>
                  </div>
                  {/* Quantity + Discount row */}
                  <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-stone-200/60">
                    {/* Quantity controls */}
                    <div className="flex items-center gap-0.5 bg-white border border-stone-200 rounded-lg">
                      <button onClick={() => updateCartQty(i, -1)} className="w-7 h-7 flex items-center justify-center text-stone-500 hover:text-stone-800 transition-colors duration-100 rounded-l-lg hover:bg-stone-50">
                        <Minus size={12} />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={item.cantidad}
                        onChange={e => {
                          const val = parseInt(e.target.value) || 1;
                          setCartItems(prev => { const next = [...prev]; next[i] = { ...next[i], cantidad: Math.max(1, val) }; return next; });
                        }}
                        className="text-sm font-bold w-9 text-center text-stone-800 border-0 outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button onClick={() => updateCartQty(i, 1)} className="w-7 h-7 flex items-center justify-center text-stone-500 hover:text-stone-800 transition-colors duration-100 rounded-r-lg hover:bg-stone-50">
                        <Plus size={12} />
                      </button>
                    </div>
                    {/* Discount — solo monto fijo */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-stone-400">Desc. S/</span>
                      <input
                        type="number" min="0" step="0.01"
                        value={item.descuento || ''}
                        onChange={e => updateDescuento(i, e.target.value)}
                        className="w-14 text-xs border border-stone-200 rounded-lg px-2 py-1 text-right focus:outline-none focus:border-stone-400 transition-colors duration-100"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  {item.control_stock && item.cantidad > item.stock_actual && (
                    <div className="flex items-center gap-1 mt-1.5 text-amber-600">
                      <AlertTriangle size={11} />
                      <span className="text-[10px]">Stock: {item.stock_actual} — Faltan {item.cantidad - item.stock_actual}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cart footer */}
      {cartItems.length > 0 && (
        <div className="border-t border-stone-200 px-5 py-4">
          {showCheckout ? (
            <div className="space-y-3 max-h-[55vh] overflow-y-auto overflow-x-hidden">
              {/* Back button */}
              <button onClick={() => { setShowCheckout(false); setShowClientSidebar(false); }} className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 transition-colors duration-100 -mb-1">
                <ArrowLeft size={12} />
                Volver al carrito
              </button>

              {/* Payment method */}
              <div>
                <label className="text-xs text-stone-500 font-medium block mb-2">Método de pago</label>
                <div className={`grid gap-1.5 ${METODOS_PAGO.length > 3 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  {METODOS_PAGO.map(m => (
                    <button
                      key={m.key}
                      onClick={() => { setMetodoPago(m.key); if (m.key !== 'tarjeta') setSinComisionTarjeta(false); }}
                      className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg border text-xs font-medium transition-colors duration-100 ${
                        metodoPago === m.key
                          ? 'border-[#16A34A] bg-emerald-50 text-[#16A34A]'
                          : 'border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50'
                      }`}
                    >
                      <m.icon size={16} />
                      {m.label}
                    </button>
                  ))}
                </div>
                {metodoPago === 'tarjeta' && (
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input type="checkbox" checked={sinComisionTarjeta} onChange={e => setSinComisionTarjeta(e.target.checked)} className="w-3.5 h-3.5 rounded" />
                    <span className="text-[11px] text-stone-500">No cobrar comisión adicional</span>
                  </label>
                )}
              </div>

              {/* Pago mixto toggle — botón claro */}
              <button
                onClick={() => {
                  if (!pagoMixto) {
                    // Al activar: jalar monto del pagaCon o del método actual al primer slot, calcular restante
                    const montoEfectivo = parseFloat(pagaCon) || 0;
                    const restante = montoEfectivo > 0 ? Math.max(0, Math.round((cartTotal - montoEfectivo) * 100) / 100) : '';
                    setPagoPartes([
                      { metodo: metodoPago, monto: montoEfectivo > 0 ? String(montoEfectivo) : '' },
                      { metodo: metodoPago === 'efectivo' ? 'yape' : 'efectivo', monto: restante ? String(restante) : '' },
                    ]);
                  }
                  setPagoMixto(!pagoMixto);
                }}
                className={`w-full py-2 rounded-lg border text-xs font-medium transition-colors duration-100 ${
                  pagoMixto
                    ? 'border-[#16A34A] bg-emerald-50 text-[#16A34A]'
                    : 'border-dashed border-stone-300 text-stone-400 hover:border-stone-400 hover:text-stone-600'
                }`}
              >
                {pagoMixto ? '✓ Pago mixto activo — click para desactivar' : `Dividir pago (${{ efectivo: 'efectivo', yape: 'yape', transferencia: 'transferencia' }[metodoPago]} + otro)`}
              </button>

              {/* Pago mixto filas */}
              {pagoMixto && (
                <div className="space-y-2 bg-stone-50 rounded-xl p-2.5">
                  {pagoPartes.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <CustomSelect
                        compact
                        value={p.metodo}
                        onChange={v => { const next = [...pagoPartes]; next[idx].metodo = v; setPagoPartes(next); }}
                        options={[{ value: 'efectivo', label: 'Efectivo' }, { value: 'yape', label: 'Yape' }, { value: 'transferencia', label: 'Transf.' }]}
                        className="w-24"
                      />
                      <div className="flex-1 relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-stone-400">S/</span>
                        <input type="number" step="0.01" min="0" value={p.monto} onChange={e => { const next = [...pagoPartes]; next[idx].monto = e.target.value; setPagoPartes(next); }}
                          className="w-full text-sm border border-stone-200 rounded-lg pl-7 pr-2 py-2 text-right font-semibold focus:outline-none focus:border-stone-400" placeholder="0.00" />
                      </div>
                      {pagoPartes.length > 2 && (
                        <button onClick={() => setPagoPartes(pagoPartes.filter((_, i) => i !== idx))} className="text-stone-300 hover:text-rose-500"><X size={14} /></button>
                      )}
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-1 border-t border-stone-200">
                    {pagoPartes.length < 3 ? (
                      <button onClick={() => setPagoPartes([...pagoPartes, { metodo: 'transferencia', monto: '' }])}
                        className="text-xs text-stone-400 hover:text-stone-600">+ Otro</button>
                    ) : <span />}
                    {(() => {
                      const totalPartes = pagoPartes.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0);
                      const restante = cartTotal - totalPartes;
                      return <span className={`text-xs font-bold ${restante > 0.01 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {restante > 0.01 ? `Falta: ${formatCurrency(restante)}` : restante < -0.01 ? `Vuelto: ${formatCurrency(Math.abs(restante))}` : '✓ Completo'}
                      </span>;
                    })()}
                  </div>
                </div>
              )}

              {/* Calculadora de vuelto (solo efectivo, no mixto) */}
              {metodoPago === 'efectivo' && !pagoMixto && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-500 whitespace-nowrap">Paga con:</span>
                  <input type="number" step="0.01" min="0" value={pagaCon} onChange={e => setPagaCon(e.target.value)}
                    className={cx.input + ' flex-1 text-right text-sm font-semibold'} placeholder={formatCurrency(cartTotal)} />
                  {pagaCon && (() => {
                    const vuelto = parseFloat(pagaCon) - cartTotal;
                    return vuelto >= 0
                      ? <span className="text-xs font-bold text-emerald-600 whitespace-nowrap">Vuelto: {formatCurrency(vuelto)}</span>
                      : <span className="text-xs font-bold text-rose-500 whitespace-nowrap">Falta: {formatCurrency(Math.abs(vuelto))}</span>;
                  })()}
                </div>
              )}

              {/* Delivery / Recojo */}
              <div>
                <label className="text-xs text-stone-500 font-medium block mb-2">Entrega</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => setTipoEntrega('recojo')}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-colors duration-100 ${
                      tipoEntrega === 'recojo'
                        ? 'border-[#16A34A] bg-emerald-50 text-[#16A34A]'
                        : 'border-stone-200 text-stone-500 hover:border-stone-300'
                    }`}
                  >
                    <Store size={14} /> Recojo en tienda
                  </button>
                  <button
                    onClick={() => setTipoEntrega('delivery')}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-colors duration-100 ${
                      tipoEntrega === 'delivery'
                        ? 'border-[#16A34A] bg-emerald-50 text-[#16A34A]'
                        : 'border-stone-200 text-stone-500 hover:border-stone-300'
                    }`}
                  >
                    <TruckIcon size={14} /> Delivery
                  </button>
                </div>
                {tipoEntrega === 'delivery' && zonas.length > 0 && (
                  <div className="mt-2.5">
                    <CustomSelect
                      compact
                      options={zonas.map(z => ({ value: z.id, label: `${z.nombre} — ${formatCurrency(z.costo)}` }))}
                      value={zonaSeleccionada}
                      onChange={v => setZonaSeleccionada(v)}
                      placeholder="Zona de envío..."
                    />
                  </div>
                )}
              </div>

              {/* Client + address compact button */}
              <button
                onClick={() => setShowClientSidebar(true)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-stone-200 hover:border-stone-300 bg-stone-50/50 transition-colors duration-100 text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center flex-shrink-0">
                  <User size={14} className="text-stone-400" />
                </div>
                <div className="flex-1 min-w-0">
                  {posCliente.nombre || direccion.distrito ? (
                    <>
                      <p className="text-xs font-medium text-stone-800 truncate">{posCliente.nombre || 'Sin nombre'}</p>
                      <p className="text-[11px] text-stone-400 truncate">
                        {[posCliente.num_doc, direccion.distrito].filter(Boolean).join(' · ') || 'Cliente y dirección'}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-stone-400">Cliente y dirección <span className="text-stone-300">(opcional)</span></p>
                  )}
                </div>
                <ChevronRight size={14} className="text-stone-300 flex-shrink-0" />
              </button>

              {/* Total + confirm — desglose tipo boleta */}
              <div className="bg-stone-50 rounded-xl p-4 -mx-1">
                <div className="space-y-1 mb-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-stone-400">Subtotal</span>
                    <span className="text-stone-600">{formatCurrency(cartDesglose.base)}</span>
                  </div>
                  {cartDesglose.igv > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-stone-400">IGV ({parseFloat((tasaIgvPOS * 100).toFixed(1))}%)</span>
                      <span className="text-stone-600">{formatCurrency(cartDesglose.igv)}</span>
                    </div>
                  )}
                  {costoEnvio > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-stone-400">Envío</span>
                      <span className="text-stone-600">{formatCurrency(costoEnvio)}</span>
                    </div>
                  )}
                  {comisionTarjeta > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-stone-400">Comisión tarjeta ({comisionPosPct}%)</span>
                      <span className="text-stone-600">+{formatCurrency(comisionTarjeta)}</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-baseline mb-3 pt-1 border-t border-stone-200">
                  <span className="text-stone-500 text-sm">Total a cobrar</span>
                  <span className="text-2xl font-bold text-[#0A2F24]">{formatCurrency(cartTotal)}</span>
                </div>
                <button
                  onClick={handleCheckout}
                  disabled={saving}
                  className={cx.btnPrimary + ' w-full py-3.5 text-sm font-semibold'}
                >
                  {saving ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Procesando...
                    </span>
                  ) : 'Confirmar venta'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-1.5 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-stone-400">Subtotal</span>
                  <span className="text-stone-600">{formatCurrency(cartDesglose.base)}</span>
                </div>
                {cartItems.some(i => i.descuento > 0) && (
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-400">Descuentos</span>
                    <span className="text-rose-500">-{formatCurrency(cartItems.reduce((s, i) => s + (parseFloat(i.descuento) || 0), 0))}</span>
                  </div>
                )}
                {cartDesglose.igv > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-400">IGV ({parseFloat((tasaIgvPOS * 100).toFixed(1))}%)</span>
                    <span className="text-stone-600">{formatCurrency(cartDesglose.igv)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1.5 border-t border-stone-100">
                  <span className="text-base font-bold text-stone-900">Total</span>
                  <span className="text-base font-bold text-[#0A2F24]">{formatCurrency(cartTotal)}</span>
                </div>
              </div>
              <button
                onClick={() => setShowCheckout(true)}
                className={cx.btnPrimary + ' w-full py-3.5 text-sm font-semibold flex items-center justify-center gap-2'}
              >
                Cobrar {formatCurrency(cartTotal)}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="mb-5 space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-stone-900">Caja virtual</h1>
          {caja && (
            <button onClick={() => { loadCaja(); setShowCerrarCaja(true); }} className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors duration-100">
              <Lock size={12} /> Cerrar caja
            </button>
          )}
          {!caja && cajaDismissed && (
            <button onClick={() => setShowAbrirCaja(true)} className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-600 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors duration-100">
              <ShoppingCart size={12} /> Abrir caja
            </button>
          )}
        </div>

        {/* Caja abierta — contadores */}
        {caja && (
          <div className="flex items-center gap-4 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-xs">
            <div className="flex items-center gap-1.5 text-emerald-700">
              <Clock size={12} />
              <span>Abierta {new Date(caja.abierto_at).toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="flex items-center gap-3 ml-auto text-emerald-800 font-semibold">
              <span>Efectivo: {formatCurrency(parseFloat(caja.monto_apertura || 0) + parseFloat(caja.ventas_efectivo || 0))}</span>
              <span className="text-emerald-600">Transf: {formatCurrency(parseFloat(caja.ventas_transferencia || 0))}</span>
              <span className="text-stone-500 font-normal">{caja.cantidad_ventas || 0} venta{caja.cantidad_ventas !== 1 ? 's' : ''}</span>
            </div>
          </div>
        )}

        {/* Banner abrir caja — dismissable */}
        {!caja && !cajaDismissed && (
          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-700">
            <span>No has abierto caja hoy. Puedes vender sin abrir caja, pero no se hará cuadre.</span>
            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
              <button onClick={() => setShowAbrirCaja(true)} className="px-2.5 py-1 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 transition-colors duration-100">Abrir</button>
              <button onClick={() => setCajaDismissed(true)} className="text-amber-400 hover:text-amber-600"><X size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {loadingProductos ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
            <div key={i} className={cx.skeleton + ' aspect-square rounded-xl'} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-4 pb-20 lg:pb-0">
          {/* LEFT: Product Grid */}
          <div className="flex-1">
            {/* Carta tabs */}
            {cartas.length > 0 && (
              <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
                <button onClick={() => setSelectedCarta(null)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors duration-100 ${
                    !selectedCarta ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}>Todos</button>
                {cartas.map(c => (
                  <button key={c.id} onClick={() => setSelectedCarta(c.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors duration-100 ${
                      selectedCarta === c.id ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}>{c.nombre}</button>
                ))}
              </div>
            )}

            {/* Search */}
            <div className="mb-4">
              <input
                type="text"
                value={posSearch}
                onChange={e => setPosSearch(e.target.value)}
                className={cx.input + ' text-sm'}
                placeholder="Buscar producto..."
              />
            </div>

            {/* Product Grid */}
            {posFilteredProducts.length === 0 ? (
              <div className={cx.card + ' p-12 text-center'}>
                <Package size={40} className="text-stone-300 mx-auto mb-3" />
                <p className="text-stone-400 text-sm">
                  {posSearch ? 'Sin resultados' : 'No hay productos configurados'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                {posFilteredProducts.map(p => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="bg-white rounded-xl border border-stone-200 p-2 text-center hover:border-stone-400 hover:shadow transition-colors duration-100"
                  >
                    {p.imagen_url ? (
                      <img src={p.imagen_url} className="w-full aspect-square object-cover rounded-lg mb-1.5" alt={p.nombre} />
                    ) : (
                      <div className="w-full aspect-square bg-stone-100 rounded-lg mb-1.5 flex items-center justify-center">
                        <Package size={20} className="text-stone-300" />
                      </div>
                    )}
                    <p className="text-[11px] font-medium text-stone-800 truncate">{p.nombre}</p>
                    <p className="text-xs font-bold text-[var(--accent)]">{formatCurrency(
                      selectedCarta
                        ? ((p.precios_categoria || []).find(pc => pc.categoria_id === selectedCarta)?.precio || p.precio_final)
                        : (conIgv
                          ? (user?.tipo_negocio === 'informal' ? Math.ceil(parseFloat(p.precio_final) * (1 + tasaIgvPOS) * 10) / 10 : p.precio_final)
                          : (user?.tipo_negocio === 'informal' ? p.precio_final : (p.precio_venta || p.precio_final)))
                    )}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: Cart — desktop only */}
          <div className="hidden lg:block lg:w-80 xl:w-96 flex-shrink-0">
            {renderCart(false)}
          </div>

          {/* Cart — mobile only (below grid) */}
          <div className="lg:hidden">
            {renderCart(true)}
          </div>
        </div>
      )}

      {/* Variant selector modal */}
      {variantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setVariantModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xs max-w-[95vw] p-5">
            <h3 className="font-bold text-stone-900 mb-1">{variantModal.nombre || variantModal.label}</h3>
            <p className="text-sm text-stone-500 mb-3">Selecciona variante</p>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {(variantModal.variantes || []).map(v => (
                <button
                  key={v.id}
                  onClick={() => addVariantToCart(variantModal, v)}
                  className="w-full text-left p-2.5 rounded-lg hover:bg-stone-50 flex justify-between items-center transition-colors duration-100"
                >
                  <span className="text-sm text-stone-800">{v.nombre}</span>
                  <span className="text-xs text-stone-500">Stock: {v.stock_actual}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setVariantModal(null)} className={cx.btnGhost + ' w-full mt-3'}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Mobile bottom bar */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 p-3 flex items-center justify-between lg:hidden z-40">
          <div>
            <p className="text-sm font-bold text-stone-900">{cartItems.length} items</p>
            <p className="text-lg font-bold text-[var(--accent)]">{formatCurrency(cartTotal)}</p>
          </div>
          <button
            onClick={() => setShowCheckout(true)}
            disabled={saving}
            className={cx.btnPrimary + ' px-6 py-3 text-sm'}
          >
            {saving ? '...' : `Cobrar ${formatCurrency(cartTotal)}`}
          </button>
        </div>
      )}

      {/* Client + address sidebar */}
      {showClientSidebar && (
        <div className="fixed inset-0 z-[60] flex">
          <div className="flex-1 bg-black/20" onClick={() => setShowClientSidebar(false)} />
          <div className="w-full sm:w-96 bg-white h-full shadow-xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 flex-shrink-0">
              <h3 className="font-bold text-stone-900 text-sm">Cliente y dirección</h3>
              <button onClick={() => setShowClientSidebar(false)} className="text-stone-400 hover:text-stone-600 transition-colors duration-100">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 px-5 py-4 space-y-5 overflow-y-auto" style={{ overflowX: 'clip' }}>
              {/* DNI / RUC search */}
              <div>
                <label className={cx.label}>Documento (opcional)</label>
                <div className="flex gap-2 items-start mt-1">
                  <div className="w-[85px] flex-shrink-0">
                    <CustomSelect
                      compact
                      options={[{ value: 'DNI', label: 'DNI' }, { value: 'RUC', label: 'RUC' }]}
                      value={posCliente.tipo_doc}
                      onChange={v => setPosCliente(p => ({ ...p, tipo_doc: v, num_doc: '', nombre: '' }))}
                    />
                  </div>
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={posCliente.num_doc}
                      onChange={e => {
                        const v = e.target.value.replace(/\D/g, '');
                        setPosCliente(p => ({ ...p, num_doc: v }));
                        const tipo = posCliente.tipo_doc;
                        if (tipo === 'DNI' && v.length === 8) buscarDocumento('DNI', v);
                        if (tipo === 'RUC' && v.length === 11) buscarDocumento('RUC', v);
                      }}
                      className={cx.input + ' text-sm'}
                      placeholder={posCliente.tipo_doc === 'DNI' ? '12345678' : '20123456789'}
                      maxLength={posCliente.tipo_doc === 'DNI' ? 8 : 11}
                    />
                    {buscandoDoc && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                    )}
                  </div>
                </div>

                {/* Status indicator */}
                {clienteEncontrado && posCliente.nombre && (
                  <p className="text-xs text-emerald-600 font-medium mt-2 px-1 flex items-center gap-1">
                    <CheckCircle size={12} /> Encontrado
                  </p>
                )}
                {posCliente.num_doc.length > 0 && !clienteEncontrado && !buscandoDoc &&
                  ((posCliente.tipo_doc === 'DNI' && posCliente.num_doc.length === 8) || (posCliente.tipo_doc === 'RUC' && posCliente.num_doc.length === 11)) && (
                  <p className="text-[11px] text-amber-600 mt-2 px-1 flex items-center gap-1">
                    <AlertTriangle size={11} /> No encontrado — completa los datos
                  </p>
                )}

                {/* Client fields — always visible when doc entered, pre-filled if found */}
                {posCliente.num_doc.length > 0 && !buscandoDoc && (
                  <div className="mt-2 space-y-2">
                    <input
                      type="text"
                      value={posCliente.nombre}
                      onChange={e => setPosCliente(p => ({ ...p, nombre: e.target.value }))}
                      className={cx.input + ' text-sm'}
                      placeholder="Nombre del cliente"
                    />
                    <input
                      type="email"
                      value={posCliente.email}
                      onChange={e => setPosCliente(p => ({ ...p, email: e.target.value }))}
                      className={cx.input + ' text-sm'}
                      placeholder="Email (opcional)"
                    />
                    <input
                      type="tel"
                      value={posCliente.telefono}
                      onChange={e => setPosCliente(p => ({ ...p, telefono: e.target.value }))}
                      className={cx.input + ' text-sm'}
                      placeholder="Teléfono (opcional)"
                    />
                  </div>
                )}
              </div>

              {/* Delivery address — only when delivery selected */}
              {tipoEntrega === 'delivery' && (
                <div>
                  <label className={cx.label}>Dirección de entrega</label>
                  <div className="mt-1 space-y-2">
                    <UbigeoSelect
                      departamento={direccion.departamento}
                      provincia={direccion.provincia}
                      distrito={direccion.distrito}
                      onChange={({ departamento, provincia, distrito }) => setDireccion(d => ({ ...d, departamento, provincia, distrito }))}
                    />
                    <input
                      type="text"
                      value={direccion.direccion}
                      onChange={e => setDireccion(d => ({ ...d, direccion: e.target.value }))}
                      className={cx.input + ' text-sm'}
                      placeholder="Dirección (calle, número)"
                    />
                    <input
                      type="text"
                      value={direccion.referencia}
                      onChange={e => setDireccion(d => ({ ...d, referencia: e.target.value }))}
                      className={cx.input + ' text-sm'}
                      placeholder="Referencia"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-stone-100 px-5 py-4">
              <button
                onClick={() => setShowClientSidebar(false)}
                className={cx.btnPrimary + ' w-full py-3 text-sm font-semibold'}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-sale success overlay */}
      {lastSaleId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setLastSaleId(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm max-w-[95vw] p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-stone-900 mb-1">Venta registrada</h3>
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
                      cliente_id: lastClienteId || null,
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
                    setLastSaleId(null);
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
                onClick={() => setLastSaleId(null)}
                className={cx.btnGhost + ' w-full py-2.5 text-sm'}
              >
                Nueva venta
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal: Abrir caja */}
      {showAbrirCaja && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAbrirCaja(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <Banknote size={24} className="text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-stone-900">Abrir caja</h3>
              <p className="text-xs text-stone-500 mt-1">¿Con cuánto efectivo empiezas?</p>
            </div>
            <div>
              <label className={cx.label}>Monto de apertura (S/)</label>
              <input type="number" min="0" step="0.01" value={cajaMontoApertura} onChange={e => setCajaMontoApertura(e.target.value)}
                className={cx.input + ' text-center text-lg font-semibold'} placeholder="0.00" autoFocus />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowAbrirCaja(false)} className={cx.btnGhost + ' flex-1'}>Cancelar</button>
              <button
                disabled={savingCaja}
                onClick={async () => {
                  setSavingCaja(true);
                  try {
                    const r = await api.post('/arqueo/abrir', { monto_apertura: parseFloat(cajaMontoApertura) || 0 });
                    setCaja(r.data || r);
                    setCajaDismissed(false);
                    setShowAbrirCaja(false);
                    setCajaMontoApertura('');
                    toast.success('Caja abierta');
                  } catch (err) { toast.error(err.message || 'Error abriendo caja'); }
                  finally { setSavingCaja(false); }
                }}
                className={cx.btnPrimary + ' flex-1 flex items-center justify-center gap-1.5'}
              >
                {savingCaja ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Banknote size={14} /> Abrir</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cerrar caja */}
      {showCerrarCaja && caja && (() => {
        const efectivoSistema = parseFloat(caja.monto_apertura || 0) + parseFloat(caja.ventas_efectivo || 0);
        const transfSistema = parseFloat(caja.ventas_transferencia || 0);
        const diffEfectivo = (parseFloat(cajaCierreEfectivo) || 0) - efectivoSistema;
        const diffTransf = (parseFloat(cajaCierreTransf) || 0) - transfSistema;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCerrarCaja(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-stone-900">Cerrar caja</h3>
                <button onClick={() => setShowCerrarCaja(false)} className="text-stone-400 hover:text-stone-600"><X size={18} /></button>
              </div>

              {/* Resumen del turno */}
              <div className="bg-stone-50 rounded-xl p-4 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-stone-500">Apertura</span><span className="font-medium">{new Date(caja.abierto_at).toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' })}</span></div>
                <div className="flex justify-between"><span className="text-stone-500">Ventas del turno</span><span className="font-bold text-stone-800">{caja.cantidad_ventas || 0} — {formatCurrency(parseFloat(caja.ventas_total || 0))}</span></div>
                <div className="flex justify-between"><span className="text-stone-500">Monto apertura</span><span>{formatCurrency(parseFloat(caja.monto_apertura || 0))}</span></div>
              </div>

              {/* Cuadre Efectivo */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-stone-500 uppercase">Efectivo</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-stone-500">Según sistema</span>
                  <span className="font-semibold text-stone-800">{formatCurrency(efectivoSistema)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-stone-500">En tu caja</span>
                  <input type="number" step="0.01" value={cajaCierreEfectivo} onChange={e => setCajaCierreEfectivo(e.target.value)}
                    className={cx.input + ' w-32 text-right font-semibold'} placeholder="0.00" />
                </div>
                {cajaCierreEfectivo && (
                  <div className={`text-right text-sm font-semibold ${diffEfectivo >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    Diferencia: {diffEfectivo >= 0 ? '+' : ''}{formatCurrency(diffEfectivo)}
                    {diffEfectivo > 0 && <span className="text-xs font-normal ml-1">(sobrante)</span>}
                    {diffEfectivo < 0 && <span className="text-xs font-normal ml-1">(faltante)</span>}
                  </div>
                )}
              </div>

              {/* Cuadre Transferencias */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-stone-500 uppercase">Transferencias / Yape</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-stone-500">Según sistema</span>
                  <span className="font-semibold text-stone-800">{formatCurrency(transfSistema)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-stone-500">En tu dispositivo</span>
                  <input type="number" step="0.01" value={cajaCierreTransf} onChange={e => setCajaCierreTransf(e.target.value)}
                    className={cx.input + ' w-32 text-right font-semibold'} placeholder="0.00" />
                </div>
                {cajaCierreTransf && (
                  <div className={`text-right text-sm font-semibold ${diffTransf >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    Diferencia: {diffTransf >= 0 ? '+' : ''}{formatCurrency(diffTransf)}
                    {diffTransf > 0 && <span className="text-xs font-normal ml-1">(sobrante)</span>}
                    {diffTransf < 0 && <span className="text-xs font-normal ml-1">(faltante)</span>}
                  </div>
                )}
              </div>

              {/* Nota */}
              <div>
                <label className={cx.label}>Nota (opcional)</label>
                <textarea value={cajaNota} onChange={e => setCajaNota(e.target.value)} className={cx.input + ' h-16 resize-none'} placeholder="Observaciones del turno..." />
              </div>

              {/* Confirmar */}
              <button
                disabled={savingCaja}
                onClick={async () => {
                  setSavingCaja(true);
                  try {
                    await api.post('/arqueo/cerrar', {
                      cierre_efectivo_real: parseFloat(cajaCierreEfectivo) || 0,
                      cierre_transferencia_real: parseFloat(cajaCierreTransf) || 0,
                      nota_cierre: cajaNota.trim() || null,
                    });
                    setCaja(null);
                    setShowCerrarCaja(false);
                    setCajaCierreEfectivo('');
                    setCajaCierreTransf('');
                    setCajaNota('');
                    toast.success('Caja cerrada correctamente');
                  } catch (err) { toast.error(err.message || 'Error cerrando caja'); }
                  finally { setSavingCaja(false); }
                }}
                className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors duration-100"
              >
                {savingCaja ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Lock size={14} /> Confirmar cierre</>}
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
