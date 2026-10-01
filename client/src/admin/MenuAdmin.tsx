import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { money } from '../lib/format';
import type { Img } from '../lib/types';
import { Input, Select, TextArea } from '../components/Field';
import type { ACategory, AProduct } from './types';
import { ImagePicker, Panel, Status, Toggle, centsToInput, parseMoney, useAction, useLoad } from './ui';

interface OptForm { name: string; price: string; sold_out: boolean }
interface Form {
  category_id: string; name: string; description: string; price: string; image: Img | null; available: boolean; sold_out: boolean;
  allow_notes: boolean; notes_prompt: string; max_per_order: string; sort: string; options: OptForm[];
}

const toForm = (p: AProduct | null, categoryId: number): Form => p ? {
  category_id: String(p.category_id), name: p.name, description: p.description, price: p.price_cents ? centsToInput(p.price_cents) : '',
  image: p.image, available: !!p.available, sold_out: !!p.sold_out, allow_notes: !!p.allow_notes, notes_prompt: p.notes_prompt,
  max_per_order: String(p.max_per_order), sort: String(p.sort),
  options: p.options.map((o) => ({ name: o.name, price: centsToInput(o.price_cents), sold_out: !!o.sold_out }))
} : {
  category_id: String(categoryId || ''), name: '', description: '', price: '', image: null, available: true, sold_out: false,
  allow_notes: false, notes_prompt: '', max_per_order: '20', sort: '0', options: []
};

