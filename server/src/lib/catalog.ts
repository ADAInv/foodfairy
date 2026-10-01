import { all } from '../db.js';
import { imageInfo, type PublicImage } from './images.js';

export interface PublicOption { id: number; name: string; priceCents: number; soldOut: boolean }
export interface PublicProduct {
  id: number;
  categoryId: number;
  name: string;
  description: string;
  priceCents: number;
  image: PublicImage | null;
  soldOut: boolean;
  allowNotes: boolean;
  notesPrompt: string;
  maxPerOrder: number;
  options: PublicOption[];
}
export interface PublicCategory { id: number; slug: string; name: string; emoji: string }

interface ProductRow {
  id: number; category_id: number; name: string; description: string; price_cents: number;
  image_id: string | null; sold_out: number; allow_notes: number; notes_prompt: string; max_per_order: number;
}
interface OptionRow { id: number; product_id: number; name: string; price_cents: number; sold_out: number }

export function publicCategories(): PublicCategory[] {
  return all<PublicCategory>('SELECT id, slug, name, emoji FROM categories WHERE active = 1 ORDER BY sort, id');
}

export function publicProducts(): PublicProduct[] {
  const rows = all<ProductRow>(
    `SELECT p.* FROM products p JOIN categories c ON c.id = p.category_id
      WHERE p.available = 1 AND c.active = 1 ORDER BY c.sort, p.sort, p.id`
  );
  const opts = all<OptionRow>('SELECT * FROM product_options ORDER BY sort, id');
  return rows.map((p) => ({
    id: p.id,
    categoryId: p.category_id,
    name: p.name,
    description: p.description,
    priceCents: p.price_cents,
    image: imageInfo(p.image_id),
    soldOut: !!p.sold_out,
    allowNotes: !!p.allow_notes,
    notesPrompt: p.notes_prompt,
    maxPerOrder: p.max_per_order,
    options: opts
      .filter((o) => o.product_id === p.id)
      .map((o) => ({ id: o.id, name: o.name, priceCents: o.price_cents, soldOut: !!o.sold_out }))
  }));
}
