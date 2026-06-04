const multer = require('multer');
const nodemailer = require('nodemailer');
const path = require('path');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const { parseLlmJson, callOpenAIChatCompletions, getOpenAIConfig } = require('./openai');

const DEFAULT_SUBJECT_TEMPLATE = 'Invoice {{invoiceNumber}} from {{companyName}}';
const DEFAULT_BODY_TEMPLATE = `Dear {{clientName}},

Please find attached invoice {{invoiceNumber}} dated {{invoiceDate}} for ₹{{total}}.
Payment is due by {{dueDate}}.

{{customMessage}}

Regards,
{{companyName}}`;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF attachments are allowed'));
    }
  }
});

function isValidEmail(email) {
  return EMAIL_REGEX.test(String(email || '').trim());
}

function formatDateEnGb(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB');
  } catch {
    return String(dateStr);
  }
}

function formatCurrencyInr(amount) {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0);
}

function renderTemplate(template, vars) {
  return String(template || '').replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = vars[key];
    return val != null ? String(val) : '';
  });
}

function buildTemplateVars(invoice, extra = {}) {
  return {
    invoiceNumber: invoice.invoiceNumber || '',
    clientName: invoice.clientName || invoice.primaryContactName || 'Client',
    companyName: invoice.companyName || 'Our Company',
    invoiceDate: formatDateEnGb(invoice.invoiceDate),
    dueDate: formatDateEnGb(invoice.dueDate),
    total: formatCurrencyInr(invoice.total),
    customMessage: extra.customMessage || '',
    ...extra
  };
}

function getEmailSettings(db) {
  let row = db.prepare('SELECT * FROM email_settings WHERE id = 1').get();
  if (!row) {
    db.prepare(`
      INSERT INTO email_settings (id, defaultSubjectTemplate, defaultBodyTemplate, updatedAt)
      VALUES (1, ?, ?, CURRENT_TIMESTAMP)
    `).run(DEFAULT_SUBJECT_TEMPLATE, DEFAULT_BODY_TEMPLATE);
    row = db.prepare('SELECT * FROM email_settings WHERE id = 1').get();
  }
  return row;
}

function getResendConfig() {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const mailFrom = String(process.env.MAIL_FROM || '').trim();
  const fromName = String(process.env.MAIL_FROM_NAME || '').trim();
  return { apiKey, mailFrom, fromName, configured: apiKey.length > 0 };
}

function getSmtpConfig() {
  const host = String(process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || '0') === '1';
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();
  const fromName = String(process.env.MAIL_FROM_NAME || '').trim();
  return { host, port, secure, user, pass, fromName, configured: !!(host && user && pass) };
}

function getEmailProviderConfig() {
  const resend = getResendConfig();
  const smtp = getSmtpConfig();
  const explicit = String(process.env.EMAIL_PROVIDER || 'auto').trim().toLowerCase();

  let provider = explicit;
  if (provider === 'auto') {
    if (resend.configured) provider = 'resend';
    else if (smtp.configured) provider = 'smtp';
    else provider = 'none';
  }

  const configured =
    provider === 'resend' ? resend.configured : provider === 'smtp' ? smtp.configured : false;

  return { provider, configured, resend, smtp };
}

function formatFromHeader(fromName, fromEmail) {
  if (fromName) return `${fromName} <${fromEmail}>`;
  return fromEmail;
}

function createSmtpTransport() {
  const cfg = getSmtpConfig();
  if (!cfg.configured) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS in .env');
  }
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass }
  });
}

