import { useState } from 'react';
import { api } from '../lib/api';
import { moneyExact } from '../lib/format';
import type { ADrop, AOrder, Me, OrderStatus } from './types';
import { Panel, Pill, Status, fmtDateTime, useAction, useLoad } from './ui';

const FILTERS: [string, string][] = [['paid', 'To prep'], ['ready', 'Ready'], ['pending', 'Awaiting payment'], ['picked_up', 'Picked up'], ['cancelled', 'Cancelled'], ['', 'All']];
const NEXT: Partial<Record<OrderStatus, [OrderStatus, string][]>> = {
  paid: [['ready', 'Mark ready'], ['picked_up', 'Picked up']],
  ready: [['picked_up', 'Picked up'], ['paid', 'Back to prep']],
  picked_up: [['ready', 'Undo pickup']]
};

export function OrdersTab({ me }: { me: Me }) {
  // Manual Square-link mode: new orders wait for her to confirm payment, so start there.
  const [status, setStatus] = useState(me.checkoutMode === 'square_link' ? 'pending' : 'paid');
  const [drop, setDrop] = useState('');
  const drops = useLoad<ADrop[]>('/api/admin/drops');
  const qs = new URLSearchParams({ ...(status ? { status } : {}), ...(drop ? { drop } : {}) }).toString();
  const orders = useLoad<AOrder[]>(`/api/admin/orders${qs ? `?${qs}` : ''}`);
  const act = useAction();

  const change = (o: AOrder, to: OrderStatus) => {
    if (to === 'cancelled' && !confirm(`Cancel ${o.code}? Refunds are done in Square.`)) return;
    if (to === 'paid' && o.status === 'pending' && !confirm(`Confirm you received payment for ${o.code}? The customer gets their confirmation email with pickup details.`)) return;
    void act.run(async () => { await api(`/api/admin/orders/${o.id}/status`, { method: 'PUT', body: { status: to } }); await orders.reload(); }, { flash: false });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(([v, label]) => (
          <button key={v} type="button" aria-pressed={status === v} onClick={() => setStatus(v)}
            className={`min-h-10 rounded-full px-4 text-[0.9rem] font-semibold ${status === v ? 'bg-ink text-paper' : 'bg-wash'}`}>{label}</button>
        ))}
      </div>
      <label className="block max-w-xs">
        <span className="label">Pickup</span>
        <select className="field" value={drop} onChange={(e) => setDrop(e.target.value)}>
          <option value="">All order windows</option>
          {drops.data?.map((d) => <option key={d.id} value={d.id}>{d.pickup_date}{d.title ? ` · ${d.title}` : ''}</option>)}
        </select>
      </label>
      {status === 'pending' ? (
        <p className="rounded-2xl bg-wash-2 px-4 py-3 text-[0.95rem]">
          {me.checkoutMode === 'square_link'
            ? 'These customers were sent to your Square link. Check Square for their payment, then mark them paid.'
            : 'These people started checkout but haven’t paid. Unpaid orders stop holding a spot after 30 minutes.'}
        </p>
      ) : null}
      <Status error={orders.error ?? act.error} />
      {orders.data?.length === 0 ? <Panel><p>No orders here.</p></Panel> : null}
      <ul className="space-y-4">
        {orders.data?.map((o) => (
          <li key={o.id}>
            <Panel>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="display text-[1.5rem] leading-none">{o.code}</p>
                  <p className="mt-1 font-semibold">{o.customer_name}</p>
                  <p className="text-sm text-ink-2">
                    <a className="underline" href={`mailto:${o.email}`}>{o.email}</a>
                    {o.phone ? <> · <a className="underline" href={`tel:${o.phone}`}>{o.phone}</a></> : null}
                  </p>
                </div>
                <div className="text-right">
                  <Pill state={o.status} />
                  <p className="mt-1 text-sm text-ink-2">Pickup {o.pickup_date}</p>
                </div>
              </div>
              <ul className="mt-4 space-y-1 border-t border-ink/10 pt-3">
                {o.items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-3">
                    <span><b className="tabular-nums">{i.qty}×</b> {i.name}{i.option_name ? ` · ${i.option_name}` : ''}{i.notes ? <span className="block pl-7 text-sm italic text-ink-2">“{i.notes}”</span> : null}</span>
                    <span className="tabular-nums">{moneyExact(i.unit_cents * i.qty)}</span>
                  </li>
                ))}
              </ul>
              {o.notes ? <p className="mt-3 rounded-xl bg-wash px-3 py-2 text-[0.95rem]"><b>Note:</b> {o.notes}</p> : null}
              <p className="mt-3 text-right font-bold tabular-nums">
                {o.tax_cents ? <span className="mr-3 font-normal text-ink-2">incl. {moneyExact(o.tax_cents)} tax</span> : null}
                {moneyExact(o.total_cents)}
              </p>
              <p className="text-right text-xs text-ink-2">Placed {fmtDateTime(o.created_at)}{o.paid_at ? ` · paid ${fmtDateTime(o.paid_at)}` : ''}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-[0.9rem]">
                {o.status === 'pending' ? <button type="button" className="btn btn-dark min-h-11 px-4 text-[0.8rem]" onClick={() => change(o, 'paid')}>Mark paid</button> : null}
                {(NEXT[o.status] ?? []).map(([to, label]) => (
                  <button key={to} type="button" className="rounded-full bg-wash px-4 py-2 font-semibold hover:bg-wash-2" onClick={() => change(o, to)}>{label}</button>
                ))}
                {o.status !== 'cancelled' && o.status !== 'picked_up' ? <button type="button" className="rounded-full px-4 py-2 font-semibold underline" onClick={() => change(o, 'cancelled')}>Cancel</button> : null}
              </div>
            </Panel>
          </li>
        ))}
      </ul>
    </div>
  );
}
