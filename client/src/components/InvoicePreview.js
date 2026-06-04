import React, { forwardRef } from 'react';
import {
  calculateItemAmount,
  calculateItemCGST,
  calculateItemSGST,
  calculateItemIGST,
  calculateSubtotal,
  calculateTotalCGST,
  calculateTotalSGST,
  calculateTotalIGST,
  calculateTotal,
  numberToWords,
  formatCurrency
} from '../utils/invoiceCalculations';

const InvoicePreview = forwardRef(function InvoicePreview(
  {
    invoiceNumber,
    formData,
    selectedClient,
    selectedCompany,
    isInterState,
    amountInWordsCurrency = 'inr'
  },
  ref
) {
  const items = formData?.items || [];
  const selectedCurrencySymbol = amountInWordsCurrency === 'aud' ? '$' : '₹';

  return (
    <div className="invoice-page" ref={ref}>
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
          {selectedCompany?.name ? (
            <>
              <h1 className="firm-title">{selectedCompany.name}</h1>
              {selectedCompany.address && (
                <p className="firm-address">{selectedCompany.address}</p>
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
                  {selectedCompany.email && selectedCompany.phone && (
                    <span className="firm-contact-separator"> · </span>
                  )}
                  {selectedCompany.phone && <span>Phone: {selectedCompany.phone}</span>}
                </p>
              )}
            </>
          ) : (
            <>
              <h1 className="firm-title">R Bhargava & Associates</h1>
              <p className="firm-address">
                247-B, MIG FLATS, RAJOURI GARDEN,
                <br />
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
            <span className="meta-value">
              {new Date(formData.invoiceDate).toLocaleDateString('en-GB')}
            </span>
          </div>
          <div className="meta-row">
            <span className="meta-label">Terms</span>
            <span className="meta-colon">:</span>
            <span className="meta-value">Due on Receipt</span>
          </div>
          <div className="meta-row">
            <span className="meta-label">Due Date</span>
            <span className="meta-colon">:</span>
            <span className="meta-value">
              {new Date(formData.dueDate).toLocaleDateString('en-GB')}
            </span>
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

      {selectedClient && (
        <div className="client-info">
          <div className="client-name">{selectedClient.name}</div>
          <div className="client-address">
            {selectedClient.address && (
              <>
                {selectedClient.address}
                <br />
              </>
            )}
            {selectedClient.city && <>{selectedClient.city}</>}
            {selectedClient.state && <>, {selectedClient.state}</>}
            {selectedClient.pincode && <>, {selectedClient.pincode}</>}
            {amountInWordsCurrency !== 'aud' && (
              <>
                <br />
                India
              </>
            )}
          </div>
          {selectedClient.gstin && (
            <div className="client-gstin">GSTIN {selectedClient.gstin}</div>
          )}
        </div>
      )}

      <table className="invoice-table">
        <thead>
          <tr>
            <th style={{ width: '40px' }}>
              S.
              <br />
              NO
            </th>
            <th>Item & Description</th>
            <th style={{ width: '80px' }}>
              HSN
              <br />
              /SAC
            </th>
            <th style={{ width: '50px' }}>Qty</th>
            <th style={{ width: '90px' }}>Rate</th>
            {isInterState ? (
              <>
                <th style={{ width: '60px' }}>
                  IGST
                  <br />%
                </th>
                <th style={{ width: '70px' }}>Amt</th>
              </>
            ) : (
              <>
                <th style={{ width: '60px' }}>
                  CGST
                  <br />%
                </th>
                <th style={{ width: '70px' }}>Amt</th>
                <th style={{ width: '60px' }}>
                  SGST
                  <br />%
                </th>
                <th style={{ width: '70px' }}>Amt</th>
              </>
            )}
            <th style={{ width: '90px', textAlign: 'right' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{index + 1}</td>
              <td>
                <div className="invoice-item-title">{item.description || '-'}</div>
                {item.detailedDescription && (
                  <div className="invoice-item-detail">{item.detailedDescription}</div>
                )}
              </td>
              <td style={{ textAlign: 'center' }}>{item.hsnSac || '-'}</td>
              <td style={{ textAlign: 'center' }}>
                {(parseFloat(item.quantity) || 0).toFixed(2)}
              </td>
              <td style={{ textAlign: 'right' }}>
                {formatCurrency(parseFloat(item.rate) || 0)}
              </td>
              {isInterState ? (
                <>
                  <td style={{ textAlign: 'right' }}>
                    {item.igstPercent !== undefined &&
                    item.igstPercent !== null &&
                    item.igstPercent !== ''
                      ? parseFloat(item.igstPercent) || 0
                      : (parseFloat(item.cgstPercent) || 0) +
                        (parseFloat(item.sgstPercent) || 0)}
                    %
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {formatCurrency(calculateItemIGST(item))}
                  </td>
                </>
              ) : (
                <>
                  <td style={{ textAlign: 'right' }}>{item.cgstPercent}%</td>
                  <td style={{ textAlign: 'right' }}>
                    {formatCurrency(calculateItemCGST(item))}
                  </td>
                  <td style={{ textAlign: 'right' }}>{item.sgstPercent}%</td>
                  <td style={{ textAlign: 'right' }}>
                    {formatCurrency(calculateItemSGST(item))}
                  </td>
                </>
              )}
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                {formatCurrency(calculateItemAmount(item))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="bottom-section">
        <div className="bottom-left">
          <div className="total-words">
            <strong>Total In Words</strong>
            <br />
            <em>
              {amountInWordsCurrency === 'aud' ? 'Australian Dollar' : 'Indian Rupee'}{' '}
              {numberToWords(Math.floor(calculateTotal(items, isInterState)))} Only
            </em>
          </div>

          <div className="notes-section">
            <strong>Notes</strong>
            <br />
            Thanks for your business.
          </div>

          <div className="bank-details">
            <strong>BANK NAME :</strong> {formData.bankName || 'N/A'}
            <br />
            <strong>BRANCH :</strong> {formData.bankBranch || 'N/A'}
            <br />
            <strong>BANK ACCOUNT NO :</strong> {formData.bankAccount || 'N/A'}
            <br />
            <strong>IFSC CODE :</strong> {formData.ifsc || 'N/A'}
          </div>

          <div className="terms-conditions">
            <strong>Terms & Conditions</strong>
            <ol>
              <li>Payment is due on the receipt of the bill</li>
              <li>All Disputes shall be subject to Delhi Jurisdiction</li>
            </ol>
          </div>
        </div>

        <div className="bottom-right">
          <table className="totals-table">
            <tbody>
              <tr>
                <td>Sub Total</td>
                <td className="amount-cell">{formatCurrency(calculateSubtotal(items))}</td>
              </tr>
              {isInterState ? (
                <tr>
                  <td>Tax</td>
                  <td className="amount-cell">{formatCurrency(calculateTotalIGST(items))}</td>
                </tr>
              ) : (
                <>
                  <tr>
                    <td>CGST9 (9%)</td>
                    <td className="amount-cell">{formatCurrency(calculateTotalCGST(items))}</td>
                  </tr>
                  <tr>
                    <td>SGST9 (9%)</td>
                    <td className="amount-cell">{formatCurrency(calculateTotalSGST(items))}</td>
                  </tr>
                </>
              )}
              <tr className="total-row">
                <td>
                  <strong>Total</strong>
                </td>
                <td className="amount-cell">
                  <strong>
                    {selectedCurrencySymbol}
                    {formatCurrency(calculateTotal(items, isInterState))}
                  </strong>
                </td>
              </tr>
              <tr className="balance-row">
                <td>
                  <strong>Balance Due</strong>
                </td>
                <td className="amount-cell">
                  <strong>
                    {selectedCurrencySymbol}
                    {formatCurrency(calculateTotal(items, isInterState))}
                  </strong>
                </td>
              </tr>
            </tbody>
          </table>

          <div className="signature-box">
            <div className="signature-inner">
              <div className="signature-top">
                FOR {(selectedCompany?.name || 'R BHARGAVA & ASSOCIATES').toUpperCase()}
              </div>
              <div className="signature-middle" />
              <div className="signature-bottom">{formData.signatureTitle || 'PARTNER'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default InvoicePreview;
