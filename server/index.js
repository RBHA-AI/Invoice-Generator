const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const multer = require('multer');
const { registerTaxCodeRoutes, maybeAutoImportTaxCodes } = require('./taxCodes');
const { registerEmailRoutes, createEmailDb } = require('./email');
const { createImportedInvoicesDb, registerImportedInvoiceRoutes } = require('./importedInvoices');
const { initRecurringBillTables, registerRecurringBillRoutes } = require('./recurringBills');
const { registerAiChatRoutes } = require('./aiChat');
const {
  requireAuth,
  requireAdmin,
  signToken,
  verifyPassword
} = require('./auth');
const {
  migrateWorkspaces,
  migrateEmailDb,
  createWorkspace,
  findWorkspaceBySlug,
  getWorkspaceById
} = require('./workspaces');

const app = express();
const PORT = process.env.PORT || 5000;

// Paths are anchored to this file so the app works from any cwd (PM2, systemd, etc.).
const PROJECT_ROOT = path.join(__dirname, '..');
const DB_PATH = process.env.INVOICES_DB_PATH || path.join(PROJECT_ROOT, 'invoices.db');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const UPLOADS_LOGOS_DIR = path.join(UPLOADS_DIR, 'logos');
const UPLOADS_IMPORTED_DIR = path.join(UPLOADS_DIR, 'imported');
fs.mkdirSync(UPLOADS_LOGOS_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_IMPORTED_DIR, { recursive: true });

// Configure multer for logo uploads (per-workspace subdirectory)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const workspaceId = req.workspaceId || 'unknown';
    const dir = path.join(UPLOADS_LOGOS_DIR, workspaceId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
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
          amountInWordsCurrency TEXT DEFAULT 'inr',
          createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (clientId) REFERENCES clients(id),
          FOREIGN KEY (companyId) REFERENCES companies(id)
        );
      `);

      db.exec(`
        INSERT INTO invoices_new (
          id, invoiceNumber, clientId, companyId, invoiceDate, dueDate, placeOfSupply, bankName,
          bankBranch, bankAccount, ifsc, subtotal, cgst, sgst, igst, taxType, total, status, signatureTitle, amountInWordsCurrency, createdAt
        )
        SELECT
          id, invoiceNumber, clientId, companyId, invoiceDate, dueDate, placeOfSupply, bankName,
          bankBranch, bankAccount, ifsc, subtotal, cgst, sgst, igst, taxType, total, status, signatureTitle, COALESCE(amountInWordsCurrency, 'inr'), createdAt
        FROM invoices;
      `);

      db.exec('DROP TABLE invoices;');
      db.exec('ALTER TABLE invoices_new RENAME TO invoices;');
    });

    tx();
  }

  // Legacy index; workspace migration rebuilds per-tenant uniqueness.
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_company_invoice_unique
    ON invoices (COALESCE(companyId, ''), invoiceNumber);
  `);
};

const apiAuthMiddleware = (req, res, next) => {
  if (!req.path.startsWith('/api')) {
    return next();
  }
  const publicRoutes = [
    { method: 'POST', path: '/api/auth/login' },
    { method: 'GET', path: '/api/tax-codes/status' },
    { method: 'GET', path: '/api/tax-codes/search' }
  ];
  if (publicRoutes.some((r) => r.method === req.method && r.path === req.path)) {
    return next();
  }
  if (req.method === 'POST' && req.path === '/api/admin/workspaces') {
    return requireAdmin(req, res, next);
  }
  return requireAuth(req, res, next);
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
// Additive only: no DEFAULT so existing invoice rows stay NULL (treated as INR in app code).
try {
  db.prepare('ALTER TABLE invoices ADD COLUMN amountInWordsCurrency TEXT').run();
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
    signatureTitle TEXT DEFAULT 'PARTNER',
    amountInWordsCurrency TEXT DEFAULT 'inr',
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

  CREATE TABLE IF NOT EXISTS invoice_payments (
    id TEXT PRIMARY KEY,
    invoiceId TEXT NOT NULL,
    paymentNumber INTEGER NOT NULL,
    amountReceived REAL NOT NULL,
    bankCharges REAL DEFAULT 0,
    paymentDate TEXT NOT NULL,
    paymentMode TEXT,
    reference TEXT,
    notes TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoiceId) REFERENCES invoices(id) ON DELETE CASCADE
  );

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

try {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tax_codes_type_code ON tax_codes (codeType, code);
    CREATE INDEX IF NOT EXISTS idx_tax_codes_type_desc ON tax_codes (codeType, description);
  `);
} catch (e) {
  console.warn('Tax code index setup:', e.message);
}

try {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments (invoiceId);
  `);
} catch (e) {
  console.warn('invoice_payments index setup:', e.message);
}

