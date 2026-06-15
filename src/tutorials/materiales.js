export const MATERIALES_STEPS = [
  {
    id: 'intro',
    title: 'Registra tus materiales',
    message: 'Los materiales son todo lo que usas para empacar: cajas, bolsas, etiquetas, cintas...',
    expression: 'atencion',
    position: 'center',
    route: '/materiales',
  },
  {
    id: 'click-nuevo',
    target: '#btn-nuevo-material',
    title: 'Crea tu primer material',
    message: 'Haz clic para agregar un material de empaque.',
    expression: 'eureka',
    position: 'bottom',
    route: '/materiales',
    waitFor: 'click',
  },
  {
    id: 'fill-data',
    title: 'Llena los datos',
    message: 'Nombre del material, cantidad por paquete y precio. Por ejemplo: "Caja kraft", 50 unidades, S/ 25.00.',
    expression: 'todoBien',
    position: 'center',
    prefill: {
      '#material-nombre': 'Caja kraft',
    },
  },
  {
    id: 'done',
    title: '¡Materiales listos!',
    message: 'Ya tienes ingredientes y materiales. ¡Ahora sí, a crear tu primer producto!',
    expression: 'celebrando',
    position: 'center',
    action: { label: 'Crear mi primer producto →', route: '/cotizador' },
  },
];
