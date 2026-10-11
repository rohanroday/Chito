// Live location while delivering: the store and the waiting customer see the rider move.
// v1 shares only while the app is open (screen kept awake). Background tracking would need the
// background-location permission and a Play Store review, so it's a later step.
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import { create } from 'zustand';

import { api } from '@/api/client';

export type ShareState = 'off' | 'starting' | 'on' | 'denied' | 'gps-off' | 'error';

export const useLocationShare = create<{ state: ShareState }>(() => ({ state: 'off' }));
const setState = (state: ShareState) => useLocationShare.setState({ state });

const KEEP_AWAKE_TAG = 'chito-delivering';
let sub: Location.LocationSubscription | null = null;
let starting = false;

export async function startSharing() {
  if (sub || starting) return;
  starting = true;
  setState('starting');
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      setState('denied');
      return;
    }
    if (!(await Location.hasServicesEnabledAsync())) {
      setState('gps-off');
      return;
    }
    sub = await Location.watchPositionAsync(
      // Every ~15 s or 50 m is plenty for a scooter in town, and kind to the battery
      { accuracy: Location.Accuracy.Balanced, timeInterval: 15_000, distanceInterval: 50 },
      (pos) => {
        api('/rider/location', { method: 'POST', body: { lat: pos.coords.latitude, lng: pos.coords.longitude } }).catch(() => undefined);
      },
    );
    await activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    setState('on');
  } catch {
    setState('error');
  } finally {
    starting = false;
  }
}

export function stopSharing() {
  sub?.remove();
  sub = null;
  deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
  setState('off');
}
