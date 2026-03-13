import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Users, IndianRupee, TrendingUp } from 'lucide-react';

function Dashboard() {
  const [stats, setStats] = useState({
    totalClients: 0,
    totalInvoices: 0,
    totalRevenue: 0,
    pendingAmount: 0
  });
  const [invoices, setInvoices] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [clients, setClients] = useState([]);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceClientFilter, setInvoiceClientFilter] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [clientsRes, invoicesRes, companiesRes] = await Promise.all([
        fetch('/api/clients'),
        fetch('/api/invoices'),
        fetch('/api/companies')
      ]);
      
      const clientsData = await clientsRes.json();
      const invoicesData = await invoicesRes.json();
      const companiesData = await companiesRes.json();
      
      const totalRevenue = invoicesData.reduce((sum, inv) => sum + (inv.total || 0), 0);
      const pendingAmount = invoicesData
        .filter(inv => inv.status === 'draft')
        .reduce((sum, inv) => sum + (inv.total || 0), 0);
      
      setStats({
        totalClients: clientsData.length,
        totalInvoices: invoicesData.length,
        totalRevenue,
        pendingAmount
      });
      
      setInvoices(invoicesData);
      setClients(clientsData);
      setCompanies(companiesData.slice(0, 5)); // Show recent 5 companies
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString) => {
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

  const visibleInvoices = filteredInvoices.slice(0, 8);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Welcome back! Here's your business overview.</p>
      </div>

      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-icon">
            <Users size={24} />
          </div>
          <div className="stat-label">Total Clients</div>
          <div className="stat-value">{stats.totalClients}</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <FileText size={24} />
          </div>
          <div className="stat-label">Total Invoices</div>
          <div className="stat-value">{stats.totalInvoices}</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <IndianRupee size={24} />
          </div>
          <div className="stat-label">Total Revenue</div>
          <div className="stat-value" style={{ fontSize: '1.5rem' }}>
            {formatCurrency(stats.totalRevenue)}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <TrendingUp size={24} />
          </div>
          <div className="stat-label">Pending Amount</div>
          <div className="stat-value" style={{ fontSize: '1.5rem' }}>
            {formatCurrency(stats.pendingAmount)}
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '1.25rem'
        }}>
          <div>
            <h3 style={{ 
              fontFamily: 'Playfair Display, serif', 
              fontSize: '1.5rem', 
              margin: 0,
              color: 'var(--primary)'
            }}>
              Saved Invoices
            </h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: 'var(--text-light)' }}>
              Showing latest invoices. Use filters to narrow down.
            </p>
          </div>
          <Link to="/invoices" className="btn btn-outline" style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
            View All
          </Link>
        </div>

        <div style={{ 
          display: 'flex', 
          gap: '0.75rem', 
          marginBottom: '1rem', 
          flexWrap: 'wrap' 
        }}>
          <div style={{ minWidth: 220 }}>
            <label className="form-label" style={{ marginBottom: '0.25rem' }}>Filter by Client</label>
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
            <label className="form-label" style={{ marginBottom: '0.25rem' }}>Search by Invoice Number</label>
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
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleInvoices.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center" style={{ padding: '3rem', color: 'var(--text-light)' }}>
                    No invoices yet. Create your first invoice to get started.
                  </td>
                </tr>
              ) : (
                visibleInvoices.map(invoice => (
                  <tr key={invoice.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 500 }}>
                      <Link to={`/invoice/${invoice.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        {invoice.invoiceNumber}
                      </Link>
                    </td>
                    <td>{invoice.clientName}</td>
                    <td>{formatDate(invoice.invoiceDate)}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(invoice.total)}</td>
                    <td>
                      <span style={{
                        padding: '0.375rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.8125rem',
                        fontWeight: 500,
                        background: invoice.status === 'paid' ? '#d4edda' : '#fff3cd',
                        color: invoice.status === 'paid' ? '#155724' : '#856404'
                      }}>
                        {invoice.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ 
            fontFamily: 'Playfair Display, serif', 
            fontSize: '1.5rem', 
            color: 'var(--primary)',
            margin: 0
          }}>
            Companies
          </h3>
          <Link to="/companies" className="btn btn-outline" style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
            View All
          </Link>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
          {companies.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>
              No companies yet. <Link to="/companies" style={{ color: 'var(--primary)' }}>Add your first company</Link>.
            </div>
          ) : (
            companies.map(company => (
              <div key={company.id} style={{ 
                border: '1px solid var(--border)', 
                borderRadius: '8px', 
                padding: '1rem', 
                textAlign: 'center',
                background: 'var(--card-bg)'
              }}>
                {company.logo ? (
                  <>
                    <img 
                      src={company.logo} 
                      alt={`${company.name} logo`} 
                      style={{ width: '60px', height: '60px', objectFit: 'contain', marginBottom: '0.5rem' }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'block';
                      }}
                    />
                    <div style={{ display: 'none', width: '60px', height: '60px', backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', margin: '0 auto 0.5rem' }}>
                      <span style={{ fontSize: '10px', color: '#666' }}>No Logo</span>
                    </div>
                  </>
                ) : (
                  <div style={{ 
                    width: '60px', 
                    height: '60px', 
                    backgroundColor: '#f0f0f0', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    borderRadius: '4px', 
                    margin: '0 auto 0.5rem'
                  }}>
                    <span style={{ fontSize: '10px', color: '#666' }}>No Logo</span>
                  </div>
                )}
                <h4 style={{ fontSize: '1rem', margin: '0 0 0.25rem 0', fontWeight: 600 }}>{company.name}</h4>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-light)', margin: 0 }}>
                  {company.gstin || 'No GSTIN'}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
