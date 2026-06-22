import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Sparkles, Send, Copy, Download, Paperclip, ChevronDown, ChevronUp } from 'lucide-react';
import InvoicePreview from './InvoicePreview';
import { invoiceToPreviewData } from '../utils/invoiceCalculations';
import { generateInvoicePdfBlob, downloadInvoicePdf } from '../utils/generateInvoicePdf';
import { readApiJson } from '../utils/apiResponse';
import { apiFetch } from '../utils/api';
import './SendEmailModal.css';

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
    openaiConfigured: false,
    defaultFromEmail: ''
  });
  const [showCc, setShowCc] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [sending, setSending] = useState(false);
  const [manualBusy, setManualBusy] = useState(false);
  const [draftHint, setDraftHint] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const manual = isManualMode(emailStatus);
  const pdfFilename = `Invoice-${invoice?.invoiceNumber || 'draft'}.pdf`;

  useEffect(() => {
    const load = async () => {
      try {
        const [statusRes, draftRes] = await Promise.all([
          apiFetch('/api/email/status'),
          apiFetch(`/api/invoices/${invoice.id}/render-email-template`, { method: 'POST' })
        ]);

        let status = { configured: false, provider: 'none', openaiConfigured: false, defaultFromEmail: '' };
        if (statusRes.ok) {
          status = await statusRes.json();
          setEmailStatus({
            configured: status.configured ?? status.smtpConfigured ?? false,
            provider: status.provider || 'none',
            smtpConfigured: status.configured ?? status.smtpConfigured ?? false,
            openaiConfigured: status.openaiConfigured ?? false,
            defaultFromEmail: status.defaultFromEmail || ''
          });
        }

        const fromEmail =
          invoice.companyEmail || status.defaultFromEmail || '';

        if (draftRes.ok) {
          const draft = await draftRes.json();
          setForm((prev) => ({
            ...prev,
            fromEmail,
            to: invoice.primaryContactEmail || prev.to,
            subject: draft.subject || prev.subject,
            body: draft.body || prev.body
          }));
        } else {
          setForm((prev) => ({
            ...prev,
            fromEmail,
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
      const res = await apiFetch(`/api/invoices/${invoice.id}/generate-email-draft`, {
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
      setSuccessMsg('Email text copied. Paste it into Gmail or your mail app.');
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
    if (e) e.preventDefault();
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

      const res = await apiFetch(`/api/invoices/${invoice.id}/send-email`, {
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="email-compose-modal" onClick={(e) => e.stopPropagation()}>
        <div className="email-compose-toolbar">
          <div className="email-compose-toolbar-left">
            {!manual && (
              <button
                type="button"
                className="email-compose-send-btn"
                onClick={handleSend}
                disabled={sending}
              >
                <Send size={16} />
                {sending ? 'Sending…' : 'Send'}
              </button>
            )}
            <h2 className="email-compose-title">
              {manual ? 'Prepare invoice email' : `Invoice ${invoice.invoiceNumber}`}
            </h2>
          </div>
          <button type="button" className="email-compose-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="email-compose-body">
          {manual && (
            <div className="email-compose-alert email-compose-alert-info">
              <strong>Manual send</strong> — download the PDF, then copy text or open your mail app.
              No server SMTP setup required.
            </div>
          )}

          {!invoice.primaryContactEmail && (
            <div className="email-compose-alert email-compose-alert-warn">
              This client has no email on file.{' '}
              <Link to="/clients" style={{ color: 'inherit', fontWeight: 600 }}>
                Add a contact email in Clients
              </Link>
              .
            </div>
          )}

          <form onSubmit={manual ? (e) => e.preventDefault() : handleSend}>
            <div className="email-compose-fields">
              <div className="email-compose-row">
                <span className="email-compose-row-label">From</span>
                <input
                  type="email"
                  name="fromEmail"
                  className="email-compose-row-input"
                  value={form.fromEmail}
                  onChange={handleChange}
                  required={!manual}
                  placeholder="you@yourfirm.com"
                />
              </div>

              <div className="email-compose-row">
                <span className="email-compose-row-label">To</span>
                <input
                  type="email"
                  name="to"
                  className="email-compose-row-input"
                  value={form.to}
                  onChange={handleChange}
                  required={!manual}
                  placeholder="client@example.com"
                />
                {!showCc && (
                  <div className="email-compose-row-actions">
                    <button
                      type="button"
                      className="email-compose-cc-toggle"
                      onClick={() => setShowCc(true)}
                    >
                      Cc
                    </button>
                  </div>
                )}
              </div>

              {showCc && (
                <div className="email-compose-row">
                  <span className="email-compose-row-label">Cc</span>
                  <input
                    type="text"
                    name="cc"
                    className="email-compose-row-input"
                    value={form.cc}
                    onChange={handleChange}
                    placeholder="cc@example.com"
                  />
                </div>
              )}

              <div className="email-compose-row">
                <span className="email-compose-row-label">Subject</span>
                <input
                  type="text"
                  name="subject"
                  className="email-compose-row-input"
                  value={form.subject}
                  onChange={handleChange}
                  required={!manual}
                />
              </div>
            </div>

            <div className="email-compose-message">
              <textarea
                name="body"
                className="email-compose-textarea"
                value={form.body}
                onChange={handleChange}
                required={!manual}
                placeholder="Write your message…"
              />
            </div>

            <div className="email-compose-attachments">
              {form.attachPdf ? (
                <span className="email-compose-attachment-chip">
                  <Paperclip size={14} />
                  {pdfFilename}
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, attachPdf: false }))}
                    aria-label="Remove attachment"
                  >
                    <X size={14} />
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ fontSize: '0.82rem', padding: '0.35rem 0.65rem' }}
                  onClick={() => setForm((prev) => ({ ...prev, attachPdf: true }))}
                >
                  <Paperclip size={14} />
                  Attach PDF
                </button>
              )}
            </div>

            <div className="email-compose-more">
              <button
                type="button"
                className="email-compose-more-toggle"
                onClick={() => setShowMore((v) => !v)}
              >
                <span>More options — AI draft &amp; templates</span>
                {showMore ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {showMore && (
                <div className="email-compose-more-panel">
                  <textarea
                    name="aiPrompt"
                    className="form-input"
                    rows={2}
                    value={form.aiPrompt}
                    onChange={handleChange}
                    placeholder="e.g. Polite payment reminder, mention due date"
                  />
                  <div className="email-compose-more-actions">
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
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}>
                        OpenAI not loaded — uses template + your note
                      </span>
                    )}
                    <Link to="/email-defaults" style={{ fontSize: '0.82rem', marginLeft: 'auto' }}>
                      Edit default template
                    </Link>
                  </div>
                  {draftHint && (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-light)', margin: '0.5rem 0 0' }}>
                      {draftHint}
                    </p>
                  )}
                </div>
              )}
            </div>

            {error && (
              <p className="email-compose-status email-compose-status-error">{error}</p>
            )}
            {successMsg && (
              <p className="email-compose-status email-compose-status-success">{successMsg}</p>
            )}

            {manual && (
              <div className="email-compose-footer">
                <button type="button" className="btn btn-outline" onClick={onClose} disabled={manualBusy}>
                  Cancel
                </button>
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
                  Copy text
                </button>
                <button type="button" className="btn btn-primary" onClick={handleOpenMailApp}>
                  Open mail app
                </button>
              </div>
            )}
          </form>
        </div>

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
