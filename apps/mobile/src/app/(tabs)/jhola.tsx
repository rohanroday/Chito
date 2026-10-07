import { router, useFocusEffect } from 'expo-router';
import { Banknote, Bike, Check, MapPin, Smartphone } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddButton } from '@/components/AddButton';
import { ArchImage } from '@/components/ArchImage';
import { BillCard } from '@/components/BillCard';
import { Button } from '@/components/Button';
import { DentilBorder, Mountains } from '@/components/ornaments';
import { StoreClosedStrip } from '@/components/StoreClosedStrip';
import { Txt } from '@/components/Txt';
import { ApiError, api, errorMessage } from '@/api/client';
import type { Order } from '@/api/types';
import { rupees } from '@/lib/format';
import { paymentReturnUrl } from '@/lib/payment';
import { computeBill, deliveryLine, formatHour } from '@/lib/store-config';
import { addressLine, hasTypedAddress, isForSomeoneElse, useProfile, useSelectedAddress } from '@/state/auth';
import { cartLines, cartTotals, useCart } from '@/state/cart';
import { useCatalogStore, useProductMap, useStoreInfo, useStoreInfoStore } from '@/state/catalog';
import { colors, radius, shadow } from '@/theme';

type Pay = 'COD' | 'ONLINE';

const newKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

