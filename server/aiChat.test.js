const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const { parseMonth, parseIntent } = require('./aiChatIntents');
const {
  resolveClientByName,
  sumInvoiceAmountByPeriod,
  countInvoicesByClient,
  periodToDateRange
} = require('./aiChatQueries');
const {
  formatTemplateReply,
  initAiChatTables,
  getUsageCount,
  incrementUsage,
  checkRateLimit,
  handleChatMessage,
  buildInvoiceLinks
} = require('./aiChat');

function createTestDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      workspaceId TEXT,
      city TEXT,
      state TEXT
    );
    CREATE TABLE companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      workspaceId TEXT
    );
    CREATE TABLE invoices (
      id TEXT PRIMARY KEY,
      invoiceNumber TEXT NOT NULL,
      clientId TEXT NOT NULL,
      companyId TEXT,
      workspaceId TEXT,
      invoiceDate TEXT NOT NULL,
      total REAL,
      status TEXT DEFAULT 'draft',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE recurring_bills (
      id TEXT PRIMARY KEY,
      workspaceId TEXT NOT NULL,
      name TEXT NOT NULL,
      frequency TEXT,
      nextRunDate TEXT,
      status TEXT
    );
  `);
  return db;
}

function seedWorkspace(db, workspaceId = 'ws-1') {
  db.prepare('INSERT INTO clients (id, name, workspaceId, city, state) VALUES (?, ?, ?, ?, ?)').run(
    'c1', 'Hans I Tech Pvt Ltd', workspaceId, 'Mumbai', 'Maharashtra'
  );
  db.prepare('INSERT INTO clients (id, name, workspaceId, city, state) VALUES (?, ?, ?, ?, ?)').run(
    'c2', 'Hans International', workspaceId, 'Delhi', 'Delhi'
  );
  db.prepare('INSERT INTO companies (id, name, workspaceId) VALUES (?, ?, ?)').run(
    'co1', 'RB Associates', workspaceId
  );
  db.prepare(`
    INSERT INTO invoices (id, invoiceNumber, clientId, workspaceId, invoiceDate, total, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('i1', 'INV-1', 'c1', workspaceId, '2025-06-05', 50000, 'paid');
  db.prepare(`
    INSERT INTO invoices (id, invoiceNumber, clientId, workspaceId, invoiceDate, total, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('i2', 'INV-2', 'c1', workspaceId, '2025-06-20', 75000, 'draft');
  db.prepare(`
    INSERT INTO invoices (id, invoiceNumber, clientId, workspaceId, invoiceDate, total, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('i3', 'INV-3', 'c2', workspaceId, '2025-07-01', 10000, 'paid');
}

test('parseMonth extracts June 2025', () => {
  const p = parseMonth('Total invoice amount in June 2025');
  assert.equal(p.year, 2025);
  assert.equal(p.month, 6);
});

test('parseIntent detects invoice amount by period', () => {
  const r = parseIntent('How much invoice amount in June?');
  assert.equal(r.intent, 'invoice_amount_by_period');
  assert.equal(r.params.year, new Date().getFullYear());
  assert.equal(r.params.month, 6);
});

test('parseIntent detects invoice count by client', () => {
  const clients = [{ name: 'Hans I Tech Pvt Ltd' }];
  const r = parseIntent('How many invoices issued to Hans I Tech?', clients);
  assert.equal(r.intent, 'invoice_count_by_client');
  assert.ok(r.params.clientHint);
});

test('resolveClientByName fuzzy match and ambiguity', () => {
  const db = createTestDb();
  seedWorkspace(db);
  const match = resolveClientByName(db, 'ws-1', 'Hans I Tech');
  assert.equal(match.status, 'matched');
  assert.equal(match.client.name, 'Hans I Tech Pvt Ltd');

  const ambiguous = resolveClientByName(db, 'ws-1', 'Hans');
  assert.equal(ambiguous.status, 'ambiguous');
  assert.ok(ambiguous.matches.length >= 2);
});

test('sumInvoiceAmountByPeriod aggregates June invoices', () => {
  const db = createTestDb();
  seedWorkspace(db);
  const summary = sumInvoiceAmountByPeriod(db, 'ws-1', { year: 2025, month: 6 });
  assert.equal(summary.count, 2);
  assert.equal(summary.total, 125000);
});

test('countInvoicesByClient filters by client', () => {
  const db = createTestDb();
  seedWorkspace(db);
  const { fromDate, toDate } = periodToDateRange(2025, 6);
  const { count } = countInvoicesByClient(db, 'ws-1', { clientId: 'c1', fromDate, toDate });
  assert.equal(count, 2);
});

test('formatTemplateReply for invoice amount by period', () => {
  const reply = formatTemplateReply('invoice_amount_by_period', {
    count: 2,
    total: 125000,
    periodLabel: 'June 2025'
  });
  assert.match(reply, /June 2025/);
  assert.match(reply, /₹/);
});

test('ai chat usage rate limit in email db', () => {
  const emailDb = new Database(':memory:');
  initAiChatTables(emailDb);
  process.env.AI_CHAT_DAILY_LIMIT = '2';
  assert.equal(getUsageCount(emailDb, 'ws-1'), 0);
  assert.equal(checkRateLimit(emailDb, 'ws-1'), true);
  incrementUsage(emailDb, 'ws-1');
  incrementUsage(emailDb, 'ws-1');
  assert.equal(getUsageCount(emailDb, 'ws-1'), 2);
  assert.equal(checkRateLimit(emailDb, 'ws-1'), false);
  delete process.env.AI_CHAT_DAILY_LIMIT;
});

test('handleChatMessage answers June total without OpenAI', async () => {
  const db = createTestDb();
  seedWorkspace(db);
  const emailDb = new Database(':memory:');
  initAiChatTables(emailDb);
  const prev = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  const result = await handleChatMessage({
    db,
    importedDb: null,
    emailDb,
    workspaceId: 'ws-1',
    message: 'How much invoice amount in June 2025?',
    history: []
  });

  assert.equal(result.source, 'template');
  assert.match(result.reply, /June 2025/);
  assert.match(result.reply, /₹/);

  if (prev) process.env.OPENAI_API_KEY = prev;
});

test('handleChatMessage counts invoices for client', async () => {
  const db = createTestDb();
  seedWorkspace(db);
  const emailDb = new Database(':memory:');
  initAiChatTables(emailDb);

  const result = await handleChatMessage({
    db,
    importedDb: null,
    emailDb,
    workspaceId: 'ws-1',
    message: 'How many invoices issued to Hans I Tech Pvt Ltd?',
    history: []
  });

  assert.equal(result.source, 'template');
  assert.match(result.reply, /2 invoice/);
});

test('parseIntent handles client total with ampersand in name', () => {
  const clients = [{ name: 'ANIL JAIN & ASSOCIATES' }];
  const r = parseIntent('whats the total amount for anil jain & associates', clients, []);
  assert.equal(r.intent, 'invoice_total_by_client');
  assert.ok(r.params.clientHint);
});

test('parseIntent handles company invoice count', () => {
  const companies = [{ name: 'R Bhargava & Associates' }];
  const r = parseIntent(
    'how many invoices in the company name Rbhargava & Associates do we have',
    [],
    companies
  );
  assert.equal(r.intent, 'invoice_count_by_company');
  assert.ok(r.params.companyHint);
});

test('handleChatMessage totals for client with special characters in name', async () => {
  const db = createTestDb();
  const ws = 'ws-anil';
  db.prepare('INSERT INTO clients (id, name, workspaceId) VALUES (?, ?, ?)').run(
    'c-anil', 'ANIL JAIN & ASSOCIATES', ws
  );
  db.prepare(`
    INSERT INTO invoices (id, invoiceNumber, clientId, workspaceId, invoiceDate, total, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('i1', 'DL/84', 'c-anil', ws, '2026-04-07', 59000, 'draft');
  db.prepare(`
    INSERT INTO invoices (id, invoiceNumber, clientId, workspaceId, invoiceDate, total, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('i2', 'DL/85', 'c-anil', ws, '2026-05-01', 59000, 'draft');
  db.prepare(`
    INSERT INTO invoices (id, invoiceNumber, clientId, workspaceId, invoiceDate, total, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('i3', 'DL/86', 'c-anil', ws, '2026-06-01', 59000, 'draft');

  const emailDb = new Database(':memory:');
  initAiChatTables(emailDb);
  const prev = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'sk-test-should-not-be-called';

  const result = await handleChatMessage({
    db,
    importedDb: null,
    emailDb,
    workspaceId: ws,
    message: 'whats the total amount for anil jain & associates',
    history: []
  });

  assert.equal(result.source, 'template');
  assert.match(result.reply, /3 invoice/);
  assert.match(result.reply, /1,77,000/);

  if (prev) process.env.OPENAI_API_KEY = prev;
  else delete process.env.OPENAI_API_KEY;
});

test('handleChatMessage counts invoices by company', async () => {
  const db = createTestDb();
  const ws = 'ws-co';
  db.prepare('INSERT INTO companies (id, name, workspaceId) VALUES (?, ?, ?)').run(
    'co-rb', 'R Bhargava & Associates', ws
  );
  db.prepare('INSERT INTO clients (id, name, workspaceId) VALUES (?, ?, ?)').run('c1', 'Client A', ws);
  for (let i = 0; i < 3; i += 1) {
    db.prepare(`
      INSERT INTO invoices (id, invoiceNumber, clientId, companyId, workspaceId, invoiceDate, total, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(`inv-${i}`, `N-${i}`, 'c1', 'co-rb', ws, '2026-06-01', 1000, 'draft');
  }

  const emailDb = new Database(':memory:');
  initAiChatTables(emailDb);
  const prev = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  const result = await handleChatMessage({
    db,
    importedDb: null,
    emailDb,
    workspaceId: ws,
    message: 'how many invoices in the company name Rbhargava & Associates do we have',
    history: []
  });

  assert.equal(result.source, 'template');
  assert.match(result.reply, /3 invoice/);
  assert.match(result.reply, /R Bhargava/i);

  if (prev) process.env.OPENAI_API_KEY = prev;
});

test('parseIntent detects list invoices from partial client name', () => {
  const clients = [{ name: 'CIRQULUS SOLUTIONS PRIVATE LIMITED' }];
  const r = parseIntent('show me all invoices from cirqulus', clients);
  assert.equal(r.intent, 'list_invoices_by_client');
  assert.ok(r.params.clientHint);
});

test('resolveClientByName matches cirqulus partial name', () => {
  const db = createTestDb();
  const ws = 'ws-cirq';
  db.prepare('INSERT INTO clients (id, name, workspaceId) VALUES (?, ?, ?)').run(
    'c-cirq', 'CIRQULUS SOLUTIONS PRIVATE LIMITED', ws
  );
  const match = resolveClientByName(db, ws, 'cirqulus');
  assert.equal(match.status, 'matched');
  assert.equal(match.client.name, 'CIRQULUS SOLUTIONS PRIVATE LIMITED');
});

test('buildInvoiceLinks with one vs multiple invoices', () => {
  const single = buildInvoiceLinks({
    invoices: [{ id: 'i1', invoiceNumber: 'DL/86', total: 59000 }],
    clientId: 'c-cirq',
    clientName: 'CIRQULUS SOLUTIONS PRIVATE LIMITED'
  });
  assert.equal(single.length, 2);
  assert.match(single[0].href, /^\/invoice\//);
  assert.match(single[1].href, /\/invoices\?client=c-cirq/);

  const multiple = buildInvoiceLinks({
    invoices: [
      { id: 'i1', invoiceNumber: 'INV-1', total: 1000 },
      { id: 'i2', invoiceNumber: 'INV-2', total: 2000 },
      { id: 'i3', invoiceNumber: 'INV-3', total: 3000 }
    ],
    clientId: 'c1',
    clientName: 'Test Client'
  });
  assert.equal(multiple.length, 4);
  assert.match(multiple[0].href, /\/invoices\?client=c1/);
  assert.equal(multiple.filter((l) => l.href.startsWith('/invoice/')).length, 3);
});

test('handleChatMessage returns links for cirqulus list intent', async () => {
  const db = createTestDb();
  const ws = 'ws-cirq-links';
  db.prepare('INSERT INTO clients (id, name, workspaceId) VALUES (?, ?, ?)').run(
    'c-cirq', 'CIRQULUS SOLUTIONS PRIVATE LIMITED', ws
  );
  db.prepare(`
    INSERT INTO invoices (id, invoiceNumber, clientId, workspaceId, invoiceDate, total, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('inv-cirq', 'DL/86/26-27/14', 'c-cirq', ws, '2026-06-01', 59000, 'draft');

  const emailDb = new Database(':memory:');
  initAiChatTables(emailDb);
  const prev = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  const result = await handleChatMessage({
    db,
    importedDb: null,
    emailDb,
    workspaceId: ws,
    message: 'show me all invoices from cirqulus',
    history: []
  });

  assert.equal(result.source, 'template');
  assert.match(result.reply, /CIRQULUS/i);
  assert.ok(Array.isArray(result.links));
  assert.ok(result.links.some((l) => l.href.includes('/invoices?client=c-cirq')));
  assert.ok(result.links.some((l) => l.href.includes('/invoice/inv-cirq')));

  if (prev) process.env.OPENAI_API_KEY = prev;
});

test('handleChatMessage returns invoice and filter links when count is one', async () => {
  const db = createTestDb();
  const ws = 'ws-one';
  db.prepare('INSERT INTO clients (id, name, workspaceId) VALUES (?, ?, ?)').run(
    'c-one', 'CIRQULUS SOLUTIONS PRIVATE LIMITED', ws
  );
  db.prepare(`
    INSERT INTO invoices (id, invoiceNumber, clientId, workspaceId, invoiceDate, total, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('inv-one', 'DL/86/26-27/14', 'c-one', ws, '2026-06-01', 59000, 'draft');

  const emailDb = new Database(':memory:');
  initAiChatTables(emailDb);
  const prev = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  const result = await handleChatMessage({
    db,
    importedDb: null,
    emailDb,
    workspaceId: ws,
    message: 'How many invoices for CIRQULUS?',
    history: []
  });

  assert.equal(result.source, 'template');
  assert.match(result.reply, /1 invoice/);
  assert.ok(result.links.some((l) => l.href === '/invoice/inv-one'));
  assert.ok(result.links.some((l) => l.href === '/invoices?client=c-one'));

  if (prev) process.env.OPENAI_API_KEY = prev;
});
