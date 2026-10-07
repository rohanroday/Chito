import { env } from '../config/env.js';
import { fromPoint, haversineKm, type LatLng, round1 } from '../lib/geo.js';
import { HttpError } from '../lib/http.js';
import { Store, type StoreDoc } from '../models/index.js';

export async function getStore() {
  const store = await Store.findOne();
  if (!store) throw new HttpError(503, 'STORE_NOT_SET_UP', 'Store is not set up yet. Run the seed script.');
  return store;
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Current minutes past midnight in Asia/Kolkata, regardless of server timezone. */
function istMinutesNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value);
  const m = Number(parts.find((p) => p.type === 'minute')?.value);
  return h * 60 + m;
}

export function withinHours(store: Pick<StoreDoc, 'openTime' | 'closeTime'>, now = new Date()) {
  const t = istMinutesNow(now);
  return t >= toMinutes(store.openTime) && t < toMinutes(store.closeTime);
}

/** Open for ASAP orders right now? (admin switch AND within hours) */
export function isOpenNow(store: StoreDoc) {
  if (!store.isOpen) return false;
  return env.devIgnoreStoreHours || withinHours(store);
}

/**
 * The 3 km rule. It always applies (also in test mode): to try the app from far away,
 * set the delivery pin inside the circle (Pick on the map / paste a location near the store).
 */
export function checkServiceability(store: StoreDoc, at?: LatLng) {
  if (!at) return { serviceable: false, withinRadius: false, distanceKm: 0, reason: 'NO_LOCATION' as const };
  const distanceKm = round1(haversineKm(fromPoint(store.location), at));
  const withinRadius = distanceKm <= store.serviceRadiusKm;
  return { serviceable: withinRadius, withinRadius, distanceKm, reason: withinRadius ? null : ('OUT_OF_RANGE' as const) };
}

/** Dev-only switches that change customer-visible rules — shown as a warning in the apps. */
export const testMode = () => ({ ignoreHours: env.devIgnoreStoreHours, fixedOtp: !!env.OTP_DEV_MODE });

export function etaFor(store: StoreDoc, distanceKm: number) {
  return store.baseEtaMin + Math.ceil(distanceKm) * 3;
}

export function computeBill(store: StoreDoc, itemTotal: number, mrpTotal: number) {
  const deliveryFee = itemTotal >= store.freeDeliveryAbove ? 0 : store.deliveryFee;
  const handlingFee = itemTotal > 0 ? store.handlingFee : 0;
  return { itemTotal, mrpTotal, deliveryFee, handlingFee, discount: 0, grandTotal: itemTotal + deliveryFee + handlingFee };
}

/** Public settings the customer app needs (no internal fields). */
export function publicStore(store: StoreDoc) {
  return {
    name: store.name,
    address: store.address,
    location: fromPoint(store.location),
    serviceRadiusKm: store.serviceRadiusKm,
    isOpen: store.isOpen,
    isOpenNow: isOpenNow(store),
    closedMessage: store.closedMessage,
    openTime: store.openTime,
    closeTime: store.closeTime,
    minOrderValue: store.minOrderValue,
    deliveryFee: store.deliveryFee,
    freeDeliveryAbove: store.freeDeliveryAbove,
    handlingFee: store.handlingFee,
    baseEtaMin: store.baseEtaMin,
    supportPhone: store.supportPhone,
    imageBaseUrl: env.IMAGEKIT_URL_ENDPOINT ?? '',
    testMode: testMode(),
  };
}
