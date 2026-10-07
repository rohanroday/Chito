import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { api, errorMessage } from '@/api/client';
import type { Category, Product, StoreInfo } from '@/api/types';

import { persistStorage } from './storage';

// ── Catalogue (small enough to load whole; cached so the app opens offline) ──
type CatalogState = {
  categories: Category[];
  products: Product[];
  loadedAt: number;
  loading: boolean;
  error: string;
  load: () => Promise<void>;
};

export const useCatalogStore = create<CatalogState>()(
  persist(
    (set, get) => ({
      categories: [],
      products: [],
      loadedAt: 0,
      loading: false,
      error: '',
      load: async () => {
        if (get().loading) return;
        set({ loading: true, error: '' });
        try {
          const r = await api<{ categories: Category[]; products: Product[] }>('/catalog', { auth: false });
          set({ categories: [...r.categories].sort((a, b) => a.sortOrder - b.sortOrder), products: r.products, loadedAt: Date.now(), loading: false });
        } catch (e) {
          set({ error: errorMessage(e), loading: false });
        }
      },
    }),
    { name: 'chito-catalog', storage: persistStorage, partialize: ({ categories, products, loadedAt }) => ({ categories, products, loadedAt }) },
  ),
);

/** Non-reactive lookup (for stores/actions). Components should use the hooks below. */
export const getProduct = (slug: string) => useCatalogStore.getState().products.find((p) => p.slug === slug);

export function useCategories() {
  return useCatalogStore((s) => s.categories);
}

export function useProducts() {
  return useCatalogStore((s) => s.products);
}

export function useProductMap() {
  const products = useProducts();
  return useMemo(() => new Map(products.map((p) => [p.slug, p])), [products]);
}

export function useProduct(slug: string | undefined) {
  const map = useProductMap();
  return slug ? map.get(slug) : undefined;
}

export function useProductsIn(category: string) {
  const products = useProducts();
  return useMemo(() => products.filter((p) => p.category === category), [products, category]);
}

// Everyday words people type for whole aisles (English + Nepali/Hindi, romanised)
// Aisle words people type: English, Nepali/Hindi in English letters, and in Devanagari
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  fresh_produce: ['फलफूल', 'फल', 'तरकारी', 'सब्जी', 'fruit', 'vegetable', 'veg', 'veggie', 'sabji', 'sabzi', 'tarkari', 'phal', 'phalphul', 'fresh', 'produce'],
  dairy: ['दुध', 'दूध', 'दही', 'पाउरोटी', 'ब्रेड', 'मक्खन', 'dairy', 'milk', 'dudh', 'bread', 'pauroti', 'bakery', 'curd', 'dahi'],
  staples: ['आटा', 'पिठो', 'चामल', 'चावल', 'दाल', 'तेल', 'घ्यू', 'घी', 'नुन', 'नमक', 'grocery', 'kirana', 'atta', 'rice', 'chamal', 'dal', 'oil', 'tel', 'ghee'],
  masala: ['मसला', 'मसाला', 'spice', 'masala', 'garam'],
  tea_coffee: ['चिया', 'चाय', 'कफी', 'कॉफी', 'tea', 'chiya', 'chai', 'coffee'],
  instant_food: ['चाउचाउ', 'नूडल्स', 'noodle', 'chauchau', 'maggi'],
  snacks: ['खाजा', 'नमकीन', 'snack', 'khaja', 'namkeen', 'chip'],
  beverages: ['जुस', 'पेय', 'drink', 'juice', 'cold drink', 'soft drink'],
  ready_to_eat: ['ready', 'instant meal', 'curry'],
  dry_fruits: ['मेवा', 'dry fruit', 'nut', 'meva'],
  chocolates: ['चकलेट', 'मिठाई', 'chocolate', 'sweet', 'mithai', 'candy'],
  baby_care: ['बच्चा', 'बच्चाको', 'baby', 'diaper', 'nappy', 'kids'],
  personal_care: ['साबुन', 'शैम्पू', 'bath', 'soap', 'sabun', 'shampoo', 'skin', 'beauty'],
  household: ['सफाई', 'cleaning', 'cleaner', 'detergent', 'washing'],
  home_utility: ['kitchen', 'home', 'bhada', 'utensil'],
  pet_care: ['कुकुर', 'बिरालो', 'कुत्ता', 'pet', 'dog', 'cat', 'kukur', 'biralo'],
  stationery: ['कपी', 'कलम', 'school', 'office', 'stationery', 'copy', 'pen'],
};

