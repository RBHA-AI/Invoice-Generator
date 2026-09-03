import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { formatInvoiceAmount } from '../utils/invoiceCalculations';

const STATUS_LABELS = {
  processing: 'Processing',
  needs_review: 'Needs review',
  complete: 'Complete',
  failed: 'Failed'
};

function ImportedInvoiceView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [items, setItems] = useState([]);
  const [reExtracting, setReExtracting] = useState(false);

  useEffect(() => {
    const loadInvoice = async () => {
      try {
        const res = await apiFetch(`/api/imported-invoices/${id}`);
        if (!res.ok) throw new Error('Not found');
        const data = await res.json();
        setInvoice(data);
        setItems(data.items || []);
      } catch (e) {
        console.error('Error loading imported invoice:', e);
      }
    };
    loadInvoice();
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm('Delete this imported invoice? This cannot be undone.')) return;
    try {
      const res = await apiFetch(`/api/imported-invoices/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Delete failed');
        return;
      }
      navigate('/imported-invoices');
    } catch (e) {
      alert('Error deleting imported invoice');
    }
  };

  const handleReExtract = async () => {
    if (!window.confirm('Re-run AI extraction? This will overwrite current extracted fields.')) return;
    setReExtracting(true);
    try {
      const res = await apiFetch(`/api/imported-invoices/${id}/re-extract`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Re-extraction failed');
        return;
      }
      setInvoice(data);
      setItems(data.items || []);
      if (data.extractionWarning) {
        alert(`Extraction completed with warning: ${data.extractionWarning}`);
      }
    } catch (e) {
      alert('Re-extraction failed');
    } finally {
      setReExtracting(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (!invoice) {
    return (
      <div className="main-content">
        <p>Loading imported invoice…</p>
      </div>
    );
  }

  const isImage = invoice.sourceMimeType?.startsWith('image/');
  const isInterState = invoice.taxType === 'igst';

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <Link to="/imported-invoices" style={{ fontSize: 14, color: 'var(--text-light)' }}>
            ← Back to Imported Invoices
          </Link>
          <h1 className="page-title" style={{ marginTop: '0.5rem' }}>
            {invoice.invoiceNumber || 'Imported Invoice'}
          </h1>
          <p className="page-subtitle">
            {STATUS_LABELS[invoice.status] || invoice.status}
            {invoice.partyName ? ` · ${invoice.partyName}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={handleReExtract} disabled={reExtracting}>
            {reExtracting ? 'Re-extracting…' : 'Re-extract'}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => navigate(`/imported-invoices/${id}/edit`)}>
            Edit
          </button>
          <button type="button" className="btn btn-danger" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </div>

      {invoice.extractionErrors && (
        <div className="card" style={{ borderColor: '#f5c6cb', background: '#f8d7da', marginBottom: '1rem' }}>
          <strong>Extraction error:</strong> {invoice.extractionErrors}
        </div>
      )}

      {invoice.missingFields?.length > 0 && (
        <div className="card" style={{ borderColor: '#ffc107', background: '#fff3cd', marginBottom: '1rem' }}>
          <strong>Missing or incomplete fields:</strong>{' '}
          {invoice.missingFields.join(', ')}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) 2fr', gap: '1.5rem' }}>
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Original scan</h3>
          {isImage && invoice.sourceFilePath ? (
            <img
              src={invoice.sourceFilePath}
              alt="Invoice scan"
              style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)' }}
            />
          ) : invoice.sourceFilePath ? (
            <a href={invoice.sourceFilePath} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
              Open PDF
            </a>
          ) : (
            <p style={{ color: 'var(--text-light)' }}>No file attached</p>
          )}
          {invoice.sourceOriginalName && (
            <p style={{ fontSize: 12, color: 'var(--text-light)', marginTop: '0.5rem' }}>
              {invoice.sourceOriginalName}
            </p>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Extracted details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <div className="form-label">Party type</div>
              <div style={{ textTransform: 'capitalize' }}>{invoice.partyType || 'vendor'}</div>
            </div>
            <div>
              <div className="form-label">Party name</div>
              <div>{invoice.partyName || '—'}</div>
            </div>
            <div>
              <div className="form-label">Party GSTIN</div>
              <div>{invoice.partyGstin || '—'}</div>
            </div>
            <div>
              <div className="form-label">Issuer</div>
              <div>{invoice.issuerName || '—'}</div>
            </div>
            <div>
              <div className="form-label">Invoice date</div>
              <div>{formatDate(invoice.invoiceDate)}</div>
            </div>
            <div>
              <div className="form-label">Due date</div>
              <div>{formatDate(invoice.dueDate)}</div>
            </div>
            <div>
              <div className="form-label">Place of supply</div>
              <div>{invoice.placeOfSupply || '—'}</div>
            </div>
            <div>
              <div className="form-label">Tax type</div>
              <div>{isInterState ? 'IGST' : 'CGST + SGST'}</div>
            </div>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>HSN/SAC</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center" style={{ color: 'var(--text-light)' }}>
                      No line items
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.description || '—'}</td>
                      <td>{item.hsnSac || '—'}</td>
                      <td>{item.quantity ?? '—'}</td>
                      <td>{formatInvoiceAmount(item.rate)}</td>
                      <td>{formatInvoiceAmount(item.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
            <div>Subtotal: {formatInvoiceAmount(invoice.subtotal)}</div>
            {!isInterState ? (
              <>
                <div>CGST: {formatInvoiceAmount(invoice.cgst)}</div>
                <div>SGST: {formatInvoiceAmount(invoice.sgst)}</div>
              </>
            ) : (
              <div>IGST: {formatInvoiceAmount(invoice.igst)}</div>
            )}
            <div style={{ fontWeight: 700, fontSize: '1.1rem', marginTop: '0.5rem' }}>
              Total: {formatInvoiceAmount(invoice.total)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ImportedInvoiceView;
