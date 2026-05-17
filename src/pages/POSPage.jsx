import { useState, useEffect, useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { cx } from '../styles/tokens';
import { formatCurrency } from '../utils/format';
import { X, Package, CheckCircle } from 'lucide-react';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function POSPage() {
  const api = useApi();
  const toast = useToast();

  // Products
  const [productos, setProductos] = useState([]);
  const [loadingProductos, setLoadingProductos] = useState(true);

  // Search
  const [posSearch, setPosSearch] = useState('');

  // Cart
  const [cartItems, setCartItems] = useState([]);

  // Variant selector modal
  const [variantModal, setVariantModal] = useState(null);

  // Checkout
  const [showCheckout, setShowCheckout] = useState(false);
  const [posCliente, setPosCliente] = useState({ tipo_doc: 'DNI', num_doc: '', nombre: '', email: '', telefono: '' });
  const [buscandoDoc, setBuscandoDoc] = useState(false);
  const [saving, setSaving] = useState(false);

  // Post-sale success
  const [lastSaleId, setLastSaleId] = useState(null);
  const [lastSaleCode, setLastSaleCode] = useState(null);

  // Fetch products on mount
  useEffect(() => {
    setLoadingProductos(true);
    api.get('/productos')
      .then(res => setProductos(res.data || []))
      .catch(() => toast.error('Error cargando productos'))
      .finally(() => setLoadingProductos(false));
  }, []); // eslint-disable-line

  // Enriched products
  const enrichedProductos = useMemo(() =>
    productos.map(p => ({ ...p, value: p.id, label: p.nombre })),
    [productos]
  );

  // Filtered products by search
  const posFilteredProducts = useMemo(() => {
    if (!posSearch) return enrichedProductos;
    const q = posSearch.toLowerCase();
    return enrichedProductos.filter(p =>
      p.nombre.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)
    );
  }, [enrichedProductos, posSearch]);

  // Cart total
  const cartTotal = useMemo(() =>
    cartItems.reduce((s, i) => s + i.precio * i.cantidad - (parseFloat(i.descuento) || 0), 0),
    [cartItems]
  );

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
    setCartItems(prev => [...prev, {
      producto_id: product.id || product.value,
      variante_id: null,
      nombre: product.nombre || product.label,
      variante_nombre: null,
      precio: parseFloat(product.precio_final) || 0,
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
      precio: parseFloat(variant.precio_final) || parseFloat(product.precio_final) || 0,
      cantidad: 1,
      descuento: 0,
      descuento_tipo: 'monto',
      descuento_pct: 0,
    }]);
  };

  // DNI/RUC lookup
  const buscarDocumento = async (tipo, numero) => {
    setBuscandoDoc(true);
    try {
      const endpoint = tipo === 'DNI'
        ? `/facturacion/buscar-dni/${numero}`
        : `/facturacion/buscar-ruc/${numero}`;
      const r = await api.get(endpoint);
      const d = r?.data || r;
      if (d) {
        setPosCliente(prev => ({
          ...prev,
          nombre: d.nombre_completo || d.razon_social || d.nombre || prev.nombre,
        }));
        toast.success('Cliente encontrado');
      }
    } catch {
      // Not found — user enters manually
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
          precio_unitario: i.precio,
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
      setShowCheckout(false);
    } catch (err) {
      toast.error(err.message || 'Error registrando venta');
    } finally {
      setSaving(false);
    }
  };

  // Cart panel — reused on both desktop and mobile
  const CartPanel = ({ isMobile = false }) => (
    <div className={cx.card + ' p-4' + (!isMobile ? ' lg:sticky lg:top-4' : '')}>
      <h3 className="font-bold text-stone-900 mb-3">Carrito ({cartItems.length})</h3>

      {cartItems.length === 0 ? (
        <p className="text-stone-400 text-sm text-center py-8">Selecciona productos</p>
      ) : (
        <div className="space-y-2 mb-4">
          {cartItems.map((item, i) => (
            <div key={i} className="flex items-center gap-2 bg-stone-50 rounded-lg p-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-800 truncate">{item.nombre}</p>
                {item.variante_nombre && <p className="text-[10px] text-stone-400">{item.variante_nombre}</p>}
                <p className="text-xs text-stone-500">{formatCurrency(item.precio)} x {item.cantidad}</p>
                <div className="flex items-center gap-1 mt-1">
                  <select
                    value={item.descuento_tipo || 'monto'}
                    onChange={e => {
                      const next = [...cartItems];
                      next[i] = { ...next[i], descuento_tipo: e.target.value };
                      setCartItems(next);
                    }}
                    className="text-[10px] border rounded px-1 py-0.5 bg-stone-50"
                  >
                    <option value="pct">%</option>
                    <option value="monto">S/</option>
                  </select>
                  <input
                    type="number" min="0" step="0.01"
                    value={item.descuento_tipo === 'pct' ? (item.descuento_pct || '') : (item.descuento || '')}
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0;
                      const next = [...cartItems];
                      if (item.descuento_tipo === 'pct') {
                        const monto = item.precio * item.cantidad * val / 100;
                        next[i] = { ...next[i], descuento_pct: val, descuento: Math.round(monto * 100) / 100 };
                      } else {
                        next[i] = { ...next[i], descuento: val, descuento_pct: 0 };
                      }
                      setCartItems(next);
                    }}
                    className="w-14 text-[10px] border rounded px-1 py-0.5"
                    placeholder="Desc"
                  />
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateCartQty(i, -1)} className="w-6 h-6 rounded bg-stone-200 text-stone-600 text-xs flex items-center justify-center">-</button>
                <span className="text-sm font-bold w-6 text-center">{item.cantidad}</span>
                <button onClick={() => updateCartQty(i, 1)} className="w-6 h-6 rounded bg-stone-200 text-stone-600 text-xs flex items-center justify-center">+</button>
              </div>
              <button onClick={() => removeFromCart(i)} className="text-stone-400 hover:text-rose-500 transition-colors duration-100">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {cartItems.length > 0 && (
        <>
          {showCheckout ? (
            <div className="border-t border-stone-200 pt-3 space-y-3">
              <h3 className="font-bold text-stone-900">Datos del cliente</h3>

              {/* Document type + number */}
              <div className="flex gap-2">
                <select
                  value={posCliente.tipo_doc}
                  onChange={e => setPosCliente(p => ({ ...p, tipo_doc: e.target.value }))}
                  className={cx.input + ' w-24 text-sm'}
                >
                  <option value="DNI">DNI</option>
                  <option value="RUC">RUC</option>
                </select>
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={posCliente.num_doc}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, '');
                      setPosCliente(p => ({ ...p, num_doc: v }));
                      if (posCliente.tipo_doc === 'DNI' && v.length === 8) buscarDocumento('DNI', v);
                      if (posCliente.tipo_doc === 'RUC' && v.length === 11) buscarDocumento('RUC', v);
                    }}
                    className={cx.input + ' text-sm'}
                    placeholder={posCliente.tipo_doc === 'DNI' ? '12345678' : '20123456789'}
                    maxLength={posCliente.tipo_doc === 'DNI' ? 8 : 11}
                  />
                  {buscandoDoc && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                  )}
                </div>
              </div>

              {/* Name */}
              <input
                type="text"
                value={posCliente.nombre}
                onChange={e => setPosCliente(p => ({ ...p, nombre: e.target.value }))}
                className={cx.input + ' text-sm'}
                placeholder="Nombre del cliente"
              />

              {/* Email + Phone */}
              <div className="grid grid-cols-2 gap-2">
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
                  placeholder="Teléfono"
                />
              </div>

              {/* Total + confirm */}
              <div className="border-t border-stone-200 pt-3">
                <div className="flex justify-between text-lg font-bold mb-3">
                  <span>Total</span>
                  <span className="text-[var(--accent)]">{formatCurrency(cartTotal)}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowCheckout(false)} className={cx.btnGhost + ' flex-1 text-sm'}>
                    Volver
                  </button>
                  <button
                    onClick={handleCheckout}
                    disabled={saving}
                    className={cx.btnPrimary + ' flex-1 text-sm py-3'}
                  >
                    {saving ? '...' : 'Confirmar venta'}
                  </button>
                </div>
              </div>

              <p className="text-[10px] text-stone-400 text-center">Datos del cliente son opcionales para boleta</p>
            </div>
          ) : (
            <>
              <div className="border-t border-stone-200 pt-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Subtotal</span>
                  <span>{formatCurrency(cartTotal)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-[var(--accent)]">{formatCurrency(cartTotal)}</span>
                </div>
              </div>
              <button
                onClick={() => setShowCheckout(true)}
                className={cx.btnPrimary + ' w-full mt-4 py-3 text-sm flex items-center justify-center gap-2'}
              >
                {`Cobrar ${formatCurrency(cartTotal)}`}
              </button>
            </>
          )}
        </>
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
                    <p className="text-xs font-bold text-[var(--accent)]">{formatCurrency(p.precio_final)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: Cart — desktop only */}
          <div className="hidden lg:block lg:w-80 xl:w-96 flex-shrink-0">
            <CartPanel />
          </div>

          {/* Cart — mobile only (below grid) */}
          <div className="lg:hidden">
            <CartPanel isMobile />
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
