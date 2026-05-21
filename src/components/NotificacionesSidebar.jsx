import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { cx } from '../styles/tokens';
import { X, Send, ChevronDown, ChevronUp, Headphones } from 'lucide-react';

function timeAgo(date) {
  const now = new Date();
  const d = new Date(date);
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'ahora';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
}

export default function NotificacionesSidebar({ open, onClose }) {
  const api = useApi();
  const [mensajes, setMensajes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [respuestas, setRespuestas] = useState({});
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [showNewMsg, setShowNewMsg] = useState(false);
  const [newMsgAsunto, setNewMsgAsunto] = useState('');
  const [newMsgTexto, setNewMsgTexto] = useState('');
  const [sendingNew, setSendingNew] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.get('/mensajes')
      .then(r => setMensajes(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  const handleExpand = async (id) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    // Mark as read
    api.patch(`/mensajes/${id}/leer`).catch(() => {});
    setMensajes(prev => prev.map(m => m.id === id ? { ...m, leido: true } : m));
    // Load replies
    if (!respuestas[id]) {
      try {
        const r = await api.get(`/mensajes/${id}/respuestas`);
        setRespuestas(prev => ({ ...prev, [id]: r.data || [] }));
      } catch {}
    }
  };

  const handleReply = async (parentId) => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      await api.post(`/mensajes/${parentId}/responder`, { mensaje: replyText.trim() });
      setReplyText('');
      const r = await api.get(`/mensajes/${parentId}/respuestas`);
      setRespuestas(prev => ({ ...prev, [parentId]: r.data || [] }));
    } catch {}
    finally { setSending(false); }
  };

  const handleNewMsg = async () => {
    if (!newMsgTexto.trim()) return;
    setSendingNew(true);
    try {
      await api.post('/mensajes', { asunto: newMsgAsunto.trim() || null, mensaje: newMsgTexto.trim() });
      setShowNewMsg(false);
      setNewMsgAsunto('');
      setNewMsgTexto('');
      // Reload messages
      const r = await api.get('/mensajes');
      setMensajes(r.data || []);
    } catch {}
    finally { setSendingNew(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex">
      <div className="flex-1 bg-black/20" onClick={onClose} />
      <div className="w-full sm:w-96 bg-white h-full shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 flex-shrink-0">
          <h3 className="font-bold text-stone-900 text-sm">Notificaciones</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition-colors duration-100">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-5 space-y-3">
              {[1,2,3].map(i => <div key={i} className={cx.skeleton + ' h-16 rounded-xl'} />)}
            </div>
          ) : mensajes.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-stone-400 text-sm">No tienes notificaciones</p>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {mensajes.map(m => (
                <div key={m.id}>
                  {/* Message header — clickable */}
                  <button
                    onClick={() => handleExpand(m.id)}
                    className={`w-full text-left px-5 py-3.5 hover:bg-stone-50 transition-colors duration-100 ${!m.leido ? 'bg-blue-50/50' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          {m.de_admin && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-[#0A2F24] text-white rounded font-semibold">Kudi</span>
                          )}
                          {!m.leido && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                        </div>
                        <p className={`text-sm truncate ${!m.leido ? 'font-semibold text-stone-900' : 'text-stone-700'}`}>
                          {m.asunto || 'Mensaje'}
                        </p>
                        <p className="text-xs text-stone-400 truncate mt-0.5">{m.mensaje.slice(0, 80)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[10px] text-stone-400">{timeAgo(m.created_at)}</span>
                        {expandedId === m.id ? <ChevronUp size={12} className="text-stone-400" /> : <ChevronDown size={12} className="text-stone-400" />}
                      </div>
                    </div>
                    {m.respuestas > 0 && expandedId !== m.id && (
                      <span className="text-[10px] text-[#16A34A] mt-1 inline-block">{m.respuestas} respuesta{m.respuestas > 1 ? 's' : ''}</span>
                    )}
                  </button>

                  {/* Expanded content */}
                  {expandedId === m.id && (
                    <div className="px-5 pb-4 bg-stone-50/50">
                      {/* Full message */}
                      <div className="bg-white rounded-xl p-4 border border-stone-100 mb-3">
                        {m.asunto && <p className="text-sm font-semibold text-stone-800 mb-1">{m.asunto}</p>}
                        <p className="text-sm text-stone-700 whitespace-pre-wrap">{m.mensaje}</p>
                        <p className="text-[10px] text-stone-400 mt-2">{new Date(m.created_at).toLocaleString('es-PE')}</p>
                      </div>

                      {/* Replies */}
                      {(respuestas[m.id] || []).map(r => (
                        <div key={r.id} className={`mb-2 p-3 rounded-lg ${r.de_admin ? 'bg-[#0A2F24]/5 border border-[#0A2F24]/10' : 'bg-white border border-stone-100 ml-4'}`}>
                          <div className="flex items-center gap-1.5 mb-1">
                            {r.de_admin ? (
                              <span className="text-[9px] px-1.5 py-0.5 bg-[#0A2F24] text-white rounded font-semibold">Kudi</span>
                            ) : (
                              <span className="text-[10px] text-stone-500 font-medium">Tú</span>
                            )}
                            <span className="text-[10px] text-stone-400">{timeAgo(r.created_at)}</span>
                          </div>
                          <p className="text-xs text-stone-700">{r.mensaje}</p>
                        </div>
                      ))}

                      {/* Reply input */}
                      <div className="flex gap-2 mt-2">
                        <input
                          type="text"
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleReply(m.id)}
                          className="flex-1 px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm placeholder:text-stone-400 focus:outline-none focus:border-stone-400 transition-colors duration-100"
                          placeholder="Escribe una respuesta..."
                        />
                        <button
                          onClick={() => handleReply(m.id)}
                          disabled={sending || !replyText.trim()}
                          className="p-2 bg-[#16A34A] text-white rounded-lg hover:bg-[#15803D] disabled:opacity-40 transition-colors duration-100"
                        >
                          <Send size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer — contact support */}
        <div className="px-5 py-4 border-t border-stone-100 flex-shrink-0">
          {showNewMsg ? (
            <div className="space-y-2">
              <input
                type="text"
                value={newMsgAsunto}
                onChange={e => setNewMsgAsunto(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm placeholder:text-stone-400 focus:outline-none focus:border-stone-400 transition-colors duration-100"
                placeholder="Asunto"
              />
              <textarea
                value={newMsgTexto}
                onChange={e => setNewMsgTexto(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm placeholder:text-stone-400 focus:outline-none focus:border-stone-400 transition-colors duration-100 resize-y min-h-[60px]"
                placeholder="Escribe tu mensaje al equipo de Kudi..."
                rows={2}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleNewMsg}
                  disabled={sendingNew || !newMsgTexto.trim()}
                  className="flex-1 py-2 bg-[#16A34A] text-white text-sm font-semibold rounded-lg hover:bg-[#15803D] disabled:opacity-40 transition-colors duration-100 flex items-center justify-center gap-1.5"
                >
                  {sendingNew ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send size={14} /> Enviar</>}
                </button>
                <button onClick={() => { setShowNewMsg(false); setNewMsgAsunto(''); setNewMsgTexto(''); }} className="px-3 py-2 text-stone-400 text-sm hover:text-stone-600">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNewMsg(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#0A2F24] text-white text-sm font-semibold rounded-xl hover:bg-[#0A2F24]/90 transition-colors duration-100"
            >
              <Headphones size={16} />
              Contactar con soporte
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
