import { useState, useEffect, useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { cx } from '../styles/tokens';
import { formatCurrency } from '../utils/format';
import { formatDate } from '../utils/format';
import SearchableSelect from '../components/SearchableSelect';
import { API_BASE } from '../config/api';
import {
  Package,
  AlertTriangle,
  XCircle,
  Plus,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  ArrowUpDown,
  X,
  ImageIcon,
  Eye,
  EyeOff,
  Grid3X3,
  LayoutList,
} from 'lucide-react';

function StatusBadge({ stock, minimo }) {
  if (stock === 0) {
    return <span className={cx.badge('bg-rose-50 text-rose-600')}>Agotado</span>;
  }
  if (stock <= minimo) {
    return <span className={cx.badge('bg-amber-50 text-amber-600')}>Bajo</span>;
  }
  return <span className={cx.badge('bg-emerald-50 text-emerald-600')}>OK</span>;
}

function MovimientoBadge({ tipo }) {
  const colors = {
    entrada: 'bg-emerald-50 text-emerald-600',
    salida: 'bg-rose-50 text-rose-600',
    ajuste: 'bg-blue-50 text-blue-600',
    venta: 'bg-amber-50 text-amber-600',
  };
  return (
    <span className={cx.badge(colors[tipo] || 'bg-stone-100 text-stone-600')}>
      {tipo}
    </span>
  );
}

export default function StockPage() {
  const api = useApi();
  const { user } = useAuth();
  const toast = useToast();

  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resumen, setResumen] = useState({});
  const [sortAsc, setSortAsc] = useState(true);
  const [viewMode, setViewMode] = useState('table'); // table | gallery
  const [expandedId, setExpandedId] = useState(null);
  const [movimientos, setMovimientos] = useState({});
  const [loadingMov, setLoadingMov] = useState({});

  // Modal states
  const [showEntrada, setShowEntrada] = useState(false);
  const [entradaProductoId, setEntradaProductoId] = useState(null);
  const [entradaCantidad, setEntradaCantidad] = useState('');
  const [entradaNota, setEntradaNota] = useState('');
  const [entradaFechaVencimiento, setEntradaFechaVencimiento] = useState('');
  const [savingEntrada, setSavingEntrada] = useState(false);

  const [ajusteProducto, setAjusteProducto] = useState(null);
  const [ajusteCantidad, setAjusteCantidad] = useState('');
  const [ajusteNota, setAjusteNota] = useState('');
  const [savingAjuste, setSavingAjuste] = useState(false);

  // All products (for the entrada selector — not filtered by control_stock)
  const [allProductos, setAllProductos] = useState([]);

  // Sidebar edición producto
  const [sidebarProduct, setSidebarProduct] = useState(null);
  const [sidebarNombre, setSidebarNombre] = useState('');
  const [sidebarImagenUrl, setSidebarImagenUrl] = useState('');
  const [sidebarDisponibleVenta, setSidebarDisponibleVenta] = useState(false);
  const [savingSidebar, setSavingSidebar] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Nuevo producto modal
  const [showNuevoProducto, setShowNuevoProducto] = useState(false);
  const [npNombre, setNpNombre] = useState('');
  const [npCantidad, setNpCantidad] = useState('');
  const [npCostoTotal, setNpCostoTotal] = useState('');
  const [savingNuevo, setSavingNuevo] = useState(false);

  const loadStock = () => {
    setLoading(true);
    api.get('/stock')
      .then((r) => {
        setProductos(r.data?.productos || r.data || []);
        setResumen(r.data?.resumen || {});
      })
      .catch(() => toast.error('Error cargando inventario'))
      .finally(() => setLoading(false));
  };

  const loadAllProductos = () => {
    api.get('/stock/todos')
      .then((r) => setAllProductos(r.data || []))
      .catch(() => {});
  };

  useEffect(() => {
    loadStock();
    loadAllProductos();
  }, []);

  const sorted = useMemo(() => {
    const arr = [...productos];
    arr.sort((a, b) => {
      const sa = Number(a.stock_actual) || 0;
      const sb = Number(b.stock_actual) || 0;
      return sortAsc ? sa - sb : sb - sa;
    });
    return arr;
  }, [productos, sortAsc]);


  const summaryCards = useMemo(() => {
    const total = productos.length;
    const agotados = productos.filter((p) => (Number(p.stock_actual) || 0) === 0).length;
    const alerta = productos.filter((p) => {
      const s = Number(p.stock_actual) || 0;
      const m = Number(p.stock_minimo) || 0;
      return s > 0 && s <= m;
    }).length;
    return { total, alerta, agotados };
  }, [productos]);

  const toggleExpand = async (productoId) => {
    if (expandedId === productoId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(productoId);
    if (!movimientos[productoId]) {
      setLoadingMov((p) => ({ ...p, [productoId]: true }));
      try {
        const r = await api.get(`/stock/movimientos?producto_id=${productoId}`);
        setMovimientos((p) => ({ ...p, [productoId]: r.data || [] }));
      } catch {
        toast.error('Error cargando movimientos');
      } finally {
        setLoadingMov((p) => ({ ...p, [productoId]: false }));
      }
    }
  };

  const handleEntrada = async () => {
    if (!entradaProductoId || !entradaCantidad) return;
    setSavingEntrada(true);
    try {
      await api.post('/stock/entrada', {
        producto_id: entradaProductoId,
        cantidad: Number(entradaCantidad),
        nota: entradaNota.trim() || null,
        fecha_vencimiento: entradaFechaVencimiento || null,
      });
      toast.success('Entrada registrada');
      setShowEntrada(false);
      setEntradaProductoId(null);
      setEntradaCantidad('');
      setEntradaNota('');
      setEntradaFechaVencimiento('');
      setMovimientos({});
      loadStock();
    } catch (err) {
      toast.error(err.message || 'Error registrando entrada');
    } finally {
      setSavingEntrada(false);
    }
  };

  const handleAjuste = async () => {
    if (!ajusteProducto || ajusteCantidad === '') return;
    setSavingAjuste(true);
    try {
      await api.post('/stock/ajuste', {
        producto_id: ajusteProducto.id,
        cantidad: Number(ajusteCantidad),
        nota: ajusteNota.trim() || null,
      });
      toast.success('Ajuste registrado');
      setAjusteProducto(null);
      setAjusteCantidad('');
      setAjusteNota('');
      setMovimientos({});
      loadStock();
    } catch (err) {
      toast.error(err.message || 'Error registrando ajuste');
    } finally {
      setSavingAjuste(false);
    }
  };

  const handleNuevoProducto = async () => {
    if (!npNombre.trim() || !npCantidad || !npCostoTotal) return;
    const cantidad = Number(npCantidad);
    const costoTotal = Number(npCostoTotal);
    if (cantidad <= 0 || costoTotal <= 0) { toast.error('Cantidad y costo deben ser mayores a 0'); return; }
    const costoUnitario = Math.round((costoTotal / cantidad) * 100) / 100;
    setSavingNuevo(true);
    try {
      // 1. Create product
      const prodRes = await api.post('/productos', {
        nombre: npNombre.trim(),
        tipo_producto: 'no_transformable',
        costo_neto: costoUnitario,
        margen: 50,
      });
      const newProd = prodRes?.data || prodRes;
      const productoId = newProd?.id;
      if (!productoId) throw new Error('Error creando producto');

      // 2. Register stock entry
      await api.post('/stock/entrada', {
        producto_id: productoId,
        cantidad,
        nota: `Ingreso inicial — costo total S/ ${costoTotal.toFixed(2)}`,
      });

      toast.success(`"${npNombre.trim()}" creado con ${cantidad} unidades`);
      setShowNuevoProducto(false);
      setNpNombre('');
      setNpCantidad('');
      setNpCostoTotal('');
      setMovimientos({});
      loadStock();
      loadAllProductos();
    } catch (err) {
      toast.error(err.message || 'Error creando producto');
    } finally {
      setSavingNuevo(false);
    }
  };

  // Sidebar functions
  const openSidebar = (prod) => {
    setSidebarProduct(prod);
    setSidebarNombre(prod.nombre);
    setSidebarImagenUrl(prod.imagen_url || '');
    setSidebarDisponibleVenta(!!prod.disponible_venta);
    // Load movements for this product
    if (!movimientos[prod.id]) {
      setLoadingMov(p => ({ ...p, [prod.id]: true }));
      api.get(`/stock/movimientos?producto_id=${prod.id}`)
        .then(r => setMovimientos(p => ({ ...p, [prod.id]: r.data || [] })))
        .catch(() => {})
        .finally(() => setLoadingMov(p => ({ ...p, [prod.id]: false })));
    }
  };

  const handleSaveSidebar = async () => {
    if (!sidebarProduct) return;
    setSavingSidebar(true);
    try {
      await api.put(`/productos/${sidebarProduct.id}`, {
        nombre: sidebarNombre.trim() || sidebarProduct.nombre,
        imagen_url: sidebarImagenUrl || null,
        disponible_venta: sidebarDisponibleVenta,
      });
      toast.success('Producto actualizado');
      setSidebarProduct(null);
      setMovimientos({});
      loadStock();
      loadAllProductos();
    } catch (err) {
      toast.error(err.message || 'Error actualizando producto');
    } finally {
      setSavingSidebar(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !sidebarProduct) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Imagen debe ser menor a 5MB'); return; }
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('imagen', file);
      const baseUrl = API_BASE.replace('/api', '');
      const res = await fetch(`${baseUrl}/api/upload/producto/${sidebarProduct.id}`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        setSidebarImagenUrl(data.url);
        toast.success('Imagen subida');
      }
    } catch {
      toast.error('Error subiendo imagen');
    } finally {
      setUploadingImage(false);
    }
  };

  const npCostoUnitario = (Number(npCantidad) > 0 && Number(npCostoTotal) > 0)
    ? Math.round((Number(npCostoTotal) / Number(npCantidad)) * 100) / 100
    : null;

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <div className={cx.skeleton + ' h-10 w-48'} />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className={cx.skeleton + ' h-20'} />
          <div className={cx.skeleton + ' h-20'} />
          <div className={cx.skeleton + ' h-20'} />
        </div>
        <div className={cx.skeleton + ' h-64'} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-stone-900">Inventario</h1>
          <div className="flex gap-0.5 bg-stone-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-colors duration-100 ${viewMode === 'table' ? 'bg-white shadow-sm text-[#16A34A]' : 'text-stone-400 hover:text-stone-600'}`}
              title="Vista lista"
            >
              <LayoutList size={16} />
            </button>
            <button
              onClick={() => setViewMode('gallery')}
              className={`p-1.5 rounded-md transition-colors duration-100 ${viewMode === 'gallery' ? 'bg-white shadow-sm text-[#16A34A]' : 'text-stone-400 hover:text-stone-600'}`}
              title="Vista galería"
            >
              <Grid3X3 size={16} />
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowNuevoProducto(true)}
            className={cx.btnSecondary + ' flex items-center gap-1.5'}
          >
            <Plus size={14} /> Ingresar producto
          </button>
          <button
            onClick={() => setShowEntrada(true)}
            className={cx.btnPrimary + ' flex items-center gap-1.5'}
          >
            <Plus size={14} /> Entrada
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <div className={`${cx.card} p-4 flex items-center gap-3`}>
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <Package size={18} className="text-blue-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-stone-900">{summaryCards.total}</p>
            <p className="text-xs text-stone-500">Total productos</p>
          </div>
        </div>
        <div className={`${cx.card} p-4 flex items-center gap-3`}>
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
            <AlertTriangle size={18} className="text-amber-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-stone-900">{summaryCards.alerta}</p>
            <p className="text-xs text-stone-500">Stock bajo</p>
          </div>
        </div>
        <div className={`${cx.card} p-4 flex items-center gap-3`}>
          <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center">
            <XCircle size={18} className="text-rose-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-stone-900">{summaryCards.agotados}</p>
            <p className="text-xs text-stone-500">Sin stock</p>
          </div>
        </div>
      </div>

      {/* Stock list */}
      {productos.length === 0 ? (
        <div className={`${cx.card} p-10 text-center`}>
          <Package size={32} className="mx-auto text-stone-300 mb-3" />
          <p className="text-stone-500 text-sm">No hay productos con control de stock activo.</p>
          <p className="text-stone-400 text-xs mt-1">Ingresa productos desde el botón "Ingresar producto" o registra compras.</p>
        </div>
      ) : (
        <>
        {/* Gallery view */}
        {viewMode === 'gallery' && (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 mb-5">
            {sorted.map(prod => {
              const stock = Number(prod.stock_actual) || 0;
              return (
                <button
                  key={prod.id}
                  onClick={() => openSidebar(prod)}
                  className="bg-white rounded-xl border border-stone-200 p-2.5 text-center hover:border-stone-400 hover:shadow transition-colors duration-100 group relative"
                >
                  {prod.imagen_url ? (
                    <img src={prod.imagen_url} className="w-full aspect-square object-cover rounded-lg mb-1.5" alt={prod.nombre} />
                  ) : (
                    <div className="w-full aspect-square bg-stone-100 rounded-lg mb-1.5 flex items-center justify-center">
                      <Package size={20} className="text-stone-300" />
                    </div>
                  )}
                  <p className="text-[11px] font-medium text-stone-800 truncate">{prod.nombre}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className={`text-[10px] font-bold ${stock === 0 ? 'text-rose-500' : stock <= (Number(prod.stock_minimo) || 0) ? 'text-amber-500' : 'text-emerald-600'}`}>
                      {stock} uds
                    </span>
                    <span className="text-[10px] text-stone-400">{formatCurrency(prod.costo_neto || 0)}</span>
                  </div>
                  {prod.disponible_venta && (
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                      <Eye size={10} className="text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Table view */}
        {viewMode === 'table' && (
        <div className={cx.card + ' overflow-hidden'}>
          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/50">
                  <th className={cx.th}>Producto</th>
                  <th className={cx.th}>SKU</th>
                  <th className={cx.th}>
                    <button
                      onClick={() => setSortAsc(!sortAsc)}
                      className="flex items-center gap-1 hover:text-stone-600 transition-colors"
                    >
                      Stock <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className={cx.th}>Minimo</th>
                  {productos.some(p => p.committed > 0 || p.incoming > 0) && (
                    <>
                      <th className={cx.th}>Comprometido</th>
                      <th className={cx.th}>En transito</th>
                    </>
                  )}
                  <th className={cx.th}>Estado</th>
                  <th className={cx.th + ' w-10'}></th>
                </tr>
              </thead>
              {sorted.map((prod) => {
                  const stock = Number(prod.stock_actual) || 0;
                  const minimo = Number(prod.stock_minimo) || 0;
                  const isExpanded = expandedId === prod.id;
                  return (
                    <tbody key={prod.id}>
                      <tr
                        className={cx.tr + ' cursor-pointer'}
                        onClick={() => openSidebar(prod)}
                      >
                        <td className={cx.td + ' font-medium text-stone-800'}>
                          <div className="flex items-center gap-2">
                            {prod.imagen_url && <img src={prod.imagen_url} className="w-7 h-7 rounded object-cover" alt="" />}
                            <span>{prod.nombre}</span>
                            {prod.disponible_venta && <span className={cx.badge('bg-emerald-50 text-emerald-600')}>En venta</span>}
                          </div>
                        </td>
                        <td className={cx.td + ' text-stone-500 text-xs font-mono'}>{prod.sku || '--'}</td>
                        <td className={cx.td + ' font-semibold text-stone-800'}>{stock}</td>
                        <td className={cx.td + ' text-stone-500'}>{minimo}</td>
                        {productos.some(p => p.committed > 0 || p.incoming > 0) && (
                          <>
                            <td className={cx.td + ' text-stone-500'}>{prod.committed || 0}</td>
                            <td className={cx.td + ' text-stone-500'}>{prod.incoming || 0}</td>
                          </>
                        )}
                        <td className={cx.td}>
                          <StatusBadge stock={stock} minimo={minimo} />
                        </td>
                        <td className={cx.td}>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setAjusteProducto(prod);
                                setAjusteCantidad(String(stock));
                                setAjusteNota('');
                              }}
                              className={cx.btnGhost + ' text-xs py-1 px-2'}
                              title="Ajustar stock"
                            >
                              <SlidersHorizontal size={13} />
                            </button>
                            {isExpanded ? (
                              <ChevronUp size={14} className="text-stone-400" />
                            ) : (
                              <ChevronDown size={14} className="text-stone-400" />
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={productos.some(p => p.committed > 0 || p.incoming > 0) ? 8 : 6} className="bg-stone-50 px-6 py-4">
                            {loadingMov[prod.id] ? (
                              <div className={cx.skeleton + ' h-16 w-full'} />
                            ) : (movimientos[prod.id] || []).length === 0 ? (
                              <p className="text-stone-400 text-sm text-center py-2">Sin movimientos registrados.</p>
                            ) : (
                              <div className="overflow-x-auto"><table className="w-full min-w-[500px]">
                                <thead>
                                  <tr>
                                    <th className={cx.th}>Fecha</th>
                                    <th className={cx.th}>Tipo</th>
                                    <th className={cx.th}>Cantidad</th>
                                    <th className={cx.th}>Stock result.</th>
                                    <th className={cx.th}>Nota</th>
                                    <th className={cx.th}>Usuario</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(movimientos[prod.id] || []).map((mov, i) => (
                                    <tr key={mov.id || i} className="border-b border-stone-100 last:border-0">
                                      <td className={cx.td + ' text-stone-500 text-xs'}>{formatDate(mov.fecha || mov.created_at)}</td>
                                      <td className={cx.td}><MovimientoBadge tipo={mov.tipo} /></td>
                                      <td className={cx.td + ' font-medium'}>
                                        <span className={mov.cantidad >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                          {mov.cantidad >= 0 ? '+' : ''}{mov.cantidad}
                                        </span>
                                      </td>
                                      <td className={cx.td + ' text-stone-600'}>{mov.stock_nuevo ?? mov.stock_resultante ?? '--'}</td>
                                      <td className={cx.td + ' text-stone-500 text-xs'}>{mov.nota || '--'}</td>
                                      <td className={cx.td + ' text-stone-400 text-xs'}>{mov.usuario_nombre || mov.usuario || '--'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table></div>
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  );
                })}
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden divide-y divide-stone-100">
            {sorted.map((prod) => {
              const stock = Number(prod.stock_actual) || 0;
              const minimo = Number(prod.stock_minimo) || 0;
              const isExpanded = expandedId === prod.id;
              return (
                <div key={prod.id}>
                  <div
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-stone-50/50 transition-colors"
                    onClick={() => openSidebar(prod)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {prod.imagen_url && <img src={prod.imagen_url} className="w-7 h-7 rounded object-cover" alt="" />}
                        <p className="text-sm font-medium text-stone-800 truncate">{prod.nombre}</p>
                        {prod.disponible_venta && <span className={cx.badge('bg-emerald-50 text-emerald-600')}>En venta</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        {prod.sku && <span className="text-[10px] text-stone-400 font-mono">{prod.sku}</span>}
                        <StatusBadge stock={stock} minimo={minimo} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-3">
                      <div className="text-right">
                        <p className="text-lg font-bold text-stone-800">{stock}</p>
                        <p className="text-[10px] text-stone-400">min: {minimo}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAjusteProducto(prod);
                          setAjusteCantidad(String(stock));
                          setAjusteNota('');
                        }}
                        className={cx.btnGhost + ' text-xs py-1 px-2'}
                      >
                        <SlidersHorizontal size={13} />
                      </button>
                      {isExpanded ? (
                        <ChevronUp size={14} className="text-stone-400" />
                      ) : (
                        <ChevronDown size={14} className="text-stone-400" />
                      )}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="bg-stone-50 px-4 py-3 space-y-2">
                      {loadingMov[prod.id] ? (
                        <div className={cx.skeleton + ' h-12 w-full'} />
                      ) : (movimientos[prod.id] || []).length === 0 ? (
                        <p className="text-stone-400 text-sm text-center py-2">Sin movimientos.</p>
                      ) : (
                        (movimientos[prod.id] || []).map((mov, i) => (
                          <div key={mov.id || i} className="flex items-center justify-between bg-white rounded-lg p-2.5 text-xs">
                            <div className="flex items-center gap-2">
                              <MovimientoBadge tipo={mov.tipo} />
                              <span className={mov.cantidad >= 0 ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>
                                {mov.cantidad >= 0 ? '+' : ''}{mov.cantidad}
                              </span>
                            </div>
                            <div className="text-right text-stone-400">
                              <p>{formatDate(mov.fecha || mov.created_at)}</p>
                              {mov.nota && <p className="truncate max-w-[120px]">{mov.nota}</p>}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        )}
        </>
      )}

      {/* Entrada modal */}
      {showEntrada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowEntrada(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] sm:max-w-sm p-4 sm:p-6">
            <h3 className="text-lg font-bold text-stone-900 mb-4">Nueva entrada de stock</h3>
            <div className="space-y-4">
              <div>
                <label className={cx.label}>Producto</label>
                <SearchableSelect
                  options={allProductos}
                  value={entradaProductoId}
                  onChange={(item) => setEntradaProductoId(item.id)}
                  placeholder="Seleccionar producto..."
                />
              </div>
              <div>
                <label className={cx.label}>Cantidad</label>
                <input
                  type="number"
                  min="1"
                  step={user?.stock_entero ? "1" : "0.01"}
                  value={entradaCantidad}
                  onChange={(e) => setEntradaCantidad(e.target.value)}
                  className={cx.input}
                  placeholder="0"
                />
              </div>
              <div>
                <label className={cx.label}>Nota (opcional)</label>
                <input
                  type="text"
                  value={entradaNota}
                  onChange={(e) => setEntradaNota(e.target.value)}
                  className={cx.input}
                  placeholder="Ej: Compra proveedor"
                />
              </div>
              <div>
                <label className={cx.label}>Fecha de vencimiento (opcional)</label>
                <input
                  type="date"
                  value={entradaFechaVencimiento}
                  onChange={(e) => setEntradaFechaVencimiento(e.target.value)}
                  className={cx.input}
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setShowEntrada(false)} className={cx.btnGhost}>
                Cancelar
              </button>
              <button
                onClick={handleEntrada}
                disabled={!entradaProductoId || !entradaCantidad || savingEntrada}
                className={cx.btnPrimary + ' flex items-center gap-1.5'}
              >
                {savingEntrada ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Plus size={14} /> Registrar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ajuste modal */}
      {ajusteProducto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setAjusteProducto(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] sm:max-w-sm p-4 sm:p-6">
            <h3 className="text-lg font-bold text-stone-900 mb-1">Ajuste de stock</h3>
            <p className="text-sm text-stone-500 mb-4">{ajusteProducto.nombre}</p>
            <div className="space-y-4">
              <div>
                <label className={cx.label}>Nueva cantidad</label>
                <input
                  type="number"
                  min="0"
                  step={user?.stock_entero ? "1" : "0.01"}
                  value={ajusteCantidad}
                  onChange={(e) => setAjusteCantidad(e.target.value)}
                  className={cx.input}
                  placeholder="0"
                />
              </div>
              <div>
                <label className={cx.label}>Motivo</label>
                <input
                  type="text"
                  value={ajusteNota}
                  onChange={(e) => setAjusteNota(e.target.value)}
                  className={cx.input}
                  placeholder="Ej: Conteo fisico, merma, etc."
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setAjusteProducto(null)} className={cx.btnGhost}>
                Cancelar
              </button>
              <button
                onClick={handleAjuste}
                disabled={ajusteCantidad === '' || savingAjuste}
                className={cx.btnPrimary + ' flex items-center gap-1.5'}
              >
                {savingAjuste ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Guardar ajuste'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nuevo producto modal */}
      {showNuevoProducto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowNuevoProducto(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] sm:max-w-sm p-4 sm:p-6">
            <h3 className="text-lg font-bold text-stone-900 mb-1">Ingresar producto al inventario</h3>
            <p className="text-xs text-stone-400 mb-4">Para productos que ya tienes y compraste antes de usar Kudi.</p>
            <div className="space-y-4">
              <div>
                <label className={cx.label}>Nombre del producto</label>
                <input
                  type="text"
                  value={npNombre}
                  onChange={(e) => setNpNombre(e.target.value)}
                  className={cx.input}
                  placeholder="Ej: Caja de chocolates"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={cx.label}>Cantidad</label>
                  <input
                    type="number"
                    min="1"
                    step={user?.stock_entero ? "1" : "0.01"}
                    value={npCantidad}
                    onChange={(e) => setNpCantidad(e.target.value)}
                    className={cx.input}
                    placeholder="10"
                  />
                </div>
                <div>
                  <label className={cx.label}>Costo total (S/)</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={npCostoTotal}
                    onChange={(e) => setNpCostoTotal(e.target.value)}
                    className={cx.input}
                    placeholder="100.00"
                  />
                </div>
              </div>
              {npCostoUnitario !== null && (
                <div className="bg-stone-50 rounded-lg px-4 py-3 flex justify-between items-center">
                  <span className="text-xs text-stone-500">Costo unitario</span>
                  <span className="text-sm font-bold text-[#0A2F24]">{formatCurrency(npCostoUnitario)}</span>
                </div>
              )}
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setShowNuevoProducto(false)} className={cx.btnGhost}>
                Cancelar
              </button>
              <button
                onClick={handleNuevoProducto}
                disabled={!npNombre.trim() || !npCantidad || !npCostoTotal || savingNuevo}
                className={cx.btnPrimary + ' flex items-center gap-1.5'}
              >
                {savingNuevo ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Plus size={14} /> Crear e ingresar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar edición producto no transformable */}
      {sidebarProduct && (
        <div className="fixed inset-0 z-[60] flex">
          <div className="flex-1 bg-black/20" onClick={() => setSidebarProduct(null)} />
          <div className="w-full sm:w-96 bg-white h-full shadow-xl overflow-y-auto flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-stone-100">
              <h3 className="text-lg font-semibold text-stone-900">Detalle de producto</h3>
              <button onClick={() => setSidebarProduct(null)} className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors duration-100">
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 p-5 space-y-5">
              {/* Image */}
              <div>
                <label className="block cursor-pointer">
                  {sidebarImagenUrl ? (
                    <div className="relative group">
                      <img src={sidebarImagenUrl} className="w-full aspect-video object-cover rounded-xl" alt="" />
                      <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white text-xs font-medium">Cambiar imagen</span>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full aspect-video bg-stone-100 rounded-xl border-2 border-dashed border-stone-300 flex flex-col items-center justify-center gap-2 hover:border-stone-400 transition-colors">
                      <ImageIcon size={24} className="text-stone-300" />
                      <span className="text-xs text-stone-400">Click para subir imagen</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
                {uploadingImage && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-stone-500">
                    <div className="w-3.5 h-3.5 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                    Subiendo...
                  </div>
                )}
              </div>

              {/* Name */}
              <div>
                <label className={cx.label}>Nombre</label>
                <input
                  type="text"
                  value={sidebarNombre}
                  onChange={e => setSidebarNombre(e.target.value)}
                  className={cx.input}
                />
              </div>

              {/* Read-only info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-stone-50 rounded-lg p-3">
                  <p className="text-[10px] text-stone-400 uppercase font-semibold">SKU</p>
                  <p className="text-sm font-mono text-stone-700 mt-0.5">{sidebarProduct.sku || '--'}</p>
                </div>
                <div className="bg-stone-50 rounded-lg p-3">
                  <p className="text-[10px] text-stone-400 uppercase font-semibold">Costo unitario</p>
                  <p className="text-sm font-semibold text-stone-700 mt-0.5">{formatCurrency(sidebarProduct.costo_neto || 0)}</p>
                </div>
                <div className="bg-stone-50 rounded-lg p-3">
                  <p className="text-[10px] text-stone-400 uppercase font-semibold">Stock actual</p>
                  <p className="text-sm font-bold text-stone-900 mt-0.5">{Number(sidebarProduct.stock_actual) || 0}</p>
                </div>
                <div className="bg-stone-50 rounded-lg p-3">
                  <p className="text-[10px] text-stone-400 uppercase font-semibold">Stock mínimo</p>
                  <p className="text-sm text-stone-700 mt-0.5">{Number(sidebarProduct.stock_minimo) || 0}</p>
                </div>
              </div>

              {/* Toggle disponible_venta */}
              <div className="flex items-center justify-between p-4 bg-stone-50 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-stone-800">Disponible para venta directa</p>
                  <p className="text-[10px] text-stone-400 mt-0.5">Aparece en catálogo y POS</p>
                </div>
                <button
                  onClick={() => setSidebarDisponibleVenta(!sidebarDisponibleVenta)}
                  className={`w-11 h-6 rounded-full transition-colors duration-200 relative ${
                    sidebarDisponibleVenta ? 'bg-[#16A34A]' : 'bg-stone-300'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform duration-200 ${
                    sidebarDisponibleVenta ? 'translate-x-[22px]' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {/* Movimientos */}
              <div>
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Historial de movimientos</p>
                {loadingMov[sidebarProduct.id] ? (
                  <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="bg-stone-100 rounded-lg h-8 animate-pulse" />)}</div>
                ) : (movimientos[sidebarProduct.id] || []).length === 0 ? (
                  <p className="text-xs text-stone-400 text-center py-4">Sin movimientos registrados</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {(movimientos[sidebarProduct.id] || []).map((mov, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 bg-stone-50/80 rounded-lg">
                        <div className="flex items-center gap-2">
                          <MovimientoBadge tipo={mov.tipo} />
                          <span className="text-xs text-stone-500">{formatDate(mov.created_at)}</span>
                        </div>
                        <span className={`text-xs font-semibold ${Number(mov.cantidad) >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {Number(mov.cantidad) >= 0 ? '+' : ''}{mov.cantidad}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-stone-100">
              <button
                onClick={handleSaveSidebar}
                disabled={savingSidebar}
                className={cx.btnPrimary + ' w-full py-3 flex items-center justify-center gap-2'}
              >
                {savingSidebar ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
