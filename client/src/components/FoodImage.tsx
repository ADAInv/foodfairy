import type { Img } from '../lib/types';

export function srcSet(img: Img) {
  return img.sizes.map((w) => `/media/${img.id}-${w}.webp ${w}w`).join(', ');
}

export function FoodImage({ img, alt, sizes, className = '', eager = false }: {
  img: Img; alt: string; sizes: string; className?: string; eager?: boolean;
}) {
  const largest = img.sizes[img.sizes.length - 1] ?? img.width;
  return (
    <img
      src={`/media/${img.id}-${img.sizes.includes(960) ? 960 : largest}.webp`}
      srcSet={srcSet(img)}
      sizes={sizes}
      width={img.width}
      height={img.height}
      alt={img.alt || alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      {...(eager ? { fetchPriority: 'high' as const } : {})}
      className={`h-full w-full object-cover ${className}`}
    />
  );
}
