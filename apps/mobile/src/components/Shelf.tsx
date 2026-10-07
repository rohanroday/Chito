import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, FlatList, type NativeScrollEvent, type NativeSyntheticEvent, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { Product } from '@/api/types';
import { colors } from '@/theme';

import { CloudScroll, ShelfLine } from './ornaments';
import { ProductCard } from './ProductCard';
import { Txt } from './Txt';

const PAD = 12;
const GAP = 8;
const VISIBLE = 3.3; // the 4th card peeks in at the edge → "there's more this way"
const NUDGE_KEY = 'chito-shelf-nudge-seen';

/** Horizontal "bazaar shelf" of products with clear swipe affordances. */
export function Shelf({
  title,
  products,
  category,
  screenWidth,
  nudge = false,
}: {
  title: string;
  products: Product[];
  category?: string;
  screenWidth: number;
  /** Gently scroll right-and-back once, the first time the app is used. */
  nudge?: boolean;
}) {
  const list = useRef<FlatList<Product>>(null);
  const [atEnd, setAtEnd] = useState(false);
  const [offset, setOffset] = useState(0);
  const contentW = Math.min(screenWidth, 560);
  const cardW = Math.floor((contentW - PAD - GAP * Math.floor(VISIBLE)) / VISIBLE);
  const step = (cardW + GAP) * 2;

  useEffect(() => {
    if (!nudge) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    (async () => {
      const [seen, reduce] = await Promise.all([
        AsyncStorage.getItem(NUDGE_KEY).catch(() => '1'),
        AccessibilityInfo.isReduceMotionEnabled().catch(() => true),
      ]);
      if (cancelled || seen || reduce) return;
      timers.push(setTimeout(() => list.current?.scrollToOffset({ offset: cardW * 0.8, animated: true }), 1500));
      timers.push(setTimeout(() => list.current?.scrollToOffset({ offset: 0, animated: true }), 2300));
      AsyncStorage.setItem(NUDGE_KEY, '1').catch(() => undefined);
    })();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [nudge, cardW]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    setOffset(contentOffset.x);
    setAtEnd(contentOffset.x + layoutMeasurement.width >= contentSize.width - 8);
  };

  if (!products.length) return null;

  return (
    <View style={{ marginTop: 26 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10, gap: 8 }}>
        <CloudScroll />
        <Txt variant="h2" style={{ flex: 1 }} numberOfLines={1}>
          {title}
        </Txt>
        {category ? (
          <Pressable onPress={() => router.navigate({ pathname: '/categories', params: { cat: category } })} hitSlop={10} accessibilityRole="link">
            <Txt variant="strong" color={colors.turquoise}>
              See all ›
            </Txt>
          </Pressable>
        ) : (
          <Txt variant="caption" color={colors.turquoise}>
            Swipe →
          </Txt>
        )}
      </View>

      <View>
        <FlatList
          ref={list}
          horizontal
          data={products}
          keyExtractor={(p) => p.slug}
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={32}
          contentContainerStyle={{ paddingHorizontal: PAD, gap: GAP, paddingBottom: 6 }}
          renderItem={({ item }) => <ProductCard product={item} width={cardW} />}
        />

        {/* Right-edge fade + arrow: tapping it scrolls on */}
        {!atEnd && (
          <View pointerEvents="box-none" style={{ position: 'absolute', right: 0, top: 0, bottom: 6, width: 44, justifyContent: 'center' }}>
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <Svg width="100%" height="100%">
                <Defs>
                  <LinearGradient id="shelf-fade" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={colors.parchment} stopOpacity="0" />
                    <Stop offset="1" stopColor={colors.parchment} stopOpacity="0.95" />
                  </LinearGradient>
                </Defs>
                <Rect width="100%" height="100%" fill="url(#shelf-fade)" />
              </Svg>
            </View>
            <Pressable
              onPress={() => list.current?.scrollToOffset({ offset: offset + step, animated: true })}
              accessibilityRole="button"
              accessibilityLabel={`More in ${title}`}
              hitSlop={8}
              style={{
                alignSelf: 'flex-end',
                marginRight: 4,
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: colors.maroon,
                borderWidth: 1.5,
                borderColor: colors.gold,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <ChevronRight size={18} color={colors.gold} />
            </Pressable>
          </View>
        )}
      </View>
      <ShelfLine />
    </View>
  );
}
