import { useMemo } from 'react';
import { Link } from '../lib/router';
import { useSite, useUi } from '../lib/store';
import { useOrderNow } from '../lib/useOrderNow';
import { pickupDay, whenLabel } from '../lib/format';
import { Layout } from '../components/Layout';
import { DropTicket } from '../components/DropTicket';
import { Menu } from '../components/Menu';
import { FoodImage } from '../components/FoodImage';
import { HeroMark } from '../components/Brand';
import { Sparkle } from '../components/Doodles';

export function Home() {
  return (
    <Layout>
      <Hero />
      <HeroPhoto />
      <div className="mx-auto max-w-6xl px-4 pt-10 sm:pt-14"><DropTicket /></div>
      <Cravings />
      <Menu />
      <CateringTeaser />
      <Reviews />
      <Founder />
      <Social />
    </Layout>
  );
}

function StatusLine() {
  const { data, headlineDrop: d, canOrder } = useSite();
  if (!data) return <p className="mt-5 h-6" aria-hidden />;
  let text: string;
  if (canOrder && d?.state === 'open') text = `Ordering now for ${pickupDay(d.pickupDate)}. Orders close ${whenLabel(d.closesAt)}.`;
  else if (d?.state === 'upcoming') text = `The fairy is off duty. Orders open ${whenLabel(d.opensAt)}.`;
  else text = 'The fairy is off duty. Next drop coming soon.';
  return (
    <p className="mt-5 flex max-w-md items-start gap-2.5 text-[1rem] font-medium">
      <Sparkle className="mt-[0.3rem] h-3.5 w-3.5 shrink-0" />{text}
    </p>
  );
}

