import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Wrench, CreditCard, Home, Loader2, Trash2 } from 'lucide-react';
import { sendChatMessage, clearChatHistory } from '../lib/api';
import ReactMarkdown from 'react-markdown';

export default function ChatAssistant({ user, context = {} }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(() => `sess_${user?._id || 'anon'}_${Date.now()}`);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [messages, isOpen]);

  const handleSend = async (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: trimmed }]);
    setLoading(true);

    try {
      const res = await sendChatMessage({
        message: trimmed,
        session_id: sessionId,
        context
      });
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: res.data?.response || 'No response received.',
          toolIntent: res.data?.tool_intent
        }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again in a moment.',
          isError: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    try {
      await clearChatHistory(sessionId);
    } catch (_err) {
      // Clear local state regardless of API response
    }
    setMessages([]);
    setSessionId(`sess_${user?._id || 'anon'}_${Date.now()}`);
  };

  const renderToolSuggestions = (tools) => {
    if (!tools?.length) return null;
    const iconMap = {
      create_maintenance_ticket: <Wrench size={10} />,
      check_payment_status: <CreditCard size={10} />,
      get_property_details: <Home size={10} />,
      get_tenant_history: <User size={10} />
    };
    return (
      <div className="flex gap-1.5 mt-2 flex-wrap">
        {tools.map((t, i) => (
          <span
            key={i}
            className="px-2 py-0.5 bg-green-50 text-green-700 text-[10px] rounded-full border border-green-200 flex items-center gap-1 font-medium"
          >
            {iconMap[t.tool] || null}
            {t.tool.replace(/_/g, ' ')}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {/* Floating trigger */}
      {!isOpen && (
        <button
          id="chat-assistant-toggle"
          onClick={() => setIsOpen(true)}
          title="Open AI Assistant"
          className="w-14 h-14 bg-green-600 text-white rounded-full shadow-xl hover:bg-green-700 transition-all duration-200 flex items-center justify-center hover:scale-105"
        >
          <MessageCircle size={24} />
        </button>
      )}

      {/* Chat window */}
      {isOpen && (
        <div className="w-96 h-[520px] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                <Bot size={16} />
              </div>
              <div>
                <p className="font-semibold text-sm leading-none">Mutune AI</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Property Assistant</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                id="chat-clear-btn"
                onClick={handleClear}
                title="Clear conversation"
                className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
              >
                <Trash2 size={14} />
              </button>
              <button
                id="chat-close-btn"
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                <Bot size={36} className="mb-3 opacity-30" />
                <p className="text-sm font-medium text-gray-500">Ask me anything about your properties</p>
                <p className="text-xs text-gray-400 mt-1">Payments · Maintenance · Notices · Tenants</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot size={12} className="text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-green-600 text-white rounded-tr-none'
                      : msg.isError
                        ? 'bg-red-50 text-red-700 border border-red-200 rounded-tl-none'
                        : 'bg-gray-100 text-gray-800 rounded-tl-none'
                  }`}
                >
                  <ReactMarkdown className="prose prose-sm max-w-none break-words">
                    {msg.content}
                  </ReactMarkdown>
                  {msg.toolIntent && renderToolSuggestions(msg.toolIntent)}
                </div>
                {msg.role === 'user' && (
                  <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User size={12} className="text-slate-300" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-2 items-start">
                <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot size={12} className="text-white" />
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-tl-none px-3 py-2.5">
                  <div className="flex gap-1.5 items-center">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="p-3 border-t border-gray-100 flex gap-2 flex-shrink-0 bg-white">
            <input
              ref={inputRef}
              id="chat-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about payments, maintenance..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50"
              maxLength={2000}
              disabled={loading}
            />
            <button
              id="chat-send-btn"
              type="submit"
              disabled={loading || !input.trim()}
              className="w-9 h-9 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center flex-shrink-0"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
