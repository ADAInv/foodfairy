export interface Img { id: string; width: number; height: number; sizes: number[]; alt: string }
export interface Option { id: number; name: string; priceCents: number; soldOut: boolean }
export interface Product {
  id: number; categoryId: number; name: string; description: string; priceCents: number; image: Img | null;
  soldOut: boolean; allowNotes: boolean; notesPrompt: string; maxPerOrder: number; options: Option[];
}
export interface Category { id: number; slug: string; name: string; emoji: string }
export type DropState = 'upcoming' | 'open' | 'paused' | 'full' | 'closed';
export interface Drop {
  id: number; title: string; opensAt: string; closesAt: string; pickupDate: string; pickupWindow: string; note: string; state: DropState;
}
export interface Settings {
  announcement: string; hero_image_id: string; founder_image_id: string; instagram: string; tiktok: string;
  contact_email: string; pickup_area: string; tax_percent: string; tax_label: string; catering_intro: string;
  catering_minimum_notice: string;
}
export interface Bootstrap {
  categories: Category[]; products: Product[]; drops: Drop[]; settings: Settings;
  images: { hero: Img | null; founder: Img | null };
  faqs: { id: number; question: string; answer: string }[];
  reviews: { id: number; author: string; body: string; source: string }[];
  checkout: { enabled: boolean; mode: 'square_api' | 'square_link' | 'disabled' };
  serverTime: string;
}
