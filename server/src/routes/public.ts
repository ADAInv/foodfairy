import { config } from '../config.js';
import { all, get, run, tx } from '../db.js';
import { HttpError, readJson, sendJson, type Router } from '../http.js';
import { rateLimit } from '../lib/ratelimit.js';
import { publicCategories, publicProducts } from '../lib/catalog.js';
import { currentDrops, dropState, getDrop } from '../lib/drops.js';
import { getSettings, publicSettings, taxPercent } from '../lib/settings.js';
import { str, int, email, phone, toE164, ymd } from '../lib/validate.js';
import { createPaymentLink, isSquareOrderPaid, squareConfigured } from '../lib/square.js';
import { markPaid, newOrderCode, newOrderToken, orderItems, sendOrderEmails, type OrderRow } from '../lib/orders.js';
import { sendMail } from '../lib/mail.js';
import { imageInfo } from '../lib/images.js';
import { formatPickupDate } from '../lib/time.js';

function checkoutEnabled(): boolean {
  const c = config.checkout;
  if (c.mode === 'square-api') return squareConfigured();
  if (c.mode === 'square-link') return !!c.staticCheckoutUrl;
  return false;
}

interface ProductRow {
  id: number; name: string; price_cents: number; sold_out: number; allow_notes: number; max_per_order: number;
}
interface OptionRow { id: number; product_id: number; name: string; price_cents: number; sold_out: number }

