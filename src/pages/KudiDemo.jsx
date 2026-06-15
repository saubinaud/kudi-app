import { useState } from 'react';
import KudiCharacter from '../components/KudiCharacter';
import { useTutorial } from '../hooks/useTutorial';

const EXPRESSIONS = [
  'saludo',
  'pensando',
  'eureka',
  'atencion',
  'todoBien',
  'alerta',
  'celebrando',
  'curioso',
];

const SIZES = [24, 32, 48, 64, 96, 120];

const LABELS = {
  saludo: 'Saludo',
  pensando: 'Pensando',
  eureka: '¡Eureka!',
  atencion: 'Atención',
  todoBien: 'Todo bien',
  alerta: 'Alerta',
  celebrando: 'Celebrando',
  curioso: 'Curioso',
};

const DESCRIPTIONS = {
  saludo: 'Bienvenida — ojos felices, mano saludando, tablet en la otra',
  pensando: 'Procesando — ojos mirando arriba, pose pensativa',
  eureka: 'Idea — ojos brillantes, dedo apuntando arriba, boca abierta',
  atencion: 'Neutro — mirando al frente, sonrisa suave',
  todoBien: 'Estado por defecto — relajado, sonrisa cálida',
  alerta: 'Preocupado — ojos de alerta, boca pequeña',
  celebrando: 'Logro — brazos arriba, sparkles dorados, ojos felices',
  curioso: 'Descubriendo — cabeza inclinada, ojos grandes',
};

const DEMO_STEPS = [
  {
    id: 'welcome',
    title: '¡Hola! Soy Kudi',
    message: 'Te voy a dar un tour rápido por mis expresiones. ¡Vamos!',
    expression: 'saludo',
    position: 'center',
  },
  {
    id: 'expressions',
    target: '#expression-grid',
    title: 'Mis expresiones',
    message: 'Tengo 8 expresiones diferentes. Cada una tiene un propósito distinto en la app.',
    expression: 'eureka',
    position: 'top',
  },
  {
    id: 'sizes',
    target: '#size-scale',
    title: 'Todos los tamaños',
    message: 'Me puedes usar desde 24px hasta 160px. Me adapto a cualquier contexto.',
    expression: 'todoBien',
    position: 'top',
  },
  {
    id: 'done',
    title: '¡Listo!',
    message: 'Ahora ya conoces a tu asistente. Me verás en tutoriales, empty states y mucho más.',
    expression: 'celebrando',
    position: 'center',
  },
];

export default function KudiDemo() {
  const [selected, setSelected] = useState('todoBien');
  const { start, resetTutorial } = useTutorial();

  return (
    <div
      style={{
        padding: '48px 40px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: '#FAFAF9',
        minHeight: '100vh',
        maxWidth: 960,
        margin: '0 auto',
      }}
    >
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: '#1C1917', marginBottom: 6, letterSpacing: '-0.02em' }}>
          KudiBot v4
        </h1>
        <p style={{ color: '#78716C', fontSize: 15, margin: '0 0 16px 0' }}>
          Renders 3D + framer-motion — 8 expresiones.
        </p>
        <button
          onClick={() => { resetTutorial('kudi-demo'); start('kudi-demo', DEMO_STEPS, { force: true }); }}
          style={{
            padding: '8px 18px',
            fontSize: 13,
            fontWeight: 600,
            color: 'white',
            background: '#16A34A',
            border: 'none',
            borderRadius: 10,
            cursor: 'pointer',
          }}
        >
          Iniciar tutorial demo
        </button>
      </div>

      {/* ── Large preview ── */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 24, marginBottom: 48 }}>
        <div
          style={{
            background: 'white',
            borderRadius: 20,
            padding: 48,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
          }}
        >
          <KudiCharacter expression={selected} size={160} animate />
        </div>

        <div
          style={{
            background: '#0F1F1A',
            borderRadius: 20,
            padding: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
          }}
        >
          <KudiCharacter expression={selected} size={160} animate />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 180 }}>
          <p style={{ fontSize: 22, fontWeight: 700, color: '#16A34A', margin: '0 0 4px 0' }}>
            {LABELS[selected]}
          </p>
          <p style={{ fontSize: 13, color: '#78716C', margin: '0 0 16px 0', lineHeight: 1.5 }}>
            {DESCRIPTIONS[selected]}
          </p>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 100, background: '#F0FDF4', color: '#16A34A', fontSize: 11, fontWeight: 600 }}>
              160px
            </span>
            <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 100, background: '#F5F5F4', color: '#78716C', fontSize: 11, fontWeight: 600 }}>
              3D render
            </span>
          </div>
        </div>
      </div>

      {/* ── Expression grid ── */}
      <h2 style={{ fontSize: 14, fontWeight: 600, color: '#A8A29E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
        Expresiones
      </h2>
      <div id="expression-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 48 }}>
        {EXPRESSIONS.map((exp) => {
          const isActive = selected === exp;
          return (
            <button
              key={exp}
              onClick={() => setSelected(exp)}
              style={{
                background: isActive ? '#F0FDF4' : 'white',
                border: isActive ? '2px solid #16A34A' : '1px solid #E7E5E4',
                borderRadius: 16,
                padding: '20px 12px 14px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
                transition: 'all 0.2s ease',
                boxShadow: isActive ? '0 0 0 3px rgba(22,163,74,0.08)' : '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              <KudiCharacter expression={exp} size={72} animate={false} />
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: isActive ? '#16A34A' : '#44403C', display: 'block', marginBottom: 2 }}>
                  {LABELS[exp]}
                </span>
                <span style={{ fontSize: 11, color: '#A8A29E' }}>{exp}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Size scale ── */}
      <h2 style={{ fontSize: 14, fontWeight: 600, color: '#A8A29E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
        Escala de tamaños
      </h2>
      <div
        id="size-scale"
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 28,
          background: 'white',
          borderRadius: 16,
          padding: '32px 28px 24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)',
          marginBottom: 48,
        }}
      >
        {SIZES.map((sz) => (
          <div key={sz} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <KudiCharacter expression={selected} size={sz} animate />
            <span style={{ fontSize: 11, color: '#A8A29E', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
              {sz}px
            </span>
          </div>
        ))}
      </div>

      {/* ── Usage ── */}
      <div
        style={{
          background: 'white',
          borderRadius: 16,
          padding: 28,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          fontSize: 13,
          color: '#57534E',
          lineHeight: 1.7,
        }}
      >
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1C1917', marginTop: 0, marginBottom: 12 }}>
          Uso en componentes
        </h3>
        <code
          style={{
            display: 'block',
            background: '#F5F5F4',
            borderRadius: 10,
            padding: 16,
            fontFamily: '"SF Mono", "Fira Code", monospace',
            fontSize: 12,
            color: '#44403C',
            whiteSpace: 'pre',
            overflowX: 'auto',
          }}
        >
{`<KudiCharacter expression="todoBien" size={48} />
<KudiCharacter expression="saludo" size={64} animate />
<KudiCharacter expression="eureka" size={32} />
<KudiCharacter expression="celebrando" size={120} animate />`}
        </code>
        <p style={{ marginTop: 16, marginBottom: 0, color: '#78716C' }}>
          Renders 3D preloaded (512px). Animaciones con framer-motion: float y crossfade entre expresiones.
        </p>
      </div>
    </div>
  );
}
