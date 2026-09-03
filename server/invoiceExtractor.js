const { parseLlmJson, callOpenAIVision, getOpenAIVisionConfig } = require('./openai');

const EXTRACTION_SYSTEM = `You extract structured data from Indian GST tax invoices and bills.
Return ONLY valid JSON matching the requested schema.
Use null for any field you cannot read clearly — never invent or guess values.
For partyType: use "vendor" for purchase bills/expenses received, "client" for sales invoices issued.`;

const EXTRACTION_PROMPT = `Extract all visible invoice fields from this document image.

Return JSON with this exact structure:
{
  "partyType": "vendor" | "client" | null,
  "partyName": string | null,
  "partyGstin": string | null,
  "partyAddress": string | null,
  "issuerName": string | null,
  "issuerGstin": string | null,
  "invoiceNumber": string | null,
  "invoiceDate": "YYYY-MM-DD" | null,
  "dueDate": "YYYY-MM-DD" | null,
  "placeOfSupply": string | null,
  "subtotal": number | null,
  "cgst": number | null,
  "sgst": number | null,
  "igst": number | null,
  "taxType": "cgst_sgst" | "igst" | null,
  "total": number | null,
  "items": [
    {
      "description": string | null,
      "hsnSac": string | null,
      "quantity": number | null,
      "rate": number | null,
      "cgstPercent": number | null,
      "sgstPercent": number | null,
      "amount": number | null
    }
  ]
}`;

function normalizeDate(value) {
  if (!value) return null;
  const str = String(value).trim();
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return str;
  const dmy = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmy) {
    let [, d, m, y] = dmy;
    if (y.length === 2) y = `20${y}`;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const parsed = Date.parse(str);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString().split('T')[0];
  }
  return null;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function normalizePartyType(value) {
  const v = String(value || '').toLowerCase().trim();
  if (v === 'vendor' || v === 'client') return v;
  return 'vendor';
}

function normalizeItem(item) {
  const quantity = toNumber(item?.quantity);
  const rate = toNumber(item?.rate);
  let amount = toNumber(item?.amount);
  if (amount === null && quantity !== null && rate !== null) {
    amount = quantity * rate;
  }
  return {
    description: item?.description ? String(item.description).trim() : null,
    hsnSac: item?.hsnSac ? String(item.hsnSac).trim() : null,
    quantity,
    rate,
    cgstPercent: toNumber(item?.cgstPercent),
    sgstPercent: toNumber(item?.sgstPercent),
    amount
  };
}

function normalizeExtraction(raw) {
  const items = Array.isArray(raw?.items) ? raw.items.map(normalizeItem) : [];
  return {
    partyType: normalizePartyType(raw?.partyType),
    partyName: raw?.partyName ? String(raw.partyName).trim() : null,
    partyGstin: raw?.partyGstin ? String(raw.partyGstin).trim() : null,
    partyAddress: raw?.partyAddress ? String(raw.partyAddress).trim() : null,
    issuerName: raw?.issuerName ? String(raw.issuerName).trim() : null,
    issuerGstin: raw?.issuerGstin ? String(raw.issuerGstin).trim() : null,
    invoiceNumber: raw?.invoiceNumber ? String(raw.invoiceNumber).trim() : null,
    invoiceDate: normalizeDate(raw?.invoiceDate),
    dueDate: normalizeDate(raw?.dueDate),
    placeOfSupply: raw?.placeOfSupply ? String(raw.placeOfSupply).trim() : null,
    subtotal: toNumber(raw?.subtotal),
    cgst: toNumber(raw?.cgst),
    sgst: toNumber(raw?.sgst),
    igst: toNumber(raw?.igst),
    taxType: raw?.taxType === 'igst' ? 'igst' : raw?.taxType === 'cgst_sgst' ? 'cgst_sgst' : null,
    total: toNumber(raw?.total),
    items
  };
}

function isEmpty(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

function detectMissingFields(data) {
  const missing = [];
  if (isEmpty(data.invoiceNumber)) missing.push('invoiceNumber');
  if (isEmpty(data.invoiceDate)) missing.push('invoiceDate');
  if (isEmpty(data.partyName)) missing.push('partyName');
  if (data.total === null) missing.push('total');
  if (!data.items || data.items.length === 0) {
    missing.push('items');
  } else {
    data.items.forEach((item, idx) => {
      if (isEmpty(item.description)) missing.push(`items[${idx}].description`);
      if (item.quantity === null) missing.push(`items[${idx}].quantity`);
      if (item.rate === null) missing.push(`items[${idx}].rate`);
    });
  }
  return missing;
}

function resolveStatus(missingFields, extractionFailed) {
  if (extractionFailed) return 'failed';
  if (missingFields.length > 0) return 'needs_review';
  return 'complete';
}

async function extractInvoiceFromImage({ imageBase64, mimeType }) {
  const { apiKey, model, baseUrl, timeoutMs } = getOpenAIVisionConfig();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured. Set it in .env to enable invoice extraction.');
  }

  const content = await callOpenAIVision({
    apiKey,
    baseUrl,
    model,
    imageBase64,
    mimeType,
    prompt: EXTRACTION_PROMPT,
    systemContent: EXTRACTION_SYSTEM,
    timeoutMs
  });

  const raw = parseLlmJson(content);
  const normalized = normalizeExtraction(raw);
  const missingFields = detectMissingFields(normalized);
  const status = resolveStatus(missingFields, false);

  return {
    ...normalized,
    missingFields,
    status,
    extractionRawJson: JSON.stringify(raw)
  };
}

module.exports = {
  extractInvoiceFromImage,
  normalizeExtraction,
  detectMissingFields,
  resolveStatus,
  normalizeDate,
  toNumber
};
