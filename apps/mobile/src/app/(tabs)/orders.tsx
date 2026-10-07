import { router, useFocusEffect } from 'expo-router';
import { ChevronRight, RotateCcw } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, errorMessage } from '@/api/client';
import { getSocket } from '@/api/socket';
import type { Order, OrderStatus } from '@/api/types';
import { Button } from '@/components/Button';
import { DentilBorder, Mountains } from '@/components/ornaments';
import { Txt } from '@/components/Txt';
import { rupees } from '@/lib/format';
import { useCart } from '@/state/cart';
import { useBottomGap } from '@/lib/layout';
import { STATUS_LABEL } from '@/state/orders';
import { colors, radius } from '@/theme';

const PILL: Record<OrderStatus, { bg: string; fg: string }> = {
  PAYMENT_PENDING: { bg: colors.gold50, fg: colors.wood },
  PLACED: { bg: colors.gold50, fg: colors.wood },
  CONFIRMED: { bg: colors.gold50, fg: colors.wood },
  PACKED: { bg: colors.gold50, fg: colors.wood },
  OUT_FOR_DELIVERY: { bg: colors.turquoise50, fg: colors.turquoise },
  DELIVERED: { bg: colors.leaf50, fg: colors.leaf },
  DELIVERY_FAILED: { bg: colors.vermilion50, fg: colors.vermilion },
  CANCELLED: { bg: colors.vermilion50, fg: colors.vermilion },
};

export default function Orders() {
  const insets = useSafeAreaInsets();
  const add = useCart((s) => s.add);
  const bottomGap = useBottomGap();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setOrders(await api<Order[]>('/orders'));
      setError('');
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  // Reload whenever the tab is opened, and keep statuses live while it's visible
  useFocusEffect(
    useCallback(() => {
      load();
      const socket = getSocket();
      const onUpdate = (o: Order) => setOrders((prev) => (prev ? prev.map((x) => (x.id === o.id ? o : x)) : prev));
      socket.on('order:updated', onUpdate);
      return () => {
        socket.off('order:updated', onUpdate);
      };
    }, [load]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const reorder = (lines: { slug: string; qty: number }[]) => {
    lines.forEach((l) => {
      for (let i = 0; i < l.qty; i++) add(l.slug);
    });
    router.navigate('/jhola');
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ backgroundColor: colors.maroon, paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 12 }}>
        <Txt variant="h1" color={colors.gold}>
          Your orders
        </Txt>
      </View>
      <DentilBorder />
      {orders === null && !error && <ActivityIndicator color={colors.maroon} style={{ marginTop: 32 }} />}
      {!!error && (
        <View style={{ margin: 16, padding: 12, borderRadius: radius.md, backgroundColor: colors.vermilion50, gap: 8 }}>
          <Txt variant="strong" color={colors.vermilion}>
            {error}
          </Txt>
          <Button title="Try again" variant="secondary" onPress={load} />
        </View>
      )}
      {orders && (
      <FlatList
        data={orders}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.maroon} />}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: bottomGap, flexGrow: 1 }}
        ListEmptyComponent={
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Mountains height={90} />
            <Txt variant="h2">No orders yet</Txt>
            <Txt color={colors.muted}>Your first Chito order is a few taps away.</Txt>
            <Button title="Go to bazaar" onPress={() => router.navigate('/')} style={{ alignSelf: 'stretch' }} />
          </View>
        }
        renderItem={({ item: o }) => {
          const track = () => router.push({ pathname: '/order/[id]', params: { id: o.id } });
          return (
            <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 8 }}>
              <Pressable onPress={track} accessibilityRole="link" style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Txt variant="h3">{o.orderNumber}</Txt>
                  <View style={{ backgroundColor: PILL[o.status].bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 2 }}>
                    <Txt variant="micro" color={PILL[o.status].fg}>
                      {STATUS_LABEL[o.status].toUpperCase()}
                    </Txt>
                  </View>
                </View>
                <Txt variant="caption" color={colors.muted} numberOfLines={1}>
                  {o.items.map((l) => `${l.qty} × ${l.name}`).join(', ')}
                </Txt>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Txt variant="caption" color={colors.muted}>
                    {new Date(o.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                  </Txt>
                  <Txt variant="price" color={colors.maroon}>
                    {rupees(o.bill.grandTotal)}
                  </Txt>
                </View>
              </Pressable>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8 }}>
                <Pressable onPress={() => reorder(o.items)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <RotateCcw size={16} color={colors.turquoise} />
                  <Txt variant="strong" color={colors.turquoise}>
                    Reorder
                  </Txt>
                </Pressable>
                <Pressable onPress={track} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Txt variant="strong" color={colors.maroon}>
                    Track
                  </Txt>
                  <ChevronRight size={16} color={colors.maroon} />
                </Pressable>
              </View>
            </View>
          );
        }}
      />
      )}
    </View>
  );
}
