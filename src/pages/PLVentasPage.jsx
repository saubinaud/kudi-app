import { useState, useEffect, useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { cx } from '../styles/tokens';
import { formatCurrency, formatDate, formatDateTime } from '../utils/format';
import SearchableSelect from '../components/SearchableSelect';
import CustomSelect from '../components/CustomSelect';
import PeriodoSelector from '../components/PeriodoSelector';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  Plus, X, Trash2, Pencil, ChevronDown, ChevronUp,
  DollarSign, TrendingUp, Package, ShoppingCart, FileText,
  Ban,
} from 'lucide-react';

// Month names in Spanish
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonthPeriod() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const inicio = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const fin = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { nombre: `${MESES[m]} ${y}`, fecha_inicio: inicio, fecha_fin: fin };
}

export default function PLVentasPage() {
  const api = useApi();
  const { user } = useAuth();
  const toast = useToast();

  // Data
  const [periodos, setPeriodos] = useState([]);
  const [periodo, setPeriodo] = useState(null);
  const [ventas, setVentas] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [productos, setProductos] = useState([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [loadingVentas, setLoadingVentas] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVenta, setEditingVenta] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [collapsed, setCollapsed] = useState({});
  const [creatingPeriodo, setCreatingPeriodo] = useState(false);

  // Emitir comprobante state
  const [emitirModal, setEmitirModal] = useState(null);
  const [emitirTipo, setEmitirTipo] = useState('boleta');
  const [emitirClienteId, setEmitirClienteId] = useState('');
  const [emitirClientes, setEmitirClientes] = useState([]);
  const [emitting, setEmitting] = useState(false);

  // Venta client state
  const [ventaClientes, setVentaClientes] = useState([]);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClient, setNewClient] = useState({});

  // Modal form
  const [form, setForm] = useState({
    fecha: todayStr(),
    nota: '',
    cuenta_id: '',
    cliente_id: '',
  });
  const [ventaItems, setVentaItems] = useState([{ _id: Date.now(), producto_id: null, variante_id: null, cantidad: 1, precio_unitario: '', descuento: 0, descuento_tipo: 'monto', descuento_pct: 0 }]);
  const [descuentoGlobal, setDescuentoGlobal] = useState(0);
  const [contraEntrega, setContraEntrega] = useState(false);
  const [adelanto, setAdelanto] = useState('');
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [cuentas, setCuentas] = useState([]);

  // Vendedor state
  const [vendedores, setVendedores] = useState([]);
  const [vendedorId, setVendedorId] = useState('');

  // Shipping state
  const [tipoDelivery, setTipoDelivery] = useState('sin_envio');
  const [costoEnvio, setCostoEnvio] = useState('');
  const [zonaEnvioId, setZonaEnvioId] = useState('');
  const [direccionEnvio, setDireccionEnvio] = useState('');
  const [canalId, setCanalId] = useState('');
  const [zonas, setZonas] = useState([]);
  const [canales, setCanales] = useState([]);

  // Address selector state
  const [clienteDirecciones, setClienteDirecciones] = useState([]);
  const [direccionSeleccionadaId, setDireccionSeleccionadaId] = useState('');
  const [mostrarNuevaDireccion, setMostrarNuevaDireccion] = useState(false);
  const [guardarNuevaDireccion, setGuardarNuevaDireccion] = useState(false);
  const [nuevaDireccionData, setNuevaDireccionData] = useState({
    etiqueta: '', direccion: '', referencia: '', distrito: '', telefono_contacto: ''
  });

  // Cancel sale state
  const [cancelTarget, setCancelTarget] = useState(null);

  // Ventas filter
  const [ventaFilter, setVentaFilter] = useState('todas');
  const contraEntregaCount = useMemo(() => ventas.filter(v => v.estado_pago === 'contra_entrega').length, [ventas]);
  const filteredVentas = useMemo(() => ventaFilter === 'contra_entrega'
    ? ventas.filter(v => v.estado_pago === 'contra_entrega')
    : ventas, [ventas, ventaFilter]);

  // Load periodos + productos on mount
  useEffect(() => {
    Promise.all([
      api.get('/pl/periodos').catch(() => ({ data: [] })),
      api.get('/productos').catch(() => ({ data: [] })),
      api.get('/flujo/cuentas').catch(() => ({ data: [] })),
      api.get('/clientes').catch(() => ({ data: [] })),
      api.get('/canales/zonas').catch(() => ({ data: [] })),
      api.get('/canales').catch(() => ({ data: [] })),
      api.get('/equipo').catch(() => ({ data: [] })),
    ]).then(([perRes, prodRes, cuentasRes, clientesRes, zonasRes, canalesRes, equipoRes]) => {
      const pers = perRes.data || [];
      setPeriodos(pers);
      setCuentas((cuentasRes.data || []).map(c => ({ value: c.id, label: c.nombre })));
      setProductos(prodRes.data || []);
      setVentaClientes((clientesRes.data || []).map(c => ({ value: c.id, label: `${c.num_doc} — ${c.razon_social || 'Sin nombre'}` })));
      setZonas(zonasRes.data || []);
      setCanales(canalesRes.data || []);
      const vends = (equipoRes.data || []).filter(m => parseFloat(m.comision_pct) > 0);
      setVendedores(vends);
      // Default to current month (Lima time)
      const now = new Date(Date.now() - 5*60*60*1000);
      setPeriodo({ year: now.getFullYear(), month: now.getMonth() + 1 });
      setLoading(false);
    });
  }, []);

  // Load ventas + resumen when periodo changes
  const loadVentas = async (p) => {
    if (!p) return;
    setLoadingVentas(true);
    try {
      const qs = `year=${p.year}&month=${p.month}`;
      const [ventasRes, resumenRes] = await Promise.all([
        api.get(`/pl/ventas?${qs}`),
        api.get(`/pl/ventas/resumen?${qs}`),
      ]);
      setVentas(ventasRes.data || []);
      setResumen(resumenRes.data || null);
    } catch {
      toast.error('Error cargando ventas');
    } finally {
      setLoadingVentas(false);
    }
  };

  useEffect(() => {
    if (periodo) loadVentas(periodo);
  }, [periodo]); // eslint-disable-line

  // Period options for CustomSelect
  const periodoOptions = useMemo(() =>
    periodos.map((p) => ({ value: String(p.id), label: p.nombre })),
    [periodos]
  );

  // Create first period (current month)
  const crearPrimerPeriodo = async () => {
    setCreatingPeriodo(true);
    try {
      const mp = currentMonthPeriod();
      const res = await api.post('/pl/periodos', mp);
      const nuevo = res.data;
      setPeriodos([nuevo]);
      const now = new Date();
      setPeriodo({ year: now.getFullYear(), month: now.getMonth() + 1 });
      toast.success('Periodo creado');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCreatingPeriodo(false);
    }
  };

  // Enriched productos for SearchableSelect
  const enrichedProductos = useMemo(() =>
    productos.map(p => ({
      ...p,
      value: p.id,
      label: p.nombre,
    })),
    [productos]
  );


  const fetchClienteDirecciones = async (clienteId) => {
    if (!clienteId) { setClienteDirecciones([]); return; }
    try {
      const r = await api.get(`/direcciones/cliente/${clienteId}`);
      const dirs = r?.data || r || [];
      setClienteDirecciones(dirs);
      // Auto-select principal address
      const principal = dirs.find(d => d.es_principal);
      if (principal) {
        setDireccionSeleccionadaId(principal.id);
        setDireccionEnvio(principal.direccion);
        setMostrarNuevaDireccion(false);
      } else if (dirs.length > 0) {
        setDireccionSeleccionadaId(dirs[0].id);
        setDireccionEnvio(dirs[0].direccion);
        setMostrarNuevaDireccion(false);
      } else {
        setDireccionSeleccionadaId('');
        setMostrarNuevaDireccion(false);
      }
    } catch (e) {
      console.error('Error fetching direcciones:', e);
      setClienteDirecciones([]);
    }
  };

  // Item management functions
  const addItem = () => setVentaItems(prev => [...prev, { _id: Date.now(), producto_id: null, variante_id: null, cantidad: 1, precio_unitario: '', descuento: 0, descuento_tipo: 'monto', descuento_pct: 0 }]);

  const removeItem = (id) => setVentaItems(prev => prev.filter(i => i._id !== id));

  const updateItem = (id, field, value) => setVentaItems(prev => prev.map(i => i._id === id ? { ...i, [field]: value } : i));

  const selectProducto = (itemId, producto) => {
    const hasVariants = producto.variantes && producto.variantes.length > 0;
    setVentaItems(prev => prev.map(i => i._id === itemId ? {
      ...i,
      producto_id: producto.id,
      producto_nombre: producto.nombre,
      variante_id: null,
      precio_unitario: hasVariants ? '' : (parseFloat(producto.precio_final) || ''),
    } : i));
  };

  // Helper to get variants for a product
  const getProductVariantes = (productoId) => {
    const prod = enrichedProductos.find(p => p.id === productoId || p.value === productoId);
    return prod?.variantes || [];
  };

  // When a variant is selected, set variante_id and precio_unitario
  const updateVariante = (itemId, varianteId) => {
    setVentaItems(prev => prev.map(i => {
      if (i._id !== itemId) return i;
      const variantes = getProductVariantes(i.producto_id);
      const variante = variantes.find(v => String(v.id) === String(varianteId));
      if (!variante) return { ...i, variante_id: null, precio_unitario: '' };
      // Use variant price if available, otherwise use product price
      const prod = enrichedProductos.find(p => p.id === i.producto_id || p.value === i.producto_id);
      const precio = variante.precio_final ? parseFloat(variante.precio_final) : (parseFloat(prod?.precio_final) || '');
      return { ...i, variante_id: variante.id, precio_unitario: precio };
    }));
  };

  // Create client inline
  async function handleCreateClient() {
    if (!newClient.num_doc) return;
    try {
      const res = await api.post('/clientes', { tipo_doc: newClient.num_doc.length === 11 ? '6' : '1', ...newClient });
      const c = res.data || res;
      const newOpt = { value: c.id, label: `${c.num_doc} — ${c.razon_social || 'Sin nombre'}` };
      setVentaClientes(prev => [...prev, newOpt]);
      setForm(f => ({ ...f, cliente_id: c.id }));
      fetchClienteDirecciones(c.id);
      setShowNewClient(false);
      setNewClient({});
      toast.success('Cliente creado');
    } catch (err) {
      toast.error(err.message || 'Error creando cliente');
    }
  }

  // Open modal for new venta
  const openNewVenta = () => {
    setEditingVenta(null);
    setForm({
      fecha: todayStr(),
      nota: '',
      cuenta_id: '',
      cliente_id: '',
    });
    setVentaItems([{ _id: Date.now(), producto_id: null, variante_id: null, cantidad: 1, precio_unitario: '', descuento: 0, descuento_tipo: 'monto', descuento_pct: 0 }]);
    setDescuentoGlobal(0);
    setContraEntrega(false);
    setAdelanto('');
    setFechaEntrega('');
    setShowNewClient(false);
    setTipoDelivery('sin_envio');
    setCostoEnvio('');
    setZonaEnvioId('');
    setDireccionEnvio('');
    setCanalId('');
    setVendedorId('');
    setClienteDirecciones([]);
    setDireccionSeleccionadaId('');
    setMostrarNuevaDireccion(false);
    setGuardarNuevaDireccion(false);
    setNuevaDireccionData({ etiqueta: '', direccion: '', referencia: '', distrito: '', telefono_contacto: '' });
    setModalOpen(true);
  };

  // Open modal for editing
  const openEditVenta = (v) => {
    setEditingVenta(v);
    setForm({
      fecha: v.fecha ? v.fecha.slice(0, 10) : todayStr(),
      nota: v.nota || '',
      cuenta_id: v.cuenta_id || '',
      cliente_id: v.cliente_id || '',
    });
    // Load items
    if (v.items && v.items.length > 0) {
      setVentaItems(v.items.map(i => ({
        _id: i.id || Date.now() + Math.random(),
        producto_id: i.producto_id,
        producto_nombre: i.producto_nombre,
        variante_id: i.variante_id || null,
        cantidad: i.cantidad,
        precio_unitario: parseFloat(i.precio_unitario) || '',
        descuento: parseFloat(i.descuento) || 0,
        descuento_tipo: i.descuento_tipo || 'monto',
        descuento_pct: parseFloat(i.descuento_pct) || 0,
      })));
    } else {
      // Legacy single product
      setVentaItems([{
        _id: Date.now(),
        producto_id: v.producto_id,
        producto_nombre: v.producto_nombre,
        variante_id: v.variante_id || null,
        cantidad: v.cantidad,
        precio_unitario: parseFloat(v.precio_unitario) || '',
        descuento: parseFloat(v.descuento) || 0,
      }]);
    }
    setDescuentoGlobal(parseFloat(v.descuento_global) || 0);
    setCanalId(v.canal_id || '');
    setTipoDelivery(v.tipo_delivery || (v.tipo_envio ? (v.tipo_envio === 'propio' ? 'delivery_propio' : 'delivery_externo') : 'sin_envio'));
    setCostoEnvio(v.costo_envio ? String(v.costo_envio) : '');
    setZonaEnvioId(v.zona_envio_id || '');
    setDireccionEnvio(v.direccion_envio || '');
    setClienteDirecciones([]);
    setDireccionSeleccionadaId(v.cliente_direccion_id || '');
    setMostrarNuevaDireccion(false);
    setGuardarNuevaDireccion(false);
    setNuevaDireccionData({ etiqueta: '', direccion: '', referencia: '', distrito: '', telefono_contacto: '' });
    if (v.cliente_id) fetchClienteDirecciones(v.cliente_id);
    setModalOpen(true);
  };

  // Computed subtotal and total
  const subtotal = ventaItems.reduce((s, i) => s + ((parseFloat(i.precio_unitario) || 0) * (parseInt(i.cantidad) || 1) - (parseFloat(i.descuento) || 0)), 0);
  const deliveryCost = tipoDelivery === 'delivery_propio' ? (parseFloat(costoEnvio) || 0) : 0;
  const total = subtotal - descuentoGlobal + deliveryCost;

  // Save venta
  const saveVenta = async () => {
    const validItems = ventaItems.filter(i => i.producto_id);
    if (validItems.length === 0 || !form.fecha) {
      toast.error('Al menos un producto y fecha son requeridos');
      return;
    }
    try {
      // Validate: if product has variants, variant must be selected
      const missingVariant = validItems.find(i => {
        const variantes = getProductVariantes(i.producto_id);
        return variantes.length > 0 && !i.variante_id;
      });
      if (missingVariant) {
        const prod = enrichedProductos.find(p => p.id === missingVariant.producto_id);
        toast.error(`Selecciona una variante para "${prod?.nombre || 'producto'}"`);
        return;
      }

      const itemsPayload = validItems.map(i => ({
        producto_id: i.producto_id,
        variante_id: i.variante_id || null,
        cantidad: parseInt(i.cantidad) || 1,
        precio_unitario: parseFloat(i.precio_unitario) || 0,
        descuento: parseFloat(i.descuento) || 0,
        descuento_tipo: i.descuento_tipo || 'monto',
        descuento_pct: parseFloat(i.descuento_pct) || 0,
      }));

      // If new address should be saved before sale
      let savedDireccionId = direccionSeleccionadaId || null;
      if (guardarNuevaDireccion && form.cliente_id && mostrarNuevaDireccion && nuevaDireccionData.direccion) {
        try {
          const dirRes = await api.post('/direcciones', {
            cliente_id: form.cliente_id,
            etiqueta: nuevaDireccionData.etiqueta || 'Casa',
            direccion: nuevaDireccionData.direccion,
            referencia: nuevaDireccionData.referencia || null,
            distrito: nuevaDireccionData.distrito || null,
            telefono_contacto: nuevaDireccionData.telefono_contacto || null,
          });
          const savedDir = dirRes?.data || dirRes;
          if (savedDir?.id) savedDireccionId = savedDir.id;
        } catch (dirErr) {
          console.error('Error guardando dirección:', dirErr);
        }
      }

      if (editingVenta) {
        await api.put(`/pl/ventas/${editingVenta.id}`, {
          items: itemsPayload,
          fecha: form.fecha,
          descuento_global: descuentoGlobal,
          nota: form.nota,
          cliente_id: form.cliente_id || null,
          canal_id: canalId || null,
          cuenta_id: form.cuenta_id || null,
          tipo_delivery: tipoDelivery || 'sin_envio',
          tipo_envio: tipoDelivery !== 'sin_envio' ? tipoDelivery : null,
          costo_envio: tipoDelivery === 'delivery_propio' ? parseFloat(costoEnvio) || 0 : 0,
          zona_envio_id: zonaEnvioId || null,
          direccion_envio: direccionEnvio || null,
          cliente_direccion_id: savedDireccionId || null,
        });
        toast.success('Venta actualizada');
      } else {
        await api.post('/pl/ventas', {
          items: itemsPayload,
          fecha: form.fecha,
          descuento_global: descuentoGlobal,
          nota: form.nota,
          cuenta_id: form.cuenta_id || null,
          cliente_id: form.cliente_id || null,
          tipo_delivery: tipoDelivery || 'sin_envio',
          tipo_envio: tipoDelivery !== 'sin_envio' ? tipoDelivery : null,
          costo_envio: tipoDelivery === 'delivery_propio' ? parseFloat(costoEnvio) || 0 : 0,
          zona_envio_id: zonaEnvioId || null,
          direccion_envio: direccionEnvio || null,
          canal_id: canalId || null,
          vendedor_id: vendedorId || null,
          cliente_direccion_id: savedDireccionId || null,
        });
        toast.success('Venta registrada');

        // If contra entrega, create a pedido
        if (contraEntrega) {
          try {
            const firstItem = validItems[0];
            const prod = productos.find(p => p.id === firstItem.producto_id);
            await api.post('/pedidos', {
              cliente_id: form.cliente_id || null,
              descripcion: validItems.length > 1 ? `${validItems.length} productos` : (prod?.nombre || 'Pedido'),
              items: validItems.map(i => ({
                producto_id: i.producto_id,
                cantidad: parseInt(i.cantidad) || 1,
                precio_unitario: parseFloat(i.precio_unitario) || 0,
              })),
              monto_total: subtotal,
              tipo_pago: 'contra_entrega',
              adelanto: parseFloat(adelanto) || 0,
              fecha_entrega_estimada: fechaEntrega || null,
              metodo_pago: 'efectivo',
              cuenta_id: form.cuenta_id || null,
            });
            toast.success('Pedido contra entrega creado');
          } catch (pedidoErr) {
            toast.error('Venta registrada pero error creando pedido: ' + (pedidoErr.message || ''));
          }
        }
      }
      setModalOpen(false);
      setContraEntrega(false);
      setAdelanto('');
      setFechaEntrega('');
      setTipoDelivery('sin_envio');
      setCostoEnvio('');
      setZonaEnvioId('');
      setDireccionEnvio('');
      setCanalId('');
      setVendedorId('');
      setClienteDirecciones([]);
      setDireccionSeleccionadaId('');
      setMostrarNuevaDireccion(false);
      setGuardarNuevaDireccion(false);
      setNuevaDireccionData({ etiqueta: '', direccion: '', referencia: '', distrito: '', telefono_contacto: '' });
      setVentaItems([{ _id: Date.now(), producto_id: null, variante_id: null, cantidad: 1, precio_unitario: '', descuento: 0, descuento_tipo: 'monto', descuento_pct: 0 }]);
      setDescuentoGlobal(0);
      loadVentas(periodo);
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Delete venta
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.del(`/pl/ventas/${deleteTarget.id}`);
      toast.success('Venta eliminada');
      loadVentas(periodo);
    } catch {
      toast.error('Error eliminando');
    } finally {
      setDeleteTarget(null);
    }
  };

  // Update estado_pago or estado_entrega
  const updateVentaEstado = async (ventaId, changes) => {
    try {
      await api.patch(`/pl/ventas/${ventaId}/estado`, changes);
      setVentas(prev => prev.map(v => v.id === ventaId ? { ...v, ...changes } : v));
    } catch (err) {
      toast.error('Error al actualizar estado');
    }
  };

  // Cancel sale handler
  const handleCancelVenta = async () => {
    if (!cancelTarget) return;
    try {
      await api.post(`/pl/ventas/${cancelTarget.id}/cancelar`);
      toast.success('Venta cancelada — stock devuelto');
      setCancelTarget(null);
      loadVentas(periodo);
    } catch (err) { toast.error(err.message); }
  };

  // Emitir comprobante handlers
  function openEmitirModal(venta) {
    setEmitirModal(venta);
    setEmitirTipo('boleta');
    setEmitirClienteId('');
    api.get('/clientes').then(res => {
      setEmitirClientes((res.data || res || []).map(c => ({ value: c.id, label: `${c.num_doc} - ${c.razon_social || ''}` })));
    }).catch(() => {});
  }

  async function handleEmitir() {
    if (!emitirModal) return;
    setEmitting(true);
    try {
      const emitirItems = (emitirModal.items || [{ producto_id: emitirModal.producto_id, producto_nombre: emitirModal.producto_nombre, cantidad: emitirModal.cantidad, precio_unitario: emitirModal.precio_unitario, descuento: emitirModal.descuento || 0 }])
        .map(i => ({
          producto_id: i.producto_id,
          producto_nombre: i.producto_nombre,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
          descuento: i.descuento || 0,
        }));

      const res = await api.post('/facturacion/emitir', {
        venta_id: emitirModal.id,
        tipo: emitirTipo,
        cliente_id: emitirClienteId || null,
        items: emitirItems,
      });
      const data = res.data || res;
      if (data.sunat?.success) {
        toast.success(`${emitirTipo === 'factura' ? 'Factura' : 'Boleta'} emitida: ${data.comprobante?.serie}-${data.comprobante?.correlativo}`);
      } else {
        toast.error(`SUNAT: ${data.sunat?.message || 'Error desconocido'}`);
      }
      setEmitirModal(null);
      loadVentas(periodo);
    } catch (err) {
      toast.error(err.message || 'Error emitiendo');
    } finally {
      setEmitting(false);
    }
  }

  // Summary computed values
  const utilidadBruta = resumen
    ? parseFloat(resumen.ingresos_brutos) - parseFloat(resumen.cogs_total)
    : 0;

  // Loading skeleton
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto pb-12 space-y-4">
        <div className={cx.skeleton + ' h-10 w-48'} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className={cx.skeleton + ' h-24'} />)}
        </div>
        <div className={cx.skeleton + ' h-64'} />
      </div>
    );
  }

  // No periods yet - show CTA
  if (periodos.length === 0) {
    return (
      <div className="max-w-7xl mx-auto pb-12">
        <h1 className="text-xl font-bold text-stone-900 mb-5">Ventas</h1>
        <div className={`${cx.card} p-12 text-center`}>
          <ShoppingCart size={40} className="text-stone-300 mx-auto mb-4" />
          <p className="text-stone-500 text-sm mb-6">
            Para registrar ventas, primero necesitas crear un periodo contable.
          </p>
          <button
            onClick={crearPrimerPeriodo}
            disabled={creatingPeriodo}
            className={cx.btnPrimary}
          >
            {creatingPeriodo ? 'Creando...' : 'Crear primer periodo'}
          </button>
        </div>
      </div>
    );
  }

  // Helper to get venta display name
  const ventaDisplayName = (v) => {
    if (v.shopify_order_name) return `Shopify ${v.shopify_order_name}`;
    if (v.items?.length > 1) return `${v.items.length} productos`;
    return v.items?.[0]?.producto_nombre || v.producto_nombre || '-';
  };

  return (
    <div className="max-w-7xl mx-auto pb-12">
      {/* Header: title + period selector + register button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-stone-900">Ventas</h1>
          <PeriodoSelector
            periodos={periodos}
            value={periodo}
            onChange={setPeriodo}
            onCreatePeriodo={async (year, month) => {
              const MESES_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
              const inicio = `${year}-${String(month+1).padStart(2,'0')}-01`;
              const lastDay = new Date(year, month+1, 0).getDate();
              const fin = `${year}-${String(month+1).padStart(2,'0')}-${lastDay}`;
              try {
                const res = await api.post('/pl/periodos', { nombre: `${MESES_FULL[month]} ${year}`, fecha_inicio: inicio, fecha_fin: fin });
                const nuevo = res.data;
                setPeriodos(prev => [nuevo, ...prev]);
              } catch(e) { toast.error(e.message); }
            }}
          />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={openNewVenta} className={cx.btnPrimary + ' flex items-center gap-2'}>
            <Plus size={14} /> Registrar venta
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {resumen && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <SummaryCard
            icon={<DollarSign size={18} />}
            label="Ingresos"
            value={formatCurrency(resumen.ingresos_brutos)}
            accent
          />
          <SummaryCard
            icon={<Package size={18} />}
            label="COGS"
            value={formatCurrency(resumen.cogs_total)}
          />
          <SummaryCard
            icon={<TrendingUp size={18} />}
            label="Utilidad bruta"
            value={formatCurrency(utilidadBruta)}
            positive={utilidadBruta >= 0}
          />
          <SummaryCard
            icon={<ShoppingCart size={18} />}
            label="Unidades vendidas"
            value={parseInt(resumen.unidades_vendidas) || 0}
          />
        </div>
      )}

      {/* Ventas list */}
      {contraEntregaCount > 0 && !loadingVentas && ventas.length > 0 && (
        <div className="flex gap-2 mb-3">
          <button onClick={() => setVentaFilter('todas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-100 ${ventaFilter === 'todas' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
            Todas ({ventas.length})
          </button>
          <button onClick={() => setVentaFilter('contra_entrega')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-100 ${ventaFilter === 'contra_entrega' ? 'bg-orange-600 text-white' : 'bg-orange-50 text-orange-700 hover:bg-orange-100'}`}>
            Contra entrega ({contraEntregaCount})
          </button>
        </div>
      )}
      {loadingVentas ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className={cx.skeleton + ' h-16'} />)}
        </div>
      ) : ventas.length === 0 ? (
        <div className={`${cx.card} p-12 text-center`}>
          <p className="text-stone-400 text-sm">No hay ventas registradas en este periodo</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className={`${cx.card} hidden lg:block overflow-hidden overflow-x-auto`}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className={cx.th} style={{width:'90px'}}>Fecha</th>
                  <th className={cx.th}>Producto</th>
                  {ventaFilter === 'contra_entrega' && <th className={cx.th}>Cliente</th>}
                  {ventaFilter === 'contra_entrega' && <th className={cx.th}>Direccion</th>}
                  <th className={cx.th + ' text-center'} style={{width:'50px'}}>Cant.</th>
                  <th className={cx.th + ' text-right'} style={{width:'70px'}}>Desc.</th>
                  <th className={cx.th + ' text-right whitespace-nowrap'} style={{width:'90px'}}>Total</th>
                  <th className={cx.th + ' text-right whitespace-nowrap'} style={{width:'80px'}}>Envío</th>
                  <th className={cx.th} style={{width:'85px'}}>Pago</th>
                  <th className={cx.th} style={{width:'95px'}}>Entrega</th>
                  <th className={cx.th + ' w-20'}></th>
                </tr>
              </thead>
              <tbody>
                {filteredVentas.map((v) => (
                  <tr key={v.id} className={cx.tr}>
                    <td className={cx.td + ' text-stone-600 whitespace-nowrap text-xs'}>{formatDateTime(v.fecha)}{v.codigo_pedido && <span className="text-stone-400 font-mono ml-1">{v.codigo_pedido}</span>}</td>
                    <td className={cx.td + ' font-medium text-stone-900'}>
                      {ventaDisplayName(v)}
                    </td>
                    {ventaFilter === 'contra_entrega' && (
                      <td className={cx.td + ' text-stone-600 text-xs'}>
                        {v.cliente_nombre || '-'}
                        {v.cliente_telefono && <span className="block text-stone-400">{v.cliente_telefono}</span>}
                      </td>
                    )}
                    {ventaFilter === 'contra_entrega' && (
                      <td className={cx.td + ' text-stone-600 text-xs max-w-[200px] truncate'}>
                        {v.direccion_envio || (v.shopify_shipping_address ? [v.shopify_shipping_address.address1, v.shopify_shipping_address.city, v.shopify_shipping_address.province].filter(Boolean).join(', ') : '-')}
                      </td>
                    )}
                    <td className={cx.td + ' text-center text-stone-600'}>
                      {v.items?.length > 1
                        ? v.items.reduce((s, i) => s + (parseInt(i.cantidad) || 0), 0)
                        : v.cantidad}
                    </td>
                    <td className={cx.td + ' text-right text-stone-400'}>
                      {parseFloat(v.descuento) > 0 || parseFloat(v.descuento_global) > 0
                        ? `-${formatCurrency((parseFloat(v.descuento) || 0) + (parseFloat(v.descuento_global) || 0))}`
                        : '-'}
                    </td>
                    <td className={cx.td + ' text-right font-semibold text-stone-900 whitespace-nowrap'}>{formatCurrency(v.total)}</td>
                    <td className={cx.td + ' text-right text-stone-500 whitespace-nowrap'}>{parseFloat(v.costo_envio) > 0 ? formatCurrency(v.costo_envio) : '-'}</td>
                    <td className={cx.td}>
                      {v.estado_pago === 'pagado' ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Pagado</span>
                      ) : v.estado_pago === 'cancelado' ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">Cancelado</span>
                      ) : (
                        <select
                          value={v.estado_pago || 'pendiente'}
                          onChange={e => updateVentaEstado(v.id, { estado_pago: e.target.value })}
                          className={`text-[10px] px-1.5 py-0.5 rounded-full border-0 cursor-pointer ${
                            v.estado_pago === 'pendiente' ? 'bg-amber-100 text-amber-700' :
                            v.estado_pago === 'contra_entrega' ? 'bg-orange-100 text-orange-700' :
                            v.estado_pago === 'reembolsado' ? 'bg-red-100 text-red-700' :
                            'bg-stone-100 text-stone-600'
                          }`}
                        >
                          <option value="pendiente">Pendiente</option>
                          <option value="pagado">Pagado</option>
                          <option value="contra_entrega">Contra entrega</option>
                          <option value="reembolsado">Reembolsado</option>
                        </select>
                      )}
                    </td>
                    <td className={cx.td}>
                      {v.estado_pago !== 'cancelado' ? (
                        <select
                          value={v.estado_entrega || 'pendiente'}
                          onChange={e => updateVentaEstado(v.id, { estado_entrega: e.target.value })}
                          className={`text-[10px] px-1.5 py-0.5 rounded-full border-0 cursor-pointer ${
                            (v.estado_entrega || 'pendiente') === 'entregado' ? 'bg-emerald-100 text-emerald-700' :
                            v.estado_entrega === 'enviado' ? 'bg-blue-100 text-blue-700' :
                            v.estado_entrega === 'preparando' ? 'bg-violet-100 text-violet-700' :
                            'bg-stone-100 text-stone-500'
                          }`}
                        >
                          <option value="pendiente">Pendiente</option>
                          <option value="preparando">Preparando</option>
                          <option value="enviado">Enviado</option>
                          <option value="entregado">Entregado</option>
                        </select>
                      ) : (
                        <span className="text-[10px] text-stone-400">—</span>
                      )}
                    </td>
                    <td className={cx.td}>
                      <div className="flex items-center gap-1 justify-end">
                        {v.facturado && (
                          <span className={cx.badge('bg-emerald-50 text-emerald-600')}>Facturado</span>
                        )}
                        {!v.facturado && (
                          <button onClick={() => openEmitirModal(v)} className={cx.btnGhost + ' text-xs text-[var(--accent)]'}>
                            Emitir
                          </button>
                        )}
                        {v.estado_pago !== 'cancelado' && (
                          <button onClick={() => setCancelTarget(v)} className={cx.btnIcon + ' hover:text-rose-600'} title="Cancelar venta"><Ban size={14} /></button>
                        )}
                        <button onClick={() => openEditVenta(v)} className={cx.btnIcon}><Pencil size={14} /></button>
                        <button onClick={() => setDeleteTarget(v)} className={cx.btnIcon + ' hover:text-rose-600'}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: accordion cards */}
          <div className={`${cx.card} divide-y divide-stone-100 lg:hidden`}>
            {filteredVentas.map((v) => {
              const isExpanded = collapsed[v.id] === true;
              return (
                <div key={v.id} className="p-4">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setCollapsed((prev) => ({ ...prev, [v.id]: !prev[v.id] }))}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isExpanded
                        ? <ChevronUp size={16} className="text-stone-400 flex-shrink-0" />
                        : <ChevronDown size={16} className="text-stone-400 flex-shrink-0" />
                      }
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-stone-900 truncate">
                          {ventaDisplayName(v)}
                          {v.estado_pago === 'cancelado' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 ml-2">Cancelada</span>
                          )}
                          {v.estado_pago && v.estado_pago !== 'pagado' && v.estado_pago !== 'cancelado' && (
                            <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${
                              v.estado_pago === 'pendiente' ? 'bg-amber-100 text-amber-700' :
                              v.estado_pago === 'contra_entrega' ? 'bg-orange-100 text-orange-700' :
                              v.estado_pago === 'reembolsado' ? 'bg-red-100 text-red-700' :
                              'bg-stone-100 text-stone-600'
                            }`}>
                              {v.estado_pago === 'pendiente' ? 'Pendiente' :
                               v.estado_pago === 'contra_entrega' ? 'Contra entrega' :
                               v.estado_pago === 'reembolsado' ? 'Reembolsado' : v.estado_pago}
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-stone-400">{formatDate(v.fecha)}{v.codigo_pedido && <span className="font-mono ml-1">{v.codigo_pedido}</span>}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-stone-900 flex-shrink-0 ml-3">{formatCurrency(v.total)}</span>
                  </div>
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-stone-100">
                      {/* Show each item if multi-product */}
                      {v.items && v.items.length > 0 ? (
                        <div className="space-y-1 mb-3">
                          {v.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-start text-xs gap-2">
                              <div className="min-w-0">
                                <span className="text-stone-700">{item.producto_nombre}</span>
                                {item.variante_nombre && <span className="text-stone-400 ml-1">({item.variante_nombre})</span>}
                                <span className="text-stone-500"> x{item.cantidad}</span>
                                {item.stock_descontado && (
                                  <span className="ml-1 text-[10px] text-emerald-600">✓ Stock {item.stock_descontado}</span>
                                )}
                              </div>
                              <span className="text-stone-600 flex-shrink-0">{formatCurrency((parseFloat(item.precio_unitario) || 0) * (parseInt(item.cantidad) || 1))}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                          <div>
                            <span className="text-stone-400">Precio unit.</span>
                            <p className="text-stone-800 font-medium">{formatCurrency(v.precio_unitario)}</p>
                          </div>
                          <div>
                            <span className="text-stone-400">Cantidad</span>
                            <p className="text-stone-800 font-medium">{v.cantidad}</p>
                          </div>
                        </div>
                      )}
                      {(parseFloat(v.descuento) > 0 || parseFloat(v.descuento_global) > 0) && (
                        <div className="text-xs mb-3">
                          <span className="text-stone-400">Descuento</span>
                          <p className="text-stone-800 font-medium">
                            {formatCurrency((parseFloat(v.descuento) || 0) + (parseFloat(v.descuento_global) || 0))}
                          </p>
                        </div>
                      )}
                      {v.nota && (
                        <div className="text-xs mb-3">
                          <span className="text-stone-400">Nota</span>
                          <p className="text-stone-600">{v.nota}</p>
                        </div>
                      )}
                      {(v.cliente_nombre || v.metodo_pago || v.metodo_envio) && (
                        <div className="text-xs text-stone-500 space-y-0.5 mb-2">
                          {v.cliente_nombre && <p>{v.cliente_nombre} {v.cliente_telefono ? `· ${v.cliente_telefono}` : ''}</p>}
                          {v.metodo_pago && <p>{v.metodo_pago}</p>}
                          {v.metodo_envio && <p>{v.metodo_envio}{v.costo_envio > 0 ? ` · S/${parseFloat(v.costo_envio).toFixed(2)}` : ''}</p>}
                          {v.shopify_nota && <p>{v.shopify_nota}</p>}
                        </div>
                      )}
                      {v.estado_pago !== 'cancelado' && (
                        <div className="flex gap-2 mb-3 flex-wrap">
                          {v.estado_pago === 'pagado' ? (
                            <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">Pagado</span>
                          ) : (
                            <select
                              value={v.estado_pago || 'pendiente'}
                              onChange={e => updateVentaEstado(v.id, { estado_pago: e.target.value })}
                              className={`text-[10px] px-2 py-1 rounded-full border-0 cursor-pointer ${
                                v.estado_pago === 'pendiente' ? 'bg-amber-100 text-amber-700' :
                                v.estado_pago === 'contra_entrega' ? 'bg-orange-100 text-orange-700' :
                                v.estado_pago === 'reembolsado' ? 'bg-red-100 text-red-700' :
                                'bg-stone-100 text-stone-600'
                              }`}
                            >
                              <option value="pendiente">Pendiente</option>
                              <option value="pagado">Pagado</option>
                              <option value="contra_entrega">Contra entrega</option>
                              <option value="reembolsado">Reembolsado</option>
                            </select>
                          )}
                          <select
                            value={v.estado_entrega || 'pendiente'}
                            onChange={e => updateVentaEstado(v.id, { estado_entrega: e.target.value })}
                            className={`text-[10px] px-2 py-1 rounded-full border-0 cursor-pointer ${
                              (v.estado_entrega || 'pendiente') === 'entregado' ? 'bg-emerald-100 text-emerald-700' :
                              v.estado_entrega === 'enviado' ? 'bg-blue-100 text-blue-700' :
                              v.estado_entrega === 'preparando' ? 'bg-violet-100 text-violet-700' :
                              'bg-stone-100 text-stone-500'
                            }`}
                          >
                            <option value="pendiente">Pendiente</option>
                            <option value="preparando">Preparando</option>
                            <option value="enviado">Enviado</option>
                            <option value="entregado">Entregado</option>
                          </select>
                        </div>
                      )}
                      <div className="flex gap-2 flex-wrap">
                        {v.facturado && (
                          <span className={cx.badge('bg-emerald-50 text-emerald-600')}>Facturado</span>
                        )}
                        {!v.facturado && (
                          <button onClick={() => openEmitirModal(v)} className={cx.btnGhost + ' text-xs text-[var(--accent)] flex items-center gap-1'}>
                            <FileText size={12} /> Emitir
                          </button>
                        )}
                        {v.estado_pago !== 'cancelado' && (
                          <button onClick={() => setCancelTarget(v)} className={cx.btnDanger + ' text-xs flex items-center gap-1'}>
                            <Ban size={12} /> Cancelar
                          </button>
                        )}
                        <button onClick={() => openEditVenta(v)} className={cx.btnGhost + ' text-xs flex items-center gap-1'}>
                          <Pencil size={12} /> Editar
                        </button>
                        <button onClick={() => setDeleteTarget(v)} className={cx.btnDanger + ' text-xs flex items-center gap-1'}>
                          <Trash2 size={12} /> Eliminar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}


      {/* Register/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] sm:max-w-md max-h-[85vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-stone-900">
                  {editingVenta ? 'Editar venta' : 'Registrar venta'}
                </h3>
                <button onClick={() => setModalOpen(false)} className={cx.btnIcon}>
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Products list */}
                <div className="space-y-2">
                  <label className={cx.label}>Productos</label>
                  {ventaItems.map((item, idx) => (
                    <div key={item._id} className="bg-stone-50 rounded-lg p-2 space-y-2">
                      <div className="space-y-2">
                        <SearchableSelect
                          options={enrichedProductos}
                          value={item.producto_id}
                          onChange={(prod) => selectProducto(item._id, prod)}
                          placeholder="Producto..."
                        />
                        <div className="flex flex-wrap gap-2 items-center">
                          <input type="number" value={item.cantidad} min="1" step={user?.stock_entero ? "1" : "0.01"}
                            onChange={e => updateItem(item._id, 'cantidad', user?.stock_entero ? (parseInt(e.target.value) || 1) : (parseFloat(e.target.value) || 1))}
                            className="w-16 bg-white rounded-lg px-2 py-2 text-sm text-center border border-stone-200"
                            placeholder="Cant" />
                          <input type="number" value={item.precio_unitario} readOnly
                            className="w-24 bg-stone-50 cursor-not-allowed rounded-lg px-2 py-2 text-sm text-center border border-stone-200"
                            placeholder="Precio" />
                          <div className="flex items-center gap-1">
                            <select value={item.descuento_tipo || 'monto'}
                              onChange={e => updateItem(item._id, 'descuento_tipo', e.target.value)}
                              className="text-xs border rounded px-1 py-1 bg-stone-50">
                              <option value="pct">%</option>
                              <option value="monto">S/</option>
                            </select>
                            <input type="number" min="0" step="0.01"
                              value={item.descuento_tipo === 'pct' ? (item.descuento_pct || '') : (item.descuento || '')}
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 0;
                                if (item.descuento_tipo === 'pct') {
                                  const monto = (parseFloat(item.precio_unitario) || 0) * (parseInt(item.cantidad) || 1) * val / 100;
                                  updateItem(item._id, 'descuento_pct', val);
                                  updateItem(item._id, 'descuento', Math.round(monto * 100) / 100);
                                } else {
                                  updateItem(item._id, 'descuento', val);
                                  updateItem(item._id, 'descuento_pct', 0);
                                }
                              }}
                              className={cx.input + ' w-16 text-sm'} placeholder="0" />
                          </div>
                          <span className="text-sm font-medium text-stone-700 ml-auto text-right">
                            {formatCurrency((parseFloat(item.precio_unitario) || 0) * (parseInt(item.cantidad) || 1) - (parseFloat(item.descuento) || 0))}
                          </span>
                          {ventaItems.length > 1 && (
                            <button onClick={() => removeItem(item._id)} className={cx.btnIcon + ' hover:text-rose-600'}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                      {item.producto_id && getProductVariantes(item.producto_id)?.length > 0 && (
                        <div>
                          <label className={cx.label}>Variante</label>
                          <select className={cx.input} value={item.variante_id || ''} onChange={e => updateVariante(item._id, e.target.value)}>
                            <option value="">Seleccionar...</option>
                            {getProductVariantes(item.producto_id).map(v => (
                              <option key={v.id} value={v.id}>{v.nombre} — Stock: {v.stock_actual}{v.precio_final ? ` — S/${v.precio_final}` : ''}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  ))}
                  <button onClick={addItem} className={cx.btnGhost + ' text-xs flex items-center gap-1'}>
                    <Plus size={13} /> Agregar producto
                  </button>
                </div>

                {/* Subtotal + descuento global */}
                <div className="border-t border-stone-200 pt-3 mt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">Subtotal</span>
                    <span className="text-stone-800 font-medium">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className={cx.label + ' mb-0'}>Descuento global</label>
                    <input type="number" step="0.01" value={descuentoGlobal}
                      onChange={e => setDescuentoGlobal(parseFloat(e.target.value) || 0)}
                      className="w-24 bg-white rounded-lg px-2 py-2 text-sm text-right border border-stone-200" />
                  </div>
                  {tipoDelivery === 'delivery_propio' && parseFloat(costoEnvio) > 0 ? (
                    <div className="text-xs text-stone-500 space-y-0.5">
                      <div className="flex justify-between"><span>Productos</span><span>{formatCurrency(subtotal - descuentoGlobal)}</span></div>
                      <div className="flex justify-between"><span>Delivery</span><span>{formatCurrency(parseFloat(costoEnvio))}</span></div>
                      <div className="flex justify-between font-bold text-lg text-stone-900"><span>Total cliente</span><span className="text-[var(--accent)]">{formatCurrency(total)}</span></div>
                      <p className="text-[10px] text-amber-600">La boleta se emite por S/{(subtotal - descuentoGlobal).toFixed(2)} (productos). El delivery genera un ticket aparte.</p>
                    </div>
                  ) : (
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span className="text-[var(--accent)]">{formatCurrency(total)}</span>
                    </div>
                  )}
                </div>

                {/* Date */}
                <div>
                  <label className={cx.label}>Fecha</label>
                  <input
                    type="date"
                    value={form.fecha}
                    onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                    className={cx.input}
                  />
                </div>

                {/* Contra entrega toggle */}
                {!editingVenta && (
                <>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={contraEntrega} onChange={e => setContraEntrega(e.target.checked)}
                      className="accent-[var(--accent)] w-4 h-4" />
                    <span className="text-sm text-stone-700">Contra entrega</span>
                  </label>
                </div>

                {contraEntrega && (
                  <div className="p-3 bg-amber-50 rounded-lg space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={cx.label}>Adelanto</label>
                        <input type="number" step="0.01" min="0" value={adelanto}
                          onChange={e => setAdelanto(e.target.value)} className={cx.input} placeholder="0.00" />
                      </div>
                      <div>
                        <label className={cx.label}>Restante</label>
                        <p className="text-lg font-bold text-amber-600 mt-1">
                          {formatCurrency(Math.max(0, subtotal - parseFloat(adelanto || 0)))}
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className={cx.label}>Fecha de entrega</label>
                      <input type="date" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)} className={cx.input} />
                    </div>
                  </div>
                )}
                </>
                )}

                {/* Canal de venta */}
                {canales.length > 0 && (
                  <div>
                    <label className={cx.label}>Canal de venta (opcional)</label>
                    <CustomSelect
                      value={canalId}
                      onChange={setCanalId}
                      options={[{ value: '', label: 'Venta directa (sin canal)' }, ...canales.map(c => ({ value: c.id, label: c.nombre }))]}
                      placeholder="Venta directa"
                    />
                  </div>
                )}

                {/* Vendedor (only if there are vendors with comision_pct > 0) */}
                {vendedores.length > 0 && (
                  <div>
                    <label className={cx.label}>Vendedor (opcional)</label>
                    <CustomSelect
                      value={vendedorId}
                      onChange={setVendedorId}
                      options={[
                        { value: '', label: 'Sin vendedor' },
                        ...vendedores.map(v => ({ value: v.id, label: `${v.nombre} (${parseFloat(v.comision_pct)}%)` })),
                      ]}
                      placeholder="Seleccionar vendedor..."
                    />
                  </div>
                )}

                {/* Tipo de envio */}
                <div>
                  <label className={cx.label}>Tipo de envio</label>
                  <select value={tipoDelivery}
                    onChange={e => {
                      const tipo = e.target.value;
                      setTipoDelivery(tipo);
                      if (tipo !== 'delivery_propio') setCostoEnvio('');
                    }}
                    className={cx.input + ' text-sm'}>
                    <option value="sin_envio">Sin envio (recojo en tienda)</option>
                    <option value="canal">Canal (Rappi, PedidosYa) — delivery del canal</option>
                    <option value="delivery_externo">Delivery externo — cliente paga al repartidor</option>
                    <option value="delivery_propio">Delivery propio — nosotros costeamos</option>
                  </select>
                </div>

                {tipoDelivery === 'delivery_propio' && (
                  <div className="p-3 bg-sky-50 rounded-lg space-y-3">
                    {/* Saved addresses dropdown */}
                    {clienteDirecciones.length > 0 && (
                      <div>
                        <label className={cx.label}>Dirección guardada</label>
                        <select
                          value={mostrarNuevaDireccion ? '__nueva__' : (direccionSeleccionadaId || '')}
                          onChange={e => {
                            const val = e.target.value;
                            if (val === '__nueva__') {
                              setMostrarNuevaDireccion(true);
                              setDireccionSeleccionadaId('');
                              setDireccionEnvio('');
                            } else {
                              setMostrarNuevaDireccion(false);
                              setDireccionSeleccionadaId(val);
                              const dir = clienteDirecciones.find(d => String(d.id) === String(val));
                              if (dir) {
                                setDireccionEnvio(dir.direccion);
                                // Auto-fill zona by distrito if possible
                                if (dir.distrito && zonas.length > 0) {
                                  const zonaMatch = zonas.find(z =>
                                    (z.distritos || []).some(d => d.toLowerCase() === dir.distrito.toLowerCase())
                                  );
                                  if (zonaMatch) {
                                    setZonaEnvioId(zonaMatch.id);
                                    setCostoEnvio(zonaMatch.costo);
                                  }
                                }
                              }
                            }
                          }}
                          className={cx.input + ' text-sm'}
                        >
                          {clienteDirecciones.map(d => (
                            <option key={d.id} value={d.id}>
                              {d.etiqueta ? `${d.etiqueta} — ` : ''}{d.direccion}{d.distrito ? ` (${d.distrito})` : ''}
                              {d.es_principal ? ' ★' : ''}
                            </option>
                          ))}
                          <option value="__nueva__">+ Nueva dirección</option>
                        </select>
                      </div>
                    )}

                    {/* New address form */}
                    {(mostrarNuevaDireccion || clienteDirecciones.length === 0) && (
                      <div className="space-y-2">
                        {clienteDirecciones.length === 0 && (
                          <p className="text-xs text-stone-500">No hay direcciones guardadas para este cliente.</p>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={cx.label}>Etiqueta</label>
                            <input type="text" value={nuevaDireccionData.etiqueta}
                              onChange={e => setNuevaDireccionData(p => ({...p, etiqueta: e.target.value}))}
                              className={cx.input + ' text-sm'} placeholder="Casa, Trabajo..." />
                          </div>
                          <div>
                            <label className={cx.label}>Distrito</label>
                            <input type="text" value={nuevaDireccionData.distrito}
                              onChange={e => {
                                const dist = e.target.value;
                                setNuevaDireccionData(p => ({...p, distrito: dist}));
                                // Auto-fill zona by distrito
                                if (dist && zonas.length > 0) {
                                  const zonaMatch = zonas.find(z =>
                                    (z.distritos || []).some(d => d.toLowerCase() === dist.toLowerCase())
                                  );
                                  if (zonaMatch) {
                                    setZonaEnvioId(zonaMatch.id);
                                    setCostoEnvio(zonaMatch.costo);
                                  }
                                }
                              }}
                              className={cx.input + ' text-sm'} placeholder="Miraflores..." />
                          </div>
                        </div>
                        <div>
                          <label className={cx.label}>Dirección</label>
                          <input type="text" value={nuevaDireccionData.direccion}
                            onChange={e => {
                              setNuevaDireccionData(p => ({...p, direccion: e.target.value}));
                              setDireccionEnvio(e.target.value);
                            }}
                            className={cx.input + ' text-sm'} placeholder="Av. Principal 123..." />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={cx.label}>Referencia</label>
                            <input type="text" value={nuevaDireccionData.referencia}
                              onChange={e => setNuevaDireccionData(p => ({...p, referencia: e.target.value}))}
                              className={cx.input + ' text-sm'} placeholder="Frente al parque..." />
                          </div>
                          <div>
                            <label className={cx.label}>Teléfono contacto</label>
                            <input type="tel" value={nuevaDireccionData.telefono_contacto}
                              onChange={e => setNuevaDireccionData(p => ({...p, telefono_contacto: e.target.value}))}
                              className={cx.input + ' text-sm'} placeholder="999888777" />
                          </div>
                        </div>
                        {form.cliente_id && (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={guardarNuevaDireccion}
                              onChange={e => setGuardarNuevaDireccion(e.target.checked)}
                              className="accent-[var(--accent)] w-4 h-4" />
                            <span className="text-xs text-stone-600">Guardar dirección para futuras ventas</span>
                          </label>
                        )}
                      </div>
                    )}

                    {/* Zona + Costo */}
                    <div className="grid grid-cols-2 gap-3">
                      {zonas.length > 0 && (
                        <div>
                          <label className={cx.label}>Zona</label>
                          <CustomSelect
                            value={zonaEnvioId}
                            onChange={(v) => {
                              setZonaEnvioId(v);
                              const zona = zonas.find(z => z.id === parseInt(v));
                              if (zona) setCostoEnvio(zona.costo);
                            }}
                            options={[{ value: '', label: 'Sin zona' }, ...zonas.map(z => ({ value: z.id, label: `${z.nombre} (S/ ${z.costo})` }))]}
                            placeholder="Seleccionar zona..."
                          />
                        </div>
                      )}
                      <div>
                        <label className={cx.label}>Costo de envio (se cobra al cliente)</label>
                        <input type="number" step="0.01" min="0" value={costoEnvio}
                          onChange={e => setCostoEnvio(e.target.value)} className={cx.input} placeholder="0.00" />
                        <p className="text-[10px] text-stone-400 mt-1">Este monto se suma al total del cliente pero NO aparece en la boleta. Se genera un ticket de delivery aparte.</p>
                      </div>
                    </div>

                    {/* Address text field (shown when no saved addresses or new address selected) */}
                    {(clienteDirecciones.length === 0 || mostrarNuevaDireccion) ? null : (
                      <div>
                        <label className={cx.label}>Dirección de entrega</label>
                        <input type="text" value={direccionEnvio} onChange={e => setDireccionEnvio(e.target.value)}
                          className={cx.input} placeholder="Dirección de entrega..." />
                      </div>
                    )}
                  </div>
                )}

                {(tipoDelivery === 'delivery_externo' || tipoDelivery === 'canal') && (
                  <div className="p-3 bg-sky-50 rounded-lg space-y-3">
                    {/* Saved addresses dropdown for external delivery */}
                    {clienteDirecciones.length > 0 && (
                      <div>
                        <label className={cx.label}>Dirección guardada</label>
                        <select
                          value={mostrarNuevaDireccion ? '__nueva__' : (direccionSeleccionadaId || '')}
                          onChange={e => {
                            const val = e.target.value;
                            if (val === '__nueva__') {
                              setMostrarNuevaDireccion(true);
                              setDireccionSeleccionadaId('');
                              setDireccionEnvio('');
                            } else {
                              setMostrarNuevaDireccion(false);
                              setDireccionSeleccionadaId(val);
                              const dir = clienteDirecciones.find(d => String(d.id) === String(val));
                              if (dir) setDireccionEnvio(dir.direccion);
                            }
                          }}
                          className={cx.input + ' text-sm'}
                        >
                          {clienteDirecciones.map(d => (
                            <option key={d.id} value={d.id}>
                              {d.etiqueta ? `${d.etiqueta} — ` : ''}{d.direccion}{d.distrito ? ` (${d.distrito})` : ''}
                              {d.es_principal ? ' ★' : ''}
                            </option>
                          ))}
                          <option value="__nueva__">+ Nueva dirección</option>
                        </select>
                      </div>
                    )}

                    {/* New address for external delivery */}
                    {(mostrarNuevaDireccion || clienteDirecciones.length === 0) && (
                      <div className="space-y-2">
                        {clienteDirecciones.length === 0 && form.cliente_id && (
                          <p className="text-xs text-stone-500">No hay direcciones guardadas para este cliente.</p>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={cx.label}>Etiqueta</label>
                            <input type="text" value={nuevaDireccionData.etiqueta}
                              onChange={e => setNuevaDireccionData(p => ({...p, etiqueta: e.target.value}))}
                              className={cx.input + ' text-sm'} placeholder="Casa, Trabajo..." />
                          </div>
                          <div>
                            <label className={cx.label}>Distrito</label>
                            <input type="text" value={nuevaDireccionData.distrito}
                              onChange={e => setNuevaDireccionData(p => ({...p, distrito: e.target.value}))}
                              className={cx.input + ' text-sm'} placeholder="Miraflores..." />
                          </div>
                        </div>
                        <div>
                          <label className={cx.label}>Dirección</label>
                          <input type="text" value={nuevaDireccionData.direccion}
                            onChange={e => {
                              setNuevaDireccionData(p => ({...p, direccion: e.target.value}));
                              setDireccionEnvio(e.target.value);
                            }}
                            className={cx.input + ' text-sm'} placeholder="Av. Principal 123..." />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={cx.label}>Referencia</label>
                            <input type="text" value={nuevaDireccionData.referencia}
                              onChange={e => setNuevaDireccionData(p => ({...p, referencia: e.target.value}))}
                              className={cx.input + ' text-sm'} placeholder="Frente al parque..." />
                          </div>
                          <div>
                            <label className={cx.label}>Teléfono contacto</label>
                            <input type="tel" value={nuevaDireccionData.telefono_contacto}
                              onChange={e => setNuevaDireccionData(p => ({...p, telefono_contacto: e.target.value}))}
                              className={cx.input + ' text-sm'} placeholder="999888777" />
                          </div>
                        </div>
                        {form.cliente_id && (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={guardarNuevaDireccion}
                              onChange={e => setGuardarNuevaDireccion(e.target.checked)}
                              className="accent-[var(--accent)] w-4 h-4" />
                            <span className="text-xs text-stone-600">Guardar dirección para futuras ventas</span>
                          </label>
                        )}
                      </div>
                    )}

                    {/* Address text field when saved address selected */}
                    {clienteDirecciones.length > 0 && !mostrarNuevaDireccion && (
                      <div>
                        <label className={cx.label}>Dirección de entrega</label>
                        <input type="text" value={direccionEnvio} onChange={e => setDireccionEnvio(e.target.value)}
                          className={cx.input} placeholder="Dirección de entrega..." />
                      </div>
                    )}

                    {/* Address text field when no saved addresses */}
                    {clienteDirecciones.length === 0 && !form.cliente_id && (
                      <div>
                        <label className={cx.label}>Dirección de entrega</label>
                        <input type="text" value={direccionEnvio} onChange={e => setDireccionEnvio(e.target.value)}
                          className={cx.input} placeholder="Dirección de entrega..." />
                      </div>
                    )}
                  </div>
                )}

                {/* Cuenta */}
                {cuentas.length > 0 && (
                <div>
                  <label className={cx.label}>Cuenta de ingreso</label>
                  <CustomSelect
                    options={[{ value: '', label: 'Sin especificar' }, ...cuentas]}
                    value={form.cuenta_id}
                    onChange={(v) => setForm((f) => ({ ...f, cuenta_id: v }))}
                    placeholder="¿A qué cuenta entró?"
                  />
                </div>
                )}

                {/* Cliente (opcional) */}
                <div>
                  <label className={cx.label}>Cliente (opcional)</label>
                  <CustomSelect
                    options={[{ value: '', label: 'Sin cliente' }, ...ventaClientes]}
                    value={form.cliente_id || ''}
                    onChange={(v) => {
                      setForm(f => ({ ...f, cliente_id: v }));
                      if (v) fetchClienteDirecciones(v);
                      else { setClienteDirecciones([]); setDireccionSeleccionadaId(''); setMostrarNuevaDireccion(false); }
                    }}
                    placeholder="Buscar por DNI/RUC/nombre..."
                  />
                  {!form.cliente_id && (
                    <button type="button" onClick={() => setShowNewClient(true)} className={cx.btnGhost + ' text-xs mt-1'}>
                      + Nuevo cliente
                    </button>
                  )}
                </div>

                {/* Quick new client form */}
                {showNewClient && (
                  <div className="p-3 bg-stone-50 rounded-lg space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={cx.label}>DNI/RUC</label>
                        <input type="text" value={newClient.num_doc || ''} onChange={e => setNewClient(p => ({...p, num_doc: e.target.value}))} className={cx.input} placeholder="12345678" />
                      </div>
                      <div>
                        <label className={cx.label}>Nombre/Razon social</label>
                        <input type="text" value={newClient.razon_social || ''} onChange={e => setNewClient(p => ({...p, razon_social: e.target.value}))} className={cx.input} placeholder="Juan Perez" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={cx.label}>Email</label>
                        <input type="email" value={newClient.email || ''} onChange={e => setNewClient(p => ({...p, email: e.target.value}))} className={cx.input} placeholder="correo@email.com" />
                      </div>
                      <div>
                        <label className={cx.label}>Teléfono</label>
                        <input type="tel" value={newClient.telefono || ''} onChange={e => setNewClient(p => ({...p, telefono: e.target.value}))} className={cx.input} placeholder="999888777" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={handleCreateClient} className={cx.btnPrimary + ' text-xs'}>Guardar cliente</button>
                      <button type="button" onClick={() => setShowNewClient(false)} className={cx.btnGhost + ' text-xs'}>Cancelar</button>
                    </div>
                  </div>
                )}

                {/* Note */}
                <div>
                  <label className={cx.label}>Nota (opcional)</label>
                  <input
                    type="text"
                    value={form.nota}
                    onChange={(e) => setForm((f) => ({ ...f, nota: e.target.value }))}
                    className={cx.input}
                    placeholder="Ej: Pedido delivery"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <button onClick={saveVenta} className={cx.btnPrimary + ' flex-1'}>
                  {editingVenta ? 'Guardar cambios' : 'Registrar'}
                </button>
                <button onClick={() => setModalOpen(false)} className={cx.btnSecondary}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Emitir comprobante modal */}
      {emitirModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEmitirModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] sm:max-w-md p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-stone-900">Emitir comprobante</h3>
              <button onClick={() => setEmitirModal(null)} className={cx.btnGhost}><X size={18} /></button>
            </div>

            <div className="space-y-4">
              {/* Venta info */}
              <div className="p-3 bg-stone-50 rounded-lg">
                {emitirModal.items && emitirModal.items.length > 0 ? (
                  <div className="space-y-1">
                    {emitirModal.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <div>
                          <span className="text-stone-800">{item.producto_nombre}</span>
                          {item.variante_nombre && <span className="text-stone-400 text-xs ml-1">({item.variante_nombre})</span>}
                          <span className="text-stone-500"> x{item.cantidad}</span>
                        </div>
                        <span className="text-stone-600">{formatCurrency((parseFloat(item.precio_unitario) || 0) * (parseInt(item.cantidad) || 1))}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-medium pt-1 border-t border-stone-200">
                      <span>Total</span>
                      <span>{formatCurrency(emitirModal.total)}</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium text-stone-800">{emitirModal.producto_nombre}</p>
                    <p className="text-xs text-stone-500">Cant: {emitirModal.cantidad} x {formatCurrency(emitirModal.precio_unitario)} = {formatCurrency(emitirModal.total || (emitirModal.cantidad * emitirModal.precio_unitario))}</p>
                  </>
                )}
              </div>

              {/* Tipo */}
              <div>
                <label className={cx.label}>Tipo de comprobante</label>
                <CustomSelect
                  value={emitirTipo}
                  onChange={setEmitirTipo}
                  options={[
                    { value: 'boleta', label: 'Boleta de venta' },
                    { value: 'factura', label: 'Factura' },
                  ]}
                />
              </div>

              {/* Cliente */}
              <div>
                <label className={cx.label}>
                  Cliente {emitirTipo === 'factura' ? '(requerido - con RUC)' : '(opcional)'}
                </label>
                <CustomSelect
                  value={emitirClienteId}
                  onChange={setEmitirClienteId}
                  options={[{ value: '', label: 'Sin cliente / Varios' }, ...emitirClientes]}
                  placeholder="Seleccionar cliente..."
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleEmitir}
                  disabled={emitting || (emitirTipo === 'factura' && !emitirClienteId)}
                  className={cx.btnPrimary + ' flex-1 flex items-center justify-center gap-2'}
                >
                  {emitting ? 'Emitiendo...' : `Emitir ${emitirTipo === 'factura' ? 'factura' : 'boleta'}`}
                </button>
                <button onClick={() => setEmitirModal(null)} className={cx.btnSecondary}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar venta"
        message={`Estas seguro de eliminar esta venta de "${deleteTarget ? ventaDisplayName(deleteTarget) : ''}"?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Confirm cancel */}
      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancelar venta"
        message={`¿Cancelar venta ${cancelTarget?.codigo_pedido || ''}? El stock se devolverá automáticamente.`}
        onConfirm={handleCancelVenta}
        onCancel={() => setCancelTarget(null)}
      />

    </div>
  );
}

// Summary card component
function SummaryCard({ icon, label, value, accent, positive }) {
  return (
    <div className={`${cx.card} p-4`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={accent ? 'text-[var(--accent)]' : 'text-stone-400'}>{icon}</span>
        <span className="text-xs font-semibold text-stone-500 tracking-wide uppercase">{label}</span>
      </div>
      <p className={`text-xl font-bold ${
        positive === false ? 'text-rose-600' : positive === true ? 'text-teal-700' : 'text-stone-900'
      }`}>
        {value}
      </p>
    </div>
  );
}
