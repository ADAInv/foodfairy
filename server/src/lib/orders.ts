import { randomBytes } from 'node:crypto';
import { all, get, run } from '../db.js';
import { config } from '../config.js';
import { getSettings } from './settings.js';
import { sendMail, money } from './mail.js';
import { formatPickupDate } from './time.js';

export interface OrderRow {
  id: number; code: string; token: string; drop_id: number; customer_name: string; email: string; phone: string;
  notes: string; subtotal_cents: number; tax_cents: number; total_cents: number; status: string;
  checkout_mode: string; square_payment_link_id: string | null; square_order_id: string | null;
  square_payment_id: string | null; confirmation_emailed: number; created_at: string; paid_at: string | null;
}
export interface OrderItemRow {
  id: number; order_id: number; product_id: number | null; option_id: number | null; name: string;
  option_name: string; unit_cents: number; qty: number; notes: string;
}

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export function newOrderCode(): string {
  for (;;) {
    const bytes = randomBytes(5);
    let code = 'FF-';
    for (const b of bytes) code += ALPHABET[b % ALPHABET.length];
    if (!get('SELECT 1 FROM orders WHERE code = ?', [code])) return code;
  }
}
export const newOrderToken = () => randomBytes(24).toString('base64url');

export function orderItems(orderId: number): OrderItemRow[] {
  return all<OrderItemRow>('SELECT * FROM order_items WHERE order_id = ? ORDER BY id', [orderId]);
}

/** Idempotent: only the first transition from pending -> paid sends emails. */
export async function markPaid(orderId: number, paymentId: string | null): Promise<void> {
  const r = run(
    `UPDATE orders SET status = 'paid', paid_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
       square_payment_id = COALESCE(?, square_payment_id)
     WHERE id = ? AND status = 'pending'`,
    [paymentId, orderId]
  );
  if (r.changes === 0) return;
  await sendOrderEmails(orderId);
}

export async function sendOrderEmails(orderId: number): Promise<void> {
  const claimed = run('UPDATE orders SET confirmation_emailed = 1 WHERE id = ? AND confirmation_emailed = 0', [orderId]);
  if (claimed.changes === 0) return;
  const o = get<OrderRow & { pickup_date: string; pickup_window: string }>(
    'SELECT o.*, d.pickup_date, d.pickup_window FROM orders o JOIN drops d ON d.id = o.drop_id WHERE o.id = ?', [orderId]
  );
  if (!o) return;
  const s = getSettings();
  const items = orderItems(orderId);
  const lines = items.map((i) => `  ${i.qty} × ${i.name}${i.option_name ? ` (${i.option_name})` : ''} — ${money(i.unit_cents * i.qty)}${i.notes ? `\n     note: ${i.notes}` : ''}`);
  const pickup = `${formatPickupDate(o.pickup_date)}${o.pickup_window ? `, ${o.pickup_window}` : ''}`;

  await sendMail(
    o.email,
    `It's official ✦ Food Fairy order ${o.code}`,
    [
      `Hi ${o.customer_name},`,
      '',
      'Your Food Fairy order is in. Now comes the hard part: waiting.',
      '',
      `Order: ${o.code}`,
      `Pickup: ${pickup}`,
      '',
      ...lines,
      '',
      `Total: ${money(o.total_cents)}`,
      '',
      'Pickup instructions:',
      s.pickup_instructions ?? '',
      '',
      `View your order: ${config.siteUrl}/order/${o.token}`,
      '',
      '— Firdaos, The Food Fairy'
    ].join('\n'),
    s.contact_email || undefined
  );

  await sendMail(
    config.mail.ownerEmail,
    `New order ${o.code} — ${money(o.total_cents)} — pickup ${o.pickup_date}`,
    [
      `${o.customer_name} · ${o.email} · ${o.phone}`,
      `Pickup: ${pickup}`,
      o.notes ? `Order note: ${o.notes}` : '',
      '',
      ...lines,
      '',
      `Total: ${money(o.total_cents)}`,
      `Admin: ${config.siteUrl}/admin`
    ].filter((l) => l !== null).join('\n'),
    o.email
  );
}