initRecurringBillTables(db);

const PAYMENT_MODES = ['Cash', 'Cheque', 'Bank Transfer', 'UPI', 'Credit Card', 'Other'];
const normalizeAmountInWordsCurrency = (currency) =>
  String(currency || '').toLowerCase() === 'aud' ? 'aud' : 'inr';
// On update, omit amountInWordsCurrency from the body to keep the stored value (legacy clients).
const resolveAmountInWordsCurrency = (incoming, existing) => {
  if (incoming !== undefined && incoming !== null) {
    return normalizeAmountInWordsCurrency(incoming);
  }
  return normalizeAmountInWordsCurrency(existing);
};

const getNextPaymentNumber = (workspaceId) => {
  const row = db
    .prepare(`
      SELECT MAX(p.paymentNumber) as maxNum
      FROM invoice_payments p
      INNER JOIN invoices i ON p.invoiceId = i.id
      WHERE i.workspaceId = ?
    `)
    .get(workspaceId);
  return (row && row.maxNum ? row.maxNum : 0) + 1;
};

const getInvoiceWithDetails = (invoiceId, workspaceId) => {
  const invoice = db.prepare(`
    SELECT i.*,
      c.name as clientName,
      c.primaryContactEmail,
      c.primaryContactName,
      c.address as clientAddress,
      c.city as clientCity,
      c.state as clientState,
      c.pincode as clientPincode,
      c.gstin as clientGstin,
      co.name as companyName,
      co.email as companyEmail,
      co.logo as companyLogo,
      co.address as companyAddress,
      co.gstin as companyGstin,
      co.msmeNumber as companyMsmeNumber,
      co.phone as companyPhone,
      co.state as companyState,
      co.signatureTitle as companySignatureTitle
    FROM invoices i
    LEFT JOIN clients c ON i.clientId = c.id
    LEFT JOIN companies co ON i.companyId = co.id
    WHERE i.id = ? AND i.workspaceId = ?
  `).get(invoiceId, workspaceId);

  if (!invoice) return null;

  const items = db.prepare('SELECT * FROM invoice_items WHERE invoiceId = ?').all(invoiceId);
  const payments = db.prepare(`
    SELECT * FROM invoice_payments WHERE invoiceId = ?
    ORDER BY paymentDate DESC, createdAt DESC
  `).all(invoiceId);

  return {
    ...invoice,
    amountInWordsCurrency: normalizeAmountInWordsCurrency(invoice.amountInWordsCurrency),
    items,
    payments
  };
};

