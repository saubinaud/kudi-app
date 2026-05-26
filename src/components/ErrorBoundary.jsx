import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ textAlign: 'center', maxWidth: '400px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>😵</div>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1c1917', marginBottom: '8px' }}>Algo salio mal</h2>
            <p style={{ fontSize: '14px', color: '#78716c', marginBottom: '20px', lineHeight: '1.5' }}>
              Hubo un error inesperado. Recarga la pagina para continuar.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#16A34A', color: '#fff', border: 'none', padding: '10px 24px',
                borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer'
              }}
            >
              Recargar pagina
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
