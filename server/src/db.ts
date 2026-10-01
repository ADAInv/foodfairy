// SQLite via Node's built-in node:sqlite (Node >= 22.13). No native addon,
// no ORM. All queries are parameterised; nothing is string-concatenated.

import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config.js';

mkdirSync(config.dataDir, { recursive: true });
mkdirSync(join(config.dataDir, 'media'), { recursive: true });

export const db = new DatabaseSync(join(config.dataDir, 'foodfairy.sqlite'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

type Params = SQLInputValue[];

export function all<T>(sql: string, params: Params = []): T[] {
  return db.prepare(sql).all(...params) as T[];
}
export function get<T>(sql: string, params: Params = []): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}
export function run(sql: string, params: Params = []): { changes: number; lastId: number } {
  const r = db.prepare(sql).run(...params);
  return { changes: Number(r.changes), lastId: Number(r.lastInsertRowid) };
}
export function tx<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Schema. Migrations are append-only: add a new entry, never edit an old one.
// ---------------------------------------------------------------------------
const migrations: string[] = [
  `
  CREATE TABLE admins (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE images (
    id TEXT PRIMARY KEY,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    sizes TEXT NOT NULL,            -- JSON array of generated widths
    alt TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE TABLE categories (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL DEFAULT '',
    sort INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    image_id TEXT REFERENCES images(id) ON DELETE SET NULL,
    available INTEGER NOT NULL DEFAULT 1,   -- hidden from menu when 0
    sold_out INTEGER NOT NULL DEFAULT 0,    -- visible but not orderable
    allow_notes INTEGER NOT NULL DEFAULT 0,
    notes_prompt TEXT NOT NULL DEFAULT '',
    max_per_order INTEGER NOT NULL DEFAULT 20,
    sort INTEGER NOT NULL DEFAULT 0,
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  -- Sizes/options. When a product has options, the option price replaces
  -- the base price (e.g. "Half tray" / "Full tray").
  CREATE TABLE product_options (
    id INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    sold_out INTEGER NOT NULL DEFAULT 0,
    sort INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE drops (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    opens_at TEXT NOT NULL,         -- UTC ISO
    closes_at TEXT NOT NULL,        -- UTC ISO
    pickup_date TEXT NOT NULL,      -- YYYY-MM-DD (Toronto)
    pickup_window TEXT NOT NULL DEFAULT '',  -- free text, e.g. "12 – 4 PM"
    paused INTEGER NOT NULL DEFAULT 0,       -- force closed
    max_orders INTEGER,                      -- optional cap, NULL = unlimited
    note TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE orders (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,            -- customer-facing, e.g. FF-7K3Q
    token TEXT NOT NULL UNIQUE,           -- unguessable confirmation URL token
    drop_id INTEGER NOT NULL REFERENCES drops(id),
    customer_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    subtotal_cents INTEGER NOT NULL,
    tax_cents INTEGER NOT NULL DEFAULT 0,
    total_cents INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending','paid','ready','picked_up','cancelled')),
    checkout_mode TEXT NOT NULL,
    square_payment_link_id TEXT,
    square_order_id TEXT UNIQUE,
    square_payment_id TEXT,
    confirmation_emailed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    paid_at TEXT
  );
  CREATE INDEX orders_drop ON orders(drop_id);
  CREATE TABLE order_items (
    id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER,
    option_id INTEGER,
    name TEXT NOT NULL,              -- snapshot at time of order
    option_name TEXT NOT NULL DEFAULT '',
    unit_cents INTEGER NOT NULL,
    qty INTEGER NOT NULL,
    notes TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE inquiries (
    id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('catering','contact')),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    payload TEXT NOT NULL,           -- JSON
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','replied','archived')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE TABLE faqs (
    id INTEGER PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    sort INTEGER NOT NULL DEFAULT 0,
    visible INTEGER NOT NULL DEFAULT 1
  );
  -- Reviews are entered by the owner from real customers only.
  CREATE TABLE reviews (
    id INTEGER PRIMARY KEY,
    author TEXT NOT NULL,
    body TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT '',  -- e.g. "Instagram DM"
    sort INTEGER NOT NULL DEFAULT 0,
    visible INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE webhook_events (
    event_id TEXT PRIMARY KEY,
    received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  `
];

function migrate(): void {
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (v INTEGER NOT NULL)');
  const row = get<{ v: number }>('SELECT v FROM schema_version');
  let v = row?.v ?? 0;
  if (!row) run('INSERT INTO schema_version (v) VALUES (0)');
  while (v < migrations.length) {
    tx(() => {
      db.exec(migrations[v]!);
      run('UPDATE schema_version SET v = ?', [v + 1]);
    });
    v++;
  }
}

// Default content. Only structural things and copy supplied in the brief —
// no products, prices, reviews or FAQs are invented here.
const DEFAULT_CATEGORIES: [string, string, string][] = [
  ['rice', 'Rice', '🍚'],
  ['protein', 'Protein', '🍗'],
  ['soups', 'Soups', '🥣'],
  ['small-chops', 'Small chops', '🥟'],
  ['trays', 'Family trays', '📦']
];

export const DEFAULT_SETTINGS: Record<string, string> = {
  announcement: '',
  hero_image_id: '',
  founder_image_id: '',
  instagram: '_thefoodfairyca',
  tiktok: '_thefoodfairyca',
  contact_email: '',
  pickup_area: 'Kitchener / Waterloo',
  pickup_instructions:
    'The exact pickup spot is sent to you privately after you order. Bring your order number.',
  tax_percent: '0',
  tax_label: 'HST',
  catering_intro:
    "Office lunch? Birthday? Shower? Family gathering? Tell me what you're feeding and I'll help you figure out the food.",
  catering_minimum_notice: ''
};

function seedDefaults(): void {
  const count = get<{ n: number }>('SELECT COUNT(*) AS n FROM categories')!.n;
  if (count === 0) {
    DEFAULT_CATEGORIES.forEach(([slug, name, emoji], i) =>
      run('INSERT INTO categories (slug, name, emoji, sort) VALUES (?, ?, ?, ?)', [slug, name, emoji, i])
    );
  }
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  }
}

migrate();
seedDefaults();
