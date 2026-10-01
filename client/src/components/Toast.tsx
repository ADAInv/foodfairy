import { useUi } from '../lib/store';
import { Sparkle } from './Doodles';

export function AddedToast() {
  const { toast, dismissToast, setBasketOpen } = useUi();
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 md:bottom-6 md:justify-end md:px-6">
      {toast ? (
        <div key={toast} className="pointer-events-auto flex w-full max-w-sm animate-[rise_220ms_ease-out] flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-ink px-4 py-3 text-paper on-dark">
          <p className="display flex flex-1 items-center gap-2 whitespace-nowrap text-[1.3rem]">
            Good choice. <Sparkle className="h-5 w-5 shrink-0 animate-pop text-fairy" />
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={dismissToast} className="min-h-10 whitespace-nowrap rounded-full px-3 text-[0.78rem] font-semibold uppercase tracking-[0.06em] ring-1 ring-paper/30 hover:bg-white/10">Keep shopping</button>
            <button type="button" onClick={() => { dismissToast(); setBasketOpen(true); }} className="min-h-10 whitespace-nowrap rounded-full bg-fairy px-3 text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-ink">View basket</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
