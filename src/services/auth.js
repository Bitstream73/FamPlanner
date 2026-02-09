import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import database from '../config/database.js';
import logger from './logger.js';

const PASSWORD_ROUNDS = 12;
const CODE_ROUNDS = 10;
const SESSION_TTL_DAYS = 7;
const CODE_TTL_MINUTES = 10;

async function hashPassword(plain) {
  return bcrypt.hash(plain, PASSWORD_ROUNDS);
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function generateTwoFactorCode() {
  return crypto.randomInt(100000, 999999).toString();
}

async function hashCode(code) {
  return bcrypt.hash(code, CODE_ROUNDS);
}

async function verifyCode(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function createSession(userId) {
  const id = uuidv4();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_DAYS * 24 * 60 * 60;
  database.db.prepare(
    'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
  ).run(id, userId, expiresAt);

  logger.info('auth', 'session_created', { userId });
  return id;
}

function getSessionUser(sessionId) {
  if (!sessionId) return null;

  const now = Math.floor(Date.now() / 1000);
  const row = database.db.prepare(`
    SELECT u.id, u.email, u.display_name AS displayName
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ? AND s.expires_at > ?
  `).get(sessionId, now);

  return row || null;
}

function deleteSession(sessionId) {
  database.db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

function cleanExpiredSessions() {
  const now = Math.floor(Date.now() / 1000);
  const result = database.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
  if (result.changes > 0) {
    logger.info('auth', 'expired_sessions_cleaned', { count: result.changes });
  }
}

function cleanExpiredCodes() {
  const now = Math.floor(Date.now() / 1000);
  const result = database.db.prepare('DELETE FROM two_factor_codes WHERE expires_at <= ?').run(now);
  if (result.changes > 0) {
    logger.info('auth', 'expired_codes_cleaned', { count: result.changes });
  }
}

function findUserByEmail(email) {
  return database.db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
}

function createUser(email, passwordHash, displayName) {
  const result = database.db.prepare(
    'INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)'
  ).run(email.toLowerCase().trim(), passwordHash, displayName || null);

  logger.info('auth', 'register', { email: email.toLowerCase().trim() });
  return result.lastInsertRowid;
}

function storeTwoFactorCode(userId, hashedCode) {
  const expiresAt = Math.floor(Date.now() / 1000) + CODE_TTL_MINUTES * 60;

  // Invalidate previous unused codes
  database.db.prepare(
    'UPDATE two_factor_codes SET used = 1 WHERE user_id = ? AND used = 0'
  ).run(userId);

  database.db.prepare(
    'INSERT INTO two_factor_codes (user_id, code, expires_at) VALUES (?, ?, ?)'
  ).run(userId, hashedCode, expiresAt);
}

function getLatestUnusedCode(userId) {
  const now = Math.floor(Date.now() / 1000);
  return database.db.prepare(`
    SELECT * FROM two_factor_codes
    WHERE user_id = ? AND used = 0 AND expires_at > ?
    ORDER BY created_at DESC LIMIT 1
  `).get(userId, now);
}

function markCodeUsed(codeId) {
  database.db.prepare('UPDATE two_factor_codes SET used = 1 WHERE id = ?').run(codeId);
}

function markUserVerified(userId) {
  database.db.prepare(
    'UPDATE users SET is_verified = 1, updated_at = unixepoch() WHERE id = ?'
  ).run(userId);
}

export default {
  hashPassword,
  verifyPassword,
  generateTwoFactorCode,
  hashCode,
  verifyCode,
  createSession,
  getSessionUser,
  deleteSession,
  cleanExpiredSessions,
  cleanExpiredCodes,
  findUserByEmail,
  createUser,
  storeTwoFactorCode,
  getLatestUnusedCode,
  markCodeUsed,
  markUserVerified,
};
