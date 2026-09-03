const { MONTH_NAMES, normalizeForMatch, findBestEntityMatch } = require('./aiChatQueries');

const MONTH_MAP = Object.fromEntries(MONTH_NAMES.map((m, i) => [m, i + 1]));
MONTH_MAP.jan = 1;
MONTH_MAP.feb = 2;
MONTH_MAP.mar = 3;
MONTH_MAP.apr = 4;
MONTH_MAP.jun = 6;
MONTH_MAP.jul = 7;
MONTH_MAP.aug = 8;
MONTH_MAP.sep = 9;
MONTH_MAP.sept = 9;
MONTH_MAP.oct = 10;
MONTH_MAP.nov = 11;
MONTH_MAP.dec = 12;

function normalizeMessage(text) {
  return normalizeForMatch(text);
}

function parseMonth(text) {
  const s = String(text || '').toLowerCase();

  const iso = s.match(/\b(20\d{2})-(\d{1,2})\b/);
  if (iso) {
    const year = parseInt(iso[1], 10);
    const month = parseInt(iso[2], 10);
    if (month >= 1 && month <= 12) return { year, month };
  }

  const yearMonth = s.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(20\d{2})\b/i);
  if (yearMonth) {
    const monthKey = yearMonth[1].toLowerCase();
    const month = MONTH_MAP[monthKey];
    if (month) {
      return { year: parseInt(yearMonth[2], 10), month };
    }
  }

  for (const [name, num] of Object.entries(MONTH_MAP)) {
    if (name.length < 3) continue;
    const re = new RegExp(`\\b${name}\\b`, 'i');
    if (re.test(s)) {
      const yearMatch = s.match(/\b(20\d{2})\b/);
      const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
      return { year, month: num };
    }
  }

  const thisMonth = s.match(/\bthis\s+month\b/i);
  if (thisMonth) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }

  const lastMonth = s.match(/\blast\s+month\b/i);
  if (lastMonth) {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }

  return null;
}

