export function buildBienvenida(user) {
  const nombre = user?.nombre?.split(' ')[0] || '';
  const negocio = user?.nombre_comercial || user?.empresa || 'tu negocio';

  return [
    {
      id: 'welcome',
      title: nombre ? `¡Hola ${nombre}!` : '¡Bienvenido a Kudi!',
      message: `Soy Kudi, tu asistente en ${negocio}. Te voy a ayudar a costear, vender y crecer paso a paso.`,
      expression: 'saludo',
      position: 'center',
    },
    {
      id: 'sidebar',
      target: '#sidebar',
      title: 'Tu menú',
      message: 'Desde aquí navegas por toda la plataforma: catálogo, ventas, finanzas y más.',
      expression: 'atencion',
      position: 'right',
    },
    {
      id: 'next-step',
      title: '¿Listo para empezar?',
      message: 'El primer paso es registrar tus ingredientes. ¡Vamos!',
      expression: 'celebrando',
      position: 'center',
      action: { label: 'Registrar mis ingredientes →', route: '/tutoriales' },
    },
  ];
}

// Backward compat — static version for imports that expect an array
export const BIENVENIDA_STEPS = buildBienvenida({});
export const ONBOARDING_STEPS = BIENVENIDA_STEPS;
