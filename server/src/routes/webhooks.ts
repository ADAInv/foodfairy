import { get, run } from '../db.js';
import { readBody, sendJson, type Router } from '../http.js';
import { verifyWebhook } from '../lib/square.js';
import { markPaid } from '../lib/orders.js';

export function registerWebhooks(r: Router): void {
  r.post('/api/webhooks/square', async (req, res) => {
    const raw = await readBody(req, 256 * 1024);
    const sig = String(req.headers['x-square-hmacsha256-signature'] ?? '');
    if (!verifyWebhook(raw, sig)) return sendJson(res, 401, { error: 'bad signature' });

    let event: { event_id?: string; type?: string; data?: { object?: { payment?: { id: string; order_id?: string; status?: string } } } };
    try { event = JSON.parse(raw.toString('utf8')); } catch { return sendJson(res, 400, { error: 'bad json' }); }

    if (event.event_id) {
      const seen = run('INSERT OR IGNORE INTO webhook_events (event_id) VALUES (?)', [event.event_id]);
      if (seen.changes === 0) return sendJson(res, 200, { ok: true, duplicate: true });
    }

    const payment = event.data?.object?.payment;
    if ((event.type === 'payment.created' || event.type === 'payment.updated') && payment?.status === 'COMPLETED' && payment.order_id) {
      const order = get<{ id: number }>('SELECT id FROM orders WHERE square_order_id = ?', [payment.order_id]);
      if (order) await markPaid(order.id, payment.id);
    }
    sendJson(res, 200, { ok: true });
  });
}
