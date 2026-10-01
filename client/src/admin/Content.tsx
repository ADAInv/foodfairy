import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import type { Img } from '../lib/types';
import { Input, TextArea } from '../components/Field';
import { ImagePicker, Panel, Status, useAction, useLoad } from './ui';

const KEYS = ['announcement', 'instagram', 'tiktok', 'contact_email', 'pickup_area', 'pickup_instructions', 'tax_percent', 'tax_label', 'catering_intro', 'catering_minimum_notice'] as const;
type Key = (typeof KEYS)[number];
type Settings = Record<Key, string> & { hero_image: Img | null; founder_image: Img | null };

export function ContentTab() {
  const { data, error, reload } = useLoad<Settings>('/api/admin/settings');
  const [f, setF] = useState<Settings | null>(null);
  const act = useAction();
  useEffect(() => { if (data) setF(data); }, [data]);
  if (!f) return <Status error={error} />;

  const set = (k: Key) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const body: Record<string, string> = { hero_image_id: f.hero_image?.id ?? '', founder_image_id: f.founder_image?.id ?? '' };
    for (const k of KEYS) body[k] = f[k];
    if (await act.run(() => api('/api/admin/settings', { method: 'PUT', body }))) await reload();
  };

  return (
    <form onSubmit={save} className="space-y-6">
      <Panel title="Homepage">
        <div className="space-y-5">
          <Input id="s-ann" label="Announcement bar" optional maxLength={160} value={f.announcement} onChange={set('announcement')}
            hint="Shows across the top of every page. Leave empty to hide it. Order open/close times update themselves from your order windows." />
          <div className="grid gap-6 sm:grid-cols-2">
            <ImagePicker label="Hero photo (top of homepage)" image={f.hero_image} alt="Food from The Food Fairy" onChange={(hero_image) => setF({ ...f, hero_image })} aspect="aspect-[4/5]" />
            <ImagePicker label="Founder photo (you!)" image={f.founder_image} alt="Firdaos, founder of The Food Fairy" onChange={(founder_image) => setF({ ...f, founder_image })} aspect="aspect-[4/5]" shape="rounded-[40%]" />
          </div>
          <p className="text-sm text-ink-2">The hero photo is also the preview image when someone shares your link on Instagram or iMessage.</p>
        </div>
      </Panel>

      <Panel title="Pickup">
        <div className="space-y-5">
          <Input id="s-area" label="Pickup area (public)" maxLength={120} value={f.pickup_area} onChange={set('pickup_area')} hint="General area only, e.g. “Waterloo, near Uptown”. Never your address." />
          <TextArea id="s-pick" label="Pickup instructions (private)" maxLength={2000} value={f.pickup_instructions} onChange={set('pickup_instructions')}
            hint="Only shown to customers after they've paid: on their confirmation page and in their email. Put the address and how to find you here." />
        </div>
      </Panel>

      <Panel title="Tax">
        <div className="grid gap-5 sm:grid-cols-2">
          <Input id="s-tax" label="Tax %" inputMode="decimal" value={f.tax_percent} onChange={set('tax_percent')} hint="0 if you don't charge tax. Ontario HST is 13." />
          <Input id="s-taxl" label="Tax label" optional maxLength={20} value={f.tax_label} onChange={set('tax_label')} placeholder="HST" />
        </div>
      </Panel>

      <Panel title="Catering">
        <div className="space-y-5">
          <TextArea id="s-cint" label="Catering intro" maxLength={600} value={f.catering_intro} onChange={set('catering_intro')} />
          <Input id="s-cnot" label="Notice needed" optional maxLength={200} value={f.catering_minimum_notice} onChange={set('catering_minimum_notice')} placeholder="e.g. Please give at least 2 weeks' notice." />
        </div>
      </Panel>

      <Panel title="Contact & socials">
        <div className="grid gap-5 sm:grid-cols-3">
          <Input id="s-ig" label="Instagram" optional maxLength={40} value={f.instagram} onChange={set('instagram')} hint="Without the @" />
          <Input id="s-tt" label="TikTok" optional maxLength={40} value={f.tiktok} onChange={set('tiktok')} hint="Without the @" />
          <Input id="s-mail" label="Public email" optional type="email" maxLength={254} value={f.contact_email} onChange={set('contact_email')} />
        </div>
      </Panel>

      <div className="sticky bottom-3 z-10 flex items-center gap-4 rounded-full bg-paper/95 p-2 shadow-[0_2px_16px_rgba(116,28,20,.15)]">
        <button className="btn btn-dark" disabled={act.busy}>{act.busy ? 'Saving…' : 'Save changes'}</button>
        <Status error={act.error} saved={act.saved} />
      </div>
    </form>
  );
}
