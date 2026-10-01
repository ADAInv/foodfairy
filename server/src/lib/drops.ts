// Order windows ("food drops"). The server is the only authority on
// whether a drop is open; the client just renders what it's told.

import { all, get } from '../db.js';

export interface DropRow {
  id: number;
  title: string;
  opens_at: string;
  closes_at: string;
  pickup_date: string;
  pickup_window: string;
  paused: number;
  max_orders: number | null;
  note: string;
}

export type DropState = 'upcoming' | 'open' | 'paused' | 'full' | 'closed';

export interface PublicDrop {
  id: number;
  title: string;
  opensAt: string;
  closesAt: string;
  pickupDate: string;
  pickupWindow: string;
  note: string;
  state: DropState;
}

// Pending orders hold a slot for 30 minutes (time to finish on Square).
const PENDING_HOLD_MS = 30 * 60 * 1000;

function activeOrderCount(dropId: number): number {
  const cutoff = new Date(Date.now() - PENDING_HOLD_MS).toISOString();
  return get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM orders WHERE drop_id = ?
       AND (status IN ('paid','ready','picked_up') OR (status = 'pending' AND created_at > ?))`,
    [dropId, cutoff]
  )!.n;
}

export function dropState(d: DropRow, now = Date.now()): DropState {
  const opens = Date.parse(d.opens_at);
  const closes = Date.parse(d.closes_at);
  if (now >= closes) return 'closed';
  if (now < opens) return 'upcoming';
  if (d.paused) return 'paused';
  if (d.max_orders !== null && activeOrderCount(d.id) >= d.max_orders) return 'full';
  return 'open';
}

export function toPublic(d: DropRow): PublicDrop {
  return {
    id: d.id, title: d.title, opensAt: d.opens_at, closesAt: d.closes_at,
    pickupDate: d.pickup_date, pickupWindow: d.pickup_window, note: d.note, state: dropState(d)
  };
}

/** Drops that haven't closed yet, soonest first. */
export function currentDrops(): PublicDrop[] {
  const now = new Date().toISOString();
  return all<DropRow>('SELECT * FROM drops WHERE closes_at > ? ORDER BY opens_at ASC LIMIT 12', [now]).map(toPublic);
}

export function getDrop(id: number): DropRow | undefined {
  return get<DropRow>('SELECT * FROM drops WHERE id = ?', [id]);
}
