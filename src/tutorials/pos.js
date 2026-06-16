export const POS_STEPS = [
  // Step 1: Intro
  {
    id: 'intro',
    title: 'Haz tu primera venta',
    message: 'Vamos a usar la Caja para vender el producto que acabas de crear. ¡Es súper fácil!',
    expression: 'eureka',
    position: 'center',
    route: '/pos',
  },
  // Step 2: Open caja (conditional — only relevant if caja not open)
  // Since we can't conditionally skip steps yet, make it informational
  {
    id: 'abrir-caja',
    target: '#pos-abrir-caja',
    title: 'Abre tu caja',
    message: 'Si ves un banner de "Caja no abierta", haz clic en "Abrir caja" y pon un monto inicial (puede ser 0). Si ya está abierta, pasa al siguiente.',
    expression: 'atencion',
    position: 'bottom',
    route: '/pos',
    allowInteraction: true,
  },
  // Step 3: Product grid
  {
    id: 'products',
    target: '#pos-products',
    title: 'Selecciona un producto',
    message: 'Busca tu producto y haz clic en él para agregarlo al carrito. Puedes agregar varios.',
    expression: 'todoBien',
    position: 'right',
    allowInteraction: true,
  },
  // Step 4: Cart
  {
    id: 'cart',
    target: '#pos-cart',
    title: 'Tu carrito',
    message: 'Aquí ves lo que vas a vender. Puedes ajustar cantidades, agregar descuentos o eliminar items.',
    expression: 'atencion',
    position: 'left',
    allowInteraction: true,
  },
  // Step 5: Cobrar
  {
    id: 'cobrar',
    target: '#pos-cobrar',
    title: '¡A cobrar!',
    message: 'Cuando tengas todo listo, haz clic en "Cobrar" para ir al checkout.',
    expression: 'eureka',
    position: 'top',
    waitFor: 'click',
  },
  // Step 6: Payment method
  {
    id: 'metodo-pago',
    target: '#pos-metodos',
    title: 'Método de pago',
    message: 'Selecciona cómo te pagaron: efectivo, Yape, transferencia o tarjeta.',
    expression: 'todoBien',
    position: 'top',
    allowInteraction: true,
  },
  // Step 7: Confirm
  {
    id: 'confirmar',
    target: '#pos-confirmar',
    title: 'Confirma la venta',
    message: 'Revisa el total y haz clic en "Confirmar venta". ¡Tu primera venta quedará registrada!',
    expression: 'celebrando',
    position: 'top',
    waitFor: 'click',
  },
  // Step 8: Done
  {
    id: 'done',
    title: '¡Venta registrada!',
    message: '¡Felicidades! Tu primera venta está hecha. Puedes emitir una boleta o seguir vendiendo. Ve tus finanzas para ver cómo crece tu negocio.',
    expression: 'celebrando',
    position: 'center',
    action: { label: 'Ver mis finanzas →', route: '/pl', startTutorial: 'finanzas' },
  },
];
