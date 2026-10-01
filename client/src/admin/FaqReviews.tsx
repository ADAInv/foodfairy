import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { Input, TextArea } from '../components/Field';
import type { AFaq, AReview } from './types';
import { Panel, Status, Toggle, useAction, useLoad } from './ui';

type Field<T> = { key: keyof T & string; label: string; long?: boolean; max: number; optional?: boolean; hint?: string };

function ListEditor<T extends { id: number; sort: number; visible: 0 | 1 }>({ path, title, intro, fields, summary, blank }: {
  path: string; title: string; intro: string; fields: Field<T>[]; summary: (row: T) => { head: string; sub: string }; blank: Record<string, string>;
}) {
  const { data, error, reload } = useLoad<T[]>(path);
  const [editing, setEditing] = useState<T | 'new' | null>(null);
  const [f, setF] = useState<Record<string, string | boolean>>({});
  const act = useAction();

  const start = (row: T | 'new') => {
    setEditing(row);
    if (row === 'new') setF({ ...blank, sort: String((data?.at(-1)?.sort ?? 0) + 1), visible: true });
    else setF({ ...Object.fromEntries(fields.map((x) => [x.key, String(row[x.key] ?? '')])), sort: String(row.sort), visible: !!row.visible });
  };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const body = { ...f, sort: Number(f.sort || 0) };
    const ok = await act.run(() => (editing === 'new' ? api(path, { body }) : api(`${path}/${(editing as T).id}`, { method: 'PUT', body })));
    if (ok) { setEditing(null); await reload(); }
  };
  const remove = async (row: T) => {
    if (!confirm('Delete this?')) return;
    if (await act.run(() => api(`${path}/${row.id}`, { method: 'DELETE' }))) { setEditing(null); await reload(); }
  };

  return (
    <Panel title={title} action={<button type="button" className="btn btn-dark min-h-11 px-4 text-[0.8rem]" onClick={() => start('new')}>Add</button>}>
      <p className="mb-4 text-[0.95rem] text-ink-2">{intro}</p>
      <Status error={error ?? act.error} />
      {editing ? (
        <form onSubmit={save} className="mb-6 space-y-4 rounded-2xl bg-wash p-4">
          {fields.map((x) => x.long
            ? <TextArea key={x.key} id={`le-${x.key}`} label={x.label} optional={x.optional} maxLength={x.max} hint={x.hint} value={String(f[x.key] ?? '')} onChange={(e) => setF({ ...f, [x.key]: e.target.value })} />
            : <Input key={x.key} id={`le-${x.key}`} label={x.label} optional={x.optional} maxLength={x.max} hint={x.hint} value={String(f[x.key] ?? '')} onChange={(e) => setF({ ...f, [x.key]: e.target.value })} />)}
          <div className="flex flex-wrap items-end gap-6">
            <div className="w-28"><Input id="le-sort" label="Order" type="number" value={String(f.sort ?? 0)} onChange={(e) => setF({ ...f, sort: e.target.value })} /></div>
            <Toggle checked={!!f.visible} onChange={(v) => setF({ ...f, visible: v })} label="Show on site" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn btn-dark" disabled={act.busy}>Save</button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
            {editing !== 'new' ? <button type="button" className="ml-auto font-semibold underline" onClick={() => void remove(editing)}>Delete</button> : null}
          </div>
        </form>
      ) : null}
      {data?.length === 0 ? <p>None yet.</p> : null}
      <ul className="divide-y divide-ink/10">
        {data?.map((row) => {
          const s = summary(row);
          return (
            <li key={row.id}>
              <button type="button" onClick={() => start(row)} className={`block w-full py-3 text-left ${row.visible ? '' : 'opacity-50'}`}>
                <span className="block font-bold">{s.head}{row.visible ? '' : ' (hidden)'}</span>
                <span className="line-clamp-2 block text-sm text-ink-2">{s.sub}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export function FaqTab() {
  return (
    <ListEditor<AFaq> path="/api/admin/faqs" title="FAQ" intro="Shown on the FAQ page, in this order."
      blank={{ question: '', answer: '' }}
      fields={[{ key: 'question', label: 'Question', max: 200 }, { key: 'answer', label: 'Answer', long: true, max: 1500 }]}
      summary={(r) => ({ head: r.question, sub: r.answer })} />
  );
}

export function ReviewsTab() {
  return (
    <ListEditor<AReview> path="/api/admin/reviews" title="Reviews"
      intro="Real words from real customers only. The reviews section stays hidden on the homepage until at least one is visible."
      blank={{ author: '', body: '', source: '' }}
      fields={[
        { key: 'body', label: 'What they said', long: true, max: 600 },
        { key: 'author', label: 'Name', max: 60, hint: 'First name or initials is fine, with their OK.' },
        { key: 'source', label: 'Where', optional: true, max: 60, hint: 'e.g. Instagram DM, Google' }
      ]}
      summary={(r) => ({ head: r.author, sub: r.body })} />
  );
}
