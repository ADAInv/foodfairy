import { useState, type FormEvent } from 'react';
import { Layout } from '../components/Layout';
import { Input, TextArea, Honeypot, FormError } from '../components/Field';
import { Sparkle } from '../components/Doodles';
import { Link } from '../lib/router';
import { useSite } from '../lib/store';
import { api } from '../lib/api';

export function Contact() {
  const { data } = useSite();
  const s = data?.settings;
  const [f, setF] = useState({ name: '', email: '', phone: '', message: '' });
  const [hp, setHp] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api('/api/inquiries', { body: { kind: 'contact', ...f, website: hp } });
      setSent(true);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Layout>
      <section className="mx-auto grid max-w-6xl gap-12 px-4 pb-10 pt-10 sm:pt-16 md:grid-cols-[0.9fr_1.1fr]">
        <div>
          <h1 className="display text-[3rem] sm:text-7xl">Talk to the fairy.</h1>
          <p className="mt-5 max-w-md text-[1.15rem]">Questions about an order, a pickup, or something else. For events and big trays, the <Link href="/catering" className="font-semibold underline decoration-fairy decoration-2 underline-offset-4">catering form</Link> gets you a quote faster.</p>
          <ul className="mt-8 space-y-3 text-[1.1rem]">
            {s?.instagram ? <li><a className="font-semibold hover:underline" href={`https://www.instagram.com/${s.instagram}/`} target="_blank" rel="noopener noreferrer">Instagram @{s.instagram}</a></li> : null}
            {s?.tiktok ? <li><a className="font-semibold hover:underline" href={`https://www.tiktok.com/@${s.tiktok}`} target="_blank" rel="noopener noreferrer">TikTok @{s.tiktok}</a></li> : null}
            {s?.contact_email ? <li><a className="font-semibold hover:underline" href={`mailto:${s.contact_email}`}>{s.contact_email}</a></li> : null}
          </ul>
          {s?.pickup_area ? <p className="mt-8 text-ink-2">Pickup in {s.pickup_area}. The exact spot is shared after you order.</p> : null}
        </div>

        {sent ? (
          <div className="rounded-2xl bg-wash p-8 text-center sm:p-12" aria-live="polite">
            <Sparkle className="mx-auto h-12 w-12 animate-[pop_600ms] text-fairy" />
            <h2 className="display mt-4 text-[2.4rem]">Got it. ✦</h2>
            <p className="mt-2">I'll reply by email.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="relative space-y-5 rounded-2xl border border-ink/15 p-6 sm:p-10">
            <Honeypot value={hp} onChange={setHp} />
            <Input id="m-name" label="Name" autoComplete="name" maxLength={80} value={f.name} onChange={set('name')} />
            <Input id="m-email" label="Email" type="email" autoComplete="email" maxLength={254} value={f.email} onChange={set('email')} />
            <Input id="m-phone" label="Phone" optional type="tel" autoComplete="tel" maxLength={32} value={f.phone} onChange={set('phone')} />
            <TextArea id="m-message" label="Message" maxLength={2000} value={f.message} onChange={set('message')} />
            <FormError message={error} />
            <button type="submit" className="btn btn-primary min-h-14 w-full sm:w-auto sm:px-10" disabled={busy}>{busy ? 'Sending…' : 'Send ✦'}</button>
          </form>
        )}
      </section>
    </Layout>
  );
}
