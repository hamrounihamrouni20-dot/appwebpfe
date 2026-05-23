import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Bot, User, Ticket, Lightbulb, AlertTriangle } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../contexts/AuthContext';
import { queryAssistant } from '../../lib/grokService';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  showTicketPrompt?: boolean;
}

const QUICK_PROMPTS = [
  'Average temp today',
  'Production this week',
  'Why is my power low?',
  'Show my open alerts',
  'What is my system efficiency?',
];

async function getAIResponse(message: string, profileId?: string, history?: Array<{ role: 'user' | 'assistant'; content: string }>): Promise<{ text: string; showTicket?: boolean }> {
  return queryAssistant(message, profileId, history);
}

function formatMessage(text: string) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    if (line.startsWith('**') && line.endsWith('**')) {
      return <p key={i} className="font-semibold text-white mt-2">{line.replace(/\*\*/g, '')}</p>;
    }
    if (line.match(/^\*\*(.+)\*\*/)) {
      return <p key={i} className="text-sm leading-relaxed">{line.replace(/\*\*(.+?)\*\*/g, (_, m) => m)}</p>;
    }
    if (line.startsWith('- ') || line.startsWith('🔴') || /^\d+\./.test(line)) {
      return <p key={i} className="text-sm leading-relaxed ml-2">{line}</p>;
    }
    if (line.startsWith('⚠️')) {
      return <p key={i} className="text-amber-400 text-sm mt-1">{line}</p>;
    }
    return line ? <p key={i} className="text-sm leading-relaxed">{line}</p> : <br key={i} />;
  });
}

export default function AIAssistantPage() {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: "Hello! I'm your SolarWatch AI Assistant. I answer questions using your live SolarWatch system data plus Grok intelligence. Ask about temperature, production, alerts, tickets, or system health.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [ticketCreated, setTicketCreated] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const history = [...messages, userMsg].map(({ role, content }) => ({ role, content }));
      const response = await getAIResponse(text, profile?.id, history);
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.text,
        timestamp: new Date(),
        showTicketPrompt: response.showTicket ?? /ticket|support|technician/i.test(response.text),
      };
      setTimeout(() => {
        setMessages(prev => [...prev, aiMsg]);
        setIsTyping(false);
      }, 800);
    } catch (error) {
      console.error('AI assistant send failed', error);
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I could not generate a response right now. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsTyping(false);
    }
  };

  const createTicket = () => {
    setTicketCreated(true);
    const msg: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: "✅ Support ticket #SW-2024-0042 has been created and assigned to our technical team. You'll receive a notification when a technician is assigned. Expected response time: 2-4 business hours.",
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, msg]);
  };

  return (
    <AppLayout title="AI Assistant">
      <div className="flex flex-col h-[calc(100vh-3.5rem)]">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 bg-gray-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
              <Bot className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">SolarWatch AI Assistant</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                <p className="text-xs text-gray-500">Online — Powered by solar intelligence</p>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-gray-500 hidden sm:block">Ask about faults, efficiency, maintenance</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${msg.role === 'assistant' ? 'bg-blue-500/15 border border-blue-500/20' : 'bg-amber-500/15 border border-amber-500/20'}`}>
                {msg.role === 'assistant' ? (
                  <Bot className="w-4 h-4 text-blue-400" />
                ) : (
                  <User className="w-4 h-4 text-amber-400" />
                )}
              </div>
              <div className={`max-w-xl ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                <div className={`px-4 py-3 rounded-2xl text-sm ${msg.role === 'assistant'
                  ? 'bg-gray-900 border border-gray-800 text-gray-300'
                  : 'bg-amber-500/15 border border-amber-500/20 text-amber-100'
                  }`}>
                  <div className="space-y-0.5">
                    {formatMessage(msg.content)}
                  </div>
                  {msg.showTicketPrompt && !ticketCreated && (
                    <div className="mt-3 pt-3 border-t border-gray-700 flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      <button
                        onClick={createTicket}
                        className="flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
                      >
                        <Ticket className="w-3.5 h-3.5" />
                        Create support ticket
                      </button>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-gray-600 px-1">
                  {msg.timestamp.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
                <Bot className="w-4 h-4 text-blue-400" />
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick prompts */}
        <div className="flex-shrink-0 px-4 py-2 border-t border-gray-800/50 flex gap-2 overflow-x-auto">
          {QUICK_PROMPTS.map(prompt => (
            <button
              key={prompt}
              onClick={() => sendMessage(prompt)}
              className="flex-shrink-0 text-xs text-gray-400 hover:text-gray-200 bg-gray-800/60 hover:bg-gray-700 border border-gray-700/60 rounded-full px-3 py-1.5 transition-all"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-gray-800 bg-gray-950">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && input.trim() && sendMessage(input.trim())}
                placeholder="Ask about your solar system..."
                className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-colors"
              />
            </div>
            <button
              onClick={() => input.trim() && sendMessage(input.trim())}
              disabled={!input.trim() || isTyping}
              className="w-10 h-10 flex items-center justify-center bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all shadow-lg shadow-amber-500/20"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
