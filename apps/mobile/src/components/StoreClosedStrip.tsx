import { Clock, Moon } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import type { StoreInfo } from '@/api/types';
import { formatHour } from '@/lib/store-config';
import { useStoreInfo } from '@/state/catalog';
import { colors, radius, shadow } from '@/theme';

import { Button } from './Button';
import { Mountains } from './ornaments';
import { Txt } from './Txt';

/** Why the store is closed, in plain words. */
function closedText(store: StoreInfo) {
  if (!store.isOpen) {
    return {
      title: 'Chito is closed right now',
      body: store.closedMessage || 'The store is closed for a while. We’ll be back soon.',
    };
  }
  return {
    title: 'We’re closed for the night',
    body: `We open at ${formatHour(store.openTime)} (hours ${formatHour(store.openTime)} – ${formatHour(store.closeTime)}).`,
  };
}

/** Thin strip for screens like the Jhola. */
export function StoreClosedStrip() {
  const store = useStoreInfo();
  if (store.isOpenNow) return null;
  const { title, body } = closedText(store);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FDF0DD', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.saffron }}>
      <Clock size={18} color={colors.saffron} />
      <Txt variant="strong" color={colors.wood} style={{ flex: 1 }}>
        {title}. {body}
      </Txt>
    </View>
  );
}

/** Big card at the top of Home: impossible to miss. */
export function StoreClosedCard() {
  const store = useStoreInfo();
  if (store.isOpenNow) return null;
  const { title, body } = closedText(store);
  return (
    <View
      accessibilityRole="alert"
      style={{ marginHorizontal: 16, marginTop: 10, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.saffron, backgroundColor: '#FDF0DD' }}>
      <View style={{ flexDirection: 'row', gap: 12, padding: 16, alignItems: 'flex-start' }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.saffron, alignItems: 'center', justifyContent: 'center' }}>
          <Moon size={22} color={colors.white} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="h2" color={colors.maroon}>
            {title}
          </Txt>
          <Txt variant="strong" color={colors.wood}>
            {body}
          </Txt>
          <Txt variant="caption" color={colors.muted} style={{ marginTop: 4 }}>
            You can still browse and fill your jhola. Ordering opens as soon as the store does.
          </Txt>
        </View>
      </View>
    </View>
  );
}

/**
 * Pops up once each time the store closes (or when the app opens while closed).
 * The "signature" changes when the reason changes, so a new closure shows again.
 */
export function StoreClosedPopup() {
  const store = useStoreInfo();
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const signature = store.isOpenNow ? null : `${store.isOpen}|${store.closedMessage}|${store.openTime}`;
  // Once the store reopens, forget the dismissal so the next closure pops up again
  if (signature === null && dismissedFor !== null) setDismissedFor(null);
  const visible = signature !== null && signature !== dismissedFor;
  if (!visible) return null;
  const { title, body } = closedText(store);
  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => setDismissedFor(signature)}>
      <Pressable onPress={() => setDismissedFor(signature)} style={{ flex: 1, backgroundColor: 'rgba(36,21,15,0.55)', justifyContent: 'center', padding: 24 }}>
        <Pressable onPress={() => undefined} style={{ backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden', ...shadow }}>
          <View style={{ backgroundColor: colors.maroon, paddingTop: 22, alignItems: 'center' }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.saffron, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <Moon size={28} color={colors.white} />
            </View>
            <Mountains height={40} back="#9A3A45" front={colors.maroon700} />
          </View>
          <View style={{ padding: 20, gap: 8 }}>
            <Txt variant="h1" color={colors.maroon} style={{ textAlign: 'center' }}>
              {title}
            </Txt>
            <Txt variant="strong" color={colors.wood} style={{ textAlign: 'center' }}>
              {body}
            </Txt>
            <Txt color={colors.muted} style={{ textAlign: 'center' }}>
              You can still look around and add things to your jhola. We&apos;ll take your order as soon as we open. 🙏
            </Txt>
            <Button title="OK, got it" onPress={() => setDismissedFor(signature)} style={{ marginTop: 8 }} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
