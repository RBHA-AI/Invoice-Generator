import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, X, Send, Minimize2, Sparkles } from 'lucide-react';
import { apiJson } from '../utils/api';
import './AskAIChat.css';

const DEFAULT_PROMPTS = [
  'How many invoices this month?',
  'Show all invoices from cirqulus',
  'Which invoices are unpaid?',
  'How many clients do we have?'
];

function AskAIChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestedPrompts, setSuggestedPrompts] = useState(DEFAULT_PROMPTS);
  const [status, setStatus] = useState(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const loadStatus = useCallback(async () => {
    try {
      const data = await apiJson('/api/ai/chat/status');
      setStatus(data);
      if (Array.isArray(data.suggestedPrompts) && data.suggestedPrompts.length) {
        setSuggestedPrompts(data.suggestedPrompts);
      }
    } catch (_) {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadStatus();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, loadStatus]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleLinkClick = () => {
    setOpen(false);
  };

  const sendMessage = async (text) => {
    const trimmed = String(text || '').trim();
    if (!trimmed || loading) return;

    const userMsg = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const data = await apiJson('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: trimmed,
          history: messages.slice(-4)
        })
      });

      const assistantContent = data.reply || 'No response.';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: assistantContent,
          source: data.source,
          links: Array.isArray(data.links) ? data.links : []
        }
      ]);

      if (Array.isArray(data.suggestedPrompts) && data.suggestedPrompts.length) {
        setSuggestedPrompts(data.suggestedPrompts);
      }

      loadStatus();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: err.message || 'Something went wrong.', source: 'error', links: [] }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  const showPrompts = messages.length === 0 && !loading;

  return (
    <div className="ask-ai-root">
      {open && (
        <div className="ask-ai-panel" role="dialog" aria-label="Ask AI">
          <header className="ask-ai-header">
            <div className="ask-ai-header-title">
              <Sparkles size={18} className="ask-ai-sparkle" />
              <span>Ask AI</span>
            </div>
            <div className="ask-ai-header-actions">
              <button
                type="button"
                className="ask-ai-icon-btn"
                onClick={() => setOpen(false)}
                aria-label="Minimize"
              >
                <Minimize2 size={16} />
              </button>
              <button
                type="button"
                className="ask-ai-icon-btn"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
          </header>

          <p className="ask-ai-subtitle">
            Search your invoices, clients, and payments
          </p>

          <div className="ask-ai-messages" ref={listRef}>
            {showPrompts && (
              <div className="ask-ai-welcome">
                <p>Used for searching information across your workspace.</p>
                <div className="ask-ai-chips">
                  {suggestedPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="ask-ai-chip"
                      onClick={() => sendMessage(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={`${idx}-${msg.role}`} className={`ask-ai-message ask-ai-message--${msg.role}`}>
                <div className={`ask-ai-bubble ask-ai-bubble--${msg.role}`}>
                  {msg.content.split('\n').map((line, i) => (
                    <React.Fragment key={i}>
                      {line}
                      {i < msg.content.split('\n').length - 1 && <br />}
                    </React.Fragment>
                  ))}
                </div>
                {msg.role === 'assistant' && msg.links?.length > 0 && (
                  <div className="ask-ai-links">
                    {msg.links.map((link) => (
                      <Link
                        key={`${link.href}-${link.label}`}
                        to={link.href}
                        className="ask-ai-link"
                        onClick={handleLinkClick}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="ask-ai-bubble ask-ai-bubble--assistant ask-ai-loading">
                Thinking…
              </div>
            )}
          </div>

          <footer className="ask-ai-footer">
            <p className="ask-ai-disclaimer">
              Answers are based on your workspace data. Verify figures for compliance.
            </p>
            {status && (
              <p className="ask-ai-usage">
                AI today: {status.usedToday}/{status.dailyLimit}
              </p>
            )}
            <form className="ask-ai-form" onSubmit={handleSubmit}>
              <input
                ref={inputRef}
                type="text"
                className="ask-ai-input"
                placeholder="Message Ask AI…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
              />
              <button
                type="submit"
                className="ask-ai-send"
                disabled={loading || !input.trim()}
                aria-label="Send"
              >
                <Send size={18} />
              </button>
            </form>
          </footer>
        </div>
      )}

      <button
        type="button"
        className={`ask-ai-fab ${open ? 'ask-ai-fab--open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close Ask AI' : 'Open Ask AI'}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}

export default AskAIChat;
