export const BIENVENIDA_STEPS = [
  {
    id: 'welcome',
    title: '¡Bienvenido a Kudi!',
    message: 'Soy Kudi, tu asistente. Te voy a ayudar a dominar tu negocio paso a paso.',
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
    message: 'Aprende a costear tu primer producto, vender y más.',
    expression: 'celebrando',
    position: 'center',
    action: { label: 'Ir a Tutoriales →', route: '/tutoriales' },
  },
];

// Backward compat
export const ONBOARDING_STEPS = BIENVENIDA_STEPS;
