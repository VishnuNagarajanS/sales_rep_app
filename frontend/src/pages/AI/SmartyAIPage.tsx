import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send } from 'lucide-react';
import { aiAssistantService, AiChatMessage } from '../../services/aiAssistantService';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../../context/AuthContext';
import './SmartyAIPage.css';

export const SmartyAIPage: React.FC = () => {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content: 'Hi! I am **Smarty AI**, your built-in assistant for NexusSales.\n\nI can help you view and manage leads, follow-ups, customers, deals, and reports. Let me know what you\'d like to do today!'
        }
      ]);
    }
  }, [messages.length]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  };

  const handleSend = async (text: string = input) => {
    if (!text.trim()) return;

    const userMessage: AiChatMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setLoading(true);

    try {
      const response = await aiAssistantService.chat({
        message: text,
        history: messages.slice(-6)
      });

      if (response.success && response.data) {
        setMessages([
          ...newMessages,
          { role: 'assistant', content: response.data.answer }
        ]);
      } else {
        setMessages([
          ...newMessages,
          { role: 'assistant', content: response.message || 'I could not finish that, please try a narrower question.' }
        ]);
      }
    } catch (error: any) {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: error.message || 'I could not finish that, please try a narrower question.' }
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
    return (
      <div style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', background: 'var(--bg-app)' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Sparkles size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
          <h2>Smarty AI</h2>
          <p>This module is currently only available for administrators.</p>
        </div>
      </div>
    );
  }

  const suggestions = [
    "Show user details",
    "Filter by status",
    "Which leads came in yesterday?",
    "Export to Excel"
  ];

  return (
    <div className="premium-chat-container">
      {/* Header */}
      <div className="premium-header">
        <div className="premium-header-text">
          <h1>Smarty AI Assistant</h1>
          <p><span className="online-dot"></span> Ask anything about your CRM data</p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="premium-messages-area">
        <div className="messages-content">
          {messages.map((msg, idx) => (
            <div key={idx} className={`msg-row ${msg.role}`}>
              <div className={`msg-bubble ${msg.role}`}>
                {msg.role === 'assistant' ? (
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="msg-row assistant">
              <div className="msg-bubble assistant">
                <div className="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          
          {messages.length === 1 && (
            <div className="premium-chips">
              {suggestions.map((s, i) => (
                <button 
                  key={i} 
                  className="premium-chip"
                  onClick={() => handleSend(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Floating Input */}
      <div className="input-fade-bg">
        <div className="input-pill">
          <textarea
            ref={textareaRef}
            autoFocus
            value={input}
            onChange={handleInput}
            onKeyDown={onKeyDown}
            placeholder="Ask Smarty anything about your CRM..."
            disabled={loading}
            rows={1}
          />
          <button
            className="send-btn"
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
          >
            <Send size={18} style={{ transform: 'translateX(-1px) translateY(1px)' }} />
          </button>
        </div>
      </div>
    </div>
  );
};
