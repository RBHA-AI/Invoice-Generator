import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Sparkles, Mail, Copy, Download } from 'lucide-react';
import InvoicePreview from './InvoicePreview';
import { invoiceToPreviewData } from '../utils/invoiceCalculations';
import { generateInvoicePdfBlob, downloadInvoicePdf } from '../utils/generateInvoicePdf';
import { readApiJson } from '../utils/apiResponse';
import '../pages/InvoiceGenerator.css';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function SendEmailModal({ invoice, onClose, onSent }) {
  const previewRef = useRef(null);
  const previewData = invoice ? invoiceToPreviewData(invoice) : null;
  const isManualMode = (status) => !status.configured;

  const [form, setForm] = useState({
    fromEmail: '',
    to: '',
    cc: '',
    subject: '',
    body: '',
    aiPrompt: '',
    attachPdf: true
  });
  const [emailStatus, setEmailStatus] = useState({
    configured: false,
    provider: 'none',
    smtpConfigured: false,
    openaiConfigured: false
  });
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [sending, setSending] = useState(false);
  const [manualBusy, setManualBusy] = useState(false);
  const [draftHint, setDraftHint] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const manual = isManualMode(emailStatus);

  useEffect(() => {
    const load = async () => {
      try {
        const [statusRes, draftRes] = await Promise.all([
          fetch('/api/email/status'),
          fetch(`/api/invoices/${invoice.id}/render-email-template`, { method: 'POST' })
        ]);
        if (statusRes.ok) {
          const status = await statusRes.json();
          setEmailStatus({
            configured: status.configured ?? status.smtpConfigured ?? false,
            provider: status.provider || 'none',
            smtpConfigured: status.configured ?? status.smtpConfigured ?? false,
            openaiConfigured: status.openaiConfigured ?? false
          });
        }
        if (draftRes.ok) {
          const draft = await draftRes.json();
          setForm((prev) => ({
            ...prev,
            fromEmail: invoice.companyEmail || prev.fromEmail,
            to: invoice.primaryContactEmail || prev.to,
            subject: draft.subject || prev.subject,
            body: draft.body || prev.body
          }));
        } else {
          setForm((prev) => ({
            ...prev,
            fromEmail: invoice.companyEmail || prev.fromEmail,
            to: invoice.primaryContactEmail || prev.to
          }));
        }
      } catch (e) {
        console.error('Failed to load email defaults:', e);
      }
    };
    if (invoice?.id) load();
  }, [invoice]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setSuccessMsg('');
  };

  const handleGenerateDraft = async () => {
    setLoadingDraft(true);
    setDraftHint('');
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/generate-email-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPrompt: form.aiPrompt, tone: 'professional' })
      });
      const data = await readApiJson(res);
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate draft');
      }
      setForm((prev) => ({
        ...prev,
        subject: data.subject || prev.subject,
        body: data.body || prev.body
      }));
      if (data.hint) setDraftHint(data.hint);
      if (data.used === 'llm') {
        setSuccessMsg('AI draft generated. Review and edit before sending.');
      } else if (data.subject || data.body) {
        setSuccessMsg('Draft updated from template.');
      }
    } catch (e) {
      setError(e.message || 'Failed to generate email draft');
    } finally {
      setLoadingDraft(false);
    }
  };

  const buildEmailTextForClipboard = () => {
    const lines = [];
    if (form.to) lines.push(`To: ${form.to}`);
    if (form.cc) lines.push(`CC: ${form.cc}`);
    if (form.fromEmail) lines.push(`From: ${form.fromEmail}`);
    if (form.subject) lines.push(`Subject: ${form.subject}`);
    lines.push('');
    lines.push(form.body || '');
    return lines.join('\n');
  };

  const ensurePreviewReady = () => {
    if (!previewRef.current) {
      throw new Error('Invoice preview is not ready. Please try again in a moment.');
    }
  };

  const handleCopyEmail = async () => {
    setError('');
    setSuccessMsg('');
    try {
      const text = buildEmailTextForClipboard();
      if (!text.trim()) {
        throw new Error('Subject and body are empty. Generate or edit the email first.');
      }
      await navigator.clipboard.writeText(text);
      setSuccessMsg('Email text copied. Paste it into Outlook, Gmail, or any mail app.');
    } catch (e) {
      setError(e.message || 'Could not copy to clipboard');
    }
  };

  const handleDownloadPdfOnly = async () => {
    setManualBusy(true);
    setError('');
    setSuccessMsg('');
    try {
      ensurePreviewReady();
      await downloadInvoicePdf(previewRef.current, invoice.invoiceNumber);
      setSuccessMsg('PDF downloaded. Attach it when you send the email manually.');
    } catch (e) {
      setError(e.message || 'Failed to download PDF');
    } finally {
      setManualBusy(false);
    }
  };

  const handleOpenMailApp = () => {
    setError('');
    setSuccessMsg('');
    if (!form.to.trim()) {
      setError('Enter a recipient (To) address first.');
      return;
    }
    const params = new URLSearchParams();
    params.set('to', form.to.trim());
    if (form.cc.trim()) params.set('cc', form.cc.trim());
    if (form.subject.trim()) params.set('subject', form.subject.trim());
    if (form.body.trim()) params.set('body', form.body.trim());
    window.location.href = `mailto:?${params.toString()}`;
    setSuccessMsg(
      'Your mail app should open with To, subject, and body filled in. Download the PDF and attach it before sending.'
    );
  };

  const validateFormForSend = () => {
    if (!EMAIL_REGEX.test(form.fromEmail.trim())) {
      return 'Please enter a valid sender email address.';
    }
    if (!EMAIL_REGEX.test(form.to.trim())) {
      return 'Please enter a valid recipient email address.';
    }
    if (form.cc.trim()) {
      const ccList = form.cc.split(',').map((e) => e.trim()).filter(Boolean);
      if (!ccList.every((e) => EMAIL_REGEX.test(e))) {
        return 'One or more CC addresses are invalid.';
      }
    }
    if (!form.subject.trim()) return 'Subject is required.';
    if (!form.body.trim()) return 'Email body is required.';
    if (!emailStatus.configured) {
      return 'Email is not configured on the server.';
    }
    return '';
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const validationError = validateFormForSend();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSending(true);
    setError('');
    setSuccessMsg('');
    try {
      const formData = new FormData();
      formData.append('fromEmail', form.fromEmail.trim());
      formData.append('to', form.to.trim());
      formData.append('cc', form.cc.trim());
      formData.append('subject', form.subject.trim());
      formData.append('body', form.body.trim());

      if (form.attachPdf) {
        ensurePreviewReady();
        const { blob, filename } = await generateInvoicePdfBlob(
          previewRef.current,
          invoice.invoiceNumber
        );
        formData.append('pdf', blob, filename);
      }

      const res = await fetch(`/api/invoices/${invoice.id}/send-email`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send email');
      }
      if (onSent) onSent(data);
      onClose();
      alert('Invoice email sent successfully.');
    } catch (err) {
      setError(err.message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  if (!invoice || !previewData) return null;

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: '100%', maxWidth: 720, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontFamily: 'Playfair Display, serif', color: 'var(--primary)' }}>
            <Mail size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />
            {manual ? 'Prepare invoice email' : 'Send Invoice by Email'}
          </h2>
          <button type="button" className="btn btn-outline" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {manual && (
          <div
            style={{
              padding: '0.75rem 1rem',
              background: '#e8f4fc',
              color: '#0c5460',
              borderRadius: '8px',
              marginBottom: '1rem',
              fontSize: '0.9rem',
              lineHeight: 1.5
            }}
          >
            <strong>Manual send (no server email setup needed)</strong>
            <ol style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
              <li>Download the invoice PDF</li>
              <li>Copy the email text (or open your mail app)</li>
              <li>Send from Outlook, Gmail, or your usual mailbox and attach the PDF</li>
            </ol>
          </div>
        )}

        {!invoice.primaryContactEmail && (
          <div
            style={{
              padding: '0.75rem 1rem',
              background: '#f8d7da',
              color: '#721c24',
              borderRadius: '8px',
              marginBottom: '1rem',
              fontSize: '0.9rem'
            }}
          >
            This client has no email on file.{' '}
            <Link to="/clients" style={{ color: 'inherit', fontWeight: 600 }}>
              Add a contact email in Clients
            </Link>
            .
          </div>
        )}

        <form onSubmit={manual ? (e) => e.preventDefault() : handleSend}>
          <div className="form-grid" style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <label className="form-label">From (sender email)</label>
              <input
                type="email"
                name="fromEmail"
                className="form-input"
                value={form.fromEmail}
                onChange={handleChange}
                required={!manual}
                placeholder="you@yourfirm.com"
              />
            </div>
            <div>
              <label className="form-label">To</label>
              <input
                type="email"
                name="to"
                className="form-input"
                value={form.to}
                onChange={handleChange}
                required={!manual}
              />
            </div>
            <div>
              <label className="form-label">CC (comma-separated, optional)</label>
              <input
                type="text"
                name="cc"
                className="form-input"
                value={form.cc}
                onChange={handleChange}
                placeholder="cc@example.com"
              />
            </div>
            <div>
              <label className="form-label">Subject</label>
              <input
                type="text"
                name="subject"
                className="form-input"
                value={form.subject}
                onChange={handleChange}
                required={!manual}
              />
            </div>
            <div>
              <label className="form-label">AI prompt (optional)</label>
              <textarea
                name="aiPrompt"
                className="form-input"
                rows={2}
                value={form.aiPrompt}
                onChange={handleChange}
                placeholder="e.g. Polite payment reminder, mention due date"
              />
              <div
                style={{
                  marginTop: '0.5rem',
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'center',
                  flexWrap: 'wrap'
                }}
              >
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleGenerateDraft}
                  disabled={loadingDraft}
                >
                  <Sparkles size={16} />
                  {loadingDraft ? 'Generating…' : 'Generate with AI'}
                </button>
                {!emailStatus.openaiConfigured && (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                    OpenAI not loaded — uses template + your note (restart server after .env change)
                  </span>
                )}
                <Link to="/email-defaults" style={{ fontSize: '0.85rem', marginLeft: 'auto' }}>
                  Edit default template
                </Link>
              </div>
              {draftHint && (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', margin: '0.5rem 0 0' }}>
                  {draftHint}
                </p>
              )}
            </div>
            <div>
              <label className="form-label">Email body</label>
              <textarea
                name="body"
                className="form-input"
                rows={8}
                value={form.body}
                onChange={handleChange}
                required={!manual}
              />
            </div>
            {!manual && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  name="attachPdf"
                  checked={form.attachPdf}
                  onChange={handleChange}
                />
                Attach invoice PDF
              </label>
            )}
          </div>

          {error && (
            <p style={{ color: '#c0392b', marginTop: '1rem', fontSize: '0.9rem' }}>{error}</p>
          )}
          {successMsg && (
            <p style={{ color: '#155724', marginTop: '1rem', fontSize: '0.9rem' }}>{successMsg}</p>
          )}

          <div
            className="flex gap-2"
            style={{ marginTop: '1.25rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}
          >
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={sending}>
              Cancel
            </button>
            {manual ? (
              <>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleDownloadPdfOnly}
                  disabled={manualBusy}
                >
                  <Download size={16} />
                  {manualBusy ? 'Preparing…' : 'Download PDF'}
                </button>
                <button type="button" className="btn btn-outline" onClick={handleCopyEmail}>
                  <Copy size={16} />
                  Copy email text
                </button>
                <button type="button" className="btn btn-primary" onClick={handleOpenMailApp}>
                  Open mail app
                </button>
              </>
            ) : (
              <button type="submit" className="btn btn-primary" disabled={sending}>
                {sending ? 'Sending…' : 'Send Email'}
              </button>
            )}
          </div>
        </form>

        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: '-9999px',
            top: 0,
            width: '794px',
            pointerEvents: 'none',
            opacity: 0
          }}
        >
          <div className="invoice-preview">
            <InvoicePreview
              ref={previewRef}
              invoiceNumber={previewData.invoiceNumber}
              formData={previewData.formData}
              selectedClient={previewData.selectedClient}
              selectedCompany={previewData.selectedCompany}
              isInterState={previewData.isInterState}
              amountInWordsCurrency={previewData.amountInWordsCurrency}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default SendEmailModal;
