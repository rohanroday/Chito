import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, LayoutGrid, Search as SearchIcon, X } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, Pressable, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DentilBorder, Mountains } from '@/components/ornaments';
import { ProductCard } from '@/components/ProductCard';
import { Txt } from '@/components/Txt';
import { useSearch } from '@/state/catalog';
import { GRID_COLUMNS, GRID_GAP, GRID_PADDING, gridCardWidth } from '@/lib/layout';
import { colors, fonts, radius } from '@/theme';

const POPULAR = ['fruits', 'tarkari', 'chiya', 'dudh', 'Wai Wai', 'atta', 'dal', 'masala', 'biscuit', 'chocolate', 'shampoo', 'tel'];

export default function Search() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [q, setQ] = useState('');
  const { products: results, categories: aisles } = useSearch(q);
  const cardW = gridCardWidth(width);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ backgroundColor: colors.maroon, paddingTop: insets.top + 8, paddingHorizontal: 12, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={12} accessibilityLabel="Back">
          <ChevronLeft size={26} color={colors.gold} />
        </Pressable>
        <View style={{ flex: 1, height: 46, borderRadius: radius.pill, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 8 }}>
          <SearchIcon size={18} color={colors.muted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            autoFocus
            placeholder="Search in English or local names"
            placeholderTextColor={colors.subtle}
            returnKeyType="search"
            accessibilityLabel="Search products"
            style={{ flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.ink }}
          />
          {q.length > 0 && (
            <Pressable onPress={() => setQ('')} hitSlop={10} accessibilityLabel="Clear search">
              <X size={18} color={colors.muted} />
            </Pressable>
          )}
        </View>
      </View>
      <DentilBorder />

      {q.trim() === '' ? (
        <View style={{ padding: 16, gap: 10 }}>
          <Txt variant="h2">Popular in Sikkim</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {POPULAR.map((p) => (
              <Pressable key={p} onPress={() => setQ(p)} style={{ backgroundColor: colors.maroon50, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6 }}>
                <Txt variant="strong" color={colors.maroon}>
                  {p}
                </Txt>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          data={results}
          numColumns={GRID_COLUMNS}
          keyExtractor={(p) => p.slug}
          keyboardShouldPersistTaps="handled"
          columnWrapperStyle={{ gap: GRID_GAP, paddingHorizontal: GRID_PADDING }}
          contentContainerStyle={{ gap: GRID_GAP, paddingVertical: 12, paddingBottom: insets.bottom + 40 }}
          ListHeaderComponent={
            results.length ? (
              <View style={{ paddingHorizontal: GRID_PADDING, gap: 8 }}>
                {/* Whole aisles that match, e.g. "fruits" → Fruits & Vegetables */}
                {aisles.map((c) => (
                  <Pressable
                    key={c.slug}
                    onPress={() => router.navigate({ pathname: '/categories', params: { cat: c.slug } })}
                    accessibilityRole="link"
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.turquoise50, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10 }}>
                    <LayoutGrid size={18} color={colors.turquoise} />
                    <Txt variant="strong" color={colors.turquoise} style={{ flex: 1 }}>
                      {c.name} · see the whole aisle
                    </Txt>
                    <ChevronRight size={18} color={colors.turquoise} />
                  </Pressable>
                ))}
                <Txt variant="caption" color={colors.muted} style={{ paddingHorizontal: 4 }}>
                  {results.length} {results.length === 1 ? 'result' : 'results'} for &quot;{q.trim()}&quot;
                </Txt>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', padding: 24, gap: 8 }}>
              <Mountains height={80} />
              <Txt variant="h2">No &quot;{q}&quot; yet</Txt>
              <Txt color={colors.muted} style={{ textAlign: 'center' }}>
                Try another word, like &quot;dudh&quot; or &quot;atta&quot;. Need something we don&apos;t have? Call us from the Me tab.
              </Txt>
            </View>
          }
          renderItem={({ item }) => <ProductCard product={item} width={cardW} />}
        />
      )}
    </View>
  );
}
