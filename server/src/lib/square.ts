// Square integration with plain fetch — no Square SDK.
// Docs: Checkout API (CreatePaymentLink), Orders API, webhook signatures.

import { createHmac } from 'node:crypto';
import { config, squareBaseUrl } from '../config.js';
import { safeEqual } from './auth.js';

export interface SquareLineItem { name: string; qty: number; unitCents: number; note?: string }

interface CreateLinkInput {
  idempotencyKey: string;
  referenceId: string;          // our order code
  items: SquareLineItem[];
  taxPercent: number;
  taxLabel: string;
  redirectUrl: string;
  buyerEmail: string;
  buyerPhoneE164: string;
  paymentNote: string;
}

export interface CreatedLink { linkId: string; url: string; orderId: string; totalCents: number | null }

async function squareFetch(path: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${squareBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Authorization': `Bearer ${config.checkout.accessToken}`,
      'Square-Version': config.checkout.apiVersion,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    signal: AbortSignal.timeout(15_000)
  });
  const body = (await res.json().catch(() => ({}))) as { errors?: { code: string; detail?: string }[] };
  if (!res.ok) {
    const detail = body.errors?.map((e) => `${e.code}: ${e.detail ?? ''}`).join('; ') ?? res.statusText;
    throw new Error(`Square ${res.status} ${path} — ${detail}`);
  }
  return body;
}

export function squareConfigured(): boolean {
  const c = config.checkout;
  return c.mode === 'square-api' && !!c.accessToken && !!c.locationId;
}

export async function createPaymentLink(input: CreateLinkInput): Promise<CreatedLink> {
  const order: Record<string, unknown> = {
    location_id: config.checkout.locationId,
    reference_id: input.referenceId,
    line_items: input.items.map((i) => ({
      name: i.name.slice(0, 500),
      quantity: String(i.qty),
      base_price_money: { amount: i.unitCents, currency: config.currency },
      ...(i.note ? { note: i.note.slice(0, 500) } : {})
    }))
  };
  if (input.taxPercent > 0) {
    order.taxes = [{ uid: 'sales-tax', name: input.taxLabel || 'Tax', percentage: String(input.taxPercent), scope: 'ORDER' }];
  }
  const pre: Record<string, string> = { buyer_email: input.buyerEmail };
  if (input.buyerPhoneE164) pre.buyer_phone_number = input.buyerPhoneE164;

  const body = (await squareFetch('/v2/online-checkout/payment-links', {
    method: 'POST',
    body: JSON.stringify({
      idempotency_key: input.idempotencyKey,
      order,
      checkout_options: { redirect_url: input.redirectUrl, ask_for_shipping_address: false },
      pre_populated_data: pre,
      payment_note: input.paymentNote.slice(0, 500)
    })
  })) as {
    payment_link: { id: string; url: string; order_id: string };
    related_resources?: { orders?: { total_money?: { amount: number } }[] };
  };
  return {
    linkId: body.payment_link.id,
    url: body.payment_link.url,
    orderId: body.payment_link.order_id,
    totalCents: body.related_resources?.orders?.[0]?.total_money?.amount ?? null
  };
}

/** Ask Square directly whether an order has been fully paid. */
export async function isSquareOrderPaid(orderId: string): Promise<{ paid: boolean; paymentId: string | null }> {
  const body = (await squareFetch(`/v2/orders/${encodeURIComponent(orderId)}`)) as {
    order?: { state?: string; tenders?: { id: string; payment_id?: string }[]; net_amount_due_money?: { amount: number } };
  };
  const o = body.order;
  const tenders = o?.tenders ?? [];
  const paid = tenders.length > 0 && (o?.state === 'COMPLETED' || (o?.net_amount_due_money?.amount ?? 1) === 0);
  return { paid, paymentId: tenders[0]?.payment_id ?? tenders[0]?.id ?? null };
}

/** Verify x-square-hmacsha256-signature: base64(HMAC_SHA256(key, url + body)). */
export function verifyWebhook(rawBody: Buffer, signature: string): boolean {
  const { webhookSignatureKey, webhookUrl } = config.checkout;
  if (!webhookSignatureKey || !webhookUrl || !signature) return false;
  const expected = createHmac('sha256', webhookSignatureKey).update(webhookUrl + rawBody.toString('utf8')).digest('base64');
  return safeEqual(expected, signature);
}
