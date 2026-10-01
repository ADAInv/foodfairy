// Tiny validators. Everything user-supplied passes through one of these.

import { HttpError } from '../http.js';

export function str(v: unknown, field: string, opts: { max: number; min?: number; optional?: boolean }): string {
  if (v === undefined || v === null || v === '') {
    if (opts.optional) return '';
    throw new HttpError(400, `${field} is required`);
  }
  if (typeof v !== 'string') throw new HttpError(400, `${field} must be text`);
  const s = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (!s && !opts.optional) throw new HttpError(400, `${field} is required`);
  if (s.length > opts.max) throw new HttpError(400, `${field} is too long (max ${opts.max})`);
  if (opts.min && s.length < opts.min) throw new HttpError(400, `${field} is too short`);
  return s;
}

export function int(v: unknown, field: string, opts: { min: number; max: number; optional?: boolean }): number {
  if ((v === undefined || v === null || v === '') && opts.optional) return NaN;
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isInteger(n)) throw new HttpError(400, `${field} must be a whole number`);
  if (n < opts.min || n > opts.max) throw new HttpError(400, `${field} must be between ${opts.min} and ${opts.max}`);
  return n;
}

export function bool(v: unknown): 0 | 1 {
  return v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0;
}

export function email(v: unknown, field = 'Email'): string {
  const s = str(v, field, { max: 254 });
  if (!/^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]{2,}$/.test(s)) throw new HttpError(400, `${field} doesn't look right`);
  return s.toLowerCase();
}

export function phone(v: unknown, field = 'Phone'): string {
  const s = str(v, field, { max: 32 });
  const digits = s.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) throw new HttpError(400, `${field} doesn't look right`);
  return s;
}

/** Best effort E.164 for North American numbers; '' if unsure. */
export function toE164(phoneText: string): string {
  const d = phoneText.replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return '';
}

export function cents(v: unknown, field: string): number {
  return int(v, field, { min: 0, max: 1_000_000 });
}

export function ymd(v: unknown, field: string): string {
  const s = str(v, field, { max: 10 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) throw new HttpError(400, `${field} must be a date`);
  return s;
}