async function sendViaSmtp({ fromEmail, to, cc, subject, body, pdfBuffer, filename }) {
  const transport = createSmtpTransport();
  const cfg = getSmtpConfig();
  const fromAddress = fromEmail || cfg.user;
  const fromHeader = formatFromHeader(cfg.fromName, fromAddress);

  await transport.sendMail({
    from: fromHeader,
    replyTo: fromAddress,
    to,
    cc: cc || undefined,
    subject,
    text: body,
    attachments: [
      {
        filename: filename || 'invoice.pdf',
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  });
}

async function sendViaResend({ fromEmail, to, cc, subject, body, pdfBuffer, filename }) {
  const cfg = getResendConfig();
  if (!cfg.configured) {
    throw new Error('Resend is not configured. Set RESEND_API_KEY in .env');
  }

  const fromAddress = fromEmail || cfg.mailFrom;
  if (!fromAddress || !isValidEmail(fromAddress)) {
    throw new Error(
      'Valid from email is required. Set MAIL_FROM in .env or enter a sender address in the form.'
    );
  }

  const payload = {
    from: formatFromHeader(cfg.fromName, fromAddress),
    to: [to],
    subject,
    text: body,
    reply_to: fromAddress,
    attachments: [
      {
        filename: filename || 'invoice.pdf',
        content: pdfBuffer.toString('base64')
      }
    ]
  };

  if (cc) {
    payload.cc = cc
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
  }

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    let message = `Resend API error (${resp.status})`;
    try {
      const data = await resp.json();
      if (data?.message) message = data.message;
    } catch (_) {}
    throw new Error(message);
  }
}

async function sendInvoiceEmail({ fromEmail, to, cc, subject, body, pdfBuffer, filename }) {
  const { provider } = getEmailProviderConfig();
  if (provider === 'resend') {
    return sendViaResend({ fromEmail, to, cc, subject, body, pdfBuffer, filename });
  }
  if (provider === 'smtp') {
    return sendViaSmtp({ fromEmail, to, cc, subject, body, pdfBuffer, filename });
  }
  throw new Error(
    'Email is not configured. Set RESEND_API_KEY (recommended) or SMTP settings in .env'
  );
}

function buildDraftFromTemplate(invoice, settings, extra = {}) {
  const vars = buildTemplateVars(invoice, extra);
  let body = renderTemplate(settings.defaultBodyTemplate, vars);
  const custom = String(extra.customMessage || '').trim();
  if (custom && !body.includes(custom)) {
    body = `${body.trim()}\n\n${custom}`;
  }
  return {
    subject: renderTemplate(settings.defaultSubjectTemplate, vars),
    body: body.replace(/\n{3,}/g, '\n\n').trim()
  };
}

async function generateEmailDraftWithAI({ invoice, settings, userPrompt, tone }) {
  const vars = buildTemplateVars(invoice);
  const templateDraft = buildDraftFromTemplate(invoice, settings, {
    customMessage: userPrompt || ''
  });
  const { apiKey, model, baseUrl } = getOpenAIConfig();
  const timeoutMs = Math.min(
    20000,
    Math.max(5000, Number(process.env.EMAIL_LLM_TIMEOUT_MS || process.env.HSN_SAC_LLM_TIMEOUT_MS || 12000))
  );

  if (!apiKey) {
    return {
      ...templateDraft,
      used: 'template-only',
      hint: userPrompt
        ? 'OPENAI_API_KEY not loaded on the server. Your note was added to the default template — restart npm run dev after editing .env.'
        : 'OPENAI_API_KEY not loaded on the server. Add it to .env in the project root and restart npm run dev.'
    };
  }

  const prompt = [
    'Write a professional invoice email for an Indian CA/accounting firm.',
    'Use the exact invoice amounts and dates provided — do not invent or change numbers.',
    'Return JSON only: {"subject":"string","body":"string"}',
    'The body should be plain text (no HTML). Keep it concise and professional.',
    tone ? `Tone: ${tone}` : 'Tone: professional',
    '',
    'Invoice context:',
    `- Invoice number: ${vars.invoiceNumber}`,
    `- Invoice date: ${vars.invoiceDate}`,
    `- Due date: ${vars.dueDate}`,
    `- Total: ₹${vars.total}`,
    `- Client: ${vars.clientName}`,
    `- Company: ${vars.companyName}`,
    '',
    'Default subject template (use as starting point):',
    settings.defaultSubjectTemplate,
    '',
    'Default body template (use as starting point):',
    settings.defaultBodyTemplate,
    '',
    'Rendered default subject:',
    templateDraft.subject,
    '',
    'Rendered default body:',
    templateDraft.body,
    '',
    userPrompt ? `User instructions: ${userPrompt}` : 'User instructions: none — polish the default template.'
  ].join('\n');

  try {
    const content = await callOpenAIChatCompletions({
      apiKey,
      baseUrl,
      model,
      prompt,
      timeoutMs,
      temperature: 0.3,
      systemContent: 'You write professional business emails for Indian accounting firms. Return only valid JSON.'
    });
    const parsed = parseLlmJson(content);
    const subject = String(parsed?.subject || templateDraft.subject).trim();
    const body = String(parsed?.body || templateDraft.body).trim();
    if (!subject || !body) {
      return { ...templateDraft, used: 'template-only', hint: 'AI returned empty draft; using template.' };
    }
    return { subject, body, used: 'llm' };
  } catch (err) {
    return {
      ...templateDraft,
      used: 'template-only',
      hint: `AI generation failed: ${err.message}. Using default template.`
    };
  }
}

function registerEmailRoutes({ app, emailDb, getInvoiceWithDetails }) {
  app.get('/api/email/status', (req, res) => {
    try {
      const email = getEmailProviderConfig();
      const { apiKey, model } = getOpenAIConfig();
      res.json({
        configured: email.configured,
        provider: email.provider,
        smtpConfigured: email.configured,
        openaiConfigured: apiKey.length > 0,
        model
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/email-settings', (req, res) => {
    try {
      const settings = getEmailSettings(emailDb);
      res.json({
        defaultSubjectTemplate: settings.defaultSubjectTemplate,
        defaultBodyTemplate: settings.defaultBodyTemplate,
        updatedAt: settings.updatedAt
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/email-settings', (req, res) => {
    try {
      const subject = String(req.body?.defaultSubjectTemplate || '').trim();
      const body = String(req.body?.defaultBodyTemplate || '').trim();
      if (!subject || !body) {
        return res.status(400).json({ error: 'defaultSubjectTemplate and defaultBodyTemplate are required' });
      }
      emailDb.prepare(`
        UPDATE email_settings
        SET defaultSubjectTemplate = ?, defaultBodyTemplate = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE id = 1
      `).run(subject, body);
      const settings = getEmailSettings(emailDb);
      res.json({
        defaultSubjectTemplate: settings.defaultSubjectTemplate,
        defaultBodyTemplate: settings.defaultBodyTemplate,
        updatedAt: settings.updatedAt
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/invoices/:id/email-history', (req, res) => {
    try {
      const rows = emailDb.prepare(`
        SELECT id, invoiceId, sentAt, toEmail, cc, fromEmail, subject, status, errorMessage
        FROM invoice_emails
        WHERE invoiceId = ?
        ORDER BY sentAt DESC
        LIMIT 20
      `).all(req.params.id);
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/invoices/:id/generate-email-draft', async (req, res) => {
    try {
      const invoice = getInvoiceWithDetails(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      const settings = getEmailSettings(emailDb);
      const userPrompt = String(req.body?.userPrompt || '').trim();
      const tone = String(req.body?.tone || 'professional').trim();
      const draft = await generateEmailDraftWithAI({ invoice, settings, userPrompt, tone });
      res.json(draft);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/invoices/:id/render-email-template', (req, res) => {
    try {
      const invoice = getInvoiceWithDetails(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      const settings = getEmailSettings(emailDb);
      const draft = buildDraftFromTemplate(invoice, settings);
      res.json(draft);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/invoices/:id/send-email', (req, res) => {
    pdfUpload.single('pdf')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      const logId = uuidv4();
      const invoiceId = req.params.id;

      try {
        const invoice = getInvoiceWithDetails(invoiceId);
        if (!invoice) {
          return res.status(404).json({ error: 'Invoice not found' });
        }

        const emailCfg = getEmailProviderConfig();
        if (!emailCfg.configured) {
          return res.status(503).json({
            error:
              'Email is not configured. Add RESEND_API_KEY to .env (recommended) or SMTP settings, then restart the server.'
          });
        }

        const fromEmail = String(req.body?.fromEmail || '').trim();
        const to = String(req.body?.to || '').trim();
        const cc = String(req.body?.cc || '').trim();
        const subject = String(req.body?.subject || '').trim();
        const body = String(req.body?.body || '').trim();

        if (!fromEmail || !isValidEmail(fromEmail)) {
          return res.status(400).json({ error: 'Valid fromEmail is required' });
        }
        if (!to || !isValidEmail(to)) {
          return res.status(400).json({ error: 'Valid to address is required' });
        }
        if (cc && !cc.split(',').every((e) => isValidEmail(e.trim()))) {
          return res.status(400).json({ error: 'Invalid CC address(es)' });
        }
        if (!subject) {
          return res.status(400).json({ error: 'Subject is required' });
        }
        if (!body) {
          return res.status(400).json({ error: 'Body is required' });
        }
        if (!req.file || !req.file.buffer) {
          return res.status(400).json({ error: 'PDF attachment is required' });
        }

        const safeInvoiceNumber = String(invoice.invoiceNumber).replace(/[^\w-]+/g, '-');
        const filename = `invoice-${safeInvoiceNumber}.pdf`;

        await sendInvoiceEmail({
          fromEmail,
          to,
          cc: cc || undefined,
          subject,
          body,
          pdfBuffer: req.file.buffer,
          filename
        });

        emailDb.prepare(`
          INSERT INTO invoice_emails (id, invoiceId, sentAt, toEmail, cc, fromEmail, subject, status, errorMessage)
          VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, 'sent', NULL)
        `).run(logId, invoiceId, to, cc || null, fromEmail, subject);

        res.json({ success: true, message: 'Email sent successfully', id: logId });
      } catch (error) {
        try {
          emailDb.prepare(`
            INSERT INTO invoice_emails (id, invoiceId, sentAt, toEmail, cc, fromEmail, subject, status, errorMessage)
            VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, 'failed', ?)
          `).run(
            logId,
            invoiceId,
            String(req.body?.to || ''),
            String(req.body?.cc || '') || null,
            String(req.body?.fromEmail || ''),
            String(req.body?.subject || ''),
            error.message
          );
        } catch (_) {}
        res.status(500).json({ error: error.message });
      }
    });
  });
}

function initEmailTables(emailDbPath) {
  const emailDb = new Database(emailDbPath);
  emailDb.exec(`
    CREATE TABLE IF NOT EXISTS email_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      defaultSubjectTemplate TEXT NOT NULL,
      defaultBodyTemplate TEXT NOT NULL,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS invoice_emails (
      id TEXT PRIMARY KEY,
      invoiceId TEXT NOT NULL,
      sentAt TEXT NOT NULL,
      toEmail TEXT NOT NULL,
      cc TEXT,
      fromEmail TEXT NOT NULL,
      subject TEXT NOT NULL,
      status TEXT NOT NULL,
      errorMessage TEXT
    );
  `);

  try {
    emailDb.exec('CREATE INDEX IF NOT EXISTS idx_invoice_emails_invoice ON invoice_emails (invoiceId)');
  } catch (e) {
    console.warn('invoice_emails index setup:', e.message);
  }

  getEmailSettings(emailDb);
  return emailDb;
}

function createEmailDb(projectRoot) {
  const emailDbPath =
    process.env.EMAIL_DB_PATH || path.join(projectRoot, 'email.db');
  return initEmailTables(emailDbPath);
}

module.exports = {
  registerEmailRoutes,
  createEmailDb,
  initEmailTables,
  renderTemplate,
  buildTemplateVars,
  buildDraftFromTemplate,
  getEmailProviderConfig,
  getResendConfig,
  getSmtpConfig,
  sendViaResend,
  DEFAULT_SUBJECT_TEMPLATE,
  DEFAULT_BODY_TEMPLATE
};
