import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { cx } from '../styles/tokens';
import CustomSelect from '../components/CustomSelect';
import { Send, MessageSquare, CheckCircle } from 'lucide-react';

const TIPOS = [
  { value: 'sugerencia', label: 'Sugerencia' },
  { value: 'mejora', label: 'Mejora' },
  { value: 'bug', label: 'Reportar problema' },
  { value: 'otro', label: 'Otro' },
];

const ESTADO_COLORS = {
  nuevo: 'bg-blue-50 text-blue-600',
  visto: 'bg-amber-50 text-amber-600',
  resuelto: 'bg-emerald-50 text-emerald-600',
};

export default function FeedbackPage() {
  const api = useApi();
  const toast = useToast();
  const [tipo, setTipo] = useState('sugerencia');
  const [mensaje, setMensaje] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/feedback')
      .then(r => setItems(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSend = async () => {
    if (!mensaje.trim()) return;
    setSending(true);
    try {
      await api.post('/feedback', { tipo, mensaje: mensaje.trim() });
      toast.success('Feedback enviado');
      setMensaje('');
      setSent(true);
      setTimeout(() => setSent(false), 3000);
      const r = await api.get('/feedback');
      setItems(r.data || []);
    } catch (err) {
      toast.error(err.message || 'Error enviando feedback');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto pb-12">
      <h1 className="text-xl font-bold text-stone-900 mb-5">Feedback y sugerencias</h1>

      {/* Send feedback */}
      <div className={cx.card + ' p-5 mb-6'}>
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare size={18} className="text-[#16A34A]" />
          <h2 className="text-sm font-semibold text-stone-800">Cuéntanos qué podemos mejorar</h2>
        </div>

        <div className="space-y-3">
          <div>
            <label className={cx.label}>Tipo</label>
            <CustomSelect
              options={TIPOS}
              value={tipo}
              onChange={v => setTipo(v)}
              compact
            />
          </div>
          <div>
            <label className={cx.label}>Tu mensaje</label>
            <textarea
              value={mensaje}
              onChange={e => setMensaje(e.target.value)}
              className={cx.input + ' min-h-[100px] resize-y'}
              placeholder="Describe tu sugerencia, mejora o problema..."
              rows={4}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={sending || !mensaje.trim()}
            className={cx.btnPrimary + ' flex items-center gap-2'}
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : sent ? (
              <><CheckCircle size={14} /> Enviado</>
            ) : (
              <><Send size={14} /> Enviar feedback</>
            )}
          </button>
        </div>
      </div>

      {/* Previous feedback */}
      {items.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3">Tu historial</h2>
          <div className="space-y-2">
            {items.map(f => (
              <div key={f.id} className={cx.card + ' p-4'}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className={cx.badge(ESTADO_COLORS[f.estado] || 'bg-stone-100 text-stone-500')}>{f.estado}</span>
                    <span className={cx.badge('bg-stone-100 text-stone-500')}>{f.tipo}</span>
                  </div>
                  <span className="text-[10px] text-stone-400">{new Date(f.created_at).toLocaleDateString('es-PE')}</span>
                </div>
                <p className="text-sm text-stone-700 mt-2">{f.mensaje}</p>
                {f.nota_admin && (
                  <div className="mt-2 bg-emerald-50 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-emerald-600 font-semibold mb-0.5">Respuesta del equipo</p>
                    <p className="text-xs text-emerald-800">{f.nota_admin}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
