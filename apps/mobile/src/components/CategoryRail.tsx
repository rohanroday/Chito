import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import type { Category } from '@/api/types';
import { useBottomGap } from '@/lib/layout';
import { useProducts } from '@/state/catalog';
import { colors, flagColors } from '@/theme';

import { ArchImage } from './ArchImage';
import { Txt } from './Txt';

export const RAIL_WIDTH = 88;

// White flag needs a visible edge on parchment
const edgeColor = (i: number) => (flagColors[i % 5] === '#FFFFFF' ? colors.goldDeep : flagColors[i % 5]);

/** Vertical aisle list on the left. The selected aisle gets a prayer-flag colour edge. */
export function CategoryRail({ items, active, onChange }: { items: Category[]; active: string; onChange: (slug: string) => void }) {
  const scroller = useRef<ScrollView>(null);
  const ys = useRef<Record<string, number>>({});
  const products = useProducts();
  const bottomGap = useBottomGap();

  useEffect(() => {
    const y = ys.current[active];
    if (y !== undefined) scroller.current?.scrollTo({ y: Math.max(0, y - 80), animated: true });
  }, [active]);

  return (
    <ScrollView
      ref={scroller}
      style={{ width: RAIL_WIDTH, flexGrow: 0, backgroundColor: colors.sand, borderRightWidth: 1, borderRightColor: colors.line }}
      contentContainerStyle={{ paddingBottom: bottomGap }}
      showsVerticalScrollIndicator={false}>
      {items.map((c, i) => {
        const on = c.slug === active;
        const cover = products.find((p) => p.category === c.slug);
        return (
          <Pressable
            key={c.slug}
            onLayout={(e) => {
              ys.current[c.slug] = e.nativeEvent.layout.y;
              // First layout: bring a pre-selected aisle (from a Home tile) into view
              if (on) scroller.current?.scrollTo({ y: Math.max(0, e.nativeEvent.layout.y - 80), animated: false });
            }}
            onPress={() => onChange(c.slug)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={c.name}
            style={{
              alignItems: 'center',
              paddingVertical: 10,
              paddingHorizontal: 6,
              backgroundColor: on ? colors.card : 'transparent',
              borderLeftWidth: 4,
              borderLeftColor: on ? edgeColor(i) : 'transparent',
              borderBottomWidth: 1,
              borderBottomColor: colors.line,
            }}>
            <View style={{ opacity: on ? 1 : 0.85 }}>{cover && <ArchImage path={cover.images[0]} size={52} />}</View>
            <Txt
              variant={on ? 'strong' : 'caption'}
              color={on ? colors.maroon : colors.ink}
              numberOfLines={2}
              style={{ textAlign: 'center', marginTop: 4, fontSize: 12, lineHeight: 15 }}>
              {c.name}
            </Txt>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