/** Very small English stemmer so "fruits" finds "fruit" and "tomatoes" finds "tomato". */
function stem(w: string): string {
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && w.endsWith('oes')) return w.slice(0, -2);
  if (w.length > 4 && /(ch|sh|x|ss)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

// Keep \p{M} (vowel signs like ि ा): without them Nepali "चिया" breaks into the single letters च / य,
// which match half the shop
const normalise = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ');

/**
 * Search products by name, local names (dudh, golbheda…) and aisle words (fruits, sabji…).
 * Every typed word must match somewhere. Whole matching aisles come first, then name matches.
 */
export function useSearch(query: string): { products: Product[]; categories: Category[] } {
  const products = useProducts();
  const categories = useCategories();
  return useMemo(() => {
    const words = normalise(query).split(/\s+/).filter(Boolean).map(stem);
    if (!words.length) return { products: [], categories: [] };

    const catText = new Map(
      categories.map((c) => [c.slug, normalise([c.name, c.nameNe, ...(CATEGORY_KEYWORDS[c.slug] ?? [])].join(' '))]),
    );
    const matchedCats = categories.filter((c) => words.every((w) => catText.get(c.slug)!.includes(w)));
    const matchedSlugs = new Set(matchedCats.map((c) => c.slug));

    const scored: { p: Product; score: number }[] = [];
    for (const p of products) {
      const name = normalise(p.name);
      const alt = normalise(p.altNames.join(' '));
      const cat = catText.get(p.category) ?? '';
      let score = matchedSlugs.has(p.category) ? 10 : 0;
      let all = true;
      for (const w of words) {
        if (name.includes(w)) score += name.split(/\s+/).some((t) => t.startsWith(w)) ? 4 : 3;
        else if (alt.includes(w)) score += 2;
        else if (cat.includes(w)) score += 1;
        else {
          all = false;
          break;
        }
      }
      if (all) scored.push({ p, score });
    }
    scored.sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name));
    return { products: scored.map((s) => s.p), categories: matchedCats };
  }, [products, categories, query]);
}

// Home "bazaar shelves" — curated rows with a local tone (slugs missing from the catalogue are skipped)
export const SHELVES: { title: string; category: string; slugs: string[] }[] = [
  {
    title: 'Fresh tarkari & phal',
    category: 'fresh_produce',
    slugs: ['fresh-tomatoes', 'green-capsicum', 'bananas', 'broccoli', 'harvest-gold-white-bread', 'amul-lassi'],
  },
  {
    title: 'Morning chiya & dudh',
    category: 'dairy',
    slugs: ['amul-taaza-milk', 'tata-tea-gold', 'brooke-bond-red-label', 'parle-g-biscuits', 'amul-butter', 'mother-dairy-classic-curd', 'britannia-marie-gold'],
  },
  {
    title: 'Daily kitchen',
    category: 'staples',
    slugs: ['aashirvaad-atta', 'india-gate-dubar', 'tata-sampann-toor-dal', 'fortune-sunlite-oil', 'tata-salt', 'tata-sampann-moong-dal', 'tata-sampann-besan'],
  },
  {
    title: 'Evening khaja',
    category: 'snacks',
    slugs: ['wai-wai-noodles', 'maggi-2-minute-noodles', 'haldirams-aloo-bhujia', 'lays-classic-salted', 'bingo-tedhe-medhe', 'thums-up-750ml', 'kissan-tomato-ketchup'],
  },
  {
    title: 'Sweet treats',
    category: 'chocolates',
    slugs: ['cadbury-dairy-milk', 'kitkat', 'kinder-joy', 'cadbury-5-star', 'oreo-original', 'paper-boat-aamras', 'ferrero-rocher'],
  },
];

// ── Store settings (fees, hours, radius) — the admin edits these ──
// Seed defaults so the UI can render before the first fetch; the server always re-checks.
const DEFAULT_STORE: StoreInfo = {
  name: 'Chito Singtam Bazaar',
  address: 'Singtam Bazaar, East Sikkim 737134',
  location: { lat: 27.234, lng: 88.499 },
  serviceRadiusKm: 3,
  isOpen: true,
  isOpenNow: true,
  closedMessage: '',
  openTime: '06:00',
  closeTime: '22:00',
  minOrderValue: 9900,
  deliveryFee: 2000,
  freeDeliveryAbove: 19900,
  handlingFee: 500,
  baseEtaMin: 15,
  supportPhone: '',
};

type StoreState = { info: StoreInfo; loadedAt: number; load: () => Promise<void> };

export const useStoreInfoStore = create<StoreState>()(
  persist(
    (set) => ({
      info: DEFAULT_STORE,
      loadedAt: 0,
      load: async () => {
        try {
          set({ info: await api<StoreInfo>('/store', { auth: false }), loadedAt: Date.now() });
        } catch {
          // keep the cached settings; checkout re-validates on the server
        }
      },
    }),
    { name: 'chito-store', storage: persistStorage, partialize: ({ info, loadedAt }) => ({ info, loadedAt }) },
  ),
);

export const useStoreInfo = () => useStoreInfoStore((s) => s.info);
