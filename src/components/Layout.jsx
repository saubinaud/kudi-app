import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { TerminosProvider } from '../context/TerminosContext';
import { API_BASE } from '../config/api';
import { useApi } from '../hooks/useApi';
import {
  LayoutDashboard,
  Calculator,
  Salad,
  Package,
  ChefHat,
  BoxSelect,
  User,
  Users,
  Activity,
  TrendingUp,
  Menu,
  X,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  ChevronUp,
  DollarSign,
  BarChart3,
  ShoppingCart,
  Receipt,
  ShoppingBag,
  TrendingDown,
  Wallet,
  Clock,
  Lock,
  FileText,
  ClipboardList,
  Truck,
  Link2,
  MessageSquare,
} from 'lucide-react';


function SidebarLink({ to, label, icon: Icon, onClick, collapsed, end, disabled }) {
  if (disabled) {
    return (
      <div
        title={collapsed ? `${label} (bloqueado)` : 'Módulo no disponible en tu plan'}
        className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2.5'} ${collapsed ? 'px-0 py-2.5' : 'px-3 py-2'} rounded-lg text-[13px] font-medium text-white/20 cursor-not-allowed`}
      >
        <Icon size={collapsed ? 20 : 16} strokeWidth={1.5} />
        {!collapsed && (
          <>
            <span className="flex-1">{label}</span>
            <Lock size={12} className="text-white/20" />
          </>
        )}
      </div>
    );
  }
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `flex items-center ${collapsed ? 'justify-center' : 'gap-2.5'} ${collapsed ? 'px-0 py-2.5' : 'px-3 py-2'} rounded-lg text-[13px] font-medium transition-colors duration-100 ${
          isActive
            ? 'bg-white/10 text-[#4ADE80]'
            : 'text-white/55 hover:text-white hover:bg-white/5'
        }`
      }
    >
      <Icon size={collapsed ? 20 : 16} strokeWidth={1.5} />
      {!collapsed && <span>{label}</span>}
    </NavLink>
  );
}

