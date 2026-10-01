import { useRef, useState, type FormEvent } from 'react';
import { Layout } from '../components/Layout';
import { Input, Select, TextArea, Honeypot, FormError } from '../components/Field';
import { Sparkle } from '../components/Doodles';
import { useSite } from '../lib/store';
import { api } from '../lib/api';

const KINDS = [
  { title: 'Corporate', line: 'Office lunches, team meetings, the Friday treat.', value: 'Corporate' },
  { title: 'Celebrations', line: 'Birthdays, showers, graduations.', value: 'Celebration' },
  { title: 'Family events', line: 'Reunions, Sunday lunches, everyone-is-in-town weekends.', value: 'Family event' },
  { title: 'Private events', line: 'Something smaller and more personal.', value: 'Private event' }
];
const BUDGETS = ['Under $250', '$250 – $500', '$500 – $1,000', '$1,000 – $2,500', '$2,500+', 'Not sure yet'];

export function Catering() {
  const { data } = useSite();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hp, setHp] = useState('');
  const [interest, setInterest] = useState<string[]>([]);
  const [f, setF] = useState({ name: '', email: '', phone: '', eventDate: '', eventType: '', guestCount: '', location: '', budget: '', dietary: '', details: '' });
  const formRef = useRef<HTMLFormElement>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const start = (eventType?: string) => {
    if (eventType) setF((x) => ({ ...x, eventType }));
    setOpen(true);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      (formRef.current?.querySelector('input:not([tabindex="-1"])') as HTMLInputElement | null)?.focus({ preventScroll: true });
    }, 50);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api('/api/inquiries', { body: { kind: 'catering', ...f, guestCount: Number(f.guestCount), interestedIn: interest.join(', '), website: hp } });
      setSent(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  const today = new Date().toISOString().slice(0, 10);
  const categories = data?.categories ?? [];

  if (sent) {
    return (
      <Layout>
        <section className="mx-auto max-w-xl px-4 py-20 text-center" aria-live="polite">
          <Sparkle className="mx-auto h-12 w-12 animate-[pop_600ms] text-fairy" />
          <h1 className="display mt-4 text-[3rem] sm:text-6xl">Got it. ✦</h1>
          <p className="mt-3 text-[1.2rem]">Your inquiry has landed with the Food Fairy.</p>
          <p className="mt-6 text-ink-2">Submitting an inquiry does not automatically confirm a booking. I'll get back to you by email.</p>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 pb-6 pt-10 sm:pt-16">
        <h1 className="display max-w-3xl text-[3rem] sm:text-7xl">Feeding more people?</h1>
        <p className="mt-5 max-w-xl text-[1.2rem]">{data?.settings.catering_intro}</p>
        {data?.settings.catering_minimum_notice ? <p className="mt-2 max-w-xl text-ink-2">{data.settings.catering_minimum_notice}</p> : null}
      </section>

      <section aria-label="Kinds of events" className="mx-auto max-w-6xl px-4 py-6">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {KINDS.map((k, i) => (
            <li key={k.title}>
              <button type="button" onClick={() => start(k.value)}
                className={`relative flex h-full w-full flex-col items-start bg-wash p-6 text-left transition hover:bg-wash-2
                  ${['rounded-2xl', 'rounded-2xl'][i % 2]}`}>
                <span className="text-[1.15rem] font-medium">{k.title}</span>
                <span className="mt-2 text-ink-2">{k.line}</span>
              </button>
            </li>
          ))}
        </ul>
        {!open ? (
          <div className="mt-10 text-center">
            <button type="button" onClick={() => start()} className="btn btn-primary min-h-14 px-8">Request a catering quote ✦</button>
          </div>
        ) : null}
      </section>

      {open ? (
        <section className="mx-auto max-w-3xl px-4 pb-10 pt-6">
          <form ref={formRef} onSubmit={submit} className="relative scroll-mt-24 space-y-6 rounded-2xl border border-ink/15 p-6 sm:p-10">
            <h2 className="display text-[2.2rem] sm:text-5xl">Tell me about it.</h2>
            <Honeypot value={hp} onChange={setHp} />
            <div className="grid gap-5 sm:grid-cols-2">
              <Input id="c-name" label="Name" autoComplete="name" maxLength={80} value={f.name} onChange={set('name')} />
              <Input id="c-email" label="Email" type="email" autoComplete="email" maxLength={254} value={f.email} onChange={set('email')} />
              <Input id="c-phone" label="Phone" type="tel" autoComplete="tel" maxLength={32} value={f.phone} onChange={set('phone')} />
              <Input id="c-date" label="Event date" type="date" min={today} value={f.eventDate} onChange={set('eventDate')} />
              <Select id="c-type" label="Event type" value={f.eventType} onChange={set('eventType')}>
                <option value="" disabled>Pick one</option>
                {KINDS.map((k) => <option key={k.value} value={k.value}>{k.title}</option>)}
                <option value="Something else">Something else</option>
              </Select>
              <Input id="c-guests" label="Guest count" type="number" inputMode="numeric" min={1} max={5000} value={f.guestCount} onChange={set('guestCount')} />
              <div className="sm:col-span-2">
                <Input id="c-location" label="Location" maxLength={120} value={f.location} onChange={set('location')} hint="City or venue is plenty for now." />
              </div>
            </div>

            {categories.length ? (
              <fieldset>
                <legend className="label">What you're interested in <span className="font-normal text-ink-2">(optional)</span></legend>
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => {
                    const on = interest.includes(c.name);
                    return (
                      <label key={c.id} className={`cursor-pointer rounded-full px-4 py-2.5 font-semibold transition has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 ${on ? 'bg-ink text-paper' : 'bg-wash hover:bg-wash-2'}`}>
                        <input type="checkbox" className="sr-only" checked={on} onChange={() => setInterest(on ? interest.filter((x) => x !== c.name) : [...interest, c.name])} />
                        <span aria-hidden>{c.emoji} </span>{c.name}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ) : null}

            <div className="grid gap-5 sm:grid-cols-2">
              <Select id="c-budget" label="Budget range" optional value={f.budget} onChange={set('budget')}>
                <option value="">Choose a range</option>
                {BUDGETS.map((b) => <option key={b} value={b}>{b}</option>)}
              </Select>
              <Input id="c-diet" label="Dietary restrictions or allergies" optional maxLength={600} value={f.dietary} onChange={set('dietary')} />
              <div className="sm:col-span-2">
                <TextArea id="c-details" label="Additional details" optional maxLength={2000} value={f.details} onChange={set('details')} />
              </div>
            </div>

            <FormError message={error} />
            <div>
              <button type="submit" className="btn btn-primary min-h-14 w-full sm:w-auto sm:px-10" disabled={busy}>{busy ? 'Sending…' : 'Send it to the fairy ✦'}</button>
              <p className="mt-3 text-[0.95rem] text-ink-2">Submitting an inquiry does not automatically confirm a booking.</p>
            </div>
          </form>
        </section>
      ) : null}
    </Layout>
  );
}
