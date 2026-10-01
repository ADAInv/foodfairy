// Server-side <head> for each route. Link previews (Instagram DMs,
// iMessage, WhatsApp) don't run JavaScript, so titles, descriptions and
// OG images have to be in the HTML the server sends.

import { config } from './config.js';
import { getSettings } from './lib/settings.js';

interface Meta { title: string; description: string; index: boolean; status: number }

const ROUTES: Record<string, Omit<Meta, 'status'>> = {
  '/': {
    title: 'The Food Fairy — Nigerian food in Kitchener / Waterloo',
    description: 'Nigerian food made fresh in Kitchener / Waterloo. Individual meals, family trays, small chops, corporate lunches and catering. Order online for pickup.',
    index: true
  },
  '/menu': {
    title: 'Menu — The Food Fairy | Nigerian food in Waterloo & Kitchener',
    description: 'See what’s on this food drop and order Nigerian food for pickup in Kitchener / Waterloo.',
    index: true
  },
  '/catering': {
    title: 'Nigerian catering in Waterloo & Kitchener — The Food Fairy',
    description: 'Nigerian catering for office lunches, birthdays, showers and family gatherings in Kitchener / Waterloo. Request a quote.',
    index: true
  },
  '/about': {
    title: 'Hi, I’m Firdaos — About The Food Fairy',
    description: 'The Food Fairy started in Windsor and moved to Waterloo. The story behind a little Nigerian food business in Kitchener / Waterloo.',
    index: true
  },
  '/faq': {
    title: 'FAQ — The Food Fairy',
    description: 'Ordering, pickup and catering questions for The Food Fairy, Nigerian food in Kitchener / Waterloo.',
    index: true
  },
  '/contact': {
    title: 'Talk to the Fairy — The Food Fairy',
    description: 'Get in touch with The Food Fairy, Nigerian food and catering in Kitchener / Waterloo.',
    index: true
  },
  '/checkout': { title: 'Checkout — The Food Fairy', description: 'Your fairy basket.', index: false },
  '/admin': { title: 'Admin — The Food Fairy', description: '', index: false }
};

export function metaFor(path: string): Meta {
  const clean = path.replace(/\/+$/, '') || '/';
  if (ROUTES[clean]) return { ...ROUTES[clean]!, status: 200 };
  if (clean.startsWith('/admin')) return { ...ROUTES['/admin']!, status: 200 };
  if (/^\/order\/[A-Za-z0-9_-]{32}$/.test(clean)) {
    return { title: 'Your order — The Food Fairy', description: '', index: false, status: 200 };
  }
  return { title: 'Oops. You wandered off the path. — The Food Fairy', description: '', index: false, status: 404 };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderHead(path: string, meta: Meta): string {
  const s = getSettings();
  const url = `${config.siteUrl}${path === '/' ? '' : path.replace(/\/+$/, '')}`;
  const ogImage = s.hero_image_id ? `${config.siteUrl}/media/${s.hero_image_id}-og.jpg` : '';
  const tags = [
    `<title>${esc(meta.title)}</title>`,
    meta.description ? `<meta name="description" content="${esc(meta.description)}">` : '',
    `<meta name="robots" content="${meta.index ? 'index,follow' : 'noindex,nofollow'}">`,
    meta.index ? `<link rel="canonical" href="${esc(url)}">` : '',
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="The Food Fairy">`,
    `<meta property="og:title" content="${esc(meta.title)}">`,
    meta.description ? `<meta property="og:description" content="${esc(meta.description)}">` : '',
    `<meta property="og:url" content="${esc(url)}">`,
    ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : '',
    ogImage ? `<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">` : '',
    `<meta name="twitter:card" content="${ogImage ? 'summary_large_image' : 'summary'}">`
  ];
  if (path === '/') {
    // No street address on purpose: area served only.
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'FoodEstablishment',
      name: 'The Food Fairy',
      url: config.siteUrl,
      servesCuisine: 'Nigerian',
      areaServed: [{ '@type': 'City', name: 'Kitchener' }, { '@type': 'City', name: 'Waterloo' }],
      founder: { '@type': 'Person', name: 'Firdaos' },
      sameAs: [
        s.instagram ? `https://www.instagram.com/${s.instagram}/` : '',
        s.tiktok ? `https://www.tiktok.com/@${s.tiktok}` : ''
      ].filter(Boolean),
      ...(ogImage ? { image: ogImage } : {})
    };
    tags.push(`<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`);
  }
  return tags.filter(Boolean).join('\n    ');
}

export function sitemap(): string {
  const pages = Object.entries(ROUTES).filter(([, m]) => m.index).map(([p]) => p);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url><loc>${config.siteUrl}${p === '/' ? '/' : p}</loc></url>`).join('\n')}
</urlset>`;
}

export function robots(): string {
  return `User-agent: *\nDisallow: /admin\nDisallow: /checkout\nDisallow: /order/\nDisallow: /api/\nSitemap: ${config.siteUrl}/sitemap.xml\n`;
}
