import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

type Base = { label: string; hint?: ReactNode; optional?: boolean; id: string };

function Label({ id, label, optional }: Base) {
  return (
    <label htmlFor={id} className="label">
      {label}{optional ? <span className="font-normal text-ink-2"> (optional)</span> : null}
    </label>
  );
}

export function Input({ label, hint, optional, id, ...rest }: Base & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <Label id={id} label={label} optional={optional} />
      <input id={id} className="field" required={!optional} aria-describedby={hint ? `${id}-hint` : undefined} {...rest} />
      {hint ? <p id={`${id}-hint`} className="mt-1 text-[0.9rem] text-ink-2">{hint}</p> : null}
    </div>
  );
}

export function TextArea({ label, hint, optional, id, ...rest }: Base & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <Label id={id} label={label} optional={optional} />
      <textarea id={id} className="field min-h-28" required={!optional} aria-describedby={hint ? `${id}-hint` : undefined} {...rest} />
      {hint ? <p id={`${id}-hint`} className="mt-1 text-[0.9rem] text-ink-2">{hint}</p> : null}
    </div>
  );
}

export function Select({ label, hint, optional, id, children, ...rest }: Base & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <Label id={id} label={label} optional={optional} />
      <select id={id} className="field appearance-none bg-[length:1rem] bg-[right_1rem_center] bg-no-repeat pr-10" required={!optional} {...rest}>
        {children}
      </select>
      {hint ? <p className="mt-1 text-[0.9rem] text-ink-2">{hint}</p> : null}
    </div>
  );
}

/** Hidden from people; bots fill it in. */
export function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <label>Website<input tabIndex={-1} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} /></label>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  return (
    <p role="alert" aria-live="assertive" className={message ? 'rounded-2xl bg-wash-2 px-4 py-3 font-semibold' : 'sr-only'}>
      {message ?? ''}
    </p>
  );
}
