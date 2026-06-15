import { BIENVENIDA_STEPS, ONBOARDING_STEPS } from './onboarding';
import { PRIMER_PRODUCTO_STEPS } from './primer-producto';
import { INSUMOS_STEPS } from './insumos';
import { MATERIALES_STEPS } from './materiales';

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
    id: 'insumos',
    title: 'Registra tus ingredientes',
    description: 'El primer paso: agrega tus ingredientes con precios para poder costear.',
    expression: 'eureka',
    steps: INSUMOS_STEPS,
    route: '/insumos',
  },
  {
    id: 'materiales',
    title: 'Registra tus materiales',
    description: 'Agrega los materiales de empaque que usas en tus productos.',
    expression: 'atencion',
    steps: MATERIALES_STEPS,
    route: '/materiales',
  },
  {
    id: 'primer-producto',
    title: 'Crea tu primer producto',
    description: 'Aprende a costear un producto paso a paso con tus ingredientes.',
    expression: 'eureka',
    steps: PRIMER_PRODUCTO_STEPS,
    route: '/cotizador',
  },
];
