import { router } from 'expo-router';
import { Bike, ChevronRight, LogOut, MapPin, Navigation, Phone, TriangleAlert, Wallet } from 'lucide-react-native';
import { Linking, Platform, Pressable, RefreshControl, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, errorMessage } from '@/api/client';
import { endServerSession } from '@/api/session';
import type { RiderOrder } from '@/api/types';
import { Button } from '@/components/Button';
import { DentilBorder } from '@/components/ornaments';
import { Txt } from '@/components/Txt';
import { distance, rupees, timeOfDay } from '@/lib/format';
import { useLocationShare } from '@/lib/location-share';
import { useAuth } from '@/state/auth';
import { activeOrders, useDeliveries } from '@/state/deliveries';
import { colors, radius } from '@/theme';

const SUPPORT = process.env.EXPO_PUBLIC_SUPPORT_PHONE ?? '';

function OrderRow({ o }: { o: RiderOrder }) {
  const who = o.address.recipientName || o.customer?.name || 'Customer';
  const active = o.status === 'OUT_FOR_DELIVERY';
  const failed = o.status === 'DELIVERY_FAILED';
  const items = o.items.reduce((s, i) => s + i.qty, 0);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/order/[id]', params: { id: o.id } })}
      accessibilityRole="button"
      accessibilityLabel={`Order ${o.orderNumber} for ${who}`}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.sand : colors.card,
        borderRadius: radius.lg,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderWidth: active ? 2 : 1,
        borderColor: active ? colors.maroon : failed ? colors.vermilion : colors.line,
        padding: 14,
        gap: 6,
      })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Txt variant="caption" color={colors.muted}>
          {o.orderNumber} · {items} {items === 1 ? 'item' : 'items'}
        </Txt>
        {active ? (
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 2,
              borderRadius: radius.pill,
              backgroundColor: o.collect ? colors.gold50 : colors.leaf50,
              borderWidth: 1,
              borderColor: o.collect ? colors.goldDeep : colors.leaf,
            }}>
            <Txt variant="strong" color={o.collect ? colors.wood : colors.leaf}>
              {o.collect ? `Collect ${rupees(o.collect)}` : 'Paid online'}
            </Txt>
          </View>
        ) : (
          <Txt variant="strong" color={failed ? colors.vermilion : colors.leaf}>
            {failed ? 'Couldn’t deliver' : 'Delivered'}
          </Txt>
        )}
      </View>
      <Txt variant="h3">{o.address.recipientName ? `For ${o.address.recipientName}` : who}</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <MapPin size={15} color={colors.maroon} />
        <Txt color={colors.wood} numberOfLines={1} style={{ flex: 1 }}>
          {[o.address.landmark, o.address.area].filter(Boolean).join(', ')}
        </Txt>
        <Txt variant="caption" color={colors.muted}>
          {distance(o.distanceKm)}
        </Txt>
        <ChevronRight size={18} color={colors.subtle} />
      </View>
      {failed && !!o.failReason && (
        <Txt variant="caption" color={colors.vermilion}>
          {o.failReason}
        </Txt>
      )}
    </Pressable>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Txt variant="h3">{value}</Txt>
      <Txt variant="caption" color={colors.muted}>
        {label}
      </Txt>
    </View>
  );
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const rider = useAuth((s) => s.rider);
  const { me, orders, loading, error, load, setStatus } = useDeliveries();
  const share = useLocationShare((s) => s.state);
  const active = activeOrders(orders);
  const failed = orders.filter((o) => o.status === 'DELIVERY_FAILED');
  const done = orders.filter((o) => o.status === 'DELIVERED');
  const onDelivery = me?.status === 'ON_DELIVERY';
  const onDuty = me?.status !== 'OFF_DUTY';
  const name = me?.name ?? rider?.name ?? 'Rider';
  const sharingOk = share === 'on' || share === 'starting';

  const toggleDuty = async (on: boolean) => {
    const next = on ? 'AVAILABLE' : 'OFF_DUTY';
    setStatus(next);
    try {
      await api('/rider/me/status', { method: 'PATCH', body: { status: next } });
    } catch (e) {
      setStatus(on ? 'OFF_DUTY' : 'AVAILABLE');
      useDeliveries.setState({ error: errorMessage(e) });
    }
  };

  const logout = () => {
    endServerSession(); // reads the token, so it runs first
    useAuth.getState().logout();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.parchment }}>
      {/* Header: who + duty switch */}
      <View style={{ backgroundColor: colors.maroon, paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 16, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' }}>
            <Txt variant="h2" color={colors.maroon}>
              {name.trim().charAt(0).toUpperCase() || 'R'}
            </Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="caption" color={colors.white} style={{ opacity: 0.85 }}>
              Tashi Delek 🙏
            </Txt>
            <Txt variant="h2" color={colors.gold} numberOfLines={1}>
              {name}
            </Txt>
          </View>
          <Pressable onPress={logout} accessibilityRole="button" accessibilityLabel="Log out" hitSlop={10} style={{ padding: 9, borderRadius: 20, backgroundColor: colors.maroon700 }}>
            <LogOut size={20} color={colors.gold} />
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.maroon700, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 14 }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: onDelivery ? colors.gold : onDuty ? colors.leaf : colors.subtle }} />
          <View style={{ flex: 1 }}>
            <Txt variant="h3" color={colors.white}>
              {onDelivery ? 'On a delivery' : onDuty ? 'On duty' : 'Off duty'}
            </Txt>
            <Txt variant="caption" color={colors.white} style={{ opacity: 0.8 }}>
              {onDelivery ? 'Finish your deliveries to go off duty' : onDuty ? 'Waiting at the store for orders' : 'You won’t get new orders'}
            </Txt>
          </View>
          <Switch
            value={onDuty}
            onValueChange={toggleDuty}
            disabled={!me || onDelivery}
            accessibilityLabel="On duty"
            trackColor={{ false: colors.subtle, true: colors.leaf }}
            thumbColor={colors.white}
          />
        </View>
      </View>
      <DentilBorder />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 32 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
        {active.length > 0 && share !== 'off' && (
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: radius.md, backgroundColor: sharingOk ? colors.turquoise50 : colors.vermilion50 }}>
            {sharingOk ? <Navigation size={18} color={colors.turquoise} /> : <TriangleAlert size={18} color={colors.vermilion} />}
            <Txt variant="strong" color={sharingOk ? colors.turquoise : colors.vermilion} style={{ flex: 1 }}>
              {sharingOk
                ? 'Sharing your location while delivering. Keep Chito Rider open.'
                : share === 'denied'
                  ? 'Allow location so the store and customer can see you coming.'
                  : share === 'gps-off'
                    ? 'Turn on your phone’s location (GPS).'
                    : 'Location isn’t working right now.'}
            </Txt>
            {share === 'denied' && Platform.OS !== 'web' && (
              <Pressable onPress={() => Linking.openSettings()} accessibilityRole="link">
                <Txt variant="strong" color={colors.turquoise}>
                  Settings
                </Txt>
              </Pressable>
            )}
          </View>
        )}

        {/* Cash: the number riders care about most */}
        <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: colors.gold50 }}>
            <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' }}>
              <Wallet size={22} color={colors.maroon} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="caption" color={colors.wood}>
                Cash to hand in at the store
              </Txt>
              <Txt variant="h1" color={colors.maroon}>
                {rupees(me?.codBalance ?? 0)}
              </Txt>
            </View>
          </View>
          <View style={{ flexDirection: 'row', padding: 14, gap: 12, borderTopWidth: 1, borderTopColor: colors.line }}>
            <MiniStat label="Delivered today" value={String(me?.today.delivered ?? 0)} />
            <View style={{ width: 1, backgroundColor: colors.line }} />
            <MiniStat label="Cash collected today" value={rupees(me?.today.cashCollected ?? 0)} />
          </View>
        </View>

        {!!error && (
          <Txt variant="strong" color={colors.vermilion}>
            {error}
          </Txt>
        )}

        <Txt variant="h2">Your deliveries{active.length ? ` (${active.length})` : ''}</Txt>
        {active.length === 0 ? (
          <View
            style={{
              alignItems: 'center',
              paddingVertical: 24,
              paddingHorizontal: 20,
              gap: 8,
              borderRadius: radius.lg,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: colors.line,
              backgroundColor: colors.card,
            }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: onDuty ? colors.turquoise50 : colors.sand, alignItems: 'center', justifyContent: 'center' }}>
              <Bike size={28} color={onDuty ? colors.turquoise : colors.muted} />
            </View>
            <Txt variant="h3">{onDuty ? 'Nothing to deliver right now' : 'You’re off duty'}</Txt>
            <Txt color={colors.muted} style={{ textAlign: 'center' }}>
              {onDuty ? 'When the store hands you an order, it appears here and your phone buzzes.' : 'Go on duty when you reach the store.'}
            </Txt>
            {!onDuty && !!me && <Button title="Go on duty" onPress={() => toggleDuty(true)} style={{ alignSelf: 'stretch', marginTop: 6 }} />}
          </View>
        ) : (
          active.map((o) => <OrderRow key={o.id} o={o} />)
        )}

        {failed.length > 0 && (
          <>
            <Txt variant="h3" color={colors.vermilion} style={{ marginTop: 6 }}>
              Couldn’t deliver · bring back to the store
            </Txt>
            {failed.map((o) => (
              <OrderRow key={o.id} o={o} />
            ))}
          </>
        )}

        {done.length > 0 && (
          <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 14, marginTop: 6 }}>
            <Txt variant="h3" style={{ marginBottom: 4 }}>
              Delivered today
            </Txt>
            {done.map((o, i) => {
              const at = [...o.statusHistory].reverse().find((h) => h.status === 'DELIVERED')?.at;
              return (
                <Pressable
                  key={o.id}
                  onPress={() => router.push({ pathname: '/order/[id]', params: { id: o.id } })}
                  accessibilityRole="button"
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
                  <View style={{ flex: 1 }}>
                    <Txt variant="strong" numberOfLines={1}>
                      {o.address.recipientName || o.customer?.name || o.orderNumber}
                    </Txt>
                    <Txt variant="caption" color={colors.muted}>
                      {o.orderNumber}
                      {at ? ` · ${timeOfDay(new Date(at))}` : ''}
                    </Txt>
                  </View>
                  <Txt variant="strong" color={o.paymentMethod === 'COD' ? colors.wood : colors.leaf}>
                    {o.paymentMethod === 'COD' ? `${rupees(o.bill.grandTotal)} cash` : 'Paid online'}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
        )}

        {!!SUPPORT && (
          <Pressable
            onPress={() => Linking.openURL(`tel:${SUPPORT}`)}
            accessibilityRole="button"
            style={{ flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', height: 50, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.turquoise, marginTop: 8 }}>
            <Phone size={18} color={colors.turquoise} />
            <Txt variant="strong" color={colors.turquoise}>
              Call the store
            </Txt>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}