export function MenuTab() {
  const products = useLoad<AProduct[]>('/api/admin/products');
  const cats = useLoad<ACategory[]>('/api/admin/categories');
  const [editing, setEditing] = useState<AProduct | 'new' | null>(null);
  const act = useAction();

  const flag = (p: AProduct, body: { sold_out?: boolean; available?: boolean }) =>
    void act.run(async () => { await api(`/api/admin/products/${p.id}/flags`, { body }); await products.reload(); }, { flash: false });

  if (editing) {
    return <ProductEditor product={editing === 'new' ? null : editing} categories={cats.data ?? []}
      onDone={async () => { setEditing(null); await products.reload(); await cats.reload(); window.scrollTo({ top: 0 }); }} />;
  }

  return (
    <div className="space-y-6">
      <Panel title="Menu" action={<button type="button" className="btn btn-dark min-h-11 px-4 text-[0.8rem]" onClick={() => setEditing('new')}>Add item</button>}>
        <p className="mb-4 text-[0.95rem] text-ink-2">“Sold out” keeps an item visible with “You guys ate this one up.” “Hidden” takes it off the site.</p>
        <Status error={products.error ?? act.error} />
        {(cats.data ?? []).map((c) => {
          const list = (products.data ?? []).filter((p) => p.category_id === c.id);
          if (!list.length) return null;
          return (
            <div key={c.id} className="mb-6">
              <h3 className="mb-2 text-[0.85rem] font-bold uppercase tracking-[0.12em] text-ink-2">{c.emoji} {c.name}</h3>
              <ul className="space-y-2">
                {list.map((p) => (
                  <li key={p.id} className={`flex flex-wrap items-center gap-3 rounded-2xl bg-wash p-3 ${p.available ? '' : 'opacity-60'}`}>
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-wash-2">
                      {p.image ? <img src={`/media/${p.image.id}-${p.image.sizes[0]}.webp`} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                    <button type="button" className="min-w-[11rem] flex-1 text-left" onClick={() => setEditing(p)}>
                      <span className="block font-bold">{p.name}{p.is_demo ? <span className="ml-2 inline-block whitespace-nowrap rounded-full bg-ink px-2 py-0.5 align-middle text-[0.7rem] text-paper">DEMO</span> : null}</span>
                      <span className="block text-sm text-ink-2">
                        {p.options.length ? `${p.options.length} sizes from ${money(Math.min(...p.options.map((o) => o.price_cents)))}` : money(p.price_cents)}
                      </span>
                    </button>
                    <div className="ml-auto flex gap-1 text-[0.85rem]">
                      <button type="button" aria-pressed={!!p.sold_out} onClick={() => flag(p, { sold_out: !p.sold_out })}
                        className={`rounded-full px-3 py-2 font-semibold ${p.sold_out ? 'bg-ink text-paper' : 'bg-paper'}`}>Sold out</button>
                      <button type="button" aria-pressed={!p.available} onClick={() => flag(p, { available: !p.available })}
                        className={`rounded-full px-3 py-2 font-semibold ${!p.available ? 'bg-ink text-paper' : 'bg-paper'}`}>Hidden</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {products.data?.length === 0 ? <p>No items yet. Add your first dish.</p> : null}
      </Panel>
      <Categories cats={cats.data ?? []} reload={cats.reload} />
    </div>
  );
}

function ProductEditor({ product, categories, onDone }: { product: AProduct | null; categories: ACategory[]; onDone: () => Promise<void> }) {
  const [f, setF] = useState<Form>(() => toForm(product, categories[0]?.id ?? 0));
  const act = useAction();
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const setOpt = (i: number, patch: Partial<OptForm>) => setF({ ...f, options: f.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    act.setError(null);
    const price = f.options.length ? (parseMoney(f.price || '0') ?? 0) : parseMoney(f.price);
    if (price === null) return act.setError('Price should look like 16 or 16.50');
    const options = [];
    for (const [i, o] of f.options.entries()) {
      const c = parseMoney(o.price);
      if (c === null || !o.name.trim()) return act.setError(`Size ${i + 1} needs a name and a price`);
      options.push({ name: o.name.trim(), price_cents: c, sold_out: o.sold_out });
    }
    const body = {
      category_id: Number(f.category_id), name: f.name, description: f.description, price_cents: price, image_id: f.image?.id ?? '',
      available: f.available, sold_out: f.sold_out, allow_notes: f.allow_notes, notes_prompt: f.notes_prompt,
      max_per_order: Number(f.max_per_order || 20), sort: Number(f.sort || 0), options
    };
    const ok = await act.run(() => (product ? api(`/api/admin/products/${product.id}`, { method: 'PUT', body }) : api('/api/admin/products', { body })));
    if (ok) await onDone();
  };

  const remove = async () => {
    if (!product || !confirm(`Delete “${product.name}”? Past orders keep their details.`)) return;
    if (await act.run(() => api(`/api/admin/products/${product.id}`, { method: 'DELETE' }))) await onDone();
  };

  return (
    <form onSubmit={save} className="space-y-5 rounded-3xl border-2 border-ink/20 bg-white/60 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="display text-[1.7rem]">{product ? 'Edit item' : 'New item'}</h2>
        <button type="button" className="font-semibold underline" onClick={() => void onDone()}>Back</button>
      </div>
      <ImagePicker label="Photo" image={f.image} alt={f.name} onChange={(image) => setF({ ...f, image })} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Input id="p-name" label="Name" maxLength={80} value={f.name} onChange={set('name')} />
        <Select id="p-cat" label="Category" value={f.category_id} onChange={set('category_id')}>
          <option value="" disabled>Pick one</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </Select>
      </div>
      <TextArea id="p-desc" label="Description" optional maxLength={280} value={f.description} onChange={set('description')} hint={`${f.description.length}/280. One or two lines.`} />

      <fieldset className="space-y-3">
        <legend className="label">Price</legend>
        {f.options.length === 0 ? (
          <Input id="p-price" label="Price ($)" inputMode="decimal" placeholder="16" value={f.price} onChange={set('price')} />
        ) : null}
        {f.options.map((o, i) => (
          <div key={i} className="grid grid-cols-[1fr_7rem_auto] items-end gap-2">
            <Input id={`o-name-${i}`} label={`Size ${i + 1}`} placeholder="e.g. Small tray" maxLength={60} value={o.name} onChange={(e) => setOpt(i, { name: e.target.value })} />
            <Input id={`o-price-${i}`} label="$" inputMode="decimal" value={o.price} onChange={(e) => setOpt(i, { price: e.target.value })} />
            <button type="button" aria-label={`Remove size ${i + 1}`} className="mb-1 h-11 rounded-full px-3 font-semibold underline" onClick={() => setF({ ...f, options: f.options.filter((_, j) => j !== i) })}>Remove</button>
            <div className="col-span-3 -mt-1"><Toggle checked={o.sold_out} onChange={(v) => setOpt(i, { sold_out: v })} label="This size is sold out" /></div>
          </div>
        ))}
        <button type="button" className="font-semibold underline" onClick={() => setF({ ...f, options: [...f.options, { name: '', price: '', sold_out: false }] })}>
          {f.options.length ? '+ Add another size' : '+ Offer sizes (e.g. small / large tray)'}
        </button>
      </fieldset>

      <div className="flex flex-col gap-1">
        <Toggle checked={f.available} onChange={(v) => setF({ ...f, available: v })} label="Show on the menu" />
        <Toggle checked={f.sold_out} onChange={(v) => setF({ ...f, sold_out: v })} label="Sold out" />
        <Toggle checked={f.allow_notes} onChange={(v) => setF({ ...f, allow_notes: v })} label="Let customers add a request" />
      </div>
      {f.allow_notes ? <Input id="p-np" label="Request prompt" optional placeholder="e.g. Spice level?" maxLength={120} value={f.notes_prompt} onChange={set('notes_prompt')} /> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Input id="p-max" label="Max per order" type="number" min={1} max={99} value={f.max_per_order} onChange={set('max_per_order')} />
        <Input id="p-sort" label="Order in list" type="number" value={f.sort} onChange={set('sort')} hint="Lower numbers show first." />
      </div>
      <Status error={act.error} />
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-dark" disabled={act.busy}>{act.busy ? 'Saving…' : 'Save item'}</button>
        <button type="button" className="btn btn-ghost" onClick={() => void onDone()}>Cancel</button>
        {product ? <button type="button" className="ml-auto font-semibold underline" onClick={() => void remove()}>Delete item</button> : null}
      </div>
    </form>
  );
}

function Categories({ cats, reload }: { cats: ACategory[]; reload: () => Promise<void> }) {
  const [editing, setEditing] = useState<ACategory | 'new' | null>(null);
  const [f, setF] = useState({ name: '', emoji: '', sort: '0', active: true });
  const act = useAction();
  const start = (c: ACategory | 'new') => {
    setEditing(c);
    setF(c === 'new' ? { name: '', emoji: '', sort: String((cats.at(-1)?.sort ?? 0) + 1), active: true } : { name: c.name, emoji: c.emoji, sort: String(c.sort), active: !!c.active });
  };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const body = { ...f, sort: Number(f.sort || 0), ...(editing !== 'new' && editing ? { slug: editing.slug } : {}) };
    const ok = await act.run(() => (editing === 'new' ? api('/api/admin/categories', { body }) : api(`/api/admin/categories/${(editing as ACategory).id}`, { method: 'PUT', body })));
    if (ok) { setEditing(null); await reload(); }
  };
  const remove = async (c: ACategory) => {
    if (!confirm(`Delete the “${c.name}” category?`)) return;
    if (await act.run(() => api(`/api/admin/categories/${c.id}`, { method: 'DELETE' }))) { setEditing(null); await reload(); }
  };
  return (
    <Panel title="Categories" action={<button type="button" className="btn btn-ghost min-h-11 px-4 text-[0.8rem]" onClick={() => start('new')}>Add category</button>}>
      <ul className="flex flex-wrap gap-2">
        {cats.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => start(c)} className={`rounded-full px-4 py-2 font-semibold ${c.active ? 'bg-wash' : 'bg-wash opacity-50'}`}>
              {c.emoji} {c.name} <span className="text-ink-2">· {c.product_count}</span>
            </button>
          </li>
        ))}
      </ul>
      {editing ? (
        <form onSubmit={save} className="mt-5 space-y-4 rounded-2xl bg-wash p-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_6rem_6rem]">
            <Input id="cat-name" label="Name" maxLength={40} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <Input id="cat-emoji" label="Emoji" optional maxLength={8} value={f.emoji} onChange={(e) => setF({ ...f, emoji: e.target.value })} />
            <Input id="cat-sort" label="Order" type="number" value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })} />
          </div>
          <Toggle checked={f.active} onChange={(v) => setF({ ...f, active: v })} label="Show as a filter on the site" />
          <Status error={act.error} />
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn btn-dark" disabled={act.busy}>Save</button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
            {editing !== 'new' ? <button type="button" className="ml-auto font-semibold underline" onClick={() => void remove(editing)}>Delete</button> : null}
          </div>
        </form>
      ) : null}
    </Panel>
  );
}
