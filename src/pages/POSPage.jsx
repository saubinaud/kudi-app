import { useState, useEffect, useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { cx } from '../styles/tokens';
import { formatCurrency } from '../utils/format';
import CustomSelect from '../components/CustomSelect';
import UbigeoSelect from '../components/UbigeoSelect';
import { X, Package, CheckCircle, Minus, Plus, ShoppingCart, Banknote, CreditCard, Smartphone, ArrowLeft, Trash2, MapPin, Store, Truck as TruckIcon, User, ChevronRight, AlertTriangle } from 'lucide-react';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function POSPage() {
  const api = useApi();
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
  const [conIgv, setConIgv] = useState(true); // toggle IGV para toda la orden
  const itemPrecio = (item) => conIgv ? (item.precio_con_igv || item.precio || 0) : (item.precio_sin_igv || item.precio_con_igv || item.precio || 0);

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

  // Delivery
  const [tipoEntrega, setTipoEntrega] = useState('recojo'); // recojo | delivery
  const [zonas, setZonas] = useState([]);
  const [zonaSeleccionada, setZonaSeleccionada] = useState(null);
  const [direccion, setDireccion] = useState({ departamento: '', provincia: '', distrito: '', direccion: '', referencia: '' });

  // Post-sale success
  const [lastSaleId, setLastSaleId] = useState(null);
  const [lastSaleCode, setLastSaleCode] = useState(null);

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

  // Cart total
  const cartSubtotal = useMemo(() =>
    cartItems.reduce((s, i) => s + itemPrecio(i) * i.cantidad - (parseFloat(i.descuento) || 0), 0),
    [cartItems, conIgv]
  );
  const costoEnvio = useMemo(() => {
    if (tipoEntrega !== 'delivery' || !zonaSeleccionada) return 0;
    const zona = zonas.find(z => z.id === zonaSeleccionada);
    return parseFloat(zona?.costo) || 0;
  }, [tipoEntrega, zonaSeleccionada, zonas]);
  const cartTotal = cartSubtotal + costoEnvio;

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
    let precioConIgv = parseFloat(product.precio_final) || 0;
    let precioSinIgv = parseFloat(product.precio_venta) || precioConIgv;
    if (selectedCarta) {
      const cartaPrecio = (product.precios_categoria || []).find(pc => pc.categoria_id === selectedCarta);
      if (cartaPrecio) {
        precioConIgv = parseFloat(cartaPrecio.precio) || precioConIgv;
        const igvRate = parseFloat(product.igv_rate) || 0;
        precioSinIgv = igvRate > 0 ? Math.round(precioConIgv / (1 + igvRate) * 100) / 100 : precioConIgv;
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
      precio_con_igv: parseFloat(variant.precio_final) || parseFloat(product.precio_final) || 0,
      precio_sin_igv: parseFloat(variant.precio_venta) || parseFloat(product.precio_venta) || parseFloat(variant.precio_final) || 0,
      cantidad: 1,
      descuento: 0,
      descuento_tipo: 'monto',
      descuento_pct: 0,
    }]);
  };

  // DNI/RUC lookup
  const buscarDocumento = async (tipo, numero) => {
    setBuscandoDoc(true);
    setClienteEncontrado(false);
    try {
      const endpoint = tipo === 'DNI'
        ? `/facturacion/buscar-dni/${numero}`
        : `/facturacion/buscar-ruc/${numero}`;
      const r = await api.get(endpoint);
      const d = r?.data || r;
      if (d && (d.nombre_completo || d.razon_social || d.nombre)) {
        setPosCliente(prev => ({
          ...prev,
          nombre: d.nombre_completo || d.razon_social || d.nombre || '',
        }));
        setClienteEncontrado(true);
        toast.success('Cliente encontrado');
      }
    } catch {
      // Not found — user can enter manually
    } finally {
      setBuscandoDoc(false);
    }
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

      const payload = {
        fecha: todayStr(),
        cliente_id: clienteId,
        tipo_venta: 'directo',
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
      setCartItems([]);
      setPosCliente({ tipo_doc: 'DNI', num_doc: '', nombre: '', email: '', telefono: '' });
      setClienteEncontrado(false);
      setMetodoPago('efectivo');
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
  ];

  // Cart panel — reused on both desktop and mobile
  const renderCart = (isMobile = false) => (
    <div className={cx.card + ' flex flex-col' + (!isMobile ? ' lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]' : '')}>
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
      <div className="flex-1 overflow-y-auto px-4 py-3">
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
                      <span className="text-sm font-bold w-7 text-center text-stone-800">{item.cantidad}</span>
                      <button onClick={() => updateCartQty(i, 1)} className="w-7 h-7 flex items-center justify-center text-stone-500 hover:text-stone-800 transition-colors duration-100 rounded-r-lg hover:bg-stone-50">
                        <Plus size={12} />
                      </button>
                    </div>
                    {/* Discount */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-stone-400">Desc:</span>
                      <button
                        onClick={() => toggleDescuentoTipo(i)}
                        className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold transition-colors duration-100 ${
                          item.descuento_tipo === 'pct' ? 'bg-[#0A2F24] text-white' : 'bg-stone-200 text-stone-500'
                        }`}
                        title={item.descuento_tipo === 'pct' ? 'Porcentaje' : 'Monto fijo'}
                      >
                        %
                      </button>
                      <input
                        type="number" min="0" step="0.01"
                        value={item.descuento_tipo === 'pct' ? (item.descuento_pct || '') : (item.descuento || '')}
                        onChange={e => updateDescuento(i, e.target.value)}
                        className="w-14 text-xs border border-stone-200 rounded-lg px-2 py-1 text-right focus:outline-none focus:border-stone-400 transition-colors duration-100"
                        placeholder="0"
                      />
                    </div>
                  </div>
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
            <div className="space-y-4">
              {/* Back button */}
              <button onClick={() => { setShowCheckout(false); setShowClientSidebar(false); }} className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 transition-colors duration-100 -mb-1">
                <ArrowLeft size={12} />
                Volver al carrito
              </button>

              {/* Payment method */}
              <div>
                <label className="text-xs text-stone-500 font-medium block mb-2">Método de pago</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {METODOS_PAGO.map(m => (
                    <button
                      key={m.key}
                      onClick={() => setMetodoPago(m.key)}
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
              </div>

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
                    <p className="text-xs text-stone-500">Agregar cliente y dirección</p>
                  )}
                </div>
                <ChevronRight size={14} className="text-stone-300 flex-shrink-0" />
              </button>

              {/* Total + confirm */}
              <div className="bg-stone-50 rounded-xl p-4 -mx-1">
                <div className="space-y-1 mb-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-stone-400">Productos</span>
                    <span className="text-stone-600">{formatCurrency(cartSubtotal)}</span>
                  </div>
                  {costoEnvio > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-stone-400">Envío</span>
                      <span className="text-stone-600">{formatCurrency(costoEnvio)}</span>
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
                  <span className="text-stone-600">{formatCurrency(cartItems.reduce((s, i) => s + itemPrecio(i) * i.cantidad, 0))}</span>
                </div>
                {cartItems.some(i => i.descuento > 0) && (
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-400">Descuentos</span>
                    <span className="text-rose-500">-{formatCurrency(cartItems.reduce((s, i) => s + (parseFloat(i.descuento) || 0), 0))}</span>
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
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-stone-900">Punto de Venta</h1>
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
                        : (conIgv ? p.precio_final : (p.precio_venta || p.precio_final))
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

                {/* Found */}
                {clienteEncontrado && posCliente.nombre && (
                  <p className="text-xs text-emerald-600 font-medium mt-2 px-1 flex items-center gap-1">
                    <CheckCircle size={12} /> {posCliente.nombre}
                  </p>
                )}

                {/* Not found — manual fields */}
                {posCliente.num_doc.length > 0 && !clienteEncontrado && !buscandoDoc && (
                  <div className="mt-3 space-y-2">
                    {((posCliente.tipo_doc === 'DNI' && posCliente.num_doc.length === 8) || (posCliente.tipo_doc === 'RUC' && posCliente.num_doc.length === 11)) && (
                      <p className="text-[11px] text-amber-600 px-1 flex items-center gap-1">
                        <AlertTriangle size={11} /> No encontrado — ingresa los datos manualmente
                      </p>
                    )}
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
                      placeholder="Email"
                    />
                    <input
                      type="tel"
                      value={posCliente.telefono}
                      onChange={e => setPosCliente(p => ({ ...p, telefono: e.target.value }))}
                      className={cx.input + ' text-sm'}
                      placeholder="Teléfono"
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
                onClick={() => {
                  setLastSaleId(null);
                  toast.success('Ve a Comprobantes para emitir');
                }}
                className={cx.btnPrimary + ' w-full py-2.5 text-sm'}
              >
                Emitir boleta
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
    </div>
  );
}
