const fs = require('fs');
const ExcelJS = require('exceljs');
const { parseLlmJson, callOpenAIChatCompletions, getOpenAIConfig } = require('./openai');

function normalizeTaxCode(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  return s.replace(/\D/g, '');
}

function normalizeTaxDescription(raw) {
  return String(raw ?? '').replace(/\s+/g, ' ').trim();
}

function codeLevelAndParent(codeType, code) {
  const len = String(code || '').length;
  const levels = codeType === 'SAC' ? [2, 4, 6] : [2, 4, 6, 8];
  if (!levels.includes(len)) return { level: null, parentCode: null };
  const idx = levels.indexOf(len);
  if (idx <= 0) return { level: len, parentCode: null };
  const parentLen = levels[idx - 1];
  return { level: len, parentCode: String(code).slice(0, parentLen) };
}

function cellToText(cellValue) {
  if (cellValue == null) return '';
  if (typeof cellValue === 'string' || typeof cellValue === 'number' || typeof cellValue === 'boolean') {
    return String(cellValue);
  }
  if (cellValue && typeof cellValue === 'object') {
    if (cellValue.text) return String(cellValue.text);
    if (cellValue.richText && Array.isArray(cellValue.richText)) {
      return cellValue.richText.map((t) => t.text || '').join('');
    }
    if (cellValue.result != null) return String(cellValue.result);
  }
  return String(cellValue);
}

async function importTaxCodesFromXlsx({ db, xlsxPath }) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(xlsxPath);

  const sheets = [
    { sheetName: 'HSN_MSTR', codeType: 'HSN', codeCol: 1, descCol: 2 },
    { sheetName: 'SAC_MSTR', codeType: 'SAC', codeCol: 1, descCol: 2 }
  ];

  const upsert = db.prepare(`
    INSERT INTO tax_codes (codeType, code, description, level, parentCode, updatedAt)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(codeType, code) DO UPDATE SET
      description = excluded.description,
      level = excluded.level,
      parentCode = excluded.parentCode,
      updatedAt = CURRENT_TIMESTAMP
  `);

  const tx = db.transaction((rows) => {
    for (const r of rows) {
      upsert.run(r.codeType, r.code, r.description, r.level, r.parentCode);
    }
    return rows.length;
  });

  const allRows = [];
  for (const sh of sheets) {
    const ws = workbook.getWorksheet(sh.sheetName);
    if (!ws) continue;
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // header
      const rawCode = cellToText(row.getCell(sh.codeCol).value);
      const rawDesc = cellToText(row.getCell(sh.descCol).value);
      const code = normalizeTaxCode(rawCode);
      const description = normalizeTaxDescription(rawDesc);
      if (!code || !description) return;
      const { level, parentCode } = codeLevelAndParent(sh.codeType, code);
      allRows.push({ codeType: sh.codeType, code, description, level, parentCode });
    });
  }

  const upserted = tx(allRows);
  return { rows: allRows.length, upserted };
}

function buildTextForTaxSuggestion({ description, detailedDescription }) {
  const d1 = String(description || '').trim();
  const d2 = String(detailedDescription || '').trim();
  return [d1, d2].filter(Boolean).join('\n');
}

const STOP_WORDS = new Set([
  'the','and','for','with','from','that','this','are','was','have','has','had',
  'will','shall','may','can','been','its','our','per','all','any','not','but',
  'their','also','such','each','both','under','into','upon','about','than',
  'act','acts','rule','rules','section','sub','related',
  'professional','charge','charges','fees','fee','income','other','others',
  'general','special','including','included','etc','regarding','thereof',
  'purpose','purposes','nature','type','kind',
  'any','every','certain','respective','applicable','various',
  // Too generic in HSN descriptions ("in the form of", "solid forms", "PSITTACIFORMES")
  'form','forms'
]);

const SHORT_TOKENS = new Set(['it', 'gst', 'amc', 'erp', 'sap', 'tax', 'vat', 'hr']);

const TERM_EXPANSIONS = {
  it: ['information', 'technology', 'computer', 'software', 'data', 'digital'],
  support: ['maintenance', 'technical', 'helpdesk', 'repair'],
  audit: ['auditing', 'assurance'],
  account: ['accounting', 'bookkeeping'],
  legal: ['law', 'advocate'],
  consult: ['consultancy', 'consulting', 'advisory'],
  software: ['development', 'programming', 'application'],
  cloud: ['hosting', 'saas', 'infrastructure'],
  certification: ['certified', 'certifying', 'certificate', 'documentation', 'legal']
};

