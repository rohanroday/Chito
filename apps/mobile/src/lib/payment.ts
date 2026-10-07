// Online payment: the server makes a Razorpay payment page; we open it, then ask the server what happened.
// The app never decides "paid" itself.
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { api } from '@/api/client';
import type { Order } from '@/api/types';

/** Ask the server to check with Razorpay (paid → PLACED, expired → CANCELLED). */
export const refreshPayment = (orderId: string) => api<Order>(`/orders/${orderId}/payment/refresh`, { method: 'POST' });

/** The app link Razorpay's result page sends people back to (exp://… in Expo Go, chito://… in real builds). */
export const paymentReturnUrl = (orderId = 'ORDER_ID') => Linking.createURL(`payment-return/${orderId}`);

/** Open Razorpay's page. Resolves when the customer comes back to the app. */
export async function openPayment(order: Order): Promise<Order> {
  if (!order.payment) return order;
  if (Platform.OS === 'web') {
    // A new tab; the tracking screen keeps checking until the payment shows up
    window.open(order.payment.url, '_blank', 'noopener');
    return order;
  }
  // The server's result page redirects to this app link, which closes the browser on its own
  await WebBrowser.openAuthSessionAsync(order.payment.url, paymentReturnUrl(order.id)).catch(() => null);
  return refreshPayment(order.id).catch(() => order);
}
