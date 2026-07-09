'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useRef, useEffect } from 'react';
import { User, RotateCcw, Send, Sparkles, AlertCircle } from 'lucide-react';

const DEFAULT_SYSTEM_PROMPT = 'You are a friendly Dallas College Success Coach. Help the student navigate college life, find campus resources, manage stress, and build study habits. Keep your answers encouraging, action-oriented, and simple.';

// Cute Custom Robot SVG Icon from Slide 5
function RobotIcon() {
  return (
    <svg viewBox="0 0 100 100" className="h-8 w-8 shrink-0">
      {/* Outer thin border circle */}
      <circle cx="50" cy="50" r="47" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="2"/>
      
      {/* Side Antennas (orange balls with gray connectors) */}
      <rect x="21" y="44" width="6" height="12" rx="2" fill="#94A3B8" />
      <circle cx="24" cy="38" r="5" fill="#EF4444" />
      
      <rect x="73" y="44" width="6" height="12" rx="2" fill="#94A3B8" />
      <circle cx="76" cy="38" r="5" fill="#EF4444" />
      
      {/* Center top antenna (green ball) */}
      <rect x="47" y="19" width="6" height="12" rx="2" fill="#94A3B8" />
      <circle cx="50" cy="15" r="5" fill="#10B981" />
      
      {/* Robot Face plate border / ears */}
      <rect x="25" y="46" width="6" height="14" rx="3" fill="#F1F5F9" stroke="#475569" strokeWidth="2" />
      <rect x="69" y="46" width="6" height="14" rx="3" fill="#F1F5F9" stroke="#475569" strokeWidth="2" />

      {/* Main Head Body (rounded rect) */}
      <rect x="28" y="27" width="44" height="42" rx="16" fill="#E2E8F0" stroke="#475569" strokeWidth="2.5" />
      
      {/* Face plate (blue screen) */}
      <rect x="34" y="33" width="32" height="26" rx="9" fill="#93C5FD" stroke="#475569" strokeWidth="2" />
      
      {/* Eyes (dark circles) */}
      <circle cx="43" cy="43" r="3" fill="#1E293B" />
      <circle cx="57" cy="43" r="3" fill="#1E293B" />
      
      {/* Smile */}
      <path d="M 45 49 Q 50 53 55 49" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export default function ChatTestPage() {
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Vercel AI SDK useChat Hook with body payload
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    setMessages,
    isLoading,
    error,
  } = useChat({
    api: '/api/chat',
    body: {
      systemPrompt, // Dynamic prompt passed in payload body
    },
    onError: (err) => {
      console.error('[Chat SDK Error]:', err);
    },
  });

  // Scroll to chat bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleClearChat = () => {
    setMessages([]);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F0F1F3] text-slate-800 min-h-screen font-sans">
      {/* Brand Header matching slide 2 */}
      <header className="border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-[#C8102E]/10 p-2 rounded-lg border border-[#C8102E]/20">
            <Sparkles className="h-5 w-5 text-[#C8102E]" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-[#1E293B] flex items-baseline gap-2">
              <span className="text-[#C8102E] font-extrabold">Success</span>
              <span className="text-[#0B2240] font-semibold">Coach</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">
              Presented by Dallas College AI Club
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs bg-[#0B2240]/5 px-3 py-1.5 rounded-full border border-[#0B2240]/10">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[#0B2240] font-medium text-[11px]">Model: llama-3-8b-instruct:free</span>
          </div>
          
          <button
            onClick={handleClearChat}
            disabled={messages.length === 0}
            className="text-xs text-slate-500 hover:text-slate-800 disabled:opacity-40 transition-colors flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-slate-100 border border-slate-200 bg-white shadow-sm"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Chat</span>
          </button>
        </div>
      </header>

      {/* Main Centered Column Workspace */}
      <main className="flex-1 flex flex-col max-w-2xl w-full mx-auto p-4 md:p-6 gap-4 justify-between">
        
        {/* System Prompt Settings Card */}
        <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-2">
          <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            System Instructions
          </label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={2}
            className="w-full text-xs p-3 bg-[#F8FAFC] border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#C8102E]/30 focus:border-[#C8102E]/30 resize-none font-mono leading-relaxed"
            placeholder="Instruct the AI coach..."
          />
        </section>

        {/* Chat Scrolling container */}
        <section className="flex-1 flex flex-col min-h-[350px] relative">
          
          <div className="flex-1 overflow-y-auto px-1 py-4 space-y-5 max-h-[60vh] scrollbar-thin scrollbar-thumb-slate-300">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 max-w-sm mx-auto my-auto space-y-4">
                <RobotIcon />
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Welcome! How can I help?</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Adjust the system instructions above and type a message below to test connection to the LLM.
                  </p>
                </div>
              </div>
            ) : (
              messages.map((message) => {
                const isUser = message.role === 'user';
                return (
                  <div
                    key={message.id}
                    className={`flex items-end gap-2.5 max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                  >
                    {/* circular avatars */}
                    {isUser ? (
                      <div className="h-8 w-8 rounded-full bg-blue-100 border border-blue-200 text-blue-600 flex items-center justify-center text-xs shadow-sm">
                        <User className="h-4 w-4" />
                      </div>
                    ) : (
                      <RobotIcon />
                    )}

                    {/* Chat Bubble Body matching slide 4 styles */}
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                        isUser
                          ? 'bg-[#3B82F6] text-white rounded-br-none'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                );
              })
            )}

            {/* Loader / Typing Indicator */}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex items-end gap-2.5 max-w-[85%] mr-auto">
                <RobotIcon />
                <div className="bg-white border border-slate-200 text-slate-500 rounded-2xl rounded-bl-none px-4 py-2.5 text-xs flex items-center gap-1.5 shadow-sm">
                  <span className="inline-flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="h-1.5 w-1.5 rounded-full bg-[#3B82F6] animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </span>
                  <span>Coach is thinking...</span>
                </div>
              </div>
            )}

            {/* Error Message banner */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-650 rounded-xl p-3.5 text-xs flex items-start gap-2 max-w-md mx-auto shadow-sm">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
                <div>
                  <span className="font-semibold text-red-700">Connection Error:</span> {error.message || 'Could not stream response. Check console logs and your OpenRouter API key.'}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Capsule Pill Input Form matching slide 4 layout */}
          <form onSubmit={handleSubmit} className="pt-3">
            <div className="flex gap-2 items-center bg-white border border-slate-300/80 rounded-full px-4 py-2 shadow-md focus-within:border-blue-400/80 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
              <input
                type="text"
                value={input}
                onChange={handleInputChange}
                disabled={isLoading}
                placeholder="Ask your success coach anything..."
                className="flex-1 bg-transparent border-none text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed px-2 py-2"
              />
              <button
                type="submit"
                disabled={isLoading || !input || !input.trim()}
                className="bg-[#C8102E] hover:bg-[#A60F25] disabled:bg-slate-200 disabled:text-slate-400 border border-transparent text-white font-medium p-2.5 rounded-full flex items-center justify-center transition-all cursor-pointer disabled:cursor-not-allowed shrink-0 shadow-sm"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
