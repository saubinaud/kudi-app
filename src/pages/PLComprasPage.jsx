import { useState, useEffect, useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../config/api';
import { useToast } from '../context/ToastContext';
import { cx } from '../styles/tokens';
import { formatCurrency, formatDate } from '../utils/format';
import SearchableSelect from '../components/SearchableSelect';
import CustomSelect from '../components/CustomSelect';
import PeriodoSelector from '../components/PeriodoSelector';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  Plus, X, Trash2, ChevronDown, ChevronUp,
  ShoppingBag, Package, Salad, DollarSign, Download,
} from 'lucide-react';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const TIPOS_COMPROBANTE = [
  { value: '', label: 'Sin comprobante' },
  { value: 'boleta', label: 'Boleta' },
  { value: 'factura', label: 'Factura' },
  { value: 'ticket', label: 'Ticket' },
  { value: 'liquidacion', label: 'Liquidacion de compra' },
];

const TIPOS_ITEM = [
  { value: 'insumo', label: 'Insumo' },
  { value: 'material', label: 'Material' },
  { value: 'producto', label: 'Producto (no transformable)' },
];

function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
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

const EMPTY_ITEM = { tipo: 'insumo', insumo_id: null, material_id: null, producto_id: null, nombre_item: '', cantidad: '', unidad: '', precio_unitario: '', _precio_catalogo: 0, _presentacion_id: null, _presentaciones: [] };

const EMPTY_PROVEEDOR = { nombre: '', ruc: '', telefono: '', email: '' };
const EMPTY_INSUMO = { nombre: '', cantidad_presentacion: '', unidad_medida: 'g', precio_presentacion: '' };
const EMPTY_MATERIAL = { nombre: '', cantidad_presentacion: '', unidad_medida: 'uni', precio_presentacion: '' };

const UNIDADES_BASE = ['g', 'kg', 'ml', 'L', 'uni', 'oz', 'cm', 'mt'];

