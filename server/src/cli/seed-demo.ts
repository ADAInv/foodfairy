// Usage: npm run seed:demo
// Loads the three example items from the brief (Jollof Rice, Chicken, Puff
// Puff at the brief's example prices) plus an open food drop, so the
// ordering flow can be tested end to end. Demo products are flagged, shown
// with a warning in admin, and removable in one click. NOT for launch.

import { get, run } from '../db.js';

const cat = (slug: string) => get<{ id: number }>('SELECT id FROM categories WHERE slug = ?', [slug])?.id;
const demo: [string, string, string, number][] = [
  ['rice', 'Jollof Rice', 'Smoky, saucy and absolutely not here to play.', 1600],
  ['protein', 'Chicken', '', 1200],
  ['small-chops', 'Puff Puff', '', 1800]
];
for (const [slug, name, desc, price] of demo) {
  const c = cat(slug);
  if (!c) continue;
  if (get('SELECT 1 FROM products WHERE name = ? AND is_demo = 1', [name])) continue;
  run('INSERT INTO products (category_id, name, description, price_cents, is_demo) VALUES (?, ?, ?, ?, 1)', [c, name, desc, price]);
}

const now = Date.now();
const day = 86_400_000;
if (!get('SELECT 1 FROM drops WHERE closes_at > ?', [new Date(now).toISOString()])) {
  const pickup = new Date(now + 6 * day).toISOString().slice(0, 10);
  run(
    'INSERT INTO drops (title, opens_at, closes_at, pickup_date, pickup_window, note) VALUES (?, ?, ?, ?, ?, ?)',
    ['Demo drop', new Date(now - day).toISOString(), new Date(now + 5 * day).toISOString(), pickup, '12 – 4 PM', '']
  );
}
console.log('Demo data loaded. Delete it from Admin → Menu before launch.');
