import { Layout } from '../components/Layout';
import { Link } from '../lib/router';
import { useSite } from '../lib/store';

export function Faq() {
  const { data } = useSite();
  const faqs = data?.faqs ?? [];
  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 pb-10 pt-10 sm:pt-16">
        <h1 className="display text-[3rem] sm:text-7xl">Questions, answered.</h1>
        {data && faqs.length === 0 ? (
          <p className="mt-6 text-[1.15rem]">No FAQs up yet. Ask me directly and I'll answer.</p>
        ) : null}
        {faqs.length > 0 ? <div className="mt-8 divide-y divide-ink/15 border-y border-ink/15">
          {faqs.map((f) => (
            <details key={f.id} className="group py-1">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-[1.15rem] font-medium [&::-webkit-details-marker]:hidden">
                {f.question}
                <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full ring-1 ring-ink/20 text-xl transition group-open:rotate-45">+</span>
              </summary>
              <p className="whitespace-pre-line pb-5 text-[1.08rem] leading-relaxed text-ink-2">{f.answer}</p>
            </details>
          ))}
        </div> : null}
        <div className="relative mt-12 rounded-2xl bg-wash px-6 py-8 sm:px-10">
          <h2 className="display text-[2rem]">Still wondering?</h2>
          <p className="mt-2">Send me a message and I'll get back to you.</p>
          <Link href="/contact" className="btn btn-dark mt-5">Talk to the fairy →</Link>
        </div>
      </section>
    </Layout>
  );
}
