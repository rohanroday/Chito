import { router, useLocalSearchParams } from 'expo-router';
import { CheckCircle2, ChevronLeft, MapPin, Navigation, Phone, TriangleAlert } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, ApiError, errorMessage } from '@/api/client';
import type { RiderOrder } from '@/api/types';
import { Button } from '@/components/Button';
import { DentilBorder } from '@/components/ornaments';
import { Txt } from '@/components/Txt';
import { distance, rupees, timeOfDay } from '@/lib/format';
import { useDeliveries } from '@/state/deliveries';
import { colors, fonts, radius } from '@/theme';

const REASONS = ['Nobody at home', 'Phone not answered', 'Wrong address / can’t find it', 'Customer refused', 'Road blocked'];

const card = { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 6 } as const;

function mapsUrl(o: RiderOrder) {
  const loc = o.address.location;
  if (loc) return `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([o.address.landmark, o.address.area, 'Singtam'].join(', '))}`;
}

const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

export default function DeliveryDetail() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const o = useDeliveries((s) => s.orders.find((x) => x.id === id));
  const upsert = useDeliveries((s) => s.upsert);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [failing, setFailing] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const scroll = useRef<ScrollView>(null);
  const codeInput = useRef<TextInput>(null);

  if (!o) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
        <Txt variant="h2">Order not found</Txt>
        <Txt color={colors.muted} style={{ textAlign: 'center' }}>
          It may have been cancelled or given to another rider.
        </Txt>
        <Button title="Back" onPress={close} />
      </View>
    );
  }

  const receiver = o.address.recipientName || o.customer?.name || 'Customer';
  const receiverPhone = o.address.recipientPhone || o.customer?.phone;
  const active = o.status === 'OUT_FOR_DELIVERY';
  const deliveredAt = [...o.statusHistory].reverse().find((h) => h.status === 'DELIVERED')?.at;

  const deliver = async () => {
    setBusy(true);
    setError('');
    try {
      upsert(await api<RiderOrder>(`/rider/orders/${o.id}/deliver`, { method: 'POST', body: { code } }));
      setCode('');
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'WRONG_CODE' ? 'Wrong code. Ask the customer to check the code in their Chito app.' : errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const fail = async () => {
    const why = reason === 'Other' ? note.trim() : [reason, note.trim()].filter(Boolean).join(' · ');
    setBusy(true);
    setError('');
    try {
      upsert(await api<RiderOrder>(`/rider/orders/${o.id}/fail`, { method: 'POST', body: { reason: why } }));
      setFailing(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ backgroundColor: colors.maroon, paddingTop: insets.top + 6, paddingHorizontal: 12, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Pressable onPress={close} hitSlop={12} accessibilityLabel="Back" style={{ padding: 4 }}>
          <ChevronLeft size={26} color={colors.gold} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Txt variant="h2" color={colors.gold}>
            {o.orderNumber}
          </Txt>
          <Txt variant="caption" color={colors.white} style={{ opacity: 0.85 }}>
            {distance(o.distanceKm)} from the store
          </Txt>
        </View>
      </View>
      <DentilBorder />

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        {o.status === 'DELIVERED' && (
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: colors.leaf50, borderRadius: radius.md, padding: 14 }}>
            <CheckCircle2 size={22} color={colors.leaf} />
            <Txt variant="h3" color={colors.leaf}>
              Delivered{deliveredAt ? ` at ${timeOfDay(new Date(deliveredAt))}` : ''}. Thank you!
            </Txt>
          </View>
        )}
        {o.status === 'DELIVERY_FAILED' && (
          <View style={{ gap: 4, backgroundColor: colors.vermilion50, borderRadius: radius.md, padding: 14 }}>
            <Txt variant="h3" color={colors.vermilion}>
              Couldn’t deliver
            </Txt>
            <Txt color={colors.vermilion}>{o.failReason}</Txt>
            <Txt variant="caption" color={colors.muted}>
              Bring it back to the store. The store will re-assign or cancel it.
            </Txt>
          </View>
        )}

        {/* Who receives it */}
        <View style={card}>
          <Txt variant="caption" color={colors.muted}>
            DELIVER TO
          </Txt>
          <Txt variant="h2">{receiver}</Txt>
          {!!o.address.recipientName && (
            <Txt variant="caption" color={colors.muted}>
              Ordered by {o.customer?.name || 'a customer'} for them. Call {o.address.recipientName}.
            </Txt>
          )}
          {!!receiverPhone && (
            <Pressable
              onPress={() => Linking.openURL(`tel:${receiverPhone}`)}
              accessibilityRole="button"
              accessibilityLabel={`Call ${receiver}`}
              style={{ flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: radius.md, backgroundColor: colors.turquoise, marginTop: 4 }}>
              <Phone size={20} color={colors.white} />
              <Txt variant="h3" color={colors.white}>
                Call {receiverPhone}
              </Txt>
            </Pressable>
          )}
        </View>

        {/* Where */}
        <View style={card}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <MapPin size={18} color={colors.maroon} />
            <Txt variant="h3">{o.address.label || 'Address'}</Txt>
          </View>
          {!!o.address.house && <Txt>{o.address.house}</Txt>}
          <Txt variant="strong">{o.address.landmark}</Txt>
          <Txt color={colors.muted}>{o.address.area}</Txt>
          {!!o.address.directions && <Txt color={colors.wood}>🧭 {o.address.directions}</Txt>}
          {!!o.instructions && <Txt color={colors.wood}>📝 {o.instructions}</Txt>}
          <Pressable
            onPress={() => Linking.openURL(mapsUrl(o))}
            accessibilityRole="button"
            style={{ flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.turquoise, marginTop: 4 }}>
            <Navigation size={18} color={colors.turquoise} />
            <Txt variant="strong" color={colors.turquoise}>
              {o.address.location ? 'Open in Google Maps' : 'Search the landmark in Maps'}
            </Txt>
          </Pressable>
        </View>

        {/* What + money */}
        <View style={card}>
          <Txt variant="h3">Items ({o.items.reduce((s, i) => s + i.qty, 0)})</Txt>
          {o.items.map((i) => (
            <Txt key={i.slug}>
              {i.qty} × {i.name} <Txt color={colors.muted}>({i.unit})</Txt>
            </Txt>
          ))}
        </View>
        <View style={[card, { backgroundColor: o.collect ? colors.gold50 : colors.leaf50, borderColor: o.collect ? colors.goldDeep : colors.leaf }]}>
          <Txt variant="h2" color={o.collect ? colors.wood : colors.leaf}>
            {o.status === 'DELIVERY_FAILED'
              ? 'Nothing collected · bring the items back'
              : o.collect
                ? `Collect ${rupees(o.collect)} cash`
                : o.paymentMethod === 'COD'
                  ? `Collected ${rupees(o.bill.grandTotal)} cash`
                  : 'Paid online · collect nothing'}
          </Txt>
          {!!o.collect && active && (
            <Txt variant="caption" color={colors.wood}>
              Cash or UPI to you at the door. Hand it to the store later.
            </Txt>
          )}
        </View>

        {active && !failing && (
          <View style={[card, { borderColor: colors.maroon, borderWidth: 2 }]}>
            <Txt variant="h3">Delivered? Enter the customer’s code</Txt>
            <Txt variant="caption" color={colors.muted}>
              The customer sees a 4-digit code in their Chito app{o.address.recipientName ? ` (${o.address.recipientName} gets it from them)` : ''}.
            </Txt>
            <TextInput
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              placeholder="• • • •"
              placeholderTextColor={colors.subtle}
              ref={codeInput}
              accessibilityLabel="Delivery code"
              style={{
                height: 64,
                borderWidth: 2,
                borderColor: colors.line,
                borderRadius: radius.md,
                backgroundColor: colors.white,
                textAlign: 'center',
                letterSpacing: 18,
                fontFamily: fonts.bold,
                fontSize: 30,
                color: colors.ink,
              }}
            />
            <Button title="Mark delivered" onPress={deliver} disabled={code.length !== 4} loading={busy} />
            <Button title="Couldn’t deliver" variant="danger" onPress={() => setFailing(true)} />
          </View>
        )}

        {active && failing && (
          <View style={[card, { borderColor: colors.vermilion, borderWidth: 2 }]}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TriangleAlert size={18} color={colors.vermilion} />
              <Txt variant="h3" color={colors.vermilion}>
                Why couldn’t you deliver?
              </Txt>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[...REASONS, 'Other'].map((r) => {
                const on = r === reason;
                return (
                  <Pressable
                    key={r}
                    onPress={() => setReason(r)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    style={{ paddingHorizontal: 12, height: 38, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1.5, borderColor: on ? colors.vermilion : colors.line, backgroundColor: on ? colors.vermilion50 : colors.card }}>
                    <Txt variant="strong" color={on ? colors.vermilion : colors.ink}>
                      {r}
                    </Txt>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={reason === 'Other' ? 'What happened?' : 'Add a note (optional)'}
              placeholderTextColor={colors.subtle}
              accessibilityLabel="Note"
              multiline
              style={{ minHeight: 64, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.white, padding: 10, fontFamily: fonts.medium, fontSize: 16, color: colors.ink, textAlignVertical: 'top' }}
            />
            <Button title="Report to the store" variant="danger" onPress={fail} disabled={!reason || (reason === 'Other' && note.trim().length < 2)} loading={busy} />
            <Button title="Back" variant="ghost" onPress={() => setFailing(false)} />
          </View>
        )}

        {!!error && (
          <Txt variant="strong" color={colors.vermilion} style={{ textAlign: 'center' }}>
            {error}
          </Txt>
        )}
      </ScrollView>

      {/* At the door: one tap to the code box, wherever the rider has scrolled */}
      {active && !failing && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: insets.bottom + 10,
            backgroundColor: colors.card,
            borderTopWidth: 1,
            borderTopColor: colors.line,
          }}>
          <View style={{ flex: 1 }}>
            <Txt variant="caption" color={colors.muted}>
              {o.collect ? 'Collect at the door' : 'Paid online'}
            </Txt>
            <Txt variant="h2" color={o.collect ? colors.maroon : colors.leaf}>
              {o.collect ? rupees(o.collect) : 'Nothing to collect'}
            </Txt>
          </View>
          <Button
            title="Enter code"
            onPress={() => {
              // Jump (not animate): focusing mid-animation stops the scroll halfway
              scroll.current?.scrollToEnd({ animated: false });
              setTimeout(() => codeInput.current?.focus(), 50);
            }}
            style={{ paddingHorizontal: 22 }}
          />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
