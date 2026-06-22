import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Play,
  Pause,
  Edit2,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from 'lucide-react';
import { apiFetch } from '../utils/api';
import { readApiJson } from '../utils/apiResponse';

const FREQUENCY_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semi_annual', label: 'Semi-annual' },
  { value: 'annual', label: 'Annual' }
];

function frequencyLabel(value) {
  return FREQUENCY_OPTIONS.find((o) => o.value === value)?.label || value;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function statusBadge(status) {
  const styles = {
    active: { bg: '#d4edda', color: '#166534' },
    paused: { bg: '#fff3cd', color: '#854d0e' },
    completed: { bg: '#e0f2fe', color: '#075985' },
    cancelled: { bg: '#f3f4f6', color: '#6b7280' }
  };
  const style = styles[status] || styles.active;
  return (
    <span
      style={{
        padding: '0.25rem 0.625rem',
        borderRadius: 999,
        fontSize: '0.75rem',
        fontWeight: 500,
        textTransform: 'uppercase',
        background: style.bg,
        color: style.color
      }}
    >
      {status}
    </span>
  );
}

function RecurringBills() {
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [cycleDetails, setCycleDetails] = useState({});
  const [loadingCycles, setLoadingCycles] = useState({});
  const [generatingId, setGeneratingId] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    frequency: 'monthly',
    nextRunDate: '',
    neverEnds: true,
    endDate: '',
    dueDateOffsetDays: 30
  });
  const [editSubmitting, setEditSubmitting] = useState(false);

  const fetchBills = async () => {
    try {
      const res = await apiFetch('/api/recurring-bills');
      const data = await res.json();
      setBills(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching recurring bills:', error);
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  const filteredBills = bills.filter((bill) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      String(bill.name || '').toLowerCase().includes(q) ||
      String(bill.clientName || '').toLowerCase().includes(q) ||
      String(bill.companyName || '').toLowerCase().includes(q)
    );
  });

  const loadCycles = async (billId, force = false) => {
    if (!force && cycleDetails[billId]) return;
    setLoadingCycles((prev) => ({ ...prev, [billId]: true }));
    try {
      const res = await apiFetch(`/api/recurring-bills/${billId}`);
      const data = await readApiJson(res);
      if (res.ok) {
        setCycleDetails((prev) => ({ ...prev, [billId]: data.cycles || [] }));
      }
    } catch (error) {
      console.error('Error loading cycles:', error);
    } finally {
      setLoadingCycles((prev) => ({ ...prev, [billId]: false }));
    }
  };

  const toggleExpand = async (billId) => {
    if (expandedId === billId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(billId);
    await loadCycles(billId);
  };

  const handleGenerate = async (bill) => {
    if (!window.confirm(`Generate the next invoice for "${bill.name}"?`)) return;
    setGeneratingId(bill.id);
    try {
      const res = await apiFetch(`/api/recurring-bills/${bill.id}/generate`, { method: 'POST' });
      const data = await readApiJson(res);
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate invoice');
      }
      alert(`Draft invoice ${data.invoice?.invoiceNumber || ''} created.`);
      setCycleDetails((prev) => {
        const next = { ...prev };
        delete next[bill.id];
        return next;
      });
      await fetchBills();
      if (expandedId === bill.id) {
        await loadCycles(bill.id, true);
      }
      if (data.invoice?.id) {
        navigate(`/invoice/${data.invoice.id}`);
      }
    } catch (error) {
      alert(error.message || 'Failed to generate invoice');
    } finally {
      setGeneratingId(null);
    }
  };

  const handlePauseResume = async (bill) => {
    const nextStatus = bill.status === 'paused' ? 'active' : 'paused';
    const action = nextStatus === 'paused' ? 'pause' : 'resume';
    if (!window.confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} "${bill.name}"?`)) return;
    try {
      const res = await apiFetch(`/api/recurring-bills/${bill.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || `Failed to ${action} recurring bill`);
      fetchBills();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleCancel = async (bill) => {
    if (!window.confirm(`Cancel recurring bill "${bill.name}"? Generated invoices will be kept.`)) return;
    try {
      const res = await apiFetch(`/api/recurring-bills/${bill.id}`, { method: 'DELETE' });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to cancel recurring bill');
      fetchBills();
    } catch (error) {
      alert(error.message);
    }
  };

  const openEditModal = (bill) => {
    setEditingBill(bill);
    setEditForm({
      name: bill.name || '',
      frequency: bill.frequency || 'monthly',
      nextRunDate: String(bill.nextRunDate || '').split('T')[0],
      neverEnds: !bill.endDate,
      endDate: bill.endDate ? String(bill.endDate).split('T')[0] : '',
      dueDateOffsetDays: bill.dueDateOffsetDays ?? 30
    });
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingBill(null);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingBill) return;
    setEditSubmitting(true);
    try {
      const res = await apiFetch(`/api/recurring-bills/${editingBill.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          frequency: editForm.frequency,
          nextRunDate: editForm.nextRunDate,
          endDate: editForm.neverEnds ? null : editForm.endDate || null,
          dueDateOffsetDays: parseInt(editForm.dueDateOffsetDays, 10) || 0
        })
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to update recurring bill');
      closeEditModal();
      fetchBills();
    } catch (error) {
      alert(error.message);
    } finally {
      setEditSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Recurring Bills</h1>
          <p className="page-subtitle">Manage billing cycles created from invoices</p>
        </div>
        <button type="button" className="btn btn-outline" onClick={fetchBills}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="card">
        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search by profile name, client, or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 32 }} />
                <th>Profile</th>
                <th>Client</th>
                <th>Company</th>
                <th>Cycle</th>
                <th>Amount</th>
                <th>Next run</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center" style={{ padding: '3rem', color: 'var(--text-light)' }}>
                    {bills.length === 0
                      ? 'No recurring bills yet. Open an invoice and click Make Recurring to get started.'
                      : 'No recurring bills match your search.'}
                  </td>
                </tr>
              ) : (
                filteredBills.map((bill) => (
                  <React.Fragment key={bill.id}>
                    <tr>
                      <td>
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ padding: '0.25rem 0.4rem' }}
                          onClick={() => toggleExpand(bill.id)}
                          title="View cycle history"
                        >
                          {expandedId === bill.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </td>
                      <td style={{ fontWeight: 500 }}>{bill.name}</td>
                      <td>{bill.clientName || '—'}</td>
                      <td>{bill.companyName || '—'}</td>
                      <td>{frequencyLabel(bill.frequency)}</td>
                      <td style={{ textTransform: 'capitalize' }}>{bill.amountType}</td>
                      <td>{formatDate(bill.nextRunDate)}</td>
                      <td>{statusBadge(bill.status)}</td>
                      <td>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}
                            disabled={bill.status !== 'active' || generatingId === bill.id}
                            onClick={() => handleGenerate(bill)}
                            title={bill.status !== 'active' ? 'Only active profiles can generate invoices' : 'Generate now'}
                          >
                            <Play size={14} />
                            {generatingId === bill.id ? 'Generating…' : 'Generate'}
                          </button>
                          {bill.status === 'active' || bill.status === 'paused' ? (
                            <button
                              type="button"
                              className="btn btn-outline"
                              style={{ padding: '0.5rem 0.75rem' }}
                              onClick={() => handlePauseResume(bill)}
                              title={bill.status === 'paused' ? 'Resume' : 'Pause'}
                            >
                              {bill.status === 'paused' ? <Play size={16} /> : <Pause size={16} />}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="btn btn-outline"
                            style={{ padding: '0.5rem 0.75rem' }}
                            onClick={() => openEditModal(bill)}
                          >
                            <Edit2 size={16} />
                          </button>
                          {bill.status !== 'cancelled' && (
                            <button
                              type="button"
                              className="btn btn-danger"
                              style={{ padding: '0.5rem 0.75rem' }}
                              onClick={() => handleCancel(bill)}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedId === bill.id && (
                      <tr>
                        <td colSpan="9" style={{ background: 'var(--bg-light, #f8fafc)', padding: '1rem 1.5rem' }}>
                          <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>Cycle history</div>
                          {loadingCycles[bill.id] ? (
                            <p style={{ color: 'var(--text-light)', fontSize: '0.875rem' }}>Loading cycles…</p>
                          ) : (cycleDetails[bill.id] || []).length === 0 ? (
                            <p style={{ color: 'var(--text-light)', fontSize: '0.875rem' }}>
                              No invoices generated yet. Click Generate to create the first draft invoice.
                            </p>
                          ) : (
                            <div className="table-container">
                              <table className="table" style={{ marginBottom: 0 }}>
                                <thead>
                                  <tr>
                                    <th>Scheduled date</th>
                                    <th>Status</th>
                                    <th>Generated invoice</th>
                                    <th>Generated at</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(cycleDetails[bill.id] || []).map((cycle) => (
                                    <tr key={cycle.id}>
                                      <td>{formatDate(cycle.scheduledDate)}</td>
                                      <td style={{ textTransform: 'capitalize' }}>{cycle.status}</td>
                                      <td>
                                        {cycle.generatedInvoiceId ? (
                                          <Link to={`/invoice/${cycle.generatedInvoiceId}`}>
                                            {cycle.generatedInvoiceNumber || 'View invoice'}
                                          </Link>
                                        ) : (
                                          '—'
                                        )}
                                      </td>
                                      <td>
                                        {cycle.generatedAt
                                          ? new Date(cycle.generatedAt).toLocaleString('en-IN')
                                          : '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                          {bill.generatedCycleCount > 0 && (
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '0.75rem' }}>
                              {bill.generatedCycleCount} invoice(s) generated
                              {bill.lastGeneratedAt
                                ? ` · Last: ${new Date(bill.lastGeneratedAt).toLocaleString('en-IN')}`
                                : ''}
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showEditModal && editingBill && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Recurring Bill</h2>
              <button type="button" className="modal-close" onClick={closeEditModal}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Profile name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Billing cycle</label>
                    <select
                      className="form-select"
                      value={editForm.frequency}
                      onChange={(e) => setEditForm({ ...editForm, frequency: e.target.value })}
                    >
                      {FREQUENCY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Next run date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={editForm.nextRunDate}
                      onChange={(e) => setEditForm({ ...editForm, nextRunDate: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={editForm.neverEnds}
                      onChange={(e) => setEditForm({ ...editForm, neverEnds: e.target.checked })}
                    />
                    Never ends
                  </label>
                </div>
                {!editForm.neverEnds && (
                  <div className="form-group">
                    <label className="form-label">End date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={editForm.endDate}
                      onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                    />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Payment terms (due in days)</label>
                  <input
                    type="number"
                    className="form-input"
                    min="0"
                    value={editForm.dueDateOffsetDays}
                    onChange={(e) => setEditForm({ ...editForm, dueDateOffsetDays: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={closeEditModal} disabled={editSubmitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={editSubmitting}>
                  {editSubmitting ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default RecurringBills;
