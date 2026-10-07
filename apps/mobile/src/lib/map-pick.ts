// Hand-off between the address form and the full-screen map (/map-pick).
// The map runs as its own screen, not a Modal: a WebView inside a Modal is unreliable on Android.
import { router } from 'expo-router';

import type { Pin } from '@/state/auth';

let pending: ((p: Pin) => void) | null = null;

/** Open the map; `onPick` runs when the customer taps "Use this spot". */
export function openMapPicker(initial: Pin | undefined, onPick: (p: Pin) => void) {
  pending = onPick;
  router.push(initial ? { pathname: '/map-pick', params: { lat: String(initial.lat), lng: String(initial.lng) } } : '/map-pick');
}

/** Called by the map screen. */
export function finishMapPick(p: Pin) {
  const cb = pending;
  pending = null;
  if (router.canGoBack()) router.back();
  cb?.(p);
}
