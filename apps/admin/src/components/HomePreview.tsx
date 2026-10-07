'use client';

import { Search } from 'lucide-react';
import { useState } from 'react';

import { imageUrl } from '@/lib/format';
import type { Category } from '@/lib/types';

/** The customer app shows this many categories on its Home screen (3 × 3 grid). Keep in sync with apps/mobile Home. */
export const HOME_COUNT = 9;

/**
 * A phone-shaped preview of the customer app's Home screen "Shop by category" grid,
 * drawn the same way as the app (arched tiles, alternating gold/turquoise, cover = first product photo).
 * Tiles can be dragged to reorder; clicking one points at its row in the table.
 */
export function HomePreview({
  categories,
  covers,
  onMove,
  onPick,
}: {
  /** All categories in the current (maybe unsaved) order, hidden ones included. */
  categories: Category[];
  /** category slug → ImageKit path of its cover photo */
  covers: Map<string, string>;
  /** Move within `categories` (indexes into the full list). */
  onMove: (from: number, to: number) => void;
  onPick: (slug: string) => void;
}) {
  const visible = categories.filter((c) => c.isActive);
  const home = visible.slice(0, HOME_COUNT);
  const more = visible.length - home.length;
  const [dragSlug, setDragSlug] = useState<string | null>(null);
  const indexOf = (slug: string) => categories.findIndex((c) => c.slug === slug);

  return (
    <div className="mx-auto w-[300px]">
      <div className="rounded-[2.4rem] border-[6px] border-ink bg-ink p-1 shadow-xl">
        <div className="relative h-[600px] overflow-hidden rounded-[1.9rem] bg-parchment">
          {/* Notch */}
          <div className="absolute left-1/2 top-1.5 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-ink" />

          {/* Header, as in the app */}
          <div className="bg-maroon px-4 pb-3 pt-8">
            <div className="font-display text-lg leading-tight text-gold">Namaste 🙏</div>
            <div className="text-[11px] font-semibold text-white">Delivery in 25 mins</div>
            <div className="mt-2 flex h-8 items-center gap-2 rounded-full bg-white px-3 text-[11px] text-subtle">
              <Search size={12} /> Search &quot;chiya&quot;, &quot;dudh&quot;…
            </div>
          </div>
          <div className="dentil" />

          <div className="h-[calc(100%-120px)] overflow-y-auto px-3 pb-6 pt-3">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="font-display text-base text-ink">Shop by category</span>
              <span className="text-[11px] font-bold text-turquoise">See all</span>
            </div>

            {home.length === 0 ? (
              <p className="py-10 text-center text-xs text-muted">No visible categories. Customers would see an empty grid.</p>
            ) : (
              <div className="grid grid-cols-3 gap-x-2 gap-y-3">
                {home.map((c, i) => {
                  const cover = covers.get(c.slug);
                  return (
                    <button
                      key={c.slug}
                      type="button"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move';
                        setDragSlug(c.slug);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (!dragSlug || dragSlug === c.slug) return;
                        onMove(indexOf(dragSlug), indexOf(c.slug));
                      }}
                      onDragEnd={() => setDragSlug(null)}
                      onClick={() => onPick(c.slug)}
                      title={`${c.name}: drag to move, click to find it in the list`}
                      className={`flex cursor-grab flex-col items-center text-center transition active:cursor-grabbing ${dragSlug === c.slug ? 'opacity-40' : ''}`}>
                      <span
                        className={`arch block w-full p-1.5 pb-1.5 ${i % 2 ? 'bg-turquoise-50' : 'bg-gold-50'}`}
                        style={{ borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }}>
                        <span className="arch block aspect-square w-full overflow-hidden bg-white" style={{ borderBottomLeftRadius: 6, borderBottomRightRadius: 6 }}>
                          {cover ? (
                            // eslint-disable-next-line @next/next/no-img-element -- ImageKit already resizes
                            <img src={imageUrl(cover, 160)} alt="" draggable={false} className="h-full w-full object-cover" />
                          ) : (
                            <span className="flex h-full items-center justify-center text-[10px] text-subtle">No photo</span>
                          )}
                        </span>
                      </span>
                      <span className="mt-1 line-clamp-2 text-[11px] font-bold leading-tight text-ink">{c.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {more > 0 && (
              <p className="mt-3 rounded-lg bg-sand/70 px-2 py-1.5 text-center text-[11px] text-wood">
                + {more} more {more === 1 ? 'category' : 'categories'} in the Categories tab
              </p>
            )}

            {/* The rest of Home (product shelves) isn't controlled here */}
            <div className="mt-4 space-y-2 opacity-50">
              <div className="h-3 w-28 rounded bg-line" />
              <div className="flex gap-2">
                {[0, 1, 2].map((k) => (
                  <div key={k} className="h-20 flex-1 rounded-lg bg-card ring-1 ring-line" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-muted">Live preview of the app&apos;s Home screen. Drag tiles to reorder.</p>
    </div>
  );
}
