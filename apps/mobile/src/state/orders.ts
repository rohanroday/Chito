// Order status labels + the customer-visible steps (server is the source of truth).
import type { OrderStatus } from '@/api/types';

export const ORDER_STEPS = ['PLACED', 'CONFIRMED', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const;

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PAYMENT_PENDING: 'Waiting for payment',
  PLACED: 'Order placed',
  CONFIRMED: 'Confirmed by store',
  PACKED: 'Packed',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  DELIVERY_FAILED: 'Rider couldn’t reach you',
  CANCELLED: 'Cancelled',
};

/** Index on the mountain path; a failed attempt stays on the "out for delivery" step. */
export function stepIndex(status: OrderStatus): number {
  if (status === 'DELIVERY_FAILED') return ORDER_STEPS.indexOf('OUT_FOR_DELIVERY');
  if (status === 'CANCELLED' || status === 'PAYMENT_PENDING') return -1;
  return ORDER_STEPS.indexOf(status);
}

export const isActive = (s: OrderStatus) => !['DELIVERED', 'CANCELLED'].includes(s);
export const customerCanCancel = (s: OrderStatus) => s === 'PAYMENT_PENDING' || s === 'PLACED' || s === 'CONFIRMED';
