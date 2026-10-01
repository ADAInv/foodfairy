import { useMemo, useState } from 'react';
import { useBasket, useSite, useUi } from '../lib/store';
import { money } from '../lib/format';
import type { Category, Product } from '../lib/types';
import { FoodImage } from './FoodImage';
import { PlatePlaceholder, Sparkle } from './Doodles';

export function Menu({ headingLevel = 2 }: { headingLevel?: 2 | 1 }) {
  const { data, canOrder } = useSite();
  const { filter, setFilter } = useUi();
  const H = headingLevel === 1 ? 'h1' : 'h2';

  const withProducts = useMemo(() => {
    if (!data) return [] as Category[];
    return data.categories.filter((c) => data.products.some((p) => p.categoryId === c.id));
  }, [data]);

  if (!data) {
    return (
      <section id="menu" className="mx-auto max-w-6xl px-4 py-10" aria-busy>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-wash sm:h-96" />)}
        </div>
      </section>
    );
  }

  const shown = filter === 'all' ? withProducts : withProducts.filter((c) => c.slug === filter);

  return (
    <section id="menu" aria-labelledby="menu-title" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-20 pt-12 sm:pt-16">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <H id="menu-title" className="display text-[2.75rem] sm:text-[4rem]">The menu</H>
        {!canOrder ? <p className="max-w-[16rem] text-right text-[0.95rem] text-ink-2">Have a look around. Ordering opens with the next drop.</p> : null}
      </div>

      {withProducts.length > 1 ? (
        <div className="sticky top-[4.25rem] z-20 -mx-4 mt-6 border-b border-ink/10 bg-paper/95 px-4 py-3 backdrop-blur md:top-[4.75rem]" role="toolbar" aria-label="Filter the menu">
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {[{ slug: 'all', name: 'All', emoji: '' }, ...withProducts].map((c) => {
              const active = filter === c.slug;
              return (
                <button
                  key={c.slug}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(c.slug)}
                  className={`min-h-10 shrink-0 rounded-full px-4 text-[0.98rem] transition-colors
                    ${active ? 'bg-ink text-paper' : 'text-ink ring-1 ring-ink/15 hover:ring-ink/40'}`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {withProducts.length === 0 ? (
        <div className="mt-8 rounded-2xl bg-wash px-6 py-12 text-center">
          <Sparkle className="mx-auto h-8 w-8 text-fairy" />
          <p className="display mt-3 text-3xl">The menu is being written.</p>
          <p className="mt-2 text-ink-2">Check back soon, or follow along on Instagram for the next drop.</p>
        </div>
      ) : (
        shown.map((cat) => (
          <div key={cat.id} className="mt-10">
            {filter === 'all' ? (
              <h3 id={`cat-${cat.slug}`} className="display mb-2 text-[1.9rem] sm:mb-6 sm:text-[2.2rem]">{cat.name}</h3>
            ) : null}
            <ul className="divide-y divide-ink/10 sm:grid sm:grid-cols-2 sm:gap-x-7 sm:gap-y-12 sm:divide-y-0 lg:grid-cols-3">
              {data.products.filter((p) => p.categoryId === cat.id).map((p) => (
                <li key={p.id} className="py-5 sm:py-0"><ProductCard product={p} /></li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}

function ProductCard({ product: p }: { product: Product }) {
  const { canOrder } = useSite();
  const { add } = useBasket();
  const { openProduct, showAdded } = useUi();
  const hasOptions = p.options.length > 0;
  const allOptionsGone = hasOptions && p.options.every((o) => o.soldOut);
  const soldOut = p.soldOut || allOptionsGone;
  const fromPrice = hasOptions ? Math.min(...p.options.map((o) => o.priceCents)) : p.priceCents;

  const onAdd = () => {
    if (hasOptions) return openProduct(p.id);
    add(p.id, null, 1);
    showAdded();
  };

  // Phones: a list row (photo left), like a menu card. Tablet up: photo-led card.
  return (
    <article className="grid h-full grid-cols-[6.75rem_1fr] gap-4 sm:flex sm:flex-col sm:gap-0">
      <button type="button" onClick={() => openProduct(p.id)} className="group relative block aspect-square w-full self-start overflow-hidden rounded-xl sm:aspect-[4/3] sm:rounded-2xl" aria-label={`${p.name}, see details`}>
        {p.image
          ? <FoodImage img={p.image} alt={p.name} sizes="(min-width: 1024px) 360px, (min-width: 640px) 45vw, 108px" className={`transition duration-500 group-hover:scale-[1.03] ${soldOut ? 'grayscale-[.7]' : ''}`} />
          : <PlatePlaceholder className="h-full w-full" />}
        {soldOut ? (
          <span className="absolute inset-x-2 bottom-2 rounded-full bg-ink px-2.5 py-1 text-center text-[0.72rem] leading-tight text-paper sm:inset-x-auto sm:left-3 sm:top-3 sm:bottom-auto sm:text-[0.8rem]">
            You guys ate this one up.
          </span>
        ) : null}
      </button>

      <div className="flex min-w-0 flex-col">
        <div className="flex items-baseline justify-between gap-3 sm:mt-4">
          <h4 className="display text-[1.4rem] leading-tight sm:text-[1.6rem]">
            <button type="button" onClick={() => openProduct(p.id)} className="text-left decoration-[1.5px] underline-offset-4 hover:underline">{p.name}</button>
          </h4>
          <p className="shrink-0 text-[1.05rem] font-medium tabular-nums sm:text-[1.15rem]">{hasOptions ? <><span className="text-[0.85rem] font-normal text-ink-2">from </span>{money(fromPrice)}</> : money(p.priceCents)}</p>
        </div>
        {p.description ? <p className="mt-1 line-clamp-2 text-[0.98rem] leading-snug text-ink-2 sm:line-clamp-none">{p.description}</p> : null}

        <div className="mt-auto pt-3 sm:pt-5">
          {soldOut ? (
            <button type="button" className="btn btn-ghost min-h-10 w-full text-[0.78rem] sm:min-h-11" disabled>Sold out</button>
          ) : !canOrder ? (
            <button type="button" className="btn btn-ghost min-h-10 w-full text-[0.78rem] sm:min-h-11" disabled>Back next drop ✦</button>
          ) : hasOptions ? (
            <button type="button" onClick={onAdd} className="btn btn-primary min-h-10 w-full text-[0.78rem] sm:min-h-11">Choose a size ✦</button>
          ) : (
            <button type="button" onClick={onAdd} className="btn btn-primary min-h-10 w-full px-4 text-[0.78rem] sm:min-h-11" aria-label={`Add to fairy basket: ${p.name}`}>Add to fairy basket ✦</button>
          )}
        </div>
      </div>
    </article>
  );
}
