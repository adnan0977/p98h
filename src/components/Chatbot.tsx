import React, { useState, useRef, useEffect } from 'react';
import { askIslamicQuestion } from '../services/geminiService';
import { Send, User, Bot, Loader2, Info, MessageCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Assalamu Alaikum! I am your Al-Hidayah Islamic Assistant. How can I help you with your questions about Islam, Quran, or Hadith today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await askIslamicQuestion(input);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response || "I'm sorry, I couldn't process that.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-[70vh] flex flex-col bg-white rounded-3xl border border-stone-200 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-emerald-900 text-white p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-800 rounded-2xl flex items-center justify-center shadow-inner">
            <Bot className="w-7 h-7 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-bold text-lg">Islamic AI Assistant</h3>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
              <span className="text-xs text-emerald-300 font-medium">Online · Guided by Quran & Sunnah</span>
            </div>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-emerald-800/50 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest text-emerald-300">
          <Info className="w-3 h-3" />
          Educational Only
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-stone-50/50">
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-3 max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${
                  message.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-white border border-stone-200 text-emerald-600'
                }`}>
                  {message.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                </div>
                <div className={`p-4 rounded-2xl shadow-sm ${
                  message.role === 'user' 
                    ? 'bg-emerald-600 text-white rounded-tr-none' 
                    : 'bg-white border border-stone-200 text-stone-800 rounded-tl-none'
                }`}>
                  <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-strong:text-emerald-900">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                  <p className={`text-[10px] mt-2 font-medium opacity-50 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex gap-3 items-center bg-white border border-stone-200 p-4 rounded-2xl rounded-tl-none shadow-sm">
              <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
              <span className="text-sm font-medium text-stone-500 italic">Consulting sources...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-6 bg-white border-t border-stone-200">
        <div className="relative flex items-center gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about Quran, Hadith, or Islamic history..."
            className="flex-1 bg-stone-100 border-none rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-emerald-600 transition-all outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="bg-emerald-600 text-white p-4 rounded-2xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 disabled:opacity-50 disabled:shadow-none transition-all"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-center text-[10px] text-stone-400 mt-4 font-medium">
          This AI assistant is for educational purposes. For specific religious rulings, please consult a qualified scholar.
        </p>
      </form>
    </div>
  );
}
