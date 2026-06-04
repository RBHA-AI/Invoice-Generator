import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';

const PLACEHOLDERS = [
  '{{invoiceNumber}}',
  '{{clientName}}',
  '{{companyName}}',
  '{{invoiceDate}}',
  '{{dueDate}}',
  '{{total}}',
  '{{customMessage}}'
];

function EmailDefaults() {
  const [form, setForm] = useState({
    defaultSubjectTemplate: '',
    defaultBodyTemplate: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/email-settings');
        if (res.ok) {
          const data = await res.json();
          setForm({
            defaultSubjectTemplate: data.defaultSubjectTemplate || '',
            defaultBodyTemplate: data.defaultBodyTemplate || ''
          });
        }
      } catch (e) {
        console.error('Failed to load email settings:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/email-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save settings');
      }
      setForm({
        defaultSubjectTemplate: data.defaultSubjectTemplate,
        defaultBodyTemplate: data.defaultBodyTemplate
      });
      setMessage('Email defaults saved.');
    } catch (err) {
      setMessage(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <p>Loading email settings…</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Email Defaults</h1>
        <p className="page-subtitle">
          Set the default subject and body used when sending invoices. You can still edit these on each send.
        </p>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label className="form-label">Default subject template</label>
            <input
              type="text"
              name="defaultSubjectTemplate"
              className="form-input"
              value={form.defaultSubjectTemplate}
              onChange={handleChange}
              required
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label className="form-label">Default body template</label>
            <textarea
              name="defaultBodyTemplate"
              className="form-input"
              rows={10}
              value={form.defaultBodyTemplate}
              onChange={handleChange}
              required
            />
          </div>

          <div
            style={{
              padding: '0.75rem 1rem',
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              marginBottom: '1rem',
              fontSize: '0.875rem'
            }}
          >
            <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Available placeholders</strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {PLACEHOLDERS.map((p) => (
                <code
                  key={p}
                  style={{
                    padding: '0.2rem 0.5rem',
                    background: '#f5f5f5',
                    borderRadius: '4px',
                    fontSize: '0.8rem'
                  }}
                >
                  {p}
                </code>
              ))}
            </div>
          </div>

          {message && (
            <p
              style={{
                marginBottom: '1rem',
                color: message.includes('saved') ? '#155724' : '#c0392b',
                fontSize: '0.9rem'
              }}
            >
              {message}
            </p>
          )}

          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Defaults'}
            </button>
            <Link to="/" className="btn btn-outline">
              Back to Dashboard
            </Link>
          </div>
        </form>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: '0.5rem' }}>
          <Mail size={18} />
          <h3 style={{ margin: 0, fontFamily: 'Playfair Display, serif', color: 'var(--primary)' }}>
            Resend setup
          </h3>
        </div>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--text-light)' }}>
          Email sending uses{' '}
          <a href="https://resend.com" target="_blank" rel="noopener noreferrer">
            Resend
          </a>
          . Add these to your <code>.env</code> file and restart the server:
        </p>
        <pre
          style={{
            margin: 0,
            padding: '0.75rem 1rem',
            background: '#f5f5f5',
            borderRadius: '8px',
            fontSize: '0.8rem',
            overflowX: 'auto'
          }}
        >
{`EMAIL_PROVIDER=resend
RESEND_API_KEY=re_your_api_key
MAIL_FROM=invoices@yourdomain.com
MAIL_FROM_NAME=R Bhargava & Associates`}
        </pre>
        <p style={{ margin: '0.75rem 0 0', fontSize: '0.85rem', color: 'var(--text-light)' }}>
          Verify your domain in the Resend dashboard before sending to clients. For testing, Resend provides a sandbox
          sender address.
        </p>
      </div>
    </div>
  );
}

export default EmailDefaults;
