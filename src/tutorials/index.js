import { BIENVENIDA_STEPS, ONBOARDING_STEPS } from './onboarding';
import { PRIMER_PRODUCTO_STEPS } from './primer-producto';
import { POS_STEPS } from './pos';
import { INSUMOS_STEPS } from './insumos';
import { MATERIALES_STEPS } from './materiales';
import { COMPRAS_STEPS } from './compras';
import { FINANZAS_STEPS } from './finanzas';

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
  {
    id: 'compras',
    title: 'Registra tus compras',
    description: 'Aprende a registrar compras para mantener tus costos actualizados.',
    expression: 'atencion',
    steps: COMPRAS_STEPS,
    route: '/pl/compras',
    requires: [{ tutorial: 'primer-producto' }],
  },
  {
    id: 'pos',
    title: 'Haz tu primera venta',
    description: 'Aprende a usar la Caja para vender tus productos.',
    expression: 'todoBien',
    steps: POS_STEPS,
    route: '/pos',
    requires: [{ tutorial: 'primer-producto' }],
  },
  {
    id: 'finanzas',
    title: 'Ve tus finanzas',
    description: 'Entiende tu Timeline, estado de resultados y flujo de caja.',
    expression: 'pensando',
    steps: FINANZAS_STEPS,
    route: '/pl',
    requires: [{ tutorial: 'pos' }],
  },
];
