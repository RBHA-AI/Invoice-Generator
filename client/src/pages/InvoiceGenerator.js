import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Trash2, Download, Eye } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import './InvoiceGenerator.css';

function InvoiceGenerator() {
  const [clients, setClients] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const defaultBank = {
    bankName: 'HDFC BANK LIMITED',
    bankBranch: 'CC-31, COMMERCIAL COMPLEX, NARAINA IND AREA',
    bankAccount: '50200003760432',
    ifsc: 'HDFC0000440'
  };
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
  const invoicePreviewRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const editInvoiceIdFromQuery = searchParams.get('edit');
  const cloneInvoiceIdFromQuery = searchParams.get('clone');
  const [mode, setMode] = useState('new'); // 'new' | 'edit' | 'clone'
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);
  
  // Get states from selected company and client
  const companyState = (selectedCompany?.state || 'delhi').toLowerCase();
  const clientState = (selectedClient?.state || '').toLowerCase();
  
  // Auto-detect interstate
  const autoIsInterState = clientState && companyState !== clientState;
  
  // Final tax mode decision
  const isInterState = taxMode === 'auto' ? autoIsInterState : taxMode === 'igst';

  useEffect(() => {
    fetchClients();
    fetchCompanies();
    generateInvoiceNumber();
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
    if (!invoiceNumber) {
      setInvoiceNumber(`INV/${Date.now()}`);
    }
  }, [invoiceNumber]);

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

        if (mode === 'edit' && data.invoiceNumber) {
          setInvoiceNumber(data.invoiceNumber);
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

  const handleClientChange = (e) => {
    const clientId = e.target.value;
    setFormData({ ...formData, clientId });
    const client = clients.find(c => c.id === clientId);
    setSelectedClient(client);
  };

  const handleCompanyChange = (e) => {
    const companyId = e.target.value;
    const company = companies.find(c => c.id === companyId);
    // If company exists and has bank details, prefill them
    if (company) {
      setFormData({
        ...formData,
        companyId,
        bankName: company.bankName || formData.bankName,
        bankBranch: company.bankBranch || formData.bankBranch,
        bankAccount: company.bankAccount || formData.bankAccount,
        ifsc: company.ifsc || formData.ifsc
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

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData({ ...formData, items: newItems });
  };


  const removeItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const calculateItemAmount = (item) => {
    const qty = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.rate) || 0;
    return qty * rate;
  };

  const calculateItemCGST = (item) => {
    return (calculateItemAmount(item) * item.cgstPercent) / 100;
  };

  const calculateItemSGST = (item) => {
    return (calculateItemAmount(item) * item.sgstPercent) / 100;
  };

  const calculateItemIGST = (item) => {
    const igst = (parseFloat(item.cgstPercent) || 0) + (parseFloat(item.sgstPercent) || 0);
    return (calculateItemAmount(item) * igst) / 100;
  };

  const calculateSubtotal = () => {
    return formData.items.reduce((sum, item) => sum + calculateItemAmount(item), 0);
  };

  const calculateTotalCGST = () => {
    return formData.items.reduce((sum, item) => sum + calculateItemCGST(item), 0);
  };

  const calculateTotalSGST = () => {
    return formData.items.reduce((sum, item) => sum + calculateItemSGST(item), 0);
  };

  const calculateTotalIGST = () => {
    return formData.items.reduce((sum, item) => sum + calculateItemIGST(item), 0);
  };

  const calculateTotal = () => {
    if (isInterState) {
      return calculateSubtotal() + calculateTotalIGST();
    }
    return calculateSubtotal() + calculateTotalCGST() + calculateTotalSGST();
  };

  const numberToWords = (num) => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

    if (num === 0) return 'Zero';

    const convertLessThanThousand = (n) => {
      if (n === 0) return '';
      if (n < 10) return ones[n];
      if (n < 20) return teens[n - 10];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
      return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertLessThanThousand(n % 100) : '');
    };

    const crore = Math.floor(num / 10000000);
    const lakh = Math.floor((num % 10000000) / 100000);
    const thousand = Math.floor((num % 100000) / 1000);
    const remainder = num % 1000;

    let result = '';
    if (crore > 0) result += convertLessThanThousand(crore) + ' Crore ';
    if (lakh > 0) result += convertLessThanThousand(lakh) + ' Lakh ';
    if (thousand > 0) result += convertLessThanThousand(thousand) + ' Thousand ';
    if (remainder > 0) result += convertLessThanThousand(remainder);

    return result.trim();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const saveInvoice = async () => {
    if (!formData.clientId) {
      alert('Please select a client');
      return;
    }

    // ensure we have an invoice number before proceeding
    if (!invoiceNumber) {
      await generateInvoiceNumber();
    }

    // Check for duplicate invoice number and offer to auto-generate (for new/clone)
    try {
      const allRes = await fetch('/api/invoices');
      if (allRes.ok) {
        const allInvoices = await allRes.json();
        const existingWithNumber = allInvoices.find(inv => String(inv.invoiceNumber) === String(invoiceNumber));

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
      invoiceNumber,
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
      subtotal: calculateSubtotal(),
      cgst: calculateTotalCGST(),
      sgst: calculateTotalSGST(),
      igst: calculateTotalIGST(),
      taxType: isInterState ? 'IGST' : 'CGST_SGST',
      total: calculateTotal(),
      status: 'draft'
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

    const element = invoicePreviewRef.current;
    
    try {
      // Get full dimensions of the invoice content
      const fullWidth = element.scrollWidth || element.offsetWidth;
      const fullHeight = element.scrollHeight || element.offsetHeight;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: fullWidth,
        height: fullHeight,
        allowTaint: true
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // Add margins so outer border is fully visible on all sides
      const margin = 8; // in mm
      const usablePageHeight = pdfHeight - margin * 2;
      
      // Calculate dimensions to fit on A4 within margins
      const imgWidth = pdfWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Handle multi-page PDFs
      let position = margin;
      if (imgHeight > usablePageHeight) {
        // Multiple pages needed
        let heightLeft = imgHeight;
        while (heightLeft > 0) {
          pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
          heightLeft -= usablePageHeight;
          position -= usablePageHeight;
          if (heightLeft > 0) {
            pdf.addPage();
            position = margin;
          }
        }
      } else {
        // Single page
        pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
        // Draw a crisp vector border around the full invoice area
        pdf.setLineWidth(0.5);
        pdf.rect(margin, margin, imgWidth, imgHeight);
      }
      
      const safeInvoiceNumber = String(invoiceNumber).replace(/[^\w-]+/g, '-');
      const filename = `invoice-${safeInvoiceNumber}.pdf`;
      pdf.save(filename);
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
              <select
                className="form-select"
                value={formData.companyId}
                onChange={handleCompanyChange}
              >
                <option value="">Select a company</option>
                {companies.map(company => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Client <span className="required">*</span></label>
              <select
                className="form-select"
                value={formData.clientId}
                onChange={handleClientChange}
                required
              >
                <option value="">Select a client</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
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
                    {autoIsInterState 
                      ? `Inter-state: ${companyState.toUpperCase()} → ${clientState.toUpperCase()} (using IGST)`
                      : `Same state: ${companyState.toUpperCase()} (using CGST + SGST)`
                    }
                  </p>
                )}
              </div>
            </div>

            <div className="card">
              <h3 className="section-title">Line Items</h3>

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
                    <label className="form-label">HSN/SAC</label>
                    <input
                      type="text"
                      className="form-input"
                      value={item.hsnSac}
                      onChange={(e) => handleItemChange(index, 'hsnSac', e.target.value)}
                      placeholder="998222"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Quantity</label>
                    <input
                      type="number"
                      className="form-input"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      min="0"
                      step="1"
                    />
                  </div>
                </div>

                  <div className="form-group">
                  <label className="form-label">Rate (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                      value={item.rate}
                      onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
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
                        min="0"
                        step="0.01"
                      />
                    ) : (
                      <input
                        type="number"
                        className="form-input"
                        value={item.cgstPercent}
                        onChange={(e) => handleItemChange(index, 'cgstPercent', parseFloat(e.target.value) || 0)}
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
                        min="0"
                        step="0.01"
                      />
                    </div>
                  )}
                </div>

                <div className="item-total">
                  Amount: ₹{formatCurrency(calculateItemAmount(item))}
                </div>
              </div>
            ))}

            <div className="invoice-summary">
              <div className="summary-row">
                <span>Subtotal:</span>
                <span>₹{formatCurrency(calculateSubtotal())}</span>
              </div>
              {isInterState ? (
                <div className="summary-row">
                  <span>Tax:</span>
                  <span>₹{formatCurrency(calculateTotalIGST())}</span>
                </div>
              ) : (
                <>
                  <div className="summary-row">
                    <span>CGST:</span>
                    <span>₹{formatCurrency(calculateTotalCGST())}</span>
                  </div>
                  <div className="summary-row">
                    <span>SGST:</span>
                    <span>₹{formatCurrency(calculateTotalSGST())}</span>
                  </div>
                </>
              )}
              <div className="summary-row total">
                <span>Total:</span>
                <span>₹{formatCurrency(calculateTotal())}</span>
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
              <div className="invoice-page" ref={invoicePreviewRef}>
              {/* Header with Logo, Firm Details, and TAX INVOICE */}
              <div className="invoice-header">
                <div className="header-left">
                  {selectedCompany && selectedCompany.logo ? (
                    <img 
                      src={selectedCompany.logo} 
                      alt={`${selectedCompany.name} Logo`} 
                      className="invoice-logo"
                      onError={(e) => {
                        e.target.src = '/logo.png';
                      }}
                    />
                  ) : (
                    <img src="/logo.png" alt="CA India Logo" className="invoice-logo" />
                  )}
                </div>
                <div className="header-center">
                  {selectedCompany ? (
                    <>
                      <h1 className="firm-title">{selectedCompany.name}</h1>
                      {selectedCompany.address && (
                        <p className="firm-address">
                          {selectedCompany.address}
                        </p>
                      )}
                      {selectedCompany.gstin && (
                        <p className="firm-gstin">GSTIN {selectedCompany.gstin}</p>
                      )}
                      {selectedCompany.msmeNumber && (
                        <p className="firm-gstin">MSME {selectedCompany.msmeNumber}</p>
                      )}
                      {(selectedCompany.email || selectedCompany.phone) && (
                        <p className="firm-contact">
                          {selectedCompany.email && <span>Email: {selectedCompany.email}</span>}
                          {selectedCompany.email && selectedCompany.phone && <span className="firm-contact-separator"> · </span>}
                          {selectedCompany.phone && <span>Phone: {selectedCompany.phone}</span>}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <h1 className="firm-title">R Bhargava & Associates</h1>
                      <p className="firm-address">
                        247-B, MIG FLATS, RAJOURI GARDEN,<br />
                        NEW DELHI Delhi 110027, India
                      </p>
                      <p className="firm-gstin">GSTIN 07AAQFR3892K1ZE</p>
                    </>
                  )}
                </div>
                <div className="header-right">
                  <h2 className="tax-invoice-label">TAX INVOICE</h2>
                </div>
              </div>

              {/* Invoice Details Box */}
              <div className="meta-box">
                <div className="meta-left">
                  <div className="meta-row">
                    <span className="meta-label">Invoice Serial No:</span> 
                    <span className="meta-colon">:</span>
                    <span className="meta-value">{invoiceNumber}</span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-label">Invoice Date</span>
                    <span className="meta-colon">:</span>
                    <span className="meta-value">{new Date(formData.invoiceDate).toLocaleDateString('en-GB')}</span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-label">Terms</span>
                    <span className="meta-colon">:</span>
                    <span className="meta-value">Due on Receipt</span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-label">Due Date</span>
                    <span className="meta-colon">:</span>
                    <span className="meta-value">{new Date(formData.dueDate).toLocaleDateString('en-GB')}</span>
                  </div>
                </div>
                <div className="meta-right">
                  <div className="meta-row">
                    <span className="meta-label">Place Of Supply</span>
                    <span className="meta-colon">:</span>
                    <span className="meta-value">{formData.placeOfSupply}</span>
                  </div>
                </div>
              </div>

              {/* Client Info */}
              {selectedClient && (
                <div className="client-info">
                  <div className="client-name">{selectedClient.name}</div>
                  <div className="client-address">
                    {selectedClient.address && <>{selectedClient.address}<br /></>}
                    {selectedClient.city && <>{selectedClient.city}</>}
                    {selectedClient.state && <>, {selectedClient.state}</>}
                    {selectedClient.pincode && <>, {selectedClient.pincode}</>}
                    <br />India
                  </div>
                  {selectedClient.gstin && (
                    <div className="client-gstin">GSTIN {selectedClient.gstin}</div>
                  )}
                </div>
              )}

              {/* Items Table */}
              <table className="invoice-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>S.<br/>NO</th>
                    <th>Item & Description</th>
                    <th style={{ width: '80px' }}>HSN<br/>/SAC</th>
                    <th style={{ width: '50px' }}>Qty</th>
                    <th style={{ width: '90px' }}>Rate</th>
                    {isInterState ? (
                      <>
                        <th style={{ width: '60px' }}>IGST<br/>%</th>
                        <th style={{ width: '70px' }}>Amt</th>
                      </>
                    ) : (
                      <>
                        <th style={{ width: '60px' }}>CGST<br/>%</th>
                        <th style={{ width: '70px' }}>Amt</th>
                        <th style={{ width: '60px' }}>SGST<br/>%</th>
                        <th style={{ width: '70px' }}>Amt</th>
                      </>
                    )}
                    <th style={{ width: '90px', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.items.map((item, index) => (
                    <tr key={index}>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{index + 1}</td>
                      <td>
                        <div>{item.description || '-'}</div>
                        {item.detailedDescription && (
                          <div style={{ fontSize: '0.85em', color: '#666', marginTop: '4px', fontStyle: 'italic' }}>
                            {item.detailedDescription}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>{item.hsnSac || '-'}</td>
                      <td style={{ textAlign: 'center' }}>{(parseFloat(item.quantity) || 0).toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(parseFloat(item.rate) || 0)}</td>
                      {isInterState ? (
                        <>
                          <td style={{ textAlign: 'right' }}>
                            {((parseFloat(item.cgstPercent)||0)+(parseFloat(item.sgstPercent)||0))}%
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {formatCurrency(calculateItemIGST(item))}
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ textAlign: 'right' }}>{item.cgstPercent}%</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(calculateItemCGST(item))}</td>
                          <td style={{ textAlign: 'right' }}>{item.sgstPercent}%</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(calculateItemSGST(item))}</td>
                        </>
                      )}
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                        {formatCurrency(calculateItemAmount(item))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals and Signature Section */}
              <div className="bottom-section">
                <div className="bottom-left">
                  {/* Total in Words */}
                  <div className="total-words">
                    <strong>Total In Words</strong><br />
                    <em>Indian Rupee {numberToWords(Math.floor(calculateTotal()))} Only</em>
                  </div>

                  {/* Notes */}
                  <div className="notes-section">
                    <strong>Notes</strong><br />
                    Thanks for your business.
                  </div>

                  {/* Bank Details */}
                  <div className="bank-details">
                    <strong>BANK NAME :</strong> {formData.bankName || 'N/A'}<br />
                    <strong>BRANCH :</strong> {formData.bankBranch || 'N/A'}<br />
                    <strong>BANK ACCOUNT NO :</strong> {formData.bankAccount || 'N/A'}<br />
                    <strong>IFSC CODE :</strong> {formData.ifsc || 'N/A'}
                  </div>

                  {/* Terms & Conditions */}
                  <div className="terms-conditions">
                    <strong>Terms & Conditions</strong>
                    <ol>
                      <li>Payment is due on the receipt of the bill</li>
                      <li>All Disputes shall be subject to Delhi Jurisdiction</li>
                    </ol>
                  </div>
                </div>

                <div className="bottom-right">
                  {/* Totals Table */}
                  <table className="totals-table">
                    <tbody>
                      <tr>
                        <td>Sub Total</td>
                        <td className="amount-cell">{formatCurrency(calculateSubtotal())}</td>
                      </tr>
                      {isInterState ? (
                        <tr>
                          <td>Tax</td>
                          <td className="amount-cell">{formatCurrency(calculateTotalIGST())}</td>
                        </tr>
                      ) : (
                        <>
                          <tr>
                            <td>CGST9 (9%)</td>
                            <td className="amount-cell">{formatCurrency(calculateTotalCGST())}</td>
                          </tr>
                          <tr>
                            <td>SGST9 (9%)</td>
                            <td className="amount-cell">{formatCurrency(calculateTotalSGST())}</td>
                          </tr>
                        </>
                      )}
                      <tr className="total-row">
                        <td><strong>Total</strong></td>
                        <td className="amount-cell"><strong>₹{formatCurrency(calculateTotal())}</strong></td>
                      </tr>
                      <tr className="balance-row">
                        <td><strong>Balance Due</strong></td>
                        <td className="amount-cell"><strong>₹{formatCurrency(calculateTotal())}</strong></td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Signature Box */}
                  <div className="signature-box">
                    <div className="signature-inner">
                      <div className="signature-top">
                        FOR {selectedCompany ? selectedCompany.name.toUpperCase() : 'R BHARGAVA & ASSOCIATES'}
                      </div>
                      <div className="signature-middle">
                        {/* Empty space for physical signature */}
                      </div>
                      <div className="signature-bottom">{formData.signatureTitle || 'PARTNER'}</div>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InvoiceGenerator;