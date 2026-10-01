import { Layout } from '../components/Layout';
import { FoodImage } from '../components/FoodImage';
import { Sparkle } from '../components/Doodles';
import { useSite } from '../lib/store';
import { useOrderNow } from '../lib/useOrderNow';

// Copy is the owner's own words from the brief. Only capitalization of
// "And one day" was fixed. Edit here if she revises it.
export function About() {
  const { data } = useSite();
  const img = data?.images.founder ?? null;
  const goOrder = useOrderNow();
  return (
    <Layout>
      <article className="mx-auto max-w-6xl px-4 pb-10 pt-10 sm:pt-16">
        <div className="grid items-start gap-10 md:grid-cols-[0.85fr_1.15fr] md:gap-16">
          <div className="relative mx-auto w-full max-w-[15rem] sm:max-w-sm md:sticky md:top-28">
            <div className="arch relative aspect-[4/5] overflow-hidden bg-wash">
              {img ? <FoodImage img={img} alt="Firdaos, founder of The Food Fairy" sizes="(min-width: 768px) 380px, 88vw" eager /> : (
                <div className="grid h-full place-items-center"><span className="display display-italic text-[7rem] text-fairy" aria-hidden>F</span></div>
              )}
            </div>
          </div>

          <div>
            <h1 className="display text-[3rem] leading-[0.95] sm:text-7xl">Hi, I'm Firdaos ✦</h1>
            <p className="display display-italic mt-5 max-w-[30ch] text-[1.6rem] leading-snug text-ink-2 sm:text-3xl">
              I started The Food Fairy because I genuinely love cooking for people.
            </p>

            <div className="mt-8 max-w-[62ch] space-y-5 text-[1.12rem] leading-relaxed">
              <p>I love feeding people, but more than that, I love seeing their faces when they eat my food. When someone takes a bite and their whole expression changes, or they go back for more before they've even finished the first plate… yeah. I like that a lot. <span aria-hidden>😂</span></p>
              <p>I think some of the business side of me probably came from my mom. She's always been a business owner, so growing up, I was around that mindset without really realizing I was picking it up. Watching her build things, figure things out and make things work definitely rubbed off on me.</p>
              <p className="display text-[1.8rem] leading-tight">So eventually, I thought, why not me?</p>
              <p>Food Fairy started in Windsor, where I began experimenting with Nigerian food, figuring out what people liked, making mistakes, changing recipes, taking orders, learning how to run a business and basically teaching myself as I went.</p>
              <p>Then I moved to Waterloo, and Food Fairy came with me.</p>
              <p>Since then, I've been figuring out how to grow this thing from something I love doing into an actual brand. I'm still experimenting. I'm still learning. Some ideas work, some absolutely do not, and sometimes I have to go back to the drawing board. But I actually love that part too.</p>
              <p>Because I don't just want Food Fairy to be a business that sells food. I want to build something that people recognize, remember and genuinely want to come back to.</p>
              <p className="display text-[1.8rem] leading-tight">And one day, I want a real Food Fairy space.</p>
              <p className="flex items-start gap-2 font-semibold">For now, you're here. And honestly, that's pretty special. <Sparkle className="mt-1 h-5 w-5 shrink-0 text-fairy" /></p>
            </div>

            <button type="button" onClick={goOrder} className="btn btn-primary mt-10 min-h-14 px-8">Order food ✦</button>
          </div>
        </div>
      </article>
    </Layout>
  );
}