export function registerPublic(r: Router): void {
  r.get('/api/bootstrap', (_req, res) => {
    sendJson(res, 200, {
      categories: publicCategories(),
      products: publicProducts(),
      drops: currentDrops(),
      settings: publicSettings(),
      images: { hero: imageInfo(getSettings().hero_image_id), founder: imageInfo(getSettings().founder_image_id) },
      faqs: all('SELECT id, question, answer FROM faqs WHERE visible = 1 ORDER BY sort, id'),
      reviews: all('SELECT id, author, body, source FROM reviews WHERE visible = 1 ORDER BY sort, id'),
      checkout: { enabled: checkoutEnabled(), mode: config.checkout.mode },
      serverTime: new Date().toISOString()
    });
  });

  // ------------------------------------------------------------- checkout
  r.post('/api/checkout', async (req, res) => {
    rateLimit(`checkout:${req.ip}`, 12, 10 * 60_000);
    if (!checkoutEnabled()) throw new HttpError(503, "Online ordering isn't switched on yet.");
    const b = await readJson<Record<string, unknown>>(req, 32 * 1024);

    const name = str(b.name, 'Name', { max: 80 });
    const mail = email(b.email);
    const tel = phone(b.phone);
    const notes = str(b.notes, 'Order note', { max: 500, optional: true });
    const dropId = int(b.dropId, 'Pickup date', { min: 1, max: 1e9 });
    if (!Array.isArray(b.items) || b.items.length === 0) throw new HttpError(400, 'Your fairy basket is empty.');
    if (b.items.length > 40) throw new HttpError(400, 'That basket is a bit too big. Try catering instead?');

    // Re-price everything from the database. Client prices are never trusted.
    const perProductQty = new Map<number, number>();
    const lines = b.items.map((raw, i) => {
      const it = (raw ?? {}) as Record<string, unknown>;
      const productId = int(it.productId, `Item ${i + 1}`, { min: 1, max: 1e9 });
      const qty = int(it.qty, 'Quantity', { min: 1, max: 99 });
      const p = get<ProductRow>(
        `SELECT p.id, p.name, p.price_cents, p.sold_out, p.allow_notes, p.max_per_order
           FROM products p JOIN categories c ON c.id = p.category_id
          WHERE p.id = ? AND p.available = 1 AND c.active = 1`, [productId]
      );
      if (!p) throw new HttpError(409, 'Something in your basket is no longer on the menu. Refresh and try again.');
      if (p.sold_out) throw new HttpError(409, `${p.name} just sold out. You guys ate this one up.`);
      const options = all<OptionRow>('SELECT * FROM product_options WHERE product_id = ?', [p.id]);
      let unit = p.price_cents;
      let optionId: number | null = null;
      let optionName = '';
      if (options.length > 0) {
        const oid = int(it.optionId, 'Option', { min: 1, max: 1e9 });
        const opt = options.find((o) => o.id === oid);
        if (!opt) throw new HttpError(409, `Pick a size for ${p.name}.`);
        if (opt.sold_out) throw new HttpError(409, `${p.name} (${opt.name}) just sold out.`);
        unit = opt.price_cents; optionId = opt.id; optionName = opt.name;
      }
      const itemNotes = p.allow_notes ? str(it.notes, 'Item note', { max: 200, optional: true }) : '';
      const total = (perProductQty.get(p.id) ?? 0) + qty;
      if (total > p.max_per_order) throw new HttpError(409, `You can order up to ${p.max_per_order} of ${p.name} per order.`);
      perProductQty.set(p.id, total);
      return { productId: p.id, optionId, name: p.name, optionName, unit, qty, notes: itemNotes };
    });

    const subtotal = lines.reduce((s, l) => s + l.unit * l.qty, 0);
    const pct = taxPercent();
    const tax = Math.round((subtotal * pct) / 100);
    const settings = getSettings();

    const order = tx(() => {
      const drop = getDrop(dropId);
      if (!drop || dropState(drop) !== 'open') {
        throw new HttpError(409, "That pickup date isn't taking orders anymore. Pick another one.");
      }
      const code = newOrderCode();
      const token = newOrderToken();
      const { lastId } = run(
        `INSERT INTO orders (code, token, drop_id, customer_name, email, phone, notes, subtotal_cents, tax_cents, total_cents, checkout_mode)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [code, token, dropId, name, mail, tel, notes, subtotal, tax, subtotal + tax, config.checkout.mode]
      );
      for (const l of lines) {
        run(
          `INSERT INTO order_items (order_id, product_id, option_id, name, option_name, unit_cents, qty, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [lastId, l.productId, l.optionId, l.name, l.optionName, l.unit, l.qty, l.notes]
        );
      }
      return { id: lastId, code, token, drop };
    });

    if (config.checkout.mode === 'square-link') {
      return sendJson(res, 201, { redirectUrl: `/order/${order.token}`, external: false });
    }

    try {
      const link = await createPaymentLink({
        idempotencyKey: order.token,
        referenceId: order.code,
        items: lines.map((l) => ({
          name: l.optionName ? `${l.name} (${l.optionName})` : l.name,
          qty: l.qty,
          unitCents: l.unit,
          note: l.notes || undefined
        })),
        taxPercent: pct,
        taxLabel: settings.tax_label ?? 'Tax',
        redirectUrl: `${config.siteUrl}/order/${order.token}`,
        buyerEmail: mail,
        buyerPhoneE164: toE164(tel),
        paymentNote: `Food Fairy ${order.code} — pickup ${formatPickupDate(order.drop.pickup_date)}`
      });
      const total = link.totalCents ?? subtotal + tax;
      run(
        `UPDATE orders SET square_payment_link_id = ?, square_order_id = ?, total_cents = ?, tax_cents = ? WHERE id = ?`,
        [link.linkId, link.orderId, total, total - subtotal, order.id]
      );
      sendJson(res, 201, { redirectUrl: link.url, external: true });
    } catch (err) {
      console.error('[checkout] Square error:', (err as Error).message);
      run(`UPDATE orders SET status = 'cancelled' WHERE id = ?`, [order.id]);
      throw new HttpError(502, "Couldn't reach the payment page. Nothing was charged — try again in a moment.");
    }
  });

  // ------------------------------------------------------------- order status
  r.get('/api/orders/:token', async (req, res, params) => {
    const token = params.token ?? '';
    if (!/^[A-Za-z0-9_-]{32}$/.test(token)) throw new HttpError(404, 'Order not found');
    rateLimit(`order-view:${req.ip}`, 60, 60_000);
    let o = get<OrderRow>('SELECT * FROM orders WHERE token = ?', [token]);
    if (!o) throw new HttpError(404, 'Order not found');

    // Webhook is the main signal; this is a fallback for when the customer
    // lands back before (or without) the webhook arriving.
    const ageMs = Date.now() - Date.parse(o.created_at);
    if (o.status === 'pending' && o.checkout_mode === 'square_api' && o.square_order_id && ageMs < 48 * 3600_000 && squareConfigured()) {
      try {
        rateLimit(`square-poll:${o.id}`, 20, 60_000);
        const s = await isSquareOrderPaid(o.square_order_id);
        if (s.paid) {
          await markPaid(o.id, s.paymentId);
          o = get<OrderRow>('SELECT * FROM orders WHERE id = ?', [o.id])!;
        }
      } catch (err) {
        if (!(err instanceof HttpError)) console.error('[order] Square poll failed:', (err as Error).message);
      }
    }

    const drop = getDrop(o.drop_id)!;
    const settings = getSettings();
    const confirmed = ['paid', 'ready', 'picked_up'].includes(o.status);
    sendJson(res, 200, {
      code: o.code,
      status: o.status,
      checkoutMode: o.checkout_mode,
      firstName: o.customer_name.split(/\s+/)[0],
      pickupDate: drop.pickup_date,
      pickupWindow: drop.pickup_window,
      pickupArea: settings.pickup_area ?? '',
      // Private pickup details are only revealed for confirmed orders.
      pickupInstructions: confirmed ? settings.pickup_instructions ?? '' : '',
      payUrl: o.checkout_mode === 'square_link' && o.status === 'pending' ? config.checkout.staticCheckoutUrl : '',
      items: orderItems(o.id).map((i) => ({ name: i.name, optionName: i.option_name, qty: i.qty, unitCents: i.unit_cents, notes: i.notes })),
      subtotalCents: o.subtotal_cents,
      taxCents: o.tax_cents,
      totalCents: o.total_cents,
      taxLabel: settings.tax_label ?? 'Tax'
    });
  });

  // ------------------------------------------------------------- inquiries
  r.post('/api/inquiries', async (req, res) => {
    rateLimit(`inquiry:${req.ip}`, 6, 60 * 60_000);
    const b = await readJson<Record<string, unknown>>(req, 16 * 1024);
    // Honeypot: real people never see or fill this field.
    if (typeof b.website === 'string' && b.website.trim() !== '') return sendJson(res, 201, { ok: true });

    const kind = b.kind === 'catering' ? 'catering' : b.kind === 'contact' ? 'contact' : null;
    if (!kind) throw new HttpError(400, 'Unknown inquiry type');
    const name = str(b.name, 'Name', { max: 80 });
    const mail = email(b.email);
    let payload: Record<string, string | number>;

    if (kind === 'catering') {
      const EVENT_TYPES = ['Corporate', 'Celebration', 'Family event', 'Private event', 'Something else'];
      const eventType = str(b.eventType, 'Event type', { max: 40 });
      if (!EVENT_TYPES.includes(eventType)) throw new HttpError(400, 'Pick an event type');
      payload = {
        phone: phone(b.phone),
        eventDate: ymd(b.eventDate, 'Event date'),
        eventType,
        guestCount: int(b.guestCount, 'Guest count', { min: 1, max: 5000 }),
        location: str(b.location, 'Location', { max: 120 }),
        interestedIn: str(b.interestedIn, 'What you’re interested in', { max: 600, optional: true }),
        budget: str(b.budget, 'Budget', { max: 40, optional: true }),
        dietary: str(b.dietary, 'Dietary restrictions', { max: 600, optional: true }),
        details: str(b.details, 'Additional details', { max: 2000, optional: true })
      };
    } else {
      payload = {
        phone: str(b.phone, 'Phone', { max: 32, optional: true }),
        message: str(b.message, 'Message', { max: 2000 })
      };
    }

    run('INSERT INTO inquiries (kind, name, email, payload) VALUES (?, ?, ?, ?)', [kind, name, mail, JSON.stringify(payload)]);
    const body = [`From: ${name} <${mail}>`, '', ...Object.entries(payload).filter(([, v]) => v !== '').map(([k, v]) => `${k}: ${v}`), '', `Admin: ${config.siteUrl}/admin`].join('\n');
    void sendMail(config.mail.ownerEmail, kind === 'catering' ? `Catering inquiry — ${name}` : `Message from ${name}`, body, mail);
    sendJson(res, 201, { ok: true });
  });
}

export { sendOrderEmails };