const SERVICE_HINT_WORDS = /\b(service|services|consult|consulting|audit|auditing|support|maintenance|advisory|professional|fees|charge|charges|amc|hosting|development|design|training|legal|accounting|bookkeeping|certification|certifying|certified)\b/i;

/** GST / income-tax form references in line-item text (15CA, 10CB, etc.) */
function extractGstFormCodes(text) {
  const raw = String(text || '').toUpperCase();
  const found = new Set();
  const patterns = [
    /\b15\s*CA\b/g,
    /\b15\s*CB\b/g,
    /\b10\s*CB\b/g,
    /\b10\s*B\b/g,
    /\b3\s*CD\b/g,
    /\b9\s*A\b/g
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m) m.forEach((x) => found.add(x.replace(/\s+/g, '').toLowerCase()));
  }
  return [...found];
}

function getPinnedSacCandidates(db, text) {
  const t = String(text || '');
  const codes = new Set();
  if (/\bcertif/i.test(t) || /\b15\s*ca\b/i.test(t) || /\b15ca\b/i.test(t) || /\b10\s*cb\b/i.test(t) || /\b10cb\b/i.test(t)) {
    codes.add('998214');
  }
  if (/\baudit/i.test(t)) {
    codes.add('998221');
    codes.add('998222');
  }
  if (/\baccount/i.test(t) || /\bbookkeep/i.test(t)) {
    codes.add('998222');
  }
  const stmt = db.prepare(`
    SELECT codeType, code, description, level, parentCode
    FROM tax_codes WHERE codeType = 'SAC' AND code = ?
  `);
  const rows = [];
  for (const code of codes) {
    const row = stmt.get(code);
    if (row) rows.push({ ...row, _score: 50, _pinned: true });
  }
  return rows;
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tokenizeForSearch(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/g)
    .map((t) => t.trim())
    .filter((t) => {
      if (!t) return false;
      if (STOP_WORDS.has(t)) return false;
      if (SHORT_TOKENS.has(t)) return true;
      return t.length >= 4;
    })
    .slice(0, 12);
}

function buildSearchTerms(text) {
  const tokens = tokenizeForSearch(text);
  const terms = new Set(tokens);
  extractGstFormCodes(text).forEach((c) => terms.add(c));
  for (const tok of tokens) {
    const extra = TERM_EXPANSIONS[tok];
    if (extra) extra.forEach((e) => terms.add(e));
  }
  return [...terms].filter((t) => t.length >= 4 || SHORT_TOKENS.has(t)).slice(0, 18);
}

function isLikelyServiceDescription(text) {
  return SERVICE_HINT_WORDS.test(String(text || ''));
}

function countWordMatches(terms, haystack) {
  const hay = String(haystack || '').toLowerCase();
  let score = 0;
  for (const term of terms) {
    const re = new RegExp(`\\b${escapeRegex(term)}\\b`, 'i');
    if (re.test(hay)) score += 1;
  }
  return score;
}

function scoreCandidate({ searchTerms, candidate, preferSac }) {
  const hay = `${candidate.codeType} ${candidate.code} ${candidate.description}`;
  let score = countWordMatches(searchTerms, hay);

  if (preferSac && candidate.codeType === 'SAC') score += 2;
  if (!preferSac && candidate.codeType === 'HSN') score += 1;

  const codeLen = String(candidate.code || '').length;
  if (candidate.codeType === 'SAC' && codeLen === 6) score += 2;
  if (candidate.codeType === 'HSN' && codeLen === 8) score += 1;

  if (preferSac && candidate.codeType === 'HSN') score -= 2;

  return score;
}

