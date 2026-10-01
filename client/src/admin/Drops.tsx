import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { Input, TextArea } from '../components/Field';
import type { ADrop } from './types';
import { Panel, Pill, Status, Toggle, fmtDateTime, useAction, useLoad } from './ui';

interface Form { title: string; opens_local: string; closes_local: string; pickup_date: string; pickup_window: string; paused: boolean; max_orders: string; note: string }
const EMPTY: Form = { title: '', opens_local: '', closes_local: '', pickup_date: '', pickup_window: '', paused: false, max_orders: '', note: '' };

const toForm = (d: ADrop): Form => ({
  title: d.title, opens_local: d.opens_local, closes_local: d.closes_local, pickup_date: d.pickup_date,
  pickup_window: d.pickup_window, paused: !!d.paused, max_orders: d.max_orders === null ? '' : String(d.max_orders), note: d.note
});

/** Shift "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM" by whole days, keeping the clock time. */
function plusDays(s: string, days: number): string {
  const [date, time] = s.split('T');
  const [y, m, d] = date!.split('-').map(Number);
  const out = new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
  return time ? `${out}T${time}` : out;
}

export function DropsTab() {
  const { data, error, reload } = useLoad<ADrop[]>('/api/admin/drops');
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [prepFor, setPrepFor] = useState<ADrop | null>(null);
  const act = useAction();

  const start = (d: ADrop | null, copyNextWeek = false) => {
    if (!d) { setForm(EMPTY); setEditing('new'); }
    else if (copyNextWeek) {
      const f = toForm(d);
      setForm({ ...f, paused: false, opens_local: plusDays(f.opens_local, 7), closes_local: plusDays(f.closes_local, 7), pickup_date: plusDays(f.pickup_date, 7) });
      setEditing('new');
    } else { setForm(toForm(d)); setEditing(d.id); }
    setTimeout(() => document.getElementById('drop-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const body = { ...form, max_orders: form.max_orders.trim() === '' ? null : Number(form.max_orders) };
    const ok = await act.run(() => (editing === 'new' ? api('/api/admin/drops', { body }) : api(`/api/admin/drops/${editing}`, { method: 'PUT', body })));
    if (ok) { setEditing(null); await reload(); }
  };

  const togglePause = (d: ADrop) =>
    void act.run(async () => { await api(`/api/admin/drops/${d.id}`, { method: 'PUT', body: { ...toForm(d), paused: !d.paused } }); await reload(); });

  const remove = (d: ADrop) => {
    if (!confirm('Delete this order window?')) return;
    void act.run(async () => { await api(`/api/admin/drops/${d.id}`, { method: 'DELETE' }); await reload(); });
  };

  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  const latest = data?.[0] ?? null;

  return (
    <div className="space-y-6">
      <Panel title="Order windows" action={
        <div className="flex flex-wrap gap-2">
          {latest ? <button type="button" className="btn btn-ghost min-h-11 px-4 text-[0.8rem]" onClick={() => start(latest, true)}>Copy latest +1 week</button> : null}
          <button type="button" className="btn btn-dark min-h-11 px-4 text-[0.8rem]" onClick={() => start(null)}>New window</button>
        </div>
      }>
        <p className="mb-4 text-[0.95rem] text-ink-2">Customers can only order while a window is open, and only for its pickup date. All times are Kitchener/Waterloo time.</p>
        <Status error={error ?? act.error} />
        {data?.length === 0 ? <p>No windows yet.</p> : null}
        <ul className="divide-y divide-ink/10">
          {data?.map((d) => (
            <li key={d.id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold">{d.title || 'Order window'} · pickup {d.pickup_date}{d.pickup_window ? `, ${d.pickup_window}` : ''}</p>
                  <p className="text-sm text-ink-2">Opens {fmtDateTime(d.opens_at)} · closes {fmtDateTime(d.closes_at)}</p>
                  <p className="text-sm text-ink-2">{d.order_count} paid {d.order_count === 1 ? 'order' : 'orders'}{d.max_orders ? ` of ${d.max_orders} max` : ''}</p>
                </div>
                <Pill state={d.state} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[0.9rem]">
                <button type="button" className="rounded-full bg-wash px-4 py-2 font-semibold hover:bg-wash-2" onClick={() => start(d)}>Edit</button>
                {d.state !== 'closed' ? <button type="button" className="rounded-full bg-wash px-4 py-2 font-semibold hover:bg-wash-2" onClick={() => togglePause(d)}>{d.paused ? 'Resume orders' : 'Pause orders'}</button> : null}
                <button type="button" className="rounded-full bg-wash px-4 py-2 font-semibold hover:bg-wash-2" onClick={() => setPrepFor(d)}>What to cook</button>
                {d.order_count === 0 ? <button type="button" className="rounded-full px-4 py-2 font-semibold underline" onClick={() => remove(d)}>Delete</button> : null}
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      {editing !== null ? (
        <form id="drop-form" onSubmit={save} className="scroll-mt-32 space-y-5 rounded-3xl border-2 border-ink/20 bg-white/60 p-4 sm:p-6">
          <h2 className="display text-[1.7rem]">{editing === 'new' ? 'New order window' : 'Edit order window'}</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Input id="d-open" label="Orders open" type="datetime-local" value={form.opens_local} onChange={set('opens_local')} />
            <Input id="d-close" label="Orders close" type="datetime-local" value={form.closes_local} onChange={set('closes_local')} hint="The site shows this as “Orders close …”." />
            <Input id="d-pickup" label="Pickup date" type="date" value={form.pickup_date} onChange={set('pickup_date')} />
            <Input id="d-window" label="Pickup time" optional placeholder="e.g. 2 – 6 PM" maxLength={60} value={form.pickup_window} onChange={set('pickup_window')} />
            <Input id="d-title" label="Name" optional placeholder="e.g. Saturday drop" maxLength={60} value={form.title} onChange={set('title')} />
            <Input id="d-max" label="Max orders" optional type="number" inputMode="numeric" min={1} value={form.max_orders} onChange={set('max_orders')} hint="Orders stop automatically at this number." />
          </div>
          <TextArea id="d-note" label="Note shown to customers" optional maxLength={200} value={form.note} onChange={set('note')} />
          <Toggle checked={form.paused} onChange={(v) => setForm({ ...form, paused: v })} label="Paused (stop orders without changing times)" />
          <Status error={act.error} />
          <div className="flex flex-wrap gap-3">
            <button className="btn btn-dark" disabled={act.busy}>{act.busy ? 'Saving…' : 'Save window'}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      ) : null}

      {prepFor ? <Prep drop={prepFor} onClose={() => setPrepFor(null)} /> : null}
    </div>
  );
}

function Prep({ drop, onClose }: { drop: ADrop; onClose: () => void }) {
  const { data, error } = useLoad<{ name: string; option_name: string; qty: number }[]>(`/api/admin/drops/${drop.id}/prep`);
  return (
    <Panel title={`What to cook · pickup ${drop.pickup_date}`} action={<button type="button" className="font-semibold underline" onClick={onClose}>Close</button>}>
      <Status error={error} />
      {data?.length === 0 ? <p>No paid orders in this window yet.</p> : null}
      <ul className="divide-y divide-ink/10">
        {data?.map((r) => (
          <li key={r.name + r.option_name} className="flex items-center justify-between gap-4 py-3">
            <span className="font-semibold">{r.name}{r.option_name ? <span className="font-normal text-ink-2"> · {r.option_name}</span> : null}</span>
            <span className="display text-[1.6rem] tabular-nums">×{r.qty}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-ink-2">Counts paid, ready and picked-up orders. Special requests are on each order.</p>
    </Panel>
  );
}
