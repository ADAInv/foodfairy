import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from './api';
import { useRouter } from './router';
import type { Bootstrap, Drop, Product } from './types';

// ------------------------------------------------------------------ site data
interface SiteCtx {
  data: Bootstrap | null;
  error: string | null;
  refresh: () => Promise<void>;
  openDrops: Drop[];
  headlineDrop: Drop | null;
  canOrder: boolean;
  productById: Map<number, Product>;
}
const Site = createContext<SiteCtx>(null as unknown as SiteCtx);

export function SiteProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try { setData(await api<Bootstrap>('/api/bootstrap')); setError(null); }
    catch (e) { setError((e as Error).message); }
  }, []);

  useEffect(() => {
    void refresh();
    const iv = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 60_000);
    const onVis = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onVis); };
  }, [refresh]);

  // Re-fetch exactly when the next drop opens or closes, so the page flips
  // state without anyone reloading.
  useEffect(() => {
    if (!data) return;
    const now = Date.now();
    const next = data.drops.flatMap((d) => [d.opensAt, d.closesAt]).map((t) => new Date(t).getTime() - now).filter((ms) => ms > 0 && ms < 86_400_000).sort((a, b) => a - b)[0];
    if (next === undefined) return;
    const t = setTimeout(() => void refresh(), next + 1500);
    return () => clearTimeout(t);
  }, [data, refresh]);

  const value = useMemo<SiteCtx>(() => {
    const drops = data?.drops ?? [];
    const openDrops = drops.filter((d) => d.state === 'open').sort((a, b) => a.closesAt.localeCompare(b.closesAt));
    const headlineDrop = openDrops[0] ?? drops.find((d) => d.state === 'upcoming') ?? drops[0] ?? null;
    return {
      data, error, refresh, openDrops, headlineDrop,
      canOrder: !!data?.checkout.enabled && openDrops.length > 0,
      productById: new Map((data?.products ?? []).map((p) => [p.id, p]))
    };
  }, [data, error, refresh]);

  return <Site.Provider value={value}>{children}</Site.Provider>;
}
export const useSite = () => useContext(Site);

// ------------------------------------------------------------------ basket
export interface BasketItem { key: string; productId: number; optionId: number | null; qty: number; notes: string }
export interface BasketLine extends BasketItem { product: Product | undefined; name: string; optionName: string; unitCents: number; problem: string | null }

interface BasketCtx {
  items: BasketItem[];
  lines: BasketLine[];
  count: number;
  subtotal: number;
  hasProblems: boolean;
  add: (productId: number, optionId: number | null, qty: number, notes?: string) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
}
const Basket = createContext<BasketCtx>(null as unknown as BasketCtx);
const STORAGE_KEY = 'ff_basket_v1';

function load(): BasketItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((i) => i && typeof i.productId === 'number' && typeof i.qty === 'number').slice(0, 40) : [];
  } catch { return []; }
}

export function BasketProvider({ children }: { children: ReactNode }) {
  const { productById, data } = useSite();
  const [items, setItems] = useState<BasketItem[]>(load);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* private mode */ } }, [items]);

  const add = useCallback((productId: number, optionId: number | null, qty: number, notes = '') => {
    const key = `${productId}:${optionId ?? 0}:${notes.trim().toLowerCase()}`;
    setItems((prev) => {
      const max = productById.get(productId)?.maxPerOrder ?? 20;
      const found = prev.find((i) => i.key === key);
      if (found) return prev.map((i) => (i.key === key ? { ...i, qty: Math.min(max, i.qty + qty) } : i));
      return [...prev, { key, productId, optionId, qty: Math.min(max, qty), notes: notes.trim() }];
    });
  }, [productById]);

  const setQty = useCallback((key: string, qty: number) => {
    setItems((prev) => (qty <= 0 ? prev.filter((i) => i.key !== key) : prev.map((i) => (i.key === key ? { ...i, qty } : i))));
  }, []);
  const remove = useCallback((key: string) => setItems((prev) => prev.filter((i) => i.key !== key)), []);
  const clear = useCallback(() => setItems([]), []);

  const lines = useMemo<BasketLine[]>(() => items.map((i) => {
    const product = productById.get(i.productId);
    const option = product?.options.find((o) => o.id === i.optionId);
    let problem: string | null = null;
    if (data && !product) problem = 'No longer on the menu';
    else if (product?.soldOut || option?.soldOut) problem = 'You guys ate this one up.';
    else if (product && product.options.length > 0 && !option) problem = 'Pick a size again';
    return {
      ...i, product,
      name: product?.name ?? 'Item',
      optionName: option?.name ?? '',
      unitCents: option?.priceCents ?? product?.priceCents ?? 0,
      problem
    };
  }), [items, productById, data]);

  const value = useMemo<BasketCtx>(() => ({
    items, lines, add, setQty, remove, clear,
    count: items.reduce((s, i) => s + i.qty, 0),
    subtotal: lines.filter((l) => !l.problem).reduce((s, l) => s + l.unitCents * l.qty, 0),
    hasProblems: lines.some((l) => l.problem)
  }), [items, lines, add, setQty, remove, clear]);

  return <Basket.Provider value={value}>{children}</Basket.Provider>;
}
export const useBasket = () => useContext(Basket);

// ------------------------------------------------------------------ UI state
interface UiCtx {
  basketOpen: boolean; setBasketOpen: (v: boolean) => void;
  productId: number | null; openProduct: (id: number | null) => void;
  filter: string; setFilter: (slug: string) => void;
  toast: number; showAdded: () => void; dismissToast: () => void;
  pulse: number;
}
const Ui = createContext<UiCtx>(null as unknown as UiCtx);

export function UiProvider({ children }: { children: ReactNode }) {
  const [basketOpen, setBasketOpen] = useState(false);
  const [productId, openProduct] = useState<number | null>(null);
  const [filter, setFilter] = useState('all');
  const [toast, setToast] = useState(0);
  const [pulse, setPulse] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const showAdded = useCallback(() => {
    setToast((t) => t + 1);
    setPulse((p) => p + 1);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(0), 4200);
  }, []);
  const dismissToast = useCallback(() => { clearTimeout(timer.current); setToast(0); }, []);
  // Leaving a page closes anything floating over it (toast, basket, product sheet).
  const { path } = useRouter();
  useEffect(() => { dismissToast(); setBasketOpen(false); openProduct(null); }, [path, dismissToast]);
  // Opening the basket makes the "Good choice." toast redundant.
  useEffect(() => { if (basketOpen) dismissToast(); }, [basketOpen, dismissToast]);
  return (
    <Ui.Provider value={{ basketOpen, setBasketOpen, productId, openProduct, filter, setFilter, toast, showAdded, dismissToast, pulse }}>
      {children}
    </Ui.Provider>
  );
}
export const useUi = () => useContext(Ui);
