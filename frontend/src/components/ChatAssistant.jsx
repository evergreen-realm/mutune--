import { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Bot, User, Wrench, CreditCard, Home, Loader2, Trash2 } from 'lucide-react';
import { sendChatMessage, clearChatHistory } from '../lib/api';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';

export default function ChatAssistant({ user, context = {} }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(() => {
    const stored = localStorage.getItem(`chat_session_${user?._id || 'anon'}`);
    if (stored) return stored;
    const newId = `sess_${user?._id || 'anon'}_${Date.now()}`;
    localStorage.setItem(`chat_session_${user?._id || 'anon'}`, newId);
    return newId;
  });
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
      // Clear local state regardless
    }
    const newId = `sess_${user?._id || 'anon'}_${Date.now()}`;
    localStorage.setItem(`chat_session_${user?._id || 'anon'}`, newId);
    setMessages([]);
    setSessionId(newId);
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
            className="px-2.5 py-0.5 bg-blue-550/10 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full border border-blue-200 dark:border-blue-800/50 flex items-center gap-1 font-medium animate-fade-in"
          >
            {iconMap[t.tool] || null}
            {t.tool.replace(/_/g, ' ')}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 font-sans flex flex-col items-end">
      {/* Floating trigger */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            key="chat-toggle"
            id="chat-assistant-toggle"
            onClick={() => setIsOpen(true)}
            title="Open AI Assistant"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-14 h-14 bg-blue-600 dark:bg-blue-500 text-white rounded-full shadow-2xl hover:bg-blue-700 dark:hover:bg-blue-600 transition-all duration-200 flex items-center justify-center hover:scale-105 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            <Sparkles size={24} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="chat-window"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-[360px] sm:w-[400px] h-[550px] max-h-[85vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden transition-colors duration-200"
          >
            {/* Header */}
            <div className="px-4 py-3.5 bg-slate-900 dark:bg-slate-955 text-white flex items-center justify-between flex-shrink-0 border-b border-slate-800/40">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-blue-600 dark:bg-blue-500 flex items-center justify-center flex-shrink-0">
                    <Bot size={18} className="text-white" />
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-blue-500 border-2 border-slate-900 dark:border-slate-950 rounded-full animate-pulse" />
                </div>
                <div>
                  <p className="font-semibold text-sm leading-none text-white">Mutune AI</p>
                  <p className="text-xs text-slate-300 mt-1">Property Assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  id="chat-clear-btn"
                  onClick={handleClear}
                  title="Clear conversation"
                  className="p-1.5 hover:bg-slate-800 dark:hover:bg-slate-800/80 rounded-lg transition-colors text-slate-400 hover:text-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <Trash2 size={14} />
                </button>
                <button
                  id="chat-close-btn"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-slate-800 dark:hover:bg-slate-800/80 rounded-lg transition-colors text-slate-400 hover:text-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin bg-slate-50/50 dark:bg-slate-900/50">
              {messages.length === 0 && (() => {
                const quickActions = {
                  tenant: ['Check my rent status', 'Report a maintenance issue', 'When is my lease ending?', 'What is the M-Pesa paybill?'],
                  agent:  ['Check payment for unit 3B', 'Create maintenance ticket', 'Show property occupancy', 'List overdue tenants'],
                  admin:  ['Show vacant units summary', 'Which tenants are in arrears?', 'Generate maintenance report', 'Check property status'],
                  landlord: ['Show my property occupancy', 'What are my monthly collections?', 'List active tenants']
                };
                const chips = quickActions[user?.role] || quickActions.tenant;
                return (
                  <div className="flex flex-col items-center justify-center h-full text-center px-4 py-6">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                      <Bot size={24} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Welcome to Mutune AI</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-6">Ask me anything about your properties, payments, or maintenance.</p>
                    <div className="flex flex-wrap gap-2 justify-center max-w-full animate-fade-in">
                      {chips.map((chip, i) => (
                        <button
                          key={i}
                          onClick={() => setInput(chip)}
                          className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:border-blue-300 dark:hover:border-blue-800 hover:text-blue-700 dark:hover:text-blue-400 cursor-pointer transition-all duration-200 shadow-sm"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-blue-600 dark:bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm animate-fade-in">
                      <Bot size={14} className="text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm animate-fade-in ${
                      msg.role === 'user'
                        ? 'bg-emerald-700 text-white rounded-tr-none'
                        : msg.isError
                          ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-tl-none'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-700/50 rounded-tl-none'
                    }`}
                  >
                    <ReactMarkdown className="prose prose-sm max-w-none break-words dark:prose-invert text-slate-800 dark:text-slate-100">
                      {msg.content}
                    </ReactMarkdown>
                    {msg.toolIntent && renderToolSuggestions(msg.toolIntent)}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-slate-700 dark:bg-slate-850 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm animate-fade-in">
                      <User size={14} className="text-slate-300 dark:text-slate-400" />
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex gap-2.5 items-start">
                  <div className="w-7 h-7 rounded-full bg-blue-600 dark:bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                    <Bot size={14} className="text-white" />
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-tl-none px-4 py-3 border border-slate-100 dark:border-slate-700/50 shadow-sm">
                    <div className="flex gap-1.5 items-center">
                      <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-3.5 border-t border-slate-105 dark:border-slate-800 flex gap-2 flex-shrink-0 bg-white dark:bg-slate-900 transition-colors duration-200">
              <input
                ref={inputRef}
                id="chat-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask about payments, maintenance..."
                className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent transition-all"
                maxLength={2000}
                disabled={loading}
              />
              <button
                id="chat-send-btn"
                type="submit"
                disabled={loading || !input.trim()}
                className="w-10 h-10 bg-blue-600 dark:bg-blue-500 text-white rounded-xl hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center flex-shrink-0 cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
