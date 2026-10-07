import { router, useLocalSearchParams } from 'expo-router';
import { FlatList, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryRail, RAIL_WIDTH } from '@/components/CategoryRail';
import { DentilBorder } from '@/components/ornaments';
import { ProductCard } from '@/components/ProductCard';
import { Txt } from '@/components/Txt';
import { useBottomGap } from '@/lib/layout';
import { useCategories, useProductsIn } from '@/state/catalog';
import { colors } from '@/theme';

// Beside the rail there's room for 2 comfortable columns
const COLUMNS = 2;
const GAP = 8;
const PAD = 8;

export default function Categories() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { cat } = useLocalSearchParams<{ cat?: string }>();
  // The selected aisle lives in the URL, so Home tiles and the rail share one source of truth
  const categories = useCategories();
  const bottomGap = useBottomGap();
  const active = cat && categories.some((c) => c.slug === cat) ? cat : (categories[0]?.slug ?? '');
  const setActive = (slug: string) => router.setParams({ cat: slug });

  const items = useProductsIn(active);
  const category = categories.find((c) => c.slug === active);
  const gridW = Math.min(width, 640) - RAIL_WIDTH;
  const cardW = Math.floor((gridW - PAD * 2 - GAP * (COLUMNS - 1)) / COLUMNS);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ backgroundColor: colors.maroon, paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 12 }}>
        <Txt variant="h1" color={colors.gold}>
          Bazaar aisles
        </Txt>
        <Txt variant="caption" color={colors.white} style={{ opacity: 0.85 }}>
          {categories.length} categories · fresh to your door
        </Txt>
      </View>
      <DentilBorder />
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <CategoryRail items={categories} active={active} onChange={setActive} />
        <FlatList
          style={{ flex: 1 }}
          data={items}
          key={active}
          numColumns={COLUMNS}
          keyExtractor={(p) => p.slug}
          columnWrapperStyle={{ gap: GAP, paddingHorizontal: PAD }}
          contentContainerStyle={{ gap: GAP, paddingBottom: bottomGap, paddingTop: 10 }}
          ListHeaderComponent={
            <View style={{ paddingHorizontal: PAD + 2, paddingBottom: 2 }}>
              <Txt variant="h2" numberOfLines={1}>
                {category?.name}
              </Txt>
              <Txt variant="caption" color={colors.muted}>
                {items.length} items
              </Txt>
            </View>
          }
          renderItem={({ item }) => <ProductCard product={item} width={cardW} />}
        />
      </View>
    </View>
  );
}
