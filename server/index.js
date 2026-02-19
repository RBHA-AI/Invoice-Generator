const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../client/build')));

// Initialize SQLite Database
const db = new Database('invoices.db');

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
try {
  db.prepare("ALTER TABLE invoices ADD COLUMN companyId TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE invoice_items ADD COLUMN detailedDescription TEXT").run();
} catch (e) {}

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    gstin TEXT,
    msmeNumber TEXT,
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
  try {
    const { name, address, gstin, msmeNumber } = req.body;
    const id = uuidv4();
    
    const stmt = db.prepare(`
      INSERT INTO companies (id, name, address, gstin, msmeNumber)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, name, address || null, gstin || null, msmeNumber || null);
    
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(id);
    res.status(201).json(company);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update company
app.put('/api/companies/:id', (req, res) => {
  try {
    const { name, address, gstin, msmeNumber } = req.body;

    const stmt = db.prepare(`
      UPDATE companies 
      SET name = ?, address = ?, gstin = ?, msmeNumber = ?
      WHERE id = ?
    `);

    stmt.run(name, address || null, gstin || null, msmeNumber || null, req.params.id);
    
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
    res.json(company);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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

// Delete client
app.delete('/api/clients/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== INVOICE ROUTES ====================

// Get all invoices
app.get('/api/invoices', (req, res) => {
  try {
    const invoices = db.prepare(`
      SELECT i.*, c.name as clientName 
      FROM invoices i 
      LEFT JOIN clients c ON i.clientId = c.id 
      ORDER BY i.createdAt DESC
    `).all();
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single invoice with items
app.get('/api/invoices/:id', (req, res) => {
  try {
    const invoice = db.prepare(`
      SELECT i.*, c.* 
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

// Create invoice
app.post('/api/invoices', (req, res) => {
  try {
    const { invoiceNumber, clientId, companyId, invoiceDate, dueDate, placeOfSupply, items, subtotal, cgst, sgst, igst, taxType, total, status } = req.body;
    const invoiceId = uuidv4();
    
    // Insert invoice
    const invoiceStmt = db.prepare(`
      INSERT INTO invoices (id, invoiceNumber, clientId, companyId, invoiceDate, dueDate, placeOfSupply, subtotal, cgst, sgst, igst, taxType, total, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    invoiceStmt.run(invoiceId, invoiceNumber, clientId, companyId || null, invoiceDate, dueDate, placeOfSupply, subtotal, cgst, sgst, igst || 0, taxType || null, total, status || 'draft');
    
    // Insert items
    const itemStmt = db.prepare(`
      INSERT INTO invoice_items (id, invoiceId, description, detailedDescription, hsnSac, quantity, rate, cgstPercent, sgstPercent, amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    items.forEach(item => {
      itemStmt.run(uuidv4(), invoiceId, item.description, item.detailedDescription || null, item.hsnSac, item.quantity, item.rate, item.cgstPercent, item.sgstPercent, item.amount);
    });
    
    const invoice = db.prepare(`
      SELECT i.*, c.* 
      FROM invoices i 
      LEFT JOIN clients c ON i.clientId = c.id 
      WHERE i.id = ?
    `).get(invoiceId);
    
    const savedItems = db.prepare('SELECT * FROM invoice_items WHERE invoiceId = ?').all(invoiceId);
    
    res.status(201).json({ ...invoice, items: savedItems });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Database: invoices.db`);
});
