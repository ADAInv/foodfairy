import { useEffect, useState } from 'react';
import { useBasket, useSite, useUi } from '../lib/store';
import { money } from '../lib/format';
import { Sheet } from './Sheet';
import { FoodImage } from './FoodImage';
import { PlatePlaceholder } from './Doodles';
import { Stepper } from './Stepper';

export function ProductSheet() {
  const { productId, openProduct } = useUi();
  return (
    <Sheet open={productId !== null} onClose={() => openProduct(null)} label="Product details">
      {productId !== null ? <ProductBody id={productId} /> : null}
    </Sheet>
  );
}

function ProductBody({ id }: { id: number }) {
  const { productById, data, canOrder } = useSite();
  const { add } = useBasket();
  const { openProduct, showAdded } = useUi();
  const p = productById.get(id);
  const firstAvailable = p?.options.find((o) => !o.soldOut)?.id ?? null;
  const [optionId, setOptionId] = useState<number | null>(firstAvailable);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');
  useEffect(() => { setOptionId(firstAvailable); setQty(1); setNotes(''); }, [id, firstAvailable]);

  if (!p) return <div className="p-8">That item isn't on the menu anymore.</div>;
  const cat = data?.categories.find((c) => c.id === p.categoryId);
  const option = p.options.find((o) => o.id === optionId);
  const unit = option?.priceCents ?? p.priceCents;
  const soldOut = p.soldOut || (p.options.length > 0 && !firstAvailable);

  const onAdd = () => {
    if (p.options.length > 0 && !option) return;
    add(p.id, option?.id ?? null, qty, p.allowNotes ? notes : '');
    openProduct(null);
    showAdded();
  };

  return (
    <div className="flex max-h-[92dvh] flex-col sm:max-h-[88dvh]">
      <div className="overflow-y-auto">
        <div className="relative aspect-[4/3] w-full">
          {p.image ? <FoodImage img={p.image} alt={p.name} sizes="(min-width: 640px) 544px, 100vw" eager /> : <PlatePlaceholder emoji={cat?.emoji ?? ''} className="h-full w-full" />}
          <button type="button" onClick={() => openProduct(null)} autoFocus
            className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-paper text-2xl leading-none ring-1 ring-ink/10"
            aria-label="Close">×</button>
        </div>
        <div className="px-6 pb-4 pt-5">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="display text-[2.2rem]">{p.name}</h2>
            <p className="display text-[1.7rem]">{money(unit)}</p>
          </div>
          {p.description ? <p className="mt-2 text-lg text-ink-2">{p.description}</p> : null}

          {p.options.length > 0 ? (
            <fieldset className="mt-5">
              <legend className="label">Size</legend>
              <div className="flex flex-wrap gap-2">
                {p.options.map((o) => (
                  <label key={o.id} className={`cursor-pointer rounded-full px-4 py-2.5 font-semibold ring-[1.5px] transition has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2
                    ${optionId === o.id ? 'bg-ink text-paper ring-ink' : 'bg-wash ring-transparent hover:bg-wash-2'} ${o.soldOut ? 'cursor-not-allowed opacity-45 line-through' : ''}`}>
                    <input type="radio" name="option" className="sr-only" value={o.id} checked={optionId === o.id} disabled={o.soldOut} onChange={() => setOptionId(o.id)} />
                    {o.name} <span className="font-normal">{money(o.priceCents)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          {p.allowNotes && canOrder && !soldOut ? (
            <div className="mt-5">
              <label htmlFor="item-notes" className="label">Anything I should know? <span className="font-normal text-ink-2">(optional)</span></label>
              <textarea id="item-notes" className="field min-h-20" maxLength={200} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={p.notesPrompt || ''} />
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-t border-ink/10 bg-paper px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {soldOut ? (
          <p className="text-center font-medium">You guys ate this one up.</p>
        ) : !canOrder ? (
          <p className="text-center text-ink-2">Ordering opens with the next food drop.</p>
        ) : (
          <div className="flex items-center gap-3">
            <Stepper value={qty} onChange={setQty} max={p.maxPerOrder} label={p.name} />
            <button type="button" onClick={onAdd} className="btn btn-primary flex-1 whitespace-nowrap px-3 text-[0.8rem] tracking-[0.03em]" disabled={p.options.length > 0 && !option}>
              Add to fairy basket ✦ <span className="hidden font-sans normal-case tracking-normal min-[420px]:inline">{money(unit * qty)}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
