// Turning a spot on the map (GPS, map pin or a shared WhatsApp/Google Maps link) into a checked delivery pin.
import { api } from '@/api/client';
import type { Pin, PinCheck } from '@/state/auth';

type Check = { serviceable: boolean; withinRadius?: boolean; testModeBypass?: boolean; distanceKm: number };

export type CheckedPin = PinCheck & { testBypass: boolean };

/** The server decides serviceability from the store pin the admin set. */
export async function checkPin(location: Pin): Promise<CheckedPin> {
  const r = await api<Check>('/serviceability/check', { method: 'POST', body: location, auth: false });
  return { location, distanceKm: r.distanceKm, serviceable: r.serviceable, testBypass: !!r.testModeBypass };
}

/** "Mom sent her location on WhatsApp": the server reads the coordinates out of the pasted text/link. */
export async function resolveSharedLocation(text: string): Promise<CheckedPin> {
  const r = await api<Check & { location: Pin }>('/geo/resolve', { method: 'POST', body: { text } });
  return { location: r.location, distanceKm: r.distanceKm, serviceable: r.serviceable, testBypass: !!r.testModeBypass };
}

/** Straight-line km, only for live hints on the map. The server's answer is the one that counts. */
export function kmBetween(a: Pin, b: Pin) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)) * 10) / 10;
}
