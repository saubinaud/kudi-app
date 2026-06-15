import { BIENVENIDA_STEPS, ONBOARDING_STEPS } from './onboarding';
import { PRIMER_PRODUCTO_STEPS } from './primer-producto';

export const TUTORIALS = [
  {
    id: 'onboarding',
    title: 'Bienvenida a Kudi',
    description: 'Conoce a tu asistente y la estructura de la plataforma.',
    expression: 'saludo',
    steps: BIENVENIDA_STEPS,
    route: '/dashboard',
  },
  {
    id: 'primer-producto',
    title: 'Crea tu primer producto',
    description: 'Aprende a costear un producto paso a paso.',
    expression: 'eureka',
    steps: PRIMER_PRODUCTO_STEPS,
    route: '/dashboard',
  },
];
