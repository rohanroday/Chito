// Online payment, always against a Razorpay Order made by our server (no Payment Links: test mode allows only 30, ever).
// 1. Android with Razorpay's native module: the native Checkout opens over Chito (UPI apps open straight from it).
// 2. Phones without it (or if it can't open): Razorpay's standard Checkout on our own in-app page (src/app/pay/[id].tsx).
// 3. Web: Razorpay's standard Checkout opens on the page.
// Old orders that still have a Payment Link keep opening that page. Whatever happens, the server decides "paid".
import { router } from 'expo-router';
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

export type CheckoutOptions = {
  keyId: string;
  rzpOrderId: string;
  amount: number;
  currency: string;
  description: string;
  prefill: { name: string; contact: string };
  timeoutSec: number;
  callbackUrl: string;
};
type CheckoutSuccess = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type Checkout = { open: (options: Record<string, unknown>) => Promise<CheckoutSuccess> };

/** The options Razorpay Checkout opens with, the same on every platform. */
export function checkoutConfig(opts: CheckoutOptions) {
  return {
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
  };
}

export const getCheckoutOptions = (orderId: string) => api<CheckoutOptions>(`/orders/${orderId}/payment/checkout`, { method: 'POST' });

/** Razorpay's native module, only when this build contains it. Importing the package without it throws, so check first. */
function nativeCheckout(): Checkout | null {
  if (Platform.OS === 'web') return null;
  try {
    const present = !!(NativeModules.RNRazorpayCheckout ?? TurboModuleRegistry.get('RNRazorpayCheckout'));
    if (!present) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded only after the native module is confirmed
    return require('react-native-razorpay').default as Checkout;
  } catch {
    return null;
  }
}

export type PayResult = { order: Order; message?: string };

/** Open Razorpay. Resolves with the server's view of the order once the customer is back (or the in-app page is open). */
export async function openPayment(order: Order): Promise<PayResult> {
  if (!order.payment) return { order };
  // Orders from before: a Payment Link page
  if (order.payment.url && !order.payment.inApp) return payOnLinkPage(order, order.payment.url);
  if (Platform.OS === 'web') return payOnWeb(order);
  const checkout = nativeCheckout();
  if (checkout) return payNative(order, checkout);
  return openPayPage(order);
}

/** Razorpay's standard Checkout on Chito's own full-screen page; that page verifies and comes back by itself. */
function openPayPage(order: Order): PayResult {
  router.push({ pathname: '/pay/[id]', params: { id: order.id } });
  return { order };
}

async function payOnLinkPage(order: Order, url: string): Promise<PayResult> {
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener');
    return { order };
  }
  await WebBrowser.openAuthSessionAsync(url, paymentReturnUrl(order.id)).catch(() => null);
  return { order: await refreshPayment(order.id).catch(() => order) };
}

/** The checkout options from the server, or the order as the server sees it now (already paid, or time over). */
async function optionsOrState(order: Order): Promise<{ opts: CheckoutOptions } | PayResult> {
  try {
    return { opts: await getCheckoutOptions(order.id) };
  } catch (e) {
    const fresh = await refreshPayment(order.id).catch(() => order);
    return { order: fresh, message: e instanceof ApiError ? e.message : 'Could not start the payment. Please try again.' };
  }
}

/** After Razorpay says "paid": the server checks the signature and Razorpay's record. */
async function verify(order: Order, result: CheckoutSuccess): Promise<PayResult> {
  try {
    return { order: await api<Order>(`/orders/${order.id}/payment/verify`, { method: 'POST', body: result }) };
  } catch (e) {
    // e.g. the bank is still confirming: the status check (and Razorpay's webhook) will settle it
    const fresh = await refreshPayment(order.id).catch(() => order);
    return { order: fresh, message: fresh.status === 'PAYMENT_PENDING' && e instanceof ApiError ? e.message : undefined };
  }
}

async function payNative(order: Order, checkout: Checkout): Promise<PayResult> {
  const r = await optionsOrState(order);
  if (!('opts' in r)) return r;
  let result: CheckoutSuccess;
  try {
    result = await checkout.open(checkoutConfig(r.opts));
  } catch (e) {
    const code = (e as { code?: number })?.code;
    // The native module is there but couldn't open (no payment code at all): use the in-app page instead
    if (typeof code !== 'number') return openPayPage(order);
    // Closed, failed or timed out. Money may still have gone through (e.g. UPI app finished late), so ask the server.
    const fresh = await refreshPayment(order.id).catch(() => order);
    return { order: fresh, message: fresh.status === 'PAYMENT_PENDING' && code !== 0 ? 'Payment didn’t go through. No money was taken; you can try again.' : undefined };
  }
  return verify(order, result);
}

// ── Web: Razorpay's standard Checkout script on the page ──
type RazorpayWeb = new (o: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void };

function loadCheckoutScript(): Promise<RazorpayWeb> {
  const w = window as unknown as { Razorpay?: RazorpayWeb };
  if (w.Razorpay) return Promise.resolve(w.Razorpay);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error('Razorpay did not load')));
    s.onerror = () => reject(new Error('Razorpay did not load'));
    document.head.appendChild(s);
  });
}

async function payOnWeb(order: Order): Promise<PayResult> {
  const r = await optionsOrState(order);
  if (!('opts' in r)) return r;
  let Razorpay: RazorpayWeb;
  try {
    Razorpay = await loadCheckoutScript();
  } catch {
    return { order, message: 'Could not load the payment window. Check your connection and try again.' };
  }
  const result = await new Promise<CheckoutSuccess | null>((resolve) => {
    const rzp = new Razorpay({ ...checkoutConfig(r.opts), handler: (res: CheckoutSuccess) => resolve(res), modal: { ondismiss: () => resolve(null) } });
    rzp.open();
  });
  if (!result) return { order: await refreshPayment(order.id).catch(() => order) };
  return verify(order, result);
}
