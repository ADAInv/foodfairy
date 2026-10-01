// Minimal HTTP layer on node:http. No framework: a small router, strict
// body limits, cookie helpers and security headers.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { config } from './config.js';

export interface Req extends IncomingMessage {
  path: string;
  query: URLSearchParams;
  cookies: Record<string, string>;
  ip: string;
  adminId?: number;
  rawBody?: Buffer;
}
export type Res = ServerResponse;
export type Params = Record<string, string>;
export type Handler = (req: Req, res: Res, params: Params) => unknown | Promise<unknown>;

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// --------------------------------------------------------------- router
interface Route {
  method: string;
  parts: string[];
  handler: Handler;
}
export class Router {
  private routes: Route[] = [];
  add(method: string, pattern: string, handler: Handler): void {
    this.routes.push({ method, parts: pattern.split('/').filter(Boolean), handler });
  }
  get(p: string, h: Handler) { this.add('GET', p, h); }
  post(p: string, h: Handler) { this.add('POST', p, h); }
  put(p: string, h: Handler) { this.add('PUT', p, h); }
  delete(p: string, h: Handler) { this.add('DELETE', p, h); }

  match(method: string, path: string): { handler: Handler; params: Params } | null {
    const segs = path.split('/').filter(Boolean);
    for (const r of this.routes) {
      if (r.method !== method || r.parts.length !== segs.length) continue;
      const params: Params = {};
      let ok = true;
      for (let i = 0; i < segs.length; i++) {
        const p = r.parts[i]!;
        if (p.startsWith(':')) params[p.slice(1)] = decodeURIComponent(segs[i]!);
        else if (p !== segs[i]) { ok = false; break; }
      }
      if (ok) return { handler: r.handler, params };
    }
    return null;
  }
}

// --------------------------------------------------------------- body
export async function readBody(req: Req, limitBytes: number): Promise<Buffer> {
  const declared = Number(req.headers['content-length'] ?? 0);
  if (declared > limitBytes) throw new HttpError(413, 'Request body too large');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limitBytes) throw new HttpError(413, 'Request body too large');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

export async function readJson<T = Record<string, unknown>>(req: Req, limitBytes = 64 * 1024): Promise<T> {
  const type = String(req.headers['content-type'] ?? '');
  if (!type.startsWith('application/json')) throw new HttpError(415, 'Expected application/json');
  const buf = await readBody(req, limitBytes);
  req.rawBody = buf;
  try {
    const parsed = JSON.parse(buf.toString('utf8') || '{}');
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed as T;
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}

// --------------------------------------------------------------- responses
export function sendJson(res: Res, status: number, body: unknown, extraHeaders: Record<string, string> = {}): void {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(data);
}

// --------------------------------------------------------------- cookies
export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    try { out[k] = decodeURIComponent(v); } catch { /* ignore malformed */ }
  }
  return out;
}

interface CookieOpts { maxAge?: number; httpOnly?: boolean; sameSite?: 'Strict' | 'Lax'; path?: string }
export function setCookie(res: Res, name: string, value: string, opts: CookieOpts = {}): void {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${opts.path ?? '/'}`, `SameSite=${opts.sameSite ?? 'Strict'}`];
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.httpOnly !== false) parts.push('HttpOnly');
  if (config.cookieSecure) parts.push('Secure');
  const prev = res.getHeader('Set-Cookie');
  const list = Array.isArray(prev) ? prev : prev ? [String(prev)] : [];
  res.setHeader('Set-Cookie', [...list, parts.join('; ')]);
}
export function clearCookie(res: Res, name: string, opts: CookieOpts = {}): void {
  setCookie(res, name, '', { ...opts, maxAge: 0 });
}

// --------------------------------------------------------------- headers
export function securityHeaders(res: Res): void {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "img-src 'self' data:",
      "style-src 'self'",
      "script-src 'self'",
      "font-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'"
    ].join('; ')
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (config.cookieSecure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}

export function clientIp(req: IncomingMessage): string {
  if (config.trustProxy) {
    // Take the LAST hop: that's the one our own nginx appended. Earlier entries
    // come from the client and can be forged to dodge rate limits.
    const fwd = String(req.headers['x-forwarded-for'] ?? '').split(',').pop()?.trim();
    if (fwd) return fwd;
  }
  return req.socket.remoteAddress ?? 'unknown';
}
