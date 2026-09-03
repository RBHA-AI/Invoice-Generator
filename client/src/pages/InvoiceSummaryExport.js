import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../utils/api';

function InvoiceSummaryExport() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportMonth, setExportMonth] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch('/api/invoices');
        const json = await res.json();
        setInvoices(json || []);
      } catch (e) {
        console.error('Error loading invoices for export:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const monthOptions = useMemo(() => {
    const set = new Set();
    invoices.forEach((inv) => {
      if (inv && inv.invoiceDate) {
        const m = String(inv.invoiceDate).slice(0, 7);
        if (/^\d{4}-\d{2}$/.test(m)) set.add(m);
      }
    });
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [invoices]);

  useEffect(() => {
    if (!exportMonth && monthOptions.length) {
      setExportMonth(monthOptions[0]);
    }
  }, [exportMonth, monthOptions]);

  const exportInvoiceSummary = async () => {
    try {
      setExporting(true);
      const res = await apiFetch(`/api/invoices/export?month=${encodeURIComponent(exportMonth)}`);
      if (!res.ok) {
        let message = 'Failed to export invoice summary.';
        try {
          const data = await res.json();
          if (data && data.error) message = data.error;
        } catch (_) {}
        alert(message);
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-summary-${exportMonth}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed:', e);
      alert('Export failed. Please check the server logs.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Export Invoice Summary</h1>
          <p className="page-subtitle">Download an accountant-friendly monthly Excel export.</p>
        </div>
        <Link to="/dashboard" className="btn btn-outline">
          Back to Dashboard
        </Link>
      </div>

      <div className="card">
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            alignItems: 'flex-end',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ minWidth: 240 }}>
            <label className="form-label">Month</label>
            <select
              className="form-select"
              value={exportMonth}
              onChange={(e) => setExportMonth(e.target.value)}
              disabled={loading || monthOptions.length === 0}
            >
              {loading ? (
                <option>Loading…</option>
              ) : monthOptions.length === 0 ? (
                <option value="">No invoices found</option>
              ) : (
                monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))
              )}
            </select>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: 'var(--text-light)' }}>
              Includes invoice totals and client/company GSTINs.
            </p>
          </div>

          <button
            className="btn btn-primary"
            onClick={exportInvoiceSummary}
            disabled={exporting || loading || !exportMonth}
            style={{ minWidth: 140 }}
          >
            {exporting ? 'Exporting…' : 'Download Excel'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default InvoiceSummaryExport;

