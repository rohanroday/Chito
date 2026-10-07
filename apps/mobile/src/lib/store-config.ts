// Pure helpers over the store settings the admin edits (fetched from GET /store).
import type { StoreInfo } from '@/api/types';

export function formatHour(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, '0')} ${suffix}` : `${h12} ${suffix}`;
}

export const hoursLabel = (s: StoreInfo) => `${formatHour(s.openTime)} – ${formatHour(s.closeTime)}`;

export function etaMinutes(s: StoreInfo, distanceKm: number): number {
  return s.baseEtaMin + Math.ceil(distanceKm) * 3;
}

/** The "Delivery in 20 mins" line, which must not promise a delivery while the store is shut. */
export function deliveryLine(s: StoreInfo, distanceKm: number): string {
  if (s.isOpenNow) return `Delivery in ${etaMinutes(s, distanceKm)} mins`;
  return s.isOpen ? `Opens at ${formatHour(s.openTime)}` : 'Closed right now';
}

/** Same formula as the server (apps/api/src/services/store.ts) — for display only. */
export function computeBill(s: StoreInfo, itemTotal: number, mrpTotal: number) {
  const deliveryFee = itemTotal >= s.freeDeliveryAbove ? 0 : s.deliveryFee;
  const handlingFee = itemTotal > 0 ? s.handlingFee : 0;
  return {
    itemTotal,
    mrpTotal,
    deliveryFee,
    handlingFee,
    grandTotal: itemTotal + deliveryFee + handlingFee,
    savings: mrpTotal - itemTotal + (deliveryFee === 0 && itemTotal > 0 ? s.deliveryFee : 0),
    belowMinimum: itemTotal < s.minOrderValue,
    toFreeDelivery: Math.max(0, s.freeDeliveryAbove - itemTotal),
    standardDeliveryFee: s.deliveryFee,
  };
}

export type Bill = ReturnType<typeof computeBill>;
