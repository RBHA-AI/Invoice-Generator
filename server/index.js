const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const ExcelJS = require('exceljs');

const app = express();
const PORT = process.env.PORT || 5000;

// Paths are anchored to this file so the app works from any cwd (PM2, systemd, etc.).
const PROJECT_ROOT = path.join(__dirname, '..');
const DB_PATH = process.env.INVOICES_DB_PATH || path.join(PROJECT_ROOT, 'invoices.db');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const UPLOADS_LOGOS_DIR = path.join(UPLOADS_DIR, 'logos');
fs.mkdirSync(UPLOADS_LOGOS_DIR, { recursive: true });

// Configure multer for logo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_LOGOS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../client/build')));
app.use('/uploads', express.static(UPLOADS_DIR));

// Initialize SQLite Database
const db = new Database(DB_PATH);

const migrateInvoiceUniquenessPerCompany = () => {
  const invoiceTableSqlRow = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'invoices'")
    .get();
  const invoiceTableSql = String(invoiceTableSqlRow?.sql || '').toUpperCase();

  // If legacy schema has global UNIQUE on invoiceNumber, rebuild table.
  if (invoiceTableSql.includes('INVOICENUMBER TEXT UNIQUE')) {
    const tx = db.transaction(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS invoices_new (
          id TEXT PRIMARY KEY,
          invoiceNumber TEXT NOT NULL,
          clientId TEXT NOT NULL,
          companyId TEXT,
          invoiceDate TEXT NOT NULL,
          dueDate TEXT NOT NULL,
          placeOfSupply TEXT,
          bankName TEXT,
          bankBranch TEXT,
          bankAccount TEXT,
          ifsc TEXT,
          subtotal REAL,
          cgst REAL,
          sgst REAL,
          igst REAL DEFAULT 0,
          taxType TEXT,
          total REAL,
          status TEXT DEFAULT 'draft',
          signatureTitle TEXT DEFAULT 'PARTNER',
          createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (clientId) REFERENCES clients(id),
          FOREIGN KEY (companyId) REFERENCES companies(id)
        );
      `);

      db.exec(`
        INSERT INTO invoices_new (
          id, invoiceNumber, clientId, companyId, invoiceDate, dueDate, placeOfSupply, bankName,
          bankBranch, bankAccount, ifsc, subtotal, cgst, sgst, igst, taxType, total, status, signatureTitle, createdAt
        )
        SELECT
          id, invoiceNumber, clientId, companyId, invoiceDate, dueDate, placeOfSupply, bankName,
          bankBranch, bankAccount, ifsc, subtotal, cgst, sgst, igst, taxType, total, status, signatureTitle, createdAt
        FROM invoices;
      `);

      db.exec('DROP TABLE invoices;');
      db.exec('ALTER TABLE invoices_new RENAME TO invoices;');
    });

    tx();
  }

  // Enforce uniqueness by company + invoiceNumber (companyId NULL treated as empty string bucket).
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_company_invoice_unique
    ON invoices (COALESCE(companyId, ''), invoiceNumber);
  `);
};

// Ensure new columns exist for existing databases (safe ALTERs)
try {
  db.prepare("ALTER TABLE clients ADD COLUMN gstTreatment TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE clients ADD COLUMN primaryContactName TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE clients ADD COLUMN primaryContactEmail TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE clients ADD COLUMN primaryContactPhone TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE invoices ADD COLUMN igst REAL DEFAULT 0").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE invoices ADD COLUMN taxType TEXT").run();
} catch (e) {}
try {  db.prepare("ALTER TABLE invoices ADD COLUMN bankName TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE invoices ADD COLUMN bankBranch TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE invoices ADD COLUMN bankAccount TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE invoices ADD COLUMN ifsc TEXT").run();
} catch (e) {}
try {  db.prepare("ALTER TABLE invoices ADD COLUMN companyId TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE companies ADD COLUMN logo TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE companies ADD COLUMN bankName TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE companies ADD COLUMN bankBranch TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE companies ADD COLUMN bankAccount TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE companies ADD COLUMN ifsc TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE companies ADD COLUMN email TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE companies ADD COLUMN phone TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE companies ADD COLUMN state TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE companies ADD COLUMN signatureTitle TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE invoices ADD COLUMN signatureTitle TEXT DEFAULT 'PARTNER'").run();
} catch (e) {}

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    state TEXT,
    signatureTitle TEXT,
    gstin TEXT,
    msmeNumber TEXT,
    logo TEXT,
    bankName TEXT,
    bankBranch TEXT,
    bankAccount TEXT,
    ifsc TEXT,
    email TEXT,
    phone TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    gstin TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    gstTreatment TEXT,
    primaryContactName TEXT,
    primaryContactEmail TEXT,
    primaryContactPhone TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    invoiceNumber TEXT UNIQUE NOT NULL,
    clientId TEXT NOT NULL,
    companyId TEXT,
    invoiceDate TEXT NOT NULL,
    dueDate TEXT NOT NULL,
    placeOfSupply TEXT,
    bankName TEXT,
    bankBranch TEXT,
    bankAccount TEXT,
    ifsc TEXT,
    subtotal REAL,
    cgst REAL,
    sgst REAL,
    igst REAL DEFAULT 0,
    taxType TEXT,
    total REAL,
    status TEXT DEFAULT 'draft',
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clientId) REFERENCES clients(id),
    FOREIGN KEY (companyId) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS invoice_items (
    id TEXT PRIMARY KEY,
    invoiceId TEXT NOT NULL,
    description TEXT NOT NULL,
    detailedDescription TEXT,
    hsnSac TEXT,
    quantity REAL DEFAULT 1,
    rate REAL NOT NULL,
    cgstPercent REAL DEFAULT 9,
    sgstPercent REAL DEFAULT 9,
    amount REAL,
    FOREIGN KEY (invoiceId) REFERENCES invoices(id) ON DELETE CASCADE
  );
