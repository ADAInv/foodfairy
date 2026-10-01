import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { Link, useRouter } from '../lib/router';
import { Wordmark } from '../components/Layout';
import { Input, FormError } from '../components/Field';
import type { Me } from './types';
import { OverviewTab } from './Overview';
import { DropsTab } from './Drops';
import { MenuTab } from './MenuAdmin';
import { OrdersTab } from './Orders';
import { InquiriesTab } from './Inquiries';
import { ContentTab } from './Content';
import { FaqTab, ReviewsTab } from './FaqReviews';

const TABS = [
  ['', 'Overview'], ['drops', 'Order windows'], ['orders', 'Orders'], ['menu', 'Menu'],
  ['inquiries', 'Catering & messages'], ['content', 'Site content'], ['faq', 'FAQ'], ['reviews', 'Reviews']
] as const;

export default function AdminApp() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  useEffect(() => {
    api<Me>('/api/admin/me').then(setMe).catch(() => setMe(null));
  }, []);
  if (me === undefined) return <p className="p-8">Loading…</p>;
  if (me === null) return <Login onDone={setMe} />;
  return <Shell me={me} onLogout={() => setMe(null)} />;
}

function Login({ onDone }: { onDone: (m: Me) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api('/api/admin/login', { body: { email, password } });
      onDone(await api<Me>('/api/admin/me'));
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? 'Too many tries. Wait 15 minutes and try again.' : (err as Error).message);
    } finally { setBusy(false); }
  };
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <Wordmark className="h-24" />
      <h1 className="mt-2 text-[1.1rem] font-semibold text-ink-2">Fairy HQ</h1>
      <form onSubmit={submit} className="mt-8 space-y-5">
        <Input id="a-email" label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input id="a-pass" label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <FormError message={error} />
        <button className="btn btn-dark w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </main>
  );
}

function Shell({ me, onLogout }: { me: Me; onLogout: () => void }) {
  const { path, navigate } = useRouter();
  const tab = path.replace(/^\/admin\/?/, '').split('/')[0] ?? '';
  const logout = async () => { await api('/api/admin/logout', { method: 'POST' }).catch(() => {}); onLogout(); };
  const go = (t: string) => navigate(t ? `/admin/${t}` : '/admin');

  return (
    <div className="min-h-dvh bg-paper pb-16">
      <header className="sticky top-0 z-20 border-b border-ink/10 bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/admin" className="flex items-center gap-2" aria-label="Fairy HQ"><Wordmark className="h-11" /><span className="text-[1rem] font-medium text-ink-2">HQ</span></Link>
          <div className="flex items-center gap-3 text-sm">
            <a href="/" target="_blank" rel="noopener" className="font-semibold underline">View site</a>
            <button type="button" onClick={() => void logout()} className="font-semibold underline">Sign out</button>
          </div>
        </div>
        {/* Scrollable tab strip: works one-handed on a phone. */}
        <nav aria-label="Admin" className="mx-auto max-w-5xl overflow-x-auto px-4 pb-3 [scrollbar-width:none]">
          <ul className="flex w-max gap-2">
            {TABS.map(([t, label]) => (
              <li key={t}>
                <button type="button" onClick={() => go(t)} aria-current={tab === t ? 'page' : undefined}
                  className={`min-h-10 whitespace-nowrap rounded-full px-4 text-[0.92rem] font-semibold transition ${tab === t ? 'bg-ink text-paper' : 'bg-wash hover:bg-wash-2'}`}>
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      {me.checkoutMode !== 'square_api' || me.squareEnv === 'sandbox' || !me.mailConfigured ? (
        <div className="mx-auto mt-4 max-w-5xl px-4">
          <p className="rounded-2xl bg-wash-2 px-4 py-3 text-[0.95rem]">
            {me.checkoutMode === 'disabled' ? 'Checkout is switched off: customers can browse but not order. ' : null}
            {me.checkoutMode === 'square_link' ? 'Manual payment mode: customers pay on your Square link and you mark orders paid here. ' : null}
            {me.checkoutMode === 'square_api' && me.squareEnv === 'sandbox' ? 'Square is in TEST mode. No real money moves. ' : null}
            {!me.mailConfigured ? 'Email is not set up, so no confirmation emails go out.' : null}
          </p>
        </div>
      ) : null}

      <main className="mx-auto mt-6 max-w-5xl px-4">
        {tab === '' ? <OverviewTab me={me} go={go} />
          : tab === 'drops' ? <DropsTab />
          : tab === 'orders' ? <OrdersTab me={me} />
          : tab === 'menu' ? <MenuTab />
          : tab === 'inquiries' ? <InquiriesTab />
          : tab === 'content' ? <ContentTab />
          : tab === 'faq' ? <FaqTab />
          : tab === 'reviews' ? <ReviewsTab />
          : <p>Not found. <button className="underline" onClick={() => go('')}>Back to overview</button></p>}
      </main>
    </div>
  );
}
