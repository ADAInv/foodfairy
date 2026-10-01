import { useEffect, useState, type ReactNode } from 'react';
import { Link, useRouter } from '../lib/router';
import { useOrderNow } from '../lib/useOrderNow';
import { useBasket, useSite, useUi } from '../lib/store';
import { money } from '../lib/format';
import { Logo } from './Brand';
import { BasketSheet } from './BasketSheet';
import { ProductSheet } from './ProductSheet';
import { AddedToast } from './Toast';

/** Compact logo for small spots (admin, etc.). `className` sets the height. */
export function Wordmark({ className = 'h-12', tone = 'ink' }: { className?: string; tone?: 'ink' | 'orange' }) {
  return <Logo tone={tone} className={`w-auto ${className}`} />;
}

function BasketPill({ className = '' }: { className?: string }) {
  const { count, subtotal } = useBasket();
  const { setBasketOpen, pulse } = useUi();
  return (
    <button
      type="button"
      onClick={() => setBasketOpen(true)}
      aria-label={`Open your fairy basket, ${count} ${count === 1 ? 'item' : 'items'}`}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-4 text-[0.95rem] font-medium text-paper ${className}`}
    >
      <span key={pulse} className={`inline-block text-fairy ${pulse ? 'animate-pop' : ''}`} aria-hidden>✦</span>
      <span className="tabular-nums">{count} {count === 1 ? 'item' : 'items'}</span>
      {count > 0 ? <span className="hidden text-paper/70 sm:inline">{money(subtotal)}</span> : null}
    </button>
  );
}

/** On the homepage the hero carries the full logo, so the header's copy waits
 *  until the hero has scrolled away. Everywhere else it's always shown. */
function useHeroLogoVisible() {
  const { path } = useRouter();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = document.getElementById('hero-mark');
    if (!el || !('IntersectionObserver' in window)) { setVisible(false); return; }
    const io = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting), { rootMargin: '-72px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [path]);
  return visible;
}

function Header() {
  const goOrder = useOrderNow();
  const { data } = useSite();
  const heroLogo = useHeroLogoVisible();
  const nav = [
    ['/#menu', 'Menu'],
    ['/catering', 'Catering'],
    ['/about', 'About']
  ] as const;
  return (
    <>
      {data?.settings.announcement ? (
        <p className="on-dark bg-ink px-4 py-2 text-center text-[0.95rem] text-paper">{data.settings.announcement}</p>
      ) : null}
      <header className="sticky top-0 z-30 bg-fairy">
        <div className="mx-auto flex h-[4.25rem] max-w-6xl items-center justify-between gap-4 px-4 md:h-[4.75rem]">
          <Link href="/" aria-label="The Food Fairy, home"
            className={`block transition-opacity duration-300 ${heroLogo ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
            tabIndex={heroLogo ? -1 : undefined}>
            <Logo eager className="h-[3.4rem] w-auto md:h-[3.9rem]" />
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
            {nav.map(([href, label]) => (
              <Link key={href} href={href} className="text-[1.02rem] font-medium underline-offset-[7px] decoration-[1.5px] hover:underline">{label}</Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button type="button" onClick={goOrder} className="btn btn-primary hidden min-h-11 px-5 text-[0.8rem] md:inline-flex">Order food ✦</button>
            <BasketPill />
          </div>
        </div>
      </header>
    </>
  );
}

function MobileBar() {
  const goOrder = useOrderNow();
  const { count } = useBasket();
  const { setBasketOpen } = useUi();
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-paper/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden">
      <div className="flex gap-3">
        <button type="button" onClick={goOrder} className="btn btn-primary flex-1">Order food ✦</button>
        <button type="button" onClick={() => setBasketOpen(true)} className="btn btn-fairy px-5" aria-label={`Open your fairy basket, ${count} items`}>
          <span aria-hidden>✦</span><span className="tabular-nums">{count}</span>
        </button>
      </div>
    </div>
  );
}

function Footer() {
  const { data } = useSite();
  const s = data?.settings;
  const link = 'w-fit text-paper/85 hover:text-paper hover:underline underline-offset-4';
  return (
    <footer className="on-dark bg-ink text-paper">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 pb-32 pt-16 md:grid-cols-[1.3fr_1fr_1fr] md:pb-16">
        <div>
          <Logo tone="orange" className="h-auto w-44" />
          <p className="mt-6 max-w-xs text-paper/75">Nigerian food made fresh in Kitchener / Waterloo. Pickup only. The exact spot is shared after you order.</p>
        </div>
        <nav aria-label="Footer" className="flex flex-col gap-3">
          <Link href="/#menu" className={link}>Menu</Link>
          <Link href="/catering" className={link}>Feed my people →</Link>
          <Link href="/about" className={link}>About</Link>
          <Link href="/faq" className={link}>FAQ</Link>
          <Link href="/contact" className={link}>Talk to the fairy →</Link>
        </nav>
        <div className="flex flex-col gap-3">
          {s?.instagram ? <a href={`https://www.instagram.com/${s.instagram}/`} target="_blank" rel="noopener noreferrer" className={link}>Instagram @{s.instagram}</a> : null}
          {s?.tiktok ? <a href={`https://www.tiktok.com/@${s.tiktok}`} target="_blank" rel="noopener noreferrer" className={link}>TikTok @{s.tiktok}</a> : null}
          {s?.contact_email ? <a href={`mailto:${s.contact_email}`} className={link}>{s.contact_email}</a> : null}
          <p className="mt-6 text-sm text-paper/55">© {new Date().getFullYear()} The Food Fairy</p>
        </div>
      </div>
    </footer>
  );
}

export function Layout({ children, bare = false }: { children: ReactNode; bare?: boolean }) {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-paper">Skip to content</a>
      <Header />
      <main id="main">{children}</main>
      <Footer />
      {!bare ? <MobileBar /> : null}
      <BasketSheet />
      <ProductSheet />
      <AddedToast />
    </>
  );
}