const generateNextInvoiceNumber = (workspaceId) => {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;

  let currentYear;
  let nextYear;
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
    WHERE workspaceId = ? AND invoiceNumber LIKE ?
    ORDER BY createdAt DESC
    LIMIT 1
  `).get(workspaceId, `DL/01/${financialYear}/%`);

  let nextNumber = 1;
  if (lastInvoice) {
    const parts = lastInvoice.invoiceNumber.split('/');
    const lastNumber = parseInt(parts[parts.length - 1], 10);
    if (!Number.isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  return `DL/01/${financialYear}/${nextNumber}`;
};

const createInvoiceFromPayload = (workspaceId, payload) => {
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
    signatureTitle,
    amountInWordsCurrency
  } = payload;

  const normalizedAmountInWordsCurrency = normalizeAmountInWordsCurrency(amountInWordsCurrency);
  const normalizedInvoiceNumber = String(invoiceNumber || '').trim();
  if (!normalizedInvoiceNumber) {
    throw new Error('Invoice number is required');
  }
  if (!Array.isArray(items) || items.length < 1) {
    throw new Error('At least one line item is required');
  }

  const invoiceId = uuidv4();

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO invoices (
        id, workspaceId, invoiceNumber, clientId, companyId, invoiceDate, dueDate,
        placeOfSupply, bankName, bankBranch, bankAccount, ifsc, subtotal, cgst, sgst,
        igst, taxType, total, status, signatureTitle, amountInWordsCurrency
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      invoiceId,
      workspaceId,
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
      status || 'draft',
      signatureTitle || 'PARTNER',
      normalizedAmountInWordsCurrency
    );

    const itemStmt = db.prepare(`
      INSERT INTO invoice_items (
        id, invoiceId, description, detailedDescription, hsnSac, quantity, rate,
        cgstPercent, sgstPercent, amount
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    items.forEach((item) => {
      itemStmt.run(
        uuidv4(),
        invoiceId,
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
  });

  tx();
  return invoiceId;
};

migrateInvoiceUniquenessPerCompany();
const defaultWorkspace = migrateWorkspaces(db);
const emailDb = createEmailDb(PROJECT_ROOT);
const importedDb = createImportedInvoicesDb(PROJECT_ROOT);
migrateEmailDb(emailDb, defaultWorkspace.id);

app.use(apiAuthMiddleware);

registerTaxCodeRoutes({ app, db });
registerEmailRoutes({ app, emailDb, getInvoiceWithDetails, requireAuth });
registerImportedInvoiceRoutes({
  app,
  importedDb,
  uploadsImportedDir: UPLOADS_IMPORTED_DIR,
  requireAuth
});
registerRecurringBillRoutes({
  app,
  db,
  getInvoiceWithDetails,
  createInvoiceFromPayload,
  generateNextInvoiceNumber
});
registerAiChatRoutes({ app, db, importedDb, emailDb, requireAuth });
maybeAutoImportTaxCodes({ db });

// ==================== AUTH ROUTES ====================

app.post('/api/auth/login', (req, res) => {
  try {
    const workspaceInput = String(req.body?.workspace || req.body?.slug || '').trim();
    const password = String(req.body?.password || '');
    if (!workspaceInput || !password) {
      return res.status(400).json({ error: 'Workspace name and password are required' });
    }
    const workspace = findWorkspaceBySlug(db, workspaceInput);
    if (!workspace || !verifyPassword(password, workspace.passwordHash)) {
      return res.status(401).json({ error: 'Invalid workspace or password' });
    }
    const token = signToken({ workspaceId: workspace.id, slug: workspace.slug });
    res.json({
      token,
      workspace: {
        id: workspace.id,
        slug: workspace.slug,
        displayName: workspace.displayName
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/me', (req, res) => {
  try {
    const workspace = getWorkspaceById(db, req.workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    res.json({ workspace });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/workspaces', (req, res) => {
  try {
    const { slug, displayName, password } = req.body || {};
    const workspace = createWorkspace(db, { slug, displayName, password });
    res.status(201).json({
      workspace,
      message: 'Workspace created. Hand off the workspace name and password to the customer.'
    });
  } catch (error) {
    if (error.message && error.message.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
});

// ==================== COMPANY ROUTES ====================

// Get all companies
app.get('/api/companies', (req, res) => {
  try {
    const companies = db
      .prepare('SELECT * FROM companies WHERE workspaceId = ? ORDER BY createdAt DESC')
      .all(req.workspaceId);
    res.json(companies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single company
app.get('/api/companies/:id', (req, res) => {
  try {
    const company = db
      .prepare('SELECT * FROM companies WHERE id = ? AND workspaceId = ?')
      .get(req.params.id, req.workspaceId);
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
      const logo = req.file
        ? `/uploads/logos/${req.workspaceId}/${req.file.filename}`
        : null;
      const id = uuidv4();
      
      const stmt = db.prepare(`
        INSERT INTO companies (id, workspaceId, name, address, state, signatureTitle, gstin, msmeNumber, logo, bankName, bankBranch, bankAccount, ifsc, email, phone)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(id, req.workspaceId, name, address || null, state || null, signatureTitle || null, gstin || null, msmeNumber || null, logo, bankName || null, bankBranch || null, bankAccount || null, ifsc || null, email || null, phone || null);
      
      const company = db
        .prepare('SELECT * FROM companies WHERE id = ? AND workspaceId = ?')
        .get(id, req.workspaceId);
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
      const logo = req.file
        ? `/uploads/logos/${req.workspaceId}/${req.file.filename}`
        : undefined;

      const existing = db
        .prepare('SELECT id FROM companies WHERE id = ? AND workspaceId = ?')
        .get(req.params.id, req.workspaceId);
      if (!existing) {
        return res.status(404).json({ error: 'Company not found' });
      }

      let stmt;
      if (logo !== undefined) {
        stmt = db.prepare(`
          UPDATE companies 
          SET name = ?, address = ?, state = ?, signatureTitle = ?, gstin = ?, msmeNumber = ?, logo = ?, bankName = ?, bankBranch = ?, bankAccount = ?, ifsc = ?, email = ?, phone = ?
          WHERE id = ? AND workspaceId = ?
        `);
        stmt.run(name, address || null, state || null, signatureTitle || null, gstin || null, msmeNumber || null, logo, bankName || null, bankBranch || null, bankAccount || null, ifsc || null, email || null, phone || null, req.params.id, req.workspaceId);
      } else {
        stmt = db.prepare(`
          UPDATE companies 
          SET name = ?, address = ?, state = ?, signatureTitle = ?, gstin = ?, msmeNumber = ?, bankName = ?, bankBranch = ?, bankAccount = ?, ifsc = ?, email = ?, phone = ?
          WHERE id = ? AND workspaceId = ?
        `);
        stmt.run(name, address || null, state || null, signatureTitle || null, gstin || null, msmeNumber || null, bankName || null, bankBranch || null, bankAccount || null, ifsc || null, email || null, phone || null, req.params.id, req.workspaceId);
      }
      
      const company = db
        .prepare('SELECT * FROM companies WHERE id = ? AND workspaceId = ?')
        .get(req.params.id, req.workspaceId);
      res.json(company);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

// Delete company
app.delete('/api/companies/:id', (req, res) => {
  try {
    const result = db
      .prepare('DELETE FROM companies WHERE id = ? AND workspaceId = ?')
      .run(req.params.id, req.workspaceId);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json({ message: 'Company deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== CLIENT ROUTES ====================

// Get all clients
app.get('/api/clients', (req, res) => {
  try {
    const clients = db
      .prepare('SELECT * FROM clients WHERE workspaceId = ? ORDER BY createdAt DESC')
      .all(req.workspaceId);
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single client
app.get('/api/clients/:id', (req, res) => {
  try {
    const client = db
      .prepare('SELECT * FROM clients WHERE id = ? AND workspaceId = ?')
      .get(req.params.id, req.workspaceId);
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
      INSERT INTO clients (id, workspaceId, name, gstin, address, city, state, pincode, gstTreatment, primaryContactName, primaryContactEmail, primaryContactPhone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, req.workspaceId, name, gstin, address, city, state, pincode, gstTreatment || null, primaryContactName || null, primaryContactEmail || null, primaryContactPhone || null);
    
    const client = db
      .prepare('SELECT * FROM clients WHERE id = ? AND workspaceId = ?')
      .get(id, req.workspaceId);
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
      WHERE id = ? AND workspaceId = ?
    `);

    stmt.run(name, gstin, address, city, state, pincode, gstTreatment || null, primaryContactName || null, primaryContactEmail || null, primaryContactPhone || null, req.params.id, req.workspaceId);
    
    const client = db
      .prepare('SELECT * FROM clients WHERE id = ? AND workspaceId = ?')
      .get(req.params.id, req.workspaceId);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete client (prevent delete if invoices exist)
app.delete('/api/clients/:id', (req, res) => {
  try {
    const client = db
      .prepare('SELECT * FROM clients WHERE id = ? AND workspaceId = ?')
      .get(req.params.id, req.workspaceId);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const invoiceCount = db
      .prepare('SELECT COUNT(*) as count FROM invoices WHERE clientId = ? AND workspaceId = ?')
      .get(req.params.id, req.workspaceId).count;

    if (invoiceCount > 0) {
      return res.status(409).json({
        error: 'Cannot delete client because invoices exist for this client. Please delete those invoices first.'
      });
    }

    db.prepare('DELETE FROM clients WHERE id = ? AND workspaceId = ?').run(req.params.id, req.workspaceId);

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
      WHERE i.workspaceId = ? AND i.invoiceDate >= ? AND i.invoiceDate <= ?
      ORDER BY i.invoiceDate DESC, i.createdAt DESC
    `).all(req.workspaceId, start, end);

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
      WHERE i.workspaceId = ?
      ORDER BY i.invoiceDate DESC, i.createdAt DESC
    `).all(req.workspaceId);
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate next invoice number
app.get('/api/invoices/generate-number', (req, res) => {
  try {
    res.json({ invoiceNumber: generateNextInvoiceNumber(req.workspaceId) });
  } catch (error) {
    console.error('Error generating invoice number:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single invoice with items and payments (avoid SELECT i.*, c.* — duplicate column names
// overwrite invoice id with client id and omit clientName expected by the UI)
app.get('/api/invoices/:id', (req, res) => {
  try {
    const invoice = getInvoiceWithDetails(req.params.id, req.workspaceId);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Next payment number for Record Payment form
app.get('/api/payments/next-number', (req, res) => {
  try {
    res.json({ paymentNumber: getNextPaymentNumber(req.workspaceId) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Record payment for an invoice (full amount only; marks invoice paid)
app.post('/api/invoices/:id/payments', (req, res) => {
  try {
    const invoice = db
      .prepare('SELECT * FROM invoices WHERE id = ? AND workspaceId = ?')
      .get(req.params.id, req.workspaceId);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({ error: 'This invoice is already marked as paid.' });
    }

    const existingPayment = db.prepare(
      'SELECT id FROM invoice_payments WHERE invoiceId = ? LIMIT 1'
    ).get(req.params.id);
    if (existingPayment) {
      return res.status(400).json({ error: 'A payment has already been recorded for this invoice.' });
    }

    const {
      amountReceived,
      bankCharges,
      paymentDate,
      paymentMode,
      reference,
      notes
    } = req.body;

    const amount = parseFloat(amountReceived);
    const invoiceTotal = parseFloat(invoice.total) || 0;
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Amount received must be a positive number.' });
    }
    if (Math.abs(amount - invoiceTotal) > 0.01) {
      return res.status(400).json({
        error: `Amount received must equal the invoice total (${invoiceTotal.toFixed(2)}).`
      });
    }

    if (!paymentDate || !String(paymentDate).trim()) {
      return res.status(400).json({ error: 'Payment date is required.' });
    }

    const mode = paymentMode && PAYMENT_MODES.includes(paymentMode) ? paymentMode : 'Bank Transfer';
    const charges = parseFloat(bankCharges);
    const bankChargesValue = Number.isFinite(charges) && charges >= 0 ? charges : 0;

    const paymentId = uuidv4();
    const paymentNumber = getNextPaymentNumber(req.workspaceId);

    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO invoice_payments (
          id, invoiceId, paymentNumber, amountReceived, bankCharges,
          paymentDate, paymentMode, reference, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        paymentId,
        req.params.id,
        paymentNumber,
        amount,
        bankChargesValue,
        String(paymentDate).trim(),
        mode,
        reference ? String(reference).trim() : null,
        notes ? String(notes).trim() : null
      );

      db.prepare('UPDATE invoices SET status = ? WHERE id = ? AND workspaceId = ?').run(
        'paid',
        req.params.id,
        req.workspaceId
      );
    });

    tx();

    const updated = getInvoiceWithDetails(req.params.id, req.workspaceId);
    res.status(201).json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete invoice (and related items)
app.delete('/api/invoices/:id', (req, res) => {
  try {
    const existing = db
      .prepare('SELECT * FROM invoices WHERE id = ? AND workspaceId = ?')
      .get(req.params.id, req.workspaceId);
    if (!existing) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const tx = db.transaction(() => {
      db.prepare('DELETE FROM invoice_items WHERE invoiceId = ?').run(req.params.id);
      db.prepare('DELETE FROM invoices WHERE id = ? AND workspaceId = ?').run(
        req.params.id,
        req.workspaceId
      );
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
    const existing = db
      .prepare('SELECT * FROM invoices WHERE id = ? AND workspaceId = ?')
      .get(req.params.id, req.workspaceId);
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
      signatureTitle,
      amountInWordsCurrency
    } = req.body;
    const normalizedAmountInWordsCurrency = resolveAmountInWordsCurrency(
      amountInWordsCurrency,
      existing.amountInWordsCurrency
    );
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
            taxType = ?, total = ?, status = ?, signatureTitle = ?, amountInWordsCurrency = ?
        WHERE id = ? AND workspaceId = ?
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
        normalizedAmountInWordsCurrency,
        req.params.id,
        req.workspaceId
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

    const invoice = getInvoiceWithDetails(req.params.id, req.workspaceId);
    res.json(invoice);
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
    const invoiceId = createInvoiceFromPayload(req.workspaceId, req.body);
    const invoice = getInvoiceWithDetails(invoiceId, req.workspaceId);
    res.status(201).json(invoice);
  } catch (error) {
    if (error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Invoice number already exists for this company' });
    }
    if (error.message === 'Invoice number is required' || error.message === 'At least one line item is required') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// Tax-code routes registered above; kept separate for testability.

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

app.listen(PORT, () => {
  const hasOpenAi = !!String(process.env.OPENAI_API_KEY || '').trim();
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Database: ${DB_PATH}`);
  console.log(`🤖 OpenAI (HSN/SAC + email drafts): ${hasOpenAi ? 'configured' : 'not set (add OPENAI_API_KEY to .env)'}`);
});
