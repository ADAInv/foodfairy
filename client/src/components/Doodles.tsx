// Small, quiet marks. The fairy herself lives only in the logo (see Brand.tsx).

type P = { className?: string; title?: string };

/** A fine four-point glint, the same shape that trails off the fairy's wand. */
export function Sparkle({ className = '', title }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <path fill="currentColor" d="M12 0C12.9 7.6 16.4 11.1 24 12 16.4 12.9 12.9 16.4 12 24 11.1 16.4 7.6 12.9 0 12 7.6 11.1 11.1 7.6 12 0Z" />
    </svg>
  );
}

/** Stand-in when a product has no photo yet: a quiet wash with one glint. */
export function PlatePlaceholder({ className = '' }: { emoji?: string; className?: string }) {
  return (
    <div className={`relative grid place-items-center overflow-hidden bg-wash ${className}`} aria-hidden>
      <span className="absolute aspect-square h-[72%] rounded-full border border-dashed border-fairy/70" />
      <Sparkle className="h-[16%] w-[16%] max-h-10 max-w-10 text-fairy" />
    </div>
  );
}
