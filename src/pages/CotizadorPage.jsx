import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useCalculadorCostos } from '../hooks/useCalculadorCostos';
import { cx } from '../styles/tokens';
import { formatCurrency, precioComercial, preciosRecomendados } from '../utils/format';
import { API_BASE } from '../config/api';
import SearchableSelect from '../components/SearchableSelect';
import CustomSelect from '../components/CustomSelect';
import { PromptDialog } from '../components/ConfirmDialog';
import {
  Plus,
  Trash2,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  ImageIcon,
  BookmarkPlus,
} from 'lucide-react';
import { useTerminos } from '../context/TerminosContext';

function normU(u) {
  if (!u) return '';
  if (u === 'l') return 'L';
  return u;
}

const FACTORES = {
  'g→kg': 0.001, 'kg→g': 1000,
  'g→oz': 0.03527, 'oz→g': 28.3495,
  'kg→oz': 35.274, 'oz→kg': 0.02835,
  'ml→L': 0.001, 'L→ml': 1000, 'cm→mt': 0.01, 'mt→cm': 100,
};

function convertirUnidad(valor, deUnidad, aUnidad) {
  const de = normU(deUnidad);
  const a = normU(aUnidad);
  if (!de || !a || de === a) return valor;
  const key = `${de}→${a}`;
  if (FACTORES[key]) return valor * FACTORES[key];
  return valor;
}

function getUnidadesCompatibles(unidadBase) {
  if (!unidadBase) return ['g', 'kg', 'ml', 'L', 'uni', 'oz'];
  const u = normU(unidadBase);
  const grupos = [
    ['g', 'kg', 'oz'],
    ['ml', 'L'],
    ['uni'], ['cm', 'mt'],
  ];
  for (const grupo of grupos) {
    if (grupo.includes(u)) return grupo;
  }
  return [u];
}

function costoEnUsoUnidad(ins) {
  const original = normU(ins.unidad_medida);
  const uso = normU(ins.uso_unidad);
  if (!uso || !original || uso === original) return Number(ins.costo_unitario) || 0;
  const factor = convertirUnidad(1, uso, original);
  return factor > 0 ? (Number(ins.costo_unitario) || 0) * factor : (Number(ins.costo_unitario) || 0);
}

function EditablePrice({ value, onChange, simbolo = 'S/', className = '' }) {
  const [editing, setEditing] = useState(false);
  const [tempVal, setTempVal] = useState('');

  if (editing) {
    return (
      <input
        type="number"
        step="0.01"
        value={tempVal}
        onChange={(e) => setTempVal(e.target.value)}
        onBlur={() => {
          const num = parseFloat(tempVal);
          if (num > 0) onChange(num);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.target.blur(); }
          if (e.key === 'Escape') { setEditing(false); }
        }}
        className={`bg-transparent border-none outline-none text-right ${className}`}
        autoFocus
        style={{ width: `${Math.max(4, String(tempVal).length + 1)}ch` }}
      />
    );
  }

  return (
    <span
      className={`cursor-pointer hover:opacity-70 transition-opacity ${className}`}
      onClick={() => {
        setTempVal(Number(value).toFixed(2));
        setEditing(true);
      }}
      title="Click para editar precio"
    >
      {simbolo} {Number(value).toFixed(2)}
    </span>
  );
}

function InfoTip({ text }) {
  return (
    <span className="relative group inline-flex ml-1.5 cursor-help z-30">
      <span className="w-4 h-4 rounded-full bg-stone-200 text-stone-500 text-[10px] font-bold inline-flex items-center justify-center group-hover:bg-[var(--accent)] group-hover:text-white transition-colors">?</span>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 px-3.5 py-2.5 bg-stone-900 text-white text-xs rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none w-60 text-center leading-relaxed z-40">
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-stone-900" />
      </span>
    </span>
  );
}

let tempId = 0;
const newTempId = () => `temp-${++tempId}`;

