import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { X, Mail } from 'lucide-react';
import SendEmailModal from '../components/SendEmailModal';
import {
  normalizeAmountInWordsCurrency,
  formatInvoiceAmount
} from '../utils/invoiceCalculations';

const PAYMENT_MODES = ['Cash', 'Cheque', 'Bank Transfer', 'UPI', 'Credit Card', 'Other'];

const todayIso = () => new Date().toISOString().split('T')[0];

function InvoiceView() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [items, setItems] = useState([]);
  const [payments, setPayments] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailHistory, setEmailHistory] = useState([]);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    paymentNumber: '',
    amountReceived: '',
    bankCharges: '0',
    paymentDate: todayIso(),
    paymentMode: 'Bank Transfer',
    reference: '',
    notes: ''
  });
  const navigate = useNavigate();

  const applyInvoiceData = (data) => {
    setInvoice(data);
    setItems(data.items || []);
    setPayments(data.payments || []);
  };

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const res = await fetch(`/api/invoices/${id}`);
        if (!res.ok) throw new Error('Invoice not found');
        const data = await res.json();
        applyInvoiceData(data);
      } catch (e) {
        console.error('Error fetching invoice:', e);
      }
    };
    const fetchEmailHistory = async () => {
      try {
        const res = await fetch(`/api/invoices/${id}/email-history`);
        if (res.ok) {
          setEmailHistory(await res.json());
        }
      } catch (e) {
        console.warn('Could not load email history:', e);
      }
    };
    fetchInvoice();
    fetchEmailHistory();
  }, [id]);

  const handleEdit = () => {
    navigate(`/invoice?edit=${id}`);
  };

  const handleClone = () => {
    navigate(`/invoice?clone=${id}`);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete invoice ${invoice?.invoiceNumber || ''}? This cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        let message = 'Failed to delete invoice.';
        try {
          const data = await res.json();
          if (data && data.error) message = data.error;
        } catch (_) {}
        alert(message);
        return;
      }
      navigate('/invoices');
    } catch (e) {
      console.error('Error deleting invoice:', e);
      alert('Error deleting invoice. Please check the server logs.');
    }
  };

  const fetchNextPaymentNumber = async () => {
    try {
      const numRes = await fetch('/api/payments/next-number');
      const contentType = numRes.headers.get('content-type') || '';
      if (!numRes.ok || !contentType.includes('application/json')) {
        return '';
      }
      const numData = await numRes.json();
      return String(numData.paymentNumber ?? '');
    } catch (e) {
      console.warn('Could not prefetch payment number:', e);
      return '';
    }
  };

  const openPaymentModal = async () => {
    const paymentNumber = await fetchNextPaymentNumber();
    setPaymentForm({
      paymentNumber: paymentNumber || '—',
      amountReceived: String(invoice?.total ?? ''),
      bankCharges: '0',
      paymentDate: todayIso(),
      paymentMode: 'Bank Transfer',
      reference: '',
      notes: ''
    });
    setShowPaymentModal(true);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
  };

  const handlePaymentFormChange = (e) => {
    const { name, value } = e.target;
    setPaymentForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    setPaymentSubmitting(true);
    try {
      const res = await fetch(`/api/invoices/${id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountReceived: parseFloat(paymentForm.amountReceived),
          bankCharges: parseFloat(paymentForm.bankCharges) || 0,
          paymentDate: paymentForm.paymentDate,
          paymentMode: paymentForm.paymentMode,
          reference: paymentForm.reference,
          notes: paymentForm.notes
        })
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        alert(
          'Payment API is not available. Stop and restart the backend (npm run dev), then try again.'
        );
        return;
      }

      if (!res.ok) {
        let message = 'Failed to record payment.';
        try {
          const data = await res.json();
          if (data && data.error) message = data.error;
        } catch (_) {}
        alert(message);
        return;
      }

      const data = await res.json();
      applyInvoiceData(data);
      closePaymentModal();
    } catch (err) {
      console.error('Error recording payment:', err);
      alert('Error recording payment. Please check the server logs.');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handleEmailSent = async () => {
    try {
      const res = await fetch(`/api/invoices/${id}/email-history`);
      if (res.ok) {
        setEmailHistory(await res.json());
      }
    } catch (e) {
      console.warn('Could not refresh email history:', e);
    }
  };

  if (!invoice) return (
    <div className="card">
      <p>Loading invoice...</p>
      <p><Link to="/">Back to dashboard</Link></p>
    </div>
  );

  const isPaid = invoice.status === 'paid';
  const invoiceCurrency = normalizeAmountInWordsCurrency(invoice.amountInWordsCurrency);
  const formatAmount = (amount) => formatInvoiceAmount(amount, invoiceCurrency);

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Invoice {invoice.invoiceNumber}</h1>
          <p className="page-subtitle">
            {invoice.clientName} —{' '}
            {invoice.invoiceDate
              ? new Date(invoice.invoiceDate).toLocaleDateString('en-GB')
              : '-'}
            {emailHistory[0]?.status === 'sent' && emailHistory[0]?.sentAt && (
              <>
                {' '}
                · Last emailed{' '}
                {new Date(emailHistory[0].sentAt).toLocaleString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => setShowEmailModal(true)}>
            <Mail size={16} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            Send Email
          </button>
          {!isPaid && (
            <button className="btn btn-secondary" onClick={openPaymentModal}>
              Record Payment
            </button>
          )}
          <button className="btn btn-outline" onClick={handleClone}>
            Clone
          </button>
          <button className="btn btn-danger" onClick={handleDelete}>
            Delete
          </button>
          <button className="btn btn-primary" onClick={handleEdit}>
            Edit
          </button>
        </div>
      </div>

      <div className="card">
        <div
          className="flex justify-between items-start"
          style={{ gap: '2rem', marginBottom: '1.5rem' }}
        >
          <div>
            <h3
              style={{
                fontFamily: 'Playfair Display, serif',
                fontSize: '1.25rem',
                marginBottom: '0.75rem',
                color: 'var(--primary)'
              }}
            >
              Invoice Details
            </h3>
            <div style={{ marginBottom: '0.25rem' }}>
              <span style={{ color: 'var(--text-light)' }}>Invoice Number</span>{' '}
              <strong>{invoice.invoiceNumber}</strong>
            </div>
            <div style={{ marginBottom: '0.25rem' }}>
              <span style={{ color: 'var(--text-light)' }}>Invoice Date</span>{' '}
              {invoice.invoiceDate
                ? new Date(invoice.invoiceDate).toLocaleDateString('en-GB')
                : '-'}
            </div>
            <div style={{ marginBottom: '0.25rem' }}>
              <span style={{ color: 'var(--text-light)' }}>Due Date</span>{' '}
              {invoice.dueDate
                ? new Date(invoice.dueDate).toLocaleDateString('en-GB')
                : '-'}
            </div>
            <div style={{ marginBottom: '0.25rem' }}>
              <span style={{ color: 'var(--text-light)' }}>Client</span>{' '}
              <strong>{invoice.clientName}</strong>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <span
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: '999px',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  background:
                    invoice.status === 'paid'
                      ? '#d4edda'
                      : invoice.status === 'draft'
                      ? '#e0f2fe'
                      : '#fff3cd',
                  color:
                    invoice.status === 'paid'
                      ? '#166534'
                      : invoice.status === 'draft'
                      ? '#075985'
                      : '#854d0e'
                }}
              >
                {invoice.status || 'draft'}
              </span>
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-light)' }}>
              Total Amount
            </div>
            <div
              style={{
                fontSize: '1.5rem',
                fontWeight: 600,
                color: 'var(--primary)'
              }}
            >
              {formatAmount(invoice.total)}
            </div>
          </div>
        </div>

        {invoice.bankName && (
          <div
            style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              borderRadius: '8px',
              background: '#f9fafb',
              border: '1px solid var(--border)'
            }}
          >
            <strong style={{ display: 'block', marginBottom: '0.5rem' }}>
              Bank Details
            </strong>
            <div>BANK NAME: {invoice.bankName}</div>
            <div>BRANCH: {invoice.bankBranch}</div>
            <div>ACCOUNT NO: {invoice.bankAccount}</div>
            <div>IFSC: {invoice.ifsc}</div>
          </div>
        )}

        {payments.length > 0 && (
          <div
            style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              borderRadius: '8px',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0'
            }}
          >
            <strong style={{ display: 'block', marginBottom: '0.75rem', color: '#166534' }}>
              Payment Recorded
            </strong>
            {payments.map((p) => (
              <div key={p.id} style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                <div>
                  <strong>Payment #{p.paymentNumber}</strong>
                  {' — '}
                  {formatAmount(p.amountReceived)}
                  {p.paymentMode ? ` via ${p.paymentMode}` : ''}
                </div>
                <div style={{ color: 'var(--text-light)' }}>
                  Date:{' '}
                  {p.paymentDate
                    ? new Date(p.paymentDate).toLocaleDateString('en-GB')
                    : '-'}
                  {p.reference ? ` · Ref: ${p.reference}` : ''}
                  {parseFloat(p.bankCharges) > 0
                    ? ` · Bank charges: ${formatAmount(p.bankCharges)}`
                    : ''}
                </div>
                {p.notes ? (
                  <div style={{ color: 'var(--text-light)', marginTop: '0.25rem' }}>
                    Notes: {p.notes}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        <h3
          style={{
            fontFamily: 'Playfair Display, serif',
            fontSize: '1.25rem',
            marginBottom: '0.75rem',
            color: 'var(--primary)'
          }}
        >
          Line Items
        </h3>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>S.No</th>
                <th>Description</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && invoice.total > 0 && (
                <tr>
                  <td colSpan={5} style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>
                    No line items are stored for this invoice (totals may be from an older save). Open{' '}
                    <strong>Edit</strong> and re-enter the lines, then save to restore them.
                  </td>
                </tr>
              )}
              {items.map((it, idx) => {
                const desc = [it.description, it.detailedDescription].filter(Boolean).join(' — ');
                return (
                  <tr key={it.id || idx}>
                    <td>{idx + 1}</td>
                    <td>
                      {desc || '—'}
                      {it.hsnSac ? (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>
                          HSN/SAC: {it.hsnSac}
                        </div>
                      ) : null}
                    </td>
                    <td>{parseFloat(it.quantity || 0).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {formatAmount(parseFloat(it.rate || 0))}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {formatAmount(parseFloat(it.amount || 0))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div
          className="flex justify-between items-center"
          style={{ marginTop: '1rem' }}
        >
          <Link to="/" style={{ fontSize: '0.9rem' }}>
            Back to dashboard
          </Link>
        </div>
      </div>

      {showPaymentModal && (
        <div className="modal-overlay" onClick={closePaymentModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h2 className="modal-title">
                Payment for {invoice.invoiceNumber}
              </h2>
              <button type="button" className="modal-close" onClick={closePaymentModal}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRecordPayment}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Customer</label>
                  <input
                    type="text"
                    className="form-input"
                    value={invoice.clientName || ''}
                    readOnly
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Payment # <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    name="paymentNumber"
                    className="form-input"
                    value={paymentForm.paymentNumber}
                    readOnly
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Amount Received ({invoiceCurrency === 'aud' ? 'AUD' : 'INR'}){' '}
                    <span className="required">*</span>
                  </label>
                  <input
                    type="number"
                    name="amountReceived"
                    className="form-input"
                    value={paymentForm.amountReceived}
                    onChange={handlePaymentFormChange}
                    min="0"
                    step="0.01"
                    required
                  />
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>
                    Must equal invoice total: {formatAmount(invoice.total)}
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label">Bank Charges (if any)</label>
                  <input
                    type="number"
                    name="bankCharges"
                    className="form-input"
                    value={paymentForm.bankCharges}
                    onChange={handlePaymentFormChange}
                    min="0"
                    step="0.01"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Payment Date <span className="required">*</span>
                  </label>
                  <input
                    type="date"
                    name="paymentDate"
                    className="form-input"
                    value={paymentForm.paymentDate}
                    onChange={handlePaymentFormChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Mode</label>
                  <select
                    name="paymentMode"
                    className="form-input"
                    value={paymentForm.paymentMode}
                    onChange={handlePaymentFormChange}
                  >
                    {PAYMENT_MODES.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Reference #</label>
                  <input
                    type="text"
                    name="reference"
                    className="form-input"
                    value={paymentForm.reference}
                    onChange={handlePaymentFormChange}
                    placeholder="Cheque no., UTR, etc."
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea
                    name="notes"
                    className="form-textarea"
                    value={paymentForm.notes}
                    onChange={handlePaymentFormChange}
                    rows={3}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={closePaymentModal}
                  disabled={paymentSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={paymentSubmitting}
                >
                  {paymentSubmitting ? 'Recording…' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEmailModal && (
        <SendEmailModal
          invoice={invoice}
          onClose={() => setShowEmailModal(false)}
          onSent={handleEmailSent}
        />
      )}
    </div>
  );
}

export default InvoiceView;
