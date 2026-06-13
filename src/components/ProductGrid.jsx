import { Package } from 'lucide-react';
import { cx } from '../styles/tokens';
import { formatCurrency } from '../utils/format';

export default function ProductGrid({
  products,
  search,
  onSearchChange,
  onProductClick,
  getDisplayPrice,
  loading,
  searchPlaceholder = 'Buscar producto...',
  children, // slot for tabs/filters above the grid
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
          <div key={i} className={cx.skeleton + ' aspect-square rounded-xl'} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex-1">
      {children}

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className={cx.input + ' text-sm w-full'}
          placeholder={searchPlaceholder}
        />
      </div>

      {/* Grid */}
      {products.length === 0 ? (
        <div className={cx.card + ' p-12 text-center'}>
          <Package size={40} className="text-stone-300 mx-auto mb-3" />
          <p className="text-stone-400 text-sm">
            {search ? 'Sin resultados' : 'No hay productos configurados'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
          {products.map(p => (
            <button
              key={p.id}
              onClick={() => onProductClick(p)}
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
              <p className="text-xs font-bold text-[var(--accent)]">{formatCurrency(getDisplayPrice(p))}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
