import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceClientFilter, setInvoiceClientFilter] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const [invRes, clientsRes] = await Promise.all([
          fetch('/api/invoices'),
          fetch('/api/clients')
        ]);

        const [invJson, clientsJson] = await Promise.all([
          invRes.json(),
          clientsRes.json()
        ]);

        setInvoices(invJson || []);
        setClients(clientsJson || []);
      } catch (e) {
        console.error('Error loading invoices:', e);
      } finally {
        setLoading(false);
      }
    };

    loadData();
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

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesClient = invoiceClientFilter
      ? invoice.clientId === invoiceClientFilter
      : true;
    const search = invoiceSearch.trim().toLowerCase();
    const matchesSearch = search
      ? String(invoice.invoiceNumber || '').toLowerCase().includes(search)
      : true;
    return matchesClient && matchesSearch;
  });

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">Browse and search all saved invoices.</p>
        </div>
        <Link to="/invoice" className="btn btn-primary">
          New Invoice
        </Link>
      </div>

      <div className="card">
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            marginBottom: '1rem',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ minWidth: 220 }}>
            <label className="form-label" style={{ marginBottom: '0.25rem' }}>
              Filter by Client
            </label>
            <select
              className="form-select"
              value={invoiceClientFilter}
              onChange={(e) => setInvoiceClientFilter(e.target.value)}
            >
              <option value="">All clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ minWidth: 220 }}>
            <label className="form-label" style={{ marginBottom: '0.25rem' }}>
              Search by Invoice Number
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. DL/01 or TEST"
              value={invoiceSearch}
              onChange={(e) => setInvoiceSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Invoice Number</th>
                <th>Client</th>
                <th>Invoice Date</th>
                <th>Due Date</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center" style={{ padding: '3rem' }}>
                    Loading invoices...
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center" style={{ padding: '3rem', color: 'var(--text-light)' }}>
                    No invoices found for the selected filters.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 500 }}>
                      <Link
                        to={`/invoice/${invoice.id}`}
                        style={{ textDecoration: 'none', color: 'inherit' }}
                      >
                        {invoice.invoiceNumber}
                      </Link>
                    </td>
                    <td>{invoice.clientName}</td>
                    <td>{formatDate(invoice.invoiceDate)}</td>
                    <td>{formatDate(invoice.dueDate)}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(invoice.total)}</td>
                    <td>
                      <span
                        style={{
                          padding: '0.375rem 0.75rem',
                          borderRadius: '6px',
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
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Invoices;

