// Configuration. No dotenv dependency: a tiny .env parser that never
// overrides variables already present in the real environment.

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadDotEnv(path: string): void {
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    const q = value[0];
    if ((q === '"' || q === "'") && value.indexOf(q, 1) > 0) {
      // Quoted: keep everything inside the quotes (a # in a password is fine).
      value = value.slice(1, value.indexOf(q, 1));
    } else {
      // Unquoted: " # ..." starts a comment, same as dotenv.
      value = value.replace(/\s+#.*$/, '');
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv(resolve(process.cwd(), '.env'));

const env = process.env;
const isProd = env.NODE_ENV === 'production';

const problems: string[] = [];

function bool(name: string, fallback: boolean): boolean {
  const v = env[name];
  if (v === undefined || v === '') return fallback;
  const s = v.toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(s)) return true;
  if (['0', 'false', 'no', 'off'].includes(s)) return false;
  problems.push(`${name} must be true or false (got "${v}")`);
  return fallback;
}

function url(name: string, value: string): string {
  try {
    const u = new URL(value);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error();
  } catch {
    problems.push(`${name} must be a full http(s) URL (got "${value}")`);
  }
  return value;
}

export type CheckoutMode = 'square_api' | 'square_link' | 'disabled';

const mode = (env.CHECKOUT_MODE ?? 'disabled') as CheckoutMode;
if (!['square_api', 'square_link', 'disabled'].includes(mode)) {
  throw new Error(`CHECKOUT_MODE must be square_api, square_link or disabled (got "${mode}")`);
}

const siteUrl = url('SITE_URL', (env.SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, ''));

export const config = {
  isProd,
  port: Number(env.PORT ?? 3000),
  host: env.HOST ?? '127.0.0.1',
  siteUrl,
  dataDir: resolve(process.cwd(), env.DATA_DIR ?? './data'),
  clientDir: resolve(process.cwd(), env.CLIENT_DIR ?? './dist/client'),
  // Secure cookies whenever the site is served over https, even if NODE_ENV was
  // forgotten, so the admin session can never leak over plain http.
  cookieSecure: bool('COOKIE_SECURE', isProd || siteUrl.startsWith('https://')),
  trustProxy: bool('TRUST_PROXY', false),
  timeZone: 'America/Toronto',
  currency: 'CAD',

  checkout: {
    mode,
    // square_api: server builds a one-off Square payment link per order.
    squareEnv: (env.SQUARE_ENV ?? 'sandbox') as 'sandbox' | 'production',
    accessToken: env.SQUARE_ACCESS_TOKEN ?? '',
    locationId: env.SQUARE_LOCATION_ID ?? '',
    apiVersion: env.SQUARE_VERSION ?? '2024-10-17',
    webhookSignatureKey: env.SQUARE_WEBHOOK_SIGNATURE_KEY ?? '',
    // Must match the notification URL registered in the Square dashboard exactly.
    webhookUrl: env.SQUARE_WEBHOOK_URL ?? '',
    // square_link: a single static Square checkout/store link. Orders are
    // recorded as "awaiting payment" and marked paid by hand in admin.
    staticCheckoutUrl: env.SQUARE_CHECKOUT_URL ?? ''
  },

  mail: {
    host: env.SMTP_HOST ?? '',
    port: Number(env.SMTP_PORT ?? 587),
    secure: bool('SMTP_SECURE', false),
    user: env.SMTP_USER ?? '',
    pass: env.SMTP_PASS ?? '',
    from: env.MAIL_FROM ?? 'The Food Fairy <orders@localhost>',
    ownerEmail: env.OWNER_EMAIL ?? ''
  }
};

// Refuse to boot on a malformed setting rather than run half-configured.
{
  const c = config.checkout;
  if (c.squareEnv !== 'sandbox' && c.squareEnv !== 'production') {
    problems.push(`SQUARE_ENV must be sandbox or production (got "${c.squareEnv}")`);
  }
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    problems.push(`PORT must be a number (got "${env.PORT}")`);
  }
  if (!Number.isInteger(config.mail.port)) problems.push(`SMTP_PORT must be a number (got "${env.SMTP_PORT}")`);
  if (/\s/.test(config.host)) problems.push(`HOST must not contain spaces (got "${config.host}")`);
  if (/\s/.test(env.DATA_DIR ?? '')) problems.push(`DATA_DIR must not contain spaces (got "${env.DATA_DIR}")`);
  if (c.webhookUrl) url('SQUARE_WEBHOOK_URL', c.webhookUrl);
  if (c.staticCheckoutUrl) url('SQUARE_CHECKOUT_URL', c.staticCheckoutUrl);
  if (problems.length) {
    throw new Error(`Invalid configuration in .env:\n  - ${problems.join('\n  - ')}\n`);
  }
}

export function squareBaseUrl(): string {
  return config.checkout.squareEnv === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';
}
