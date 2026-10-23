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

  const roleCode = (user?.role?.code || '').toLowerCase();
  const allowedRoles = ['company_admin', 'sales_executive', 'irm', 'super_admin', 'admin', 'ghl_admin'];
  const isAllowed = allowedRoles.includes(roleCode);
  const isSalesExec = roleCode === 'sales_executive';
  const isIrm = roleCode === 'irm';

  const defaultGreeting = isSalesExec
    ? 'Hi! I am **Smarty AI**, your personal sales assistant.\n\nI can help you review your assigned leads, upcoming follow-ups, calls, customer conversions, and GHL products. Let me know what you need!'
    : isIrm
    ? 'Hi! I am **Smarty AI**, your investor relations assistant.\n\nI can help you manage your investor portfolio, track active opportunities & deals, view upcoming consultations, and verify KYC statuses. How can I assist you today?'
    : 'Hi! I am **Smarty AI**, your built-in assistant for NexusSales.\n\nI can help you view and manage company leads, team follow-ups, customers, deals, investors, and reports. Let me know what you\'d like to do today!';

  const suggestions = isSalesExec
    ? [
        "What leads are assigned to me today?",
        "Show my pending follow-ups for today",
        "Which of my leads are in Interested status?",
        "Tell me about GHL company products and schemes"
      ]
    : isIrm
    ? [
        "Which of my clients have KYC pending review?",
        "List my active investment opportunities",
        "What is my total committed AUM?",
        "What are the Direct AIF vs Debenture investment limits?"
      ]
    : [
        "Show company lead overview",
        "Which leads came in yesterday?",
        "Show team performance summary",
        "Tell me about GHL company products and schemes"
      ];

  const placeholderText = isSalesExec
    ? "Ask about your leads, follow-ups, calls, or GHL products..."
    : isIrm
    ? "Ask about your investors, opportunities, KYC, or consultations..."
    : "Ask Smarty anything about your CRM...";

  const subtitleText = isSalesExec
    ? "Your personal Sales Assistant"
    : isIrm
    ? "Your personal Investor Relations Assistant"
    : "Ask anything about your CRM data";

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content: defaultGreeting
        }
      ]);
    }
  }, [messages.length, defaultGreeting]);

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

  if (!isAllowed) {
    return (
      <div style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', background: 'var(--bg-app)' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Sparkles size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
          <h2>Smarty AI</h2>
          <p>This module is currently not available for your role.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="premium-chat-container">
      {/* Header */}
      <div className="premium-header">
        <div className="premium-header-text">
          <h1>Smarty AI Assistant</h1>
          <p><span className="online-dot"></span> {subtitleText}</p>
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
            placeholder={placeholderText}
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