function retrieveTaxCodeCandidates(db, text) {
  const searchTerms = buildSearchTerms(text);
  const preferSac = isLikelyServiceDescription(text) || extractGstFormCodes(text).length > 0 || /\bcertif/i.test(text);
  const pinned = getPinnedSacCandidates(db, text);

  if (searchTerms.length === 0 && pinned.length === 0) {
    return { searchTerms, preferSac, candidates: [] };
  }

  const likeTerms = searchTerms.filter((t) => t.length >= 5 || SHORT_TOKENS.has(t)).slice(0, 8);
  const whereOr = likeTerms.map(() => 'description LIKE ?').join(' OR ');
  const params = likeTerms.map((t) => `%${t.replace(/%/g, '')}%`);

  const typeFilter = preferSac ? "codeType = 'SAC' AND" : '';
  const retrievalSql = `
    SELECT codeType, code, description, level, parentCode
    FROM tax_codes
    WHERE ${typeFilter} (${whereOr})
    LIMIT 150
  `;

  let rawCandidates = likeTerms.length ? db.prepare(retrievalSql).all(...params) : [];

  if (preferSac && likeTerms.length && rawCandidates.length < 10) {
    const fallbackSql = `
      SELECT codeType, code, description, level, parentCode
      FROM tax_codes
      WHERE (${whereOr})
      LIMIT 150
    `;
    const more = db.prepare(fallbackSql).all(...params);
    const seen = new Set(rawCandidates.map((c) => `${c.codeType}:${c.code}`));
    for (const row of more) {
      const key = `${row.codeType}:${row.code}`;
      if (!seen.has(key)) {
        seen.add(key);
        rawCandidates.push(row);
      }
    }
  }

  const scoredMap = new Map();
  for (const p of pinned) {
    scoredMap.set(`${p.codeType}:${p.code}`, p);
  }
  for (const c of rawCandidates) {
    const key = `${c.codeType}:${c.code}`;
    const score = scoreCandidate({ searchTerms, candidate: c, preferSac });
    const existing = scoredMap.get(key);
    if (!existing || score > existing._score) {
      scoredMap.set(key, { ...c, _score: Math.max(score, existing?._score || 0) });
    }
  }

  const scored = [...scoredMap.values()]
    .filter((c) => c._pinned || c._score >= 2)
    .sort((a, b) => b._score - a._score || String(a.code).localeCompare(String(b.code)))
    .slice(0, 30);

  return { searchTerms, preferSac, candidates: scored };
}

