import { LOGO_ASPECT } from './brandPaths';

/** The client's logo, served as a static SVG (black or orange).
 *  Size it with ONE dimension in className (e.g. `h-14 w-auto` or `w-44 h-auto`). */
export function Logo({ tone = 'ink', className = '', eager = false }: { tone?: 'ink' | 'orange'; className?: string; eager?: boolean }) {
  return (
    <img
      src={tone === 'ink' ? '/brand/logo-ink.svg' : '/brand/logo-orange.svg'}
      alt="The Food Fairy"
      width={Math.round(120 * LOGO_ASPECT)}
      height={120}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={`block select-none ${className}`}
      draggable={false}
    />
  );
}

// The trail leaves the wand tip, flicks up between the "h" and the fairy's arm,
// arcs over "The" and settles to its left in three glints. Coordinates are in
// the logo's own viewBox, so it stays attached at every size.
const TRAIL = 'M 988 318 C 975 240, 990 150, 1045 110 C 1100 70, 1090 20, 1010 25 C 880 30, 650 20, 520 90 C 440 135, 410 210, 445 270';
const GLINTS: Array<[number, number, number, number]> = [
  // x, y, size, delay (ms)
  [452, 318, 52, 1500],
  [372, 236, 26, 1640],
  [540, 352, 20, 1760]
];

function glintPath(x: number, y: number, s: number) {
  const k = s * 0.16; // waist of the four-point star
  return `M${x} ${y - s} C${x + k} ${y - k} ${x + k} ${y - k} ${x + s} ${y} C${x + k} ${y + k} ${x + k} ${y + k} ${x} ${y + s} C${x - k} ${y + k} ${x - k} ${y + k} ${x - s} ${y} C${x - k} ${y - k} ${x - k} ${y - k} ${x} ${y - s}Z`;
}

/**
 * Hero mark: the logo with a wand trail that draws itself once on load.
 * The only animated flourish on the site; reduced-motion users see it drawn.
 */
export function HeroMark({ className = '', id }: { className?: string; id?: string }) {
  return (
    <div id={id} className={`relative ${className}`} style={{ aspectRatio: String(LOGO_ASPECT) }}>
      <Logo eager className="absolute inset-0 h-full w-full" />
      <svg viewBox="15 14 1677 1258" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        <defs>
          <mask id="wand-reveal" maskUnits="userSpaceOnUse" x="0" y="-100" width="1800" height="1500">
            <path d={TRAIL} pathLength={1} fill="none" stroke="#fff" strokeWidth="40" strokeLinecap="round"
              style={{ strokeDasharray: 1, ['--len' as string]: 1, animation: 'trail 1.4s cubic-bezier(.45,.05,.3,1) .35s both' }} />
          </mask>
        </defs>
        <path d={TRAIL} fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeDasharray="0 24" mask="url(#wand-reveal)" />
        {GLINTS.map(([x, y, s, delay]) => (
          <path key={x} d={glintPath(x, y, s)} fill="currentColor"
            style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: `glint 520ms cubic-bezier(.3,1.5,.5,1) ${delay}ms both` }} />
        ))}
      </svg>
    </div>
  );
}
