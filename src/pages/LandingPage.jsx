import { useState, useEffect, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useScrollReveal, useScrollRevealAll } from '../hooks/useScrollReveal';
import {
  ChefHat, Gem, Sparkles, CakeSlice, Flame, Scissors,
  Calculator, FileText, ShoppingCart, Package, BarChart3, Link2,
  Check, X, ArrowRight, Menu, X as XIcon
} from 'lucide-react';
import '../styles/landing.css';

/* ─── K Logo SVG (inline) ─── */
const KLogo = ({ className = '' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="8" fill="#0A2F24" />
    <path d="M10 8h4v6.5L20.5 8H25l-7 7.5L25.5 24H21l-5.5-6.5L14 19v5h-4V8z" fill="white" />
  </svg>
);

/* ─── Data ─── */
const businessTypes = [
  { name: 'Panaderias', icon: ChefHat },
  { name: 'Joyerias', icon: Gem },
  { name: 'Cosmeticos', icon: Sparkles },
  { name: 'Pastelerias', icon: CakeSlice },
  { name: 'Velas artesanales', icon: Flame },
  { name: 'Confeccion', icon: Scissors },
];

const features = [
  { icon: Calculator, title: 'Costeo de produccion', desc: 'Sabe exactamente cuanto te cuesta producir cada producto. Recetas, insumos, empaque y margen en tiempo real.', span: 2, visual: 'Slider de margen: Costo S/3.20 → Precio S/8.90 → Ganancia S/3.81' },
  { icon: FileText, title: 'Facturacion SUNAT', desc: 'Emite boletas y facturas electronicas en 2 clicks. Conectado a SUNAT, con serie y correlativo automatico.', span: 1, visual: 'Comprobante B001-00047 — Aceptado ✓' },
  { icon: ShoppingCart, title: 'Punto de Venta (POS)', desc: 'Tu caja registradora inteligente. Grid de productos, carrito, checkout con DNI/RUC y busqueda RENIEC.', span: 1, visual: 'Grid de productos + Carrito lateral' },
  { icon: Package, title: 'Inventario inteligente', desc: 'Control de stock con variantes, ubicaciones multiples y alertas de bajo stock. Todo en tiempo real.', span: 2, visual: 'Semaforo: OK ● | Bajo ● | Agotado ●' },
  { icon: BarChart3, title: 'Estado de resultados', desc: 'Tu P&L completo sin ser contador. Ingresos, costos, gastos, utilidad neta y punto de equilibrio.', span: 1, visual: 'Utilidad Neta: +S/ 4,250.00' },
  { icon: Link2, title: 'Shopify + integraciones', desc: 'Sincroniza productos, stock y ordenes con Shopify automaticamente. Cada 5 minutos, sin esfuerzo.', span: 1, visual: 'Shopify ↔ Kudi: 363 productos sync' },
];

const steps = [
  { title: 'Registra tus insumos y recetas', desc: 'Agrega tus insumos, materiales y el proceso de produccion de cada producto.' },
  { title: 'Costea con margen real', desc: 'El sistema calcula tu costo real y te sugiere un precio con el margen que necesitas.' },
  { title: 'Vende, factura y controla', desc: 'POS, boletas SUNAT, control de stock e inventario. Todo en un solo lugar.' },
];

const plans = [
  {
    name: 'Emprendedor',
    price: 0,
    priceAnnual: 0,
    desc: 'Para empezar a costear tu negocio',
    cta: 'Empieza gratis',
    highlighted: false,
    features: [
      { text: 'Hasta 20 productos', included: true },
      { text: 'Costeo de produccion', included: true },
      { text: 'Control de stock basico', included: true },
      { text: '1 usuario', included: true },
      { text: 'Facturacion SUNAT', included: false },
      { text: 'Punto de Venta (POS)', included: false },
      { text: 'Shopify sync', included: false },
      { text: 'Variantes de producto', included: false },
    ],
  },
  {
    name: 'Profesional',
    price: 100,
    priceAnnual: 80,
    desc: 'Para negocios que facturan y venden',
    cta: 'Empieza ahora',
    highlighted: true,
    features: [
      { text: 'Productos ilimitados', included: true },
      { text: 'Costeo de produccion', included: true },
      { text: 'Control de stock completo', included: true },
      { text: 'Hasta 3 usuarios', included: true },
      { text: 'Facturacion SUNAT', included: true },
      { text: 'Punto de Venta (POS)', included: true },
      { text: 'Shopify sync', included: true },
      { text: 'Variantes de producto', included: true },
    ],
  },
  {
    name: 'Negocio',
    price: 180,
    priceAnnual: 144,
    desc: 'Para equipos y multiples sedes',
    cta: 'Contactar ventas',
    highlighted: false,
    features: [
      { text: 'Todo de Profesional', included: true },
      { text: 'Usuarios ilimitados', included: true },
      { text: 'Multi-sede', included: true },
      { text: 'Reportes avanzados', included: true },
      { text: 'Comisiones por vendedor', included: true },
      { text: 'API access', included: true },
      { text: 'Soporte dedicado', included: true },
      { text: 'Onboarding personalizado', included: true },
    ],
  },
];

/* ─── Component ─── */
export default function LandingPage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [scrolled, setScrolled] = useState(false);
  const [annual, setAnnual] = useState(false);
  const [priceChanging, setPriceChanging] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  const introRef = useRef(null);
  const textRef = useRef(null);
  const featuresRef = useRef(null);

  // Scroll reveal for features grid
  useScrollRevealAll(featuresRef);

  // If authenticated, redirect to dashboard
  if (token) return <Navigate to="/dashboard" replace />;

  /* ─── Scroll effects ─── */
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const vh = window.innerHeight;
      setScrolled(y > vh * 0.85);

      // JS fallback for browsers without scroll-timeline
      if (!CSS.supports?.('animation-timeline: scroll()')) {
        const progress = Math.min(y / vh, 1);
        const intro = introRef.current;
        const text = textRef.current;
        if (!intro || !text) return;

        if (progress >= 1) {
          intro.style.opacity = '0';
          intro.style.pointerEvents = 'none';
        } else {
          intro.style.opacity = '1';
          intro.style.clipPath = `inset(0 ${progress * (window.innerWidth - 200)}px ${progress * (vh - 64)}px 0)`;

          const fontSize = Math.max(12 - progress * 10.5, 1.5);
          text.style.fontSize = `${fontSize}rem`;
          text.style.left = `${50 - progress * 48.5}%`;
          text.style.top = `${50 - progress * 48.875}%`;
          text.style.transform = `translate(${-50 + progress * 50}%, ${-50 + progress * 50}%)`;
          text.style.opacity = progress > 0.7 ? `${1 - (progress - 0.7) / 0.3}` : '1';
        }
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ─── Price toggle ─── */
  const toggleAnnual = () => {
    setPriceChanging(true);
    setTimeout(() => {
      setAnnual(a => !a);
      setTimeout(() => setPriceChanging(false), 50);
    }, 200);
  };

  const goLogin = () => navigate('/login');
  const goRegistro = () => navigate('/onboarding');
  const scrollTo = (id) => {
    setMobileMenu(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="landing-page">

      {/* ═══ LOGO INTRO ═══ */}
      <div className="landing-intro" ref={introRef} aria-hidden="true">
        <span className="landing-intro__text" ref={textRef}>kudi</span>
      </div>

      {/* ═══ NAVBAR (appears after scroll) ═══ */}
      <nav className={`landing-nav ${scrolled ? 'landing-nav--visible' : ''}`}>
        <button onClick={() => scrollTo('hero')} className="flex items-center gap-2">
          <KLogo className="w-8 h-8" />
          <span className="text-white font-bold text-lg hidden sm:inline">kudi</span>
        </button>
        <div className="hidden md:flex items-center gap-6">
          <button onClick={() => scrollTo('features')} className="text-white/60 hover:text-white text-sm transition-colors duration-150">Funcionalidades</button>
          <button onClick={() => scrollTo('pricing')} className="text-white/60 hover:text-white text-sm transition-colors duration-150">Precios</button>
          <button onClick={goLogin} className="text-white/60 hover:text-white text-sm transition-colors duration-150">Iniciar sesion</button>
          <button onClick={goRegistro} className="px-5 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-semibold rounded-lg transition-colors duration-150 active:scale-[0.97]">
            Empieza gratis
          </button>
        </div>
        <button onClick={() => setMobileMenu(!mobileMenu)} className="md:hidden text-white p-2">
          {mobileMenu ? <XIcon size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileMenu && scrolled && (
        <div className="fixed inset-0 z-30 bg-[#0A2F24]/95 backdrop-blur-lg flex flex-col items-center justify-center gap-6 pt-16">
          <button onClick={() => scrollTo('features')} className="text-white text-lg">Funcionalidades</button>
          <button onClick={() => scrollTo('pricing')} className="text-white text-lg">Precios</button>
          <button onClick={goLogin} className="text-white text-lg">Iniciar sesion</button>
          <button onClick={goRegistro} className="px-8 py-3 bg-[#16A34A] text-white font-semibold rounded-xl text-lg mt-4">
            Empieza gratis
          </button>
        </div>
      )}

      {/* ═══ SPACER (for intro scroll zone) ═══ */}
      <div style={{ height: '100vh' }} />

      {/* ═══ HERO ═══ */}
      <section id="hero" className="relative py-20 lg:py-32" style={{ background: 'linear-gradient(180deg, #0A2F24 0%, #0A2F24 40%, #F0FDF4 100%)' }}>
        <div className="max-w-6xl mx-auto px-6 flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          {/* Text */}
          <div className="flex-1 text-center lg:text-left">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-extrabold text-white leading-tight tracking-tight">
              Todo lo que necesitas para{' '}
              <span className="text-[#4ADE80]">costear, vender</span>{' '}
              y crecer
            </h1>
            <p className="mt-6 text-base lg:text-lg text-white/50 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Costeo de produccion + Facturacion SUNAT + Inventario + POS en una sola herramienta. Hecho para productores peruanos.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <button onClick={goRegistro} className="px-8 py-3.5 bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold rounded-xl text-base transition-colors duration-150 active:scale-[0.97] shadow-lg shadow-green-900/20 flex items-center justify-center gap-2">
                Empieza gratis <ArrowRight size={18} />
              </button>
              <button onClick={() => scrollTo('pricing')} className="px-8 py-3.5 border border-white/20 text-white hover:bg-white/10 font-semibold rounded-xl text-base transition-colors duration-150">
                Ver planes
              </button>
            </div>
            <p className="mt-4 text-xs text-white/30">Sin tarjeta de credito. Configura en 5 minutos.</p>
          </div>

          {/* Screenshot */}
          <div className="flex-1 relative max-w-lg w-full">
            <div className="landing-hero__glow" />
            <div className="landing-hero__screenshot">
              <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-white/10">
                {/* Simulated POS screenshot */}
                <div className="bg-[#F4F5F5] p-4">
                  <div className="flex gap-2 mb-3">
                    <div className="w-16 h-5 bg-[#16A34A] rounded-full" />
                    <div className="w-12 h-5 bg-stone-200 rounded-full" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[1,2,3,4,5,6].map(i => (
                      <div key={i} className="bg-white rounded-lg p-2 shadow-sm">
                        <div className={`h-12 rounded mb-1.5 ${i % 3 === 0 ? 'bg-amber-100' : i % 2 === 0 ? 'bg-emerald-100' : 'bg-sky-100'}`} />
                        <div className="h-2 bg-stone-200 rounded w-3/4 mb-1" />
                        <div className="h-2 bg-[#16A34A]/20 rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white p-3 border-t border-stone-100">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="h-2 bg-stone-200 rounded w-20 mb-1" />
                      <div className="h-3 bg-[#16A34A] rounded w-16" />
                    </div>
                    <div className="px-4 py-1.5 bg-[#16A34A] rounded-lg">
                      <span className="text-white text-xs font-bold">Cobrar</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SOCIAL PROOF ═══ */}
      <section className="bg-[#F0FDF4] py-10 border-y border-emerald-100">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-center text-stone-500 text-sm mb-6 font-medium">
            Hecho para panaderias, joyerias, cosmeticos y mas
          </p>
          <div className="landing-social-scroll flex gap-6 sm:gap-10 justify-start sm:justify-center overflow-x-auto px-4">
            {businessTypes.map(b => (
              <div key={b.name} className="flex flex-col items-center gap-2 flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-white border border-emerald-200 flex items-center justify-center shadow-sm">
                  <b.icon size={20} className="text-[#16A34A]" />
                </div>
                <span className="text-xs text-stone-600 font-medium whitespace-nowrap">{b.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FEATURES BENTO GRID ═══ */}
      <section id="features" className="py-20 lg:py-28 bg-[#FAFAFA]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0A2F24] tracking-tight">
              Una herramienta, todo tu negocio
            </h2>
            <p className="mt-3 text-stone-500 max-w-lg mx-auto">
              Desde la receta hasta la boleta. Kudi cubre cada paso de tu operacion.
            </p>
          </div>
          <div ref={featuresRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <div
                key={f.title}
                className={`landing-reveal landing-feature-card bg-white border border-stone-200 rounded-2xl p-6 overflow-hidden ${f.span === 2 ? 'md:col-span-2 lg:col-span-2' : ''}`}
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F0FDF4] flex items-center justify-center flex-shrink-0">
                    <f.icon size={20} className="text-[#16A34A]" />
                  </div>
                  <h3 className="text-lg font-bold text-[#0A2F24]">{f.title}</h3>
                </div>
                <p className="text-sm text-stone-500 leading-relaxed mb-4">{f.desc}</p>
                <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
                  <p className="text-xs text-stone-400 font-medium text-center">{f.visual}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <HowItWorksSection steps={steps} />

      {/* ═══ PRICING ═══ */}
      <section id="pricing" className="py-20 lg:py-28 bg-[#F0FDF4]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0A2F24] tracking-tight">
              Planes simples, sin sorpresas
            </h2>
            <p className="mt-3 text-stone-500">
              Empieza gratis. Escala cuando quieras.
            </p>

            {/* Toggle */}
            <div className="flex items-center justify-center gap-3 mt-8">
              <span className={`text-sm font-medium ${!annual ? 'text-[#0A2F24]' : 'text-stone-400'}`}>Mensual</span>
              <button className="landing-toggle" onClick={toggleAnnual} aria-label="Toggle annual pricing">
                <span className={`landing-toggle__dot ${annual ? 'landing-toggle__dot--annual' : ''}`} />
              </button>
              <span className={`text-sm font-medium ${annual ? 'text-[#0A2F24]' : 'text-stone-400'}`}>
                Anual
                <span className="ml-1.5 inline-block px-2 py-0.5 bg-[#16A34A] text-white text-[10px] font-bold rounded-full align-middle">
                  -20%
                </span>
              </span>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-6 lg:items-start justify-center">
            {plans.map(plan => (
              <div
                key={plan.name}
                className={`flex-1 max-w-sm mx-auto lg:mx-0 bg-white rounded-2xl p-7 relative ${
                  plan.highlighted
                    ? 'border-2 border-[#16A34A] shadow-xl shadow-green-900/10 lg:scale-105 lg:-my-2 z-10'
                    : 'border border-stone-200'
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#16A34A] text-white text-[11px] font-bold rounded-full whitespace-nowrap">
                    Mas popular
                  </div>
                )}
                <h3 className="text-lg font-bold text-[#0A2F24]">{plan.name}</h3>
                <p className="text-xs text-stone-400 mt-1">{plan.desc}</p>

                <div className="mt-5 mb-6">
                  <span className={`landing-price text-4xl font-extrabold text-[#0A2F24] ${priceChanging ? 'landing-price--changing' : ''}`}>
                    S/ {annual ? plan.priceAnnual : plan.price}
                  </span>
                  <span className="text-stone-400 text-sm ml-1">/mes</span>
                  {annual && plan.price > 0 && (
                    <p className="text-xs text-[#16A34A] mt-1 font-medium">
                      Ahorras S/ {(plan.price - plan.priceAnnual) * 12}/ano
                    </p>
                  )}
                </div>

                <button
                  onClick={goRegistro}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors duration-150 active:scale-[0.97] ${
                    plan.highlighted
                      ? 'bg-[#16A34A] hover:bg-[#15803D] text-white shadow-sm'
                      : 'bg-white hover:bg-stone-50 border border-stone-300 text-stone-700'
                  }`}
                >
                  {plan.cta}
                </button>

                <ul className="mt-6 space-y-2.5">
                  {plan.features.map(f => (
                    <li key={f.text} className="flex items-center gap-2.5 text-sm">
                      {f.included
                        ? <Check size={15} className="text-[#16A34A] flex-shrink-0" />
                        : <X size={15} className="text-stone-300 flex-shrink-0" />
                      }
                      <span className={f.included ? 'text-stone-700' : 'text-stone-400'}>{f.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TESTIMONIALS (placeholder) ═══ */}
      <TestimonialsSection />

      {/* ═══ FINAL CTA ═══ */}
      <section className="py-20 lg:py-28 relative overflow-hidden" style={{ background: '#0A2F24' }}>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(22,163,74,0.12) 0%, transparent 70%)' }} />
        <div className="relative max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
            Empieza a costear gratis hoy
          </h2>
          <p className="mt-4 text-white/40 max-w-md mx-auto">
            Sin tarjeta de credito. Configura tu negocio en 5 minutos y descubre cuanto te cuesta producir cada producto.
          </p>
          <button
            onClick={goRegistro}
            className="mt-8 px-10 py-4 bg-[#16A34A] hover:bg-[#15803D] text-white font-bold rounded-xl text-lg transition-colors duration-150 active:scale-[0.97] shadow-lg shadow-green-900/30 inline-flex items-center gap-2"
          >
            Crear cuenta gratis <ArrowRight size={20} />
          </button>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="py-12 bg-[#071E17]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <KLogo className="w-8 h-8" />
                <span className="text-white font-bold text-lg">kudi</span>
              </div>
              <p className="text-white/30 text-sm leading-relaxed">
                Orden financiero que impulsa tu crecimiento.
              </p>
            </div>

            {/* Producto */}
            <div>
              <h4 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">Producto</h4>
              <div className="space-y-2">
                <button onClick={() => scrollTo('features')} className="block text-white/40 hover:text-white text-sm transition-colors duration-150">Funcionalidades</button>
                <button onClick={() => scrollTo('pricing')} className="block text-white/40 hover:text-white text-sm transition-colors duration-150">Precios</button>
                <button onClick={goLogin} className="block text-white/40 hover:text-white text-sm transition-colors duration-150">Iniciar sesion</button>
              </div>
            </div>

            {/* Rubros */}
            <div>
              <h4 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">Para tu rubro</h4>
              <div className="space-y-2">
                <span className="block text-white/40 text-sm">Panaderias</span>
                <span className="block text-white/40 text-sm">Joyerias</span>
                <span className="block text-white/40 text-sm">Cosmeticos</span>
                <span className="block text-white/40 text-sm">Y 25+ rubros mas</span>
              </div>
            </div>

            {/* Contacto */}
            <div>
              <h4 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">Contacto</h4>
              <div className="space-y-2">
                <a href="https://wa.me/51987654321" target="_blank" rel="noopener noreferrer" className="block text-white/40 hover:text-white text-sm transition-colors duration-150">WhatsApp</a>
                <a href="https://instagram.com/kudi.pe" target="_blank" rel="noopener noreferrer" className="block text-white/40 hover:text-white text-sm transition-colors duration-150">Instagram</a>
                <a href="mailto:hola@kudi.pe" className="block text-white/40 hover:text-white text-sm transition-colors duration-150">hola@kudi.pe</a>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-2">
            <p className="text-white/20 text-xs">Hecho con amor en Lima, Peru</p>
            <p className="text-white/20 text-xs">&copy; 2026 Nodum Studio. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─── Sub-components ─── */

function HowItWorksSection({ steps }) {
  const ref = useRef(null);
  useScrollRevealAll(ref);

  return (
    <section className="py-20 lg:py-28 bg-[#0A2F24] relative overflow-hidden">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 50%, rgba(22,163,74,0.08) 0%, transparent 60%)' }} />
      <div className="relative max-w-5xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
            Como funciona
          </h2>
          <p className="mt-3 text-white/40">En 3 pasos simples</p>
        </div>
        <div ref={ref} className="flex flex-col lg:flex-row gap-10 lg:gap-6">
          {steps.map((step, i) => (
            <div key={i} className="landing-reveal landing-step flex-1 text-center lg:text-left relative" style={{ transitionDelay: `${i * 120}ms` }}>
              <div className="w-12 h-12 rounded-full bg-[#16A34A] flex items-center justify-center mx-auto lg:mx-0 mb-4 shadow-lg shadow-green-900/30">
                <span className="text-white font-bold text-lg">{i + 1}</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
              <p className="text-sm text-white/40 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  const ref = useRef(null);
  useScrollRevealAll(ref);

  const testimonials = [
    { business: 'Panaderia Artesanal', location: 'Lima, Peru', type: ChefHat },
    { business: 'Joyeria Once', location: 'Lima, Peru', type: Gem },
    { business: 'Cosmeticos Naturales', location: 'Arequipa, Peru', type: Sparkles },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-5xl mx-auto px-6">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0A2F24] text-center mb-12 tracking-tight">
          Lo que dicen nuestros usuarios
        </h2>
        <div ref={ref} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div key={i} className="landing-reveal bg-stone-50 border border-stone-200 rounded-2xl p-6" style={{ transitionDelay: `${i * 100}ms` }}>
              <div className="flex gap-0.5 mb-4">
                {[1,2,3,4,5].map(s => (
                  <span key={s} className="text-amber-400 text-sm">&#9733;</span>
                ))}
              </div>
              <p className="text-sm text-stone-500 italic mb-5 leading-relaxed">
                "Proximamente compartiremos las historias de nuestros usuarios."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#F0FDF4] flex items-center justify-center">
                  <t.type size={18} className="text-[#16A34A]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#0A2F24]">{t.business}</p>
                  <p className="text-xs text-stone-400">{t.location}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
