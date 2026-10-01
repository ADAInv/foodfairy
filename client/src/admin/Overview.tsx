import { api } from '../lib/api';
import type { Me, Overview } from './types';
import { Panel, Pill, Status, fmtDateTime, useAction, useLoad } from './ui';

export function OverviewTab({ me, go }: { me: Me; go: (t: string) => void }) {
  const { data, error, reload } = useLoad<Overview>('/api/admin/overview');
  const act = useAction();
  if (!data) return <Status error={error} />;

  const deleteDemo = () => {
    if (!confirm(`Delete the ${data.demoProducts} demo items? This can't be undone.`)) return;
    void act.run(async () => { await api('/api/admin/products/delete-demo', { method: 'POST' }); await reload(); });
  };

  return (
    <div className="space-y-6">
      {data.demoProducts > 0 ? (
        <div className="on-dark rounded-2xl bg-ink p-5 text-paper sm:p-6">
          <h2 className="display text-[1.6rem]">Demo items are live</h2>
          <p className="mt-1 text-paper/85">{data.demoProducts} placeholder {data.demoProducts === 1 ? 'item is' : 'items are'} on the menu with made-up prices. Replace them with your real menu, then delete them. Editing a demo item makes it a real one.</p>
          <button type="button" className="btn btn-fairy mt-4" onClick={deleteDemo} disabled={act.busy}>Delete demo items</button>
          <Status error={act.error} />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat n={data.ordersToPrep} label="Paid orders to prep" onClick={() => go('orders')} />
        <Stat n={data.newInquiries} label="New inquiries" onClick={() => go('inquiries')} />
        <Stat n={data.products} label="Menu items" onClick={() => go('menu')} />
      </div>

      <Panel title="Order windows" action={<button type="button" className="btn btn-dark min-h-11 px-4 text-[0.8rem]" onClick={() => go('drops')}>Manage</button>}>
        {data.drops.length === 0 ? (
          <p>No upcoming order windows. The site shows "the fairy is off duty" until you add one.</p>
        ) : (
          <ul className="divide-y divide-ink/10">
            {data.drops.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-bold">{d.title || `Pickup ${d.pickup_date}`}</p>
                  <p className="text-sm text-ink-2">Opens {fmtDateTime(d.opens_at)} · closes {fmtDateTime(d.closes_at)}</p>
                </div>
                <Pill state={d.state} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <p className="text-sm text-ink-2">Signed in as {me.email}. Site: {me.siteUrl}</p>
    </div>
  );
}

function Stat({ n, label, onClick }: { n: number; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-3xl bg-wash p-5 text-left transition hover:bg-wash-2">
      <span className="display block text-[2.6rem] leading-none tabular-nums">{n}</span>
      <span className="mt-1 block font-semibold">{label}</span>
    </button>
  );
}
