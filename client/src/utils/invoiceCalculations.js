export const GST_STATE_CODES = {
  'jammu and kashmir': '01',
  'himachal pradesh': '02',
  punjab: '03',
  chandigarh: '04',
  uttarakhand: '05',
  haryana: '06',
  delhi: '07',
  rajasthan: '08',
  'uttar pradesh': '09',
  bihar: '10',
  sikkim: '11',
  'arunachal pradesh': '12',
  nagaland: '13',
  manipur: '14',
  mizoram: '15',
  tripura: '16',
  meghalaya: '17',
  assam: '18',
  'west bengal': '19',
  jharkhand: '20',
  orissa: '21',
  odisha: '21',
  chhattisgarh: '22',
  'madhya pradesh': '23',
  gujarat: '24',
  'dadra and nagar haveli & daman and diu': '26',
  'dadra and nagar haveli and daman and diu': '26',
  maharashtra: '27',
  karnataka: '29',
  goa: '30',
  lakshadweep: '31',
  kerala: '32',
  'tamil nadu': '33',
  puducherry: '34',
  'andaman and nicobar': '35',
  'andaman and nicobar islands': '35',
  telangana: '36',
  'andhra pradesh': '37',
  ladakh: '38'
};

export const normalizeState = (state = '') =>
  String(state)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export const getPlaceOfSupplyFromState = (state = '') => {
  const normalized = normalizeState(state);
  if (!normalized) return '';
  const code = GST_STATE_CODES[normalized];
  if (!code) return state;
  return `${state.trim()} (${code})`;
};

export const calculateItemAmount = (item) => {
  const qty = parseFloat(item.quantity) || 0;
  const rate = parseFloat(item.rate) || 0;
  return qty * rate;
};

export const calculateItemCGST = (item) =>
  (calculateItemAmount(item) * (parseFloat(item.cgstPercent) || 0)) / 100;

export const calculateItemSGST = (item) =>
  (calculateItemAmount(item) * (parseFloat(item.sgstPercent) || 0)) / 100;

export const calculateItemIGST = (item) => {
  const igst =
    item.igstPercent !== undefined && item.igstPercent !== null && item.igstPercent !== ''
      ? parseFloat(item.igstPercent) || 0
      : (parseFloat(item.cgstPercent) || 0) + (parseFloat(item.sgstPercent) || 0);
  return (calculateItemAmount(item) * igst) / 100;
};

export const calculateSubtotal = (items) =>
  items.reduce((sum, item) => sum + calculateItemAmount(item), 0);

export const calculateTotalCGST = (items) =>
  items.reduce((sum, item) => sum + calculateItemCGST(item), 0);

export const calculateTotalSGST = (items) =>
  items.reduce((sum, item) => sum + calculateItemSGST(item), 0);

export const calculateTotalIGST = (items) =>
  items.reduce((sum, item) => sum + calculateItemIGST(item), 0);

export const calculateTotal = (items, isInterState) => {
  if (isInterState) {
    return calculateSubtotal(items) + calculateTotalIGST(items);
  }
  return calculateSubtotal(items) + calculateTotalCGST(items) + calculateTotalSGST(items);
};

export const numberToWords = (num) => {
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

export const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);

/** 'inr' for null/undefined/legacy rows — existing invoices without this field stay INR. */
export const normalizeAmountInWordsCurrency = (currency) =>
  String(currency || '').toLowerCase() === 'aud' ? 'aud' : 'inr';

export const getCurrencySymbol = (currency) =>
  normalizeAmountInWordsCurrency(currency) === 'aud' ? '$' : '₹';

export const formatInvoiceAmount = (amount, currency) =>
  `${getCurrencySymbol(currency)}${formatCurrency(amount || 0)}`;

export const computeIsInterState = (companyState, clientState, taxType) => {
  const normalized = String(taxType || '').toLowerCase();
  if (normalized === 'igst') return true;
  if (normalized === 'cgst_sgst') return false;
  const co = normalizeState(companyState || '');
  const cl = normalizeState(clientState || '');
  return !!(cl && co && co !== cl);
};

export const invoiceToPreviewData = (invoice) => {
  const items = invoice.items || [];
  const selectedClient = invoice.clientId
    ? {
        id: invoice.clientId,
        name: invoice.clientName,
        address: invoice.clientAddress,
        city: invoice.clientCity,
        state: invoice.clientState,
        pincode: invoice.clientPincode,
        gstin: invoice.clientGstin
      }
    : null;

  const selectedCompany = invoice.companyId
    ? {
        id: invoice.companyId,
        name: invoice.companyName || 'R Bhargava & Associates',
        address: invoice.companyAddress,
        gstin: invoice.companyGstin,
        msmeNumber: invoice.companyMsmeNumber,
        email: invoice.companyEmail,
        phone: invoice.companyPhone,
        logo: invoice.companyLogo,
        state: invoice.companyState,
        signatureTitle: invoice.companySignatureTitle
      }
    : null;

  const isInterState = computeIsInterState(
    invoice.companyState,
    invoice.clientState,
    invoice.taxType
  );

  return {
    invoiceNumber: invoice.invoiceNumber,
    formData: {
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      placeOfSupply: invoice.placeOfSupply,
      bankName: invoice.bankName,
      bankBranch: invoice.bankBranch,
      bankAccount: invoice.bankAccount,
      ifsc: invoice.ifsc,
      signatureTitle: invoice.signatureTitle || 'PARTNER',
      items
    },
    selectedClient,
    selectedCompany,
    isInterState,
    amountInWordsCurrency: normalizeAmountInWordsCurrency(invoice.amountInWordsCurrency)
  };
};
