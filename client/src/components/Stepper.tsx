export function Stepper({ value, onChange, min = 1, max = 20, label, size = 'md' }: {
  value: number; onChange: (n: number) => void; min?: number; max?: number; label: string; size?: 'sm' | 'md';
}) {
  const btn = size === 'sm' ? 'h-9 w-9 text-lg' : 'h-12 w-12 text-xl';
  return (
    <div className="inline-flex items-center rounded-full bg-wash ring-[1.5px] ring-ink/15" role="group" aria-label={`Quantity for ${label}`}>
      <button type="button" className={`${btn} grid place-items-center rounded-full font-semibold hover:bg-wash-2 disabled:opacity-30`}
        onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`One less ${label}`}>−</button>
      <output className={`min-w-8 text-center font-semibold tabular-nums ${size === 'sm' ? 'text-base' : 'text-lg'}`} aria-live="polite">{value}</output>
      <button type="button" className={`${btn} grid place-items-center rounded-full font-semibold hover:bg-wash-2 disabled:opacity-30`}
        onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`One more ${label}`}>+</button>
    </div>
  );
}
