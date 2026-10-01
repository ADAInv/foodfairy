import { useState } from 'react';
import { api } from '../lib/api';
import type { AInquiry } from './types';
import { Panel, Pill, Status, fmtDateTime, useAction, useLoad } from './ui';

const LABELS: Record<string, string> = {
  phone: 'Phone', eventDate: 'Event date', eventType: 'Event type', guestCount: 'Guests', location: 'Location',
  interestedIn: 'Interested in', budget: 'Budget', dietary: 'Dietary', details: 'Details', message: 'Message'
};

export function InquiriesTab() {
  const { data, error, reload } = useLoad<AInquiry[]>('/api/admin/inquiries');
  const [show, setShow] = useState<'active' | 'archived'>('active');
  const act = useAction();
  const setStatus = (q: AInquiry, status: AInquiry['status']) =>
    void act.run(async () => { await api(`/api/admin/inquiries/${q.id}`, { method: 'PUT', body: { status } }); await reload(); }, { flash: false });
  const list = (data ?? []).filter((q) => (show === 'archived' ? q.status === 'archived' : q.status !== 'archived'));

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {(['active', 'archived'] as const).map((v) => (
          <button key={v} type="button" aria-pressed={show === v} onClick={() => setShow(v)}
            className={`min-h-10 rounded-full px-4 text-[0.9rem] font-semibold ${show === v ? 'bg-ink text-paper' : 'bg-wash'}`}>{v === 'active' ? 'Inbox' : 'Archived'}</button>
        ))}
      </div>
      <Status error={error ?? act.error} />
      {data && list.length === 0 ? <Panel><p>Nothing here.</p></Panel> : null}
      <ul className="space-y-4">
        {list.map((q) => (
          <li key={q.id}>
            <Panel>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[0.8rem] font-bold uppercase tracking-[0.12em] text-ink-2">{q.kind === 'catering' ? 'Catering inquiry' : 'Message'} · {fmtDateTime(q.created_at)}</p>
                  <p className="mt-1 text-[1.15rem] font-bold">{q.name}</p>
                  <a className="text-sm underline" href={`mailto:${q.email}?subject=${encodeURIComponent(q.kind === 'catering' ? 'Your catering inquiry — The Food Fairy' : 'Re: your message — The Food Fairy')}`}>{q.email}</a>
                </div>
                <Pill state={q.status} />
              </div>
              <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-[10rem_1fr]">
                {Object.entries(q.payload).filter(([, v]) => v !== '' && v !== null).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="font-semibold text-ink-2">{LABELS[k] ?? k}</dt>
                    <dd className="whitespace-pre-line">{k === 'phone' ? <a className="underline" href={`tel:${v}`}>{v}</a> : String(v)}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 flex flex-wrap gap-2 text-[0.9rem]">
                {q.status === 'new' ? <button type="button" className="rounded-full bg-wash px-4 py-2 font-semibold" onClick={() => setStatus(q, 'replied')}>Mark replied</button> : null}
                {q.status !== 'archived' ? <button type="button" className="rounded-full bg-wash px-4 py-2 font-semibold" onClick={() => setStatus(q, 'archived')}>Archive</button>
                  : <button type="button" className="rounded-full bg-wash px-4 py-2 font-semibold" onClick={() => setStatus(q, 'new')}>Move to inbox</button>}
              </div>
            </Panel>
          </li>
        ))}
      </ul>
    </div>
  );
}