function registerTaxCodeRoutes({ app, db }) {
  app.get('/api/tax-codes/status', (req, res) => {
    try {
      const count = db.prepare('SELECT COUNT(*) as c FROM tax_codes').get().c;
      const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
      res.json({
        taxCodeCount: count,
        openaiConfigured: apiKey.length > 0,
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/tax-codes/search', (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      const codeType = String(req.query.type || '').trim().toUpperCase();
      const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));

      if (!q) return res.json([]);
      if (codeType && codeType !== 'HSN' && codeType !== 'SAC') {
        return res.status(400).json({ error: 'Invalid type. Use HSN or SAC.' });
      }

      const query = `%${q.replace(/%/g, '')}%`;
      const rows = db.prepare(`
        SELECT codeType, code, description, level, parentCode
        FROM tax_codes
        WHERE (? = '' OR codeType = ?)
          AND (code LIKE ? OR description LIKE ?)
        ORDER BY
          CASE WHEN code LIKE ? THEN 0 ELSE 1 END,
          length(code) ASC,
          code ASC
        LIMIT ?
      `).all(codeType, codeType, query, query, query, limit);

      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/tax-codes/import', async (req, res) => {
    try {
      const defaultPath = process.env.HSN_SAC_XLSX_PATH || '/home/admin1/Downloads/HSN_SAC.xlsx';
      const xlsxPath = String(req.body?.path || defaultPath);

      if (!fs.existsSync(xlsxPath)) {
        return res.status(404).json({ error: `File not found: ${xlsxPath}` });
      }

      const startedAt = Date.now();
      const result = await importTaxCodesFromXlsx({ db, xlsxPath });
      const ms = Date.now() - startedAt;

      res.json({ ...result, ms, path: xlsxPath });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/tax-codes/suggest', async (req, res) => {
    try {
      const description = String(req.body?.description || '').trim();
      const detailedDescription = String(req.body?.detailedDescription || '').trim();
      if (!description && !detailedDescription) {
        return res.status(400).json({ error: 'description or detailedDescription is required' });
      }

      const text = buildTextForTaxSuggestion({ description, detailedDescription });
      const { searchTerms, preferSac, candidates: scored } = retrieveTaxCodeCandidates(db, text);

      const toSuggestion = (c, idx) => ({
        code: c.code,
        codeType: c.codeType,
        description: c.description,
        confidence: Math.max(0.35, Math.min(0.92, c._score / Math.max(4, searchTerms.length + 4) + (idx === 0 ? 0.1 : 0))),
        rationale: c._pinned
          ? 'Matched certification / tax-form keywords'
          : 'Keyword match (restart server after editing .env for AI ranking)'
      });

      const retrievalOnly = scored.slice(0, 8).map(toSuggestion);

      const { apiKey, model, baseUrl, timeoutMs } = getOpenAIConfig();

      if (!apiKey) {
        return res.json({
          suggestions: retrievalOnly,
          used: 'retrieval-only',
          candidates: scored.length,
          hint: 'OPENAI_API_KEY not loaded. Add it to .env in the project root and restart npm run dev.'
        });
      }

      if (scored.length === 0) {
        return res.json({
          suggestions: [],
          used: 'retrieval-only',
          candidates: 0,
          hint: 'No matching codes found. Import tax codes via POST /api/tax-codes/import.'
        });
      }

      const candidatesForPrompt = scored.slice(0, 20).map((c) => ({
        codeType: c.codeType,
        code: c.code,
        description: c.description
      }));

      const prompt = [
        'You classify Indian GST invoice line items to the correct HSN or SAC code.',
        'Pick only from the candidate list. Prefer 6-digit SAC for professional/certification services.',
        'For certification of tax forms (15CA, 10CB, etc.), SAC 998214 is often correct.',
        'Return JSON only:',
        '{"suggestions":[{"codeType":"HSN|SAC","code":"string","confidence":0.0,"rationale":"string"}]}',
        '',
        'Line item:',
        text,
        '',
        'Candidates:',
        JSON.stringify(candidatesForPrompt)
      ].join('\n');

      let content;
      try {
        content = await callOpenAIChatCompletions({
          apiKey,
          baseUrl,
          model,
          prompt,
          timeoutMs,
          systemContent: 'You are a careful GST classifier. Return only valid JSON.'
        });
      } catch (e) {
        return res.json({
          suggestions: retrievalOnly,
          used: 'retrieval-only',
          error: String(e.message || e),
          candidates: scored.length,
          hint: 'OpenAI call failed — showing keyword matches. Check API key and billing.'
        });
      }

      let parsed;
      try {
        parsed = parseLlmJson(content);
      } catch (e) {
        return res.json({
          suggestions: retrievalOnly,
          used: 'retrieval-only',
          error: 'LLM returned non-JSON',
          candidates: scored.length,
          hint: 'OpenAI response could not be parsed — showing keyword matches.'
        });
      }

      const suggestions = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
      const normalized = suggestions
        .map((s) => ({
          codeType: String(s.codeType || '').toUpperCase(),
          code: normalizeTaxCode(s.code),
          confidence: Number(s.confidence),
          rationale: String(s.rationale || '').slice(0, 240)
        }))
        .filter((s) => (s.codeType === 'HSN' || s.codeType === 'SAC') && s.code && Number.isFinite(s.confidence))
        .slice(0, 5);

      const enrichStmt = db.prepare('SELECT description FROM tax_codes WHERE codeType = ? AND code = ?');
      const enriched = normalized.map((s) => {
        const d = enrichStmt.get(s.codeType, s.code)?.description;
        return { ...s, description: d || '' };
      });

      if (!enriched.length) {
        return res.json({ suggestions: retrievalOnly, used: 'retrieval-only', error: 'LLM returned no valid suggestions', candidates: scored.length });
      }

      res.json({ suggestions: enriched, used: 'llm', candidates: scored.length });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

function maybeAutoImportTaxCodes({ db }) {
  if (String(process.env.AUTO_IMPORT_TAX_CODES || '').trim() !== '1') return;
  const p = process.env.HSN_SAC_XLSX_PATH || '/home/admin1/Downloads/HSN_SAC.xlsx';
  if (!fs.existsSync(p)) {
    console.warn('⚠️ Tax code import skipped (file missing):', p);
    return;
  }
  importTaxCodesFromXlsx({ db, xlsxPath: p })
    .then((r) => console.log('✅ Imported tax codes:', r))
    .catch((e) => console.error('❌ Tax code import failed:', e));
}

module.exports = {
  importTaxCodesFromXlsx,
  registerTaxCodeRoutes,
  maybeAutoImportTaxCodes,
  tokenizeForSearch,
  buildSearchTerms,
  retrieveTaxCodeCandidates
};

