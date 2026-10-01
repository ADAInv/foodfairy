import { Layout } from '../components/Layout';
import { useOrderNow } from '../lib/useOrderNow';
import { Link } from '../lib/router';

export function NotFound() {
  const goOrder = useOrderNow();
  return (
    <Layout>
      <section className="mx-auto max-w-xl px-4 py-24 text-center">
        <p className="outline-type text-[6.5rem] leading-none" aria-hidden>404</p>
        <h1 className="display mt-4 text-[2.6rem] sm:text-5xl">Oops. You wandered off the path.</h1>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <button type="button" onClick={goOrder} className="btn btn-primary">Order food ✦</button>
          <Link href="/" className="btn btn-ghost">Home</Link>
        </div>
      </section>
    </Layout>
  );
}
