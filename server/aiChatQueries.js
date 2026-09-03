const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function periodToDateRange(year, month) {
  const fromDate = `${year}-${pad2(month)}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const toDate = `${nextYear}-${pad2(nextMonth)}-01`;
  return { fromDate, toDate };
}

const LEGAL_SUFFIXES = [
  'private limited',
  'pvt ltd',
  'pvt limited',
  'limited',
  'ltd',
  'llp',
  'inc',
  'corp',
  'corporation'
];

function normalizeForMatch(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripLegalSuffixes(name) {
  let n = normalizeForMatch(name);
  for (const suffix of LEGAL_SUFFIXES) {
    if (n.endsWith(` ${suffix}`)) {
      n = n.slice(0, -(suffix.length + 1)).trim();
    }
  }
  return n;
}

function scoreName(query, entityName) {
  const q = stripLegalSuffixes(query);
  const n = stripLegalSuffixes(entityName);
  if (!q || !n) return 0;
  if (n === q) return 100;
  if (n.includes(q)) return 80 + Math.min(15, q.length);
  if (q.includes(n)) return 70 + Math.min(10, n.length);
  const qWords = q.split(' ').filter((w) => w.length >= 2);
  const nWords = new Set(n.split(' ').filter((w) => w.length >= 2));
  const overlap = qWords.filter((w) => nWords.has(w)).length;
  if (overlap > 0) return 40 + overlap * 12;
  if (q.length >= 4 && n.split(' ').some((w) => w.startsWith(q.slice(0, 4)))) {
    return 55 + Math.min(10, q.length);
  }
  return 0;
}

function minScoreForQuery(query) {
  const q = normalizeForMatch(query);
  if (q.length >= 4 && q.length <= 8) return 35;
  return 40;
}

function findBestEntityMatch(message, entities, { hints = [] } = {}) {
  if (!entities?.length) return null;

  const candidates = new Set();
  const normalized = normalizeForMatch(message);
  normalized.split(' ').filter((w) => w.length >= 4).forEach((w) => candidates.add(w));
  hints.filter(Boolean).forEach((h) => candidates.add(normalizeForMatch(h)));

  let best = null;
  let bestScore = 0;

  for (const entity of entities) {
    for (const candidate of candidates) {
      if (!candidate) continue;
      const score = scoreName(candidate, entity.name);
      const threshold = minScoreForQuery(candidate);
      if (score >= threshold && score > bestScore) {
        bestScore = score;
        best = entity.name;
      }
    }
    const fullScore = scoreName(normalized, entity.name);
    if (fullScore >= 40 && fullScore > bestScore) {
      bestScore = fullScore;
      best = entity.name;
    }
  }

  return best;
}

function resolveEntityByName(db, workspaceId, nameQuery, table) {
  const allowed = { clients: 'clients', companies: 'companies' };
  const tableName = allowed[table];
  if (!tableName) {
    return { status: 'missing', matches: [] };
  }

  const query = String(nameQuery || '').trim();
  if (!query) {
    return { status: 'missing', matches: [] };
  }

  const rows = db.prepare(`
    SELECT id, name
    FROM ${tableName}
    WHERE workspaceId = ?
    ORDER BY name ASC
  `).all(workspaceId);

  const threshold = minScoreForQuery(query);
  const scored = rows
    .map((row) => ({ ...row, score: scoreName(query, row.name) }))
    .filter((row) => row.score >= threshold)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return { status: 'not_found', matches: [], query };
  }
  if (scored.length === 1 || scored[0].score >= 90) {
    const { score, ...entity } = scored[0];
    return { status: 'matched', entity, matches: [entity] };
  }
  if (scored[0].score - (scored[1]?.score || 0) >= 15) {
    const { score, ...entity } = scored[0];
    return { status: 'matched', entity, matches: [entity] };
  }

  return {
    status: 'ambiguous',
    matches: scored.slice(0, 5).map(({ score, ...row }) => row),
    query
  };
}

function resolveClientByName(db, workspaceId, nameQuery) {
  const query = String(nameQuery || '').trim();
  if (!query) {
    return { status: 'missing', matches: [] };
  }

  const result = resolveEntityByName(db, workspaceId, nameQuery, 'clients');
  if (result.status === 'matched') {
    const client = db.prepare(`
      SELECT id, name, city, state FROM clients WHERE id = ? AND workspaceId = ?
    `).get(result.entity.id, workspaceId);
    return { status: 'matched', client, matches: [client] };
  }
  if (result.status === 'ambiguous') {
    const matches = result.matches.map((m) =>
      db.prepare('SELECT id, name, city, state FROM clients WHERE id = ?').get(m.id)
    );
    return { status: 'ambiguous', matches, query: result.query };
  }
  return result;
}

function resolveCompanyByName(db, workspaceId, nameQuery) {
  const result = resolveEntityByName(db, workspaceId, nameQuery, 'companies');
  if (result.status === 'matched') {
    return { status: 'matched', company: result.entity, matches: [result.entity] };
  }
  return result;
}

function invoiceStatsInRange(db, workspaceId, { clientId, companyId, fromDate, toDate } = {}) {
  let sql = `
    SELECT COUNT(*) AS count, COALESCE(SUM(i.total), 0) AS total
    FROM invoices i
    WHERE i.workspaceId = ?
  `;
  const params = [workspaceId];

  if (clientId) {
    sql += ' AND i.clientId = ?';
    params.push(clientId);
  }
  if (companyId) {
    sql += ' AND i.companyId = ?';
    params.push(companyId);
  }
  if (fromDate) {
    sql += ' AND i.invoiceDate >= ?';
    params.push(fromDate);
  }
  if (toDate) {
    sql += ' AND i.invoiceDate < ?';
    params.push(toDate);
  }

  return db.prepare(sql).get(...params);
}

function countInvoicesByClient(db, workspaceId, { clientId, fromDate, toDate }) {
  const row = invoiceStatsInRange(db, workspaceId, { clientId, fromDate, toDate });
  return { count: row?.count || 0, total: row?.total || 0 };
}

function countInvoicesByCompany(db, workspaceId, { companyId, fromDate, toDate }) {
  const row = invoiceStatsInRange(db, workspaceId, { companyId, fromDate, toDate });
  return { count: row?.count || 0, total: row?.total || 0 };
}

function getInvoiceTotalByClient(db, workspaceId, clientId) {
  const row = invoiceStatsInRange(db, workspaceId, { clientId });
  const client = db.prepare('SELECT name FROM clients WHERE id = ? AND workspaceId = ?').get(
    clientId,
    workspaceId
  );
  return {
    clientName: client?.name || 'Unknown',
    count: row?.count || 0,
    total: row?.total || 0
  };
}

function getInvoiceTotalByCompany(db, workspaceId, companyId) {
  const row = invoiceStatsInRange(db, workspaceId, { companyId });
  const company = db.prepare('SELECT name FROM companies WHERE id = ? AND workspaceId = ?').get(
    companyId,
    workspaceId
  );
  return {
    companyName: company?.name || 'Unknown',
    count: row?.count || 0,
    total: row?.total || 0
  };
}

function sumInvoiceAmountByPeriod(db, workspaceId, { year, month }) {
  const { fromDate, toDate } = periodToDateRange(year, month);
  const row = invoiceStatsInRange(db, workspaceId, { fromDate, toDate });
  return {
    count: row?.count || 0,
    total: row?.total || 0,
    year,
    month,
    fromDate,
    toDate
  };
}

function getInvoiceSummaryByClientPeriod(db, workspaceId, { clientId, year, month }) {
  const { fromDate, toDate } = periodToDateRange(year, month);
  const row = invoiceStatsInRange(db, workspaceId, { clientId, fromDate, toDate });
  const client = db.prepare('SELECT id, name FROM clients WHERE id = ? AND workspaceId = ?').get(
    clientId,
    workspaceId
  );
  return {
    clientName: client?.name || 'Unknown',
    count: row?.count || 0,
    total: row?.total || 0,
    year,
    month,
    fromDate,
    toDate
  };
}

function getOutstandingSummary(db, workspaceId) {
  const row = db.prepare(`
    SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS total
    FROM invoices
    WHERE workspaceId = ? AND COALESCE(status, 'draft') != 'paid'
  `).get(workspaceId);

  const items = db.prepare(`
    SELECT i.id, i.invoiceNumber, i.total, i.invoiceDate, i.status, c.name AS clientName
    FROM invoices i
    LEFT JOIN clients c ON i.clientId = c.id
    WHERE i.workspaceId = ? AND COALESCE(i.status, 'draft') != 'paid'
    ORDER BY i.invoiceDate DESC
    LIMIT 10
  `).all(workspaceId);

  return {
    count: row?.count || 0,
    total: row?.total || 0,
    recent: items
  };
}

function searchClients(db, workspaceId, { name, state, city } = {}) {
  let sql = 'SELECT id, name, city, state, gstin FROM clients WHERE workspaceId = ?';
  const params = [workspaceId];

  if (name) {
    sql += ' AND LOWER(name) LIKE ?';
    params.push(`%${String(name).toLowerCase()}%`);
  }
  if (state) {
    sql += ' AND LOWER(state) LIKE ?';
    params.push(`%${String(state).toLowerCase()}%`);
  }
  if (city) {
    sql += ' AND LOWER(city) LIKE ?';
    params.push(`%${String(city).toLowerCase()}%`);
  }

  sql += ' ORDER BY name ASC LIMIT 20';
  return db.prepare(sql).all(...params);
}

function getWorkspaceStats(db, workspaceId) {
  const clients = db.prepare('SELECT COUNT(*) AS n FROM clients WHERE workspaceId = ?').get(workspaceId);
  const companies = db.prepare('SELECT COUNT(*) AS n FROM companies WHERE workspaceId = ?').get(workspaceId);
  const invoices = db.prepare('SELECT COUNT(*) AS n FROM invoices WHERE workspaceId = ?').get(workspaceId);
  const paid = db.prepare(`
    SELECT COUNT(*) AS n, COALESCE(SUM(total), 0) AS total
    FROM invoices WHERE workspaceId = ? AND status = 'paid'
  `).get(workspaceId);
  const unpaid = db.prepare(`
    SELECT COUNT(*) AS n, COALESCE(SUM(total), 0) AS total
    FROM invoices WHERE workspaceId = ? AND COALESCE(status, 'draft') != 'paid'
  `).get(workspaceId);

  return {
    clientCount: clients?.n || 0,
    companyCount: companies?.n || 0,
    invoiceCount: invoices?.n || 0,
    paidCount: paid?.n || 0,
    paidTotal: paid?.total || 0,
    unpaidCount: unpaid?.n || 0,
    unpaidTotal: unpaid?.total || 0
  };
}

function getRecurringBillsSummary(db, workspaceId) {
  const rows = db.prepare(`
    SELECT status, COUNT(*) AS count
    FROM recurring_bills
    WHERE workspaceId = ?
    GROUP BY status
  `).all(workspaceId);
  const active = db.prepare(`
    SELECT id, name, frequency, nextRunDate, status
    FROM recurring_bills
    WHERE workspaceId = ? AND status = 'active'
    ORDER BY nextRunDate ASC
    LIMIT 10
  `).all(workspaceId);
  return { byStatus: rows, active };
}

function getImportedInvoicesSummary(importedDb, workspaceId) {
  if (!importedDb) {
    return { byStatus: [], total: 0 };
  }
  const rows = importedDb.prepare(`
    SELECT status, COUNT(*) AS count
    FROM imported_invoices
    WHERE workspaceId = ?
    GROUP BY status
  `).all(workspaceId);
  const total = rows.reduce((sum, r) => sum + (r.count || 0), 0);
  return { byStatus: rows, total };
}

function listInvoices(db, workspaceId, { clientId, companyId, fromDate, toDate, limit = 10 } = {}) {
  let sql = `
    SELECT i.id, i.invoiceNumber, i.total, i.invoiceDate, i.status, c.name AS clientName
    FROM invoices i
    LEFT JOIN clients c ON i.clientId = c.id
    WHERE i.workspaceId = ?
  `;
  const params = [workspaceId];

  if (clientId) {
    sql += ' AND i.clientId = ?';
    params.push(clientId);
  }
  if (companyId) {
    sql += ' AND i.companyId = ?';
    params.push(companyId);
  }
  if (fromDate) {
    sql += ' AND i.invoiceDate >= ?';
    params.push(fromDate);
  }
  if (toDate) {
    sql += ' AND i.invoiceDate < ?';
    params.push(toDate);
  }

  sql += ' ORDER BY i.invoiceDate DESC, i.createdAt DESC LIMIT ?';
  params.push(Math.min(20, Math.max(1, limit)));

  return db.prepare(sql).all(...params);
}

function countInvoicesInPeriod(db, workspaceId, { year, month }) {
  const { fromDate, toDate } = periodToDateRange(year, month);
  const row = invoiceStatsInRange(db, workspaceId, { fromDate, toDate });
  return {
    count: row?.count || 0,
    total: row?.total || 0,
    year,
    month
  };
}

function formatInr(amount) {
  const n = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(n);
}

function monthLabel(year, month) {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12 || y < 2000 || y > 2100) {
    return 'the selected period';
  }
  const d = new Date(y, m - 1, 1);
  if (Number.isNaN(d.getTime())) {
    return 'the selected period';
  }
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function isValidPeriod(year, month) {
  const y = Number(year);
  const m = Number(month);
  return Number.isFinite(y) && Number.isFinite(m) && m >= 1 && m <= 12 && y >= 2000 && y <= 2100;
}

module.exports = {
  MONTH_NAMES,
  normalizeForMatch,
  stripLegalSuffixes,
  findBestEntityMatch,
  periodToDateRange,
  listInvoices,
  resolveClientByName,
  resolveCompanyByName,
  countInvoicesByClient,
  countInvoicesByCompany,
  getInvoiceTotalByClient,
  getInvoiceTotalByCompany,
  sumInvoiceAmountByPeriod,
  getInvoiceSummaryByClientPeriod,
  getOutstandingSummary,
  searchClients,
  getWorkspaceStats,
  getRecurringBillsSummary,
  getImportedInvoicesSummary,
  countInvoicesInPeriod,
  formatInr,
  monthLabel,
  isValidPeriod
};