`);

migrateInvoiceUniquenessPerCompany();

// ==================== COMPANY ROUTES ====================

// Get all companies
app.get('/api/companies', (req, res) => {
  try {
    const companies = db.prepare('SELECT * FROM companies ORDER BY createdAt DESC').all();
    res.json(companies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single company
app.get('/api/companies/:id', (req, res) => {
  try {
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json(company);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create company
app.post('/api/companies', (req, res) => {
  upload.single('logo')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    
    try {
      const { name, address, state, signatureTitle, gstin, msmeNumber, bankName, bankBranch, bankAccount, ifsc, email, phone } = req.body;
      const logo = req.file ? `/uploads/logos/${req.file.filename}` : null;
      const id = uuidv4();
      
      const stmt = db.prepare(`
        INSERT INTO companies (id, name, address, state, signatureTitle, gstin, msmeNumber, logo, bankName, bankBranch, bankAccount, ifsc, email, phone)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(id, name, address || null, state || null, signatureTitle || null, gstin || null, msmeNumber || null, logo, bankName || null, bankBranch || null, bankAccount || null, ifsc || null, email || null, phone || null);
      
      const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(id);
      res.status(201).json(company);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

// Update company
app.put('/api/companies/:id', (req, res, next) => {
  upload.single('logo')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    
    try {
      const { name, address, state, signatureTitle, gstin, msmeNumber, bankName, bankBranch, bankAccount, ifsc, email, phone } = req.body;
      const logo = req.file ? `/uploads/logos/${req.file.filename}` : undefined;

      let stmt;
      if (logo !== undefined) {
        stmt = db.prepare(`
          UPDATE companies 
          SET name = ?, address = ?, state = ?, signatureTitle = ?, gstin = ?, msmeNumber = ?, logo = ?, bankName = ?, bankBranch = ?, bankAccount = ?, ifsc = ?, email = ?, phone = ?
          WHERE id = ?
        `);
        stmt.run(name, address || null, state || null, signatureTitle || null, gstin || null, msmeNumber || null, logo, bankName || null, bankBranch || null, bankAccount || null, ifsc || null, email || null, phone || null, req.params.id);
      } else {
        stmt = db.prepare(`
          UPDATE companies 
          SET name = ?, address = ?, state = ?, signatureTitle = ?, gstin = ?, msmeNumber = ?, bankName = ?, bankBranch = ?, bankAccount = ?, ifsc = ?, email = ?, phone = ?
          WHERE id = ?
        `);
        stmt.run(name, address || null, state || null, signatureTitle || null, gstin || null, msmeNumber || null, bankName || null, bankBranch || null, bankAccount || null, ifsc || null, email || null, phone || null, req.params.id);
      }
      
      const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
      res.json(company);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

// Delete company
app.delete('/api/companies/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM companies WHERE id = ?').run(req.params.id);
    res.json({ message: 'Company deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== CLIENT ROUTES ====================

// Get all clients
app.get('/api/clients', (req, res) => {
  try {
    const clients = db.prepare('SELECT * FROM clients ORDER BY createdAt DESC').all();
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single client
app.get('/api/clients/:id', (req, res) => {
  try {
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create client
app.post('/api/clients', (req, res) => {
  try {
    const { name, gstin, address, city, state, pincode, gstTreatment, primaryContactName, primaryContactEmail, primaryContactPhone } = req.body;
    const id = uuidv4();
    
    const stmt = db.prepare(`
      INSERT INTO clients (id, name, gstin, address, city, state, pincode, gstTreatment, primaryContactName, primaryContactEmail, primaryContactPhone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, name, gstin, address, city, state, pincode, gstTreatment || null, primaryContactName || null, primaryContactEmail || null, primaryContactPhone || null);
    
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    res.status(201).json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update client
app.put('/api/clients/:id', (req, res) => {
  try {
    const { name, gstin, address, city, state, pincode, gstTreatment, primaryContactName, primaryContactEmail, primaryContactPhone } = req.body;

    const stmt = db.prepare(`
      UPDATE clients 
      SET name = ?, gstin = ?, address = ?, city = ?, state = ?, pincode = ?, gstTreatment = ?, primaryContactName = ?, primaryContactEmail = ?, primaryContactPhone = ?
      WHERE id = ?
    `);

    stmt.run(name, gstin, address, city, state, pincode, gstTreatment || null, primaryContactName || null, primaryContactEmail || null, primaryContactPhone || null, req.params.id);
    
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete client (prevent delete if invoices exist)
app.delete('/api/clients/:id', (req, res) => {
  try {
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const invoiceCount = db
      .prepare('SELECT COUNT(*) as count FROM invoices WHERE clientId = ?')
      .get(req.params.id).count;

    if (invoiceCount > 0) {
      return res.status(409).json({
        error: 'Cannot delete client because invoices exist for this client. Please delete those invoices first.'
      });
    }

    db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);

    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== INVOICE ROUTES ====================

/** Text cells for monthly export: main line text, optional long description, qty/rate/amount/HSN per line */
function buildLineItemExportColumns(items) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) {
    return { titles: '', details: '', figures: '' };
  }
  const titles = [];
  const details = [];
  const figures = [];
  list.forEach((it, i) => {
    const n = i + 1;
    titles.push(`${n}. ${String(it.description || '').trim()}`);
    const det = String(it.detailedDescription || '').trim();
    details.push(det ? `${n}. ${det}` : `${n}. —`);
    const hsn = it.hsnSac ? `HSN/SAC ${it.hsnSac}` : '';
    const qty = it.quantity ?? '';
    const rate = Number(it.rate || 0).toFixed(2);
    const amt = Number(it.amount || 0).toFixed(2);
    figures.push(
      `${n}. ${hsn ? `${hsn} | ` : ''}Qty ${qty} | Rate ${rate} | Amount ${amt}`
    );
  });
  return {
    titles: titles.join('\n'),
    details: details.join('\n'),
    figures: figures.join('\n')
  };
}

// Export monthly invoice summary as Excel
// Query param: month=YYYY-MM (e.g. 2026-03)
app.get('/api/invoices/export', async (req, res) => {
  try {
    const month = String(req.query.month || '').trim();
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Invalid month. Use YYYY-MM (e.g. 2026-03).' });
    }

    const [yearStr, monthStr] = month.split('-');
    const year = Number(yearStr);
    const monthNum = Number(monthStr); // 1-12
    const start = `${yearStr}-${monthStr}-01`;
    const endDate = new Date(Date.UTC(year, monthNum, 0)); // last day of month
    const endDay = String(endDate.getUTCDate()).padStart(2, '0');
    const end = `${yearStr}-${monthStr}-${endDay}`;

    const rows = db.prepare(`
      SELECT
        i.id,
        i.invoiceNumber,
        i.invoiceDate,
        i.dueDate,
        i.placeOfSupply,
        i.subtotal,
        i.cgst,
        i.sgst,
        i.igst,
        i.taxType,
        i.total,
        i.status,
        c.name as clientName,
        c.gstin as clientGSTIN,
        co.name as companyName,
        co.gstin as companyGSTIN
      FROM invoices i
      LEFT JOIN clients c ON i.clientId = c.id
      LEFT JOIN companies co ON i.companyId = co.id
      WHERE i.invoiceDate >= ? AND i.invoiceDate <= ?
      ORDER BY i.invoiceDate DESC, i.createdAt DESC
    `).all(start, end);

    const itemsByInvoiceId = new Map();
    if (rows.length > 0) {
      const ph = rows.map(() => '?').join(',');
      const allItems = db
        .prepare(
          `SELECT invoiceId, description, detailedDescription, hsnSac, quantity, rate, amount
           FROM invoice_items WHERE invoiceId IN (${ph}) ORDER BY invoiceId, rowid`
        )
        .all(...rows.map((r) => r.id));
      for (const r of rows) {
        itemsByInvoiceId.set(r.id, []);
      }
      for (const it of allItems) {
        const bucket = itemsByInvoiceId.get(it.invoiceId);
        if (bucket) bucket.push(it);
      }
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Invoice Generator';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(`Invoices ${month}`, {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    sheet.columns = [
      { header: 'Invoice Number', key: 'invoiceNumber', width: 22 },
      { header: 'Invoice Date', key: 'invoiceDate', width: 14 },
      { header: 'Due Date', key: 'dueDate', width: 14 },
      { header: 'Status', key: 'status', width: 10 },
      { header: 'Client Name', key: 'clientName', width: 28 },
      { header: 'Client GSTIN', key: 'clientGSTIN', width: 18 },
      { header: 'Company Name', key: 'companyName', width: 28 },
      { header: 'Company GSTIN', key: 'companyGSTIN', width: 18 },
      { header: 'Place of Supply', key: 'placeOfSupply', width: 20 },
      { header: 'Line item (title)', key: 'lineItemTitles', width: 36 },
      { header: 'Line item (description)', key: 'lineItemDetails', width: 40 },
      { header: 'Line item (HSN / Qty / Rate / Amount)', key: 'lineItemFigures', width: 38 },
      { header: 'Tax Type', key: 'taxType', width: 12 },
      { header: 'Subtotal', key: 'subtotal', width: 14, style: { numFmt: '#,##0.00' } },
      { header: 'CGST', key: 'cgst', width: 12, style: { numFmt: '#,##0.00' } },
      { header: 'SGST', key: 'sgst', width: 12, style: { numFmt: '#,##0.00' } },
      { header: 'IGST', key: 'igst', width: 12, style: { numFmt: '#,##0.00' } },
      { header: 'Total', key: 'total', width: 14, style: { numFmt: '#,##0.00' } }
    ];

    // Header styling
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    sheet.getRow(1).height = 20;

    rows.forEach((r) => {
      const lineCols = buildLineItemExportColumns(itemsByInvoiceId.get(r.id) || []);
      sheet.addRow({
        invoiceNumber: r.invoiceNumber,
        invoiceDate: r.invoiceDate,
        dueDate: r.dueDate,
        status: r.status,
        clientName: r.clientName,
        clientGSTIN: r.clientGSTIN,
        companyName: r.companyName,
        companyGSTIN: r.companyGSTIN,
        placeOfSupply: r.placeOfSupply,
        lineItemTitles: lineCols.titles,
        lineItemDetails: lineCols.details,
        lineItemFigures: lineCols.figures,
        taxType: r.taxType,
        subtotal: r.subtotal || 0,
        cgst: r.cgst || 0,
        sgst: r.sgst || 0,
        igst: r.igst || 0,
        total: r.total || 0
      });
    });

    // Borders + alignment
    sheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
        if (rowNumber > 1) {
          cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
        }
      });
    });

    const estimateLines = (text, colWidth) => {
      const s = String(text || '');
      if (!s) return 1;
      const width = Math.max(8, Number(colWidth) || 10);
      const approxCharsPerLine = Math.floor(width * 1.05);
      return Math.max(1, Math.ceil(s.length / approxCharsPerLine));
    };

    // Dynamic row heights so long client/company names remain visible
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const clientName = row.getCell('clientName').value;
      const companyName = row.getCell('companyName').value;
      const place = row.getCell('placeOfSupply').value;
      const lineTitles = row.getCell('lineItemTitles').value;
      const lineDetails = row.getCell('lineItemDetails').value;
      const lineFigures = row.getCell('lineItemFigures').value;
      const lines = Math.max(
        estimateLines(clientName, sheet.getColumn('clientName').width),
        estimateLines(companyName, sheet.getColumn('companyName').width),
        estimateLines(place, sheet.getColumn('placeOfSupply').width),
        estimateLines(lineTitles, sheet.getColumn('lineItemTitles').width),
        estimateLines(lineDetails, sheet.getColumn('lineItemDetails').width),
        estimateLines(lineFigures, sheet.getColumn('lineItemFigures').width)
      );
      row.height = Math.min(80, 16 + (lines - 1) * 14);
    });

    // Auto-filter
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columns.length }
    };

    const filename = `invoice-summary-${month}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all invoices
app.get('/api/invoices', (req, res) => {
  try {
    const invoices = db.prepare(`
      SELECT i.*, c.name as clientName 
      FROM invoices i 
      LEFT JOIN clients c ON i.clientId = c.id 
      ORDER BY i.invoiceDate DESC, i.createdAt DESC
    `).all();
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate next invoice number
app.get('/api/invoices/generate-number', (req, res) => {
  try {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1; // 0-11, so add 1
    
    // Financial year starts in April (month 4)
    let currentYear, nextYear;
    if (currentMonth >= 4) {
      currentYear = currentDate.getFullYear();
      nextYear = currentYear + 1;
    } else {
      currentYear = currentDate.getFullYear() - 1;
      nextYear = currentDate.getFullYear();
    }
    
    const financialYear = `${currentYear}-${nextYear.toString().slice(-2)}`;
    
    const lastInvoice = db.prepare(`
      SELECT invoiceNumber FROM invoices 
      WHERE invoiceNumber LIKE ? 
      ORDER BY createdAt DESC 
      LIMIT 1
    `).get(`DL/01/${financialYear}/%`);
    
    let nextNumber = 1;
    if (lastInvoice) {
      const parts = lastInvoice.invoiceNumber.split('/');
      const lastNumber = parseInt(parts[parts.length - 1]);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }
    
    const invoiceNumber = `DL/01/${financialYear}/${nextNumber}`;
    res.json({ invoiceNumber });
  } catch (error) {
    console.error('Error generating invoice number:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single invoice with items (avoid SELECT i.*, c.* — duplicate column names
// overwrite invoice id with client id and omit clientName expected by the UI)
app.get('/api/invoices/:id', (req, res) => {
  try {
    const invoice = db.prepare(`
      SELECT i.*, c.name as clientName 
      FROM invoices i 
      LEFT JOIN clients c ON i.clientId = c.id 
      WHERE i.id = ?
    `).get(req.params.id);
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    const items = db.prepare('SELECT * FROM invoice_items WHERE invoiceId = ?').all(req.params.id);
    
    res.json({ ...invoice, items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete invoice (and related items)
app.delete('/api/invoices/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const tx = db.transaction(() => {
      db.prepare('DELETE FROM invoice_items WHERE invoiceId = ?').run(req.params.id);
      db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
    });

    tx();

    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update invoice (including items)
app.put('/api/invoices/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const {
      invoiceNumber,
      clientId,
      companyId,
      invoiceDate,
      dueDate,
      placeOfSupply,
      bankName,
      bankBranch,
      bankAccount,
      ifsc,
      items,
      subtotal,
      cgst,
      sgst,
      igst,
      taxType,
      total,
      status,
      signatureTitle
    } = req.body;
    const normalizedInvoiceNumber = String(invoiceNumber || '').trim();
    if (!normalizedInvoiceNumber) {
      return res.status(400).json({ error: 'Invoice number is required' });
    }
    // Replacing line items with an empty list used to happen when older clients sent PUT without `items`,
    // which wiped rows while totals stayed — reject empty arrays explicitly.
    if (Array.isArray(items) && items.length < 1) {
      return res.status(400).json({ error: 'At least one line item is required when updating line items' });
    }

    const tx = db.transaction(() => {
      const updateStmt = db.prepare(`
        UPDATE invoices
        SET invoiceNumber = ?, clientId = ?, companyId = ?, invoiceDate = ?, dueDate = ?, placeOfSupply = ?, 
            bankName = ?, bankBranch = ?, bankAccount = ?, ifsc = ?, subtotal = ?, cgst = ?, sgst = ?, igst = ?, 
            taxType = ?, total = ?, status = ?, signatureTitle = ?
        WHERE id = ?
      `);

      updateStmt.run(
        normalizedInvoiceNumber,
        clientId,
        companyId || null,
        invoiceDate,
        dueDate,
        placeOfSupply,
        bankName || null,
        bankBranch || null,
        bankAccount || null,
        ifsc || null,
        subtotal,
        cgst,
        sgst,
        igst || 0,
        taxType || null,
        total,
        status || existing.status || 'draft',
        signatureTitle || existing.signatureTitle || 'PARTNER',
        req.params.id
      );

      // Only replace line items when the body includes an items array.
      // Otherwise a partial PUT would delete all rows and leave totals inconsistent.
      if (Array.isArray(items)) {
        db.prepare('DELETE FROM invoice_items WHERE invoiceId = ?').run(req.params.id);

        const itemStmt = db.prepare(`
          INSERT INTO invoice_items (id, invoiceId, description, detailedDescription, hsnSac, quantity, rate, cgstPercent, sgstPercent, amount)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        items.forEach(item => {
          itemStmt.run(
            uuidv4(),
            req.params.id,
            item.description,
            item.detailedDescription || null,
            item.hsnSac,
            item.quantity,
            item.rate,
            item.cgstPercent,
            item.sgstPercent,
            item.amount
          );
        });
      }
    });

    tx();

    const invoice = db.prepare(`
      SELECT i.*, c.name as clientName 
      FROM invoices i 
      LEFT JOIN clients c ON i.clientId = c.id 
      WHERE i.id = ?
    `).get(req.params.id);

    const savedItems = db.prepare('SELECT * FROM invoice_items WHERE invoiceId = ?').all(req.params.id);

    res.json({ ...invoice, items: savedItems });
  } catch (error) {
    if (error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Invoice number already exists for this company' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Create invoice
app.post('/api/invoices', (req, res) => {
  try {
    const { invoiceNumber, clientId, companyId, invoiceDate, dueDate, placeOfSupply, bankName, bankBranch, bankAccount, ifsc, items, subtotal, cgst, sgst, igst, taxType, total, status, signatureTitle } = req.body;
    const normalizedInvoiceNumber = String(invoiceNumber || '').trim();
    if (!normalizedInvoiceNumber) {
      return res.status(400).json({ error: 'Invoice number is required' });
    }
    if (!Array.isArray(items) || items.length < 1) {
      return res.status(400).json({ error: 'At least one line item is required' });
    }
    const invoiceId = uuidv4();
    
    // Insert invoice
    const invoiceStmt = db.prepare(`
      INSERT INTO invoices (id, invoiceNumber, clientId, companyId, invoiceDate, dueDate, placeOfSupply, bankName, bankBranch, bankAccount, ifsc, subtotal, cgst, sgst, igst, taxType, total, status, signatureTitle)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    invoiceStmt.run(invoiceId, normalizedInvoiceNumber, clientId, companyId || null, invoiceDate, dueDate, placeOfSupply, bankName || null, bankBranch || null, bankAccount || null, ifsc || null, subtotal, cgst, sgst, igst || 0, taxType || null, total, status || 'draft', signatureTitle || 'PARTNER');
    
    // Insert items
    const itemStmt = db.prepare(`
      INSERT INTO invoice_items (id, invoiceId, description, detailedDescription, hsnSac, quantity, rate, cgstPercent, sgstPercent, amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    items.forEach(item => {
      itemStmt.run(uuidv4(), invoiceId, item.description, item.detailedDescription || null, item.hsnSac, item.quantity, item.rate, item.cgstPercent, item.sgstPercent, item.amount);
    });
    
    const invoice = db.prepare(`
      SELECT i.*, c.name as clientName 
      FROM invoices i 
      LEFT JOIN clients c ON i.clientId = c.id 
      WHERE i.id = ?
    `).get(invoiceId);
    
    const savedItems = db.prepare('SELECT * FROM invoice_items WHERE invoiceId = ?').all(invoiceId);
    
    res.status(201).json({ ...invoice, items: savedItems });
  } catch (error) {
    if (error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Invoice number already exists for this company' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Database: ${DB_PATH}`);
});
