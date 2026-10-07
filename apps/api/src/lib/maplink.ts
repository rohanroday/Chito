// Turn a location someone shared (WhatsApp / Google Maps link, or plain "lat, lng") into coordinates.
import type { LatLng } from './geo.js';

// Only these hosts are ever fetched (to expand short links) — never arbitrary URLs.
const SHORT_LINK_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl', 'g.co']);
const MAPS_HOSTS = /(^|\.)google\.[a-z.]+$|^maps\.google\.[a-z.]+$|^maps\.app\.goo\.gl$/;

const valid = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

/** Find coordinates inside text or a maps URL. */
export function coordsFromText(text: string): LatLng | null {
  const t = decodeURIComponent(text.replace(/\+/g, ' '));
  const patterns = [
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, // place pin inside a Google Maps URL (most precise)
    /[?&](?:q|query|ll|destination|daddr)=(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/, // ?q=27.23,88.50 (WhatsApp shares)
    /@(-?\d+\.\d+),(-?\d+\.\d+)/, // /@27.23,88.50,17z (map centre)
    /geo:(-?\d+\.\d+),(-?\d+\.\d+)/, // geo: URI
    /^\s*(-?\d{1,2}\.\d{3,})\s*[, ]\s*(-?\d{1,3}\.\d{3,})\s*$/, // "27.2361, 88.5012"
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m && valid(Number(m[1]), Number(m[2]))) return { lat: Number(m[1]), lng: Number(m[2]) };
  }
  return null;
}

/** Follow a short Google Maps link (maps.app.goo.gl/…) to the full URL, which contains the coordinates. */
async function expandShortLink(url: URL): Promise<string | null> {
  let current = url;
  for (let i = 0; i < 5; i++) {
    if (!SHORT_LINK_HOSTS.has(current.hostname) && !MAPS_HOSTS.test(current.hostname)) return null;
    const res = await fetch(current, { redirect: 'manual', signal: AbortSignal.timeout(6000) });
    const next = res.headers.get('location');
    if (!next) return current.toString();
    current = new URL(next, current);
    if (coordsFromText(current.toString())) return current.toString();
  }
  return current.toString();
}

export async function resolveSharedLocation(input: string): Promise<LatLng | null> {
  const direct = coordsFromText(input);
  if (direct) return direct;
  const urlText = input.match(/https?:\/\/\S+/)?.[0];
  if (!urlText) return null;
  let url: URL;
  try {
    url = new URL(urlText);
  } catch {
    return null;
  }
  if (!SHORT_LINK_HOSTS.has(url.hostname)) return null;
  const full = await expandShortLink(url).catch(() => null);
  return full ? coordsFromText(full) : null;
}
