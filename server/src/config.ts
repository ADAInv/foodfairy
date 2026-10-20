import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { optionalSecret } from './secrets.js';

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

/** A setting from the environment, treating an empty value as "not set". */
function setting(name: string, fallback: string): string {
  const v = env[name];
  return v === undefined || v === '' ? fallback : v;
}

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

export type CheckoutMode = 'square-api' | 'square-link' | 'disabled';

const mode = setting('CHECKOUT_MODE', 'disabled') as CheckoutMode;
if (!['square-api', 'square-link', 'disabled'].includes(mode)) {
  problems.push(`CHECKOUT_MODE must be square-api, square-link or disabled (got "${mode}")`);
}

const siteUrl = url('SITE_URL', setting('SITE_URL', 'http://localhost:3000').replace(/\/+$/, ''));

export const config = {
  isProd,
  port: Number(setting('PORT', '3000')),
  host: setting('HOST', '127.0.0.1'),
  siteUrl,
  dataDir: resolve(process.cwd(), setting('DATA_DIR', './data')),
  clientDir: resolve(process.cwd(), setting('CLIENT_DIR', './dist/client')),
  // Secure cookies whenever the site is served over https, even if NODE_ENV was
  // forgotten, so the admin session can never leak over plain http.
  cookieSecure: bool('COOKIE_SECURE', isProd || siteUrl.startsWith('https://')),
  trustProxy: bool('TRUST_PROXY', false),
  timeZone: 'America/Toronto',
  currency: 'CAD',
  checkout: {
    mode,
    // square-api: server builds a one-off Square payment link per order.
    squareEnv: setting('SQUARE_ENV', 'sandbox'),
    accessToken: optionalSecret('square-access-token') ?? '',
    locationId: setting('SQUARE_LOCATION_ID', ''),
    apiVersion: setting('SQUARE_VERSION', '2024-10-17'),
    webhookSignatureKey: optionalSecret('square-webhook-signature-key') ?? '',
    // Must match the notification URL registered in the Square dashboard exactly.
    webhookUrl: setting('SQUARE_WEBHOOK_URL', ''),
    // square-link: a single static Square checkout/store link. Orders are
    // recorded as "awaiting payment" and marked paid by hand in admin.
    staticCheckoutUrl: setting('SQUARE_CHECKOUT_URL', '')
  },
  mail: {
    host: setting('SMTP_HOST', ''),
    port: Number(setting('SMTP_PORT', '587')),
    secure: bool('SMTP_SECURE', false),
    user: setting('SMTP_USER', ''),
    pass: optionalSecret('smtp-pass') ?? '',
    from: setting('MAIL_FROM', 'The Food Fairy <orders@localhost>'),
    ownerEmail: setting('OWNER_EMAIL', '')
  }
};

// Refuse to boot on a malformed or incomplete setting rather than run half-configured.
{
  const c = config.checkout;
  if (c.squareEnv !== 'sandbox' && c.squareEnv !== 'production') {
    problems.push(`SQUARE_ENV must be sandbox or production (got "${c.squareEnv}")`);
  }
  if (c.mode === 'square-api') {
    if (!c.accessToken) problems.push('CHECKOUT_MODE is square-api but the square-access-token secret is missing');
    if (!c.locationId) problems.push('CHECKOUT_MODE is square-api but SQUARE_LOCATION_ID is not set');
    if (!c.webhookSignatureKey) problems.push('CHECKOUT_MODE is square-api but the square-webhook-signature-key secret is missing');
    if (!c.webhookUrl) problems.push('CHECKOUT_MODE is square-api but SQUARE_WEBHOOK_URL is not set');
  }
  if (c.mode === 'square-link' && !c.staticCheckoutUrl) {
    problems.push('CHECKOUT_MODE is square-link but SQUARE_CHECKOUT_URL is not set');
  }
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    problems.push(`PORT must be a number between 1 and 65535 (got "${env.PORT}")`);
  }
  if (!Number.isInteger(config.mail.port)) problems.push(`SMTP_PORT must be a number (got "${env.SMTP_PORT}")`);
  if (/\s/.test(config.host)) problems.push(`HOST must not contain spaces (got "${config.host}")`);
  if (/\s/.test(env.DATA_DIR ?? '')) problems.push(`DATA_DIR must not contain spaces (got "${env.DATA_DIR}")`);
  if (isProd && !siteUrl.startsWith('https://')) {
    problems.push(`SITE_URL must start with https:// in production (got "${siteUrl}")`);
  }
  if (c.webhookUrl) url('SQUARE_WEBHOOK_URL', c.webhookUrl);
  if (c.staticCheckoutUrl) url('SQUARE_CHECKOUT_URL', c.staticCheckoutUrl);
  if (problems.length) {
    throw new Error(`Invalid configuration:\n  - ${problems.join('\n  - ')}\n`);
  }
}

export function squareBaseUrl(): string {
  return config.checkout.squareEnv === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';
}
