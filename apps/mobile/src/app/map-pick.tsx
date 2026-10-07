import { router, useLocalSearchParams } from 'expo-router';
import { CircleAlert, CircleCheck, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import type { MapMessage } from '@/components/map/map-html';
import { MapView } from '@/components/map/MapView';
import { Txt } from '@/components/Txt';
import { finishMapPick } from '@/lib/map-pick';
import { kmBetween } from '@/lib/pin';
import type { Pin } from '@/state/auth';
import { useStoreInfo } from '@/state/catalog';
import { colors, radius, shadow } from '@/theme';

const close = () => (router.canGoBack() ? router.back() : router.replace('/addresses'));

/** Full-screen "drop the pin on their door" map. The circle shows the area we deliver to. */
export default function MapPick() {
  const insets = useSafeAreaInsets();
  const store = useStoreInfo();
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();
  const [start] = useState<Pin>(() => {
    const lat = Number(params.lat);
    const lng = Number(params.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) && params.lat ? { lat, lng } : store.location;
  });
  const [pin, setPin] = useState<Pin>(start);
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; message: string }>({ kind: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  const onMessage = useCallback((m: MapMessage) => {
    if (m.type === 'move') setPin({ lat: m.lat, lng: m.lng });
    else if (m.type === 'ready') setState({ kind: 'ready' });
    else {
      console.warn('[map]', m.message); // shows in the Expo terminal
      setState((s) => (s.kind === 'ready' ? s : { kind: 'error', message: m.message }));
    }
  }, []);

  const km = kmBetween(store.location, pin);
  const inside = km <= store.serviceRadiusKm;

  return (
    <View style={{ flex: 1, backgroundColor: colors.parchment }}>
      <View style={{ backgroundColor: colors.maroon, paddingTop: insets.top + 8, paddingHorizontal: 14, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={close} hitSlop={12} accessibilityLabel="Close map" style={{ padding: 4 }}>
          <X size={24} color={colors.gold} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Txt variant="h2" color={colors.gold}>
            Pick the spot on the map
          </Txt>
          <Txt variant="caption" color={colors.white} style={{ opacity: 0.85 }}>
            Drag the map so the pin sits on the door
          </Txt>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <MapView key={reloadKey} reloadKey={reloadKey} center={start} store={store.location} radiusKm={store.serviceRadiusKm} onMessage={onMessage} />
        {state.kind !== 'ready' && (
          <View
            pointerEvents={state.kind === 'loading' ? 'none' : 'auto'}
            style={{ position: 'absolute', left: 16, right: 16, top: 16, padding: 12, borderRadius: radius.md, backgroundColor: state.kind === 'error' ? colors.vermilion50 : colors.card, gap: 8, ...shadow }}>
            {state.kind === 'loading' ? (
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <ActivityIndicator color={colors.maroon} />
                <Txt variant="strong">Loading the map…</Txt>
              </View>
            ) : (
              <>
                <Txt variant="strong" color={colors.vermilion}>
                  {state.message}
                </Txt>
                <Txt variant="caption" color={colors.muted}>
                  You can also go back and paste the location they sent you on WhatsApp.
                </Txt>
                <Button
                  title="Try again"
                  variant="secondary"
                  onPress={() => {
                    setState({ kind: 'loading' });
                    setReloadKey((k) => k + 1);
                  }}
                />
              </>
            )}
          </View>
        )}
      </View>

      <View style={{ padding: 14, paddingBottom: insets.bottom + 14, gap: 10, backgroundColor: colors.card, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, ...shadow }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {inside ? <CircleCheck size={20} color={colors.leaf} /> : <CircleAlert size={20} color={colors.vermilion} />}
          <Txt variant="strong" color={inside ? colors.leaf : colors.vermilion} style={{ flex: 1 }}>
            {inside
              ? `About ${km} km from our store · inside the circle we deliver to`
              : `About ${km} km from our store · outside our ${store.serviceRadiusKm} km circle`}
          </Txt>
        </View>
        <Button title="Use this spot" onPress={() => finishMapPick(pin)} disabled={state.kind === 'error'} />
      </View>
    </View>
  );
}
