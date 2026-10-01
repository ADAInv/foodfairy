// Toronto-time helpers using only Intl (no date library).

import { config } from '../config.js';

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: config.timeZone,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});

function zonedParts(ms: number) {
  const p: Record<string, number> = {};
  for (const { type, value } of partsFmt.formatToParts(new Date(ms))) {
    if (type !== 'literal') p[type] = Number(value);
  }
  return p as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Offset (ms) of Toronto from UTC at the given instant. */
function offsetAt(ms: number): number {
  const p = zonedParts(ms);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}

/** "2026-10-08T20:00" (Toronto wall clock) -> UTC ISO string. */
export function torontoLocalToUtc(local: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) throw new Error('Expected YYYY-MM-DDTHH:MM');
  const guess = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!);
  let utc = guess - offsetAt(guess);
  utc = guess - offsetAt(utc); // second pass settles DST edges
  return new Date(utc).toISOString();
}

/** UTC ISO -> "YYYY-MM-DDTHH:MM" in Toronto (for <input type="datetime-local">). */
export function utcToTorontoLocal(iso: string): string {
  const p = zonedParts(Date.parse(iso));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

export function formatPickupDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric'
  }).format(new Date(Date.UTC(y!, m! - 1, d!, 12)));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timeZone, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit'
  }).format(new Date(iso));
}
