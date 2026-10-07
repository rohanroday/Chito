import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddButton } from '@/components/AddButton';
import { ArchImage } from '@/components/ArchImage';
import { ProductCard } from '@/components/ProductCard';
import { SectionTitle } from '@/components/SectionTitle';
import { Txt } from '@/components/Txt';
import { useCategories, useProduct, useProductsIn } from '@/state/catalog';
import { rupees } from '@/lib/format';
import { GRID_GAP, GRID_PADDING, gridCardWidth } from '@/lib/layout';
import { colors, radius, shadow } from '@/theme';

export default function ProductDetail() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const product = useProduct(slug);
  const sameCategory = useProductsIn(product?.category ?? '');
  const categories = useCategories();
  const [imgIdx, setImgIdx] = useState(0);

  if (!product) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Txt>Product not found</Txt>
      </View>
    );
  }

  const off = product.mrp > product.price ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;
  const similar = sameCategory.filter((p) => p.slug !== product.slug);
  const imgW = Math.min(width - 64, 360);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        <View style={{ backgroundColor: colors.sand, paddingTop: insets.top + 8, paddingBottom: 20, alignItems: 'center' }}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={12} accessibilityLabel="Back" style={{ alignSelf: 'flex-start', marginLeft: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={24} color={colors.maroon} />
          </Pressable>
          <ArchImage path={product.images[imgIdx]} size={imgW * 1.05} width={imgW} />
          {product.images.length > 1 && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              {product.images.map((img, i) => (
                <Pressable key={img} onPress={() => setImgIdx(i)} style={{ borderRadius: 10, borderWidth: 2, borderColor: i === imgIdx ? colors.maroon : 'transparent' }}>
                  <ArchImage path={img} size={52} />
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={{ padding: 16, gap: 6 }}>
          <Pressable onPress={() => router.navigate({ pathname: '/categories', params: { cat: product.category } })}>
            <Txt variant="micro" color={colors.turquoise}>
              {categories.find((c) => c.slug === product.category)?.name.toUpperCase()}
            </Txt>
          </Pressable>
          <Txt variant="h1">{product.name}</Txt>
          <Txt color={colors.muted}>{product.unit}</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <Txt variant="h1" color={colors.maroon}>
              {rupees(product.price)}
            </Txt>
            {off > 0 && (
              <>
                <Txt color={colors.muted} style={{ textDecorationLine: 'line-through' }}>
                  MRP {rupees(product.mrp)}
                </Txt>
                <View style={{ backgroundColor: colors.vermilion, borderRadius: 4, paddingHorizontal: 6 }}>
                  <Txt variant="micro" color={colors.white}>
                    {off}% OFF
                  </Txt>
                </View>
              </>
            )}
          </View>
          <Txt variant="caption" color={colors.muted}>
            Inclusive of all taxes
          </Txt>

          <View style={{ marginTop: 12, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 4 }}>
            <Txt variant="h3">Details</Txt>
            <Txt color={colors.muted}>Delivered fresh by Chito. Max {product.maxPerOrder} per order.</Txt>
            {product.altNames.length > 0 && <Txt color={colors.muted}>Also known as: {product.altNames.join(', ')}</Txt>}
          </View>
        </View>

        {similar.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <SectionTitle title="Goes well with" />
            <FlatList
              horizontal
              data={similar}
              keyExtractor={(p) => p.slug}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: GRID_PADDING, gap: GRID_GAP }}
              renderItem={({ item }) => <ProductCard product={item} width={gridCardWidth(width)} />}
            />
          </View>
        )}
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', alignItems: 'center', ...shadow }}>
        <View style={{ flex: 1 }}>
          <Txt variant="caption" color={colors.muted}>
            {product.unit}
          </Txt>
          <Txt variant="h2" color={colors.maroon}>
            {rupees(product.price)}
          </Txt>
        </View>
        <AddButton slug={product.slug} size="lg" disabled={product.stock <= 0} />
      </View>
    </View>
  );
}
