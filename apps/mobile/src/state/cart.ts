import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Product } from '@/api/types';

import { getProduct } from './catalog';
import { persistStorage } from './storage';

type CartState = {
  items: Record<string, number>; // slug -> qty
  add: (slug: string) => void;
  remove: (slug: string) => void;
  setQty: (slug: string, qty: number) => void;
  clear: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: {},
      add: (slug) =>
        set((s) => {
          const p = getProduct(slug);
          // Not sold any more (e.g. "Reorder" on an old order): don't add an invisible line
          if (!p) return s;
          const max = Math.min(p.maxPerOrder, p.stock);
          const qty = Math.min((s.items[slug] ?? 0) + 1, max);
          return qty > 0 ? { items: { ...s.items, [slug]: qty } } : s;
        }),
      remove: (slug) =>
        set((s) => {
          const qty = (s.items[slug] ?? 0) - 1;
          const items = { ...s.items };
          if (qty <= 0) delete items[slug];
          else items[slug] = qty;
          return { items };
        }),
      setQty: (slug, qty) =>
        set((s) => {
          const items = { ...s.items };
          if (qty <= 0) delete items[slug];
          else items[slug] = qty;
          return { items };
        }),
      clear: () => set({ items: {} }),
    }),
    { name: 'chito-cart', storage: persistStorage },
  ),
);

export type CartLine = { slug: string; qty: number; name: string; unit: string; price: number; mrp: number; image: string; stock: number };

/** Join cart quantities with live catalogue data (items no longer sold are dropped). */
export function cartLines(items: Record<string, number>, products: Map<string, Product>): CartLine[] {
  return Object.entries(items).flatMap(([slug, qty]) => {
    const p = products.get(slug);
    return p ? [{ slug, qty, name: p.name, unit: p.unit, price: p.price, mrp: p.mrp, image: p.images[0] ?? '', stock: p.stock }] : [];
  });
}

export function cartTotals(lines: CartLine[]) {
  return lines.reduce(
    (t, l) => ({ count: t.count + l.qty, itemTotal: t.itemTotal + l.price * l.qty, mrpTotal: t.mrpTotal + l.mrp * l.qty }),
    { count: 0, itemTotal: 0, mrpTotal: 0 },
  );
}
