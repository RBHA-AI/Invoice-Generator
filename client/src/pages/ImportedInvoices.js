import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/api';

const STATUS_LABELS = {
  processing: 'Processing',
  needs_review: 'Needs review',
  complete: 'Complete',
  failed: 'Failed'
};

const STATUS_STYLES = {
  processing: { background: '#e0f2fe', color: '#075985' },
  needs_review: { background: '#fff3cd', color: '#854d0e' },
  complete: { background: '#d4edda', color: '#166534' },
  failed: { background: '#f8d7da', color: '#842029' }
};

function ImportedInvoices() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch('/api/imported-invoices');
        if (res.ok) {
          setInvoices(await res.json());
        }
      } catch (e) {
        console.error('Error loading imported invoices:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount || 0);

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const filtered = invoices.filter((inv) => {
    const matchesStatus = statusFilter ? inv.status === statusFilter : true;
    const q = search.trim().toLowerCase();
    const matchesSearch = q
      ? [inv.invoiceNumber, inv.partyName, inv.sourceOriginalName]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      : true;
    return matchesStatus && matchesSearch;
  });

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Imported Invoices</h1>
          <p className="page-subtitle">
            Upload invoice scans and review AI-extracted data separately from issued invoices.
          </p>
        </div>
        <Link to="/imported-invoices/upload" className="btn btn-primary">
          Upload Invoice
        </Link>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 200 }}>
            <label className="form-label" style={{ marginBottom: '0.25rem' }}>Status</label>
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="needs_review">Needs review</option>
              <option value="complete">Complete</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div style={{ minWidth: 220, flex: 1 }}>
            <label className="form-label" style={{ marginBottom: '0.25rem' }}>Search</label>
            <input
              type="text"
              className="form-input"
              placeholder="Invoice #, party name, file name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Preview</th>
                <th>Invoice #</th>
                <th>Party</th>
                <th>Type</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center" style={{ padding: '3rem' }}>
                    Loading imported invoices...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center" style={{ padding: '3rem', color: 'var(--text-light)' }}>
                    No imported invoices yet. Upload a scan to get started.
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => {
                  const style = STATUS_STYLES[inv.status] || STATUS_STYLES.needs_review;
                  const isImage = inv.sourceMimeType?.startsWith('image/');
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => navigate(`/imported-invoices/${inv.id}`)}
                      style={{ cursor: 'pointer' }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(`/imported-invoices/${inv.id}`);
                        }
                      }}
                    >
                      <td>
                        {isImage && inv.sourceFilePath ? (
                          <img
                            src={inv.sourceFilePath}
                            alt=""
                            style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }}
                          />
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-light)' }}>PDF</span>
                        )}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 500 }}>{inv.invoiceNumber || '—'}</td>
                      <td>{inv.partyName || '—'}</td>
                      <td style={{ textTransform: 'capitalize' }}>{inv.partyType || 'vendor'}</td>
                      <td>{formatDate(inv.invoiceDate)}</td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(inv.total)}</td>
                      <td>
                        <span style={{ padding: '0.375rem 0.75rem', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 500, ...style }}>
                          {STATUS_LABELS[inv.status] || inv.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ImportedInvoices;
