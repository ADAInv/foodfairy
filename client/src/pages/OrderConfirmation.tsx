import { useEffect, useRef, useState } from 'react';
import { Layout } from '../components/Layout';
import { Link } from '../lib/router';
import { api, ApiError } from '../lib/api';
import { useBasket } from '../lib/store';
import { money, moneyExact, pickupDay } from '../lib/format';

interface OrderView {
  code: string; status: 'pending' | 'paid' | 'ready' | 'picked_up' | 'cancelled'; checkoutMode: string; firstName: string;
  pickupDate: string; pickupWindow: string; pickupArea: string; pickupInstructions: string; payUrl: string;
  items: { name: string; optionName: string; qty: number; unitCents: number; notes: string }[];
  subtotalCents: number; taxCents: number; totalCents: number; taxLabel: string;
}

export function OrderConfirmation({ token }: { token: string }) {
  const [order, setOrder] = useState<OrderView | null>(null);
  const [missing, setMissing] = useState(false);
  const [waitedLong, setWaitedLong] = useState(false);
  const polls = useRef(0);
  const { clear } = useBasket();

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const o = await api<OrderView>(`/api/orders/${token}`);
        if (stop) return;
        setOrder(o);
        if (o.status !== 'pending' || o.checkoutMode === 'square_link') clear();
        // Square usually confirms within seconds of the redirect.
        if (o.status === 'pending' && o.checkoutMode === 'square_api') {
          polls.current += 1;
          if (polls.current > 20) setWaitedLong(true);
          timer = setTimeout(load, polls.current > 20 ? 15_000 : 3_000);
        }
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) setMissing(true);
        else timer = setTimeout(load, 5_000);
      }
    };
    void load();
    return () => { stop = true; clearTimeout(timer); };
  }, [token, clear]);

  if (missing) {
    return (
      <Layout bare>
        <section className="mx-auto max-w-xl px-4 py-20 text-center">
          <h1 className="display text-[2.4rem]">Hmm, I can't find that order.</h1>
          <p className="mt-3 text-ink-2">Check the link in your confirmation email, or message me on Instagram.</p>
          <Link href="/" className="btn btn-primary mt-8">Back to Food Fairy</Link>
        </section>
      </Layout>
    );
  }
  if (!order) return <Layout bare><div className="mx-auto h-[60vh] max-w-2xl animate-pulse px-4 py-16" aria-busy /></Layout>;

  const confirmed = ['paid', 'ready', 'picked_up'].includes(order.status);

  return (
    <Layout bare>
      <section className="mx-auto max-w-2xl px-4 pb-16 pt-10 sm:pt-16">
        {confirmed ? (
          <div className="relative">
            <h1 className="display text-[3.2rem] sm:text-7xl">It's official. ✦</h1>
            <p className="mt-4 text-[1.25rem]">Your Food Fairy order is in. Now comes the hard part: waiting.</p>
          </div>
        ) : order.status === 'cancelled' ? (
          <>
            <h1 className="display text-[2.8rem]">This order was cancelled.</h1>
            <p className="mt-3 text-ink-2">If that's news to you, message me on Instagram with your order number.</p>
          </>
        ) : order.checkoutMode === 'square_link' ? (
          <>
            <h1 className="display text-[2.8rem] sm:text-6xl">One more step.</h1>
            <p className="mt-3 text-[1.15rem]">Pay on Square and put your order number <strong>{order.code}</strong> in the note, so I can match it to your food.</p>
            {order.payUrl ? <a href={order.payUrl} className="btn btn-primary mt-6">Pay {moneyExact(order.totalCents)} on Square →</a> : null}
            <p className="mt-3 text-[0.95rem] text-ink-2">Your order is confirmed once I see the payment. You'll get an email.</p>
          </>
        ) : (
          <div aria-live="polite">
            <h1 className="display text-[2.8rem] sm:text-6xl">Confirming your payment…</h1>
            <p className="mt-3 text-[1.1rem] text-ink-2">
              {waitedLong
                ? "Square is taking its time. If you paid, you'll get a confirmation email shortly. If you closed the payment page, your card wasn't charged."
                : 'This usually takes a few seconds. No need to refresh.'}
            </p>
          </div>
        )}

        <dl className="mt-10 grid gap-5 rounded-2xl bg-wash p-6 sm:grid-cols-2">
          <div>
            <dt className="text-[0.95rem] text-ink-2">Order number</dt>
            <dd className="display text-[1.9rem] tracking-wide">{order.code}</dd>
          </div>
          <div>
            <dt className="text-[0.95rem] text-ink-2">Pickup</dt>
            <dd className="font-semibold">{pickupDay(order.pickupDate)}{order.pickupWindow ? `, ${order.pickupWindow}` : ''}<br /><span className="font-normal">{order.pickupArea}</span></dd>
          </div>
          {confirmed && order.pickupInstructions ? (
            <div className="sm:col-span-2">
              <dt className="text-[0.95rem] text-ink-2">Pickup instructions</dt>
              <dd className="whitespace-pre-line">{order.pickupInstructions}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-8">
          <h2 className="display text-[1.6rem]">What's coming ✦</h2>
          <ul className="mt-3 divide-y divide-ink/10">
            {order.items.map((i, n) => (
              <li key={n} className="flex items-baseline justify-between gap-3 py-3">
                <span><span className="font-semibold">{i.qty} × {i.name}</span>{i.optionName ? `, ${i.optionName}` : ''}{i.notes ? <span className="block text-[0.95rem] text-ink-2">“{i.notes}”</span> : null}</span>
                <span className="tabular-nums">{money(i.unitCents * i.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-1 border-t border-ink/10 pt-3">
            {order.taxCents > 0 ? <p className="flex justify-between text-ink-2"><span>{order.taxLabel}</span><span className="tabular-nums">{moneyExact(order.taxCents)}</span></p> : null}
            <p className="flex items-baseline justify-between"><span className="font-semibold">Total</span><span className="display text-[1.7rem] tabular-nums">{moneyExact(order.totalCents)}</span></p>
          </div>
        </div>

        <Link href="/" className="btn btn-dark mt-10">Back to Food Fairy</Link>
      </section>
    </Layout>
  );
}