export default function Layout() {
  const { user, logout, refreshUser } = useAuth();
  const api = useApi();
  const navigate = useNavigate();

  const t = {}; // Kudi universal — no per-giro terminology

  const HIDDEN_ROUTES = ['/shopify', '/proyeccion', '/comisiones', '/analisis'];

  const sidebarGroups = [
    {
      key: 'catalogo',
      label: 'Catálogo',
      icon: Package,
      links: [
        { to: '/dashboard', label: t.productos || 'Productos', icon: LayoutDashboard, perm: 'dashboard' },
        { to: '/cotizador', label: 'Nuevo producto', icon: Calculator, perm: 'cotizador' },
        { to: '/insumos', label: t.insumos || 'Insumos', icon: Salad, perm: 'insumos' },
        { to: '/materiales', label: t.materiales || 'Materiales', icon: Package, perm: 'materiales' },
        { to: '/preparaciones-predeterminadas', label: t.prep_pred || 'Recetas base', icon: ChefHat, perm: 'preparaciones' },
        { to: '/empaques-predeterminados', label: 'Empaques predet.', icon: BoxSelect, perm: 'empaques' },
        { to: '/stock', label: 'Inventario', icon: Package, perm: 'dashboard' },
        { to: '/canales', label: 'Canales y Envío', icon: Truck, perm: 'canales' },
      ],
    },
    {
      key: 'ingresos',
      label: 'Ingresos',
      icon: ShoppingCart,
      links: [
        { to: '/pos', label: 'POS', icon: ShoppingCart, perm: 'ventas' },
        { to: '/pl/ventas', label: 'Órdenes', icon: DollarSign, perm: 'ventas' },
        { to: '/comprobantes', label: 'Facturación', icon: FileText, perm: 'facturacion' },
        { to: '/clientes', label: 'Clientes', icon: Users, perm: 'facturacion' },
      ],
    },
    {
      key: 'gastos',
      label: 'Gastos',
      icon: Receipt,
      links: [
        { to: '/pl/compras', label: 'Compras', icon: ShoppingBag, perm: 'finanzas' },
        { to: '/pl/gastos', label: 'Pagos', icon: Receipt, perm: 'finanzas' },
        { to: '/perdidas', label: 'Pérdidas', icon: TrendingDown, perm: 'finanzas' },
      ],
    },
    {
      key: 'finanzas',
      label: 'Finanzas',
      icon: DollarSign,
      links: [
        { to: '/pl', label: 'Timeline', icon: Activity, perm: 'finanzas', end: true },
        { to: '/pl/resumen', label: 'Estado de resultados', icon: BarChart3, perm: 'finanzas' },
        { to: '/pl/cashflow', label: 'Flujo de Caja', icon: Wallet, perm: 'finanzas' },
        { to: '/proveedores', label: 'Proveedores', icon: Truck, perm: 'finanzas' },
      ],
    },
  ];

  const standaloneLinks = [
    { to: '/actividad', label: 'Mi Actividad', icon: Activity },
    { to: '/equipo', label: 'Mi Equipo', icon: Users },
    { to: '/perfil', label: 'Perfil', icon: User },
    { to: '/feedback', label: 'Feedback', icon: MessageSquare },
  ];

  const adminLinks = [
    { to: '/admin', label: 'Admin', icon: BarChart3 },
    { to: '/admin/actividad', label: 'Actividad', icon: Activity },
  ];
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('nodum_sidebar_collapsed') === 'true');
  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    try { return JSON.parse(localStorage.getItem('kudi_nav_groups') || '{}'); } catch { return {}; }
  });

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('nodum_sidebar_collapsed', String(next));
  };
  const toggleGroup = (key) => {
    const next = { ...collapsedGroups, [key]: !collapsedGroups[key] };
    setCollapsedGroups(next);
    localStorage.setItem('kudi_nav_groups', JSON.stringify(next));
  };
  const isAdmin = user?.rol === 'admin';
  const rawPermisos = Array.isArray(user?.permisos) ? user.permisos : ['dashboard', 'cotizador', 'insumos', 'materiales', 'preparaciones', 'empaques', 'canales', 'ventas', 'finanzas', 'facturacion'];
  // Map old permission keys to new ones for backward compatibility
  const permAliases = { pl: 'finanzas', cotizador: 'cotizador', proyeccion: 'ventas', perdidas: 'finanzas' };
  const permState = (perm) => {
    if (!perm) return 'full';
    if (isAdmin) return 'full';
    if (rawPermisos.includes(perm)) return 'full';
    if (rawPermisos.includes(`~${perm}`)) return 'vitrina';
    // Check aliases (old perm keys still in DB)
    const alias = permAliases[perm];
    if (alias && rawPermisos.includes(alias)) return 'full';
    if (alias && rawPermisos.includes(`~${alias}`)) return 'vitrina';
    return 'hidden';
  };

  const [bannerDismissed, setBannerDismissed] = useState(() => sessionStorage.getItem('kudi_banner_dismissed') === '1');

  const trialBanner = (() => {
    if (!user || user.rol === 'admin') return null;
    // Paid plans that are not trial
    if (user.plan && !['trial'].includes(user.plan) && !user.trial_ends_at) return null;
    if (!user.trial_ends_at) return null;

    const now = new Date();
    const ends = new Date(user.trial_ends_at);
    const diffMs = ends - now;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 7) {
      return { type: 'info', text: `Prueba gratis — ${diffDays} días restantes`, color: 'bg-blue-50 text-blue-700 border-blue-200', dismissable: true };
    } else if (diffDays > 0) {
      return { type: 'warning', text: `Tu prueba gratis termina en ${diffDays} día${diffDays > 1 ? 's' : ''}`, color: 'bg-amber-50 text-amber-700 border-amber-200', dismissable: true };
    } else if (diffDays === 0) {
      return { type: 'danger', text: 'Tu prueba gratis termina hoy', color: 'bg-rose-50 text-rose-700 border-rose-200', dismissable: false };
    } else {
      return { type: 'expired', text: 'Tu prueba gratis ha terminado', color: 'bg-rose-50 text-rose-700 border-rose-200', dismissable: false };
    }
  })();

  const [showPayModal, setShowPayModal] = useState(false);
  const [payPlan, setPayPlan] = useState('emprendedor');
  const [payComprobante, setPayComprobante] = useState('');
  const [payUploading, setPayUploading] = useState(false);
  const [paySaving, setPaySaving] = useState(false);
  const [paySuccess, setPaySuccess] = useState(false);

  const PAY_PLANS = {
    independiente: { label: 'Independiente', precio: 80 },
    emprendedor: { label: 'Emprendedor', precio: 100 },
    empresario: { label: 'Empresario', precio: 180 },
  };

  const handlePayUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return;
    setPayUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const r = await fetch(`${API_BASE}/onboarding/comprobante`, { method: 'POST', body: formData });
      const d = await r.json();
      if (d.url) setPayComprobante(d.url);
    } catch {}
    finally { setPayUploading(false); }
  };

  const [payError, setPayError] = useState('');

  const handlePaySubmit = async () => {
    if (!payComprobante) return;
    setPaySaving(true);
    setPayError('');
    try {
      await api.post('/onboarding/completar-pago', { plan: payPlan, comprobante_url: payComprobante });
      await refreshUser();
      setPaySuccess(true);
    } catch (err) {
      setPayError(err.message || 'Error al procesar el pago. Intenta de nuevo.');
    } finally {
      setPaySaving(false);
    }
  };

  const dismissBanner = () => {
    setBannerDismissed(true);
    sessionStorage.setItem('kudi_banner_dismissed', '1');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeSidebar = () => setOpen(false);

  const businessName = user?.nombre_comercial || user?.empresa || '';

  const renderSidebarContent = (isCollapsed) => (
    <>
      {/* Header: Kudi brand + collapse toggle — fixed, no scroll */}
      <div className={`${isCollapsed ? 'px-3 py-4' : 'px-5 py-4'} border-b border-white/10 flex-shrink-0`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className={`flex items-center ${isCollapsed ? '' : 'gap-3'}`}>
            <img src="/logo-kudi.jpg" alt="Kudi" className={`${isCollapsed ? 'w-9 h-9' : 'w-8 h-8'} rounded-lg object-cover flex-shrink-0`} />
            {!isCollapsed && (
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-white leading-tight">Kudi</h1>
                {businessName && (
                  <p className="text-[10px] text-white/40 truncate leading-tight">{businessName}</p>
                )}
              </div>
            )}
          </div>
          {!isCollapsed && (
            <button
              onClick={toggleCollapsed}
              className="p-1.5 text-white/30 hover:text-white/60 hover:bg-white/5 rounded-lg transition-colors"
              title="Contraer menu"
            >
              <PanelLeftClose size={18} strokeWidth={1.5} />
            </button>
          )}
        </div>
        {isCollapsed && (
          <button
            onClick={toggleCollapsed}
            className="w-full flex justify-center mt-3 p-1.5 text-white/30 hover:text-white/60 hover:bg-white/5 rounded-lg transition-colors"
            title="Expandir menu"
          >
            <PanelLeftOpen size={18} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {/* Navigation — independent scroll */}
      <nav className={`flex-1 ${isCollapsed ? 'px-2' : 'px-3'} py-4 space-y-1 overflow-y-auto min-h-0`}>
        {sidebarGroups.map((group) => {
          const visibleLinks = group.links
            .map(l => ({ ...l, _state: permState(l.perm) }))
            .filter(l => !HIDDEN_ROUTES.includes(l.to))
            .filter(l => isAdmin || l._state !== 'hidden');
          if (visibleLinks.length === 0) return null;
          const isGroupCollapsed = collapsedGroups[group.key];

          return (
            <div key={group.key} className="mb-2">
              {/* Group header */}
              <button
                onClick={() => toggleGroup(group.key)}
                className={`w-full flex items-center justify-between ${isCollapsed ? 'justify-center px-0' : 'px-3'} py-2 rounded-lg text-[11px] font-semibold text-white/50 uppercase tracking-wide hover:text-white/70 hover:bg-white/5 transition-colors`}
              >
                <div className="flex items-center gap-2">
                  <group.icon size={isCollapsed ? 20 : 15} strokeWidth={1.5} />
                  {!isCollapsed && <span>{group.label}</span>}
                </div>
                {!isCollapsed && (isGroupCollapsed ? <ChevronDown size={13} strokeWidth={1.5} /> : <ChevronUp size={13} strokeWidth={1.5} />)}
              </button>
              {/* Group links with vertical line */}
              {!isGroupCollapsed && (
                <div className={isCollapsed ? '' : 'relative ml-[18px] pl-3 border-l border-white/10'}>
                  {visibleLinks.map(l => (
                    <SidebarLink key={l.to} {...l} disabled={l._state === 'vitrina'} collapsed={isCollapsed} onClick={closeSidebar} />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Separator */}
        <div className={`${isCollapsed ? 'mx-2' : 'mx-3'} border-t border-white/10 my-3`} />

        {standaloneLinks.map((l) => (
          <SidebarLink key={l.to} {...l} onClick={closeSidebar} collapsed={isCollapsed} />
        ))}
        {isAdmin && (
          <>
            <div className={`${isCollapsed ? 'mx-2' : 'mx-3'} border-t border-white/10 my-3`} />
            {!isCollapsed && (
              <div className="px-3 py-1.5">
                <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold">Admin</p>
              </div>
            )}
            {adminLinks.map((l) => (
              <SidebarLink key={l.to} {...l} onClick={closeSidebar} collapsed={isCollapsed} />
            ))}
          </>
        )}
      </nav>

      {/* Footer: user info + logout — fixed, no scroll */}
      <div className={`${isCollapsed ? 'p-2' : 'px-4 py-3'} border-t border-white/10 flex-shrink-0`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-1'} py-1.5`}>
          <div className={`${isCollapsed ? 'w-9 h-9' : 'w-8 h-8'} rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white/70 shrink-0`}>
            {user?.nombre?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          {!isCollapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white truncate font-medium">{user?.nombre || 'Usuario'}</p>
                <p className="text-[10px] text-white/30 truncate">{user?.email}</p>
              </div>
              <button onClick={handleLogout} className="p-1.5 text-white/30 hover:text-rose-400 transition-colors rounded-lg" title="Cerrar sesion">
                <LogOut size={16} strokeWidth={1.5} />
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );

  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  return (
    <div className="min-h-screen bg-[#F4F6F5] flex">
      {/* Dev environment banner */}
      {isDev && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-amber-950 text-center text-[11px] font-bold py-0.5 tracking-wider">
          DESARROLLO — Los datos son una copia de producci&oacute;n
        </div>
      )}
      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex ${collapsed ? 'w-[68px]' : 'w-52'} flex-col bg-[#0A2F24] fixed inset-y-0 left-0 z-30 transition-[width,margin] duration-150 overflow-hidden`}>
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize: '128px'}} />
        <div className="relative flex flex-col h-full">
          {renderSidebarContent(collapsed)}
        </div>
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={closeSidebar} />
          <aside className="absolute left-0 top-0 bottom-0 w-56 bg-[#0A2F24] flex flex-col overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize: '128px'}} />
            <button
              onClick={closeSidebar}
              className="absolute top-4 right-4 p-1 text-white/40 hover:text-white z-10"
            >
              <X size={18} />
            </button>
            <div className="relative flex flex-col h-full">
              {renderSidebarContent(false)}
            </div>
          </aside>
        </div>
      )}

      {/* Main content — independent scroll */}
      <div className={`flex-1 ${collapsed ? 'lg:ml-[68px]' : 'lg:ml-52'} transition-[width,margin] duration-150 lg:h-screen lg:overflow-y-auto ${isDev ? 'pt-5' : ''}`}>
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#0A2F24] sticky top-0 z-20">
          <button onClick={() => setOpen(true)} className="p-2 text-white/60 hover:text-white">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <img src="/logo-kudi.jpg" alt="Kudi" className="w-7 h-7 rounded-lg object-cover" />
            <span className="text-sm font-bold text-white">Kudi</span>
          </div>
          <div className="w-9" />
        </header>

        {trialBanner && !(bannerDismissed && trialBanner.dismissable) && (
          <div className={`${trialBanner.color} border-b px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-3`}>
            <div className="flex items-center gap-2">
              <Clock size={14} />
              <span>{trialBanner.text}</span>
            </div>
            <button
              onClick={() => setShowPayModal(true)}
              className="px-3 py-1 bg-[#16A34A] text-white text-xs font-semibold rounded-lg hover:bg-[#15803D] transition-colors duration-100 whitespace-nowrap"
            >
              Pagar plan
            </button>
            {trialBanner.dismissable && (
              <button onClick={dismissBanner} className="text-current opacity-50 hover:opacity-100 transition-opacity ml-1">
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* Expired trial overlay */}
        {trialBanner?.type === 'expired' && (
          <div className="bg-rose-50 border-b border-rose-200 px-6 py-4 text-center">
            <p className="text-rose-800 font-semibold mb-2">Tu prueba gratis ha terminado</p>
            <p className="text-rose-600 text-sm mb-3">Activa un plan para seguir usando Kudi con todas las funcionalidades.</p>
            <button
              onClick={() => setShowPayModal(true)}
              className="px-6 py-2.5 bg-[#16A34A] text-white text-sm font-semibold rounded-lg hover:bg-[#15803D] transition-colors"
            >
              Activar plan ahora
            </button>
          </div>
        )}

        <main className="p-4 pb-14 lg:px-10 lg:py-6 lg:pb-14">
          <TerminosProvider terminos={null}>
            <Outlet />
          </TerminosProvider>
        </main>
      </div>

      {/* Payment modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !paySaving && setShowPayModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            {paySuccess ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <span className="text-emerald-600 text-2xl">✓</span>
                </div>
                <h3 className="text-lg font-bold text-stone-900 mb-1">¡Ahora eres parte de Kudi Pro!</h3>
                <p className="text-sm text-[#16A34A] font-semibold mb-2">Tu plan {PAY_PLANS[payPlan]?.label} ha iniciado</p>
                <p className="text-xs text-stone-500 mb-1">
                  Se te enviará un recordatorio de pago todos los {new Date(Date.now() + 86400000).toLocaleDateString('es-PE', { day: 'numeric', month: 'long' })} de cada mes.
                </p>
                <div className="bg-stone-50 rounded-xl px-4 py-3 mt-3 mb-4">
                  <p className="text-xs text-stone-500">
                    Estaremos validando tu pago en el transcurso del día. Cualquier detalle nos pondremos en contacto con usted.
                  </p>
                </div>
                <button onClick={() => { setShowPayModal(false); setPaySuccess(false); setPayComprobante(''); }} className="px-6 py-2.5 bg-[#16A34A] text-white font-semibold rounded-lg text-sm">
                  Comenzar a usar Kudi Pro
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-stone-900">Pagar plan</h3>
                  <button onClick={() => setShowPayModal(false)} className="text-stone-400 hover:text-stone-600">
                    <X size={18} />
                  </button>
                </div>

                {/* Plan selector */}
                <div className="grid grid-cols-3 gap-1.5 mb-4">
                  {Object.entries(PAY_PLANS).map(([key, p]) => (
                    <button
                      key={key}
                      onClick={() => setPayPlan(key)}
                      className={`py-2 px-1 rounded-lg border text-center transition-colors duration-100 ${
                        payPlan === key
                          ? 'border-[#16A34A] bg-emerald-50 text-[#16A34A]'
                          : 'border-stone-200 text-stone-500 hover:border-stone-300'
                      }`}
                    >
                      <p className="text-[10px] font-medium">{p.label}</p>
                      <p className="text-sm font-bold">S/{p.precio}</p>
                    </button>
                  ))}
                </div>

                {/* QR */}
                <div className="flex justify-center mb-3">
                  <img src="/yape-qr.jpg" alt="QR Yape" className="w-64 h-64 rounded-xl border border-stone-200 object-contain" />
                </div>
                <p className="text-center text-sm text-stone-600 mb-4">
                  Escanea con Yape y paga <span className="font-bold text-[#16A34A] text-lg">S/ {PAY_PLANS[payPlan]?.precio}</span> <span className="text-stone-400">/ mes</span>
                </p>

                {/* Upload */}
                <label className="block cursor-pointer mb-4">
                  {payComprobante ? (
                    <div className="relative">
                      <img src={payComprobante} className="w-full max-h-32 object-contain rounded-xl border border-emerald-300" alt="" />
                      <span className="absolute top-2 right-2 bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-full">Subido</span>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-stone-300 rounded-xl p-4 text-center hover:border-stone-400 transition-colors">
                      {payUploading ? (
                        <div className="flex items-center justify-center gap-2 text-stone-500 text-sm">
                          <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                          Subiendo...
                        </div>
                      ) : (
                        <p className="text-sm text-stone-500">Subir comprobante de pago</p>
                      )}
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handlePayUpload} />
                </label>

                {payError && (
                  <div className="text-rose-600 text-xs bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                    {payError}
                  </div>
                )}

                <button
                  onClick={handlePaySubmit}
                  disabled={paySaving || !payComprobante}
                  className="w-full py-3 bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold rounded-lg text-sm disabled:opacity-40 transition-colors duration-100 flex items-center justify-center gap-2"
                >
                  {paySaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Confirmar pago'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
