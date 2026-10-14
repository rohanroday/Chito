// Online payment. In the Android app, Razorpay's native Checkout opens inside Chito (UPI apps open straight from it).
// Where that native module isn't there (Expo Go, web) we fall back to Razorpay's own payment page.
// Either way the app never decides "paid" itself: the server checks with Razorpay.
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';

import { api, ApiError } from '@/api/client';
import type { Order } from '@/api/types';
import { colors } from '@/theme';

/** Ask the server to check with Razorpay (paid → PLACED, expired → CANCELLED). */
export const refreshPayment = (orderId: string) => api<Order>(`/orders/${orderId}/payment/refresh`, { method: 'POST' });

/** The app link Razorpay's result page sends people back to (exp://… in Expo Go, chito://… in real builds). */
export const paymentReturnUrl = (orderId = 'ORDER_ID') => Linking.createURL(`payment-return/${orderId}`);

type CheckoutOptions = {
  keyId: string;
  rzpOrderId: string;
  amount: number;
  currency: string;
  description: string;
  prefill: { name: string; contact: string };
  timeoutSec: number;
};
type CheckoutSuccess = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type Checkout = { open: (options: Record<string, unknown>) => Promise<CheckoutSuccess> };

/** Razorpay's native module, only when this build contains it. Importing the package without it throws, so check first. */
function nativeCheckout(): Checkout | null {
  if (Platform.OS === 'web') return null;
  const present = !!(TurboModuleRegistry.get('RNRazorpayCheckout') ?? NativeModules.RNRazorpayCheckout);
  if (!present) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded only after the native module is confirmed
  return require('react-native-razorpay').default as Checkout;
}

/** True when the in-app Checkout is available, so new orders can skip the payment page entirely. */
export const canPayInApp = () => nativeCheckout() !== null;

export type PayResult = { order: Order; message?: string };

/** Open Razorpay. Resolves with the server's view of the order once the customer is back. */
export async function openPayment(order: Order): Promise<PayResult> {
  if (!order.payment) return { order };
  const checkout = nativeCheckout();
  if (checkout) return payInApp(order, checkout);
  if (!order.payment.url) {
    // An in-app order viewed where the native Checkout isn't available (e.g. Expo Go)
    return { order, message: 'Open the Chito app on your phone to pay for this order.' };
  }
  if (Platform.OS === 'web') {
    // A new tab; the tracking screen keeps checking until the payment shows up
    window.open(order.payment.url, '_blank', 'noopener');
    return { order };
  }
  // The server's result page redirects to this app link, which closes the browser on its own
  await WebBrowser.openAuthSessionAsync(order.payment.url, paymentReturnUrl(order.id)).catch(() => null);
  return { order: await refreshPayment(order.id).catch(() => order) };
}

async function payInApp(order: Order, checkout: Checkout): Promise<PayResult> {
  let opts: CheckoutOptions;
  try {
    opts = await api<CheckoutOptions>(`/orders/${order.id}/payment/checkout`, { method: 'POST' });
  } catch (e) {
    // Already paid, or the time to pay is over: show the order as the server sees it now
    const fresh = await refreshPayment(order.id).catch(() => order);
    return { order: fresh, message: e instanceof ApiError ? e.message : undefined };
  }
  let result: CheckoutSuccess;
  try {
    result = await checkout.open({
      key: opts.keyId,
      order_id: opts.rzpOrderId,
      amount: opts.amount,
      currency: opts.currency,
      name: 'Chito',
      description: opts.description,
      prefill: { name: opts.prefill.name, contact: opts.prefill.contact },
      readonly: { contact: true },
      theme: { color: colors.maroon },
      timeout: opts.timeoutSec,
      remember_customer: false,
    });
  } catch (e) {
    // Closed, failed or timed out. Money may still have gone through (e.g. UPI app finished late), so ask the server.
    const fresh = await refreshPayment(order.id).catch(() => order);
    const cancelled = (e as { code?: number })?.code === 0;
    return { order: fresh, message: fresh.status === 'PAYMENT_PENDING' && !cancelled ? 'Payment didn’t go through. No money was taken; you can try again.' : undefined };
  }
  try {
    return { order: await api<Order>(`/orders/${order.id}/payment/verify`, { method: 'POST', body: result }) };
  } catch (e) {
    // e.g. the bank is still confirming: the status check (and Razorpay's webhook) will settle it
    const fresh = await refreshPayment(order.id).catch(() => order);
    return { order: fresh, message: fresh.status === 'PAYMENT_PENDING' && e instanceof ApiError ? e.message : undefined };
  }
}
