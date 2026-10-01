import type { Img } from '../lib/types';

export type Flag = 0 | 1;
export interface Me { email: string; checkoutMode: 'square_api' | 'square_link' | 'disabled'; squareEnv: string; mailConfigured: boolean; siteUrl: string }
export interface ACategory { id: number; slug: string; name: string; emoji: string; sort: number; active: Flag; product_count: number }
export interface AOption { id?: number; name: string; price_cents: number; sold_out: Flag }
export interface AProduct {
  id: number; category_id: number; name: string; description: string; price_cents: number; image_id: string | null; image: Img | null;
  available: Flag; sold_out: Flag; allow_notes: Flag; notes_prompt: string; max_per_order: number; sort: number; is_demo: Flag; options: AOption[];
}
export type DropState = 'upcoming' | 'open' | 'paused' | 'full' | 'closed';
export interface ADrop {
  id: number; title: string; opens_at: string; closes_at: string; opens_local: string; closes_local: string; pickup_date: string;
  pickup_window: string; paused: Flag; max_orders: number | null; note: string; state: DropState; order_count: number;
}
export interface AOrderItem { id: number; name: string; option_name: string; unit_cents: number; qty: number; notes: string }
export type OrderStatus = 'pending' | 'paid' | 'ready' | 'picked_up' | 'cancelled';
export interface AOrder {
  id: number; code: string; drop_id: number; pickup_date: string; customer_name: string; email: string; phone: string; notes: string;
  subtotal_cents: number; tax_cents: number; total_cents: number; status: OrderStatus; checkout_mode: string; created_at: string;
  paid_at: string | null; items: AOrderItem[];
}
export interface AInquiry { id: number; kind: 'catering' | 'contact'; name: string; email: string; payload: Record<string, string | number>; status: 'new' | 'replied' | 'archived'; created_at: string }
export interface AFaq { id: number; question: string; answer: string; sort: number; visible: Flag }
export interface AReview { id: number; author: string; body: string; source: string; sort: number; visible: Flag }
export interface Overview { drops: (Omit<ADrop, 'opens_local' | 'closes_local' | 'order_count'>)[]; ordersToPrep: number; newInquiries: number; demoProducts: number; products: number }
