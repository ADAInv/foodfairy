// Native <dialog>: focus trapping, Esc to close and an inert background
// come for free. Bottom sheet on phones, side panel / centred card on desktop.

import { useEffect, useRef, type ReactNode } from 'react';

export function Sheet({ open, onClose, label, children, variant = 'center' }: {
  open: boolean; onClose: () => void; label: string; children: ReactNode; variant?: 'center' | 'side';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { d.showModal(); document.documentElement.style.overflow = 'hidden'; }
    if (!open && d.open) d.close();
    if (!open) document.documentElement.style.overflow = '';
  }, [open]);
  useEffect(() => () => { document.documentElement.style.overflow = ''; }, []);

  const desktop = variant === 'side'
    ? 'sm:ml-auto sm:mr-0 sm:h-dvh sm:max-h-dvh sm:w-[28rem] sm:rounded-none sm:rounded-l-[2rem] sm:animate-[sheet-in_260ms_ease-out]'
    : 'sm:m-auto sm:max-h-[88dvh] sm:w-[34rem] sm:rounded-2xl sm:animate-[rise_240ms_ease-out]';

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className={`mb-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-[2rem] bg-paper p-0 text-ink
        backdrop:bg-ink/45 backdrop:backdrop-blur-[2px] animate-[sheet-up_280ms_cubic-bezier(.2,.9,.3,1)] ${desktop}`}
    >
      {open ? children : null}
    </dialog>
  );
}
