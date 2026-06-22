const { v4: uuidv4 } = require('uuid');
const {
  hashPassword,
  normalizeWorkspaceSlug,
  validatePassword
} = require('./auth');

const DEFAULT_DISPLAY_NAME = 'R Bhargava & Associates';

function migrateWorkspaces(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      displayName TEXT NOT NULL,
      passwordHash TEXT NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  for (const table of ['companies', 'clients', 'invoices']) {
    try {
      db.prepare(`ALTER TABLE ${table} ADD COLUMN workspaceId TEXT`).run();
    } catch (_) {}
  }

  const slug = normalizeWorkspaceSlug(process.env.DEFAULT_WORKSPACE_SLUG || 'rbhargava');
  const displayName =
    String(process.env.DEFAULT_WORKSPACE_DISPLAY_NAME || '').trim() || DEFAULT_DISPLAY_NAME;

  let workspace = db.prepare('SELECT * FROM workspaces WHERE slug = ?').get(slug);

  if (!workspace) {
    const password = String(process.env.DEFAULT_WORKSPACE_PASSWORD || '').trim();
    if (!password) {
      console.warn(
        '[workspaces] DEFAULT_WORKSPACE_PASSWORD not set; default workspace password is "changeme" — change it after first login setup.'
      );
    }
    const id = uuidv4();
    const passwordHash = hashPassword(password || 'changeme');
    db.prepare(`
      INSERT INTO workspaces (id, slug, displayName, passwordHash)
      VALUES (?, ?, ?, ?)
    `).run(id, slug, displayName, passwordHash);
    workspace = db.prepare('SELECT * FROM workspaces WHERE slug = ?').get(slug);
    console.log(`[workspaces] Created default workspace "${slug}" (${displayName})`);
  }

  const workspaceId = workspace.id;

  db.prepare('UPDATE companies SET workspaceId = ? WHERE workspaceId IS NULL').run(workspaceId);
  db.prepare('UPDATE clients SET workspaceId = ? WHERE workspaceId IS NULL').run(workspaceId);
  db.prepare('UPDATE invoices SET workspaceId = ? WHERE workspaceId IS NULL').run(workspaceId);

  try {
    db.exec('DROP INDEX IF EXISTS idx_invoices_company_invoice_unique');
  } catch (_) {}

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_workspace_company_invoice_unique
    ON invoices (workspaceId, COALESCE(companyId, ''), invoiceNumber);
  `);

  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_companies_workspace ON companies (workspaceId)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_clients_workspace ON clients (workspaceId)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_invoices_workspace ON invoices (workspaceId)');
  } catch (e) {
    console.warn('Workspace index setup:', e.message);
  }

  return workspace;
}

function migrateEmailDb(emailDb, defaultWorkspaceId) {
  const cols = emailDb.prepare('PRAGMA table_info(email_settings)').all();
  const hasWorkspaceId = cols.some((c) => c.name === 'workspaceId');

  if (hasWorkspaceId) {
    return;
  }

  const oldRow = emailDb.prepare('SELECT * FROM email_settings WHERE id = 1').get();

  emailDb.exec(`
    CREATE TABLE email_settings_new (
      workspaceId TEXT PRIMARY KEY,
      defaultSubjectTemplate TEXT NOT NULL,
      defaultBodyTemplate TEXT NOT NULL,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const { DEFAULT_SUBJECT_TEMPLATE, DEFAULT_BODY_TEMPLATE } = require('./email');

  if (oldRow) {
    emailDb.prepare(`
      INSERT INTO email_settings_new (workspaceId, defaultSubjectTemplate, defaultBodyTemplate, updatedAt)
      VALUES (?, ?, ?, ?)
    `).run(
      defaultWorkspaceId,
      oldRow.defaultSubjectTemplate,
      oldRow.defaultBodyTemplate,
      oldRow.updatedAt || new Date().toISOString()
    );
  } else {
    emailDb.prepare(`
      INSERT INTO email_settings_new (workspaceId, defaultSubjectTemplate, defaultBodyTemplate)
      VALUES (?, ?, ?)
    `).run(defaultWorkspaceId, DEFAULT_SUBJECT_TEMPLATE, DEFAULT_BODY_TEMPLATE);
  }

  emailDb.exec('DROP TABLE email_settings');
  emailDb.exec('ALTER TABLE email_settings_new RENAME TO email_settings');
}

function createWorkspace(db, { slug, displayName, password }) {
  const normalizedSlug = normalizeWorkspaceSlug(slug);
  if (!normalizedSlug) {
    throw new Error('Workspace name is required (letters, numbers, hyphens only)');
  }
  const pwdError = validatePassword(password);
  if (pwdError) {
    throw new Error(pwdError);
  }
  const name = String(displayName || '').trim();
  if (!name) {
    throw new Error('Display name is required');
  }

  const existing = db.prepare('SELECT id FROM workspaces WHERE slug = ?').get(normalizedSlug);
  if (existing) {
    throw new Error(`Workspace "${normalizedSlug}" already exists`);
  }

  const id = uuidv4();
  const passwordHash = hashPassword(password);
  db.prepare(`
    INSERT INTO workspaces (id, slug, displayName, passwordHash)
    VALUES (?, ?, ?, ?)
  `).run(id, normalizedSlug, name, passwordHash);

  return db.prepare('SELECT id, slug, displayName, createdAt FROM workspaces WHERE id = ?').get(id);
}

function findWorkspaceBySlug(db, slug) {
  const normalizedSlug = normalizeWorkspaceSlug(slug);
  if (!normalizedSlug) return null;
  return db.prepare('SELECT * FROM workspaces WHERE slug = ?').get(normalizedSlug);
}

function getWorkspaceById(db, workspaceId) {
  return db
    .prepare('SELECT id, slug, displayName, createdAt FROM workspaces WHERE id = ?')
    .get(workspaceId);
}

function updateWorkspacePassword(db, { slug, password }) {
  const normalizedSlug = normalizeWorkspaceSlug(slug);
  if (!normalizedSlug) {
    throw new Error('Workspace name is required');
  }
  const pwdError = validatePassword(password);
  if (pwdError) {
    throw new Error(pwdError);
  }
  const workspace = db.prepare('SELECT id, slug FROM workspaces WHERE slug = ?').get(normalizedSlug);
  if (!workspace) {
    throw new Error(`Workspace "${normalizedSlug}" not found`);
  }
  const passwordHash = hashPassword(password);
  db.prepare('UPDATE workspaces SET passwordHash = ? WHERE id = ?').run(passwordHash, workspace.id);
  return db
    .prepare('SELECT id, slug, displayName, createdAt FROM workspaces WHERE id = ?')
    .get(workspace.id);
}

module.exports = {
  migrateWorkspaces,
  migrateEmailDb,
  createWorkspace,
  findWorkspaceBySlug,
  getWorkspaceById,
  updateWorkspacePassword
};