function Hero() {
  const goOrder = useOrderNow();
  return (
    <section className="bg-fairy">
      <div className="mx-auto grid max-w-6xl items-center gap-x-14 gap-y-6 px-4 pb-12 pt-2 md:grid-cols-[1.1fr_1fr] md:pb-20 md:pt-10">
        <HeroMark id="hero-mark" className="w-[min(19rem,78vw)] md:order-2 md:w-full md:max-w-[30rem] md:justify-self-end" />
        <div className="md:order-1">
          <h1 className="display text-[2.85rem] sm:text-[4rem] lg:text-[4.9rem]">The kind of food you think about later.</h1>
          <p className="mt-4 max-w-md text-[1.2rem] leading-snug">Nigerian food made fresh in Kitchener / Waterloo.</p>
          <StatusLine />
          <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-4">
            <button type="button" onClick={goOrder} className="btn btn-primary min-h-14 px-8 text-[0.95rem]">Order food ✦</button>
            <Link href="/catering" className="link-arrow text-[1.02rem]">Planning an event? →</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The hero photo straddles the orange/white seam. Hidden until she uploads one. */
function HeroPhoto() {
  const { data } = useSite();
  const hero = data?.images.hero ?? null;
  if (!hero) return null;
  return (
    <div className="bg-[linear-gradient(var(--color-fairy)_50%,var(--color-paper)_50%)]">
      <div className="mx-auto max-w-6xl px-4">
        <div className="aspect-[4/3] overflow-hidden rounded-2xl sm:aspect-[21/9]">
          <FoodImage img={hero} alt="Food from The Food Fairy" sizes="(min-width: 1152px) 1120px, 94vw" eager />
        </div>
      </div>
    </div>
  );
}

function Cravings() {
  const { data } = useSite();
  const { setFilter } = useUi();
  const cats = useMemo(() => {
    if (!data) return [];
    const withP = data.categories.filter((c) => data.products.some((p) => p.categoryId === c.id));
    return withP.length ? withP : data.categories;
  }, [data]);
  if (!data || cats.length === 0) return null;
  const go = (slug: string) => {
    setFilter(slug);
    requestAnimationFrame(() => document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  return (
    <section aria-labelledby="cravings" className="mx-auto max-w-6xl px-4 pt-14 sm:pt-20">
      <h2 id="cravings" className="display text-[2rem] sm:text-[2.6rem]">What are you craving?</h2>
      <ul className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1 sm:gap-x-9">
        {cats.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => go(c.slug)}
              className="outline-type text-[2.6rem] leading-[1.15] hover:text-ink focus-visible:text-ink sm:text-[4.25rem]">
              {c.name}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CateringTeaser() {
  const { data } = useSite();
  return (
    <section aria-labelledby="catering-teaser" className="bg-fairy">
      <div className="mx-auto grid max-w-6xl gap-x-14 gap-y-5 px-4 py-14 sm:py-20 md:grid-cols-2 md:items-end">
        <h2 id="catering-teaser" className="display text-[2.6rem] sm:text-[3.8rem]">Feeding more people?</h2>
        <div>
          <p className="max-w-xl text-[1.15rem]">{data?.settings.catering_intro}</p>
          <Link href="/catering" className="btn btn-primary mt-7">Catering →</Link>
        </div>
      </div>
    </section>
  );
}

function Reviews() {
  const { data } = useSite();
  if (!data || data.reviews.length === 0) return null;
  return (
    <section aria-labelledby="reviews" className="mx-auto max-w-6xl py-16">
      <h2 id="reviews" className="display px-4 text-[2.2rem] sm:text-[2.8rem]">What people said after</h2>
      <ul className="no-scrollbar mt-7 flex snap-x scroll-px-4 gap-5 overflow-x-auto px-4 pb-2">
        {data.reviews.map((r) => (
          <li key={r.id} className="w-[80vw] max-w-sm shrink-0 snap-start border-t border-ink pt-5">
            <blockquote className="display text-[1.45rem] leading-snug">“{r.body}”</blockquote>
            <p className="mt-4 font-medium">{r.author}{r.source ? <span className="font-normal text-ink-2">, {r.source}</span> : null}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Founder() {
  const { data } = useSite();
  const img = data?.images.founder ?? null;
  return (
    <section aria-labelledby="founder" className="mx-auto grid max-w-6xl items-center gap-x-16 gap-y-10 px-4 py-16 sm:py-24 md:grid-cols-[0.85fr_1.15fr]">
      <div className="arch mx-auto aspect-[4/5] w-full max-w-[16rem] overflow-hidden bg-wash sm:max-w-sm">
        {img ? <FoodImage img={img} alt="Firdaos, founder of The Food Fairy" sizes="(min-width: 640px) 384px, 256px" /> : (
          <div className="grid h-full place-items-center"><span className="display display-italic text-[6rem] text-fairy" aria-hidden>F</span></div>
        )}
      </div>
      <div>
        <h2 id="founder" className="display text-[2.5rem] sm:text-[3.4rem]">Hi, I'm Firdaos. ✦</h2>
        <div className="mt-6 max-w-[58ch] space-y-4 text-[1.1rem]">
          <p>I'm the brains behind The Food Fairy. What started with me making food I loved has grown into a little food business I'm ridiculously proud of, and I'm only getting started.</p>
          <p>I'm here to make the kind of food you think about later, one tray, plate and puff puff at a time.</p>
          <p>One day, I want The Food Fairy to be much bigger than my little kitchen corner. For now, I'm building it one order, one happy customer and one very full belly at a time.</p>
          <p>Thanks for being here. Seriously. ✦</p>
        </div>
        <Link href="/about" className="btn btn-ghost mt-8">Meet the fairy →</Link>
      </div>
    </section>
  );
}

function Social() {
  const { data } = useSite();
  const s = data?.settings;
  if (!s || (!s.instagram && !s.tiktok)) return null;
  return (
    <section aria-labelledby="social" className="mx-auto max-w-6xl px-4 pb-20">
      <div className="grid gap-x-14 gap-y-5 border-t border-ink/15 pt-12 md:grid-cols-2 md:items-end">
        <div>
          <h2 id="social" className="display text-[2.3rem] sm:text-[3rem]">You might as well follow me.</h2>
          <p className="mt-3 max-w-md text-[1.1rem]">The food is here. The behind-the-scenes chaos is on Instagram.</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-7 gap-y-4 md:justify-end">
          {s.instagram ? <a href={`https://www.instagram.com/${s.instagram}/`} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Follow along →</a> : null}
          {s.tiktok ? <a href={`https://www.tiktok.com/@${s.tiktok}`} target="_blank" rel="noopener noreferrer" className="link-arrow">TikTok @{s.tiktok}</a> : null}
        </div>
      </div>
    </section>
  );
}
