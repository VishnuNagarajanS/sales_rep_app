import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, ChevronDown, Bot } from 'lucide-react';
import { aiAssistantService, AiChatMessage } from '../../services/aiAssistantService';
import './AiAssistant.css';
import { useAuth } from '../../context/AuthContext';
import ReactMarkdown from 'react-markdown';

const MarkdownContent: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split('\n');
  return (
    <div className="markdown-content">
      {lines.map((line, idx) => {
        if (!line.trim()) {
          return <div key={idx} style={{ height: '0.4rem' }} />;
        }
        if (line.startsWith('### ')) {
          return <h4 key={idx} style={{ margin: '0.35rem 0', fontWeight: 600 }}>{line.slice(4)}</h4>;
        }
        if (line.startsWith('## ')) {
          return <h3 key={idx} style={{ margin: '0.45rem 0', fontWeight: 600 }}>{line.slice(3)}</h3>;
        }
        if (line.startsWith('# ')) {
          return <h2 key={idx} style={{ margin: '0.55rem 0', fontWeight: 700 }}>{line.slice(2)}</h2>;
        }

        const parts = line.split(/(\*\*.*?\*\*|`.*?`)/g);
        const rendered = parts.map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={pIdx}>{part.slice(2, -2)}</strong>;
          }
          if (part.startsWith('`') && part.endsWith('`')) {
            return (
              <code
                key={pIdx}
                style={{
                  background: 'rgba(0,0,0,0.06)',
                  padding: '0.1rem 0.3rem',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  fontSize: '0.85em',
                }}
              >
                {part.slice(1, -1)}
              </code>
            );
          }
          return part;
        });

        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
          return (
            <div key={idx} style={{ display: 'flex', gap: '0.5rem', margin: '0.2rem 0 0.2rem 0.5rem' }}>
              <span>•</span>
              <div>{rendered}</div>
            </div>
          );
        }

        const numMatch = line.trim().match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          return (
            <div key={idx} style={{ display: 'flex', gap: '0.5rem', margin: '0.2rem 0 0.2rem 0.5rem' }}>
              <span>{numMatch[1]}.</span>
              <div>{rendered}</div>
            </div>
          );
        }

        return <p key={idx} style={{ margin: '0.2rem 0' }}>{rendered}</p>;
      })}
    </div>
  );
};


export const AiAssistant: React.FC = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initial greeting
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content: 'Hi! I am Nexus AI. I can help you find leads, check your follow-ups, or answer questions about your NexusSales data.'
        }
      ]);
    }
  }, [messages.length]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async (text: string = input) => {
    if (!text.trim()) return;

    const userMessage: AiChatMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await aiAssistantService.chat({
        message: text,
        history: messages.slice(-6) // Send only the last 6 messages
      });

      if (response.success && response.data) {
        setMessages([
          ...newMessages,
          { role: 'assistant', content: response.data.answer }
        ]);
      } else {
        setMessages([
          ...newMessages,
          { role: 'assistant', content: response.message || 'Sorry, I encountered an error. Please try again.' }
        ]);
      }
    } catch (error: any) {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: error.message || 'Network error. Please try again.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (user?.role?.code !== 'company_admin') {
    return null; // Only render for admins for now
  }

  const suggestions = [
    "Which leads came in yesterday?",
    "Who is on leave today?",
    "Leads by status this week"
  ];

  return (
    <div className="ai-assistant-wrapper">
      {!isOpen && (
        <button className="ai-fab" onClick={() => setIsOpen(true)}>
          <Bot size={28} className="animated-bot" />
        </button>
      )}

      {isOpen && (
        <div className="ai-panel">
          <div className="ai-header">
            <h3><Sparkles size={18} /> Nexus AI</h3>
            <button className="ai-close-btn" onClick={() => setIsOpen(false)}>
              <ChevronDown size={20} />
            </button>
          </div>

          <div className="ai-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`ai-message ${msg.role}`}>
                {msg.role === 'assistant' ? (
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
            ))}
            {loading && (
              <div className="ai-message assistant">
                <div className="typing-indicator">Thinking...</div>
              </div>
            )}
            {messages.length === 1 && (
              <div className="ai-suggestions">
                {suggestions.map((s, i) => (
                  <div key={i} className="ai-suggestion-chip" onClick={() => handleSend(s)}>
                    {s}
                  </div>
                ))}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="ai-input-area">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask anything about your CRM data..."
              rows={1}
              disabled={loading}
            />
            <button
              className="ai-send-btn"
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
