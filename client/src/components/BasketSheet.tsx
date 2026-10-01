import { useBasket, useSite, useUi } from '../lib/store';
import { money, moneyExact, pickupDay } from '../lib/format';
import { useRouter } from '../lib/router';
import { Sheet } from './Sheet';
import { Stepper } from './Stepper';
import { Sparkle } from './Doodles';
import { useOrderNow } from '../lib/useOrderNow';

export function BasketSheet() {
  const { basketOpen, setBasketOpen } = useUi();
  return (
    <Sheet open={basketOpen} onClose={() => setBasketOpen(false)} label="Your fairy basket" variant="side">
      <BasketBody />
    </Sheet>
  );
}

function BasketBody() {
  const { lines, subtotal, setQty, remove, hasProblems, count } = useBasket();
  const { setBasketOpen } = useUi();
  const { openDrops, canOrder, data } = useSite();
  const { navigate } = useRouter();
  const goOrder = useOrderNow();
  const tax = Number(data?.settings.tax_percent ?? 0);
  const drop = openDrops[0];

  return (
    <div className="flex h-full max-h-[92dvh] flex-col sm:max-h-dvh">
      <header className="flex items-center justify-between px-6 pb-3 pt-6">
        <h2 className="display text-[1.6rem]">Your fairy basket ✦</h2>
        <button type="button" onClick={() => setBasketOpen(false)} autoFocus className="grid h-11 w-11 place-items-center rounded-full text-2xl hover:bg-wash" aria-label="Close basket">×</button>
      </header>

      {count === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-16 pt-6 text-center">
          <Sparkle className="h-10 w-10 text-fairy" />
          <p className="display mt-4 text-[2rem]">Your fairy basket is empty. <span aria-hidden>🥲</span></p>
          <button type="button" className="link-arrow mt-6" onClick={() => { setBasketOpen(false); goOrder(); }}>Go find something good →</button>
        </div>
      ) : (
        <>
          <ul className="flex-1 divide-y divide-ink/10 overflow-y-auto px-6">
            {lines.map((l) => (
              <li key={l.key} className="py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <p className="display text-[1.35rem] leading-tight">{l.name}</p>
                    {l.optionName ? <p className="text-[0.95rem] text-ink-2">{l.optionName}</p> : null}
                    {l.notes ? <p className="text-[0.95rem] text-ink-2">“{l.notes}”</p> : null}
                  </div>
                  <p className="font-semibold tabular-nums">{money(l.unitCents * l.qty)}</p>
                </div>
                {l.problem ? (
                  <div className="mt-2 flex items-center justify-between rounded-xl bg-wash-2 px-3 py-2 text-[0.95rem]">
                    <span className="font-semibold">{l.problem}</span>
                    <button type="button" className="font-semibold underline" onClick={() => remove(l.key)}>Remove</button>
                  </div>
                ) : (
                  <div className="mt-2 flex items-center justify-between">
                    <Stepper value={l.qty} onChange={(n) => setQty(l.key, n)} max={l.product?.maxPerOrder ?? 20} label={l.name} size="sm" />
                    <button type="button" className="text-[0.95rem] underline underline-offset-4 hover:text-ink-2" onClick={() => remove(l.key)}>Remove</button>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <footer className="border-t border-ink/10 px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">Subtotal</span>
              <span className="display text-[1.7rem] tabular-nums">{moneyExact(subtotal)}</span>
            </div>
            {tax > 0 ? <p className="text-[0.9rem] text-ink-2">{data?.settings.tax_label || 'Tax'} is added at checkout.</p> : null}
            <p className="mt-2 text-[0.95rem] text-ink-2">
              {drop
                ? <>Pickup {pickupDay(drop.pickupDate)}{drop.pickupWindow ? `, ${drop.pickupWindow}` : ''} in {data?.settings.pickup_area || 'Kitchener / Waterloo'}.</>
                : 'Ordering is closed right now. Your basket will wait for the next drop.'}
            </p>
            <button type="button" className="btn btn-primary mt-4 w-full" disabled={!canOrder || hasProblems}
              onClick={() => { setBasketOpen(false); navigate('/checkout'); }}>
              Checkout →
            </button>
          </footer>
        </>
      )}
    </div>
  );
}
