import { all, get, run, tx } from '../db.js';
import { HttpError, readBody, readJson, sendJson, type Router, type Handler } from '../http.js';
import { rateLimit } from '../lib/ratelimit.js';
import { requireAdmin, startSession, endSession, sessionAdmin, verifyPassword, verifyDummy, issueCsrf, CSRF_COOKIE } from '../lib/auth.js';
import { str, int, bool, cents, ymd, email as vEmail } from '../lib/validate.js';
import { processUpload, deleteImage, imageInfo, MAX_UPLOAD_BYTES } from '../lib/images.js';
import { dropState, type DropRow } from '../lib/drops.js';
import { torontoLocalToUtc, utcToTorontoLocal } from '../lib/time.js';
import { getSettings, setSetting, EDITABLE_SETTING_KEYS } from '../lib/settings.js';
import { orderItems, markPaid, sendOrderEmails, type OrderRow } from '../lib/orders.js';
import { config } from '../config.js';

const A = (h: Handler) => requireAdmin(h);
const id = (v: string | undefined) => int(v, 'id', { min: 1, max: 1e12 });

function slugify(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').slice(0, 40) || 'category';
}

export function registerAdmin(r: Router): void {
  // ------------------------------------------------------------- auth
  r.post('/api/admin/login', async (req, res) => {
    rateLimit(`login-ip:${req.ip}`, 10, 15 * 60_000);
    const b = await readJson(req, 4096);
    const mail = vEmail(b.email);
    rateLimit(`login-user:${mail}`, 6, 15 * 60_000);
    const password = str(b.password, 'Password', { max: 200 });
    const admin = get<{ id: number; salt: string; password_hash: string }>('SELECT id, salt, password_hash FROM admins WHERE email = ?', [mail]);
    if (!admin) { verifyDummy(password); throw new HttpError(401, "That email and password don't match."); }
    if (!verifyPassword(password, admin.salt, admin.password_hash)) throw new HttpError(401, "That email and password don't match.");
    startSession(res, admin.id);
    sendJson(res, 200, { email: mail });
  });

  r.post('/api/admin/logout', (req, res) => { endSession(req, res); sendJson(res, 200, { ok: true }); });

  r.get('/api/admin/me', (req, res) => {
    const admin = sessionAdmin(req);
    if (!admin) throw new HttpError(401, 'Not signed in');
    if (!req.cookies[CSRF_COOKIE]) issueCsrf(res);
    sendJson(res, 200, {
      email: admin.email,
      checkoutMode: config.checkout.mode,
      squareEnv: config.checkout.squareEnv,
      mailConfigured: !!config.mail.host,
      siteUrl: config.siteUrl
    });
  });

  // ------------------------------------------------------------- overview
  r.get('/api/admin/overview', A((_req, res) => {
    const now = new Date().toISOString();
    const drops = all<DropRow>('SELECT * FROM drops WHERE closes_at > ? ORDER BY opens_at LIMIT 5', [now]);
    sendJson(res, 200, {
      drops: drops.map((d) => ({ ...d, state: dropState(d) })),
      ordersToPrep: get<{ n: number }>(`SELECT COUNT(*) AS n FROM orders WHERE status = 'paid'`)!.n,
      newInquiries: get<{ n: number }>(`SELECT COUNT(*) AS n FROM inquiries WHERE status = 'new'`)!.n,
      demoProducts: get<{ n: number }>('SELECT COUNT(*) AS n FROM products WHERE is_demo = 1')!.n,
      products: get<{ n: number }>('SELECT COUNT(*) AS n FROM products')!.n
    });
  }));

  // ------------------------------------------------------------- categories
  r.get('/api/admin/categories', A((_req, res) => {
    sendJson(res, 200, all(`SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count FROM categories c ORDER BY sort, id`));
  }));
  const readCategory = async (req: Parameters<Handler>[0]) => {
    const b = await readJson(req);
    const name = str(b.name, 'Name', { max: 40 });
    return { name, emoji: str(b.emoji, 'Emoji', { max: 8, optional: true }), sort: int(b.sort ?? 0, 'Sort', { min: -1000, max: 1000 }), active: bool(b.active ?? true), slug: slugify(str(b.slug, 'Slug', { max: 40, optional: true }) || name) };
  };
  r.post('/api/admin/categories', A(async (req, res) => {
    const c = await readCategory(req);
    if (get('SELECT 1 FROM categories WHERE slug = ?', [c.slug])) throw new HttpError(409, 'A category with that slug already exists');
    const { lastId } = run('INSERT INTO categories (slug, name, emoji, sort, active) VALUES (?, ?, ?, ?, ?)', [c.slug, c.name, c.emoji, c.sort, c.active]);
    sendJson(res, 201, { id: lastId });
  }));
  r.put('/api/admin/categories/:id', A(async (req, res, p) => {
    const c = await readCategory(req);
    if (get('SELECT 1 FROM categories WHERE slug = ? AND id != ?', [c.slug, id(p.id)])) throw new HttpError(409, 'A category with that slug already exists');
    run('UPDATE categories SET slug = ?, name = ?, emoji = ?, sort = ?, active = ? WHERE id = ?', [c.slug, c.name, c.emoji, c.sort, c.active, id(p.id)]);
    sendJson(res, 200, { ok: true });
  }));
  r.delete('/api/admin/categories/:id', A((_req, res, p) => {
    if (get('SELECT 1 FROM products WHERE category_id = ?', [id(p.id)])) throw new HttpError(409, 'Move or delete the products in this category first');
    run('DELETE FROM categories WHERE id = ?', [id(p.id)]);
    sendJson(res, 200, { ok: true });
  }));

  // ------------------------------------------------------------- products
  r.get('/api/admin/products', A((_req, res) => {
    const products = all<Record<string, unknown> & { id: number; image_id: string | null }>('SELECT * FROM products ORDER BY category_id, sort, id');
    const options = all<{ product_id: number }>('SELECT * FROM product_options ORDER BY sort, id');
    sendJson(res, 200, products.map((p) => ({ ...p, image: imageInfo(p.image_id), options: options.filter((o) => o.product_id === p.id) })));
  }));

  const readProduct = async (req: Parameters<Handler>[0]) => {
    const b = await readJson(req, 32 * 1024);
    const categoryId = int(b.category_id, 'Category', { min: 1, max: 1e9 });
    if (!get('SELECT 1 FROM categories WHERE id = ?', [categoryId])) throw new HttpError(400, 'Pick a category');
    const imageId = str(b.image_id, 'Image', { max: 40, optional: true }) || null;
    if (imageId && !get('SELECT 1 FROM images WHERE id = ?', [imageId])) throw new HttpError(400, 'That image no longer exists');
    const rawOptions = Array.isArray(b.options) ? b.options : [];
    if (rawOptions.length > 12) throw new HttpError(400, 'Up to 12 options per product');
    const options = rawOptions.map((o, i) => {
      const x = (o ?? {}) as Record<string, unknown>;
      return { name: str(x.name, `Option ${i + 1} name`, { max: 60 }), price_cents: cents(x.price_cents, `Option ${i + 1} price`), sold_out: bool(x.sold_out), sort: i };
    });
    return {
      category_id: categoryId,
      name: str(b.name, 'Name', { max: 80 }),
      description: str(b.description, 'Description', { max: 280, optional: true }),
      price_cents: cents(b.price_cents ?? 0, 'Price'),
      image_id: imageId,
      available: bool(b.available ?? true),
      sold_out: bool(b.sold_out),
      allow_notes: bool(b.allow_notes),
      notes_prompt: str(b.notes_prompt, 'Notes prompt', { max: 120, optional: true }),
      max_per_order: int(b.max_per_order ?? 20, 'Max per order', { min: 1, max: 99 }),
      sort: int(b.sort ?? 0, 'Sort', { min: -1000, max: 10000 }),
      options
    };
  };
  const saveOptions = (productId: number, options: { name: string; price_cents: number; sold_out: 0 | 1; sort: number }[]) => {
    run('DELETE FROM product_options WHERE product_id = ?', [productId]);
    for (const o of options) run('INSERT INTO product_options (product_id, name, price_cents, sold_out, sort) VALUES (?, ?, ?, ?, ?)', [productId, o.name, o.price_cents, o.sold_out, o.sort]);
  };

  r.post('/api/admin/products', A(async (req, res) => {
    const p = await readProduct(req);
    const newId = tx(() => {
      const { lastId } = run(
        `INSERT INTO products (category_id, name, description, price_cents, image_id, available, sold_out, allow_notes, notes_prompt, max_per_order, sort)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.category_id, p.name, p.description, p.price_cents, p.image_id, p.available, p.sold_out, p.allow_notes, p.notes_prompt, p.max_per_order, p.sort]
      );
      saveOptions(lastId, p.options);
      return lastId;
    });
    sendJson(res, 201, { id: newId });
  }));
  r.put('/api/admin/products/:id', A(async (req, res, params) => {
    const pid = id(params.id);
    const p = await readProduct(req);
    tx(() => {
      const u = run(
        `UPDATE products SET category_id = ?, name = ?, description = ?, price_cents = ?, image_id = ?, available = ?, sold_out = ?,
           allow_notes = ?, notes_prompt = ?, max_per_order = ?, sort = ?, is_demo = 0 WHERE id = ?`,
        [p.category_id, p.name, p.description, p.price_cents, p.image_id, p.available, p.sold_out, p.allow_notes, p.notes_prompt, p.max_per_order, p.sort, pid]
      );
      if (u.changes === 0) throw new HttpError(404, 'Product not found');
      saveOptions(pid, p.options);
    });
    sendJson(res, 200, { ok: true });
  }));
  // Quick toggles from the product list (sold out / hidden).
  r.post('/api/admin/products/:id/flags', A(async (req, res, params) => {
    const b = await readJson(req, 1024);
    const pid = id(params.id);
    if ('sold_out' in b) run('UPDATE products SET sold_out = ? WHERE id = ?', [bool(b.sold_out), pid]);
    if ('available' in b) run('UPDATE products SET available = ? WHERE id = ?', [bool(b.available), pid]);
    sendJson(res, 200, { ok: true });
  }));
  r.delete('/api/admin/products/:id', A((_req, res, params) => {
    run('DELETE FROM products WHERE id = ?', [id(params.id)]);
    sendJson(res, 200, { ok: true });
  }));
  r.post('/api/admin/products/delete-demo', A((_req, res) => {
    const { changes } = run('DELETE FROM products WHERE is_demo = 1');
    sendJson(res, 200, { deleted: changes });
  }));

  // ------------------------------------------------------------- images
  r.post('/api/admin/images', A(async (req, res) => {
    rateLimit(`upload:${req.adminId}`, 60, 60 * 60_000);
    const buf = await readBody(req, MAX_UPLOAD_BYTES);
    const alt = str(req.query.get('alt') ?? '', 'Alt text', { max: 200, optional: true });
    const img = await processUpload(buf, alt);
    sendJson(res, 201, { ...img, alt });
  }));
  r.delete('/api/admin/images/:id', A(async (_req, res, params) => {
    const imgId = params.id ?? '';
    if (!/^[a-f0-9]{24}$/.test(imgId)) throw new HttpError(400, 'Bad image id');
    await deleteImage(imgId);
    sendJson(res, 200, { ok: true });
  }));

  // ------------------------------------------------------------- drops
  r.get('/api/admin/drops', A((_req, res) => {
    const drops = all<DropRow>('SELECT * FROM drops ORDER BY opens_at DESC LIMIT 60');
    sendJson(res, 200, drops.map((d) => ({
      ...d,
      state: dropState(d),
      opens_local: utcToTorontoLocal(d.opens_at),
      closes_local: utcToTorontoLocal(d.closes_at),
      order_count: get<{ n: number }>(`SELECT COUNT(*) AS n FROM orders WHERE drop_id = ? AND status IN ('paid','ready','picked_up')`, [d.id])!.n
    })));
  }));
  const readDrop = async (req: Parameters<Handler>[0]) => {
    const b = await readJson(req);
    let opens: string, closes: string;
    try {
      opens = torontoLocalToUtc(str(b.opens_local, 'Orders open', { max: 16 }));
      closes = torontoLocalToUtc(str(b.closes_local, 'Orders close', { max: 16 }));
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(400, 'Dates must look like 2026-10-08T20:00');
    }
    if (Date.parse(closes) <= Date.parse(opens)) throw new HttpError(400, 'Orders must close after they open');
    const pickup = ymd(b.pickup_date, 'Pickup date');
    if (pickup < utcToTorontoLocal(closes).slice(0, 10)) throw new HttpError(400, 'Pickup can’t be before orders close');
    const max = b.max_orders === '' || b.max_orders === null || b.max_orders === undefined ? null : int(b.max_orders, 'Max orders', { min: 1, max: 10000 });
    return {
      title: str(b.title, 'Title', { max: 60, optional: true }),
      opens, closes, pickup,
      pickup_window: str(b.pickup_window, 'Pickup window', { max: 60, optional: true }),
      paused: bool(b.paused), max, note: str(b.note, 'Note', { max: 200, optional: true })
    };
  };
  r.post('/api/admin/drops', A(async (req, res) => {
    const d = await readDrop(req);
    const { lastId } = run(
      'INSERT INTO drops (title, opens_at, closes_at, pickup_date, pickup_window, paused, max_orders, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [d.title, d.opens, d.closes, d.pickup, d.pickup_window, d.paused, d.max, d.note]
    );
    sendJson(res, 201, { id: lastId });
  }));
  r.put('/api/admin/drops/:id', A(async (req, res, params) => {
    const d = await readDrop(req);
    run(
      'UPDATE drops SET title = ?, opens_at = ?, closes_at = ?, pickup_date = ?, pickup_window = ?, paused = ?, max_orders = ?, note = ? WHERE id = ?',
      [d.title, d.opens, d.closes, d.pickup, d.pickup_window, d.paused, d.max, d.note, id(params.id)]
    );
    sendJson(res, 200, { ok: true });
  }));
  r.delete('/api/admin/drops/:id', A((_req, res, params) => {
    if (get('SELECT 1 FROM orders WHERE drop_id = ?', [id(params.id)])) throw new HttpError(409, 'This drop has orders. Pause it instead.');
    run('DELETE FROM drops WHERE id = ?', [id(params.id)]);
    sendJson(res, 200, { ok: true });
  }));
  // What to cook: totals per item across confirmed orders in a drop.
  r.get('/api/admin/drops/:id/prep', A((_req, res, params) => {
    sendJson(res, 200, all(
      `SELECT i.name, i.option_name, SUM(i.qty) AS qty FROM order_items i JOIN orders o ON o.id = i.order_id
        WHERE o.drop_id = ? AND o.status IN ('paid','ready','picked_up') GROUP BY i.name, i.option_name ORDER BY i.name`,
      [id(params.id)]
    ));
  }));

  // ------------------------------------------------------------- orders
  r.get('/api/admin/orders', A((req, res) => {
    const dropId = req.query.get('drop');
    const status = req.query.get('status');
    const where: string[] = [];
    const args: (string | number)[] = [];
    if (dropId) { where.push('o.drop_id = ?'); args.push(id(dropId)); }
    if (status && ['pending', 'paid', 'ready', 'picked_up', 'cancelled'].includes(status)) { where.push('o.status = ?'); args.push(status); }
    const rows = all<OrderRow & { pickup_date: string }>(
      `SELECT o.*, d.pickup_date FROM orders o JOIN drops d ON d.id = o.drop_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY o.created_at DESC LIMIT 300`, args
    );
    sendJson(res, 200, rows.map((o) => ({ ...o, token: undefined, items: orderItems(o.id) })));
  }));
  r.put('/api/admin/orders/:id/status', A(async (req, res, params) => {
    const b = await readJson(req, 1024);
    const oid = id(params.id);
    const status = str(b.status, 'Status', { max: 20 });
    if (!['pending', 'paid', 'ready', 'picked_up', 'cancelled'].includes(status)) throw new HttpError(400, 'Unknown status');
    // Manual confirmation (e.g. square_link mode) also sends the emails, once.
    if (status === 'paid') await markPaid(oid, null);
    run('UPDATE orders SET status = ? WHERE id = ?', [status, oid]);
    if (status === 'paid') await sendOrderEmails(oid);
    sendJson(res, 200, { ok: true });
  }));

  // ------------------------------------------------------------- inquiries
  r.get('/api/admin/inquiries', A((_req, res) => {
    const rows = all<{ payload: string }>('SELECT * FROM inquiries ORDER BY created_at DESC LIMIT 300');
    sendJson(res, 200, rows.map((r) => ({ ...r, payload: JSON.parse(r.payload) })));
  }));
  r.put('/api/admin/inquiries/:id', A(async (req, res, params) => {
    const b = await readJson(req, 1024);
    const status = str(b.status, 'Status', { max: 20 });
    if (!['new', 'replied', 'archived'].includes(status)) throw new HttpError(400, 'Unknown status');
    run('UPDATE inquiries SET status = ? WHERE id = ?', [status, id(params.id)]);
    sendJson(res, 200, { ok: true });
  }));

  // ------------------------------------------------------------- FAQs + reviews
  const simpleCrud = (table: 'faqs' | 'reviews', read: (b: Record<string, unknown>) => Record<string, string | number>) => {
    r.get(`/api/admin/${table}`, A((_req, res) => sendJson(res, 200, all(`SELECT * FROM ${table} ORDER BY sort, id`))));
    r.post(`/api/admin/${table}`, A(async (req, res) => {
      const v = read(await readJson(req, 16 * 1024));
      const cols = Object.keys(v);
      const { lastId } = run(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, Object.values(v));
      sendJson(res, 201, { id: lastId });
    }));
    r.put(`/api/admin/${table}/:id`, A(async (req, res, params) => {
      const v = read(await readJson(req, 16 * 1024));
      run(`UPDATE ${table} SET ${Object.keys(v).map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...Object.values(v), id(params.id)]);
      sendJson(res, 200, { ok: true });
    }));
    r.delete(`/api/admin/${table}/:id`, A((_req, res, params) => {
      run(`DELETE FROM ${table} WHERE id = ?`, [id(params.id)]);
      sendJson(res, 200, { ok: true });
    }));
  };
  simpleCrud('faqs', (b) => ({
    question: str(b.question, 'Question', { max: 200 }),
    answer: str(b.answer, 'Answer', { max: 1500 }),
    sort: int(b.sort ?? 0, 'Sort', { min: -1000, max: 1000 }),
    visible: bool(b.visible ?? true)
  }));
  simpleCrud('reviews', (b) => ({
    author: str(b.author, 'Name', { max: 60 }),
    body: str(b.body, 'Review', { max: 600 }),
    source: str(b.source, 'Source', { max: 60, optional: true }),
    sort: int(b.sort ?? 0, 'Sort', { min: -1000, max: 1000 }),
    visible: bool(b.visible ?? true)
  }));

  // ------------------------------------------------------------- settings
  r.get('/api/admin/settings', A((_req, res) => {
    const s = getSettings();
    const out: Record<string, unknown> = {};
    for (const k of EDITABLE_SETTING_KEYS) out[k] = s[k] ?? '';
    out.hero_image = imageInfo(s.hero_image_id);
    out.founder_image = imageInfo(s.founder_image_id);
    sendJson(res, 200, out);
  }));
  r.put('/api/admin/settings', A(async (req, res) => {
    const b = await readJson(req, 32 * 1024);
    for (const k of EDITABLE_SETTING_KEYS) {
      if (!(k in b)) continue;
      let v = str(b[k], k, { max: 2000, optional: true });
      if (k === 'tax_percent') {
        const n = Number(v || '0');
        if (!Number.isFinite(n) || n < 0 || n > 25) throw new HttpError(400, 'Tax must be between 0 and 25');
        v = String(n);
      }
      if ((k === 'hero_image_id' || k === 'founder_image_id') && v && !get('SELECT 1 FROM images WHERE id = ?', [v])) {
        throw new HttpError(400, 'That image no longer exists');
      }
      if ((k === 'instagram' || k === 'tiktok')) v = v.replace(/^@/, '').replace(/[^\w.]/g, '');
      if (k === 'contact_email' && v) v = vEmail(v, 'Contact email');
      setSetting(k, v);
    }
    sendJson(res, 200, { ok: true });
  }));
}
