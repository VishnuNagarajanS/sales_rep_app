import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, ChevronDown } from 'lucide-react';
import { aiAssistantService, AiChatMessage } from '../../services/aiAssistantService';
import './AiAssistant.css';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../../context/AuthContext';

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
          <Sparkles size={24} />
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
