const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');

const {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  normalizeWorkspaceSlug,
  validatePassword
} = require('./auth');
const { createWorkspace, findWorkspaceBySlug } = require('./workspaces');

test('normalizeWorkspaceSlug lowercases and sanitizes', () => {
  assert.equal(normalizeWorkspaceSlug('  Acme Corp! '), 'acme-corp');
  assert.equal(normalizeWorkspaceSlug('rbhargava'), 'rbhargava');
});

test('validatePassword enforces minimum length', () => {
  assert.equal(validatePassword('short'), 'Password must be at least 8 characters');
  assert.equal(validatePassword('longenough'), null);
});

test('password hash and verify', () => {
  const hash = hashPassword('test-password-123');
  assert.ok(verifyPassword('test-password-123', hash));
  assert.equal(verifyPassword('wrong', hash), false);
});

test('JWT sign and verify', () => {
  process.env.JWT_SECRET = 'test-secret-for-jwt';
  const token = signToken({ workspaceId: 'ws-1', slug: 'acme' });
  const payload = verifyToken(token);
  assert.equal(payload.workspaceId, 'ws-1');
  assert.equal(payload.slug, 'acme');
});

test('createWorkspace rejects duplicate slug', () => {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE workspaces (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      displayName TEXT NOT NULL,
      passwordHash TEXT NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  const slug = `test-${uuidv4().slice(0, 8)}`;
  createWorkspace(db, { slug, displayName: 'Test Co', password: 'password123' });
  assert.throws(
    () => createWorkspace(db, { slug, displayName: 'Other', password: 'password456' }),
    /already exists/
  );
  const found = findWorkspaceBySlug(db, slug);
  assert.equal(found.slug, slug);
  db.close();
});
