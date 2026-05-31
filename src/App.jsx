import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import DashboardPage from './pages/DashboardPage';
import CotizadorPage from './pages/CotizadorPage';
import InsumosPage from './pages/InsumosPage';
import MaterialesPage from './pages/MaterialesPage';
import PrepPredPage from './pages/PrepPredPage';
import EmpaquePredPage from './pages/EmpaquePredPage';
import PerfilPage from './pages/PerfilPage';
import AdminPage from './pages/AdminPage';
import AdminActividadPage from './pages/AdminActividadPage';
import ProyeccionPage from './pages/ProyeccionPage';
import ActividadPage from './pages/ActividadPage';
import PLTimelinePage from './pages/PLTimelinePage';
import PLResumenPage from './pages/PLResumenPage';
import PLVentasPage from './pages/PLVentasPage';
import PLGastosPage from './pages/PLGastosPage';
import PLComprasPage from './pages/PLComprasPage';
import PLCashflowPage from './pages/PLCashflowPage';
import PerdidasPage from './pages/PerdidasPage';
import ClientesPage from './pages/ClientesPage';
import ComprobantesPage from './pages/ComprobantesPage';
import FichaTecnicaPage from './pages/FichaTecnicaPage';
import PedidosPage from './pages/PedidosPage';
import EquipoPage from './pages/EquipoPage';
import CanalesPage from './pages/CanalesPage';
import AnalisisPage from './pages/AnalisisPage';
import StockPage from './pages/StockPage';
import ComisionesPage from './pages/ComisionesPage';
import ProveedoresPage from './pages/ProveedoresPage';
import ShopifyPage from './pages/ShopifyPage';
import POSPage from './pages/POSPage';
import FeedbackPage from './pages/FeedbackPage';
import NovedadesPage from './pages/NovedadesPage';
import LandingPage from './pages/LandingPage';


// Map routes to module names for usage tracking
const ROUTE_MODULES = {
  '/dashboard': 'Dashboard', '/cotizador': 'Cotizador', '/insumos': 'Insumos',
  '/materiales': 'Materiales', '/preparaciones-predeterminadas': 'Plantillas prep',
  '/empaques-predeterminados': 'Plantillas empaque', '/pos': 'Caja',
  '/pl': 'P&L', '/pl/ventas': 'Ventas', '/pl/gastos': 'Gastos',
  '/pl/compras': 'Compras', '/pl/cashflow': 'Cashflow', '/pl/resumen': 'Resumen P&L',
  '/stock': 'Stock', '/perdidas': 'Pérdidas', '/clientes': 'Clientes',
  '/pedidos': 'Pedidos', '/comprobantes': 'Facturación', '/analisis': 'Análisis',
  '/canales': 'Canales', '/comisiones': 'Comisiones', '/proveedores': 'Proveedores',
  '/shopify': 'Shopify', '/equipo': 'Equipo', '/perfil': 'Perfil',
  '/feedback': 'Feedback', '/novedades': 'Novedades',
};

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    // Track module usage (fire-and-forget)
    const basePath = '/' + pathname.split('/').filter(Boolean).slice(0, 2).join('/');
    const modulo = ROUTE_MODULES[basePath] || ROUTE_MODULES['/' + pathname.split('/')[1]];
    if (modulo) {
      const token = localStorage.getItem('nodum_token');
      if (token) {
        fetch((import.meta.env.VITE_API_BASE || 'https://cotizador-api.s6hx3x.easypanel.host/api') + '/track', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ modulo }),
        }).catch(() => {});
      }
    }
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <ToastProvider>
        <HashRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/" element={<Navigate to="/planes" replace />} />

            {/* Protected routes with layout */}
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/cotizador" element={<CotizadorPage />} />
              <Route path="/cotizador/:id" element={<CotizadorPage />} />
              <Route path="/insumos" element={<InsumosPage />} />
              <Route path="/materiales" element={<MaterialesPage />} />
              <Route path="/preparaciones-predeterminadas" element={<PrepPredPage />} />
              <Route path="/empaques-predeterminados" element={<EmpaquePredPage />} />
              <Route path="/proyeccion" element={<ProyeccionPage />} />
              <Route path="/actividad" element={<ActividadPage />} />
              <Route path="/pl" element={<PLTimelinePage />} />
              <Route path="/pl/resumen" element={<PLResumenPage />} />
              <Route path="/pos" element={<POSPage />} />
              <Route path="/pl/ventas" element={<PLVentasPage />} />
              <Route path="/pl/gastos" element={<PLGastosPage />} />
              <Route path="/pl/compras" element={<PLComprasPage />} />
              <Route path="/pl/cashflow" element={<PLCashflowPage />} />
              <Route path="/perdidas" element={<PerdidasPage />} />
              <Route path="/clientes" element={<ClientesPage />} />
              <Route path="/pedidos" element={<Navigate to="/pl/ventas" replace />} />
              <Route path="/comprobantes" element={<ComprobantesPage />} />
              <Route path="/ficha-tecnica/:id" element={<FichaTecnicaPage />} />
              <Route path="/analisis" element={<AnalisisPage />} />
              <Route path="/stock" element={<StockPage />} />
              <Route path="/comisiones" element={<ComisionesPage />} />
              <Route path="/proveedores" element={<ProveedoresPage />} />
              <Route path="/shopify" element={<ShopifyPage />} />

              <Route path="/canales" element={<CanalesPage />} />
              <Route path="/equipo" element={<EquipoPage />} />
              <Route path="/perfil" element={<PerfilPage />} />
              <Route path="/feedback" element={<FeedbackPage />} />
              <Route path="/novedades" element={<NovedadesPage />} />
            </Route>

            {/* Admin routes with layout */}
            <Route
              element={
                <AdminRoute>
                  <Layout />
                </AdminRoute>
              }
            >
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/admin/actividad" element={<AdminActividadPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </HashRouter>
      </ToastProvider>
    </AuthProvider>
    </ErrorBoundary>
  );
}
