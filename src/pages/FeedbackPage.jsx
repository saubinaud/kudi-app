import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { cx } from '../styles/tokens';
import CustomSelect from '../components/CustomSelect';
import { Send, MessageSquare, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';

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
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  const loadItems = () => {
    api.get('/feedback')
      .then(r => setItems(r.data || []))
      .catch(() => toast.error('Error cargando datos'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadItems(); }, []);

  const handleSend = async () => {
    if (!mensaje.trim()) return;
    setSending(true);
    try {
      await api.post('/feedback', { tipo, mensaje: mensaje.trim() });
      toast.success('Feedback enviado');
      setMensaje('');
      loadItems();
    } catch (err) {
      toast.error(err.message || 'Error enviando feedback');
    } finally {
      setSending(false);
    }
  };

  const handleReply = async (feedbackId) => {
    if (!replyText.trim()) return;
    setReplying(true);
    try {
      await api.post(`/feedback/${feedbackId}/reply`, { mensaje: replyText.trim() });
      setReplyText('');
      loadItems();
    } catch (err) {
      toast.error(err.message || 'Error enviando mensaje');
    } finally {
      setReplying(false);
    }
  };

  const handleResolve = async (feedbackId) => {
    try {
      await api.post(`/feedback/${feedbackId}/resolve`);
      toast.success('Ticket cerrado');
      loadItems();
    } catch {}
  };

  return (
    <div className="max-w-2xl mx-auto pb-12">
      <h1 className="text-xl font-bold text-stone-900 mb-5">Feedback y sugerencias</h1>

      {/* New ticket form */}
      <div className={cx.card + ' p-5 mb-6'}>
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare size={18} className="text-[#16A34A]" />
          <h2 className="text-sm font-semibold text-stone-800">Nuevo ticket</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className={cx.label}>Tipo</label>
            <CustomSelect options={TIPOS} value={tipo} onChange={v => setTipo(v)} compact />
          </div>
          <div>
            <label className={cx.label}>Tu mensaje</label>
            <textarea
              value={mensaje}
              onChange={e => setMensaje(e.target.value)}
              className={cx.input + ' min-h-[80px] resize-y'}
              placeholder="Describe tu sugerencia, mejora o problema..."
              rows={3}
            />
          </div>
          <button onClick={handleSend} disabled={sending || !mensaje.trim()} className={cx.btnPrimary + ' flex items-center gap-2'}>
            {sending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send size={14} /> Enviar</>}
          </button>
        </div>
      </div>

      {/* Tickets */}
      {items.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3">Tus tickets</h2>
          <div className="space-y-2">
            {items.map(f => {
              const isOpen = expandedId === f.id;
              const replies = f.replies || [];
              const hasReplies = replies.length > 0 || f.nota_admin;
              return (
                <div key={f.id} className={cx.card + ' overflow-hidden'}>
                  {/* Header */}
                  <button
                    onClick={() => setExpandedId(isOpen ? null : f.id)}
                    className="w-full text-left p-4 hover:bg-stone-50 transition-colors duration-100"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={cx.badge(ESTADO_COLORS[f.estado] || 'bg-stone-100 text-stone-500')}>{f.estado}</span>
                          <span className={cx.badge('bg-stone-100 text-stone-500')}>{f.tipo}</span>
                          {replies.length > 0 && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full font-semibold">{replies.length + 1}</span>
                          )}
                        </div>
                        <p className="text-sm text-stone-700 truncate">{f.mensaje}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-stone-400">{new Date(f.created_at).toLocaleDateString('es-PE', { timeZone: 'America/Lima' })}</span>
                        {isOpen ? <ChevronUp size={14} className="text-stone-400" /> : <ChevronDown size={14} className="text-stone-400" />}
                      </div>
                    </div>
                  </button>

                  {/* Expanded: conversation thread */}
                  {isOpen && (
                    <div className="border-t border-stone-100 bg-stone-50/30 px-4 py-3">
                      {/* Original message */}
                      <div className="mb-3 p-3 bg-white rounded-lg border border-stone-100">
                        <p className="text-[10px] text-stone-400 mb-1">Tu · {new Date(f.created_at).toLocaleDateString('es-PE', { timeZone: 'America/Lima' })}</p>
                        <p className="text-sm text-stone-700">{f.mensaje}</p>
                      </div>

                      {/* Admin reply (legacy nota_admin, only if no replies migrated) */}
                      {f.nota_admin && replies.length === 0 && (
                        <div className="mb-3 p-3 bg-[#0A2F24]/5 rounded-lg">
                          <p className="text-[10px] text-emerald-600 font-semibold mb-1">Equipo Kudi</p>
                          <p className="text-sm text-stone-700">{f.nota_admin}</p>
                        </div>
                      )}

                      {/* Replies thread */}
                      {replies.map(r => (
                        <div key={r.id} className={`mb-2 p-3 rounded-lg ${r.es_admin ? 'bg-[#0A2F24]/5' : 'bg-white border border-stone-100'}`}>
                          <p className="text-[10px] text-stone-400 mb-1">
                            {r.es_admin ? <span className="text-emerald-600 font-semibold">Equipo Kudi</span> : 'Tu'}
                            {' · '}{new Date(r.created_at).toLocaleDateString('es-PE', { timeZone: 'America/Lima' })}
                          </p>
                          <p className="text-sm text-stone-700">{r.mensaje}</p>
                        </div>
                      ))}

                      {/* Reply input */}
                      {f.estado !== 'resuelto' ? (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-stone-200">
                          <input
                            type="text"
                            value={expandedId === f.id ? replyText : ''}
                            onChange={e => setReplyText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleReply(f.id)}
                            className={cx.input + ' text-sm flex-1'}
                            placeholder="Escribe un mensaje..."
                          />
                          <button
                            onClick={() => handleReply(f.id)}
                            disabled={replying || !replyText.trim()}
                            className={cx.btnPrimary + ' !px-3'}
                          >
                            <Send size={14} />
                          </button>
                        </div>
                      ) : (
                        <p className="text-[10px] text-emerald-600 text-center mt-2">Ticket cerrado</p>
                      )}

                      {/* Resolve button */}
                      {f.estado !== 'resuelto' && (
                        <button onClick={() => handleResolve(f.id)} className={cx.btnGhost + ' text-xs mt-2 w-full flex items-center justify-center gap-1'}>
                          <CheckCircle size={12} /> Marcar como resuelto
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
