import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Bike, ChevronDown, MapPin, Search } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ArchImage } from '@/components/ArchImage';
import { Button } from '@/components/Button';
import { DentilBorder, Mountains, PrayerFlags } from '@/components/ornaments';
import { SectionTitle } from '@/components/SectionTitle';
import { Shelf } from '@/components/Shelf';
import { StoreClosedCard } from '@/components/StoreClosedStrip';
import { Txt } from '@/components/Txt';
import { rupees } from '@/lib/format';
import { chunk, GRID_COLUMNS, GRID_GAP, GRID_PADDING, gridCardWidth, useBottomGap } from '@/lib/layout';
import { deliveryLine, hoursLabel } from '@/lib/store-config';
import { hasTypedAddress, isForSomeoneElse, useAuth, useSelectedAddress } from '@/state/auth';
import { SHELVES, useCatalogStore, useCategories, useProductMap, useStoreInfo } from '@/state/catalog';
import { colors, radius } from '@/theme';

const GREETINGS = ['Tashi Delek', 'Namaste'] as const;

export default function Home() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const name = useAuth((s) => s.name);
  const address = useSelectedAddress();
  const store = useStoreInfo();
  const categories = useCategories();
  const productMap = useProductMap();
  const loading = useCatalogStore((s) => s.loading);
  const error = useCatalogStore((s) => s.error);
  const reload = useCatalogStore((s) => s.load);
  const bottomGap = useBottomGap();
  const [greeting] = useState(() => GREETINGS[new Date().getDate() % 2]);
  // Whole pixels: fractional widths can round up on Android and wrap the 3rd tile to a new row
  const tileW = gridCardWidth(width);
  const products = [...productMap.values()];
  // Show whatever the customer saved; flag a missing GPS pin instead of hiding the address
  const hasAddress = hasTypedAddress(address);
  const hasPin = !!address?.location;

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      {/* Carved lintel header */}
      <View style={{ backgroundColor: colors.maroon, paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Txt variant="h2" color={colors.gold}>
              {greeting}
              {name ? `, ${name}` : ''} 🙏
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Bike size={18} color={colors.white} />
              <Txt variant="h3" color={colors.white}>
                {deliveryLine(store, address?.distanceKm ?? 0)}
              </Txt>
            </View>
            <Pressable
              onPress={() => router.push(hasAddress ? { pathname: '/addresses', params: { pick: '1' } } : '/address')}
              hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              accessibilityRole="button"
              accessibilityLabel={hasAddress ? 'Change delivery address' : 'Set your delivery location'}>
              {!hasPin && <MapPin size={13} color={colors.gold} />}
              <Txt variant="caption" color={hasAddress ? colors.white : colors.gold} style={{ opacity: hasAddress ? 0.85 : 1, flexShrink: 1 }} numberOfLines={1}>
                {hasAddress ? `${isForSomeoneElse(address) ? `For ${address.recipientName} · ` : ''}${address.label} · ${address.landmark}` : 'Set your delivery location'}
              </Txt>
              {hasAddress && !hasPin && (
                <Txt variant="caption" color={colors.gold}>
                  · add pin
                </Txt>
              )}
              <ChevronDown size={14} color={colors.white} />
            </Pressable>
          </View>
          <Image source={require('@/assets/images/logo-tile.png')} style={{ width: 46, height: 46, borderRadius: 12 }} />
        </View>
        <Pressable
          onPress={() => router.push('/search')}
          accessibilityRole="search"
          style={{ marginTop: 12, height: 46, borderRadius: radius.pill, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 }}>
          <Search size={18} color={colors.muted} />
          <Txt color={colors.subtle}>Search &quot;chiya&quot;, &quot;dudh&quot;, &quot;Wai Wai&quot;…</Txt>
        </Pressable>
      </View>
      <DentilBorder />
      <View style={{ backgroundColor: colors.parchment }}>
        <PrayerFlags />
      </View>
      <StoreClosedCard />

      {/* Offer banner in an arch */}
      <View
        style={{
          marginHorizontal: 16,
          marginTop: 8,
          borderTopLeftRadius: 60,
          borderTopRightRadius: 60,
          borderBottomLeftRadius: radius.lg,
          borderBottomRightRadius: radius.lg,
          backgroundColor: colors.gold50,
          borderWidth: 1.5,
          borderColor: colors.goldDeep,
          overflow: 'hidden',
        }}>
        <View style={{ paddingTop: 22, paddingHorizontal: 20, alignItems: 'center' }}>
          <Txt variant="micro" color={colors.turquoise}>
            WELCOME TO CHITO
          </Txt>
          <Txt variant="h1" color={colors.maroon} style={{ textAlign: 'center' }}>
            Free delivery above {rupees(store.freeDeliveryAbove)}
          </Txt>
          <Txt variant="caption" color={colors.wood} style={{ textAlign: 'center' }}>
            Fresh to your door · {hoursLabel(store)}
          </Txt>
        </View>
        <Mountains height={56} back="#F3E3A6" front="#EAD27A" />
      </View>

      {/* First launch with no cache: loading / offline states */}
      {products.length === 0 && (
        <View style={{ alignItems: 'center', padding: 32, gap: 12 }}>
          {loading || !error ? (
            <>
              <ActivityIndicator color={colors.maroon} />
              <Txt color={colors.muted}>Opening the bazaar…</Txt>
            </>
          ) : (
            <>
              <Txt variant="h2">Couldn&apos;t load the bazaar</Txt>
              <Txt color={colors.muted} style={{ textAlign: 'center' }}>
                {error}
              </Txt>
              <Button title="Try again" onPress={reload} style={{ alignSelf: 'stretch' }} />
            </>
          )}
        </View>
      )}

      {/* Categories */}
      {categories.length > 0 && (
        <View style={{ marginTop: 22 }}>
          <SectionTitle title="Shop by category" action="See all" onAction={() => router.navigate('/categories')} />
          {/* Explicit rows of 3 (not flexWrap) so it's always exactly three columns */}
          <View style={{ paddingHorizontal: GRID_PADDING, gap: 14 }}>
            {chunk(categories.slice(0, 9), GRID_COLUMNS).map((row, r) => (
              <View key={r} style={{ flexDirection: 'row', gap: GRID_GAP }}>
                {row.map((c, j) => {
                  const i = r * GRID_COLUMNS + j;
                  const cover = products.find((p) => p.category === c.slug);
                  return (
                    <Pressable
                      key={c.slug}
                      onPress={() => router.navigate({ pathname: '/categories', params: { cat: c.slug } })}
                      accessibilityRole="button"
                      accessibilityLabel={c.name}
                      style={{ width: tileW, alignItems: 'center' }}>
                      <View
                        style={{
                          borderTopLeftRadius: tileW / 2,
                          borderTopRightRadius: tileW / 2,
                          borderBottomLeftRadius: 10,
                          borderBottomRightRadius: 10,
                          backgroundColor: i % 2 ? colors.turquoise50 : colors.gold50,
                          padding: 6,
                        }}>
                        {cover && <ArchImage path={cover.images[0]} size={tileW - 12} />}
                      </View>
                      <Txt variant="strong" numberOfLines={2} style={{ textAlign: 'center', marginTop: 6, fontSize: 13, lineHeight: 17 }}>
                        {c.name}
                      </Txt>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Bazaar shelves — scroll sideways (peeking card, arrow, one-time nudge) */}
      {SHELVES.map((shelf, i) => (
        <Shelf
          key={shelf.title}
          title={shelf.title}
          category={shelf.category}
          products={shelf.slugs.flatMap((s) => productMap.get(s) ?? [])}
          screenWidth={width}
          nudge={i === 0}
        />
      ))}

      {/* Footer */}
      <View style={{ marginTop: 36, alignItems: 'center' }}>
        <Txt variant="h2" color={colors.subtle}>
          Made with ❤️ in Sikkim
        </Txt>
        <Txt variant="caption" color={colors.subtle}>
          {store.address}
        </Txt>
        <Mountains height={80} />
        {/* Ground continues to the tab bar (and clears the checkout pill when it shows) */}
        <View style={{ alignSelf: 'stretch', height: bottomGap, backgroundColor: colors.sand }} />
      </View>
    </ScrollView>
  );
}
