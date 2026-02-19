import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

function InvoiceView() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [items, setItems] = useState([]);

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

  const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);

  if (!invoice) return (
    <div className="card">
      <p>Loading invoice...</p>
      <p><Link to="/">Back to dashboard</Link></p>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Invoice: {invoice.invoiceNumber}</h1>
        <p className="page-subtitle">{invoice.clientName} — {invoice.invoiceDate}</p>
      </div>

      <div className="card">
        <h3>Invoice Details</h3>
        <div>Invoice Number: <strong>{invoice.invoiceNumber}</strong></div>
        <div>Date: {new Date(invoice.invoiceDate).toLocaleDateString('en-GB')}</div>
        <div>Due Date: {new Date(invoice.dueDate).toLocaleDateString('en-GB')}</div>
        <div>Total: ₹{formatCurrency(invoice.total)}</div>
        <div>Status: {invoice.status}</div>

        <h4 style={{ marginTop: '1rem' }}>Items</h4>
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
                <td style={{ textAlign: 'right' }}>{formatCurrency(parseFloat(it.rate || 0))}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(parseFloat(it.amount || 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p style={{ marginTop: '1rem' }}><Link to="/">Back to dashboard</Link></p>
      </div>
    </div>
  );
}

export default InvoiceView;
