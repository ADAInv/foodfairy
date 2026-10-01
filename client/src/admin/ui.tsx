import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { Img } from '../lib/types';

/** Fetch-on-mount with reload. Keeps the last good data while reloading. */
export function useLoad<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try { setData(await api<T>(path)); setError(null); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [path]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, error, loading, reload, setData };
}

/** Wrap an async action: disables while running, surfaces errors, flashes "Saved". */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  const run = useCallback(async (fn: () => Promise<unknown>, opts: { flash?: boolean } = {}) => {
    setBusy(true); setError(null);
    try {
      await fn();
      if (opts.flash !== false) { setSaved(true); clearTimeout(t.current); t.current = setTimeout(() => setSaved(false), 2200); }
      return true;
    } catch (e) { setError((e as Error).message); return false; }
    finally { setBusy(false); }
  }, []);
  return { busy, error, saved, run, setError };
}

export function Status({ error, saved }: { error: string | null; saved?: boolean }) {
  return (
    <p role="status" aria-live="polite" className={error ? 'rounded-xl bg-wash-2 px-3 py-2 font-semibold' : saved ? 'font-semibold text-ink-2' : 'sr-only'}>
      {error ?? (saved ? 'Saved ✦' : '')}
    </p>
  );
}

export function Panel({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-3xl border-2 border-ink/10 bg-white/60 p-4 sm:p-6">
      {title || action ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title ? <h2 className="display text-[1.7rem]">{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 select-none">
      <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span aria-hidden className="relative h-7 w-12 shrink-0 rounded-full bg-ink/20 transition peer-checked:bg-ink peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-fairy after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-paper after:transition peer-checked:after:translate-x-5" />
      <span className="font-semibold">{label}</span>
    </label>
  );
}

export const STATE_LABEL: Record<string, string> = {
  upcoming: 'Upcoming', open: 'Open now', paused: 'Paused', full: 'Full', closed: 'Closed',
  pending: 'Awaiting payment', paid: 'Paid — to prep', ready: 'Ready', picked_up: 'Picked up', cancelled: 'Cancelled',
  new: 'New', replied: 'Replied', archived: 'Archived'
};
const TONE: Record<string, string> = {
  open: 'bg-fairy text-ink', paid: 'bg-fairy text-ink', new: 'bg-fairy text-ink',
  upcoming: 'bg-wash-2', ready: 'bg-wash-2', pending: 'bg-wash', paused: 'bg-wash', full: 'bg-wash',
  closed: 'bg-ink/10 text-ink-2', picked_up: 'bg-ink/10 text-ink-2', cancelled: 'bg-ink/10 text-ink-2 line-through',
  replied: 'bg-ink/10 text-ink-2', archived: 'bg-ink/10 text-ink-2'
};
export function Pill({ state }: { state: string }) {
  return <span className={`inline-block rounded-full px-3 py-1 text-[0.8rem] font-bold ${TONE[state] ?? 'bg-wash'}`}>{STATE_LABEL[state] ?? state}</span>;
}

/** "16" / "16.50" / "$16.5" -> cents, or null if it isn't a price. */
export function parseMoney(s: string): number | null {
  const clean = s.replace(/[$,\s]/g, '');
  if (!/^\d{1,5}(\.\d{0,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}
export const centsToInput = (c: number) => (c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2));

export function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

// Phone photos are big. Shrink to 2400px JPEG before upload (also turns HEIC
// into something the server accepts on browsers that can decode it).
async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 4_000_000 && /^image\/(jpeg|png|webp)$/.test(file.type)) return file;
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.9));
    return blob ?? file;
  } catch { return file; }
}

export function uploadImage(file: File, alt: string) {
  return shrink(file).then((blob) => api<Img>(`/api/admin/images?alt=${encodeURIComponent(alt)}`, { raw: blob }));
}

export function ImagePicker({ image, onChange, alt, label, shape = 'rounded-2xl', aspect = 'aspect-square' }: {
  image: Img | null; onChange: (img: Img | null) => void; alt: string; label: string; shape?: string; aspect?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setError(null);
    try { onChange(await uploadImage(file, alt)); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  };
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-4">
        <div className={`relative w-28 shrink-0 overflow-hidden bg-wash ${shape} ${aspect}`}>
          {image ? <img src={`/media/${image.id}-${image.sizes[0]}.webp`} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-sm text-ink-2">No photo</span>}
          {busy ? <span className="absolute inset-0 grid place-items-center bg-paper/80 text-sm font-semibold">Uploading…</span> : null}
        </div>
        <div className="flex flex-col items-start gap-2">
          <label className="btn btn-ghost min-h-11 cursor-pointer px-4 text-[0.8rem]">
            {image ? 'Replace photo' : 'Add photo'}
            <input ref={input} type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => void pick(e.target.files?.[0])} />
          </label>
          {image ? <button type="button" className="text-sm font-semibold underline" onClick={() => onChange(null)}>Remove</button> : null}
        </div>
      </div>
      {error ? <p className="mt-2 rounded-xl bg-wash-2 px-3 py-2 text-sm font-semibold">{error}</p> : null}
    </div>
  );
}
