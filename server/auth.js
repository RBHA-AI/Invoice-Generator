const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_EXPIRES_IN = '7d';
const MIN_PASSWORD_LENGTH = 8;

function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || '').trim();
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is required in production');
    }
    return 'dev-insecure-jwt-secret-change-me';
  }
  return secret;
}

function hashPassword(password) {
  return bcrypt.hashSync(String(password), 10);
}

function verifyPassword(password, passwordHash) {
  return bcrypt.compareSync(String(password), String(passwordHash));
}

function signToken({ workspaceId, slug }) {
  return jwt.sign({ workspaceId, slug }, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

function normalizeWorkspaceSlug(slug) {
  return String(slug || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function validatePassword(password) {
  const p = String(password || '');
  if (p.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  return null;
}

function requireAuth(req, res, next) {
  const header = String(req.headers.authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const payload = verifyToken(match[1]);
    if (!payload?.workspaceId) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.workspaceId = payload.workspaceId;
    req.workspaceSlug = payload.slug;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  const secret = String(process.env.ADMIN_SECRET || '').trim();
  if (!secret) {
    return res.status(503).json({ error: 'Admin provisioning is not configured (ADMIN_SECRET)' });
  }
  const provided = String(req.headers['x-admin-secret'] || '').trim();
  if (!provided || provided !== secret) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  normalizeWorkspaceSlug,
  validatePassword,
  requireAuth,
  requireAdmin,
  MIN_PASSWORD_LENGTH
};
