import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Download, Eye } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import './InvoiceGenerator.css';

function InvoiceGenerator() {
  const [clients, setClients] = useState([]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [formData, setFormData] = useState({
    clientId: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    placeOfSupply: 'Delhi (07)',
    items: [
      {
        description: '',
        hsnSac: '',
        quantity: 1,
        rate: 0,
        cgstPercent: 9,
        sgstPercent: 9
      }
    ]
  });
  
  const [selectedClient, setSelectedClient] = useState(null);
  const invoicePreviewRef = useRef(null);
  const firmState = 'delhi';
  const computedSelectedClient = selectedClient || clients.find(c => c.id === formData.clientId) || null;
  const clientStateNormalized = (computedSelectedClient && computedSelectedClient.state) ? String(computedSelectedClient.state).toLowerCase() : '';
  const isInterState = clientStateNormalized && !clientStateNormalized.includes(firmState);
  const signedAt = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' });

  useEffect(() => {
    fetchClients();
    generateInvoiceNumber();
  }, []);
  
  useEffect(() => {
    if (!invoiceNumber) {
      setInvoiceNumber(`INV/${Date.now()}`);
    }
  }, [invoiceNumber]);

  const fetchClients = async () => {
    try {
      const response = await fetch('/api/clients');
      const data = await response.json();
      setClients(data);
    } catch (error) {
      console.error('Error fetching clients:', error);
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

  const addItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          description: '',
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

  const calculateItemAmount = (item) => {
    return item.quantity * item.rate;
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

    const invoiceData = {
      invoiceNumber,
      clientId: formData.clientId,
      invoiceDate: formData.invoiceDate,
      dueDate: formData.dueDate,
      placeOfSupply: formData.placeOfSupply,
      items: formData.items.map(item => ({
        ...item,
        amount: calculateItemAmount(item)
      })),
      subtotal: calculateSubtotal(),
      cgst: calculateTotalCGST(),
      sgst: calculateTotalSGST(),
      total: calculateTotal(),
      status: 'draft'
    };

    try {
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceData)
      });

      if (response.ok) {
        alert('Invoice saved successfully!');
      }
    } catch (error) {
      console.error('Error saving invoice:', error);
      alert('Error saving invoice');
    }
  };

  const downloadPDF = async () => {
    if (!selectedClient) {
      alert('Please select a client first');
      return;
    }

    const element = invoicePreviewRef.current;
    
    try {
      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: element.scrollWidth,
        height: element.scrollHeight
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      
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
        <h1 className="page-title">New Invoice</h1>
        <p className="page-subtitle">Create a professional invoice with GST calculations</p>
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
                readOnly
                style={{ background: '#f8f9fa', fontFamily: 'monospace', fontWeight: '600' }}
              />
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
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="section-title">Line Items</h3>
              <button className="btn btn-outline" onClick={addItem} style={{ padding: '0.5rem 1rem' }}>
                <Plus size={16} />
                Add Item
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
                      onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Rate (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={item.rate}
                    onChange={(e) => handleItemChange(index, 'rate', parseFloat(e.target.value) || 0)}
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
                  <span>IGST:</span>
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
            
            <div className="invoice-preview" ref={invoicePreviewRef}>
              {/* Header with Logo, Firm Details, and TAX INVOICE */}
              <div className="invoice-header">
                <div className="header-left">
                  <img src="/logo.png" alt="CA India Logo" className="invoice-logo" />
                </div>
                <div className="header-center">
                  <h1 className="firm-title">R Bhargava & Associates</h1>
                  <p className="firm-address">
                    247-B, MIG FLATS<br />
                    RAJOURI GARDEN<br />
                    NEW DELHI Delhi 110027<br />
                    India
                  </p>
                  <p className="firm-gstin">GSTIN 07AAQFR3892K1ZE</p>
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
                      <td>{item.description || '-'}</td>
                      <td style={{ textAlign: 'center' }}>{item.hsnSac || '-'}</td>
                      <td style={{ textAlign: 'center' }}>{item.quantity.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(item.rate)}</td>
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
                    <strong>BANK NAME :</strong> HDFC BANK LIMITED<br />
                    <strong>BRANCH :</strong> CC-31, COMMERCIAL COMPLEX, NARAINA IND AREA<br />
                    <strong>BANK ACCOUNT NO :</strong> 50200003760432<br />
                    <strong>IFSC CODE :</strong> HDFC0000440
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
                          <td>CGST9 (9%)</td>
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
                      <div className="signature-top">FOR R BHARGAVA & ASSOCIATES</div>
                      <div className="signature-middle">
                        {/* Empty space for physical signature */}
                      </div>
                      <div className="signature-bottom">PARTNER</div>
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