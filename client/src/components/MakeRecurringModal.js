import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { readApiJson } from '../utils/apiResponse';
import {
  formatInvoiceAmount,
  normalizeAmountInWordsCurrency
} from '../utils/invoiceCalculations';

const FREQUENCY_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semi_annual', label: 'Semi-annual' },
  { value: 'annual', label: 'Annual' }
];

const todayIso = () => new Date().toISOString().split('T')[0];

function computeDueDateOffset(invoice) {
  const invoiceDate = String(invoice?.invoiceDate || '').split('T')[0];
  const dueDate = String(invoice?.dueDate || '').split('T')[0];
  if (!invoiceDate || !dueDate) return 30;
  const start = new Date(`${invoiceDate}T12:00:00`);
  const end = new Date(`${dueDate}T12:00:00`);
  const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
  return Number.isFinite(diff) && diff >= 0 ? diff : 30;
}

function frequencyLabel(value) {
  return FREQUENCY_OPTIONS.find((o) => o.value === value)?.label || value;
}

function MakeRecurringModal({ invoice, onClose, onCreated }) {
  const navigate = useNavigate();
  const currency = normalizeAmountInWordsCurrency(invoice?.amountInWordsCurrency);
  const defaultFrequency = 'monthly';

  const [form, setForm] = useState({
    name: `${invoice?.clientName || 'Client'} — ${frequencyLabel(defaultFrequency)}`,
    amountType: 'fixed',
    frequency: defaultFrequency,
    startDate: todayIso(),
    neverEnds: true,
    endDate: '',
    dueDateOffsetDays: computeDueDateOffset(invoice)
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const itemCount = invoice?.items?.length || 0;
  const summaryTotal = formatInvoiceAmount(invoice?.total || 0, currency);

  const handleFrequencyChange = (frequency) => {
    setForm((prev) => ({
      ...prev,
      frequency,
      name: `${invoice?.clientName || 'Client'} — ${frequencyLabel(frequency)}`
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/recurring-bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceInvoiceId: invoice.id,
          name: form.name.trim(),
          amountType: form.amountType,
          frequency: form.frequency,
          startDate: form.startDate,
          endDate: form.neverEnds ? null : form.endDate || null,
          dueDateOffsetDays: parseInt(form.dueDateOffsetDays, 10) || 0
        })
      });
      const data = await readApiJson(res);
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create recurring bill');
      }
      if (onCreated) {
        onCreated(data);
      } else {
        alert('Recurring bill created successfully.');
        navigate('/recurring-bills');
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create recurring bill');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h2 className="modal-title">Make Recurring Bill</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div
              style={{
                padding: '0.875rem 1rem',
                background: 'var(--bg-light, #f8fafc)',
                borderRadius: 8,
                marginBottom: '1rem',
                fontSize: '0.9rem'
              }}
            >
              <div><strong>Client:</strong> {invoice?.clientName || '—'}</div>
              <div><strong>Company:</strong> {invoice?.companyName || '—'}</div>
              <div><strong>Total:</strong> {summaryTotal}</div>
              <div><strong>Line items:</strong> {itemCount}</div>
              <div style={{ marginTop: '0.5rem', color: 'var(--text-light)' }}>
                Source invoice {invoice?.invoiceNumber} will not be modified.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Profile name</label>
              <input
                type="text"
                className="form-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Amount type</label>
              <div className="flex gap-4" style={{ marginTop: '0.35rem' }}>
                <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="amountType"
                    value="fixed"
                    checked={form.amountType === 'fixed'}
                    onChange={() => setForm({ ...form, amountType: 'fixed' })}
                  />
                  Fixed
                </label>
                <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="amountType"
                    value="varying"
                    checked={form.amountType === 'varying'}
                    onChange={() => setForm({ ...form, amountType: 'varying' })}
                  />
                  Varying
                </label>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '0.35rem' }}>
                {form.amountType === 'fixed'
                  ? 'Each generated invoice will use the same amounts from this invoice.'
                  : 'Each cycle creates a draft invoice with pre-filled amounts you can edit before saving.'}
              </p>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Billing cycle</label>
                <select
                  className="form-select"
                  value={form.frequency}
                  onChange={(e) => handleFrequencyChange(e.target.value)}
                >
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Start date</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.neverEnds}
                  onChange={(e) => setForm({ ...form, neverEnds: e.target.checked })}
                />
                Never ends
              </label>
            </div>

            {!form.neverEnds && (
              <div className="form-group">
                <label className="form-label">End date</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  min={form.startDate}
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Payment terms (due in days)</label>
              <input
                type="number"
                className="form-input"
                min="0"
                value={form.dueDateOffsetDays}
                onChange={(e) => setForm({ ...form, dueDateOffsetDays: e.target.value })}
              />
            </div>

            {error && (
              <p style={{ color: 'var(--danger, #b91c1c)', fontSize: '0.875rem' }}>{error}</p>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || itemCount < 1}>
              {submitting ? 'Creating…' : 'Create Recurring Bill'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MakeRecurringModal;
