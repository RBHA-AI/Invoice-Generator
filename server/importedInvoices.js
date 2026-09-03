const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const { extractInvoiceFromImage, detectMissingFields, resolveStatus } = require('./invoiceExtractor');
const { prepareVisionInput } = require('./pdfToImage');

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
]);

function initImportedInvoiceTables(importedDb) {
  importedDb.exec(`
    CREATE TABLE IF NOT EXISTS imported_invoices (
      id TEXT PRIMARY KEY,
      workspaceId TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'processing',
      sourceFilePath TEXT,
      sourceMimeType TEXT,
      sourceOriginalName TEXT,
      partyType TEXT DEFAULT 'vendor',
      partyName TEXT,
      partyGstin TEXT,
      partyAddress TEXT,
      issuerName TEXT,
      issuerGstin TEXT,
      invoiceNumber TEXT,
      invoiceDate TEXT,
      dueDate TEXT,
      placeOfSupply TEXT,
      subtotal REAL,
      cgst REAL,
      sgst REAL,
      igst REAL DEFAULT 0,
      taxType TEXT,
      total REAL,
      extractionRawJson TEXT,
      extractionErrors TEXT,
      missingFields TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS imported_invoice_items (
      id TEXT PRIMARY KEY,
      importedInvoiceId TEXT NOT NULL,
      description TEXT,
      detailedDescription TEXT,
      hsnSac TEXT,
      quantity REAL,
      rate REAL,
      cgstPercent REAL,
      sgstPercent REAL,
      amount REAL,
      FOREIGN KEY (importedInvoiceId) REFERENCES imported_invoices(id) ON DELETE CASCADE
    );
  `);

  try {
    importedDb.exec('CREATE INDEX IF NOT EXISTS idx_imported_invoices_workspace ON imported_invoices (workspaceId)');
    importedDb.exec('CREATE INDEX IF NOT EXISTS idx_imported_invoice_items_invoice ON imported_invoice_items (importedInvoiceId)');
  } catch (e) {
    console.warn('imported_invoices index setup:', e.message);
  }

  return importedDb;
}

function createImportedInvoicesDb(projectRoot) {
  const dbPath =
    process.env.IMPORTED_INVOICES_DB_PATH || path.join(projectRoot, 'imported_invoices.db');
  const importedDb = new Database(dbPath);
  return initImportedInvoiceTables(importedDb);
}

