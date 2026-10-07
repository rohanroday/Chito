import { router, useLocalSearchParams } from 'expo-router';
import { Check, ChevronLeft, HeartHandshake, MapPin, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { DentilBorder } from '@/components/ornaments';
import { Txt } from '@/components/Txt';
import { type Address, addressLine, isForSomeoneElse, useProfile } from '@/state/auth';
import { useStoreInfo } from '@/state/catalog';
import { colors, radius } from '@/theme';

const goBack = () => (router.canGoBack() ? router.back() : router.replace('/me'));

function pinNote(a: Address, radiusKm: number) {
  if (!a.location) return { text: 'Location pin missing · tap Edit to add', bad: true };
  // Re-checked against today's radius (an address saved under an old test mode may be far away)
  if (a.serviceable !== true || a.distanceKm > radiusKm) return { text: `${a.distanceKm} km away · outside our ${radiusKm} km area`, bad: true };
  return { text: `${a.distanceKm} km from our store`, bad: false };
}

export default function Addresses() {
  const insets = useSafeAreaInsets();
  // ?pick=1 → opened from the Jhola: choosing an address goes straight back
  const { pick } = useLocalSearchParams<{ pick?: string }>();
  const { addresses, selectedId, selectAddress, removeAddress } = useProfile();
  const store = useStoreInfo();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const current = selectedId ?? addresses[0]?.id;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ backgroundColor: colors.maroon, paddingTop: insets.top + 6, paddingHorizontal: 12, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Pressable onPress={goBack} hitSlop={12} accessibilityLabel="Back" style={{ padding: 4 }}>
          <ChevronLeft size={26} color={colors.gold} />
        </Pressable>
        <Txt variant="h1" color={colors.gold}>
          {pick ? 'Deliver to…' : 'Saved addresses'}
        </Txt>
      </View>
      <DentilBorder />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 32 }}>
        <View style={{ flexDirection: 'row', gap: 10, backgroundColor: colors.gold50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.goldDeep, padding: 12 }}>
          <HeartHandshake size={22} color={colors.wood} />
          <Txt variant="caption" color={colors.wood} style={{ flex: 1 }}>
            Living away from home? Save your family&apos;s address in Sikkim with their phone number, and send them groceries from anywhere. Pay online so they pay nothing at the door.
          </Txt>
        </View>

        {addresses.map((a) => {
          const on = a.id === current;
          const note = pinNote(a, store.serviceRadiusKm);
          return (
            <View
              key={a.id}
              style={{ backgroundColor: colors.card, borderRadius: radius.lg, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: on ? 2 : 1, borderColor: on ? colors.maroon : colors.line, overflow: 'hidden' }}>
              <Pressable
                onPress={() => {
                  selectAddress(a.id);
                  if (pick) goBack();
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`Deliver to ${a.label}`}
                style={{ flexDirection: 'row', gap: 12, padding: 14, alignItems: 'flex-start' }}>
                <MapPin size={22} color={colors.maroon} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt variant="h3">{a.label}</Txt>
                  {isForSomeoneElse(a) && (
                    <Txt variant="strong" color={colors.turquoise}>
                      For {a.recipientName} · {a.recipientPhone.replace('+91', '+91 ')}
                    </Txt>
                  )}
                  <Txt variant="caption" color={colors.muted} numberOfLines={2}>
                    {addressLine(a)}
                  </Txt>
                  <Txt variant="caption" color={note.bad ? colors.vermilion : colors.leaf}>
                    {note.text}
                  </Txt>
                </View>
                {on && (
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' }}>
                    <Check size={16} color={colors.maroon} strokeWidth={3} />
                  </View>
                )}
              </Pressable>

              <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.line }}>
                {confirmDelete === a.id ? (
                  <>
                    <Txt variant="strong" color={colors.vermilion} style={{ flex: 1, padding: 12 }}>
                      Delete this address?
                    </Txt>
                    <Pressable onPress={() => setConfirmDelete(null)} accessibilityRole="button" style={{ padding: 12 }}>
                      <Txt variant="strong" color={colors.muted}>
                        Keep
                      </Txt>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        removeAddress(a.id);
                        setConfirmDelete(null);
                      }}
                      accessibilityRole="button"
                      style={{ padding: 12 }}>
                      <Txt variant="strong" color={colors.vermilion}>
                        Delete
                      </Txt>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Pressable
                      onPress={() => router.push({ pathname: '/address', params: { id: a.id } })}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${a.label}`}
                      style={{ flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', padding: 12 }}>
                      <Pencil size={16} color={colors.turquoise} />
                      <Txt variant="strong" color={colors.turquoise}>
                        Edit
                      </Txt>
                    </Pressable>
                    <View style={{ width: 1, backgroundColor: colors.line }} />
                    <Pressable
                      onPress={() => setConfirmDelete(a.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${a.label}`}
                      style={{ flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', padding: 12 }}>
                      <Trash2 size={16} color={colors.vermilion} />
                      <Txt variant="strong" color={colors.vermilion}>
                        Delete
                      </Txt>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          );
        })}

        {addresses.length === 0 && (
          <Txt color={colors.muted} style={{ textAlign: 'center', marginVertical: 12 }}>
            No saved addresses yet.
          </Txt>
        )}

        <Button title="Add a new address" variant="secondary" icon={<Plus size={18} color={colors.maroon} />} onPress={() => router.push('/address')} />
      </ScrollView>
    </View>
  );
}
