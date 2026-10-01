import { all, run } from '../db.js';

export function getSettings(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of all<{ key: string; value: string }>('SELECT key, value FROM settings')) out[r.key] = r.value;
  return out;
}

export function setSetting(key: string, value: string): void {
  run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
}

/** Settings safe to expose to the public site. */
export const PUBLIC_SETTING_KEYS = [
  'announcement', 'hero_image_id', 'founder_image_id', 'instagram', 'tiktok', 'contact_email',
  'pickup_area', 'tax_percent', 'tax_label', 'catering_intro', 'catering_minimum_notice'
] as const;

/** Settings that exist but are only revealed after an order (pickup details). */
export const PRIVATE_SETTING_KEYS = ['pickup_instructions'] as const;

export const EDITABLE_SETTING_KEYS = [...PUBLIC_SETTING_KEYS, ...PRIVATE_SETTING_KEYS];

export function publicSettings(): Record<string, string> {
  const s = getSettings();
  const out: Record<string, string> = {};
  for (const k of PUBLIC_SETTING_KEYS) out[k] = s[k] ?? '';
  return out;
}

export function taxPercent(): number {
  const n = Number(getSettings().tax_percent ?? '0');
  return Number.isFinite(n) && n >= 0 && n <= 25 ? n : 0;
}
