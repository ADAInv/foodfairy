const TZ = 'America/Toronto';

export const money = (cents: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);

export const moneyExact = (cents: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(cents / 100);

/** "2026-10-10" -> "Saturday, October 10" */
export function pickupDay(ymd: string, opts: { short?: boolean } = {}): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC', weekday: 'long', ...(opts.short ? {} : { month: 'long', day: 'numeric' })
  }).format(new Date(Date.UTC(y!, m! - 1, d!, 12)));
}

/** ISO -> "Thursday at 8 PM" (or "Thursday, Oct 8 at 8 PM" if > 6 days away) */
export function whenLabel(iso: string): string {
  const date = new Date(iso);
  const far = Math.abs(date.getTime() - Date.now()) > 6 * 86_400_000;
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, weekday: 'long', ...(far ? { month: 'short', day: 'numeric' } : {}) }).format(date);
  const time = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })
    .format(date).replace(':00', '').replace(/\s?a\.m\./i, ' AM').replace(/\s?p\.m\./i, ' PM');
  return `${day} at ${time}`;
}

export function timeLeft(iso: string, now = Date.now()): string {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return 'closing now';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 48) return `${Math.floor(h / 24)} days left`;
  if (h >= 1) return `${h}h ${m}m left`;
  return `${m} min left`;
}
