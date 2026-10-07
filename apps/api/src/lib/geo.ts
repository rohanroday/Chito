export type LatLng = { lat: number; lng: number };

/** Straight-line distance in km. GeoJSON stores [lng, lat]; this takes {lat, lng}. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export const round1 = (n: number) => Math.round(n * 10) / 10;

/** GeoJSON Point helpers — coordinates are ALWAYS [lng, lat]. */
export const toPoint = ({ lat, lng }: LatLng) => ({ type: 'Point' as const, coordinates: [lng, lat] as [number, number] });
export const fromPoint = (p: { coordinates: number[] }): LatLng => ({ lng: p.coordinates[0], lat: p.coordinates[1] });
