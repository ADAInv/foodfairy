import { useEffect, useState, type FormEvent } from 'react';
import { Layout } from '../components/Layout';
import { Input, TextArea, FormError } from '../components/Field';
import { Sparkle } from '../components/Doodles';
import { useBasket, useSite } from '../lib/store';
import { useRouter, Link } from '../lib/router';
import { api } from '../lib/api';
import { money, moneyExact, pickupDay, whenLabel } from '../lib/format';

const REMEMBER_KEY = 'ff_details_v1';

export function Checkout() {
  const { data, openDrops } = useSite();
  const { lines, subtotal, count, hasProblems, remove } = useBasket();
  const { navigate } = useRouter();
  const [dropId, setDropId] = useState<number | null>(null);
  const [f, setF] = useState({ name: '', email: '', phone: '', notes: '' });
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(REMEMBER_KEY) ?? 'null');
      if (saved && typeof saved === 'object') { setF((x) => ({ ...x, name: saved.name ?? '', email: saved.email ?? '', phone: saved.phone ?? '' })); setRemember(true); }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (openDrops.length && !openDrops.some((d) => d.id === dropId)) setDropId(openDrops[0]!.id);
  }, [openDrops, dropId]);

  const taxPct = Number(data?.settings.tax_percent ?? 0);
  const tax = Math.round((subtotal * taxPct) / 100);
  const mode = data?.checkout.mode;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!dropId || busy) return;
    setBusy(true); setError(null);
    try {
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, JSON.stringify({ name: f.name, email: f.email, phone: f.phone }));
        else localStorage.removeItem(REMEMBER_KEY);
      } catch { /* private mode */ }
      const res = await api<{ redirectUrl: string; external: boolean }>('/api/checkout', {
        body: {
          dropId, ...f,
          items: lines.filter((l) => !l.problem).map((l) => ({ productId: l.productId, optionId: l.optionId, qty: l.qty, notes: l.notes }))
        }
      });
      if (res.external) window.location.assign(res.redirectUrl);
      else navigate(res.redirectUrl);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  if (!data) return <Layout bare><div className="mx-auto h-96 max-w-3xl animate-pulse px-4 py-10" /></Layout>;

  if (count === 0) {
    return (
      <Layout bare>
        <section className="mx-auto max-w-xl px-4 py-20 text-center">
          <Sparkle className="mx-auto h-10 w-10 text-fairy" />
          <h1 className="display mt-4 text-[2.4rem]">Your fairy basket is empty.</h1>
          <Link href="/#menu" className="link-arrow mt-6 inline-block">Go find something good →</Link>
        </section>
      </Layout>
    );
  }

  const closed = !data.checkout.enabled || openDrops.length === 0;

  return (
    <Layout bare>
      <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-8 md:grid-cols-[1.25fr_1fr] md:pt-12">
        <form onSubmit={submit} className="order-2 space-y-8 md:order-1" noValidate={false}>
          <h1 className="display text-[2.6rem] sm:text-6xl">Almost yours.</h1>

          {closed ? (
            <div className="rounded-2xl bg-wash p-6">
              <p className="display text-2xl">The fairy is off duty ✦</p>
              <p className="mt-2 text-ink-2">
                {data.checkout.enabled ? "Orders aren't open right now. Your basket will wait here for the next drop." : "Online ordering isn't switched on yet. Send me a message on Instagram to order."}
              </p>
            </div>
          ) : (
            <fieldset>
              <legend className="label text-[1.05rem]">Pickup</legend>
              <div className="grid gap-3">
                {openDrops.map((d) => (
                  <label key={d.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl p-4 ring-[1.5px] transition has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2
                    ${dropId === d.id ? 'bg-wash ring-ink' : 'ring-ink/15 hover:bg-wash'}`}>
                    <input type="radio" name="drop" className="mt-1.5 accent-ink" checked={dropId === d.id} onChange={() => setDropId(d.id)} />
                    <span>
                      <span className="display block text-[1.45rem]">{pickupDay(d.pickupDate)}</span>
                      <span className="block text-ink-2">{d.pickupWindow ? `${d.pickupWindow} in ` : 'In '}{data.settings.pickup_area || 'Kitchener / Waterloo'}. Orders close {whenLabel(d.closesAt)}.</span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-[0.95rem] text-ink-2">The exact pickup spot is sent to you after you order.</p>
            </fieldset>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2"><Input id="name" label="Name" autoComplete="name" maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <Input id="email" label="Email" type="email" inputMode="email" autoComplete="email" maxLength={254} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} hint="Your confirmation goes here." />
            <Input id="phone" label="Phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={32} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} hint="Only used if something changes with pickup." />
            <div className="sm:col-span-2">
              <TextArea id="notes" label="Anything I should know?" optional maxLength={500} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Allergies, pickup timing, that sort of thing." />
            </div>
          </div>

          <label className="flex items-center gap-3 text-[0.98rem]">
            <input type="checkbox" className="h-5 w-5 accent-ink" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Remember my details on this device
          </label>

          <FormError message={error} />

          <div>
            <button type="submit" className="btn btn-primary min-h-14 w-full text-[1.02rem]" disabled={closed || busy || hasProblems || !dropId}>
              {busy ? 'One sec…' : mode === 'square_link' ? 'Place order →' : 'Continue to payment →'}
            </button>
            <p className="mt-3 text-center text-[0.95rem] text-ink-2">
              {mode === 'square_link'
                ? "Next you'll get your order number and a link to pay on Square."
                : "You'll pay on Square's secure checkout, then come right back here."}
            </p>
          </div>
        </form>

        <aside className="order-1 md:order-2" aria-label="Order summary">
          <div className="rounded-2xl bg-wash p-6 md:sticky md:top-24">
            <h2 className="display text-[1.6rem]">Your fairy basket ✦</h2>
            <ul className="mt-4 space-y-3">
              {lines.map((l) => (
                <li key={l.key} className="flex items-baseline justify-between gap-3">
                  <span>
                    <span className="font-semibold">{l.qty} × {l.name}</span>
                    {l.optionName ? <span className="text-ink-2">, {l.optionName}</span> : null}
                    {l.problem ? <span className="block text-[0.9rem]">{l.problem} <button type="button" className="font-semibold underline" onClick={() => remove(l.key)}>Remove</button></span> : null}
                  </span>
                  <span className="tabular-nums">{money(l.unitCents * l.qty)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 space-y-1 border-t border-ink/10 pt-4">
              <p className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{moneyExact(subtotal)}</span></p>
              {taxPct > 0 ? <p className="flex justify-between"><span>{data.settings.tax_label || 'Tax'}</span><span className="tabular-nums">{moneyExact(tax)}</span></p> : null}
              <p className="flex items-baseline justify-between pt-2"><span className="font-semibold">Total</span><span className="display text-[1.8rem] tabular-nums">{moneyExact(subtotal + tax)}</span></p>
            </div>
            <Link href="/#menu" className="mt-4 inline-block text-[0.95rem] underline underline-offset-4">Add something else</Link>
          </div>
        </aside>
      </div>
    </Layout>
  );
}
