import { ONBOARDING_STEPS } from './onboarding';

export const TUTORIALS = [
  {
    id: 'onboarding',
    title: 'Tour por Kudi',
    description: 'Conoce las secciones principales de la plataforma.',
    expression: 'saludo',
    steps: ONBOARDING_STEPS,
    route: '/dashboard',
  },
  // Próximos tutoriales:
  // { id: 'pos', title: 'Cómo usar la Caja', description: '...', expression: 'eureka', steps: POS_STEPS, route: '/pos' },
  // { id: 'facturacion', title: 'Facturación electrónica', description: '...', expression: 'atencion', steps: FACTURACION_STEPS, route: '/comprobantes' },
  // { id: 'costeo', title: 'Costea tu primer producto', description: '...', expression: 'eureka', steps: COSTEO_STEPS, route: '/cotizador' },
];
