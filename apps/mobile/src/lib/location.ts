import * as Location from 'expo-location';
import { Platform } from 'react-native';

export type CurrentPlace =
  | { status: 'ok'; coords: { lat: number; lng: number }; area?: string; street?: string; postalCode?: string }
  | { status: 'denied'; canAskAgain: boolean }
  | { status: 'off' }
  | { status: 'error'; message: string };

const GPS_TIMEOUT_MS = 15000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

// Android's geocoder sometimes returns a Plus Code ("7MR4+X2") as the name — not useful to a rider
const looksLikePlusCode = (s?: string | null) => !!s && /^[23456789CFGHJMPQRVWX]{4,}\+[23456789CFGHJMPQRVWX]{2,}/i.test(s);

/** One-shot "Use my current location": permission → GPS fix → best-effort reverse geocode. */
export async function getCurrentPlace(): Promise<CurrentPlace> {
  try {
    if (!(await Location.hasServicesEnabledAsync())) {
      if (Platform.OS !== 'android') return { status: 'off' };
      try {
        await Location.enableNetworkProviderAsync(); // Android shows "Turn on location?" dialog
      } catch {
        return { status: 'off' };
      }
    }

    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return { status: 'denied', canAskAgain: perm.canAskAgain };

    let pos: Location.LocationObject | null = null;
    try {
      pos = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }), GPS_TIMEOUT_MS);
    } catch {
      // Weak GPS in the hills / indoors: fall back to a recent fix
      pos = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 });
    }
    if (!pos) return { status: 'error', message: "Couldn't get a GPS fix. Step outside or near a window and try again." };

    const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };

    // Reverse geocoding isn't available on web; on phones it's best-effort
    if (Platform.OS === 'web') return { status: 'ok', coords };
    try {
      const [g] = await Location.reverseGeocodeAsync({ latitude: coords.lat, longitude: coords.lng });
      const area = [g?.district, g?.subregion, g?.city].find((v) => v && !looksLikePlusCode(v)) ?? undefined;
      const street = [g?.street, g?.name].find((v) => v && !looksLikePlusCode(v)) ?? undefined;
      return { status: 'ok', coords, area, street, postalCode: g?.postalCode ?? undefined };
    } catch {
      return { status: 'ok', coords };
    }
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Something went wrong' };
  }
}
