export const INSUMOS_STEPS = [
  {
    id: 'intro',
    title: 'Registra tus ingredientes',
    message: 'Antes de costear un producto, necesitas tener tus ingredientes con sus precios. ¡Es rápido!',
    expression: 'eureka',
    position: 'center',
    route: '/insumos',
  },
  {
    id: 'click-nuevo',
    target: '#btn-nuevo-insumo',
    title: 'Crea tu primer ingrediente',
    message: 'Haz clic en "Nuevo Insumo" para empezar.',
    expression: 'atencion',
    position: 'bottom',
    route: '/insumos',
    waitFor: 'click',
  },
  {
    id: 'fill-data',
    target: '#insumo-form',
    title: 'Llena los datos del ingrediente',
    message: 'Te puse un ejemplo: Harina, 1000g a S/ 5.00. Puedes cambiarlo o dejarlo así y darle Siguiente.',
    expression: 'todoBien',
    position: 'bottom',
    prefill: {
      '#insumo-nombre': 'Harina',
      '#insumo-cantidad': '1000',
      '#insumo-precio': '5.00',
    },
  },
  {
    id: 'save-hint',
    target: '#insumo-save',
    title: 'Guarda el ingrediente',
    message: 'Haz clic en el botón de guardar para registrarlo.',
    expression: 'eureka',
    position: 'top',
    waitFor: 'click',
  },
  {
    id: 'tip',
    title: 'Tip: agrega más ingredientes',
    message: 'Repite el proceso para tus ingredientes principales: azúcar, huevos, mantequilla, leche... No necesitas todos ahora, puedes agregar más después.',
    expression: 'pensando',
    position: 'center',
  },
  {
    id: 'done',
    title: '¡Ingredientes listos!',
    message: 'Ahora registra tus materiales de empaque.',
    expression: 'celebrando',
    position: 'center',
    action: { label: 'Ir a Materiales →', route: '/materiales' },
  },
];

export const ONBOARDING_INSUMOS = INSUMOS_STEPS;