export default function PLComprasPage() {
  const api = useApi();
  const { token } = useAuth();
  const toast = useToast();

  // Data
  const [periodos, setPeriodos] = useState([]);
  const [periodo, setPeriodo] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [compras, setCompras] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [insumos, setInsumos] = useState([]);
  const [materiales, setMateriales] = useState([]);
  const [productos, setProductos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [lineas, setLineas] = useState([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [loadingCompras, setLoadingCompras] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [creatingPeriodo, setCreatingPeriodo] = useState(false);
  const [saving, setSaving] = useState(false);

  // Side panel: nuevo proveedor
  const [showNewProveedor, setShowNewProveedor] = useState(false);
  const [newProveedorData, setNewProveedorData] = useState({ ...EMPTY_PROVEEDOR });
  const [savingProveedor, setSavingProveedor] = useState(false);

  // Side panel: nuevo insumo
  const [showNewInsumo, setShowNewInsumo] = useState(false);
  const [newInsumoTarget, setNewInsumoTarget] = useState(null); // item idx to auto-select after creation
  const [newInsumoData, setNewInsumoData] = useState({ ...EMPTY_INSUMO });
  const [savingInsumo, setSavingInsumo] = useState(false);

  // Side panel: nuevo material
  const [showNewMaterial, setShowNewMaterial] = useState(false);
  const [newMaterialTarget, setNewMaterialTarget] = useState(null);
  const [newMaterialData, setNewMaterialData] = useState({ ...EMPTY_MATERIAL });
  const [savingMaterial, setSavingMaterial] = useState(false);

  // Side panel: nuevo producto (no transformable)
  const [showNewProducto, setShowNewProducto] = useState(false);
  const [newProductoTarget, setNewProductoTarget] = useState(null);
  const [newProductoData, setNewProductoData] = useState({ nombre: '', costo_total: '', cantidad: '' });
  const [savingProducto, setSavingProducto] = useState(false);

  // Modal form
  const [form, setForm] = useState({ fecha: todayStr(), proveedor: '', proveedor_id: '', nota: '', cuenta_id: '', tipo_comprobante: '', codigo_comprobante: '', linea_negocio_id: null, descripcion: '' });
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [cuentas, setCuentas] = useState([]);

  // Load periodos + catalogs on mount
  useEffect(() => {
    Promise.all([
      api.get('/pl/periodos').catch(() => ({ data: [] })),
      api.get('/insumos').catch(() => ({ data: [] })),
      api.get('/materiales').catch(() => ({ data: [] })),
      api.get('/flujo/cuentas').catch(() => ({ data: [] })),
      api.get('/productos').catch(() => ({ data: [] })),
      api.get('/proveedores').catch(() => ({ data: [] })),
      api.get('/lineas').catch(() => ({ data: [] })),
    ]).then(([perRes, insRes, matRes, cuentasRes, prodRes, provRes, lineasRes]) => {
      const pers = perRes.data || [];
      setPeriodos(pers);
      setInsumos(insRes.data || []);
      setMateriales(matRes.data || []);
      setCuentas((cuentasRes.data || []).map(c => ({ value: c.id, label: c.nombre })));
      setProductos(prodRes.data || []);
      setProveedores(provRes.data || []);
      setLineas(lineasRes.data || []);
      setLoading(false);
    });
  }, []);

  // Load compras + resumen when periodo changes
  const loadCompras = async (p) => {
    if (!p?.year || !p?.month) return;
    setLoadingCompras(true);
    try {
      const qs = `year=${p.year}&month=${p.month}`;
      const [comprasRes, resumenRes] = await Promise.all([
        api.get(`/pl/compras?${qs}`),
        api.get(`/pl/compras/resumen?${qs}`),
      ]);
      setCompras(comprasRes.data || []);
      setResumen(resumenRes.data || null);
    } catch {
      toast.error('Error cargando compras');
    } finally {
      setLoadingCompras(false);
    }
  };

  useEffect(() => {
    if (periodo) loadCompras(periodo);
  }, [periodo]); // eslint-disable-line

  // Create first period
  const crearPrimerPeriodo = async () => {
    setCreatingPeriodo(true);
    try {
      const mp = currentMonthPeriod();
      const res = await api.post('/pl/periodos', mp);
      const nuevo = res.data;
      setPeriodos((prev) => [...prev, nuevo]);
      toast.success('Periodo creado');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCreatingPeriodo(false);
    }
  };

  // Modal helpers
  const openNewCompra = () => {
    setForm({ fecha: todayStr(), proveedor: '', proveedor_id: '', nota: '', cuenta_id: '', tipo_comprobante: '', codigo_comprobante: '', linea_negocio_id: null, descripcion: '' });
    setItems([{ ...EMPTY_ITEM }]);
    setModalOpen(true);
  };

  const addItem = () => setItems((prev) => [...prev, { ...EMPTY_ITEM }]);

  const removeItem = (idx) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateItem = (idx, field, value) => {
    setItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      // Reset linked fields when tipo changes
      if (field === 'tipo') {
        updated.insumo_id = null;
        updated.material_id = null;
        updated.producto_id = null;
        updated.nombre_item = '';
        updated.unidad = '';
        updated._precio_catalogo = 0;
      }
      return updated;
    }));
  };

  const selectInsumo = (idx, ins) => {
    const pres = ins.presentaciones || [];
    const principal = pres.find(p => p.es_principal) || pres[0];
    applyPresentacion(idx, ins.id, principal, pres, ins);
  };

  const applyPresentacion = (idx, insumoId, pres, allPres, ins) => {
    // Cantidad = 1 presentación, precio = precio total de la presentación
    const precioTotal = pres?.precio
      ? parseFloat(pres.precio)
      : Number(ins?.precio_presentacion) || 0;
    const unidad = pres?.nombre || `${ins?.nombre || ''} ${pres?.cantidad || ins?.cantidad_presentacion || ''} ${pres?.unidad || ins?.unidad_medida || ''}`.trim();

    setItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item;
      return {
        ...item,
        insumo_id: insumoId,
        cantidad: '1',
        unidad: unidad,
        precio_unitario: parseFloat(precioTotal.toFixed(2)),
        _precio_catalogo: precioTotal,
        _presentacion_id: pres?.id || null,
        _presentaciones: allPres || [],
      };
    }));
  };

  const selectMaterial = (idx, mat) => {
    const precioSugerido = Number(mat.cantidad_presentacion) > 0
      ? Number(mat.precio_presentacion) / Number(mat.cantidad_presentacion)
      : Number(mat.precio_presentacion) || 0;
    setItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item;
      return { ...item, material_id: mat.id, unidad: mat.unidad_medida || mat.unidad || '', precio_unitario: parseFloat(precioSugerido.toFixed(3)), _precio_catalogo: precioSugerido };
    }));
  };

  const selectProducto = (idx, prod) => {
    const precioSugerido = Number(prod.costo_neto) || 0;
    setItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item;
      return { ...item, producto_id: prod.id, unidad: 'uni', precio_unitario: parseFloat(precioSugerido.toFixed(3)), _precio_catalogo: precioSugerido };
    }));
  };

  // Computed total
  const formTotal = useMemo(() =>
    items.reduce((s, item) => s + ((parseFloat(item.precio_unitario) || 0) * (parseFloat(item.cantidad) || 0)), 0),
    [items]
  );

  const itemSubtotal = (item) =>
    (parseFloat(item.precio_unitario) || 0) * (parseFloat(item.cantidad) || 0);

  // Save
  const saveCompra = async () => {
    if (!form.fecha) { toast.error('Fecha es requerida'); return; }
    const validItems = items.filter((it) =>
      (parseFloat(it.cantidad) > 0) && (parseFloat(it.precio_unitario) > 0) &&
      (it.insumo_id || it.material_id || it.producto_id || it.nombre_item)
    );
    if (validItems.length === 0) { toast.error('Agrega al menos un item valido'); return; }

    setSaving(true);
    try {
      // Auto-create new presentations for items with _customPres
      for (const it of validItems) {
        if (it._customPres && it.insumo_id && it.cantidad && it.unidad) {
          try {
            const ins = insumos.find(i => i.id === it.insumo_id);
            const presNombre = `${ins?.nombre || 'Insumo'} ${it.cantidad} ${it.unidad}`;
            await api.post(`/insumos/${it.insumo_id}/presentaciones`, {
              nombre: presNombre,
              cantidad: parseFloat(it.cantidad),
              unidad: it.unidad,
              precio: parseFloat(it.precio_unitario) || 0,
            });
          } catch (_) { /* puede ya existir */ }
        }
      }

      await api.post('/pl/compras', {
        fecha: form.fecha,
        proveedor: form.proveedor || null,
        proveedor_id: form.proveedor_id || null,
        nota: form.nota || null,
        cuenta_id: form.cuenta_id || null,
        tipo_comprobante: form.tipo_comprobante || null,
        codigo_comprobante: form.codigo_comprobante || null,
        linea_negocio_id: form.linea_negocio_id || null,
        descripcion: form.descripcion || null,
        items: validItems.map((it) => ({
          insumo_id: it.insumo_id || null,
          material_id: it.material_id || null,
          producto_id: it.producto_id || null,
          nombre_item: it.nombre_item || null,
          cantidad: parseFloat(it.cantidad),
          unidad: it.unidad || null,
          precio_unitario: parseFloat(it.precio_unitario),
        })),
      });
      toast.success('Compra registrada');
      setModalOpen(false);
      loadCompras(periodo);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Export CSV
  const exportCSV = async () => {
    try {
      const res = await fetch(`${API_BASE}/pl/compras/export?year=${periodo.year}&month=${periodo.month}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compras-${periodo.year}-${String(periodo.month).padStart(2, '0')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export error:', e);
      toast.error('Error exportando CSV');
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.del(`/pl/compras/${deleteTarget.id}`);
      toast.success('Compra eliminada');
      loadCompras(periodo);
    } catch {
      toast.error('Error eliminando');
    } finally {
      setDeleteTarget(null);
    }
  };

  // Toggle accordion
  const toggleCompra = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  // Save nuevo proveedor
  const saveNuevoProveedor = async () => {
    if (!newProveedorData.nombre.trim()) { toast.error('El nombre es requerido'); return; }
    setSavingProveedor(true);
    try {
      const res = await api.post('/proveedores', {
        nombre: newProveedorData.nombre.trim(),
        ruc: newProveedorData.ruc.trim() || null,
        telefono: newProveedorData.telefono.trim() || null,
        email: newProveedorData.email.trim() || null,
      });
      const nuevo = res.data;
      setProveedores((prev) => [...prev, nuevo]);
      setForm((f) => ({ ...f, proveedor_id: nuevo.id, proveedor: nuevo.nombre }));
      toast.success('Proveedor creado');
      setShowNewProveedor(false);
      setNewProveedorData({ ...EMPTY_PROVEEDOR });
    } catch (err) {
      toast.error(err.message || 'Error creando proveedor');
    } finally {
      setSavingProveedor(false);
    }
  };

  // Save nuevo insumo inline
  const saveNuevoInsumo = async () => {
    if (!newInsumoData.nombre.trim() || !newInsumoData.cantidad_presentacion || !newInsumoData.precio_presentacion) {
      toast.error('Completa nombre, cantidad y precio');
      return;
    }
    setSavingInsumo(true);
    try {
      const res = await api.post('/insumos', {
        nombre: newInsumoData.nombre.trim(),
        cantidad_presentacion: Number(newInsumoData.cantidad_presentacion),
        unidad_medida: newInsumoData.unidad_medida,
        precio_presentacion: Number(newInsumoData.precio_presentacion),
      });
      const nuevo = res.data;
      setInsumos((prev) => [...prev, nuevo]);
      if (newInsumoTarget !== null) {
        selectInsumo(newInsumoTarget, nuevo);
      }
      toast.success('Insumo creado');
      setShowNewInsumo(false);
      setNewInsumoData({ ...EMPTY_INSUMO });
      setNewInsumoTarget(null);
    } catch (err) {
      toast.error(err.message || 'Error creando insumo');
    } finally {
      setSavingInsumo(false);
    }
  };

  // Save nuevo material inline
  const saveNuevoMaterial = async () => {
    if (!newMaterialData.nombre.trim() || !newMaterialData.cantidad_presentacion || !newMaterialData.precio_presentacion) {
      toast.error('Completa nombre, cantidad y precio');
      return;
    }
    setSavingMaterial(true);
    try {
      const res = await api.post('/materiales', {
        nombre: newMaterialData.nombre.trim(),
        cantidad_presentacion: Number(newMaterialData.cantidad_presentacion),
        unidad_medida: newMaterialData.unidad_medida,
        precio_presentacion: Number(newMaterialData.precio_presentacion),
      });
      const nuevo = res.data;
      setMateriales((prev) => [...prev, nuevo]);
      if (newMaterialTarget !== null) {
        selectMaterial(newMaterialTarget, nuevo);
      }
      toast.success('Material creado');
      setShowNewMaterial(false);
      setNewMaterialData({ ...EMPTY_MATERIAL });
      setNewMaterialTarget(null);
    } catch (err) {
      toast.error(err.message || 'Error creando material');
    } finally {
      setSavingMaterial(false);
    }
  };

  // Save nuevo producto inline
  const saveNuevoProducto = async () => {
    if (!newProductoData.nombre.trim() || !newProductoData.cantidad || !newProductoData.costo_total) {
      toast.error('Completa nombre, cantidad y costo total');
      return;
    }
    const cantidad = Number(newProductoData.cantidad);
    const costoTotal = Number(newProductoData.costo_total);
    if (cantidad <= 0 || costoTotal <= 0) { toast.error('Cantidad y costo deben ser mayores a 0'); return; }
    const costoUnitario = Math.round((costoTotal / cantidad) * 100) / 100;
    setSavingProducto(true);
    try {
      const res = await api.post('/productos', {
        nombre: newProductoData.nombre.trim(),
        tipo_producto: 'no_transformable',
        costo_neto: costoUnitario,
        margen: 50,
      });
      const nuevo = res.data;
      setProductos((prev) => [...prev, nuevo]);
      if (newProductoTarget !== null) {
        // Auto-fill the compra item
        const idx = newProductoTarget;
        setItems((prev) => {
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            producto_id: nuevo.id,
            nombre_item: nuevo.nombre,
            precio_unitario: costoUnitario,
            cantidad: cantidad,
            unidad: 'uni',
          };
          return next;
        });
      }
      toast.success('Producto creado');
      setShowNewProducto(false);
      setNewProductoData({ nombre: '', costo_total: '', cantidad: '' });
      setNewProductoTarget(null);
    } catch (err) {
      toast.error(err.message || 'Error creando producto');
    } finally {
      setSavingProducto(false);
    }
  };

  // Products filtered for 'producto' type (no packs)
  const productosNopack = useMemo(
    () => productos.filter((p) => p.tipo_producto !== 'pack'),
    [productos]
  );

  // Loading skeleton
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto pb-12 space-y-4">
        <div className={cx.skeleton + ' h-10 w-48'} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className={cx.skeleton + ' h-24'} />)}
        </div>
        <div className={cx.skeleton + ' h-64'} />
      </div>
    );
  }

  // No periods
  if (periodos.length === 0) {
    return (
      <div className="max-w-7xl mx-auto pb-12">
        <h1 className="text-xl font-bold text-stone-900 mb-5">Compras</h1>
        <div className={`${cx.card} p-12 text-center`}>
          <ShoppingBag size={40} className="text-stone-300 mx-auto mb-4" />
          <p className="text-stone-500 text-sm mb-6">
            Para registrar compras, primero necesitas crear un periodo contable.
          </p>
          <button onClick={crearPrimerPeriodo} disabled={creatingPeriodo} className={cx.btnPrimary}>
            {creatingPeriodo ? 'Creando...' : 'Crear primer periodo'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-stone-900">Compras</h1>
          <PeriodoSelector
            periodos={periodos}
            value={periodo}
            onChange={setPeriodo}
          />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className={cx.btnSecondary + ' flex items-center gap-2'}>
            <Download size={16} /> Exportar CSV
          </button>
          <button onClick={openNewCompra} className={cx.btnPrimary + ' flex items-center gap-2'}>
            <Plus size={14} /> Nueva compra
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {resumen && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-5">
          <SummaryCard
            icon={<Salad size={18} />}
            label="Compras Insumos"
            value={formatCurrency(resumen.total_insumos)}
            color="text-teal-600"
          />
          <SummaryCard
            icon={<Package size={18} />}
            label="Compras Materiales"
            value={formatCurrency(resumen.total_materiales)}
            color="text-blue-600"
          />
          {parseFloat(resumen.total_productos || 0) > 0 && (
            <SummaryCard
              icon={<ShoppingBag size={18} />}
              label="Compras Productos"
              value={formatCurrency(resumen.total_productos)}
              color="text-violet-600"
            />
          )}
          <SummaryCard
            icon={<DollarSign size={18} />}
            label="Total Compras"
            value={formatCurrency(resumen.total_compras)}
            color="text-rose-600"
            bold
          />
        </div>
      )}

      {/* Compras list */}
      {loadingCompras ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className={cx.skeleton + ' h-16'} />)}
        </div>
      ) : compras.length === 0 ? (
        <div className={`${cx.card} p-12 text-center`}>
          <p className="text-stone-400 text-sm">No hay compras registradas en este periodo</p>
        </div>
      ) : (
        <div className={`${cx.card} divide-y divide-stone-100 overflow-hidden`}>
          {compras.map((compra) => {
            const isExpanded = expanded[compra.id] === true;
            return (
              <div key={compra.id}>
                {/* Compra header */}
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-stone-50/50 transition-colors duration-100"
                  onClick={() => toggleCompra(compra.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isExpanded
                      ? <ChevronUp size={16} className="text-stone-400 flex-shrink-0" />
                      : <ChevronDown size={16} className="text-stone-400 flex-shrink-0" />
                    }
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-stone-900 truncate">
                        {formatDate(compra.fecha)}
                        {compra.proveedor && <span className="text-stone-500 font-normal"> - {compra.proveedor}</span>}
                      </p>
                      <p className="text-[11px] text-stone-400">
                        {compra.items?.length || 0} item{(compra.items?.length || 0) !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <span className="text-sm font-semibold text-stone-900">{formatCurrency(compra.total)}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(compra); }}
                      className={cx.btnIcon + ' !p-1 hover:text-rose-600'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Expanded: items table */}
                {isExpanded && compra.items && (
                  <div className="px-5 pb-4">
                    {/* Desktop */}
                    <div className="hidden sm:block">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-stone-100">
                            <th className={cx.th}>Item</th>
                            <th className={cx.th + ' text-right'}>Cantidad</th>
                            <th className={cx.th + ' text-center'}>Unidad</th>
                            <th className={cx.th + ' text-right'}>Precio unit.</th>
                            <th className={cx.th + ' text-right'}>Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {compra.items.map((it) => {
                            const variation = (() => {
                              const catItem = it.insumo_id ? insumos.find(ins => ins.id === it.insumo_id)
                                : it.material_id ? materiales.find(m => m.id === it.material_id)
                                : it.producto_id ? productos.find(p => p.id === it.producto_id) : null;
                              if (!catItem) return null;
                              let catPrice;
                              if (it.producto_id) {
                                catPrice = Number(catItem.costo_neto) || 0;
                              } else {
                                catPrice = Number(catItem.cantidad_presentacion) > 0
                                  ? Number(catItem.precio_presentacion) / Number(catItem.cantidad_presentacion) : 0;
                              }
                              if (catPrice <= 0) return null;
                              const diff = ((parseFloat(it.precio_unitario) / catPrice) - 1) * 100;
                              if (Math.abs(diff) < 0.5) return null;
                              return diff;
                            })();
                            return (
                            <tr key={it.id} className={cx.tr}>
                              <td className={cx.td + ' font-medium text-stone-900'}>{it.item_nombre || it.nombre_item || '-'}</td>
                              <td className={cx.td + ' text-right text-stone-600'}>{parseFloat(it.cantidad)}</td>
                              <td className={cx.td + ' text-center text-stone-500'}>{it.unidad || '-'}</td>
                              <td className={cx.td + ' text-right text-stone-600 font-mono text-xs'}>{parseFloat(it.precio_unitario).toFixed(3)}</td>
                              <td className={cx.td + ' text-right'}>
                                <span className="font-semibold text-stone-900 font-mono text-xs">{parseFloat(it.total).toFixed(3)}</span>
                                {variation !== null && (
                                  <span className={`ml-1.5 text-[10px] ${variation > 0 ? 'text-rose-500' : 'text-teal-600'}`}>
                                    {variation > 0 ? '+' : ''}{variation.toFixed(1)}%
                                  </span>
                                )}
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {/* Mobile */}
                    <div className="sm:hidden space-y-2">
                      {compra.items.map((it) => {
                        const variation = (() => {
                          const catItem = it.insumo_id ? insumos.find(ins => ins.id === it.insumo_id)
                            : it.material_id ? materiales.find(m => m.id === it.material_id) : null;
                          if (!catItem) return null;
                          const catPrice = Number(catItem.cantidad_presentacion) > 0
                            ? Number(catItem.precio_presentacion) / Number(catItem.cantidad_presentacion) : 0;
                          if (catPrice <= 0) return null;
                          const diff = ((parseFloat(it.precio_unitario) / catPrice) - 1) * 100;
                          if (Math.abs(diff) < 0.5) return null;
                          return diff;
                        })();
                        return (
                        <div key={it.id} className="flex items-center justify-between py-2 pl-7">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-stone-800 truncate">{it.item_nombre || it.nombre_item || '-'}</p>
                            <p className="text-[11px] text-stone-400">
                              {parseFloat(it.cantidad)} {it.unidad || ''} x {parseFloat(it.precio_unitario).toFixed(3)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                            <span className="text-sm font-semibold text-stone-900 font-mono text-xs">
                              {parseFloat(it.total).toFixed(3)}
                            </span>
                            {variation !== null && (
                              <span className={`text-[10px] ${variation > 0 ? 'text-rose-500' : 'text-teal-600'}`}>
                                {variation > 0 ? '+' : ''}{variation.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                    {compra.nota && (
                      <p className="text-xs text-stone-400 mt-3 pl-7">Nota: {compra.nota}</p>
                    )}
                    {compra.descripcion && (
                      <p className="text-xs text-stone-400 mt-1 pl-7">Descripción: {compra.descripcion}</p>
                    )}
                    {(compra.tipo_comprobante || compra.linea_nombre) && (
                      <div className="flex items-center gap-2 mt-2 pl-7">
                        {compra.tipo_comprobante && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 text-stone-600 capitalize">
                            {compra.tipo_comprobante}{compra.codigo_comprobante ? ` ${compra.codigo_comprobante}` : ''}
                          </span>
                        )}
                        {compra.linea_nombre && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-600">
                            {compra.linea_nombre}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Nueva compra modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-w-[95vw] max-h-[85vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-stone-900">Nueva compra</h3>
                <button onClick={() => setModalOpen(false)} className={cx.btnIcon}>
                  <X size={18} />
                </button>
              </div>

              {/* Header: fecha + proveedor */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className={cx.label}>Fecha</label>
                  <input
                    type="date"
                    value={form.fecha}
                    onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                    className={cx.input}
                  />
                </div>
                <div>
                  <label className={cx.label}>Proveedor</label>
                  <CustomSelect
                    options={[
                      { value: '', label: 'Sin especificar' },
                      { value: '__nuevo__', label: '+ Crear proveedor' },
                      ...proveedores.map(p => ({ value: p.id, label: p.nombre })),
                    ]}
                    value={form.proveedor_id}
                    onChange={(v) => {
                      if (v === '__nuevo__') {
                        setShowNewProveedor(true);
                        return;
                      }
                      const prov = proveedores.find(p => p.id === v);
                      setForm((f) => ({ ...f, proveedor_id: v, proveedor: prov?.nombre || '' }));
                    }}
                    placeholder="Seleccionar proveedor"
                  />
                </div>
                {cuentas.length > 0 && (
                <div>
                  <label className={cx.label}>Cuenta de pago</label>
                  <CustomSelect
                    options={[{ value: '', label: 'Sin especificar' }, ...cuentas]}
                    value={form.cuenta_id}
                    onChange={(v) => setForm((f) => ({ ...f, cuenta_id: v }))}
                    placeholder="¿Con qué pagaste?"
                  />
                </div>
                )}
              </div>

              {/* Tipo comprobante + linea + descripcion */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className={cx.label}>Tipo de comprobante</label>
                  <CustomSelect
                    value={form.tipo_comprobante}
                    onChange={(v) => setForm((f) => ({ ...f, tipo_comprobante: v }))}
                    options={TIPOS_COMPROBANTE}
                    placeholder="Tipo..."
                  />
                </div>
                {form.tipo_comprobante && (
                  <div>
                    <label className={cx.label}>Nro. comprobante</label>
                    <input
                      type="text"
                      value={form.codigo_comprobante || ''}
                      onChange={(e) => setForm((f) => ({ ...f, codigo_comprobante: e.target.value }))}
                      className={cx.input}
                      placeholder="Ej: 001-00012345"
                    />
                  </div>
                )}
                {lineas.length > 0 && (
                  <div>
                    <label className={cx.label}>Línea de negocio</label>
                    <CustomSelect
                      value={form.linea_negocio_id || ''}
                      onChange={(v) => setForm((f) => ({ ...f, linea_negocio_id: v || null }))}
                      options={[{ value: '', label: 'Sin línea' }, ...lineas.map((l) => ({ value: l.id, label: l.nombre }))]}
                    />
                  </div>
                )}
              </div>
              <div className="mb-4">
                <label className={cx.label}>Descripción (opcional)</label>
                <input
                  type="text"
                  value={form.descripcion || ''}
                  onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                  className={cx.input}
                  placeholder="Nota sobre esta compra..."
                />
              </div>

              {/* Items */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Items</p>
                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div key={idx} className="border border-stone-200 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        {/* Type selector */}
                        <CustomSelect
                          value={item.tipo}
                          onChange={(v) => updateItem(idx, 'tipo', v)}
                          options={TIPOS_ITEM}
                          compact
                          className="w-44"
                        />
                        {items.length > 1 && (
                          <button onClick={() => removeItem(idx)} className={cx.btnIcon + ' !p-1 hover:text-rose-600'}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      {/* Item selector based on type */}
                      {item.tipo === 'insumo' && (
                        <div className="mb-2 space-y-1">
                          <SearchableSelect
                            options={insumos}
                            value={item.insumo_id}
                            onChange={(ins) => selectInsumo(idx, ins)}
                            placeholder="Buscar insumo..."
                          />
                          {item.insumo_id && (item._presentaciones?.length > 0 || item._customPres) && (
                            <select
                              value={item._customPres ? 'custom' : (item._presentacion_id || '')}
                              onChange={e => {
                                if (e.target.value === 'custom') {
                                  setItems(prev => prev.map((it, i) => i !== idx ? it : { ...it, _customPres: true, cantidad: '1', unidad: '', precio_unitario: '', _precio_catalogo: 0 }));
                                } else {
                                  const presId = parseInt(e.target.value);
                                  const pres = item._presentaciones.find(p => p.id === presId);
                                  const ins = insumos.find(i => i.id === item.insumo_id);
                                  if (pres) {
                                    const next = { ...item, _customPres: false };
                                    setItems(prev => prev.map((it, i) => i !== idx ? it : next));
                                    applyPresentacion(idx, item.insumo_id, pres, item._presentaciones, ins);
                                  }
                                }
                              }}
                              className="w-full text-[11px] border border-stone-200 rounded-lg px-2 py-1.5 bg-white text-stone-700 focus:outline-none focus:border-stone-400"
                            >
                              {(item._presentaciones || []).map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.nombre} — S/ {parseFloat(p.precio || 0).toFixed(2)}
                                </option>
                              ))}
                              <option value="custom">+ Otra presentación...</option>
                            </select>
                          )}
                          {item._customPres && (
                            <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                              Los datos de cantidad, unidad y precio que ingreses abajo se guardarán como nueva presentación del insumo
                            </p>
                          )}
                          <button
                            onClick={() => { setNewInsumoTarget(idx); setShowNewInsumo(true); }}
                            className="text-[11px] text-[var(--accent)] hover:underline transition-colors duration-100"
                          >
                            + Crear nuevo insumo
                          </button>
                        </div>
                      )}
                      {item.tipo === 'material' && (
                        <div className="mb-2 space-y-1">
                          <SearchableSelect
                            options={materiales}
                            value={item.material_id}
                            onChange={(mat) => selectMaterial(idx, mat)}
                            placeholder="Buscar material..."
                          />
                          <button
                            onClick={() => { setNewMaterialTarget(idx); setShowNewMaterial(true); }}
                            className="text-[11px] text-[var(--accent)] hover:underline transition-colors duration-100"
                          >
                            + Crear nuevo material
                          </button>
                        </div>
                      )}
                      {item.tipo === 'producto' && (
                        <div className="mb-2 space-y-1">
                          <SearchableSelect
                            options={productosNopack}
                            value={item.producto_id}
                            onChange={(prod) => selectProducto(idx, prod)}
                            placeholder="Buscar producto..."
                          />
                          <button
                            onClick={() => { setNewProductoTarget(idx); setShowNewProducto(true); }}
                            className="text-[11px] text-[var(--accent)] hover:underline transition-colors duration-100"
                          >
                            + Crear nuevo producto
                          </button>
                        </div>
                      )}

                      {/* Quantity + unit + price */}
                      <div className={`grid gap-2 ${item._customPres ? 'grid-cols-3' : 'grid-cols-2'}`}>
                        <div>
                          <label className="text-[10px] text-stone-400 font-medium">Cantidad</label>
                          <input
                            type="number"
                            value={item.cantidad}
                            onChange={(e) => updateItem(idx, 'cantidad', e.target.value)}
                            className={cx.input}
                            placeholder={item._customPres ? '500' : '1'}
                            min="1"
                            step={item._customPres ? 'any' : '1'}
                          />
                        </div>
                        {item._customPres && (
                          <div>
                            <label className="text-[10px] text-stone-400 font-medium">Unidad</label>
                            <CustomSelect
                              value={item.unidad || ''}
                              onChange={(v) => updateItem(idx, 'unidad', v)}
                              options={[
                                { value: 'g', label: 'g' },
                                { value: 'kg', label: 'kg' },
                                { value: 'ml', label: 'ml' },
                                { value: 'L', label: 'L' },
                                { value: 'oz', label: 'oz' },
                                { value: 'uni', label: 'uni' },
                              ]}
                              compact
                            />
                          </div>
                        )}
                        <div>
                          <label className="text-[10px] text-stone-400 font-medium">Precio S/</label>
                          <input
                            type="number"
                            value={item.precio_unitario}
                            onChange={(e) => updateItem(idx, 'precio_unitario', e.target.value)}
                            className={cx.input}
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                          />
                        </div>
                      </div>

                      {/* Subtotal + variacion */}
                      <div className="flex items-center justify-between mt-2">
                        {item._precio_catalogo > 0 && parseFloat(item.precio_unitario) > 0 && (
                          <span className={`text-[10px] font-medium ${
                            parseFloat(item.precio_unitario) > item._precio_catalogo ? 'text-rose-500' :
                            parseFloat(item.precio_unitario) < item._precio_catalogo ? 'text-teal-600' : 'text-stone-400'
                          }`}>
                            {parseFloat(item.precio_unitario) > item._precio_catalogo
                              ? `+${((parseFloat(item.precio_unitario) / item._precio_catalogo - 1) * 100).toFixed(1)}% vs catalogo`
                              : parseFloat(item.precio_unitario) < item._precio_catalogo
                              ? `${((parseFloat(item.precio_unitario) / item._precio_catalogo - 1) * 100).toFixed(1)}% vs catalogo`
                              : 'Mismo precio'}
                          </span>
                        )}
                        <span className="text-xs font-semibold text-stone-600 font-mono ml-auto">
                          Subtotal: S/ {itemSubtotal(item).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={addItem} className={cx.btnGhost + ' w-full flex items-center justify-center gap-1 text-xs mb-4'}>
                <Plus size={14} /> Agregar item
              </button>

              {/* Nota */}
              <div className="mb-4">
                <label className={cx.label}>Nota (opcional)</label>
                <input
                  type="text"
                  value={form.nota}
                  onChange={(e) => setForm((f) => ({ ...f, nota: e.target.value }))}
                  className={cx.input}
                  placeholder="Ej: Compra semanal"
                />
              </div>

              {/* Total */}
              <div className="border-t border-stone-200 pt-4 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-stone-500">Total</span>
                  <span className="text-xl font-bold text-stone-900">{formatCurrency(formTotal)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button onClick={saveCompra} disabled={saving} className={cx.btnPrimary + ' flex-1'}>
                  {saving ? 'Guardando...' : 'Guardar compra'}
                </button>
                <button onClick={() => setModalOpen(false)} className={cx.btnSecondary}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Side panel: nuevo proveedor */}
      {showNewProveedor && (
        <div className="fixed inset-0 z-[60] flex">
          <div className="flex-1 bg-black/20" onClick={() => setShowNewProveedor(false)} />
          <div className="w-96 bg-white h-full shadow-xl p-6 overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-stone-900">Nuevo proveedor</h3>
              <button onClick={() => setShowNewProveedor(false)} className={cx.btnIcon}><X size={18} /></button>
            </div>
            <div className="space-y-3 flex-1">
              <div>
                <label className={cx.label}>Nombre *</label>
                <input
                  type="text"
                  value={newProveedorData.nombre}
                  onChange={(e) => setNewProveedorData((d) => ({ ...d, nombre: e.target.value }))}
                  className={cx.input}
                  placeholder="Ej: Distribuidora Lima"
                  autoFocus
                />
              </div>
              <div>
                <label className={cx.label}>RUC</label>
                <input
                  type="text"
                  value={newProveedorData.ruc}
                  onChange={(e) => setNewProveedorData((d) => ({ ...d, ruc: e.target.value }))}
                  className={cx.input}
                  placeholder="20xxxxxxxxx"
                  maxLength={11}
                />
              </div>
              <div>
                <label className={cx.label}>Teléfono</label>
                <input
                  type="tel"
                  value={newProveedorData.telefono}
                  onChange={(e) => setNewProveedorData((d) => ({ ...d, telefono: e.target.value }))}
                  className={cx.input}
                  placeholder="9xxxxxxxx"
                />
              </div>
              <div>
                <label className={cx.label}>Email</label>
                <input
                  type="email"
                  value={newProveedorData.email}
                  onChange={(e) => setNewProveedorData((d) => ({ ...d, email: e.target.value }))}
                  className={cx.input}
                  placeholder="proveedor@email.com"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={saveNuevoProveedor}
                disabled={savingProveedor}
                className={cx.btnPrimary + ' flex-1'}
              >
                {savingProveedor ? 'Guardando...' : 'Crear proveedor'}
              </button>
              <button onClick={() => setShowNewProveedor(false)} className={cx.btnSecondary}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Side panel: nuevo insumo */}
      {showNewInsumo && (
        <div className="fixed inset-0 z-[60] flex">
          <div className="flex-1 bg-black/20" onClick={() => setShowNewInsumo(false)} />
          <div className="w-96 bg-white h-full shadow-xl p-6 overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-stone-900">Nuevo insumo</h3>
              <button onClick={() => setShowNewInsumo(false)} className={cx.btnIcon}><X size={18} /></button>
            </div>
            <div className="space-y-3 flex-1">
              <div>
                <label className={cx.label}>Nombre *</label>
                <input
                  type="text"
                  value={newInsumoData.nombre}
                  onChange={(e) => setNewInsumoData((d) => ({ ...d, nombre: e.target.value }))}
                  className={cx.input}
                  placeholder="Ej: Harina de trigo"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={cx.label}>Cantidad *</label>
                  <input
                    type="number"
                    value={newInsumoData.cantidad_presentacion}
                    onChange={(e) => setNewInsumoData((d) => ({ ...d, cantidad_presentacion: e.target.value }))}
                    className={cx.input}
                    placeholder="1000"
                    min="0"
                    step="any"
                  />
                </div>
                <div>
                  <label className={cx.label}>Unidad</label>
                  <CustomSelect
                    value={newInsumoData.unidad_medida}
                    onChange={(v) => setNewInsumoData((d) => ({ ...d, unidad_medida: v }))}
                    options={UNIDADES_BASE.map(u => ({ value: u, label: u }))}
                  />
                </div>
              </div>
              <div>
                <label className={cx.label}>Precio presentacion *</label>
                <input
                  type="number"
                  value={newInsumoData.precio_presentacion}
                  onChange={(e) => setNewInsumoData((d) => ({ ...d, precio_presentacion: e.target.value }))}
                  className={cx.input}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={saveNuevoInsumo}
                disabled={savingInsumo}
                className={cx.btnPrimary + ' flex-1'}
              >
                {savingInsumo ? 'Guardando...' : 'Crear insumo'}
              </button>
              <button onClick={() => setShowNewInsumo(false)} className={cx.btnSecondary}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Side panel: nuevo material */}
      {showNewMaterial && (
        <div className="fixed inset-0 z-[60] flex">
          <div className="flex-1 bg-black/20" onClick={() => setShowNewMaterial(false)} />
          <div className="w-96 bg-white h-full shadow-xl p-6 overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-stone-900">Nuevo material</h3>
              <button onClick={() => setShowNewMaterial(false)} className={cx.btnIcon}><X size={18} /></button>
            </div>
            <div className="space-y-3 flex-1">
              <div>
                <label className={cx.label}>Nombre *</label>
                <input
                  type="text"
                  value={newMaterialData.nombre}
                  onChange={(e) => setNewMaterialData((d) => ({ ...d, nombre: e.target.value }))}
                  className={cx.input}
                  placeholder="Ej: Caja de carton"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={cx.label}>Cantidad *</label>
                  <input
                    type="number"
                    value={newMaterialData.cantidad_presentacion}
                    onChange={(e) => setNewMaterialData((d) => ({ ...d, cantidad_presentacion: e.target.value }))}
                    className={cx.input}
                    placeholder="100"
                    min="0"
                    step="any"
                  />
                </div>
                <div>
                  <label className={cx.label}>Unidad</label>
                  <CustomSelect
                    value={newMaterialData.unidad_medida}
                    onChange={(v) => setNewMaterialData((d) => ({ ...d, unidad_medida: v }))}
                    options={UNIDADES_BASE.map(u => ({ value: u, label: u }))}
                  />
                </div>
              </div>
              <div>
                <label className={cx.label}>Precio presentacion *</label>
                <input
                  type="number"
                  value={newMaterialData.precio_presentacion}
                  onChange={(e) => setNewMaterialData((d) => ({ ...d, precio_presentacion: e.target.value }))}
                  className={cx.input}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={saveNuevoMaterial}
                disabled={savingMaterial}
                className={cx.btnPrimary + ' flex-1'}
              >
                {savingMaterial ? 'Guardando...' : 'Crear material'}
              </button>
              <button onClick={() => setShowNewMaterial(false)} className={cx.btnSecondary}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Side panel: nuevo producto */}
      {showNewProducto && (
        <div className="fixed inset-0 z-[60] flex">
          <div className="flex-1 bg-black/20" onClick={() => setShowNewProducto(false)} />
          <div className="w-96 bg-white h-full shadow-xl p-6 overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-stone-900">Nuevo producto</h3>
              <button onClick={() => setShowNewProducto(false)} className={cx.btnIcon}><X size={18} /></button>
            </div>
            <p className="text-xs text-stone-400 mb-4">Crea un producto de compra/reventa. El costo unitario se calcula automáticamente.</p>
            <div className="space-y-3 flex-1">
              <div>
                <label className={cx.label}>Nombre del producto *</label>
                <input
                  type="text"
                  value={newProductoData.nombre}
                  onChange={(e) => setNewProductoData((d) => ({ ...d, nombre: e.target.value }))}
                  className={cx.input}
                  placeholder="Ej: Pulsera artesanal"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={cx.label}>Cantidad *</label>
                  <input
                    type="number"
                    value={newProductoData.cantidad}
                    onChange={(e) => setNewProductoData((d) => ({ ...d, cantidad: e.target.value }))}
                    className={cx.input}
                    placeholder="20"
                    min="1"
                    step="1"
                  />
                </div>
                <div>
                  <label className={cx.label}>Costo total (S/) *</label>
                  <input
                    type="number"
                    value={newProductoData.costo_total}
                    onChange={(e) => setNewProductoData((d) => ({ ...d, costo_total: e.target.value }))}
                    className={cx.input}
                    placeholder="300.00"
                    min="0.01"
                    step="0.01"
                  />
                </div>
              </div>
              {Number(newProductoData.cantidad) > 0 && Number(newProductoData.costo_total) > 0 && (
                <div className="bg-stone-50 rounded-lg px-4 py-3 flex justify-between items-center">
                  <span className="text-xs text-stone-500">Costo unitario</span>
                  <span className="text-sm font-bold text-[#0A2F24]">
                    S/ {(Number(newProductoData.costo_total) / Number(newProductoData.cantidad)).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={saveNuevoProducto}
                disabled={savingProducto}
                className={cx.btnPrimary + ' flex-1'}
              >
                {savingProducto ? 'Creando...' : 'Crear producto'}
              </button>
              <button onClick={() => setShowNewProducto(false)} className={cx.btnSecondary}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar compra"
        message={`Estas seguro de eliminar esta compra de ${formatCurrency(deleteTarget?.total)}?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function SummaryCard({ icon, label, value, color, bold }) {
  return (
    <div className={`${cx.card} p-4`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={color || 'text-stone-400'}>{icon}</span>
        <span className="text-xs font-semibold text-stone-500 tracking-wide uppercase">{label}</span>
      </div>
      <p className={`text-xl ${bold ? 'font-extrabold' : 'font-bold'} text-stone-900`}>
        {value}
      </p>
    </div>
  );
}
