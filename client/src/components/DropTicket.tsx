import { useEffect, useState } from 'react';
import { useSite } from '../lib/store';
import { pickupDay, timeLeft, whenLabel } from '../lib/format';
import { useOrderNow } from '../lib/useOrderNow';

export function DropTicket({ className = '' }: { className?: string }) {
  const { data, headlineDrop: drop, openDrops, canOrder } = useSite();
  const goOrder = useOrderNow();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);

  if (!data) return <div className={`h-64 animate-pulse rounded-2xl bg-ink/10 ${className}`} aria-hidden />;

  const insta = data.settings.instagram ? `https://www.instagram.com/${data.settings.instagram}/` : '';
  const open = canOrder && drop?.state === 'open';

  return (
    <section aria-label="Next food drop" className={`on-dark relative overflow-hidden rounded-2xl bg-ink text-paper ${className}`}>
      <div className="grid gap-x-10 gap-y-6 px-6 py-7 sm:px-9 sm:py-9 md:grid-cols-[1.2fr_1fr] md:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-[1rem] font-medium text-paper/80">
              <span className="text-fairy" aria-hidden>✦ </span>{open ? 'The next food drop' : 'The fairy is off duty'}
            </p>
            {open && drop ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-fairy/60 px-3 py-0.5 text-[0.85rem] text-fairy">
                <span className="h-1.5 w-1.5 rounded-full bg-fairy" aria-hidden />
                Orders open, {timeLeft(drop.closesAt, now)}
              </span>
            ) : null}
          </div>
          {drop ? (
            <h2 className="display mt-3 text-[2.6rem] text-fairy sm:text-[3.6rem]">{pickupDay(drop.pickupDate)}</h2>
          ) : (
            <h2 className="display mt-3 text-[2rem] sm:text-[2.6rem]">Next drop gets announced on Instagram.</h2>
          )}
        </div>

        <div>
          {drop ? (
            <dl className="grid grid-cols-2 gap-4 border-t border-paper/15 pt-5 md:border-t-0 md:pt-0">
              {open ? (
                <div><dt className="text-[0.9rem] text-paper/65">Orders close</dt><dd className="font-medium">{whenLabel(drop.closesAt)}</dd></div>
              ) : drop.state === 'upcoming' ? (
                <div><dt className="text-[0.9rem] text-paper/65">Orders open</dt><dd className="font-medium">{whenLabel(drop.opensAt)}</dd></div>
              ) : (
                <div><dt className="text-[0.9rem] text-paper/65">Orders</dt><dd className="font-medium">{drop.state === 'full' ? 'All spots taken' : 'Paused for now'}</dd></div>
              )}
              <div>
                <dt className="text-[0.9rem] text-paper/65">Pickup</dt>
                <dd className="font-medium">{pickupDay(drop.pickupDate, { short: true })}{drop.pickupWindow ? `, ${drop.pickupWindow}` : ''}</dd>
              </div>
              {drop.note ? <p className="col-span-2 text-[0.95rem] text-paper/80">{drop.note}</p> : null}
            </dl>
          ) : null}
          <div className="mt-6">
            {open && drop ? (
              <>
                <button type="button" onClick={goOrder} className="btn btn-fairy w-full sm:w-auto">
                  Order for {pickupDay(drop.pickupDate, { short: true })} →
                </button>
                {openDrops.length > 1 ? <p className="mt-3 text-sm text-paper/70">More pickup dates are open too. You'll choose at checkout.</p> : null}
              </>
            ) : drop || !insta ? (
              <button type="button" onClick={goOrder} className="btn btn-ghost w-full sm:w-auto">See what's coming →</button>
            ) : (
              <a href={insta} target="_blank" rel="noopener noreferrer" className="btn btn-ghost w-full sm:w-auto">Follow along →</a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
