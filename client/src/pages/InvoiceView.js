import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';

function InvoiceView() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [items, setItems] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const res = await fetch(`/api/invoices/${id}`);
        if (!res.ok) throw new Error('Invoice not found');
        const data = await res.json();
        setInvoice(data);
        setItems(data.items || []);
      } catch (e) {
        console.error('Error fetching invoice:', e);
      }
    };
    fetchInvoice();
  }, [id]);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);

  const handleEdit = () => {
    navigate(`/invoice?edit=${id}`);
  };

  const handleClone = () => {
    navigate(`/invoice?clone=${id}`);
  };

  if (!invoice) return (
    <div className="card">
      <p>Loading invoice...</p>
      <p><Link to="/">Back to dashboard</Link></p>
    </div>
  );

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
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline" onClick={handleClone}>
            Clone
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
              {formatCurrency(invoice.total)}
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
              {items.map((it, idx) => (
                <tr key={it.id || idx}>
                  <td>{idx + 1}</td>
                  <td>{it.description}</td>
                  <td>{parseFloat(it.quantity || 0).toFixed(2)}</td>
                  <td style={{ textAlign: 'right' }}>
                    {formatCurrency(parseFloat(it.rate || 0))}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {formatCurrency(parseFloat(it.amount || 0))}
                  </td>
                </tr>
              ))}
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
    </div>
  );
}

export default InvoiceView;
