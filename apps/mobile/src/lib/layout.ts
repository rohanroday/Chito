import { useCart } from '@/state/cart';
import { useProductMap } from '@/state/catalog';

/** Product grids are 3 columns. Shared so grids and home shelves use the same card size. */
export const GRID_COLUMNS = 3;
export const GRID_GAP = 8;
export const GRID_PADDING = 12;
const MAX_CONTENT_WIDTH = 560; // keep cards phone-sized on tablets / web

export function gridCardWidth(screenWidth: number): number {
  const content = Math.min(screenWidth, MAX_CONTENT_WIDTH) - GRID_PADDING * 2;
  return Math.floor((content - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);
}

export function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

/**
 * Space to leave under scrolling tab screens. The tab bar sits *below* the screen (it doesn't overlap),
 * so only the floating checkout pill needs clearing: it's 52px tall, ~20px above the tab bar.
 */
export const PILL_CLEARANCE = 88;
export const BASE_BOTTOM_GAP = 24;

export function useBottomGap(): number {
  // Same rule as the checkout pill: only products still sold count (old cart lines may be gone)
  const items = useCart((s) => s.items);
  const products = useProductMap();
  const hasItems = Object.keys(items).some((slug) => products.has(slug));
  return hasItems ? PILL_CLEARANCE : BASE_BOTTOM_GAP;
}
