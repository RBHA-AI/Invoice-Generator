const { v4: uuidv4 } = require('uuid');

const FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'semi_annual', 'annual'];
const AMOUNT_TYPES = ['fixed', 'varying'];
const PROFILE_STATUSES = ['active', 'paused', 'completed', 'cancelled'];

const FREQUENCY_LABELS = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semi_annual: 'Semi-annual',
  annual: 'Annual'
};

function initRecurringBillTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS recurring_bills (
      id TEXT PRIMARY KEY,
      workspaceId TEXT NOT NULL,
      name TEXT NOT NULL,
      sourceInvoiceId TEXT,
      templateSnapshot TEXT NOT NULL,
      clientId TEXT NOT NULL,
      companyId TEXT,
      amountType TEXT NOT NULL DEFAULT 'fixed',
      frequency TEXT NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT,
      nextRunDate TEXT NOT NULL,
      dueDateOffsetDays INTEGER DEFAULT 30,
      status TEXT DEFAULT 'active',
      autoSend INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS recurring_bill_cycles (
      id TEXT PRIMARY KEY,
      recurringBillId TEXT NOT NULL,
      workspaceId TEXT NOT NULL,
      scheduledDate TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      generatedInvoiceId TEXT,
      generatedAt TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (recurringBillId) REFERENCES recurring_bills(id) ON DELETE CASCADE
    );
  `);

  try {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_recurring_bills_workspace_status
        ON recurring_bills (workspaceId, status);
      CREATE INDEX IF NOT EXISTS idx_recurring_bills_workspace_next_run
        ON recurring_bills (workspaceId, nextRunDate);
      CREATE INDEX IF NOT EXISTS idx_recurring_bill_cycles_bill_date
        ON recurring_bill_cycles (recurringBillId, scheduledDate);
    `);
  } catch (e) {
    console.warn('Recurring bills index setup:', e.message);
  }
}

function isoDateOnly(dateStr) {
  if (!dateStr) return '';
  return String(dateStr).split('T')[0];
}

function addDays(dateStr, days) {
  const d = new Date(`${isoDateOnly(dateStr)}T12:00:00`);
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().split('T')[0];
}

