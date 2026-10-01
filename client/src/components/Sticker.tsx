import { useId } from 'react';

/** The round Food Fairy seal that sits on the hero photo. */
export function Sticker({ className = '' }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="The Food Fairy, Nigerian food">
      <defs>
        <path id={`ring-${id}`} d="M100,100 m-70,0 a70,70 0 1,1 140,0 a70,70 0 1,1 -140,0" />
      </defs>
      <path fill="#fffae8" d="M100 4l9 8 12-4 6 11 13-1 2 12 12 3-1 13 10 7-5 11 7 10-8 9 3 12-11 6v13l-12 3-3 12-13-1-6 11-12-4-9 8-9-8-12 4-6-11-13 1-2-12-12-3 1-13-10-7 5-11-7-10 8-9-3-12 11-6V52l12-3 3-12 13 1 6-11 12 4z" transform="rotate(-8 100 100)" />
      <circle cx="100" cy="100" r="86" fill="#741c14" />
      <text fill="#fffae8" fontSize="17" fontWeight="700" letterSpacing="1" style={{ fontFamily: 'var(--font-sans)' }}>
        <textPath href={`#ring-${id}`} textLength="435" lengthAdjust="spacing">THE FOOD FAIRY ✦ NIGERIAN FOOD ✦ K–W ✦</textPath>
      </text>
      <path fill="#e0913d" d="M100.3 66c1.5 15.5 10 24.8 26.5 28.2-16.5 2.9-24.6 12.5-27 27.8-2.3-15-10.9-24.3-27.6-27.1 16.3-3.5 25.3-12.8 28.1-28.9z" />
    </svg>
  );
}