function parseMissingFields(row) {
  if (!row?.missingFields) return [];
  try {
    const parsed = JSON.parse(row.missingFields);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapImportedInvoiceRow(row, items = []) {
  if (!row) return null;
  return {
    ...row,
    missingFields: parseMissingFields(row),
    items
  };
}

function getImportedInvoiceWithDetails(importedDb, invoiceId, workspaceId) {
  const invoice = importedDb.prepare(`
    SELECT * FROM imported_invoices WHERE id = ? AND workspaceId = ?
  `).get(invoiceId, workspaceId);

  if (!invoice) return null;

  const items = importedDb.prepare(`
    SELECT * FROM imported_invoice_items WHERE importedInvoiceId = ? ORDER BY rowid ASC
  `).all(invoiceId);

  return mapImportedInvoiceRow(invoice, items);
}

function insertImportedInvoiceItems(importedDb, invoiceId, items) {
  const itemStmt = importedDb.prepare(`
    INSERT INTO imported_invoice_items (
      id, importedInvoiceId, description, detailedDescription, hsnSac,
      quantity, rate, cgstPercent, sgstPercent, amount
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  (items || []).forEach((item) => {
    itemStmt.run(
      uuidv4(),
      invoiceId,
      item.description || null,
      item.detailedDescription || null,
      item.hsnSac || null,
      item.quantity ?? null,
      item.rate ?? null,
      item.cgstPercent ?? null,
      item.sgstPercent ?? null,
      item.amount ?? null
    );
  });
}

function applyExtractionToInvoice(importedDb, invoiceId, workspaceId, extraction) {
  const missingFields = extraction.missingFields || detectMissingFields(extraction);
  const status = extraction.status || resolveStatus(missingFields, false);
  const now = new Date().toISOString();

  const tx = importedDb.transaction(() => {
    importedDb.prepare(`
      UPDATE imported_invoices SET
        status = ?,
        partyType = ?,
        partyName = ?,
        partyGstin = ?,
        partyAddress = ?,
        issuerName = ?,
        issuerGstin = ?,
        invoiceNumber = ?,
        invoiceDate = ?,
        dueDate = ?,
        placeOfSupply = ?,
        subtotal = ?,
        cgst = ?,
        sgst = ?,
        igst = ?,
        taxType = ?,
        total = ?,
        extractionRawJson = ?,
        extractionErrors = NULL,
        missingFields = ?,
        updatedAt = ?
      WHERE id = ? AND workspaceId = ?
    `).run(
      status,
      extraction.partyType || 'vendor',
      extraction.partyName || null,
      extraction.partyGstin || null,
      extraction.partyAddress || null,
      extraction.issuerName || null,
      extraction.issuerGstin || null,
      extraction.invoiceNumber || null,
      extraction.invoiceDate || null,
      extraction.dueDate || null,
      extraction.placeOfSupply || null,
      extraction.subtotal ?? null,
      extraction.cgst ?? null,
      extraction.sgst ?? null,
      extraction.igst ?? 0,
      extraction.taxType || null,
      extraction.total ?? null,
      extraction.extractionRawJson || null,
      JSON.stringify(missingFields),
      now,
      invoiceId,
      workspaceId
    );

    importedDb.prepare('DELETE FROM imported_invoice_items WHERE importedInvoiceId = ?').run(invoiceId);
    insertImportedInvoiceItems(importedDb, invoiceId, extraction.items || []);
  });

  tx();
}

function markExtractionFailed(importedDb, invoiceId, workspaceId, errorMessage) {
  importedDb.prepare(`
    UPDATE imported_invoices SET
      status = 'failed',
      extractionErrors = ?,
      updatedAt = CURRENT_TIMESTAMP
    WHERE id = ? AND workspaceId = ?
  `).run(errorMessage, invoiceId, workspaceId);
}

async function runExtractionOnFile(importedDb, invoiceId, workspaceId, filePath, mimeType) {
  try {
    const { imageBase64, mimeType: visionMimeType } = await prepareVisionInput(filePath, mimeType);
    const extraction = await extractInvoiceFromImage({ imageBase64, mimeType: visionMimeType });
    applyExtractionToInvoice(importedDb, invoiceId, workspaceId, extraction);
  } catch (error) {
    markExtractionFailed(importedDb, invoiceId, workspaceId, error.message);
    throw error;
  }
}

function createImportedUploadMiddleware(uploadsImportedDir) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const workspaceId = req.workspaceId || 'unknown';
      const dir = path.join(uploadsImportedDir, workspaceId);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '';
      cb(null, `${uuidv4()}${ext}`);
    }
  });

  return multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Only JPEG, PNG, WebP, and PDF files are allowed'));
      }
    }
  });
}

function computeStatusFromPayload(payload, existingStatus) {
  const data = {
    invoiceNumber: payload.invoiceNumber,
    invoiceDate: payload.invoiceDate,
    partyName: payload.partyName,
    total: payload.total,
    items: payload.items
  };
  const missingFields = detectMissingFields(data);
  if (payload.forceStatus) return { status: payload.forceStatus, missingFields };
  if (missingFields.length > 0) return { status: 'needs_review', missingFields };
  return { status: 'complete', missingFields };
}

function registerImportedInvoiceRoutes({ app, importedDb, uploadsImportedDir, requireAuth }) {
  const importedUpload = createImportedUploadMiddleware(uploadsImportedDir);

  app.get('/api/imported-invoices', requireAuth, (req, res) => {
    try {
      const rows = importedDb.prepare(`
        SELECT id, workspaceId, status, sourceFilePath, sourceMimeType, sourceOriginalName,
               partyType, partyName, invoiceNumber, invoiceDate, dueDate, total, missingFields, createdAt, updatedAt
        FROM imported_invoices
        WHERE workspaceId = ?
        ORDER BY createdAt DESC
      `).all(req.workspaceId);

      res.json(rows.map((row) => mapImportedInvoiceRow(row)));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/imported-invoices/:id', requireAuth, (req, res) => {
    try {
      const invoice = getImportedInvoiceWithDetails(importedDb, req.params.id, req.workspaceId);
      if (!invoice) {
        return res.status(404).json({ error: 'Imported invoice not found' });
      }
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/imported-invoices/upload', requireAuth, (req, res) => {
    importedUpload.single('file')(req, res, async (uploadErr) => {
      if (uploadErr) {
        return res.status(400).json({ error: uploadErr.message });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const invoiceId = uuidv4();
      const relativePath = `/uploads/imported/${req.workspaceId}/${req.file.filename}`;
      const now = new Date().toISOString();

      try {
        importedDb.prepare(`
          INSERT INTO imported_invoices (
            id, workspaceId, status, sourceFilePath, sourceMimeType, sourceOriginalName, createdAt, updatedAt
          ) VALUES (?, ?, 'processing', ?, ?, ?, ?, ?)
        `).run(
          invoiceId,
          req.workspaceId,
          relativePath,
          req.file.mimetype,
          req.file.originalname,
          now,
          now
        );

        await runExtractionOnFile(
          importedDb,
          invoiceId,
          req.workspaceId,
          req.file.path,
          req.file.mimetype
        );

        const invoice = getImportedInvoiceWithDetails(importedDb, invoiceId, req.workspaceId);
        res.status(201).json(invoice);
      } catch (error) {
        const invoice = getImportedInvoiceWithDetails(importedDb, invoiceId, req.workspaceId);
        if (invoice) {
          return res.status(201).json({
            ...invoice,
            extractionWarning: error.message
          });
        }
        res.status(500).json({ error: error.message });
      }
    });
  });

  app.put('/api/imported-invoices/:id', requireAuth, (req, res) => {
    try {
      const existing = importedDb.prepare(`
        SELECT * FROM imported_invoices WHERE id = ? AND workspaceId = ?
      `).get(req.params.id, req.workspaceId);

      if (!existing) {
        return res.status(404).json({ error: 'Imported invoice not found' });
      }

      const {
        partyType,
        partyName,
        partyGstin,
        partyAddress,
        issuerName,
        issuerGstin,
        invoiceNumber,
        invoiceDate,
        dueDate,
        placeOfSupply,
        subtotal,
        cgst,
        sgst,
        igst,
        taxType,
        total,
        items,
        status: requestedStatus
      } = req.body;

      if (Array.isArray(items) && items.length < 1) {
        return res.status(400).json({ error: 'At least one line item is required when updating line items' });
      }

      const payloadForStatus = {
        partyName: partyName ?? existing.partyName,
        invoiceNumber: invoiceNumber ?? existing.invoiceNumber,
        invoiceDate: invoiceDate ?? existing.invoiceDate,
        total: total !== undefined ? total : existing.total,
        items: Array.isArray(items) ? items : getImportedInvoiceWithDetails(importedDb, req.params.id, req.workspaceId)?.items
      };

      const { status, missingFields } = requestedStatus === 'needs_review'
        ? { status: 'needs_review', missingFields: detectMissingFields(payloadForStatus) }
        : computeStatusFromPayload(payloadForStatus, existing.status);

      const tx = importedDb.transaction(() => {
        importedDb.prepare(`
          UPDATE imported_invoices SET
            status = ?,
            partyType = ?,
            partyName = ?,
            partyGstin = ?,
            partyAddress = ?,
            issuerName = ?,
            issuerGstin = ?,
            invoiceNumber = ?,
            invoiceDate = ?,
            dueDate = ?,
            placeOfSupply = ?,
            subtotal = ?,
            cgst = ?,
            sgst = ?,
            igst = ?,
            taxType = ?,
            total = ?,
            missingFields = ?,
            updatedAt = CURRENT_TIMESTAMP
          WHERE id = ? AND workspaceId = ?
        `).run(
          status,
          partyType || existing.partyType || 'vendor',
          partyName ?? existing.partyName,
          partyGstin ?? existing.partyGstin,
          partyAddress ?? existing.partyAddress,
          issuerName ?? existing.issuerName,
          issuerGstin ?? existing.issuerGstin,
          invoiceNumber ?? existing.invoiceNumber,
          invoiceDate ?? existing.invoiceDate,
          dueDate ?? existing.dueDate,
          placeOfSupply ?? existing.placeOfSupply,
          subtotal !== undefined ? subtotal : existing.subtotal,
          cgst !== undefined ? cgst : existing.cgst,
          sgst !== undefined ? sgst : existing.sgst,
          igst !== undefined ? igst : existing.igst,
          taxType ?? existing.taxType,
          total !== undefined ? total : existing.total,
          JSON.stringify(missingFields),
          req.params.id,
          req.workspaceId
        );

        if (Array.isArray(items)) {
          importedDb.prepare('DELETE FROM imported_invoice_items WHERE importedInvoiceId = ?').run(req.params.id);
          insertImportedInvoiceItems(importedDb, req.params.id, items);
        }
      });

      tx();

      const updated = getImportedInvoiceWithDetails(importedDb, req.params.id, req.workspaceId);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/imported-invoices/:id', requireAuth, (req, res) => {
    try {
      const existing = importedDb.prepare(`
        SELECT * FROM imported_invoices WHERE id = ? AND workspaceId = ?
      `).get(req.params.id, req.workspaceId);

      if (!existing) {
        return res.status(404).json({ error: 'Imported invoice not found' });
      }

      if (existing.sourceFilePath) {
        const fileName = path.basename(existing.sourceFilePath);
        const filePath = path.join(uploadsImportedDir, req.workspaceId, fileName);
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (e) {
          console.warn('Could not delete imported file:', e.message);
        }
      }

      importedDb.prepare('DELETE FROM imported_invoices WHERE id = ? AND workspaceId = ?').run(
        req.params.id,
        req.workspaceId
      );

      res.json({ message: 'Imported invoice deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/imported-invoices/:id/re-extract', requireAuth, async (req, res) => {
    try {
      const existing = importedDb.prepare(`
        SELECT * FROM imported_invoices WHERE id = ? AND workspaceId = ?
      `).get(req.params.id, req.workspaceId);

      if (!existing) {
        return res.status(404).json({ error: 'Imported invoice not found' });
      }
      if (!existing.sourceFilePath) {
        return res.status(400).json({ error: 'No source file available for re-extraction' });
      }

      const fileName = path.basename(existing.sourceFilePath);
      const filePath = path.join(uploadsImportedDir, req.workspaceId, fileName);
      if (!fs.existsSync(filePath)) {
        return res.status(400).json({ error: 'Source file not found on disk' });
      }

      importedDb.prepare(`
        UPDATE imported_invoices SET status = 'processing', updatedAt = CURRENT_TIMESTAMP
        WHERE id = ? AND workspaceId = ?
      `).run(req.params.id, req.workspaceId);

      try {
        await runExtractionOnFile(
          importedDb,
          req.params.id,
          req.workspaceId,
          filePath,
          existing.sourceMimeType
        );
      } catch (error) {
        const invoice = getImportedInvoiceWithDetails(importedDb, req.params.id, req.workspaceId);
        return res.json({
          ...invoice,
          extractionWarning: error.message
        });
      }

      const invoice = getImportedInvoiceWithDetails(importedDb, req.params.id, req.workspaceId);
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

module.exports = {
  createImportedInvoicesDb,
  initImportedInvoiceTables,
  registerImportedInvoiceRoutes,
  getImportedInvoiceWithDetails
};
