import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { apiFetch } from '../utils/api';
import {
  calculateItemAmount,
  calculateSubtotal,
  calculateTotalCGST,
  calculateTotalSGST,
  calculateTotalIGST,
  calculateTotal,
  formatInvoiceAmount
} from '../utils/invoiceCalculations';

function fieldClass(missingFields, fieldKey) {
  return missingFields.includes(fieldKey) ? 'imported-field-missing' : '';
}

function itemFieldClass(missingFields, index, key) {
  return missingFields.includes(`items[${index}].${key}`) ? 'imported-field-missing' : '';
}

function ImportedInvoiceEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sourceFilePath, setSourceFilePath] = useState('');
  const [sourceMimeType, setSourceMimeType] = useState('');
  const [missingFields, setMissingFields] = useState([]);
  const [formData, setFormData] = useState({
    partyType: 'vendor',
    partyName: '',
    partyGstin: '',
    partyAddress: '',
    issuerName: '',
    issuerGstin: '',
    invoiceNumber: '',
    invoiceDate: '',
    dueDate: '',
    placeOfSupply: '',
    taxType: 'cgst_sgst',
    items: []
  });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch(`/api/imported-invoices/${id}`);
        if (!res.ok) throw new Error('Not found');
        const data = await res.json();
        setSourceFilePath(data.sourceFilePath || '');
        setSourceMimeType(data.sourceMimeType || '');
        setMissingFields(data.missingFields || []);
        const mappedItems = (data.items || []).map((item) => ({
          description: item.description || '',
          detailedDescription: item.detailedDescription || '',
          hsnSac: item.hsnSac || '',
          quantity: item.quantity ?? 1,
          rate: item.rate ?? 0,
          cgstPercent: item.cgstPercent ?? 9,
          sgstPercent: item.sgstPercent ?? 9
        }));
        setFormData({
          partyType: data.partyType || 'vendor',
          partyName: data.partyName || '',
          partyGstin: data.partyGstin || '',
          partyAddress: data.partyAddress || '',
          issuerName: data.issuerName || '',
          issuerGstin: data.issuerGstin || '',
          invoiceNumber: data.invoiceNumber || '',
          invoiceDate: data.invoiceDate || '',
          dueDate: data.dueDate || '',
          placeOfSupply: data.placeOfSupply || '',
          taxType: data.taxType === 'igst' ? 'igst' : 'cgst_sgst',
          items: mappedItems.length > 0 ? mappedItems : [{
            description: '',
            detailedDescription: '',
            hsnSac: '',
            quantity: 1,
            rate: 0,
            cgstPercent: 9,
            sgstPercent: 9
          }]
        });
      } catch (e) {
        console.error(e);
        alert('Could not load imported invoice');
        navigate('/imported-invoices');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, navigate]);

  const isInterState = formData.taxType === 'igst';

  const updateItem = (index, field, value) => {
    const items = [...formData.items];
    items[index] = { ...items[index], [field]: value };
    setFormData({ ...formData, items });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          description: '',
          detailedDescription: '',
          hsnSac: '',
          quantity: 1,
          rate: 0,
          cgstPercent: 9,
          sgstPercent: 9
        }
      ]
    });
  };

  const removeItem = (index) => {
    if (formData.items.length <= 1) {
      alert('At least one line item is required');
      return;
    }
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const items = formData.items.map((item) => ({
        ...item,
        amount: calculateItemAmount(item)
      }));
      const payload = {
        ...formData,
        items,
        subtotal: calculateSubtotal(items),
        cgst: calculateTotalCGST(items),
        sgst: calculateTotalSGST(items),
        igst: calculateTotalIGST(items),
        total: calculateTotal(items, isInterState)
      };
      const res = await apiFetch(`/api/imported-invoices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Save failed');
        return;
      }
      setMissingFields(data.missingFields || []);
      navigate(`/imported-invoices/${id}`);
    } catch (e) {
      alert('Error saving imported invoice');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p>Loading…</p>;
  }

  const isImage = sourceMimeType?.startsWith('image/');

  return (
    <div>
      <style>{`
        .imported-field-missing {
          border-color: #f59e0b !important;
          box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2);
        }
        .imported-editor-grid {
          display: grid;
          grid-template-columns: minmax(260px, 1fr) 2fr;
          gap: 1.5rem;
        }
        @media (max-width: 900px) {
          .imported-editor-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="page-header flex items-center justify-between">
        <div>
          <Link to={`/imported-invoices/${id}`} style={{ fontSize: 14, color: 'var(--text-light)' }}>
            ← Back to view
          </Link>
          <h1 className="page-title" style={{ marginTop: '0.5rem' }}>Review & Edit</h1>
          <p className="page-subtitle">Fix any missing fields highlighted in amber.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="imported-editor-grid">
        <div className="card" style={{ position: 'sticky', top: 16, alignSelf: 'start' }}>
          <h3 style={{ marginBottom: '1rem' }}>Original scan</h3>
          {isImage && sourceFilePath ? (
            <img
              src={sourceFilePath}
              alt="Invoice scan"
              style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)' }}
            />
          ) : sourceFilePath ? (
            <a href={sourceFilePath} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
              Open PDF
            </a>
          ) : null}
        </div>

        <div className="card">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label className="form-label">Party type</label>
              <select
                className="form-select"
                value={formData.partyType}
                onChange={(e) => setFormData({ ...formData, partyType: e.target.value })}
              >
                <option value="vendor">Vendor (incoming bill)</option>
                <option value="client">Client (issued invoice)</option>
              </select>
            </div>
            <div>
              <label className="form-label">Tax type</label>
              <select
                className="form-select"
                value={formData.taxType}
                onChange={(e) => setFormData({ ...formData, taxType: e.target.value })}
              >
                <option value="cgst_sgst">CGST + SGST</option>
                <option value="igst">IGST</option>
              </select>
            </div>
            <div>
              <label className="form-label">Party name</label>
              <input
                type="text"
                className={`form-input ${fieldClass(missingFields, 'partyName')}`}
                value={formData.partyName}
                onChange={(e) => setFormData({ ...formData, partyName: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Party GSTIN</label>
              <input
                type="text"
                className="form-input"
                value={formData.partyGstin}
                onChange={(e) => setFormData({ ...formData, partyGstin: e.target.value })}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Party address</label>
              <textarea
                className="form-input"
                rows={2}
                value={formData.partyAddress}
                onChange={(e) => setFormData({ ...formData, partyAddress: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Issuer name</label>
              <input
                type="text"
                className="form-input"
                value={formData.issuerName}
                onChange={(e) => setFormData({ ...formData, issuerName: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Issuer GSTIN</label>
              <input
                type="text"
                className="form-input"
                value={formData.issuerGstin}
                onChange={(e) => setFormData({ ...formData, issuerGstin: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Invoice number</label>
              <input
                type="text"
                className={`form-input ${fieldClass(missingFields, 'invoiceNumber')}`}
                value={formData.invoiceNumber}
                onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Invoice date</label>
              <input
                type="date"
                className={`form-input ${fieldClass(missingFields, 'invoiceDate')}`}
                value={formData.invoiceDate}
                onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Due date</label>
              <input
                type="date"
                className={`form-input ${fieldClass(missingFields, 'dueDate')}`}
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Place of supply</label>
              <input
                type="text"
                className="form-input"
                value={formData.placeOfSupply}
                onChange={(e) => setFormData({ ...formData, placeOfSupply: e.target.value })}
              />
            </div>
          </div>

          <h3 style={{ marginBottom: '1rem' }}>Line items</h3>
          {formData.items.map((item, index) => (
            <div
              key={index}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '1rem',
                marginBottom: '1rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <strong>Item {index + 1}</strong>
                <button type="button" className="btn btn-icon" onClick={() => removeItem(index)} aria-label="Remove item">
                  <Trash2 size={16} />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label">Description</label>
                  <input
                    type="text"
                    className={`form-input ${itemFieldClass(missingFields, index, 'description')}`}
                    value={item.description}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">HSN/SAC</label>
                  <input
                    type="text"
                    className="form-input"
                    value={item.hsnSac}
                    onChange={(e) => updateItem(index, 'hsnSac', e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Qty</label>
                  <input
                    type="number"
                    className={`form-input ${itemFieldClass(missingFields, index, 'quantity')}`}
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Rate</label>
                  <input
                    type="number"
                    className={`form-input ${itemFieldClass(missingFields, index, 'rate')}`}
                    value={item.rate}
                    onChange={(e) => updateItem(index, 'rate', e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Amount</label>
                  <div style={{ padding: '0.5rem 0' }}>{formatInvoiceAmount(calculateItemAmount(item))}</div>
                </div>
              </div>
              {!isInterState && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
                  <div>
                    <label className="form-label">CGST %</label>
                    <input
                      type="number"
                      className="form-input"
                      value={item.cgstPercent}
                      onChange={(e) => updateItem(index, 'cgstPercent', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label">SGST %</label>
                    <input
                      type="number"
                      className="form-input"
                      value={item.sgstPercent}
                      onChange={(e) => updateItem(index, 'sgstPercent', e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}

          <button type="button" className="btn btn-secondary" onClick={addItem} style={{ marginBottom: '1.5rem' }}>
            Add line item
          </button>

          <div style={{ textAlign: 'right', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <div>Subtotal: {formatInvoiceAmount(calculateSubtotal(formData.items))}</div>
            {!isInterState ? (
              <>
                <div>CGST: {formatInvoiceAmount(calculateTotalCGST(formData.items))}</div>
                <div>SGST: {formatInvoiceAmount(calculateTotalSGST(formData.items))}</div>
              </>
            ) : (
              <div>IGST: {formatInvoiceAmount(calculateTotalIGST(formData.items))}</div>
            )}
            <div style={{ fontWeight: 700, fontSize: '1.1rem', marginTop: '0.5rem' }}>
              Total: {formatInvoiceAmount(calculateTotal(formData.items, isInterState))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ImportedInvoiceEditor;
