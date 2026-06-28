import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Minimize2, Bot, Mail } from 'lucide-react';
import api from '../api/client';

const WELCOME = {
  role: 'assistant',
  content: "Hi! I'm the PropFlow support assistant. I can help with maintenance requests, rent payments, lease signing, notifications, and anything else in the app. What can I help you with?",
};

export default function SupportChat({ userRole }) {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setMinimized(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (open && !minimized) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, minimized]);

  async function send(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/support/chat', { messages: next, role: userRole });
      const reply = { role: 'assistant', content: res.data.reply };
      setMessages((prev) => [...prev, reply]);
      if (!open || minimized) setUnread((n) => n + 1);
    } catch {
      const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || 'support@propflow.app';
      setMessages((prev) => [...prev, { role: 'assistant', content: `Sorry, I'm having trouble right now. Email us at ${supportEmail} and we'll get back to you shortly.` }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <>
      {/* Chat window */}
      {open && (
        <div className={`fixed bottom-20 right-5 z-50 w-80 bg-white rounded-2xl shadow-2xl border flex flex-col transition-all duration-200 ${minimized ? 'h-14 overflow-hidden' : 'h-[420px]'}`}>
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 bg-blue-600 rounded-t-2xl flex-shrink-0 cursor-pointer" onClick={() => setMinimized((m) => !m)}>
            <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center">
              <Bot size={14} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white font-semibold text-sm leading-none">PropFlow Support</p>
              <p className="text-blue-200 text-xs mt-0.5">AI Assistant · Always on</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={(e) => { e.stopPropagation(); setMinimized((m) => !m); }} className="p-1 text-white/70 hover:text-white">
                <Minimize2 size={14} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setOpen(false); }} className="p-1 text-white/70 hover:text-white">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Messages */}
          {!minimized && (
            <>
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {m.role === 'assistant' && (
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">
                        <Bot size={12} className="text-blue-600" />
                      </div>
                    )}
                    <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                    }`}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-2 flex-shrink-0">
                      <Bot size={12} className="text-blue-600" />
                    </div>
                    <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Email fallback */}
              <div className="px-3 pb-1">
                <a href={`mailto:${import.meta.env.VITE_SUPPORT_EMAIL || 'support@propflow.app'}`} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-600 transition-colors">
                  <Mail size={11} /> {import.meta.env.VITE_SUPPORT_EMAIL || 'support@propflow.app'}
                </a>
              </div>

              {/* Input */}
              <form onSubmit={send} className="flex items-end gap-2 px-3 pb-3 pt-1 border-t">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Ask anything…"
                  className="flex-1 resize-none text-sm border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-20"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 flex-shrink-0 transition-colors"
                >
                  <Send size={15} />
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-50 w-13 h-13 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        style={{ width: 52, height: 52 }}
        aria-label="Open support chat"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>
    </>
  );
}
