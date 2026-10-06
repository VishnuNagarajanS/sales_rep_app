import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send } from 'lucide-react';
import { aiAssistantService, AiChatMessage } from '../../services/aiAssistantService';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../../context/AuthContext';
import '../../components/ai/AiAssistant.css';

export const SmartyAIPage: React.FC = () => {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    return (
      <div style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Sparkles size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
          <h2>Smarty AI</h2>
          <p>This module is currently only available for administrators.</p>
        </div>
      </div>
    );
  }

  const suggestions = [
    "Which leads came in yesterday?",
    "Who is on leave today?",
    "Leads by status this week"
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-color)' }}>
      <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={24} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px' }}>Smarty AI Assistant</h1>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Ask anything about your CRM data.</p>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ 
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
            padding: '16px 20px',
            borderRadius: '16px',
            background: msg.role === 'user' ? 'var(--primary-color)' : 'var(--surface-color)',
            color: msg.role === 'user' ? 'white' : 'var(--text-color)',
            borderBottomRightRadius: msg.role === 'user' ? '4px' : '16px',
            borderBottomLeftRadius: msg.role === 'assistant' ? '4px' : '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            lineHeight: 1.6
          }}>
            {msg.role === 'assistant' ? (
              <div className="markdown-body">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            ) : (
              msg.content
            )}
          </div>
        ))}
        
        {loading && (
          <div style={{ alignSelf: 'flex-start', padding: '16px 20px', borderRadius: '16px', background: 'var(--surface-color)', borderBottomLeftRadius: '4px' }}>
            <div className="typing-indicator" style={{ display: 'flex', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', background: 'var(--text-secondary)', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both' }}></span>
              <span style={{ width: '8px', height: '8px', background: 'var(--text-secondary)', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '-0.32s' }}></span>
              <span style={{ width: '8px', height: '8px', background: 'var(--text-secondary)', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '-0.16s' }}></span>
            </div>
          </div>
        )}
        
        {messages.length === 1 && (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
            {suggestions.map((s, i) => (
              <button 
                key={i} 
                onClick={() => handleSend(s)}
                style={{ 
                  padding: '10px 16px', 
                  borderRadius: '20px', 
                  border: '1px solid var(--border-color)', 
                  background: 'var(--bg-color)',
                  color: 'var(--text-color)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-color)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'var(--bg-color)'}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: '24px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-color)' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', position: 'relative' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type your question here..."
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px 60px 16px 20px',
              borderRadius: '24px',
              border: '1px solid var(--border-color)',
              background: 'var(--surface-color)',
              color: 'var(--text-color)',
              fontSize: '15px',
              resize: 'none',
              outline: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}
            rows={1}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: input.trim() && !loading ? 'var(--primary-color)' : 'var(--border-color)',
              color: 'white',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
              transition: 'background 0.2s'
            }}
          >
            <Send size={18} style={{ transform: 'translateX(-1px) translateY(1px)' }} />
          </button>
        </div>
      </div>
      
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
        .markdown-body p { margin-top: 0; margin-bottom: 8px; }
        .markdown-body p:last-child { margin-bottom: 0; }
        .markdown-body ul { margin: 0; padding-left: 20px; }
        .markdown-body li { margin-bottom: 4px; }
      `}</style>
    </div>
  );
};
