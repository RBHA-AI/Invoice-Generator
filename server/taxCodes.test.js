const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const express = require('express');
const bodyParser = require('body-parser');
const Database = require('better-sqlite3');
const request = require('supertest');
const ExcelJS = require('exceljs');

const { importTaxCodesFromXlsx, registerTaxCodeRoutes } = require('./taxCodes');

function createDbWithSchema() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS tax_codes (
      codeType TEXT NOT NULL,
      code TEXT NOT NULL,
      description TEXT NOT NULL,
      level INTEGER,
      parentCode TEXT,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (codeType, code)
    );
  `);
  return db;
}

test('importTaxCodesFromXlsx imports and normalizes codes', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hsn-sac-'));
  const xlsxPath = path.join(tmpDir, 'HSN_SAC.xlsx');

  const wb = new ExcelJS.Workbook();
  const hsn = wb.addWorksheet('HSN_MSTR');
  hsn.addRow(['HSN_CD', 'HSN_Description']);
  hsn.addRow(['0101', 'LIVE HORSES, ASSES, MULES AND HINNIES']);
  hsn.addRow(['0101.21', 'Horses for breeding']); // dotted code should normalize to digits

  const sac = wb.addWorksheet('SAC_MSTR');
  sac.addRow(['SAC_CD', 'SAC_Description']);
  sac.addRow(['998222', 'Accounting and auditing services']);

  await wb.xlsx.writeFile(xlsxPath);

  const db = createDbWithSchema();
  const result = await importTaxCodesFromXlsx({ db, xlsxPath });

  assert.ok(result.rows >= 3);
  const row1 = db.prepare('SELECT * FROM tax_codes WHERE codeType = ? AND code = ?').get('HSN', '0101');
  assert.equal(row1.description, 'LIVE HORSES, ASSES, MULES AND HINNIES');

  const dotted = db.prepare('SELECT * FROM tax_codes WHERE codeType = ? AND code = ?').get('HSN', '010121');
  assert.equal(dotted.description, 'Horses for breeding');

  const sacRow = db.prepare('SELECT * FROM tax_codes WHERE codeType = ? AND code = ?').get('SAC', '998222');
  assert.equal(sacRow.description, 'Accounting and auditing services');
});

test('POST /api/tax-codes/suggest returns retrieval-only suggestions without API key', async () => {
  const db = createDbWithSchema();
  db.prepare(`
    INSERT INTO tax_codes (codeType, code, description, level, parentCode)
    VALUES (?, ?, ?, ?, ?)
  `).run('SAC', '998222', 'Accounting and auditing services', 6, '9982');

  const app = express();
  app.use(bodyParser.json());
  registerTaxCodeRoutes({ app, db });

  const resp = await request(app)
    .post('/api/tax-codes/suggest')
    .send({ description: 'Professional accounting services' })
    .expect(200);

  assert.ok(resp.body);
  assert.equal(resp.body.used, 'retrieval-only');
  assert.ok(Array.isArray(resp.body.suggestions));
  assert.ok(resp.body.suggestions.length >= 1, `Expected at least 1 suggestion, got: ${JSON.stringify(resp.body)}`);
  const topCode = resp.body.suggestions[0].code;
  assert.equal(topCode, '998222', `Expected 998222 as top suggestion, got ${topCode}`);
  assert.equal(resp.body.suggestions[0].codeType, 'SAC');
});

test('IT support does not match unrelated HSN via substring false positives', async () => {
  const db = createDbWithSchema();
  const insert = db.prepare(`
    INSERT INTO tax_codes (codeType, code, description, level, parentCode)
    VALUES (?, ?, ?, ?, ?)
  `);
  insert.run('SAC', '998313', 'Information technology IT design and development services', 6, '9983');
  insert.run('SAC', '998316', 'IT infrastructure and network management services', 6, '9983');
  insert.run('HSN', '05030000', 'Horsehair and horsehair waste', 8, '0503');
  insert.run('HSN', '39207210', 'Plastics sheets for reporting and display equipment', 8, '3920');

  const app = express();
  app.use(bodyParser.json());
  registerTaxCodeRoutes({ app, db });

  const resp = await request(app)
    .post('/api/tax-codes/suggest')
    .send({ description: 'IT SUPPORT SERVICES' })
    .expect(200);

  assert.equal(resp.body.used, 'retrieval-only');
  assert.ok(resp.body.suggestions.length >= 1);
  assert.equal(resp.body.suggestions[0].codeType, 'SAC');
  assert.ok(
    resp.body.suggestions[0].code.startsWith('9983'),
    `Expected IT-related SAC, got ${resp.body.suggestions[0].code}`
  );
  const codes = resp.body.suggestions.map((s) => s.code);
  assert.ok(!codes.includes('05030000'), 'Should not suggest horsehair HSN');
});

test('certification / 15CA line item suggests SAC 998214', async () => {
  const db = createDbWithSchema();
  db.prepare(`
    INSERT INTO tax_codes (codeType, code, description, level, parentCode)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    'SAC',
    '998214',
    'Legal documentation and certification services concerning other documents',
    6,
    '9982'
  );
  db.prepare(`
    INSERT INTO tax_codes (codeType, code, description, level, parentCode)
    VALUES (?, ?, ?, ?, ?)
  `).run('HSN', '010632', 'PSITTACIFORMES INCL. PARROTS', 6, '0106');

  const app = express();
  app.use(bodyParser.json());
  registerTaxCodeRoutes({ app, db });

  const resp = await request(app)
    .post('/api/tax-codes/suggest')
    .send({
      description: 'Certification Charges — For 15CA & CB 10 Form For F.Y 25-26 @2500 per form'
    })
    .expect(200);

  assert.ok(resp.body.suggestions.length >= 1);
  assert.equal(resp.body.suggestions[0].code, '998214');
  assert.equal(resp.body.suggestions[0].codeType, 'SAC');
});

