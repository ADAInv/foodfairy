// Admin auth. scrypt password hashing, opaque session tokens (only their
// SHA-256 hash is stored), double-submit CSRF tokens for every mutating
// admin request.

import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { get, run } from '../db.js';
import { HttpError, setCookie, clearCookie, type Handler, type Req, type Res } from '../http.js';

export const SESSION_COOKIE = 'ff_admin';
export const CSRF_COOKIE = 'ff_csrf';
const SESSION_TTL_S = 14 * 24 * 60 * 60;

export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = randomBytes(16).toString('hex');
  return { salt, hash: scryptSync(password, salt, 64).toString('hex') };
}

export function verifyPassword(password: string, salt: string, expected: string): boolean {
  const hash = scryptSync(password, salt, 64);
  const exp = Buffer.from(expected, 'hex');
  return hash.length === exp.length && timingSafeEqual(hash, exp);
}

// Used when the email doesn't exist, so response time doesn't reveal it.
const DUMMY = hashPassword(randomBytes(12).toString('hex'));
export function verifyDummy(password: string): void {
  verifyPassword(password, DUMMY.salt, DUMMY.hash);
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function startSession(res: Res, adminId: number): void {
  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_TTL_S * 1000).toISOString();
  run('DELETE FROM sessions WHERE expires_at < ?', [new Date().toISOString()]);
  run('INSERT INTO sessions (token_hash, admin_id, expires_at) VALUES (?, ?, ?)', [sha256(token), adminId, expires]);
  setCookie(res, SESSION_COOKIE, token, { maxAge: SESSION_TTL_S });
  issueCsrf(res);
}

export function endSession(req: Req, res: Res): void {
  const token = req.cookies[SESSION_COOKIE];
  if (token) run('DELETE FROM sessions WHERE token_hash = ?', [sha256(token)]);
  clearCookie(res, SESSION_COOKIE);
  clearCookie(res, CSRF_COOKIE, { httpOnly: false });
}

export function issueCsrf(res: Res): string {
  const token = randomBytes(24).toString('hex');
  // Readable by JS on purpose: the admin UI echoes it back in X-CSRF-Token.
  setCookie(res, CSRF_COOKIE, token, { httpOnly: false, maxAge: SESSION_TTL_S });
  return token;
}

export function sessionAdmin(req: Req): { id: number; email: string } | null {
  const token = req.cookies[SESSION_COOKIE];
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const row = get<{ id: number; email: string; expires_at: string }>(
    `SELECT a.id, a.email, s.expires_at FROM sessions s JOIN admins a ON a.id = s.admin_id WHERE s.token_hash = ?`,
    [sha256(token)]
  );
  if (!row) return null;
  if (Date.parse(row.expires_at) < Date.now()) {
    run('DELETE FROM sessions WHERE token_hash = ?', [sha256(token)]);
    return null;
  }
  return { id: row.id, email: row.email };
}

/** Wrap an admin handler: requires a session, and CSRF for non-GET. */
export function requireAdmin(handler: Handler): Handler {
  return (req, res, params) => {
    const admin = sessionAdmin(req);
    if (!admin) throw new HttpError(401, 'Not signed in');
    if (req.method !== 'GET') {
      const header = String(req.headers['x-csrf-token'] ?? '');
      const cookie = req.cookies[CSRF_COOKIE] ?? '';
      if (!header || !cookie || !safeEqual(header, cookie)) throw new HttpError(403, 'Invalid CSRF token');
    }
    req.adminId = admin.id;
    return handler(req, res, params);
  };
}