function stripNoise(text) {
  return String(text || '')
    .replace(/\?/g, ' ')
    .replace(/\b(please|tell me|show me|can you|i want to know)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanHint(hint) {
  return String(hint || '')
    .replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december|20\d{2}|this month|last month)\b/gi, '')
    .replace(/\b(company|companies|client|customers?|invoices?|invoice|bills?|amount|total|issued|all)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTrailingForHint(text) {
  const patterns = [
    /(?:total\s+amount|amount|total|revenue)\s+(?:for|of)\s+(.+)$/i,
    /(?:invoices?\s+from)\s+(.+)$/i,
    /(?:from)\s+(.+?)(?:\?|$)/i,
    /(?:for|to|of)\s+(.+)$/i
  ];
  for (const re of patterns) {
    const m = String(text || '').match(re);
    if (m && m[1]) {
      const hint = cleanHint(m[1]);
      if (hint.length >= 2) return hint;
    }
  }
  return null;
}

function extractCompanyHint(text, companies) {
  const patterns = [
    /company\s+name\s+(.+?)(?:\s+do\s+we|\s+have|\?|$)/i,
    /company\s+(?:called|named)\s+(.+?)(?:\s+do\s+we|\s+have|\?|$)/i,
    /(?:for|from|in)\s+company\s+(.+?)(?:\s+do\s+we|\s+have|\?|$)/i,
    /company\s+(.+?)\s+(?:invoices?|bills?)/i,
    /invoices?\s+for\s+company\s+(.+?)(?:\?|$)/i
  ];
  for (const re of patterns) {
    const m = String(text || '').match(re);
    if (m && m[1]) {
      const hint = cleanHint(m[1]);
      if (hint.length >= 2) return hint;
    }
  }
  const trailing = extractTrailingForHint(text);
  const best = findBestEntityMatch(text, companies, { hints: trailing ? [trailing] : [] });
  if (best) return best;
  if (/\bcompany\b/i.test(text) && trailing) return trailing;
  return null;
}

function extractClientHint(text, clients) {
  const patterns = [
    /(?:show\s+(?:me\s+)?all\s+invoices?\s+from)\s+(.+?)(?:\?|$)/i,
    /(?:invoices?\s+from)\s+(.+?)(?:\?|$)/i,
    /(?:invoices?\s+(?:issued\s+)?(?:to|for))\s+(.+?)(?:\s+in\s+|\s+during\s+|\?|$)/i,
    /(?:to|for)\s+client\s+(.+?)(?:\s+in\s+|\?|$)/i,
    /(?:client)\s+(.+?)(?:\s+in\s+|\?|$)/i,
    /(?:issued\s+to)\s+(.+?)(?:\s+in\s+|\?|$)/i,
    /(?:total\s+amount|amount|total)\s+(?:for|of)\s+(.+)$/i,
    /(?:invoices?\s+for)\s+(.+?)(?:\?|$)/i,
    /(?:for)\s+(.+?)(?:\?|$)/i
  ];

  const hints = [];
  for (const re of patterns) {
    const m = String(text || '').match(re);
    if (m && m[1]) {
      const hint = cleanHint(m[1]);
      if (hint.length >= 2) hints.push(hint);
    }
  }

  const trailing = extractTrailingForHint(text);
  if (trailing) hints.push(trailing);

  const best = findBestEntityMatch(text, clients, { hints });
  if (best) return best;
  return hints[0] || null;
}

function extractLocationHint(text) {
  const stateMatch = text.match(/\b(?:in|from)\s+([A-Za-z][A-Za-z\s]{1,40}?)(?:\s*\?|$)/i);
  if (stateMatch) {
    const loc = stateMatch[1]
      .replace(/\b(clients?|customers?|invoices?|how many|any|company|companies)\b/gi, '')
      .trim();
    if (loc.length >= 2) return loc;
  }
  return null;
}

function wantsListView(lower) {
  return (
    /\b(show|list|view|see|open)\b/i.test(lower) ||
    /\ball\s+invoices?\b/i.test(lower) ||
    /\binvoices?\s+from\b/i.test(lower)
  );
}

function parseIntent(message, clients = [], companies = []) {
  const raw = String(message || '').trim();
  if (!raw) {
    return { intent: 'unknown', confidence: 0, params: {} };
  }

  const text = stripNoise(raw);
  const lower = text.toLowerCase();
  const period = parseMonth(raw);
  const mentionsCompany = /\bcompan(y|ies)\b/i.test(lower);
  const companyHint = mentionsCompany ? extractCompanyHint(raw, companies) : null;
  const clientHint = mentionsCompany ? null : extractClientHint(raw, clients);
  const locationHint = extractLocationHint(raw);

  const hasHowMany = /\bhow many\b/i.test(lower);
  const hasHowMuch = /\bhow much\b|\btotal\s+amount\b|\bamount\b|\brevenue\b/i.test(lower);
  const hasInvoice = /\binvoices?\b/i.test(lower);
  const hasUnpaid = /\bunpaid\b|\boutstanding\b|\bnot paid\b|\bpending\b/i.test(lower);
  const hasClient = /\bclients?\b|\bcustomers?\b/i.test(lower);
  const hasRecurring = /\brecurring\b/i.test(lower);
  const hasImported = /\bimported\b/i.test(lower);
  const listView = wantsListView(lower);

  if (hasUnpaid && hasInvoice) {
    return { intent: 'outstanding_summary', confidence: 0.9, params: {} };
  }

  if (hasRecurring) {
    return { intent: 'recurring_bills_summary', confidence: 0.85, params: {} };
  }

  if (hasImported) {
    return { intent: 'imported_invoices_summary', confidence: 0.85, params: {} };
  }

  if (companyHint && listView && hasInvoice) {
    return {
      intent: 'list_invoices_by_company',
      confidence: 0.94,
      params: { companyHint, period }
    };
  }

  if (clientHint && listView && hasInvoice) {
    return {
      intent: 'list_invoices_by_client',
      confidence: 0.94,
      params: { clientHint, period }
    };
  }

  if (companyHint && (hasHowMany || hasInvoice)) {
    if (hasHowMuch && !period) {
      return {
        intent: 'invoice_total_by_company',
        confidence: 0.93,
        params: { companyHint }
      };
    }
    return {
      intent: 'invoice_count_by_company',
      confidence: 0.92,
      params: { companyHint, period }
    };
  }

  if (clientHint && hasHowMuch && !period) {
    return {
      intent: 'invoice_total_by_client',
      confidence: 0.92,
      params: { clientHint }
    };
  }

  if (hasClient && locationHint && !hasInvoice) {
    return {
      intent: 'client_search',
      confidence: 0.85,
      params: { state: locationHint, city: locationHint, name: locationHint }
    };
  }

  if ((hasHowMany || hasHowMuch) && hasClient && !hasInvoice) {
    return { intent: 'workspace_stats', confidence: 0.9, params: { focus: 'clients' } };
  }

  if (mentionsCompany && (hasHowMany || /\bcount\b/i.test(lower)) && !companyHint) {
    return { intent: 'workspace_stats', confidence: 0.85, params: { focus: 'companies' } };
  }

  if (/\b(workspace|summary|overview|stats)\b/i.test(lower) && !hasInvoice) {
    return { intent: 'workspace_stats', confidence: 0.8, params: {} };
  }

  if (clientHint && period && (hasHowMany || hasHowMuch || hasInvoice)) {
    return {
      intent: 'invoice_summary_by_client_period',
      confidence: 0.92,
      params: { clientHint, year: period.year, month: period.month }
    };
  }

  if (clientHint && (hasHowMany || hasInvoice)) {
    return {
      intent: 'invoice_count_by_client',
      confidence: 0.9,
      params: { clientHint, period }
    };
  }

  if (period && (hasHowMuch || hasHowMany || hasInvoice)) {
    if (hasHowMany && !hasHowMuch) {
      return {
        intent: 'invoice_count_by_period',
        confidence: 0.88,
        params: { year: period.year, month: period.month }
      };
    }
    return {
      intent: 'invoice_amount_by_period',
      confidence: 0.9,
      params: { year: period.year, month: period.month }
    };
  }

  if (/\bwhat is cgst\b|\bwhat is sgst\b|\bwhat is igst\b|\bexplain\b|\bhow do i\b|\bhow to\b|\bhelp\b/i.test(lower)) {
    return { intent: 'general', confidence: 0.75, params: {} };
  }

  return { intent: 'unknown', confidence: 0, params: { raw } };
}

function isComplexQuestion(message) {
  const lower = String(message || '').toLowerCase();
  const parts = (lower.match(/\band\b|\balso\b|\bplus\b|,/g) || []).length;
  return parts >= 2 || lower.length > 140;
}

module.exports = {
  parseMonth,
  parseIntent,
  extractClientHint,
  extractCompanyHint,
  isComplexQuestion,
  MONTH_MAP
};
