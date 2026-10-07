import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import type { Product } from '@/api/types';
import { rupees } from '@/lib/format';
import { colors, radius } from '@/theme';

import { AddButton } from './AddButton';
import { ArchImage } from './ArchImage';
import { Txt } from './Txt';

/** Narrow cards (3-per-row grids) stack price above a full-width Add button. */
const COMPACT_BELOW = 140;

export function ProductCard({ product, width }: { product: Product; width: number }) {
  const off = product.mrp > product.price ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;
  const soldOut = product.stock <= 0;
  const compact = width < COMPACT_BELOW;
  const pad = compact ? 6 : 8;
  const inner = width - pad * 2;
  // Card is a plain View: the tappable area (image + name) and the AddButton are siblings,
  // so buttons are never nested (invalid on web, ambiguous for screen readers).
  return (
    <View
      style={{
        width,
        backgroundColor: colors.card,
        borderRadius: compact ? radius.md + 2 : radius.lg,
        borderWidth: 1,
        borderColor: colors.line,
        padding: pad,
      }}>
      <Pressable
        onPress={() => router.push({ pathname: '/product/[slug]', params: { slug: product.slug } })}
        accessibilityRole="link"
        accessibilityLabel={`${product.name}, ${product.unit}, ${rupees(product.price)}`}>
        <View>
          <ArchImage path={product.images[0]} size={inner} width={inner} dim={soldOut} />
          {off > 0 && (
            <View style={{ position: 'absolute', left: 4, bottom: 6, backgroundColor: colors.vermilion, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
              <Txt variant="micro" color={colors.white} style={compact ? { fontSize: 9, lineHeight: 12 } : undefined}>
                {off}% OFF
              </Txt>
            </View>
          )}
        </View>
        <Txt
          variant="strong"
          numberOfLines={2}
          style={compact ? { marginTop: 6, minHeight: 34, fontSize: 13, lineHeight: 17 } : { marginTop: 8, minHeight: 42 }}>
          {product.name}
        </Txt>
        <Txt variant="caption" color={colors.muted} numberOfLines={1} style={compact ? { fontSize: 12, lineHeight: 16 } : undefined}>
          {product.unit}
        </Txt>
      </Pressable>

      {compact ? (
        <View style={{ marginTop: 4, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' }}>
            <Txt variant="price" color={colors.maroon} style={{ fontSize: 15 }}>
              {rupees(product.price)}
            </Txt>
            {off > 0 && (
              <Txt variant="caption" color={colors.muted} style={{ fontSize: 11, textDecorationLine: 'line-through' }}>
                {rupees(product.mrp)}
              </Txt>
            )}
          </View>
          <AddButton slug={product.slug} disabled={soldOut} block />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
          <View>
            <Txt variant="price" color={colors.maroon}>
              {rupees(product.price)}
            </Txt>
            {off > 0 && (
              <Txt variant="caption" color={colors.muted} style={{ textDecorationLine: 'line-through' }}>
                {rupees(product.mrp)}
              </Txt>
            )}
          </View>
          <AddButton slug={product.slug} disabled={soldOut} />
        </View>
      )}
    </View>
  );
}