function PackItemsEditor({ productoId }) {
  const api = useApi();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [allProducts, setAllProducts] = useState([]);
  const [savingItem, setSavingItem] = useState(false);

  useEffect(() => {
    if (!productoId) return;
    setLoadingItems(true);
    api.get(`/productos/${productoId}/pack-items`)
      .then(r => setItems(r?.data || r || []))
      .catch(() => {})
      .finally(() => setLoadingItems(false));
  }, [productoId]);

  useEffect(() => {
    api.get('/productos')
      .then(r => setAllProducts((r?.data || r || []).filter(p => p.tipo_producto !== 'pack')))
      .catch(() => {});
  }, []);

  const handleAdd = async (product) => {
    if (!productoId || !product) return;
    setSavingItem(true);
    try {
      const res = await api.post(`/productos/${productoId}/pack-items`, {
        item_producto_id: product.id,
        cantidad: 1,
      });
      const newItem = res?.data || res;
      setItems(prev => [...prev, newItem]);
      toast.success(`"${product.nombre}" agregado al pack`);
    } catch (err) {
      toast.error(err.message || 'Error agregando item');
    } finally {
      setSavingItem(false);
    }
  };

  const handleUpdateCantidad = async (itemId, cantidad) => {
    if (!productoId) return;
    try {
      await api.put(`/productos/${productoId}/pack-items/${itemId}`, { cantidad: Number(cantidad) || 1 });
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, cantidad } : i));
    } catch (err) {
      toast.error(err.message || 'Error actualizando cantidad');
    }
  };

  const handleRemove = async (itemId) => {
    if (!productoId) return;
    try {
      await api.del(`/productos/${productoId}/pack-items/${itemId}`);
      setItems(prev => prev.filter(i => i.id !== itemId));
    } catch (err) {
      toast.error(err.message || 'Error eliminando item');
    }
  };

  const totalCosto = items.reduce((s, i) => s + (Number(i.costo_neto) || 0) * (Number(i.cantidad) || 1), 0);

  if (loadingItems) {
    return <div className="space-y-2 py-4">{[1,2].map(i => <div key={i} className="bg-stone-100 rounded-xl h-10 animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Add item */}
      <div>
        <label className={cx.label}>Agregar producto al pack</label>
        <SearchableSelect
          options={allProducts.filter(p => !items.some(i => i.item_producto_id === p.id))}
          value={null}
          onChange={handleAdd}
          placeholder="Buscar producto..."
          disabled={savingItem || !productoId}
        />
        {!productoId && (
          <p className="text-xs text-amber-600 mt-1">Guarda el producto primero para poder agregar items al pack.</p>
        )}
      </div>

      {/* Items table */}
      {items.length > 0 && (
        <div className="border border-stone-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left px-3 py-2 text-[10px] font-semibold text-stone-400 uppercase">Producto</th>
                <th className="text-center px-3 py-2 text-[10px] font-semibold text-stone-400 uppercase">SKU</th>
                <th className="text-center px-3 py-2 text-[10px] font-semibold text-stone-400 uppercase">Cant.</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold text-stone-400 uppercase">Costo unit.</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold text-stone-400 uppercase">Subtotal</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-3 py-2 text-stone-800 font-medium">{item.nombre || item.item_nombre || '--'}</td>
                  <td className="px-3 py-2 text-center text-stone-400 font-mono text-xs">{item.sku || '--'}</td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={item.cantidad}
                      onChange={e => handleUpdateCantidad(item.id, e.target.value)}
                      onBlur={e => handleUpdateCantidad(item.id, e.target.value)}
                      className="w-16 bg-stone-50 rounded-lg px-2 py-1 text-stone-800 text-sm text-center border border-stone-200 focus:outline-none focus:border-stone-400"
                    />
                  </td>
                  <td className="px-3 py-2 text-right text-stone-500">{formatCurrency(Number(item.costo_neto) || 0)}</td>
                  <td className="px-3 py-2 text-right text-stone-800 font-medium">{formatCurrency((Number(item.costo_neto) || 0) * (Number(item.cantidad) || 1))}</td>
                  <td className="px-2 py-2">
                    <button onClick={() => handleRemove(item.id)} className={cx.btnIcon + ' hover:text-rose-600'}>
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-stone-50 border-t border-stone-200">
                <td colSpan="4" className="px-3 py-2 text-xs font-semibold text-stone-600">Costo total del pack</td>
                <td className="px-3 py-2 text-right font-bold text-[var(--accent)]">{formatCurrency(totalCosto)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {items.length === 0 && productoId && (
        <p className="text-sm text-stone-400 text-center py-4">Sin items. Agrega productos usando el selector de arriba.</p>
      )}
    </div>
  );
}

const emptyInsumoRow = () => ({
  _id: newTempId(),
  insumo_id: null,
  nombre: '',
  cantidad: '',
  costo_unitario: 0,
  uso_unidad: '',
});

const emptyPreparacion = () => ({
  _id: newTempId(),
  nombre: '',
  capacidad: '',
  unidad: '',
  cantidad_por_unidad: '',
  porcion_unidad: '',
  insumos: [emptyInsumoRow()],
  collapsed: false,
});

const emptyMaterial = (tipo = 'entero') => ({
  _id: newTempId(),
  material_id: null,
  nombre: '',
  cantidad: '1',
  precio: 0,
  empaque_tipo: tipo,
});

export default function CotizadorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const api = useApi();
  const { user } = useAuth();
  const toast = useToast();
  const t = useTerminos();

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [imagenUrl, setImagenUrl] = useState('');
  const [preparaciones, setPreparaciones] = useState([emptyPreparacion()]);
  const [materiales, setMateriales] = useState([]);
  const [selectedEmpaquePred, setSelectedEmpaquePred] = useState({});
  const [empaqueCollapsed, setEmpaqueCollapsed] = useState({});
  const [margen, setMargen] = useState(50);
  const [margenPorcion, setMargenPorcion] = useState(50);
  // igv_rate in DB is decimal (0.18), hook expects integer (18)
  const [igvRate, setIgvRate] = useState(user?.igv_rate ? parseFloat((user.igv_rate * 100).toFixed(2)) : 18);
  const [tipoPresentacion, setTipoPresentacion] = useState('unidad');
  const [unidadesPorProducto, setUnidadesPorProducto] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(!!id);
  const [showPriceChoice, setShowPriceChoice] = useState(false);
  const [selectedPrice, setSelectedPrice] = useState(null);

  const [tipoProducto, setTipoProducto] = useState('transformable');
  const [controlStock, setControlStock] = useState(false);
  const [sku, setSku] = useState('');
  const [stockActual, setStockActual] = useState('');
  const [stockMinimo, setStockMinimo] = useState('');
  const [variantes, setVariantes] = useState(null); // array of variants or null
  const [precioGuardado, setPrecioGuardado] = useState(0); // precio_final from DB
  const [costoGuardado, setCostoGuardado] = useState(0); // costo_neto from DB

  const [catalogInsumos, setCatalogInsumos] = useState([]);
  const [catalogMateriales, setCatalogMateriales] = useState([]);
  const [catalogPreps, setCatalogPreps] = useState([]);
  const [catalogEmpaques, setCatalogEmpaques] = useState([]);

  const costosRaw = useCalculadorCostos(preparaciones, materiales, margen, igvRate, tipoPresentacion, unidadesPorProducto, margenPorcion);
  const precioConfig = user?.precio_decimales || 'variable';

  // Use DB price as fallback when calculator gives 0 (Shopify/imported products with no ingredients)
  // Fallback to DB values for Shopify/imported products with no ingredients
  const usarFallback = costosRaw.costoNeto === 0 && (costoGuardado > 0 || precioGuardado > 0);
  const fbPrecioVenta = precioGuardado / (1 + (igvRate / 100));
  const fbIgvMonto = precioGuardado - fbPrecioVenta;
  const costos = usarFallback ? {
    ...costosRaw,
    costoInsumos: costoGuardado,
    costoInsumosProducto: costoGuardado,
    costoNeto: costoGuardado,
    precioVenta: fbPrecioVenta,
    igvMonto: fbIgvMonto,
    precioFinal: precioGuardado,
  } : costosRaw;

  const enrichedInsumos = useMemo(() => {
    // Group by normalized name
    const groups = {};
    catalogInsumos.forEach((ins) => {
      const key = (ins.nombre || '').toLowerCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push(ins);
    });

    // Find cheapest per group (cost per base unit)
    const cheapestIds = new Set();
    Object.values(groups).forEach((variants) => {
      if (variants.length <= 1) return;
      let cheapest = variants[0];
      let cheapestCost = Infinity;
      variants.forEach((v) => {
        const cost = Number(v.cantidad_presentacion) > 0
          ? Number(v.precio_presentacion) / Number(v.cantidad_presentacion)
          : Infinity;
        if (cost < cheapestCost) {
          cheapestCost = cost;
          cheapest = v;
        }
      });
      cheapestIds.add(cheapest.id);
    });

    // Enrich with display info
    return catalogInsumos.map((ins) => {
      const key = (ins.nombre || '').toLowerCase();
      const hasVariants = (groups[key] || []).length > 1;
      const costoUnit = Number(ins.cantidad_presentacion) > 0
        ? Number(ins.precio_presentacion) / Number(ins.cantidad_presentacion)
        : 0;
      const isBest = cheapestIds.has(ins.id);
      return {
        ...ins,
        nombre: hasVariants
          ? `${ins.nombre} (${parseFloat(ins.cantidad_presentacion)}${ins.unidad_medida || ''} - ${formatCurrency(ins.precio_presentacion)})${isBest ? ' \u2605' : ''}`
          : ins.nombre,
        _originalNombre: ins.nombre,
        _isBest: isBest,
        _hasVariants: hasVariants,
        _costoUnit: costoUnit,
      };
    }).sort((a, b) => {
      const nameCompare = (a._originalNombre || '').localeCompare(b._originalNombre || '');
      if (nameCompare !== 0) return nameCompare;
      return a._costoUnit - b._costoUnit;
    });
  }, [catalogInsumos]);

  // Load all catalogs in a single batch request
  useEffect(() => {
    api.get('/productos/catalogs').then((d) => {
      const c = d.data || {};
      setCatalogInsumos(c.insumos || []);
      setCatalogMateriales(c.materiales || []);
      setCatalogPreps(c.preparaciones_pred || []);
      setCatalogEmpaques(c.empaques_pred || []);
    }).catch(() => {});
  }, []);

  // Load product for edit mode
  useEffect(() => {
    if (!id) return;
    setLoadingProduct(true);
    api.get(`/productos/${id}`)
      .then((data) => {
        const p = data.data || data;
        setNombre(p.nombre || '');
        setDescripcion(p.descripcion || '');
        setImagenUrl(p.imagen_url || '');
        setTipoPresentacion(p.tipo_presentacion || 'unidad');
        setUnidadesPorProducto(parseInt(p.unidades_por_producto) || 1);
        // DB stores decimals (0.5, 0.18), UI uses percentage (50, 18) — preserve decimals
        setMargen(p.margen ? parseFloat((p.margen * 100).toFixed(2)) : 50);
        setMargenPorcion(p.margen_porcion ? parseFloat((p.margen_porcion * 100).toFixed(2)) : (p.margen ? parseFloat((p.margen * 100).toFixed(2)) : 50));
        setIgvRate(p.igv_rate ? parseFloat((p.igv_rate * 100).toFixed(2)) : (user?.igv_rate ? parseFloat((user.igv_rate * 100).toFixed(2)) : 18));
        setTipoProducto(p.tipo_producto || 'transformable');
        setControlStock(!!p.control_stock);
        setSku(p.sku || '');
        setStockActual(p.stock_actual != null ? String(parseFloat(p.stock_actual)) : '');
        setStockMinimo(p.stock_minimo != null ? String(parseFloat(p.stock_minimo)) : '');
        setPrecioGuardado(parseFloat(p.precio_final) || 0);
        setCostoGuardado(parseFloat(p.costo_neto) || parseFloat(p.costo_compra) || 0);
        if (p.variantes) setVariantes(p.variantes);

        if (p.preparaciones?.length) {
          setPreparaciones(
            p.preparaciones.map((prep) => ({
              _id: newTempId(),
              id: prep.id,
              nombre: prep.nombre || '',
              capacidad: parseFloat(prep.capacidad) || '',
              unidad: prep.unidad_capacidad || prep.unidad || '',
              cantidad_por_unidad: parseFloat(prep.cantidad_por_unidad) || '',
              porcion_unidad: prep.porcion_unidad || prep.unidad_capacidad || prep.unidad || '',
              collapsed: false,
              merma_pct: prep.merma_pct || 0,
              insumos: (prep.insumos || []).map((ins) => {
                const cu = Number(ins.cantidad_presentacion) > 0
                  ? Number(ins.precio_presentacion) / Number(ins.cantidad_presentacion)
                  : Number(ins.precio_presentacion) || 0;
                const catIns = catalogInsumos.find((c) => c.id === ins.insumo_id);
                return {
                  _id: newTempId(),
                  id: ins.id,
                  insumo_id: ins.insumo_id,
                  nombre: ins.nombre || '',
                  unidad_medida: ins.unidad_medida || '',
                  uso_unidad: ins.uso_unidad || ins.unidad_medida || '',
                  cantidad: parseFloat(ins.cantidad_usada || ins.cantidad) || '',
                  costo_unitario: cu,
                  merma_pct: ins.merma_pct ?? catIns?.merma_pct ?? 0,
                };
              }),
            }))
          );
        }

        if (p.materiales?.length) {
          setMateriales(
            p.materiales.map((mat) => {
              const precio = Number(mat.cantidad_presentacion) > 0
                ? Number(mat.precio_presentacion) / Number(mat.cantidad_presentacion)
                : Number(mat.precio_presentacion) || 0;
              return {
                _id: newTempId(),
                id: mat.id,
                material_id: mat.material_id,
                nombre: mat.nombre || '',
                unidad_medida: mat.unidad_medida || '',
                cantidad: parseFloat(mat.cantidad) || 1,
                precio,
                empaque_tipo: mat.empaque_tipo || 'entero',
              };
            })
          );
        }
      })
      .catch(() => toast.error('Error cargando producto'))
      .finally(() => setLoadingProduct(false));
  }, [id]);

  // --- Preparaciones handlers ---
  const addPreparacion = () => {
    setPreparaciones((prev) => [...prev, emptyPreparacion()]);
  };

  const loadPredeterminada = (pred) => {
    const newPrep = {
      _id: newTempId(),
      nombre: pred.nombre,
      capacidad: parseFloat(pred.capacidad) || '',
      unidad: pred.unidad_capacidad || '',
      collapsed: false,
      merma_pct: pred.merma_pct || 0,
      insumos: (pred.insumos || []).map((ins) => {
        const cu = Number(ins.cantidad_presentacion) > 0
          ? Number(ins.precio_presentacion) / Number(ins.cantidad_presentacion)
          : Number(ins.precio_presentacion) || 0;
        return {
          _id: newTempId(),
          insumo_id: ins.insumo_id,
          nombre: ins.nombre || '',
          unidad_medida: ins.unidad_medida || '',
          uso_unidad: ins.uso_unidad || ins.unidad_medida || '',
          cantidad: parseFloat(ins.cantidad) || '',
          costo_unitario: cu,
          merma_pct: ins.merma_pct || 0,
        };
      }),
    };
    setPreparaciones((prev) => [...prev, newPrep]);
  };

  const saveAsPredeterminada = async (prep) => {
    if (!prep.nombre) {
      toast.error('Dale un nombre primero');
      return;
    }
    try {
      await api.post('/predeterminados/preparaciones', {
        nombre: prep.nombre,
        capacidad: prep.capacidad || null,
        unidad: prep.unidad || null,
        insumos: (prep.insumos || [])
          .filter((i) => i.insumo_id)
          .map((i) => ({ insumo_id: i.insumo_id, cantidad: Number(i.cantidad) || 0, uso_unidad: i.uso_unidad || i.unidad_medida || null })),
      });
      toast.success(`"${prep.nombre}" guardada como predeterminada`);
      api.get('/predeterminados/preparaciones').then((d) => setCatalogPreps(d.data || [])).catch(() => {});
    } catch (err) {
      toast.error(err.message || 'Error guardando plantilla');
    }
  };

  const [saveEmpaquePrompt, setSaveEmpaquePrompt] = useState(null); // { tipo }

  const saveEmpaqueAsPredeterminado = (tipo) => {
    const mats = materiales.filter(m => (m.empaque_tipo || 'entero') === tipo);
    if (mats.length === 0 || !mats.some(m => m.material_id)) {
      toast.error('Agrega al menos un material primero');
      return;
    }
    setSaveEmpaquePrompt({ tipo });
  };

  const confirmSaveEmpaque = async (nombre) => {
    const tipo = saveEmpaquePrompt?.tipo;
    setSaveEmpaquePrompt(null);
    if (!tipo || !nombre) return;
    const mats = materiales.filter(m => (m.empaque_tipo || 'entero') === tipo);
    try {
      await api.post('/predeterminados/empaques', {
        nombre,
        materiales: mats.filter(m => m.material_id).map(m => ({ material_id: m.material_id, cantidad: Number(m.cantidad) || 1 })),
      });
      toast.success(`"${nombre}" guardado como empaque predeterminado`);
      api.get('/predeterminados/empaques').then(d => setCatalogEmpaques(d.data || [])).catch(() => {});
    } catch (err) {
      toast.error(err.message || 'Error guardando empaque');
    }
  };

  const removePreparacion = (prepId) => {
    setPreparaciones((prev) => prev.filter((p) => p._id !== prepId));
  };

  const updatePreparacion = (prepId, field, value) => {
    setPreparaciones((prev) =>
      prev.map((p) => (p._id === prepId ? { ...p, [field]: value } : p))
    );
  };

  const toggleCollapse = (prepId) => {
    setPreparaciones((prev) =>
      prev.map((p) => (p._id === prepId ? { ...p, collapsed: !p.collapsed } : p))
    );
  };

  // --- Insumo handlers within preparacion ---
  const addInsumo = (prepId) => {
    setPreparaciones((prev) =>
      prev.map((p) =>
        p._id === prepId
          ? { ...p, insumos: [...p.insumos, emptyInsumoRow()] }
          : p
      )
    );
  };

  const removeInsumo = (prepId, insId) => {
    setPreparaciones((prev) =>
      prev.map((p) =>
        p._id === prepId
          ? { ...p, insumos: p.insumos.filter((i) => i._id !== insId) }
          : p
      )
    );
  };

  const updateInsumo = (prepId, insId, updates) => {
    setPreparaciones((prev) =>
      prev.map((p) =>
        p._id === prepId
          ? {
              ...p,
              insumos: p.insumos.map((i) =>
                i._id === insId ? { ...i, ...updates } : i
              ),
            }
          : p
      )
    );
  };

  const selectInsumo = (prepId, insId, catalogItem) => {
    const costoUnit =
      Number(catalogItem.cantidad_presentacion) > 0
        ? Number(catalogItem.precio_presentacion) / Number(catalogItem.cantidad_presentacion)
        : Number(catalogItem.precio_presentacion);
    updateInsumo(prepId, insId, {
      insumo_id: catalogItem.id,
      nombre: catalogItem._originalNombre || catalogItem.nombre,
      costo_unitario: costoUnit,
      unidad_medida: catalogItem.unidad_medida,
      uso_unidad: catalogItem.unidad_medida,
      merma_pct: catalogItem.merma_pct || 0,
    });
  };

  // --- Material handlers ---
  const addMaterial = (tipo = 'entero') => {
    setMateriales((prev) => [...prev, emptyMaterial(tipo)]);
  };

  const loadEmpaquePred = (pred, tipo = 'entero') => {
    const newMats = (pred.materiales || []).map((mat) => {
      const precio = Number(mat.cantidad_presentacion) > 0
        ? Number(mat.precio_presentacion) / Number(mat.cantidad_presentacion)
        : 0;
      return {
        _id: newTempId(),
        material_id: mat.material_id,
        nombre: mat.nombre || '',
        unidad_medida: mat.unidad_medida || '',
        cantidad: parseFloat(mat.cantidad) || 1,
        precio,
        empaque_tipo: tipo,
      };
    });
    // Replace materials of the same tipo (not append)
    setMateriales((prev) => [...prev.filter(m => m.empaque_tipo !== tipo), ...newMats]);
    setSelectedEmpaquePred((prev) => ({ ...prev, [tipo]: pred.nombre }));
  };

  const removeMaterial = (matId) => {
    setMateriales((prev) => prev.filter((m) => m._id !== matId));
  };

  const selectMaterial = (matId, catalogItem) => {
    setMateriales((prev) =>
      prev.map((m) =>
        m._id === matId
          ? {
              ...m,
              material_id: catalogItem.id,
              nombre: catalogItem.nombre,
              precio: Number(catalogItem.cantidad_presentacion) > 0
              ? Number(catalogItem.precio_presentacion) / Number(catalogItem.cantidad_presentacion)
              : Number(catalogItem.precio_presentacion) || 0,
              unidad_medida: catalogItem.unidad_medida,
            }
          : m
      )
    );
  };

  const updateMaterial = (matId, field, value) => {
    setMateriales((prev) =>
      prev.map((m) => (m._id === matId ? { ...m, [field]: value } : m))
    );
  };

  // --- Reset ---
  const handleReset = () => {
    setNombre('');
    setPreparaciones([emptyPreparacion()]);
    setMateriales([]);
    setMargen(50);
    setMargenPorcion(50);
    setTipoPresentacion('unidad');
    setUnidadesPorProducto(1);
    setImagenUrl('');
    setControlStock(false);
    setSku('');
    setStockActual('');
    setStockMinimo('');
  };

  // --- Save ---
  const handleSaveClick = () => {
    if (!nombre.trim()) {
      toast.error('Ingresa un nombre para el producto');
      return;
    }
    if (precioConfig === 'variable') {
      setShowPriceChoice(true);
      return;
    }
    handleSave();
  };

  const handleSave = async (overridePrice) => {
    setShowPriceChoice(false);
    setSelectedPrice(null);
    if (!nombre.trim()) {
      toast.error('Ingresa un nombre para el producto');
      return;
    }

    // Trial guard: block creation if at product limit
    if (!id && user?.plan === 'trial' && user?.rol !== 'admin') {
      try {
        const prods = await api.get('/productos');
        const count = (prods.data || prods || []).filter(p => !p.locked).length;
        const max = user.max_productos || 2;
        if (count >= max) {
          toast.error(`Tu plan de prueba permite maximo ${max} productos. Actualiza a Pro para crear mas.`);
          return;
        }
      } catch {}
    }

    setSaving(true);
    try {
      const payload = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        imagen_url: imagenUrl.trim() || null,
        margen,          // backend normalizes integer% → decimal
        margen_porcion: margenPorcion,
        igv_rate: igvRate / 100,
        tipo_presentacion: tipoPresentacion,
        unidades_por_producto: tipoPresentacion === 'entero' ? unidadesPorProducto : 1,
        tipo_producto: tipoProducto,
        control_stock: controlStock,
        sku: controlStock ? sku.trim() || null : null,
        stock_actual: controlStock ? (Number(stockActual) || 0) : null,
        stock_minimo: controlStock ? (Number(stockMinimo) || 0) : null,
        preparaciones: preparaciones.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          capacidad: p.capacidad,
          unidad: p.unidad,
          cantidad_por_unidad: Number(p.cantidad_por_unidad) || null,
          porcion_unidad: p.porcion_unidad || p.unidad || null,
          insumos: p.insumos
            .filter((i) => i.insumo_id)
            .map((i) => ({
              id: i.id,
              insumo_id: i.insumo_id,
              cantidad: Number(i.cantidad) || 0,
              uso_unidad: i.uso_unidad || i.unidad_medida || null,
            })),
        })),
        materiales: materiales
          .filter((m) => m.material_id)
          .map((m) => ({
            id: m.id,
            material_id: m.material_id,
            cantidad: Number(m.cantidad) || 1,
            empaque_tipo: m.empaque_tipo || 'entero',
          })),
        ...costos,
        // If user chose a specific price from the modal, override precioFinal
        ...(overridePrice != null ? { precioFinal: overridePrice } : {}),
      };

      if (id) {
        await api.put(`/productos/${id}`, payload);
        toast.success('Producto actualizado');
      } else {
        const data = await api.post('/productos', payload);
        toast.success('Producto creado');
        const newId = data?.data?.id;
        if (newId) navigate(`/cotizador/${newId}`, { replace: true });
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Prep subtotal
  const prepSubtotal = useCallback((prep) => {
    return (prep.insumos || []).reduce(
      (s, i) => s + costoEnUsoUnidad(i) * (Number(i.cantidad) || 0),
      0
    );
  }, []);

  // Reverse calc: from price → margin
  const setMargenFromPrecio = useCallback((precioFinal) => {
    const igvDec = igvRate / 100;
    const precioVenta = precioFinal / (1 + igvDec);
    if (costos.costoNeto > 0 && precioVenta > costos.costoNeto) {
      const newMargen = parseFloat(((1 - costos.costoNeto / precioVenta) * 100).toFixed(1));
      setMargen(Math.min(90, Math.max(0, newMargen)));
    }
  }, [igvRate, costos.costoNeto]);

  const setMargenPorcionFromPrecio = useCallback((precioFinal) => {
    const igvDec = igvRate / 100;
    const precioVenta = precioFinal / (1 + igvDec);
    if (costos.costoNetoPorcion > 0 && precioVenta > costos.costoNetoPorcion) {
      const newMargen = parseFloat(((1 - costos.costoNetoPorcion / precioVenta) * 100).toFixed(1));
      setMargenPorcion(Math.min(90, Math.max(0, newMargen)));
    }
  }, [igvRate, costos.costoNetoPorcion]);

  // Helper to render a list of materials (mobile cards + desktop table)
  const renderMaterialsList = (mats) => {
    if (mats.length === 0) {
      return <p className="text-stone-400 text-sm text-center py-2">Sin materiales.</p>;
    }
    return (
      <div className={`${cx.card} p-4`}>
        {/* Mobile material cards */}
        <div className="space-y-3 lg:hidden">
          {mats.map((mat) => (
            <div key={mat._id} className="bg-stone-100 rounded-xl p-3 space-y-2">
              <SearchableSelect
                options={catalogMateriales}
                value={mat.material_id}
                onChange={(item) => selectMaterial(mat._id, item)}
                placeholder="Seleccionar material..."
              />
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  type="number"
                  value={mat.cantidad}
                  onChange={(e) => updateMaterial(mat._id, 'cantidad', e.target.value)}
                  placeholder="Cant."
                  className="w-full max-w-[8rem] bg-white rounded-lg px-3 py-2.5 text-stone-800 text-sm text-center border border-stone-200 focus:outline-none focus:border-stone-400"
                />
                <span className="text-stone-400 text-xs">{mat.unidad_medida || ''}</span>
                <span className="text-stone-400 text-xs">x {formatCurrency(mat.precio)}</span>
                <span className="ml-auto text-stone-800 text-sm font-medium">
                  {formatCurrency((Number(mat.precio) || 0) * (Number(mat.cantidad) || 0))}
                </span>
                <button onClick={() => removeMaterial(mat._id)} className={cx.btnIcon + ' hover:text-rose-600'}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop material table */}
        <table className="w-full hidden lg:table">
          <thead>
            <tr>
              <th className={cx.th + ' w-1/3'}>Material</th>
              <th className={cx.th + ' w-1/5'}>Cantidad</th>
              <th className={cx.th + ' w-1/6'}>Precio Unit.</th>
              <th className={cx.th + ' w-1/6 text-right'}>Subtotal</th>
              <th className={cx.th + ' w-10'}></th>
            </tr>
          </thead>
          <tbody>
            {mats.map((mat) => (
              <tr key={mat._id} className="border-b border-stone-100 last:border-0">
                <td className="py-2 pr-2">
                  <SearchableSelect
                    options={catalogMateriales}
                    value={mat.material_id}
                    onChange={(item) => selectMaterial(mat._id, item)}
                    placeholder="Seleccionar material..."
                  />
                </td>
                <td className="py-2 px-2">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={mat.cantidad}
                      onChange={(e) => updateMaterial(mat._id, 'cantidad', e.target.value)}
                      placeholder="1"
                      className="w-full bg-stone-50 rounded-lg px-2 py-1.5 text-stone-800 text-sm text-center border border-stone-200 focus:outline-none focus:border-stone-400"
                    />
                    <span className="text-stone-400 text-xs">{mat.unidad_medida || ''}</span>
                  </div>
                </td>
                <td className="py-2 px-2 text-sm text-stone-500 text-center">
                  {formatCurrency(mat.precio)}
                </td>
                <td className="py-2 px-2 text-sm text-stone-800 font-medium text-right">
                  {formatCurrency((Number(mat.precio) || 0) * (Number(mat.cantidad) || 0))}
                </td>
                <td className="py-2 pl-2">
                  <button onClick={() => removeMaterial(mat._id)} className={cx.btnIcon + ' hover:text-rose-600'}>
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Compute available predeterminadas for prep template selector
  const availablePreps = useMemo(() => {
    if (catalogPreps.length === 0) return [];
    const usedNames = new Set(preparaciones.map((p) => (p.nombre || '').toLowerCase()));
    return catalogPreps.filter((p) => !usedNames.has((p.nombre || '').toLowerCase()));
  }, [catalogPreps, preparaciones]);

  if (loadingProduct) {
    return (
      <div className="space-y-4">
        <div className={cx.skeleton + ' h-12 w-64'} />
        <div className={cx.skeleton + ' h-64'} />
        <div className={cx.skeleton + ' h-48'} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-12">
      {/* Page header — clean, Apple-style */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-stone-900">
          {id ? `Editar ${t.productos.toLowerCase().replace(/s$/, '')}` : `Nuevo ${t.productos.toLowerCase().replace(/s$/, '')}`}
        </h1>
        <button onClick={handleReset} className={cx.btnGhost + ' flex items-center gap-1.5'}>
          <RotateCcw size={14} /> Vaciar
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column: main form */}
        <div className="lg:col-span-2 space-y-4 lg:space-y-5">

          {/* ── Producto ── */}
          <div>
            <h3 className="text-lg font-semibold text-stone-900 mb-3">Producto<InfoTip text="Define el nombre y tipo de presentacion. Si vendes un producto entero, indica cuantas porciones o unidades tiene." /></h3>
            <div className={`${cx.card} p-4`}>
              <div className={`grid gap-3 grid-cols-1 ${tipoPresentacion === 'entero' ? 'sm:grid-cols-[9fr_7fr_4fr]' : 'sm:grid-cols-[3fr_2fr]'}`}>
                <div>
                  <label className={cx.label}>Nombre del producto</label>
                  <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} className={cx.input} placeholder={`Ej: Mi ${(t.productos || 'producto').toLowerCase().replace(/s$/, '')}`} autoFocus />
                </div>
                <div>
                  <label className={cx.label}>Presentacion<InfoTip text="'Por unidad' si vendes items individuales. 'Presentacion entera' si vendes algo divisible en porciones." /></label>
                  <CustomSelect
                    value={tipoPresentacion}
                    onChange={setTipoPresentacion}
                    options={[
                      { value: 'unidad', label: 'Por unidad' },
                      { value: 'entero', label: 'Presentacion entera' },
                    ]}
                  />
                </div>
                {tipoPresentacion === 'entero' && (
                  <div>
                    <label className={cx.label}>Porciones</label>
                    <input type="number" min="1" value={unidadesPorProducto} onChange={(e) => setUnidadesPorProducto(Math.max(1, parseInt(e.target.value) || 1))} className={cx.input} />
                  </div>
                )}
              </div>
              {/* Tipo de producto */}
              <div className="mt-3">
                <label className={cx.label}>Tipo de producto</label>
                <CustomSelect
                  value={tipoProducto}
                  onChange={v => setTipoProducto(v)}
                  options={[
                    { value: 'transformable', label: 'Transformable (tiene receta)' },
                    { value: 'no_transformable', label: 'No transformable (compra y reventa)' },
                    { value: 'pack', label: 'Pack (combinacion de productos)' },
                  ]}
                />
              </div>

              {/* Product image — upload or URL */}
              <div className="mt-4">
                {imagenUrl && imagenUrl.trim() ? (
                  <div className="flex items-start gap-3">
                    <img src={imagenUrl.trim()} alt="Producto" className="w-20 h-20 rounded-xl object-cover border border-stone-200" onError={(e) => { e.target.style.display = 'none'; }} />
                    <div className="flex-1 space-y-1">
                      <p className="text-[10px] text-stone-400 truncate">{imagenUrl}</p>
                      <button onClick={() => setImagenUrl('')} className="text-xs text-rose-500 hover:text-rose-700 flex items-center gap-1">
                        <Trash2 size={12} /> Quitar imagen
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <label className="flex-1 cursor-pointer">
                      <div className="border-2 border-dashed border-stone-200 rounded-xl p-4 text-center hover:border-[var(--accent)] hover:bg-stone-50 transition-colors">
                        <ImageIcon size={20} className="mx-auto text-stone-300 mb-1" />
                        <p className="text-xs text-stone-400">Click para subir imagen</p>
                        <p className="text-[10px] text-stone-300">JPG, PNG, WebP (max 5MB)</p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 5 * 1024 * 1024) { toast.error('Imagen muy grande (max 5MB)'); return; }
                          // If product is saved, upload to R2
                          if (id) {
                            try {
                              const formData = new FormData();
                              formData.append('image', file);
                              const res = await fetch(`${API_BASE.replace('/api', '')}/api/upload/producto/${id}`, {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${localStorage.getItem('nodum_token')}` },
                                body: formData,
                              });
                              const data = await res.json();
                              if (data.success) {
                                setImagenUrl(data.data.url);
                                toast.success('Imagen subida');
                              } else {
                                toast.error(data.error || 'Error subiendo imagen');
                              }
                            } catch (err) { toast.error('Error subiendo imagen'); }
                          } else {
                            // Preview only — will upload after first save
                            const reader = new FileReader();
                            reader.onload = () => setImagenUrl(reader.result);
                            reader.readAsDataURL(file);
                            toast.info('La imagen se guardara al crear el producto');
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>
              {/* Product description */}
              <div className="mt-4">
                <label className={cx.label}>Descripcion (opcional)</label>
                <textarea
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value)}
                  className={cx.input + ' min-h-[60px] resize-y'}
                  placeholder="Descripcion del producto..."
                  rows={2}
                />
              </div>
              {/* Stock control */}
              <div className="mt-4 border-t border-stone-100 pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={controlStock} onChange={e => setControlStock(e.target.checked)}
                    className="accent-[var(--accent)] w-4 h-4" />
                  <span className="text-sm text-stone-700">Control de stock</span>
                </label>
                {controlStock && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                    <div>
                      <label className={cx.label}>SKU</label>
                      <input type="text" value={sku} onChange={e => setSku(e.target.value)}
                        className={cx.input} placeholder="ABC-001" />
                    </div>
                    <div>
                      <label className={cx.label}>Stock actual</label>
                      <input type="number" min="0" step={user?.stock_entero ? "1" : "0.01"} value={stockActual} onChange={e => setStockActual(e.target.value)}
                        className={cx.input} placeholder="0" />
                    </div>
                    <div>
                      <label className={cx.label}>Stock minimo</label>
                      <input type="number" min="0" step={user?.stock_entero ? "1" : "0.01"} value={stockMinimo} onChange={e => setStockMinimo(e.target.value)}
                        className={cx.input} placeholder="5" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Variantes (Shopify/imported products) ── */}
          {variantes && variantes.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-stone-900 mb-3">Variantes</h3>
              <div className={`${cx.card} overflow-hidden overflow-x-auto`}>
                <table className="w-full text-sm min-w-[500px]">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50/50">
                      <th className="text-left px-4 py-2 text-xs font-medium text-stone-500">Variante</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-stone-500">SKU</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-stone-500">Precio</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-stone-500">Costo</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-stone-500">Margen</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-stone-500">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variantes.map((v, i) => (
                      <tr key={v.id || i} className="border-b border-stone-100 last:border-0">
                        <td className="px-4 py-2.5 font-medium text-stone-800">{v.nombre || '--'}</td>
                        <td className="px-4 py-2.5 text-stone-400 font-mono text-xs">{v.sku}</td>
                        <td className="px-4 py-2.5 text-right text-stone-700">{v.precio_final ? formatCurrency(parseFloat(v.precio_final)) : '--'}</td>
                        <td className="px-4 py-2.5 text-right text-stone-500">{v.costo_compra && parseFloat(v.costo_compra) > 0 ? formatCurrency(parseFloat(v.costo_compra)) : '--'}</td>
                        <td className="px-4 py-2.5 text-right text-stone-500">{v.costo_compra && parseFloat(v.costo_compra) > 0 && v.precio_final ? ((1 - parseFloat(v.costo_compra) / (parseFloat(v.precio_final) / 1.18)) * 100).toFixed(1) + '%' : '--'}</td>
                        <td className={'px-4 py-2.5 text-right font-semibold' + (parseFloat(v.stock_actual) <= 0 ? ' text-rose-500' : ' text-stone-700')}>
                          {user?.stock_entero ? Math.round(parseFloat(v.stock_actual) || 0) : parseFloat(v.stock_actual || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-stone-50/50 border-t border-stone-200">
                      <td colSpan="5" className="px-4 py-2 text-xs font-semibold text-stone-600">Total stock</td>
                      <td className="px-4 py-2 text-right font-bold text-stone-800">
                        {user?.stock_entero
                          ? Math.round(variantes.reduce((s, v) => s + (parseFloat(v.stock_actual) || 0), 0))
                          : variantes.reduce((s, v) => s + (parseFloat(v.stock_actual) || 0), 0).toFixed(2)
                        }
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ── Pack items (solo para packs) ── */}
          {tipoProducto === 'pack' && (
            <div>
              <h3 className="text-lg font-semibold text-stone-900 mb-3">Productos del pack<InfoTip text="Un pack agrupa varios productos. El costo se calcula como la suma de los costos de cada item segun la cantidad indicada." /></h3>
              <div className={`${cx.card} p-4`}>
                <PackItemsEditor productoId={id ? Number(id) : null} />
              </div>
            </div>
          )}

          {/* ── No transformable message ── */}
          {tipoProducto === 'no_transformable' && (
            <div>
              <h3 className="text-lg font-semibold text-stone-900 mb-3">Receta</h3>
              <div className={`${cx.card} p-4`}>
                <p className="text-sm text-stone-400 py-8 text-center">
                  Este producto se compra y revende. No requiere receta.<br />
                  El costo se actualiza automaticamente con cada compra registrada.
                </p>
              </div>
            </div>
          )}

          {/* ── Preparaciones + Composicion — solo para transformables ── */}
          {tipoProducto === 'transformable' && <>
          <div>
            <h3 className="text-lg font-semibold text-stone-900 mb-3">{t.preparaciones || 'Preparaciones'}<InfoTip text={`Cada ${(t.preparaciones || 'preparacion').toLowerCase()} es un componente base de tu producto. Indica cuanto rinde en total. Puedes cargar plantillas guardadas previamente.`} /></h3>

            {/* Single card with divide-y for all preps */}
            <div className={`${cx.card} divide-y divide-stone-100`}>
              {preparaciones.map((prep) => (
                <div key={prep._id} className="p-3 sm:p-5">
                  {/* Header row — click to collapse */}
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleCollapse(prep._id)}>
                    <div className="flex items-center gap-3">
                      {prep.collapsed ? <ChevronDown size={16} className="text-stone-400" /> : <ChevronUp size={16} className="text-stone-400" />}
                      <div>
                        <span className="text-sm font-semibold text-stone-800">{prep.nombre || `${(t.preparaciones || 'Preparaciones').replace(/s$/i, '')} nueva`}</span>
                        {prep.capacidad && <span className="text-xs text-stone-400 ml-2">Rinde {prep.capacidad} {prep.unidad}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--accent)]">{formatCurrency(prepSubtotal(prep))}</span>
                      <button onClick={(e) => { e.stopPropagation(); saveAsPredeterminada(prep); }} className={cx.btnIcon + ' hover:text-[var(--success)]'} title="Guardar como plantilla">
                        <BookmarkPlus size={14} />
                      </button>
                      {preparaciones.length > 1 && (
                        <button onClick={(e) => { e.stopPropagation(); removePreparacion(prep._id); }} className={cx.btnIcon + ' hover:text-rose-500'}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded content */}
                  {!prep.collapsed && (
                    <div className="mt-4 space-y-4">
                      {/* Name + rendimiento row */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div className="sm:col-span-2">
                          <label className={cx.label}>Nombre</label>
                          <input type="text" value={prep.nombre} onChange={(e) => updatePreparacion(prep._id, 'nombre', e.target.value)} placeholder={`Ej: ${(t.preparaciones || 'Preparacion').replace(/es$/i, '').replace(/s$/i, '')} 1`} className={cx.input} />
                        </div>
                        <div>
                          <label className={cx.label}>Rendimiento</label>
                          <input type="number" value={prep.capacidad} onChange={(e) => updatePreparacion(prep._id, 'capacidad', e.target.value)} placeholder="500" className={cx.input} />
                        </div>
                        <div>
                          <label className={cx.label}>Unidad</label>
                          <CustomSelect
                            value={prep.unidad}
                            onChange={(v) => updatePreparacion(prep._id, 'unidad', v)}
                            options={[
                              { value: '', label: '--' },
                              { value: 'g', label: 'g' },
                              { value: 'kg', label: 'kg' },
                              { value: 'ml', label: 'ml' },
                              { value: 'L', label: 'L' },
                              { value: 'uni', label: 'uni' },
                              { value: 'oz', label: 'oz' },
                            ]}
                            placeholder="--"
                          />
                        </div>
                      </div>

                      {/* Insumos — mobile cards */}
                      <div className="space-y-3 lg:hidden">
                        {prep.insumos.map((ins) => (
                          <div key={ins._id} className="bg-stone-50 rounded-xl p-3 space-y-2">
                            <SearchableSelect
                              options={enrichedInsumos}
                              value={ins.insumo_id}
                              onChange={(item) => selectInsumo(prep._id, ins._id, item)}
                              placeholder={`Seleccionar ${(t.insumos || 'insumo').toLowerCase().replace(/s$/, '')}...`}
                            />
                            <div className="flex flex-wrap gap-2 items-center">
                              <input
                                type="number"
                                value={ins.cantidad}
                                onChange={(e) => updateInsumo(prep._id, ins._id, { cantidad: e.target.value })}
                                placeholder="Cant."
                                className="w-full max-w-[8rem] bg-white rounded-lg px-3 py-2.5 text-stone-800 text-sm text-center border border-stone-200 focus:outline-none focus:border-stone-400"
                              />
                              <CustomSelect
                                value={ins.uso_unidad || ins.unidad_medida || ''}
                                onChange={(v) => updateInsumo(prep._id, ins._id, { uso_unidad: v })}
                                options={getUnidadesCompatibles(ins.unidad_medida).map(u => ({ value: u, label: u }))}
                                compact className="w-16"
                              />
                              <span className="text-stone-400 text-xs">x {formatCurrency(costoEnUsoUnidad(ins))}</span>
                              <span className="ml-auto text-stone-800 text-sm font-medium">
                                {formatCurrency(costoEnUsoUnidad(ins) * (Number(ins.cantidad) || 0))}
                              </span>
                              <button onClick={() => removeInsumo(prep._id, ins._id)} className={cx.btnIcon + ' hover:text-rose-600'}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Insumos — desktop table */}
                      <table className="w-full hidden lg:table">
                        <thead>
                          <tr>
                            <th className={cx.th + ' w-1/3'}>{(t.insumos || 'Insumos').replace(/s$/, '')}</th>
                            <th className={cx.th + ' w-1/5'}>Cantidad</th>
                            <th className={cx.th + ' w-1/6'}>Costo Unit.</th>
                            <th className={cx.th + ' w-1/6 text-right'}>Subtotal</th>
                            <th className={cx.th + ' w-10'}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {prep.insumos.map((ins) => (
                            <tr key={ins._id} className="border-b border-stone-100 last:border-0">
                              <td className="py-2 pr-2">
                                <SearchableSelect
                                  options={enrichedInsumos}
                                  value={ins.insumo_id}
                                  onChange={(item) => selectInsumo(prep._id, ins._id, item)}
                                  placeholder={`Seleccionar ${(t.insumos || 'insumo').toLowerCase().replace(/s$/, '')}...`}
                                />
                              </td>
                              <td className="py-2 px-2">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    value={ins.cantidad}
                                    onChange={(e) => updateInsumo(prep._id, ins._id, { cantidad: e.target.value })}
                                    placeholder="0"
                                    className="w-full bg-stone-50 rounded-lg px-2 py-1.5 text-stone-800 text-sm text-center border border-stone-200 focus:outline-none focus:border-stone-400"
                                  />
                                  <CustomSelect
                                    value={ins.uso_unidad || ins.unidad_medida || ''}
                                    onChange={(v) => updateInsumo(prep._id, ins._id, { uso_unidad: v })}
                                    options={getUnidadesCompatibles(ins.unidad_medida).map(u => ({ value: u, label: u }))}
                                    compact className="w-14"
                                  />
                                </div>
                              </td>
                              <td className="py-2 px-2 text-sm text-stone-500 text-center">
                                {formatCurrency(costoEnUsoUnidad(ins))}
                              </td>
                              <td className="py-2 px-2 text-sm text-stone-800 font-medium text-right">
                                {formatCurrency(costoEnUsoUnidad(ins) * (Number(ins.cantidad) || 0))}
                              </td>
                              <td className="py-2 pl-2">
                                <button onClick={() => removeInsumo(prep._id, ins._id)} className={cx.btnIcon + ' hover:text-rose-600'}>
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <button
                        onClick={() => addInsumo(prep._id)}
                        className={cx.btnGhost + ' mt-1 flex items-center gap-1 text-xs'}
                      >
                        <Plus size={13} /> Agregar {(t.insumos || 'insumo').toLowerCase().replace(/s$/, '')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add prep buttons — below the card */}
            <div className="flex items-center gap-3 mt-3">
              {catalogPreps.length > 0 && availablePreps.length > 0 && (
                <div className="w-48">
                  <SearchableSelect
                    options={availablePreps}
                    value={null}
                    onChange={(pred) => loadPredeterminada(pred)}
                    placeholder="Usar plantilla..."
                    displayKey="nombre"
                    valueKey="id"
                  />
                </div>
              )}
              <button onClick={addPreparacion} className={cx.btnGhost + ' flex items-center gap-1.5'}>
                <Plus size={14} /> {`${(t.preparaciones || 'Preparaciones').replace(/s$/i, '')} nueva`}
              </button>
            </div>
          </div>

          {/* ── Composicion del producto — light bg section ── */}
          <div>
            <h3 className="text-lg font-semibold text-stone-900 mb-3">Composicion del producto<InfoTip text={`Indica cuanto de cada ${(t.preparaciones || 'preparacion').toLowerCase()} necesitas para hacer UN producto completo. El sistema calculara automaticamente cuantos productos puedes hacer por tanda y el costo.`} /></h3>
            <div className="bg-stone-50 rounded-xl p-3 sm:p-5">
              {preparaciones.filter(p => p.nombre).length === 0 ? (
                <p className="text-stone-400 text-sm text-center py-4">Agrega {(t.preparaciones || 'preparaciones').toLowerCase()} arriba para definir la composicion.</p>
              ) : (
                <>
                  {/* Desktop table */}
                  <table className="w-full hidden lg:table">
                    <thead>
                      <tr>
                        <th className={cx.th + ' w-[20%]'}>{(t.preparaciones || 'Preparaciones').replace(/s$/i, '')}</th>
                        <th className={cx.th + ' w-[15%]'}>Rendimiento</th>
                        <th className={cx.th + ' w-[30%]'}>Para el producto</th>
                        <th className={cx.th + ' w-[20%]'}>Por tanda</th>
                        <th className={cx.th + ' w-[15%] text-right'}>Costo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preparaciones.filter(p => p.nombre).map((prep) => {
                        const costoPrep = (prep.insumos || []).reduce((s, i) => s + costoEnUsoUnidad(i) * (Number(i.cantidad) || 0), 0);
                        const rendimiento = Number(prep.capacidad) || 0;
                        const cantPorUni = Number(prep.cantidad_por_unidad) || 0;
                        const cantEnUnidadPrep = convertirUnidad(cantPorUni, prep.porcion_unidad || prep.unidad, prep.unidad);
                        const alcanzaPara = rendimiento > 0 && cantEnUnidadPrep > 0 ? Math.floor(rendimiento / cantEnUnidadPrep) : 0;
                        const costoPorUni = rendimiento > 0 && cantEnUnidadPrep > 0 ? (costoPrep / rendimiento) * cantEnUnidadPrep : costoPrep;
                        return (
                          <tr key={prep._id} className="border-b border-stone-200/50 last:border-0">
                            <td className={cx.td + ' text-stone-800 font-medium'}>{prep.nombre}</td>
                            <td className={cx.td + ' text-stone-500'}>{rendimiento > 0 ? `${rendimiento} ${prep.unidad || ''}` : '--'}</td>
                            <td className={cx.td}>
                              <div className="flex items-center gap-1">
                                <input type="number" min="0" step="0.01" value={prep.cantidad_por_unidad} onChange={(e) => updatePreparacion(prep._id, 'cantidad_por_unidad', e.target.value)} className={cx.input + ' w-full text-center'} placeholder="0" />
                                <CustomSelect
                                  value={prep.porcion_unidad || prep.unidad || ''}
                                  onChange={(v) => updatePreparacion(prep._id, 'porcion_unidad', v)}
                                  options={[
                                    { value: 'g', label: 'g' },
                                    { value: 'kg', label: 'kg' },
                                    { value: 'ml', label: 'ml' },
                                    { value: 'L', label: 'L' },
                                    { value: 'uni', label: 'uni' },
                                    { value: 'oz', label: 'oz' },
                                  ]}
                                  compact className="w-14"
                                />
                              </div>
                            </td>
                            <td className={cx.td + ' text-stone-600'}>{alcanzaPara > 0 ? `${alcanzaPara} productos` : '--'}</td>
                            <td className={cx.td + ' text-right text-[var(--accent)] font-semibold'}>{formatCurrency(costoPorUni)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {/* Mobile cards */}
                  <div className="space-y-3 lg:hidden">
                    {preparaciones.filter(p => p.nombre).map((prep) => {
                      const costoPrep = (prep.insumos || []).reduce((s, i) => s + costoEnUsoUnidad(i) * (Number(i.cantidad) || 0), 0);
                      const rendimiento = Number(prep.capacidad) || 0;
                      const cantPorUni = Number(prep.cantidad_por_unidad) || 0;
                      const cantEnUnidadPrep = convertirUnidad(cantPorUni, prep.porcion_unidad || prep.unidad, prep.unidad);
                      const alcanzaPara = rendimiento > 0 && cantEnUnidadPrep > 0 ? Math.floor(rendimiento / cantEnUnidadPrep) : 0;
                      const costoPorUni = rendimiento > 0 && cantEnUnidadPrep > 0 ? (costoPrep / rendimiento) * cantEnUnidadPrep : costoPrep;
                      return (
                        <div key={prep._id} className="bg-white rounded-xl p-3 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-stone-800 text-sm font-medium">{prep.nombre}</span>
                            <span className="text-stone-500 text-xs">{rendimiento > 0 ? `Rinde: ${rendimiento} ${prep.unidad || ''}` : ''}</span>
                          </div>
                          <div className="flex gap-3 items-center">
                            <div>
                              <label className={cx.label}>Para el producto</label>
                              <div className="flex items-center gap-1">
                                <input type="number" min="0" step="0.01" value={prep.cantidad_por_unidad} onChange={(e) => updatePreparacion(prep._id, 'cantidad_por_unidad', e.target.value)} className="w-full max-w-[8rem] bg-white rounded-lg px-3 py-2.5 text-stone-800 text-sm text-center border border-stone-200 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30" placeholder="0" />
                                <CustomSelect
                                  value={prep.porcion_unidad || prep.unidad || ''}
                                  onChange={(v) => updatePreparacion(prep._id, 'porcion_unidad', v)}
                                  options={[
                                    { value: 'g', label: 'g' },
                                    { value: 'kg', label: 'kg' },
                                    { value: 'ml', label: 'ml' },
                                    { value: 'L', label: 'L' },
                                    { value: 'uni', label: 'uni' },
                                    { value: 'oz', label: 'oz' },
                                  ]}
                                  compact className="w-14"
                                />
                              </div>
                            </div>
                            <div className="text-xs text-stone-500">
                              {alcanzaPara > 0 && <p>{alcanzaPara} productos/tanda</p>}
                              <p className="text-[var(--accent)] font-semibold">{formatCurrency(costoPorUni)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
          </>}

          {/* ── Empaque / Materiales — accordion like preparaciones ── */}
          <div>
            <h3 className="text-lg font-semibold text-stone-900 mb-3">{t.materiales || 'Empaque'}<InfoTip text={`${t.materiales || 'Materiales de empaque'} para presentar tu producto. Si es presentacion entera, separa el del producto completo y el de cada porcion individual.`} /></h3>

            <div className={`${cx.card} divide-y divide-stone-100`}>
              {/* Empaque producto entero */}
              {(() => {
                const tipo = 'entero';
                const mats = materiales.filter(m => (m.empaque_tipo || 'entero') === tipo);
                const subtotal = mats.reduce((s, m) => s + (Number(m.precio) || 0) * (Number(m.cantidad) || 0), 0);
                const isCollapsed = empaqueCollapsed[tipo];
                const label = tipoPresentacion === 'entero' ? `${t.materiales || 'Empaque'} producto` : (t.materiales || 'Empaque');
                return (
                  <div className="p-3 sm:p-5">
                    <div className="flex items-center justify-between cursor-pointer" onClick={() => setEmpaqueCollapsed(p => ({ ...p, [tipo]: !p[tipo] }))}>
                      <div className="flex items-center gap-3">
                        {isCollapsed ? <ChevronDown size={16} className="text-stone-400" /> : <ChevronUp size={16} className="text-stone-400" />}
                        <div>
                          <span className="text-sm font-semibold text-stone-800">{selectedEmpaquePred[tipo] || label}</span>
                          <span className="text-xs text-stone-400 ml-2">{mats.filter(m => m.material_id).length} materiales</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--accent)]">{formatCurrency(subtotal)}</span>
                        <button onClick={(e) => { e.stopPropagation(); saveEmpaqueAsPredeterminado(tipo); }} className={cx.btnIcon + ' hover:text-[var(--success)]'} title="Guardar como plantilla">
                          <BookmarkPlus size={14} />
                        </button>
                      </div>
                    </div>
                    {!isCollapsed && (
                      <div className="mt-4 space-y-3">
                        <div className="flex items-center gap-2">
                          {catalogEmpaques.length > 0 && (
                            <div className="w-44">
                              <SearchableSelect options={catalogEmpaques} value={null} onChange={(pred) => loadEmpaquePred(pred, tipo)} placeholder="Cargar plantilla..." />
                            </div>
                          )}
                          <button onClick={() => addMaterial(tipo)} className={cx.btnGhost + ' flex items-center gap-1 text-xs'}>
                            <Plus size={13} /> Agregar material
                          </button>
                        </div>
                        {renderMaterialsList(mats)}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Empaque por porcion (solo en presentacion entera) */}
              {tipoPresentacion === 'entero' && (() => {
                const tipo = 'unidad';
                const mats = materiales.filter(m => m.empaque_tipo === tipo);
                const subtotal = mats.reduce((s, m) => s + (Number(m.precio) || 0) * (Number(m.cantidad) || 0), 0);
                const isCollapsed = empaqueCollapsed[tipo];
                return (
                  <div className="p-3 sm:p-5">
                    <div className="flex items-center justify-between cursor-pointer" onClick={() => setEmpaqueCollapsed(p => ({ ...p, [tipo]: !p[tipo] }))}>
                      <div className="flex items-center gap-3">
                        {isCollapsed ? <ChevronDown size={16} className="text-stone-400" /> : <ChevronUp size={16} className="text-stone-400" />}
                        <div>
                          <span className="text-sm font-semibold text-stone-800">{selectedEmpaquePred[tipo] || `${t.materiales || 'Empaque'} por porcion`}</span>
                          <span className="text-xs text-stone-400 ml-2">{mats.filter(m => m.material_id).length} materiales · {unidadesPorProducto} uni</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--accent)]">{formatCurrency(subtotal)}</span>
                        <button onClick={(e) => { e.stopPropagation(); saveEmpaqueAsPredeterminado(tipo); }} className={cx.btnIcon + ' hover:text-[var(--success)]'} title="Guardar como plantilla">
                          <BookmarkPlus size={14} />
                        </button>
                      </div>
                    </div>
                    {!isCollapsed && (
                      <div className="mt-4 space-y-3">
                        <div className="flex items-center gap-2">
                          {catalogEmpaques.length > 0 && (
                            <div className="w-44">
                              <SearchableSelect options={catalogEmpaques} value={null} onChange={(pred) => loadEmpaquePred(pred, tipo)} placeholder="Cargar plantilla..." />
                            </div>
                          )}
                          <button onClick={() => addMaterial(tipo)} className={cx.btnGhost + ' flex items-center gap-1 text-xs'}>
                            <Plus size={13} /> Agregar material
                          </button>
                        </div>
                        {renderMaterialsList(mats)}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* ── Right column: Resumen — premium sticky card ── */}
        <div className="lg:col-span-1 lg:self-start lg:sticky lg:top-6">
          <div className={`${cx.card} p-4`}>
            <h3 className="text-lg font-semibold text-stone-900 mb-4">Resumen<InfoTip text="El costo neto incluye insumos + empaque. El margen define tu ganancia. El precio sugerido redondea a un valor comercial (.90 o .00)." /></h3>

            {tipoPresentacion === 'entero' ? (
              <>
                {/* Cost lines */}
                <div className="space-y-3 pb-4 border-b border-stone-100">
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">Costo {(t.insumos || 'insumos').toLowerCase()}</span>
                    <span className="text-stone-800 font-medium">{formatCurrency(costos.costoInsumosProducto)}</span>
                  </div>
                  {costos.costoEmpaqueEntero > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-500">{t.materiales || 'Empaque'} producto</span>
                      <span className="text-stone-800 font-medium">{formatCurrency(costos.costoEmpaqueEntero)}</span>
                    </div>
                  )}
                  {costos.costoEmpaqueUnidad > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-500">{t.materiales || 'Empaque'}/porcion &times; {costos.unidades}</span>
                      <span className="text-stone-800 font-medium">{formatCurrency(costos.costoEmpaqueUnidad * costos.unidades)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-semibold pt-2">
                    <span className="text-stone-600">Costo neto</span>
                    <span className="text-stone-800">{formatCurrency(costos.costoNeto)}</span>
                  </div>
                </div>

                {/* Margen slider - producto entero */}
                <div className="py-4 border-b border-stone-100">
                  <label className={cx.label}>Margen producto entero</label>
                  <div className="flex items-center gap-3 mt-1">
                    <input
                      type="range"
                      min="0"
                      max="90"
                      step="0.5"
                      value={margen}
                      onChange={(e) => setMargen(Number(e.target.value))}
                      className="flex-1 accent-[var(--accent)] h-1.5"
                    />
                    <input
                      type="number"
                      value={margen}
                      onChange={(e) => setMargen(Math.min(90, Math.max(0, Number(e.target.value) || 0)))}
                      className="w-20 bg-stone-50 rounded-lg px-3 py-2.5 text-stone-800 text-sm text-center border border-stone-200 focus:outline-none focus:border-stone-400"
                    />
                    <span className="text-stone-400 text-sm">%</span>
                  </div>
                </div>

                {/* Pricing - Producto entero */}
                <div className="py-4 border-b border-stone-100 space-y-2">
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Producto entero</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">Precio venta</span>
                    <span className="text-stone-800">{formatCurrency(costos.precioVenta)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">IGV</span>
                    <span className="text-stone-800">
                      {user?.tipo_negocio === 'informal' ? 'No aplica' : `${formatCurrency(costos.igvMonto)} (${costos.igvRate}%)`}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline pt-1">
                    <span className="text-stone-600 text-sm">Precio final</span>
                    <EditablePrice value={costos.precioFinal} onChange={setMargenFromPrecio} className="text-2xl font-bold text-stone-900" />
                  </div>
                  {costos.precioVenta > 0 && costos.costoNeto > 0 && (
                    <div className="flex justify-between items-center bg-emerald-50 rounded-lg px-3 py-2 mt-1">
                      <span className="text-xs text-emerald-700">Ganancia por producto</span>
                      <span className="text-sm font-bold text-emerald-700">{formatCurrency(costos.precioVenta - costos.costoNeto)}</span>
                    </div>
                  )}
                  {precioConfig === 'variable' ? (
                    <div className="flex justify-between items-baseline gap-4">
                      <span className="text-stone-400 text-xs">Sugeridos</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-[var(--success)]">{formatCurrency(preciosRecomendados(costos.precioFinal).conDecimales)}</span>
                        <span className="text-stone-300">|</span>
                        <span className="text-sm font-semibold text-stone-600">{formatCurrency(preciosRecomendados(costos.precioFinal).sinDecimales)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-baseline">
                      <span className="text-stone-400 text-xs">Sugerido</span>
                      <span className="text-base font-semibold text-[var(--success)]">{formatCurrency(precioComercial(costos.precioFinal, precioConfig))}</span>
                    </div>
                  )}
                </div>

                {/* Margen por porcion */}
                <div className="py-4 border-b border-stone-100">
                  <label className={cx.label}>Margen por porcion</label>
                  <div className="flex items-center gap-3 mt-1">
                    <input type="range" min="0" max="90" step="0.5" value={margenPorcion} onChange={(e) => setMargenPorcion(Number(e.target.value))} className="flex-1 accent-[var(--accent)] h-1.5" />
                    <input type="number" value={margenPorcion} onChange={(e) => setMargenPorcion(Math.min(90, Math.max(0, Number(e.target.value) || 0)))} className="w-20 bg-stone-50 rounded-lg px-3 py-2.5 text-stone-800 text-sm text-center border border-stone-200 focus:outline-none focus:border-stone-400" />
                    <span className="text-stone-400 text-sm">%</span>
                  </div>
                </div>

                {/* Pricing - Por porcion */}
                <div className="pt-4 space-y-2">
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Por porcion (1/{costos.unidades})</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">Costo</span>
                    <span className="text-stone-800">{formatCurrency(costos.costoNetoPorcion)}</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-1">
                    <span className="text-stone-600 text-sm">Precio final</span>
                    <EditablePrice value={costos.precioFinalPorcion} onChange={setMargenPorcionFromPrecio} className="text-2xl font-bold text-stone-900" />
                  </div>
                  {precioConfig === 'variable' ? (
                    <div className="flex justify-between items-baseline gap-4">
                      <span className="text-stone-400 text-xs">Sugeridos</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-[var(--success)]">{formatCurrency(preciosRecomendados(costos.precioFinalPorcion).conDecimales)}</span>
                        <span className="text-stone-300">|</span>
                        <span className="text-sm font-semibold text-stone-600">{formatCurrency(preciosRecomendados(costos.precioFinalPorcion).sinDecimales)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-baseline">
                      <span className="text-stone-400 text-xs">Sugerido</span>
                      <span className="text-base font-semibold text-[var(--success)]">{formatCurrency(precioComercial(costos.precioFinalPorcion, precioConfig))}</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="space-y-3 pb-4 border-b border-stone-100">
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">Costo {(t.insumos || 'insumos').toLowerCase()}</span>
                    <span className="text-stone-800 font-medium">{formatCurrency(costos.costoInsumos)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">Costo {(t.materiales || 'empaque').toLowerCase()}</span>
                    <span className="text-stone-800 font-medium">{formatCurrency(costos.costoEmpaque)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold pt-2">
                    <span className="text-stone-600">Costo neto</span>
                    <span className="text-stone-800">{formatCurrency(costos.costoNeto)}</span>
                  </div>
                </div>

                {/* Margen slider */}
                <div className="py-4 border-b border-stone-100">
                  <label className={cx.label}>Margen</label>
                  <div className="flex items-center gap-3 mt-1">
                    <input
                      type="range"
                      min="0"
                      max="90"
                      step="0.5"
                      value={margen}
                      onChange={(e) => setMargen(Number(e.target.value))}
                      className="flex-1 accent-[var(--accent)] h-1.5"
                    />
                    <input
                      type="number"
                      value={margen}
                      onChange={(e) => setMargen(Math.min(90, Math.max(0, Number(e.target.value) || 0)))}
                      className="w-20 bg-stone-50 rounded-lg px-3 py-2.5 text-stone-800 text-sm text-center border border-stone-200 focus:outline-none focus:border-stone-400"
                    />
                    <span className="text-stone-400 text-sm">%</span>
                  </div>
                </div>

                <div className="py-4 border-b border-stone-100 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">Precio de venta</span>
                    <span className="text-stone-800 font-medium">{formatCurrency(costos.precioVenta)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">IGV</span>
                    <span className="text-stone-800">
                      {user?.tipo_negocio === 'informal' ? 'No aplica' : `${formatCurrency(costos.igvMonto)} (${costos.igvRate}%)`}
                    </span>
                  </div>
                </div>

                {/* Final price — BIG, editable */}
                <div className="pt-4">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-stone-600 text-sm">Precio final</span>
                    <EditablePrice value={costos.precioFinal} onChange={setMargenFromPrecio} className="text-2xl font-bold text-stone-900" />
                  </div>
                  {costos.precioVenta > 0 && costos.costoNeto > 0 && (
                    <div className="flex justify-between items-center bg-emerald-50 rounded-lg px-3 py-2 mb-2">
                      <span className="text-xs text-emerald-700">Ganancia por unidad</span>
                      <span className="text-sm font-bold text-emerald-700">{formatCurrency(costos.precioVenta - costos.costoNeto)}</span>
                    </div>
                  )}
                  {precioConfig === 'variable' ? (
                    <div className="flex justify-between items-baseline gap-4">
                      <span className="text-stone-400 text-xs">Sugeridos</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-[var(--success)]">{formatCurrency(preciosRecomendados(costos.precioFinal).conDecimales)}</span>
                        <span className="text-stone-300">|</span>
                        <span className="text-sm font-semibold text-stone-600">{formatCurrency(preciosRecomendados(costos.precioFinal).sinDecimales)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-baseline">
                      <span className="text-stone-400 text-xs">Sugerido</span>
                      <span className="text-base font-semibold text-[var(--success)]">{formatCurrency(precioComercial(costos.precioFinal, precioConfig))}</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Save button — full width, prominent */}
            <button
              onClick={handleSaveClick}
              disabled={saving}
              className={cx.btnPrimary + ' w-full mt-5 py-3 text-sm flex items-center justify-center gap-2'}
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save size={14} /> Guardar producto
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Price choice modal — shown when saving with 'variable' config */}
      {showPriceChoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowPriceChoice(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] sm:max-w-sm p-4 sm:p-6">
            <h3 className="text-lg font-bold text-stone-900 mb-2">Precio de venta</h3>
            <p className="text-sm text-stone-500 mb-5">Elige el precio con el que guardaras este producto</p>

            <div className="space-y-3">
              <button
                onClick={() => handleSave(preciosRecomendados(costos.precioFinal).conDecimales)}
                className="w-full flex items-center justify-between p-4 border border-stone-200 rounded-xl hover:border-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors group"
              >
                <div className="text-left">
                  <p className="text-sm font-semibold text-stone-800 group-hover:text-[var(--accent)]">Con decimales</p>
                  <p className="text-xs text-stone-400">Precio redondeado a .90</p>
                </div>
                <span className="text-xl font-bold text-stone-900">{formatCurrency(preciosRecomendados(costos.precioFinal).conDecimales)}</span>
              </button>

              <button
                onClick={() => handleSave(preciosRecomendados(costos.precioFinal).sinDecimales)}
                className="w-full flex items-center justify-between p-4 border border-stone-200 rounded-xl hover:border-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors group"
              >
                <div className="text-left">
                  <p className="text-sm font-semibold text-stone-800 group-hover:text-[var(--accent)]">Sin decimales</p>
                  <p className="text-xs text-stone-400">Redondeado al entero superior</p>
                </div>
                <span className="text-xl font-bold text-stone-900">{formatCurrency(preciosRecomendados(costos.precioFinal).sinDecimales)}</span>
              </button>

              <button
                onClick={() => handleSave(null)}
                className="w-full flex items-center justify-between p-4 border border-stone-200 rounded-xl hover:border-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors group"
              >
                <div className="text-left">
                  <p className="text-sm font-semibold text-stone-800 group-hover:text-[var(--accent)]">Precio exacto</p>
                  <p className="text-xs text-stone-400">Sin redondeo</p>
                </div>
                <span className="text-xl font-bold text-stone-900">{formatCurrency(costos.precioFinal)}</span>
              </button>
            </div>

            <button onClick={() => setShowPriceChoice(false)} className={cx.btnGhost + ' w-full mt-4 text-center'}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <PromptDialog
        open={!!saveEmpaquePrompt}
        title="Guardar empaque como plantilla"
        message="Este empaque se guardara como predeterminado para reutilizar en otros productos."
        placeholder="Nombre de la plantilla"
        onConfirm={confirmSaveEmpaque}
        onCancel={() => setSaveEmpaquePrompt(null)}
      />
    </div>
  );
}
