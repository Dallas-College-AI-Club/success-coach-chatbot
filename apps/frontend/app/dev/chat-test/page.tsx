'use client';

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

interface ToolInvocation {
  state: 'call' | 'result';
  toolCallId: string;
  toolName: string;
  args: any;
  result?: any;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolInvocations?: ToolInvocation[];
}

// Custom Markdown-to-HTML parser function to render headers, links, lists, and tables without external library overhead
function parseMarkdownToHTML(text: string): string {
  let html = '';
  const lines = text.split('\n');
  
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];
  
  let inUnorderedList = false;
  let inOrderedList = false;

  const processInline = (str: string): string => {
    // Escape HTML characters to prevent XSS while allowing formatting tags
    let processed = str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Bold: **text**
    processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Code: `text`
    processed = processed.replace(/`(.*?)`/g, '<code class="bg-slate-100 px-1 py-0.5 rounded font-mono text-xs">$1</code>');

    // Markdown Links: [text](url)
    processed = processed.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">$1</a>');

    // Naked Link brackets: <https://...>
    processed = processed.replace(/&lt;(https?:\/\/.*?)&gt;/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">$1</a>');

    return processed;
  };

  const closeActiveBlocks = () => {
    let closed = '';
    if (inTable) {
      closed += '<div class="overflow-x-auto my-3 border border-slate-200 rounded-xl"><table class="min-w-full divide-y divide-slate-200 text-xs">';
      closed += '<thead class="bg-slate-50"><tr>';
      tableHeaders.forEach(h => {
        closed += `<th class="px-4 py-2 text-left font-semibold text-slate-700">${processInline(h)}</th>`;
      });
      closed += '</tr></thead>';
      closed += '<tbody class="divide-y divide-slate-100 bg-white">';
      tableRows.forEach(row => {
        closed += '<tr>';
        row.forEach(cell => {
          closed += `<td class="px-4 py-2 text-slate-600">${processInline(cell)}</td>`;
        });
        closed += '</tr>';
      });
      closed += '</tbody></table></div>';
      inTable = false;
      tableHeaders = [];
      tableRows = [];
    }
    if (inUnorderedList) {
      closed += '</ul>';
      inUnorderedList = false;
    }
    if (inOrderedList) {
      closed += '</ol>';
      inOrderedList = false;
    }
    return closed;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Table parser
    if (line.startsWith('|') && line.endsWith('|')) {
      if (inUnorderedList || inOrderedList) {
        html += closeActiveBlocks();
      }
      
      if (!inTable) {
        inTable = true;
        tableHeaders = line.split('|').map(s => s.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        // Skip separator line if next
        if (i + 1 < lines.length && lines[i + 1].trim().includes('-')) {
          i++; // skip separator
        }
      } else {
        const row = line.split('|').map(s => s.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        tableRows.push(row);
      }
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      html += closeActiveBlocks();
      html += `<h3 class="text-xs font-bold text-slate-800 uppercase tracking-wider mt-4 mb-2">${processInline(line.slice(4))}</h3>`;
    } else if (line.startsWith('## ')) {
      html += closeActiveBlocks();
      html += `<h2 class="text-sm font-bold text-slate-900 mt-5 mb-2">${processInline(line.slice(3))}</h2>`;
    } else if (line.startsWith('# ')) {
      html += closeActiveBlocks();
      html += `<h1 class="text-base font-bold text-slate-900 mt-6 mb-3">${processInline(line.slice(2))}</h1>`;
    }
    // Horizontal Rule
    else if (line === '---') {
      html += closeActiveBlocks();
      html += '<hr class="my-4 border-slate-200" />';
    }
    // Unordered List Item
    else if (line.startsWith('- ')) {
      if (inTable || inOrderedList) {
        html += closeActiveBlocks();
      }
      if (!inUnorderedList) {
        html += '<ul class="list-disc pl-5 space-y-1 my-2">';
        inUnorderedList = true;
      }
      html += `<li class="text-slate-700">${processInline(line.slice(2))}</li>`;
    }
    // Ordered List Item
    else if (/^\d+\.\s/.test(line)) {
      if (inTable || inUnorderedList) {
        html += closeActiveBlocks();
      }
      const match = line.match(/^(\d+)\.\s(.*)/);
      if (match) {
        if (!inOrderedList) {
          html += '<ol class="list-decimal pl-5 space-y-1 my-2">';
          inOrderedList = true;
        }
        html += `<li class="text-slate-700">${processInline(match[2])}</li>`;
      }
    }
    // Empty Line
    else if (line === '') {
      html += closeActiveBlocks();
      html += '<div class="h-2"></div>';
    }
    // Standard Paragraph
    else {
      if (inTable || inUnorderedList || inOrderedList) {
        html += closeActiveBlocks();
      }
      html += `<p class="text-slate-700 my-1.5 leading-relaxed">${processInline(line)}</p>`;
    }
  }

  // Close any unclosed blocks at EOF
  html += closeActiveBlocks();

  return html;
}

function ToolInvocationBadge({ invocation }: { invocation: ToolInvocation }) {
  const [isOpen, setIsOpen] = useState(false);
  const isExecuting = invocation.state === 'call';

  // Human-readable titles based on toolName
  let icon = '⚙️';
  let label = `Executing ${invocation.toolName}...`;
  let successLabel = `Completed ${invocation.toolName}`;

  if (invocation.toolName === 'get_date') {
    icon = '📅';
    label = 'Retrieving date and time...';
    successLabel = 'Retrieved date and time';
  } else if (invocation.toolName === 'get_course_information') {
    icon = '📚';
    const courseCode = invocation.args?.courseCode || 'course';
    label = `Searching course catalog for ${courseCode}...`;
    successLabel = `Found course info for ${courseCode}`;
  }

  return (
    <div className={`p-3 rounded-xl border text-xs font-sans transition-all duration-200 ${
      isExecuting 
        ? 'bg-amber-50/50 border-amber-200/60 text-amber-800' 
        : 'bg-emerald-50/40 border-emerald-100/70 text-emerald-800'
    }`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium">
          {isExecuting ? (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
          ) : (
            <span className="h-2 w-2 rounded-full bg-emerald-500 font-semibold">✓</span>
          )}
          <span>{icon}</span>
          <span>{isExecuting ? label : successLabel}</span>
        </div>
        
        {/* Toggle Details Button */}
        <button 
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition-colors cursor-pointer ${
            isExecuting 
              ? 'bg-amber-100/50 hover:bg-amber-100 border-amber-200 text-amber-700' 
              : 'bg-emerald-100/40 hover:bg-emerald-100/80 border-emerald-200/60 text-emerald-700'
          }`}
        >
          {isOpen ? 'Hide Payload' : 'Show Payload'}
        </button>
      </div>

      {isOpen && (
        <div className={`mt-2.5 pt-2 border-t text-[10px] font-mono space-y-1.5 overflow-x-auto ${
          isExecuting ? 'border-amber-200/40 text-amber-700/80' : 'border-emerald-200/30 text-emerald-700/80'
        }`}>
          <div>
            <span className="font-semibold">Arguments:</span>
            <pre className="mt-0.5 p-1.5 bg-black/5 rounded text-[9px] whitespace-pre-wrap break-all">
              {JSON.stringify(invocation.args, null, 2)}
            </pre>
          </div>
          {!isExecuting && invocation.result && (
            <div>
              <span className="font-semibold">Result:</span>
              <pre className="mt-0.5 p-1.5 bg-black/5 rounded text-[9px] whitespace-pre-wrap break-all">
                {JSON.stringify(invocation.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ChatTestPage() {
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{ message: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to chat bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleClearChat = () => {
    setMessages([]);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = input.trim();
    if (!query || isLoading) return;

    // 1. Add user message
    const userMessage: Message = {
      id: String(Date.now()),
      role: 'user',
      content: query,
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    // Create container for assistant response
    const assistantMessageId = String(Date.now() + 1);
    let accumulatedContent = '';

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          systemPrompt,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.details || errJson.error || 'Failed to send message');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response stream reader not available.');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      
      // Add empty assistant bubble
      setMessages((prev) => [...prev, { id: assistantMessageId, role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep potential incomplete line at the end in buffer for next chunk
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          
          const rawData = trimmed.slice(6);
          if (rawData === '[DONE]') continue;
          try {
            const parsed = JSON.parse(rawData);
            if (parsed.type === 'text-delta' && parsed.delta) {
              accumulatedContent += parsed.delta;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId ? { ...msg, content: accumulatedContent } : msg
                )
              );
            } else if (parsed.type === 'tool-call') {
              const { toolCallId, toolName, args } = parsed;
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id !== assistantMessageId) return msg;
                  const currentInvocations = msg.toolInvocations || [];
                  if (currentInvocations.some((inv) => inv.toolCallId === toolCallId)) {
                    return msg;
                  }
                  return {
                    ...msg,
                    toolInvocations: [
                      ...currentInvocations,
                      {
                        state: 'call',
                        toolCallId,
                        toolName,
                        args,
                      },
                    ],
                  };
                })
              );
            } else if (parsed.type === 'tool-result') {
              const { toolCallId, toolName, result } = parsed;
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id !== assistantMessageId) return msg;
                  const currentInvocations = msg.toolInvocations || [];
                  return {
                    ...msg,
                    toolInvocations: currentInvocations.map((inv) =>
                      inv.toolCallId === toolCallId
                        ? { ...inv, state: 'result', result }
                        : inv
                    ),
                  };
                })
              );
            } else if (parsed.type === 'error' && parsed.errorText) {
              throw new Error(parsed.errorText);
            }
          } catch {
            // Ignore partial parsing errors
          }
        }
      }
    } catch (err: unknown) {
      console.error('[Streaming Error]:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error streaming response.';
      setError({ message: errorMessage });
      // Remove the incomplete assistant bubble if it was empty
      setMessages((prev) => prev.filter((msg) => msg.id !== assistantMessageId || msg.content !== ''));
    } finally {
      setIsLoading(false);
    }
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
            <span className="text-[#0B2240] font-medium text-[11px]">Model: gpt-oss-20b:free</span>
          </div>
          
          <button
            onClick={handleClearChat}
            disabled={messages.length === 0}
            className="text-xs text-slate-500 hover:text-slate-800 disabled:opacity-40 transition-colors flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-slate-100 border border-slate-200 bg-white shadow-sm cursor-pointer disabled:cursor-not-allowed"
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
        <section className="flex-1 flex flex-col min-h-[350px] relative justify-between">
          
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
                      {isUser ? (
                        message.content
                      ) : (
                        <div className="space-y-3">
                          {/* Tool Invocations UI */}
                          {message.toolInvocations && message.toolInvocations.length > 0 && (
                            <div className="flex flex-col gap-2">
                              {message.toolInvocations.map((inv) => (
                                <ToolInvocationBadge key={inv.toolCallId} invocation={inv} />
                              ))}
                            </div>
                          )}

                          {/* Assistant Text Response */}
                          {message.content && (
                            <div
                              className="prose prose-sm max-w-none text-slate-800 space-y-1"
                              dangerouslySetInnerHTML={{ __html: parseMarkdownToHTML(message.content) }}
                            />
                          )}
                        </div>
                      )}
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