export default function Jhola() {
  const insets = useSafeAreaInsets();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const setQty = useCart((s) => s.setQty);
  const address = useSelectedAddress();
  const hasSaved = useProfile((s) => s.addresses.length > 0);
  const store = useStoreInfo();
  const products = useProductMap();
  // Sending groceries to family? Paying online means they pay nothing at the door
  const [pay, setPay] = useState<Pay>(() => (address && isForSomeoneElse(address) ? 'ONLINE' : 'COD'));
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');
  // One key per checkout attempt: a retry after a dropped connection can't create a duplicate order
  const [idemKey, setIdemKey] = useState(newKey);

  // Re-check open/closed, prices and stock every time the jhola is opened
  useFocusEffect(
    useCallback(() => {
      useStoreInfoStore.getState().load();
      useCatalogStore.getState().load();
    }, []),
  );

  const lines = cartLines(items, products);
  const totals = cartTotals(lines);
  const bill = computeBill(store, totals.itemTotal, totals.mrpTotal);
  const open = store.isOpenNow;

  const header = (
    <>
      <View style={{ backgroundColor: colors.maroon, paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 12 }}>
        <Txt variant="h1" color={colors.gold}>
          Your Jhola
        </Txt>
        <Txt variant="caption" color={colors.white} style={{ opacity: 0.85 }}>
          {totals.count ? `${totals.count} ${totals.count === 1 ? 'item' : 'items'}` : 'Nothing here yet'}
        </Txt>
      </View>
      <DentilBorder />
    </>
  );

  if (lines.length === 0) {
    return (
      <View style={{ flex: 1 }}>
        {header}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 }}>
          <View style={{ width: 200, borderTopLeftRadius: 100, borderTopRightRadius: 100, overflow: 'hidden', backgroundColor: colors.gold50, borderWidth: 1.5, borderColor: colors.goldDeep, paddingTop: 40 }}>
            <Mountains height={90} />
          </View>
          <Txt variant="h1" style={{ marginTop: 8 }}>
            Your jhola is empty
          </Txt>
          <Txt color={colors.muted} style={{ textAlign: 'center' }}>
            Fill it with fresh things from Chito.
          </Txt>
          <Button title="Go to bazaar" onPress={() => router.navigate('/')} style={{ marginTop: 8, alignSelf: 'stretch' }} />
        </View>
      </View>
    );
  }

  const hasLocation = !!address?.location;
  // Re-checked against today's radius: an address saved under an old test mode may be far away
  const deliverable = address?.serviceable === true && address.distanceKm <= store.serviceRadiusKm;
  const forOther = !!address && isForSomeoneElse(address);
  const changeAddress = () => router.push(hasSaved ? { pathname: '/addresses', params: { pick: '1' } } : '/address');

  const placeOrder = async () => {
    if (!address?.location) {
      router.push(address ? { pathname: '/address', params: { id: address.id } } : '/address');
      return;
    }
    setPlacing(true);
    setError('');
    try {
      const order = await api<Order>('/orders', {
        method: 'POST',
        headers: { 'Idempotency-Key': idemKey },
        body: {
          items: lines.map((l) => ({ slug: l.slug, qty: l.qty })),
          address: {
            label: address.label,
            house: address.house,
            landmark: address.landmark,
            area: address.area,
            directions: address.directions,
            recipientName: address.recipientName,
            recipientPhone: address.recipientPhone,
            location: address.location,
          },
          paymentMethod: pay,
          // Phones only: the web app has no app link to come back to
          ...(pay === 'ONLINE' && Platform.OS !== 'web' && { returnUrl: paymentReturnUrl() }),
        },
      });
      clear();
      setIdemKey(newKey());
      // Online: the order screen opens Razorpay right away (on web it waits for a tap: pop-ups need one)
      router.push({ pathname: '/order/[id]', params: { id: order.id, fresh: '1', ...(order.status === 'PAYMENT_PENDING' && { pay: '1' }) } });
    } catch (e) {
      setError(errorMessage(e));
      // Prices/stock/hours may have changed — refresh so the jhola shows the truth
      if (e instanceof ApiError && ['OUT_OF_STOCK', 'PRODUCT_UNAVAILABLE', 'MAX_PER_ORDER', 'BELOW_MINIMUM'].includes(e.code)) {
        useCatalogStore.getState().load();
      }
      if (e instanceof ApiError && e.code === 'STORE_CLOSED') useStoreInfoStore.getState().load();
    } finally {
      setPlacing(false);
    }
  };

  const stockIssue = lines.some((l) => l.qty > l.stock);
  const blocked = bill.belowMinimum || !open || (hasLocation && !deliverable) || stockIssue;
  const ctaTitle = stockIssue
    ? 'Fix sold-out items to continue'
    : !hasLocation
      ? hasTypedAddress(address)
      ? 'Add your location pin to order'
      : 'Set delivery location to order'
    : !deliverable
      ? `Outside our ${store.serviceRadiusKm} km area`
      : !open
        ? store.isOpen
          ? `Opens at ${formatHour(store.openTime)}`
          : 'Store is closed right now'
        : bill.belowMinimum
          ? `Add ${rupees(store.minOrderValue - bill.itemTotal)} more to order`
          : pay === 'COD'
            ? `Place order · ${rupees(bill.grandTotal)}`
            : `Pay ${rupees(bill.grandTotal)}`;

  return (
    <View style={{ flex: 1 }}>
      {header}
      <StoreClosedStrip />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 110 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.turquoise50, borderRadius: radius.md, padding: 12 }}>
          <Bike size={22} color={colors.turquoise} />
          <Txt variant="h3" color={colors.turquoise}>
            {deliveryLine(store, address?.distanceKm ?? 0)}
          </Txt>
        </View>

        <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 12, gap: 12 }}>
          {lines.map((l) => (
            <View key={l.slug} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <ArchImage path={l.image} size={60} />
              <View style={{ flex: 1 }}>
                <Txt variant="strong" numberOfLines={2}>
                  {l.name}
                </Txt>
                <Txt variant="caption" color={colors.muted}>
                  {l.unit}
                </Txt>
                <Txt variant="price" color={colors.maroon}>
                  {rupees(l.price * l.qty)}
                </Txt>
                {l.qty > l.stock && (
                  <Txt variant="caption" color={colors.vermilion}>
                    {l.stock === 0 ? 'Sold out' : `Only ${l.stock} left`}
                  </Txt>
                )}
              </View>
              {l.qty > l.stock ? (
                <Pressable onPress={() => setQty(l.slug, l.stock)} hitSlop={8} accessibilityRole="button" style={{ paddingHorizontal: 12, height: 34, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.vermilion, justifyContent: 'center' }}>
                  <Txt variant="button" color={colors.vermilion}>
                    {l.stock === 0 ? 'Remove' : `Keep ${l.stock}`}
                  </Txt>
                </Pressable>
              ) : (
                <AddButton slug={l.slug} />
              )}
            </View>
          ))}
        </View>

        {bill.toFreeDelivery > 0 && (
          <View style={{ backgroundColor: colors.gold50, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: colors.goldDeep }}>
            <Txt variant="strong" color={colors.wood}>
              Add {rupees(bill.toFreeDelivery)} more for FREE delivery
            </Txt>
            <View style={{ height: 6, backgroundColor: colors.sand, borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
              <View style={{ height: 6, width: `${Math.min(100, (bill.itemTotal / store.freeDeliveryAbove) * 100)}%`, backgroundColor: colors.leaf }} />
            </View>
          </View>
        )}

        <BillCard bill={bill} />

        <Pressable
          onPress={changeAddress}
          accessibilityRole="button"
          accessibilityLabel="Change delivery address"
          style={{
            backgroundColor: hasLocation && deliverable ? colors.card : colors.vermilion50,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: hasLocation && deliverable ? colors.line : colors.vermilion,
            padding: 14,
            flexDirection: 'row',
            gap: 10,
            alignItems: 'center',
          }}>
          <MapPin size={22} color={hasLocation && deliverable ? colors.maroon : colors.vermilion} />
          <View style={{ flex: 1 }}>
            {forOther && (
              <Txt variant="strong" color={colors.turquoise}>
                For {address.recipientName} · {address.recipientPhone}
              </Txt>
            )}
            {address?.location ? (
              <>
                <Txt variant="strong">Delivering to {address.label}</Txt>
                <Txt variant="caption" color={deliverable ? colors.muted : colors.vermilion}>
                  {address.landmark} · {address.distanceKm} km from store
                  {!deliverable ? ` · outside our ${store.serviceRadiusKm} km area` : ''}
                </Txt>
              </>
            ) : hasTypedAddress(address) ? (
              // Address is saved; only the GPS pin (needed for the 3 km check) is missing
              <>
                <Txt variant="strong">Delivering to {address.label}</Txt>
                <Txt variant="caption" color={colors.muted} numberOfLines={2}>
                  {addressLine(address)}
                </Txt>
                <Txt variant="caption" color={colors.vermilion}>
                  Location pin missing. Tap to add it (map, shared link or GPS)
                </Txt>
              </>
            ) : (
              <>
                <Txt variant="strong">Where should we deliver?</Txt>
                <Txt variant="caption" color={colors.vermilion}>
                  Set your location and a landmark so our rider can find you
                </Txt>
              </>
            )}
          </View>
          <Txt variant="strong" color={colors.turquoise}>
            {hasSaved ? 'Change' : 'Set'}
          </Txt>
        </Pressable>

        <Txt variant="h2">Pay with</Txt>
        {(
          [
            {
              id: 'COD',
              title: 'Cash on delivery',
              sub: forOther ? `${address.recipientName} pays the rider in cash or UPI at the door` : 'Pay the rider in cash or UPI at your door',
              Icon: Banknote,
              enabled: true,
            },
            {
              id: 'ONLINE',
              title: 'Pay now · UPI / Card',
              sub: forOther ? `Nothing to pay at the door for ${address.recipientName}` : 'Google Pay, PhonePe, cards, net banking · Razorpay',
              Icon: Smartphone,
              enabled: true,
            },
          ] as const
        ).map(({ id, title, sub, Icon, enabled }) => {
          const on = pay === id;
          return (
            <Pressable
              key={id}
              disabled={!enabled}
              onPress={() => setPay(id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on, disabled: !enabled }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 14,
                borderRadius: radius.lg,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                borderWidth: on ? 2 : 1,
                borderColor: on ? colors.maroon : colors.line,
                backgroundColor: colors.card,
                opacity: enabled ? 1 : 0.55,
              }}>
              <Icon size={24} color={colors.maroon} />
              <View style={{ flex: 1 }}>
                <Txt variant="strong">{title}</Txt>
                <Txt variant="caption" color={colors.muted}>
                  {sub}
                </Txt>
              </View>
              {on && (
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={16} color={colors.maroon} strokeWidth={3} />
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, backgroundColor: colors.parchment, borderTopWidth: 1, borderTopColor: colors.line, ...shadow }}>
        {!!error && (
          <Txt variant="strong" color={colors.vermilion} style={{ marginBottom: 8, textAlign: 'center' }}>
            {error}
          </Txt>
        )}
        <Button title={ctaTitle} onPress={placeOrder} disabled={blocked} loading={placing} variant={pay === 'COD' ? 'primary' : 'gold'} />
      </View>
    </View>
  );
}
