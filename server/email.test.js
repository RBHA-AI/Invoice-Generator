const test = require('node:test');
const assert = require('node:assert/strict');

const { getEmailProviderConfig, renderTemplate, buildDraftFromTemplate } = require('./email');

test('getEmailProviderConfig prefers resend when RESEND_API_KEY is set', () => {
  const prev = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER
  };

  process.env.RESEND_API_KEY = 're_test_key';
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_USER = 'user@example.com';
  process.env.SMTP_PASS = 'secret';
  process.env.EMAIL_PROVIDER = 'auto';

  const cfg = getEmailProviderConfig();
  assert.equal(cfg.provider, 'resend');
  assert.equal(cfg.configured, true);

  Object.assign(process.env, prev);
});

test('renderTemplate replaces placeholders', () => {
  const out = renderTemplate('Invoice {{invoiceNumber}} for {{clientName}}', {
    invoiceNumber: 'DL/01',
    clientName: 'Acme'
  });
  assert.equal(out, 'Invoice DL/01 for Acme');
});

test('buildDraftFromTemplate appends user prompt as custom message', () => {
  const invoice = {
    invoiceNumber: 'INV-1',
    clientName: 'Acme',
    companyName: 'RB',
    invoiceDate: '2026-05-01',
    dueDate: '2026-05-15',
    total: 1000
  };
  const settings = {
    defaultSubjectTemplate: 'Invoice {{invoiceNumber}}',
    defaultBodyTemplate: 'Dear {{clientName}}, total {{total}}. {{customMessage}} Thanks.'
  };
  const draft = buildDraftFromTemplate(invoice, settings, {
    customMessage: 'Please pay audit charges promptly.'
  });
  assert.match(draft.body, /audit charges/);
  assert.match(draft.body, /Acme/);
});
