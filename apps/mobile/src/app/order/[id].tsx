import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Phone, Smartphone } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, errorMessage } from '@/api/client';
import { getSocket } from '@/api/socket';
import type { Order } from '@/api/types';
import { Button } from '@/components/Button';
import { MountainPath } from '@/components/MountainPath';
import { DentilBorder, PrayerFlags } from '@/components/ornaments';
import { Txt } from '@/components/Txt';
import { rupees } from '@/lib/format';
import { openPayment, refreshPayment } from '@/lib/payment';
import { callSupport } from '@/lib/support';
import { customerCanCancel, isActive, STATUS_LABEL } from '@/state/orders';
import { colors, radius } from '@/theme';

const POLL_MS = 20000; // fallback when the live socket drops on a weak hill network
const PAYMENT_POLL_MS = 6000; // while waiting for Razorpay

const PAYMENT_NOTE: Record<Order['paymentStatus'], string> = {
  PENDING: 'Online · not paid yet',
  PAID: 'Paid online',
  REFUNDED: 'Refunded to your account',
  REFUND_FAILED: 'Refund in progress, we will call you',
};

export default function OrderTracking() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { id, fresh, pay: payNow } = useLocalSearchParams<{ id: string; fresh?: string; pay?: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [celebrate, setCelebrate] = useState(fresh === '1');
  const [paying, setPaying] = useState(false);
  const lastStatus = useRef<Order['status'] | null>(null);
  const autoPaid = useRef(false);

  // Every update goes through here so "payment received" can be celebrated the moment it lands
  const receive = useCallback((o: Order) => {
    if (lastStatus.current === 'PAYMENT_PENDING' && o.status === 'PLACED') setCelebrate(true);
    lastStatus.current = o.status;
    setOrder(o);
  }, []);

  const pending = order?.status === 'PAYMENT_PENDING';
  const load = useCallback(async () => {
    try {
      receive(await (pending ? refreshPayment(id) : api<Order>(`/orders/${id}`)));
      setError('');
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [id, pending, receive]);

  const active = !!order && isActive(order.status);

  useEffect(() => {
    let alive = true;
    api<Order>(`/orders/${id}`)
      .then(async (o) => {
        if (!alive) return;
        receive(o);
        // Straight from the Jhola: open Razorpay once (the phone's browser closes itself after paying)
        if (payNow === '1' && o.status === 'PAYMENT_PENDING' && Platform.OS !== 'web' && !autoPaid.current) {
          autoPaid.current = true;
          setPaying(true);
          const after = await openPayment(o);
          if (alive) {
            receive(after);
            setPaying(false);
          }
        }
      })
      .catch((e) => alive && setError(errorMessage(e)));
    return () => {
      alive = false;
    };
  }, [id, payNow, receive]);

  // Live updates from the store + polling fallback while the order is moving
  useEffect(() => {
    const socket = getSocket();
    const onUpdate = (o: Order) => o.id === id && receive(o);
    socket.on('order:updated', onUpdate);
    return () => {
      socket.off('order:updated', onUpdate);
    };
  }, [id, receive]);

  useEffect(() => {
    if (!active) return;
    const poll = setInterval(load, pending ? PAYMENT_POLL_MS : POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 15000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [active, pending, load]);

  useEffect(() => {
    if (!celebrate) return;
    const t = setTimeout(() => setCelebrate(false), 2200);
    return () => clearTimeout(t);
  }, [celebrate]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/orders'));

  if (!order) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
        {error ? (
          <>
            <Txt variant="strong" color={colors.vermilion} style={{ textAlign: 'center' }}>
              {error}
            </Txt>
            <Button title="Try again" onPress={load} style={{ alignSelf: 'stretch' }} />
            <Button title="Back" variant="ghost" onPress={close} />
          </>
        ) : (
          <ActivityIndicator color={colors.maroon} />
        )}
      </View>
    );
  }

  const minsLeft = Math.max(1, Math.ceil((new Date(order.createdAt).getTime() + order.etaMin * 60000 - now) / 60000));
  const pathW = Math.min(width - 32, 380);

  const pay = async () => {
    setPaying(true);
    setError('');
    try {
      receive(await openPayment(order));
    } finally {
      setPaying(false);
    }
  };

  const cancel = async () => {
    setCancelling(true);
    try {
      receive(await api<Order>(`/orders/${order.id}/cancel`, { method: 'POST' }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ backgroundColor: colors.maroon, paddingTop: insets.top + 6, paddingHorizontal: 12, paddingBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={close} hitSlop={12} accessibilityLabel="Back" style={{ padding: 4 }}>
            <ChevronLeft size={26} color={colors.gold} />
          </Pressable>
          <Txt variant="strong" color={colors.white} style={{ marginLeft: 4, opacity: 0.85 }}>
            Order {order.orderNumber}
          </Txt>
        </View>
        <View style={{ paddingHorizontal: 8, marginTop: 6 }}>
          {order.status === 'DELIVERED' ? (
            <Txt variant="display" color={colors.gold}>
              Delivered! 🙏
            </Txt>
          ) : order.status === 'CANCELLED' ? (
            <Txt variant="display" color={colors.gold}>
              Order cancelled
            </Txt>
          ) : pending ? (
            <Txt variant="display" color={colors.gold}>
              Waiting for payment
            </Txt>
          ) : (
            <>
              <Txt variant="strong" color={colors.white}>
                Arriving in
              </Txt>
              <Txt variant="display" color={colors.gold}>
                {minsLeft} mins
              </Txt>
            </>
          )}
          <Txt variant="caption" color={colors.white} style={{ opacity: 0.85 }}>
            {STATUS_LABEL[order.status]}
            {order.cancelReason ? ` · ${order.cancelReason}` : ''}
          </Txt>
        </View>
      </View>
      <DentilBorder />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 32 }}>
        {pending && order.payment && (
          <View style={{ gap: 10, backgroundColor: colors.gold50, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.goldDeep, padding: 14 }}>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Smartphone size={22} color={colors.maroon} />
              <Txt variant="h3" style={{ flex: 1 }}>
                Pay {rupees(order.bill.grandTotal)} to send this order to the store
              </Txt>
            </View>
            <Txt variant="caption" color={colors.wood}>
              UPI, cards or net banking on Razorpay&apos;s secure page. Your items are kept aside until{' '}
              {new Date(order.payment.expiresAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })}.
            </Txt>
            <Button title={`Pay ${rupees(order.bill.grandTotal)} now`} variant="gold" onPress={pay} loading={paying} />
            <Button title="I’ve paid · check again" variant="ghost" onPress={load} />
          </View>
        )}

        {order.status !== 'CANCELLED' && !pending && (
          <View style={{ alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, paddingVertical: 12, overflow: 'hidden' }}>
            <MountainPath order={order} width={pathW} />
          </View>
        )}

        {order.status === 'DELIVERY_FAILED' && (
          <View style={{ backgroundColor: colors.vermilion50, borderRadius: radius.md, padding: 12 }}>
            <Txt variant="strong" color={colors.vermilion}>
              Our rider couldn&apos;t reach you. The store will call you, or tap below to call us.
            </Txt>
          </View>
        )}

        {order.rider && order.status !== 'CANCELLED' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 14 }}>
            <View style={{ width: 48, height: 52, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, backgroundColor: colors.maroon50, borderWidth: 1.5, borderColor: colors.goldDeep, alignItems: 'center', justifyContent: 'center' }}>
              <Txt variant="h2" color={colors.maroon}>
                {order.rider.name[0]}
              </Txt>
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="h3">{order.status === 'DELIVERED' ? `Delivered by ${order.rider.name}` : `${order.rider.name} is on the way 🛵`}</Txt>
              <Txt variant="caption" color={colors.muted}>
                Your Chito rider
              </Txt>
            </View>
            {order.status !== 'DELIVERED' && (
              <Pressable
                onPress={() => Linking.openURL(`tel:${order.rider!.phone}`)}
                accessibilityLabel={`Call ${order.rider.name}`}
                style={{ flexDirection: 'row', gap: 6, alignItems: 'center', borderWidth: 1.5, borderColor: colors.turquoise, borderRadius: radius.pill, paddingHorizontal: 14, height: 40 }}>
                <Phone size={16} color={colors.turquoise} />
                <Txt variant="button" color={colors.turquoise}>
                  Call
                </Txt>
              </Pressable>
            )}
          </View>
        )}

        <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 6 }}>
          <Txt variant="h2">Your items</Txt>
          {order.items.map((l) => (
            <View key={l.slug} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt style={{ flex: 1 }} numberOfLines={1}>
                {l.qty} × {l.name}
              </Txt>
              <Txt variant="strong">{rupees(l.price * l.qty)}</Txt>
            </View>
          ))}
          <View style={{ borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.line, marginVertical: 4 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Txt variant="h3">Total ({order.paymentMethod === 'COD' ? 'Cash on delivery' : PAYMENT_NOTE[order.paymentStatus]})</Txt>
            <Txt variant="h3" color={colors.maroon}>
              {rupees(order.bill.grandTotal)}
            </Txt>
          </View>
          {!!order.address.recipientName && (
            <Txt variant="caption" color={colors.turquoise}>
              For {order.address.recipientName} · {order.address.recipientPhone} (our rider will call them)
            </Txt>
          )}
          <Txt variant="caption" color={colors.muted}>
            To: {[order.address.house, order.address.landmark, order.address.area].filter(Boolean).join(', ')}
          </Txt>
        </View>

        {!!error && (
          <Txt variant="strong" color={colors.vermilion} style={{ textAlign: 'center' }}>
            {error}
          </Txt>
        )}
        {customerCanCancel(order.status) && <Button title="Cancel order" variant="danger" onPress={cancel} loading={cancelling} />}
        <Button title="Need help? Call Chito" variant="ghost" onPress={callSupport} />
      </ScrollView>

      {celebrate && !pending && (
        <Animated.View entering={FadeInDown.duration(300)} style={[StyleSheet.absoluteFill, { backgroundColor: colors.maroon, alignItems: 'center', justifyContent: 'center', gap: 10 }]}>
          <View style={{ position: 'absolute', top: insets.top, left: 0, right: 0 }}>
            <PrayerFlags height={36} />
          </View>
          <Animated.View entering={ZoomIn.delay(200).springify()}>
            <Txt variant="display" color={colors.gold}>
              {order.paymentStatus === 'PAID' ? 'Payment received! 🎉' : 'Order placed! 🎉'}
            </Txt>
          </Animated.View>
          <Txt variant="h3" color={colors.white}>
            Arriving in about {order.etaMin} mins
          </Txt>
        </Animated.View>
      )}
    </View>
  );
}