function addFrequency(dateStr, frequency) {
  const d = new Date(`${isoDateOnly(dateStr)}T12:00:00`);
  switch (frequency) {
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'quarterly':
      d.setMonth(d.getMonth() + 3);
      break;
    case 'semi_annual':
      d.setMonth(d.getMonth() + 6);
      break;
    case 'annual':
      d.setFullYear(d.getFullYear() + 1);
      break;
    default:
      d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString().split('T')[0];
}

function computeDueDateOffsetDays(invoice) {
  const invoiceDate = isoDateOnly(invoice.invoiceDate);
  const dueDate = isoDateOnly(invoice.dueDate);
  if (!invoiceDate || !dueDate) return 30;
  const start = new Date(`${invoiceDate}T12:00:00`);
  const end = new Date(`${dueDate}T12:00:00`);
  const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
  return Number.isFinite(diff) && diff >= 0 ? diff : 30;
}

function buildTemplateSnapshot(invoice) {
  return {
    placeOfSupply: invoice.placeOfSupply || null,
    bankName: invoice.bankName || null,
    bankBranch: invoice.bankBranch || null,
    bankAccount: invoice.bankAccount || null,
    ifsc: invoice.ifsc || null,
    subtotal: invoice.subtotal,
    cgst: invoice.cgst,
    sgst: invoice.sgst,
    igst: invoice.igst || 0,
    taxType: invoice.taxType || null,
    total: invoice.total,
    signatureTitle: invoice.signatureTitle || 'PARTNER',
    amountInWordsCurrency: invoice.amountInWordsCurrency || 'inr',
    items: (invoice.items || []).map((item) => ({
      description: item.description,
      detailedDescription: item.detailedDescription || null,
      hsnSac: item.hsnSac,
      quantity: item.quantity,
      rate: item.rate,
      cgstPercent: item.cgstPercent,
      sgstPercent: item.sgstPercent,
      amount: item.amount
    }))
  };
}

function getRecurringBillWithDetails(db, id, workspaceId) {
  const bill = db.prepare(`
    SELECT rb.*,
      c.name as clientName,
      co.name as companyName
    FROM recurring_bills rb
    LEFT JOIN clients c ON rb.clientId = c.id
    LEFT JOIN companies co ON rb.companyId = co.id
    WHERE rb.id = ? AND rb.workspaceId = ?
  `).get(id, workspaceId);

  if (!bill) return null;

  const cycles = db.prepare(`
    SELECT c.*, i.invoiceNumber as generatedInvoiceNumber
    FROM recurring_bill_cycles c
    LEFT JOIN invoices i ON c.generatedInvoiceId = i.id
    WHERE c.recurringBillId = ? AND c.workspaceId = ?
    ORDER BY c.scheduledDate DESC, c.createdAt DESC
  `).all(id, workspaceId);

  let templateSnapshot = null;
  try {
    templateSnapshot = JSON.parse(bill.templateSnapshot);
  } catch {
    templateSnapshot = null;
  }

  return {
    ...bill,
    templateSnapshot,
    cycles
  };
}

function registerRecurringBillRoutes({
  app,
  db,
  getInvoiceWithDetails,
  createInvoiceFromPayload,
  generateNextInvoiceNumber
}) {
  app.get('/api/recurring-bills', (req, res) => {
    try {
      const includeCancelled = req.query.includeCancelled === '1';
      const rows = db.prepare(`
        SELECT rb.*,
          c.name as clientName,
          co.name as companyName,
          (
            SELECT COUNT(*) FROM recurring_bill_cycles c
            WHERE c.recurringBillId = rb.id AND c.status = 'generated'
          ) as generatedCycleCount,
          (
            SELECT c.generatedAt FROM recurring_bill_cycles c
            WHERE c.recurringBillId = rb.id AND c.status = 'generated'
            ORDER BY c.generatedAt DESC LIMIT 1
          ) as lastGeneratedAt
        FROM recurring_bills rb
        LEFT JOIN clients c ON rb.clientId = c.id
        LEFT JOIN companies co ON rb.companyId = co.id
        WHERE rb.workspaceId = ?
          ${includeCancelled ? '' : "AND rb.status != 'cancelled'"}
        ORDER BY rb.nextRunDate ASC, rb.createdAt DESC
      `).all(req.workspaceId);

      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/recurring-bills/:id', (req, res) => {
    try {
      const bill = getRecurringBillWithDetails(db, req.params.id, req.workspaceId);
      if (!bill) {
        return res.status(404).json({ error: 'Recurring bill not found' });
      }
      res.json(bill);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/recurring-bills', (req, res) => {
    try {
      const {
        sourceInvoiceId,
        name,
        amountType,
        frequency,
        startDate,
        endDate,
        dueDateOffsetDays
      } = req.body;

      if (!sourceInvoiceId) {
        return res.status(400).json({ error: 'Source invoice is required' });
      }
      if (!FREQUENCIES.includes(frequency)) {
        return res.status(400).json({ error: 'Invalid billing frequency' });
      }
      const normalizedAmountType = AMOUNT_TYPES.includes(amountType) ? amountType : 'fixed';
      const normalizedStartDate = isoDateOnly(startDate);
      if (!normalizedStartDate) {
        return res.status(400).json({ error: 'Start date is required' });
      }

      const sourceInvoice = getInvoiceWithDetails(sourceInvoiceId, req.workspaceId);
      if (!sourceInvoice) {
        return res.status(404).json({ error: 'Source invoice not found' });
      }
      if (!Array.isArray(sourceInvoice.items) || sourceInvoice.items.length < 1) {
        return res.status(400).json({
          error: 'Source invoice must have at least one line item to create a recurring bill'
        });
      }

      const snapshot = buildTemplateSnapshot(sourceInvoice);
      const offsetDays = dueDateOffsetDays != null
        ? Math.max(0, parseInt(dueDateOffsetDays, 10) || 0)
        : computeDueDateOffsetDays(sourceInvoice);
      const normalizedEndDate = endDate ? isoDateOnly(endDate) : null;
      const profileName = String(name || '').trim()
        || `${sourceInvoice.clientName || 'Client'} — ${FREQUENCY_LABELS[frequency] || frequency}`;

      const id = uuidv4();
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO recurring_bills (
          id, workspaceId, name, sourceInvoiceId, templateSnapshot,
          clientId, companyId, amountType, frequency, startDate, endDate,
          nextRunDate, dueDateOffsetDays, status, autoSend, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, ?, ?)
      `).run(
        id,
        req.workspaceId,
        profileName,
        sourceInvoiceId,
        JSON.stringify(snapshot),
        sourceInvoice.clientId,
        sourceInvoice.companyId || null,
        normalizedAmountType,
        frequency,
        normalizedStartDate,
        normalizedEndDate,
        normalizedStartDate,
        offsetDays,
        now,
        now
      );

      const bill = getRecurringBillWithDetails(db, id, req.workspaceId);
      res.status(201).json(bill);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/recurring-bills/:id', (req, res) => {
    try {
      const existing = db.prepare(
        'SELECT * FROM recurring_bills WHERE id = ? AND workspaceId = ?'
      ).get(req.params.id, req.workspaceId);
      if (!existing) {
        return res.status(404).json({ error: 'Recurring bill not found' });
      }
      if (existing.status === 'cancelled') {
        return res.status(400).json({ error: 'Cancelled recurring bills cannot be updated' });
      }

      const { name, frequency, startDate, endDate, dueDateOffsetDays, status, nextRunDate } = req.body;
      const updates = [];
      const values = [];

      if (name !== undefined) {
        const trimmed = String(name || '').trim();
        if (!trimmed) {
          return res.status(400).json({ error: 'Profile name cannot be empty' });
        }
        updates.push('name = ?');
        values.push(trimmed);
      }
      if (frequency !== undefined) {
        if (!FREQUENCIES.includes(frequency)) {
          return res.status(400).json({ error: 'Invalid billing frequency' });
        }
        updates.push('frequency = ?');
        values.push(frequency);
      }
      if (startDate !== undefined) {
        const normalized = isoDateOnly(startDate);
        if (!normalized) {
          return res.status(400).json({ error: 'Invalid start date' });
        }
        updates.push('startDate = ?');
        values.push(normalized);
      }
      if (endDate !== undefined) {
        updates.push('endDate = ?');
        values.push(endDate ? isoDateOnly(endDate) : null);
      }
      if (dueDateOffsetDays !== undefined) {
        updates.push('dueDateOffsetDays = ?');
        values.push(Math.max(0, parseInt(dueDateOffsetDays, 10) || 0));
      }
      if (nextRunDate !== undefined) {
        const normalized = isoDateOnly(nextRunDate);
        if (!normalized) {
          return res.status(400).json({ error: 'Invalid next run date' });
        }
        updates.push('nextRunDate = ?');
        values.push(normalized);
      }
      if (status !== undefined) {
        if (!PROFILE_STATUSES.includes(status)) {
          return res.status(400).json({ error: 'Invalid status' });
        }
        if (status === 'cancelled') {
          return res.status(400).json({ error: 'Use DELETE to cancel a recurring bill' });
        }
        updates.push('status = ?');
        values.push(status);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      updates.push('updatedAt = ?');
      values.push(new Date().toISOString());
      values.push(req.params.id, req.workspaceId);

      db.prepare(`
        UPDATE recurring_bills SET ${updates.join(', ')}
        WHERE id = ? AND workspaceId = ?
      `).run(...values);

      const bill = getRecurringBillWithDetails(db, req.params.id, req.workspaceId);
      res.json(bill);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/recurring-bills/:id', (req, res) => {
    try {
      const existing = db.prepare(
        'SELECT * FROM recurring_bills WHERE id = ? AND workspaceId = ?'
      ).get(req.params.id, req.workspaceId);
      if (!existing) {
        return res.status(404).json({ error: 'Recurring bill not found' });
      }

      db.prepare(`
        UPDATE recurring_bills SET status = 'cancelled', updatedAt = ?
        WHERE id = ? AND workspaceId = ?
      `).run(new Date().toISOString(), req.params.id, req.workspaceId);

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/recurring-bills/:id/generate', (req, res) => {
    try {
      const bill = db.prepare(
        'SELECT * FROM recurring_bills WHERE id = ? AND workspaceId = ?'
      ).get(req.params.id, req.workspaceId);
      if (!bill) {
        return res.status(404).json({ error: 'Recurring bill not found' });
      }
      if (bill.status !== 'active') {
        return res.status(400).json({
          error: bill.status === 'paused'
            ? 'Resume this recurring bill before generating an invoice'
            : 'This recurring bill is not active'
        });
      }

      const scheduledDate = isoDateOnly(bill.nextRunDate);
      if (!scheduledDate) {
        return res.status(400).json({ error: 'Next run date is not set' });
      }

      if (bill.endDate && scheduledDate > isoDateOnly(bill.endDate)) {
        db.prepare(`
          UPDATE recurring_bills SET status = 'completed', updatedAt = ?
          WHERE id = ? AND workspaceId = ?
        `).run(new Date().toISOString(), bill.id, req.workspaceId);
        return res.status(400).json({ error: 'This recurring bill has reached its end date' });
      }

      let snapshot;
      try {
        snapshot = JSON.parse(bill.templateSnapshot);
      } catch {
        return res.status(500).json({ error: 'Invalid template snapshot for this recurring bill' });
      }
      if (!Array.isArray(snapshot.items) || snapshot.items.length < 1) {
        return res.status(400).json({ error: 'Template has no line items' });
      }

      const invoiceNumber = generateNextInvoiceNumber(req.workspaceId);
      const invoiceDate = scheduledDate;
      const dueDate = addDays(invoiceDate, bill.dueDateOffsetDays);

      const invoiceId = createInvoiceFromPayload(req.workspaceId, {
        invoiceNumber,
        clientId: bill.clientId,
        companyId: bill.companyId,
        invoiceDate,
        dueDate,
        placeOfSupply: snapshot.placeOfSupply,
        bankName: snapshot.bankName,
        bankBranch: snapshot.bankBranch,
        bankAccount: snapshot.bankAccount,
        ifsc: snapshot.ifsc,
        items: snapshot.items,
        subtotal: snapshot.subtotal,
        cgst: snapshot.cgst,
        sgst: snapshot.sgst,
        igst: snapshot.igst,
        taxType: snapshot.taxType,
        total: snapshot.total,
        status: 'draft',
        signatureTitle: snapshot.signatureTitle,
        amountInWordsCurrency: snapshot.amountInWordsCurrency
      });

      const cycleId = uuidv4();
      const now = new Date().toISOString();
      const nextRunDate = addFrequency(scheduledDate, bill.frequency);
      const isCompleted = bill.endDate && nextRunDate > isoDateOnly(bill.endDate);

      const tx = db.transaction(() => {
        db.prepare(`
          INSERT INTO recurring_bill_cycles (
            id, recurringBillId, workspaceId, scheduledDate, status,
            generatedInvoiceId, generatedAt, createdAt
          ) VALUES (?, ?, ?, ?, 'generated', ?, ?, ?)
        `).run(cycleId, bill.id, req.workspaceId, scheduledDate, invoiceId, now, now);

        db.prepare(`
          UPDATE recurring_bills
          SET nextRunDate = ?, status = ?, updatedAt = ?
          WHERE id = ? AND workspaceId = ?
        `).run(
          nextRunDate,
          isCompleted ? 'completed' : bill.status,
          now,
          bill.id,
          req.workspaceId
        );
      });
      tx();

      const invoice = getInvoiceWithDetails(invoiceId, req.workspaceId);
      const cycle = db.prepare(`
        SELECT c.*, i.invoiceNumber as generatedInvoiceNumber
        FROM recurring_bill_cycles c
        LEFT JOIN invoices i ON c.generatedInvoiceId = i.id
        WHERE c.id = ?
      `).get(cycleId);

      res.status(201).json({ cycle, invoice });
    } catch (error) {
      if (error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({ error: 'Invoice number already exists for this company' });
      }
      res.status(500).json({ error: error.message });
    }
  });
}

module.exports = {
  initRecurringBillTables,
  registerRecurringBillRoutes,
  FREQUENCIES,
  FREQUENCY_LABELS,
  AMOUNT_TYPES
};
