import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Trash2, Download, Eye } from 'lucide-react';
import InvoicePreview from '../components/InvoicePreview';
import {
  normalizeState,
  getPlaceOfSupplyFromState,
  calculateItemAmount,
  calculateSubtotal,
  calculateTotalCGST,
  calculateTotalSGST,
  calculateTotalIGST,
  calculateTotal,
  formatCurrency,
  normalizeAmountInWordsCurrency,
  getCurrencySymbol,
  formatInvoiceAmount
} from '../utils/invoiceCalculations';
import { downloadInvoicePdf } from '../utils/generateInvoicePdf';
import './InvoiceGenerator.css';

function SearchableDropdown({
  value,
  options,
  placeholder,
  onSelect
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef(null);

  const selectedOption = options.find((opt) => opt.id === value) || null;
  const filteredOptions = options.filter((opt) =>
    String(opt.name || '').toLowerCase().includes(query.trim().toLowerCase())
  );

  useEffect(() => {
    const onDocClick = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const handleSelect = (id) => {
    onSelect(id);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="form-select"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{ textAlign: 'left', cursor: 'pointer' }}
      >
        {selectedOption ? selectedOption.name : placeholder}
      </button>
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 30,
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            boxShadow: '0 8px 20px rgba(0,0,0,0.08)',
            padding: '8px'
          }}
        >
          <input
            type="text"
            className="form-input"
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <div style={{ marginTop: '8px', maxHeight: '220px', overflowY: 'auto' }}>
            <button
              type="button"
              onClick={() => handleSelect('')}
              style={{
                width: '100%',
                textAlign: 'left',
                border: 'none',
                background: 'transparent',
                padding: '8px',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              {placeholder}
            </button>
            {filteredOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelect(opt.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  border: 'none',
                  background: 'transparent',
                  padding: '8px',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                {opt.name}
              </button>
            ))}
            {filteredOptions.length === 0 && (
              <div style={{ padding: '8px', color: 'var(--text-light)', fontSize: '13px' }}>
                No matches found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InvoiceGenerator() {
  const [clients, setClients] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [formData, setFormData] = useState({
    clientId: '',
    companyId: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    placeOfSupply: 'Delhi (07)',
    bankName: 'HDFC BANK LIMITED',
    bankBranch: 'CC-31, COMMERCIAL COMPLEX, NARAINA IND AREA',
    bankAccount: '50200003760432',
    ifsc: 'HDFC0000440',
    signatureTitle: 'PARTNER',
    items: [
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
  
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [taxMode, setTaxMode] = useState('auto'); // 'auto', 'igst', 'cgst_sgst'
  const [amountInWordsCurrency, setAmountInWordsCurrency] = useState('inr'); // 'inr' | 'aud'
  const [taxSuggestionsByIndex, setTaxSuggestionsByIndex] = useState({});
  const invoicePreviewRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const editInvoiceIdFromQuery = searchParams.get('edit');
  const cloneInvoiceIdFromQuery = searchParams.get('clone');
  const initialMode = editInvoiceIdFromQuery ? 'edit' : cloneInvoiceIdFromQuery ? 'clone' : 'new';
  const initialEditingInvoiceId = editInvoiceIdFromQuery || cloneInvoiceIdFromQuery || null;
  const [mode, setMode] = useState(initialMode); // 'new' | 'edit' | 'clone'
  const [editingInvoiceId, setEditingInvoiceId] = useState(initialEditingInvoiceId);
  const [invoiceStatus, setInvoiceStatus] = useState('draft');
  
  // Get states from selected company and client
  // IMPORTANT: companies may not have state set in older data; don't default to Delhi.
  const companyState = normalizeState(selectedCompany?.state || '');
  const clientState = normalizeState(selectedClient?.state || '');
  
  // Auto-detect interstate (requires both states)
  const autoIsInterState = !!(clientState && companyState && companyState !== clientState);
  
  // Final tax mode decision
  const isInterState = taxMode === 'auto' ? autoIsInterState : taxMode === 'igst';

  useEffect(() => {
    fetchClients();
    fetchCompanies();
    if (initialMode !== 'edit') {
      generateInvoiceNumber();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (editInvoiceIdFromQuery) {
      setMode('edit');
      setEditingInvoiceId(editInvoiceIdFromQuery);
    } else if (cloneInvoiceIdFromQuery) {
      setMode('clone');
      setEditingInvoiceId(cloneInvoiceIdFromQuery);
    } else {
      setMode('new');
      setEditingInvoiceId(null);
    }
  }, [editInvoiceIdFromQuery, cloneInvoiceIdFromQuery]);
  
  useEffect(() => {
    const loadInvoiceForEditing = async () => {
      if (!editingInvoiceId) return;
      try {
        const res = await fetch(`/api/invoices/${editingInvoiceId}`);
        if (!res.ok) {
          console.error('Error loading invoice for editing:', await res.text());
          return;
        }
        const data = await res.json();

        setFormData(prev => ({
          ...prev,
          clientId: data.clientId || '',
          companyId: data.companyId || '',
          invoiceDate: data.invoiceDate || new Date().toISOString().split('T')[0],
          dueDate: data.dueDate || new Date().toISOString().split('T')[0],
          placeOfSupply: data.placeOfSupply || prev.placeOfSupply,
          bankName: data.bankName || prev.bankName,
          bankBranch: data.bankBranch || prev.bankBranch,
          bankAccount: data.bankAccount || prev.bankAccount,
          ifsc: data.ifsc || prev.ifsc,
          signatureTitle: data.signatureTitle || prev.signatureTitle,
          items: (data.items && data.items.length > 0)
            ? data.items.map(item => ({
                description: item.description || '',
                detailedDescription: item.detailedDescription || '',
                hsnSac: item.hsnSac || '',
                quantity: item.quantity ?? 1,
                rate: item.rate ?? 0,
                cgstPercent: item.cgstPercent ?? 9,
                sgstPercent: item.sgstPercent ?? 9
              }))
            : prev.items
        }));
        setAmountInWordsCurrency(normalizeAmountInWordsCurrency(data.amountInWordsCurrency));

        if (mode === 'edit' && data.invoiceNumber) {
          setInvoiceNumber(data.invoiceNumber);
        }
        if (mode === 'edit') {
          setInvoiceStatus(data.status || 'draft');
        }
      } catch (error) {
        console.error('Error fetching invoice for edit/clone:', error);
      }
    };

    if (mode === 'edit' || mode === 'clone') {
      loadInvoiceForEditing();
    }
  }, [editingInvoiceId, mode]);

  useEffect(() => {
    if (formData.clientId && clients.length) {
      const client = clients.find(c => c.id === formData.clientId);
      setSelectedClient(client || null);
    }
  }, [formData.clientId, clients]);

  useEffect(() => {
    if (selectedClient?.state) {
      const place = getPlaceOfSupplyFromState(selectedClient.state);
      if (place) {
        setFormData((prev) => ({ ...prev, placeOfSupply: place }));
      }
    }
  }, [selectedClient?.state]);

  useEffect(() => {
    if (formData.companyId && companies.length) {
      const company = companies.find(c => c.id === formData.companyId);
      setSelectedCompany(company || null);
    }
  }, [formData.companyId, companies]);

  const fetchClients = async () => {
    try {
      const response = await fetch('/api/clients');
      const data = await response.json();
      setClients(data);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchCompanies = async () => {
    try {
      const response = await fetch('/api/companies');
      const data = await response.json();
      setCompanies(data);
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  };

  const generateInvoiceNumber = async () => {
    // Never auto-generate in edit mode; preserve original invoice number.
    if (mode === 'edit') return;
    try {
      const response = await fetch('/api/invoices/generate-number');
      if (!response.ok) throw new Error(`generate-number returned ${response.status}`);
      const data = await response.json();
      if (data && typeof data.invoiceNumber === 'string' && data.invoiceNumber) {
        setInvoiceNumber(data.invoiceNumber);
        return;
      }
      throw new Error('Invalid invoice number from server');
    } catch (error) {
      console.error('Error generating invoice number:', error);
      const currentYear = new Date().getFullYear();
      const nextYear = currentYear + 1;
      const financialYear = `${currentYear}-${nextYear.toString().slice(-2)}`;
      setInvoiceNumber(`DL/01/${financialYear}/1`);
    }
  };

  const handleClientChange = (clientIdOrEvent) => {
    const clientId = typeof clientIdOrEvent === 'string'
      ? clientIdOrEvent
      : clientIdOrEvent.target.value;
    const client = clients.find(c => c.id === clientId);
    const clientPlaceOfSupply = getPlaceOfSupplyFromState(client?.state || '');
    setFormData({
      ...formData,
      clientId,
      placeOfSupply: clientPlaceOfSupply || formData.placeOfSupply
    });
    setSelectedClient(client);
  };

  const handleCompanyChange = (companyIdOrEvent) => {
    const companyId = typeof companyIdOrEvent === 'string'
      ? companyIdOrEvent
      : companyIdOrEvent.target.value;
    const company = companies.find(c => c.id === companyId);
    // If company exists and has bank details, prefill them
    if (company) {
      setFormData({
        ...formData,
        companyId,
        bankName: company.bankName || formData.bankName,
        bankBranch: company.bankBranch || formData.bankBranch,
        bankAccount: company.bankAccount || formData.bankAccount,
        ifsc: company.ifsc || formData.ifsc,
        signatureTitle: company.signatureTitle || formData.signatureTitle
      });
    } else {
      setFormData({ ...formData, companyId });
    }
    setSelectedCompany(company);
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const preventScrollNumberChange = (e) => {
    // Prevent accidental wheel-based +/- step changes on focused number inputs.
    e.target.blur();
    e.stopPropagation();
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData({ ...formData, items: newItems });

    if (field === 'hsnSac' || field === 'description' || field === 'detailedDescription') {
      setTaxSuggestionsByIndex((prev) => {
        if (!prev[index]) return prev;
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  };

  const suggestTaxCodeForItem = async (index) => {
    const item = formData.items[index];
    if (!item) return;

    setTaxSuggestionsByIndex((prev) => ({
      ...prev,
      [index]: { loading: true, suggestions: [], error: null, used: null }
    }));

    try {
      const resp = await fetch('/api/tax-codes/suggest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          description: item.description,
          detailedDescription: item.detailedDescription
        })
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(text || `Suggest failed (${resp.status})`);
      }

      const data = await resp.json();
      const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];

      setTaxSuggestionsByIndex((prev) => ({
        ...prev,
        [index]: {
          loading: false,
          suggestions,
          error: data?.error || null,
          used: data?.used || null,
          hint: data?.hint || null
        }
      }));
    } catch (e) {
      setTaxSuggestionsByIndex((prev) => ({
        ...prev,
        [index]: { loading: false, suggestions: [], error: String(e.message || e), used: null }
      }));
    }
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
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const calculateSubtotalLocal = () => calculateSubtotal(formData.items);
  const calculateTotalCGSTLocal = () => calculateTotalCGST(formData.items);
  const calculateTotalSGSTLocal = () => calculateTotalSGST(formData.items);
  const calculateTotalIGSTLocal = () => calculateTotalIGST(formData.items);
  const calculateTotalLocal = () => calculateTotal(formData.items, isInterState);
  const currencySymbol = getCurrencySymbol(amountInWordsCurrency);

  const saveInvoice = async () => {
    if (!formData.clientId) {
      alert('Please select a client');
      return;
    }

    // ensure we have an invoice number before proceeding
    if (!invoiceNumber) {
      await generateInvoiceNumber();
    }
    const normalizedInvoiceNumber = String(invoiceNumber || '').trim();
    if (!normalizedInvoiceNumber) {
      alert('Please enter a valid invoice number');
      return;
    }
    if (normalizedInvoiceNumber !== invoiceNumber) {
      setInvoiceNumber(normalizedInvoiceNumber);
    }

    // Check for duplicate invoice number and offer to auto-generate (for new/clone)
    try {
      const allRes = await fetch('/api/invoices');
      if (allRes.ok) {
        const allInvoices = await allRes.json();
        const normalizedCompanyId = String(formData.companyId || '');
        const existingWithNumber = allInvoices.find(inv =>
          String(inv.invoiceNumber || '').trim() === normalizedInvoiceNumber &&
          String(inv.companyId || '') === normalizedCompanyId
        );

        const isEditingSameInvoice =
          mode === 'edit' &&
          existingWithNumber &&
          existingWithNumber.id === editingInvoiceId;

        if (existingWithNumber && !isEditingSameInvoice) {
          const shouldGen = window.confirm('Invoice number already exists. Click OK to auto-generate a new invoice number, Cancel to edit.');
          if (shouldGen) {
            try {
              const genRes = await fetch('/api/invoices/generate-number');
              if (genRes.ok) {
                const genJson = await genRes.json();
                if (genJson && genJson.invoiceNumber) {
                  setInvoiceNumber(genJson.invoiceNumber);
                }
              }
            } catch (e) {
              console.error('Error generating new invoice number:', e);
              alert('Unable to generate a new invoice number automatically. Please edit the invoice number manually.');
              return;
            }
          } else {
            return; // let user edit the invoice number
          }
        }
      }
    } catch (e) {
      console.error('Error checking existing invoices:', e);
      // continue; server-side will still enforce uniqueness
    }

    const invoiceData = {
      invoiceNumber: normalizedInvoiceNumber,
      clientId: formData.clientId,
      companyId: formData.companyId,
      invoiceDate: formData.invoiceDate,
      dueDate: formData.dueDate,
      placeOfSupply: formData.placeOfSupply,
      bankName: formData.bankName,
      bankBranch: formData.bankBranch,
      bankAccount: formData.bankAccount,
      ifsc: formData.ifsc,
      signatureTitle: formData.signatureTitle,
      items: formData.items.map(item => ({
        ...item,
        amount: calculateItemAmount(item)
      })),
      subtotal: calculateSubtotalLocal(),
      cgst: calculateTotalCGSTLocal(),
      sgst: calculateTotalSGSTLocal(),
      igst: calculateTotalIGSTLocal(),
      taxType: isInterState ? 'IGST' : 'CGST_SGST',
      total: calculateTotalLocal(),
      status: mode === 'edit' ? invoiceStatus : 'draft',
      amountInWordsCurrency
    };

    console.log('Preparing to save invoice', invoiceData);
    if (!invoiceNumber) {
      alert('Cannot save invoice: invoice number is missing');
      return;
    }

    try {
      const url = mode === 'edit' && editingInvoiceId
        ? `/api/invoices/${editingInvoiceId}`
        : '/api/invoices';
      const method = mode === 'edit' && editingInvoiceId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceData)
      });

      if (response.ok) {
        const saved = await response.json();
        alert('Invoice saved successfully!');
        const targetId = mode === 'edit' && editingInvoiceId ? editingInvoiceId : saved.id;
        if (targetId) {
          navigate(`/invoice/${targetId}`);
        } else {
          navigate('/');
        }
        return;
      }

      // Show server-side error message when available
      let errMsg = response.statusText;
      try {
        const errJson = await response.json();
        if (errJson && errJson.error) errMsg = errJson.error;
      } catch (e) {
        // ignore JSON parse errors
      }
      alert('Error saving invoice: ' + errMsg);
    } catch (error) {
      console.error('Error saving invoice:', error);
      alert('Error saving invoice: ' + (error.message || error));
    }
  };

  const downloadPDF = async () => {
    if (!selectedClient) {
      alert('Please select a client first');
      return;
    }

    try {
      await downloadInvoicePdf(invoicePreviewRef.current, invoiceNumber);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please check the console for details.');
    }
  };

  return (
    <div className="invoice-generator">
      <div className="page-header">
        <h1 className="page-title">
          {mode === 'edit' ? 'Edit Invoice' : mode === 'clone' ? 'Clone Invoice' : 'New Invoice'}
        </h1>
        <p className="page-subtitle">
          {mode === 'edit'
            ? 'Update the details of this invoice'
            : mode === 'clone'
            ? 'Create a new invoice from an existing one'
            : 'Create a professional invoice with GST calculations'}
        </p>
      </div>

      <div className="invoice-layout">
        {/* LEFT SIDE - FORM */}
        <div className="invoice-form-section">
          <div className="card">
            <h3 className="section-title">Invoice Details</h3>
            
            <div className="form-group">
              <label className="form-label">Invoice Number</label>
              <input
                type="text"
                className="form-input"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                style={{ background: '#f8f9fa', fontFamily: 'monospace', fontWeight: '600' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Company <span className="required">*</span></label>
              <SearchableDropdown
                value={formData.companyId}
                options={companies}
                placeholder="Select a company"
                onSelect={handleCompanyChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Client <span className="required">*</span></label>
              <SearchableDropdown
                value={formData.clientId}
                options={clients}
                placeholder="Select a client"
                onSelect={handleClientChange}
              />
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Invoice Date</label>
                <input
                  type="date"
                  name="invoiceDate"
                  className="form-input"
                  value={formData.invoiceDate}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input
                  type="date"
                  name="dueDate"
                  className="form-input"
                  value={formData.dueDate}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Place of Supply</label>
              <input
                type="text"
                name="placeOfSupply"
                className="form-input"
                value={formData.placeOfSupply}
                onChange={handleInputChange}
              />
            </div>

              {/* Bank information fields */}
              <div className="form-group">
                <label className="form-label">Bank Name</label>
                <input
                  type="text"
                  name="bankName"
                  className="form-input"
                  value={formData.bankName}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Branch</label>
                <input
                  type="text"
                  name="bankBranch"
                  className="form-input"
                  value={formData.bankBranch}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Account Number</label>
                <input
                  type="text"
                  name="bankAccount"
                  className="form-input"
                  value={formData.bankAccount}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">IFSC Code</label>
                <input
                  type="text"
                  name="ifsc"
                  className="form-input"
                  value={formData.ifsc}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Signature Title</label>
                <input
                  type="text"
                  name="signatureTitle"
                  className="form-input"
                  value={formData.signatureTitle}
                  onChange={handleInputChange}
                  placeholder="PARTNER"
                />
              </div>

              {/* Tax Mode Toggle */}
              <div className="form-group">
                <label className="form-label">Tax Mode</label>
                <div style={{ 
                  display: 'flex', 
                  gap: '8px', 
                  padding: '4px', 
                  background: '#f0f0f0', 
                  borderRadius: '8px',
                  border: '1px solid var(--border)'
                }}>
                  <button
                    type="button"
                    onClick={() => setTaxMode('auto')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      border: 'none',
                      borderRadius: '6px',
                      background: taxMode === 'auto' ? 'var(--accent)' : 'transparent',
                      color: taxMode === 'auto' ? 'white' : 'var(--text)',
                      fontWeight: taxMode === 'auto' ? '600' : '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      fontSize: '14px'
                    }}
                  >
                    Auto {autoIsInterState ? '(IGST)' : '(CGST+SGST)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaxMode('cgst_sgst')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      border: 'none',
                      borderRadius: '6px',
                      background: taxMode === 'cgst_sgst' ? 'var(--accent)' : 'transparent',
                      color: taxMode === 'cgst_sgst' ? 'white' : 'var(--text)',
                      fontWeight: taxMode === 'cgst_sgst' ? '600' : '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      fontSize: '14px'
                    }}
                  >
                    CGST + SGST
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaxMode('igst')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      border: 'none',
                      borderRadius: '6px',
                      background: taxMode === 'igst' ? 'var(--accent)' : 'transparent',
                      color: taxMode === 'igst' ? 'white' : 'var(--text)',
                      fontWeight: taxMode === 'igst' ? '600' : '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      fontSize: '14px'
                    }}
                  >
                    IGST
                  </button>
                </div>
                {taxMode === 'auto' && (selectedCompany || selectedClient) && (
                  <p style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '8px', marginBottom: 0 }}>
                    {(!companyState || !clientState)
                      ? 'Select company and client states to auto-detect IGST vs CGST+SGST.'
                      : autoIsInterState 
                        ? `Inter-state: ${companyState.toUpperCase()} → ${clientState.toUpperCase()} (using IGST)`
                        : `Same state: ${companyState.toUpperCase()} (using CGST + SGST)`
                    }
                  </p>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Amount In Words Currency</label>
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  padding: '4px',
                  background: '#f0f0f0',
                  borderRadius: '8px',
                  border: '1px solid var(--border)'
                }}>
                  <button
                    type="button"
                    onClick={() => setAmountInWordsCurrency('inr')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      border: 'none',
                      borderRadius: '6px',
                      background: amountInWordsCurrency === 'inr' ? 'var(--accent)' : 'transparent',
                      color: amountInWordsCurrency === 'inr' ? 'white' : 'var(--text)',
                      fontWeight: amountInWordsCurrency === 'inr' ? '600' : '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      fontSize: '14px'
                    }}
                  >
                    Indian Rupee
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmountInWordsCurrency('aud')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      border: 'none',
                      borderRadius: '6px',
                      background: amountInWordsCurrency === 'aud' ? 'var(--accent)' : 'transparent',
                      color: amountInWordsCurrency === 'aud' ? 'white' : 'var(--text)',
                      fontWeight: amountInWordsCurrency === 'aud' ? '600' : '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      fontSize: '14px'
                    }}
                  >
                    Australian Dollar
                  </button>
                </div>
              </div>
            </div>

            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 className="section-title" style={{ marginBottom: 0 }}>Line Items</h3>
                <button type="button" className="btn btn-secondary" onClick={addItem}>
                  + Add Item
                </button>
              </div>

            {formData.items.map((item, index) => (
              <div key={index} className="item-row">
                <div className="item-header">
                  <span style={{ fontWeight: 600, color: 'var(--primary)' }}>Item {index + 1}</span>
                  {formData.items.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ padding: '0.375rem 0.625rem' }}
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <input
                    type="text"
                    className="form-input"
                    value={item.description}
                    onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                    placeholder="Professional Charge"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Detailed Description</label>
                  <textarea
                    className="form-textarea"
                    value={item.detailedDescription}
                    onChange={(e) => handleItemChange(index, 'detailedDescription', e.target.value)}
                    placeholder="Add detailed description for this item (optional)"
                    style={{ minHeight: '80px', resize: 'vertical' }}
                  />
                </div>

                <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="form-group">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <label className="form-label" style={{ marginBottom: 0 }}>HSN/SAC</label>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.5rem', fontSize: '12px' }}
                        onClick={() => suggestTaxCodeForItem(index)}
                        disabled={!!taxSuggestionsByIndex[index]?.loading}
                        title="Suggest HSN/SAC from description"
                      >
                        {taxSuggestionsByIndex[index]?.loading ? 'Suggesting…' : 'Suggest'}
                      </button>
                    </div>
                    <input
                      type="text"
                      className="form-input"
                      value={item.hsnSac}
                      onChange={(e) => handleItemChange(index, 'hsnSac', e.target.value)}
                      placeholder="998222"
                    />
                    {taxSuggestionsByIndex[index]?.error && (
                      <div style={{ marginTop: '6px', color: 'var(--danger)', fontSize: '12px' }}>
                        {taxSuggestionsByIndex[index].error}
                      </div>
                    )}
                    {(taxSuggestionsByIndex[index]?.hint || taxSuggestionsByIndex[index]?.error) && (
                      <div style={{ marginTop: '6px', color: taxSuggestionsByIndex[index]?.error ? 'var(--danger)' : 'var(--text-light)', fontSize: '12px' }}>
                        {taxSuggestionsByIndex[index].error
                          ? `AI unavailable: ${taxSuggestionsByIndex[index].error}`
                          : taxSuggestionsByIndex[index].hint}
                      </div>
                    )}
                    {taxSuggestionsByIndex[index]?.used === 'llm' && (
                      <div style={{ marginTop: '6px', color: 'var(--success, #2e7d32)', fontSize: '12px' }}>
                        AI-ranked suggestions
                      </div>
                    )}
                    {!taxSuggestionsByIndex[index]?.loading &&
                      Array.isArray(taxSuggestionsByIndex[index]?.suggestions) &&
                      taxSuggestionsByIndex[index].suggestions.length > 0 && (
                        <div style={{ marginTop: '8px', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                          {taxSuggestionsByIndex[index].suggestions.slice(0, 5).map((sug, sugIdx) => (
                            <button
                              key={`${sug.codeType || ''}-${sug.code || ''}-${sugIdx}`}
                              type="button"
                              onClick={() => handleItemChange(index, 'hsnSac', sug.code)}
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                border: 'none',
                                background: 'transparent',
                                padding: '8px 10px',
                                cursor: 'pointer',
                                borderBottom: sugIdx < Math.min(5, taxSuggestionsByIndex[index].suggestions.length) - 1 ? '1px solid var(--border)' : 'none'
                              }}
                            >
                              <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)' }}>
                                {(sug.codeType ? `${sug.codeType} ` : '')}{sug.code}
                                {typeof sug.confidence === 'number' ? (
                                  <span style={{ marginLeft: '8px', fontWeight: 500, color: 'var(--text-light)' }}>
                                    {Math.round(sug.confidence * 100)}%
                                  </span>
                                ) : null}
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '2px' }}>
                                {sug.description || sug.rationale || ''}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Quantity</label>
                    <input
                      type="number"
                      className="form-input"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      onWheel={preventScrollNumberChange}
                      min="0"
                      step="1"
                    />
                  </div>
                </div>

                  <div className="form-group">
                  <label className="form-label">Rate ({currencySymbol})</label>
                  <input
                    type="number"
                    className="form-input"
                      value={item.rate}
                      onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                      onWheel={preventScrollNumberChange}
                      min="0"
                      step="0.01"
                  />
                </div>

                <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="form-group">
                    <label className="form-label">{isInterState ? 'IGST %' : 'CGST %'}</label>
                    {isInterState ? (
                      <input
                        type="number"
                        className="form-input"
                        value={(item.igstPercent != null && item.igstPercent !== '') ? item.igstPercent : ((parseFloat(item.cgstPercent)||0)+(parseFloat(item.sgstPercent)||0))}
                        onChange={(e) => handleItemChange(index, 'igstPercent', e.target.value ? parseFloat(e.target.value) : '')}
                        onWheel={preventScrollNumberChange}
                        min="0"
                        step="0.01"
                      />
                    ) : (
                      <input
                        type="number"
                        className="form-input"
                        value={item.cgstPercent}
                        onChange={(e) => handleItemChange(index, 'cgstPercent', parseFloat(e.target.value) || 0)}
                        onWheel={preventScrollNumberChange}
                        min="0"
                        step="0.01"
                      />
                    )}
                  </div>
                  {!isInterState && (
                    <div className="form-group">
                      <label className="form-label">SGST %</label>
                      <input
                        type="number"
                        className="form-input"
                        value={item.sgstPercent}
                        onChange={(e) => handleItemChange(index, 'sgstPercent', parseFloat(e.target.value) || 0)}
                        onWheel={preventScrollNumberChange}
                        min="0"
                        step="0.01"
                      />
                    </div>
                  )}
                </div>

                <div className="item-total">
                  Amount: {formatInvoiceAmount(calculateItemAmount(item), amountInWordsCurrency)}
                </div>
              </div>
            ))}

            <div className="invoice-summary">
              <div className="summary-row">
                <span>Subtotal:</span>
                <span>{formatInvoiceAmount(calculateSubtotalLocal(), amountInWordsCurrency)}</span>
              </div>
              {isInterState ? (
                <div className="summary-row">
                  <span>Tax:</span>
                  <span>{formatInvoiceAmount(calculateTotalIGSTLocal(), amountInWordsCurrency)}</span>
                </div>
              ) : (
                <>
                  <div className="summary-row">
                    <span>CGST:</span>
                    <span>{formatInvoiceAmount(calculateTotalCGSTLocal(), amountInWordsCurrency)}</span>
                  </div>
                  <div className="summary-row">
                    <span>SGST:</span>
                    <span>{formatInvoiceAmount(calculateTotalSGSTLocal(), amountInWordsCurrency)}</span>
                  </div>
                </>
              )}
              <div className="summary-row total">
                <span>Total:</span>
                <span>{formatInvoiceAmount(calculateTotalLocal(), amountInWordsCurrency)}</span>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button className="btn btn-secondary" onClick={saveInvoice}>
              Save Invoice
            </button>
            <button className="btn btn-primary" onClick={downloadPDF}>
              <Download size={18} />
              Download PDF
            </button>
          </div>
        </div>

        {/* RIGHT SIDE - PREVIEW */}
        <div className="invoice-preview-section">
          <div className="preview-sticky">
            <div className="preview-header">
              <Eye size={18} />
              Live Preview
            </div>
            
            <div className="invoice-preview">
              <InvoicePreview
                ref={invoicePreviewRef}
                invoiceNumber={invoiceNumber}
                formData={formData}
                selectedClient={selectedClient}
                selectedCompany={selectedCompany}
                isInterState={isInterState}
                amountInWordsCurrency={amountInWordsCurrency}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InvoiceGenerator;