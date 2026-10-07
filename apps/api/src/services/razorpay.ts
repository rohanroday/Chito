// Razorpay Payment Links: the customer pays on Razorpay's own page (UPI, cards, net banking),
// so the app needs no native payment SDK. The server is the only place that decides "paid".
import { createHmac, timingSafeEqual } from 'node:crypto';

import { env } from '../config/env.js';
import { HttpError } from '../lib/http.js';

const API = 'https://api.razorpay.com/v1';
/** Razorpay requires expire_by to be at least 15 minutes ahead. */
export const PAYMENT_WINDOW_MIN = 16;

function auth() {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new HttpError(503, 'PAYMENTS_NOT_CONFIGURED', 'Online payment is not set up yet. Please choose Cash on Delivery.');
  }
  return 'Basic ' + Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');
}

async function rp<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: auth(), 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { description?: string } };
  if (!res.ok) {
    console.error('Razorpay error', method, path, res.status, json.error?.description);
    throw new HttpError(502, 'PAYMENT_PROVIDER_ERROR', 'Could not reach the payment service. Please try again or choose Cash on Delivery.');
  }
  return json;
}

export type PaymentLink = {
  id: string;
  short_url: string;
  status: 'created' | 'partially_paid' | 'expired' | 'cancelled' | 'paid';
  expire_by: number;
  payments?: { payment_id: string; status: string }[] | null;
};

export function callbackUrl() {
  return `${env.PUBLIC_API_URL || `http://localhost:${env.PORT}`}/api/v1/payments/razorpay/callback`;
}

export async function createPaymentLink(o: { orderNumber: string; grandTotal: number; customerName: string; customerPhone: string }) {
  const expireBy = Math.floor(Date.now() / 1000) + PAYMENT_WINDOW_MIN * 60;
  return rp<PaymentLink>('POST', '/payment_links', {
    amount: o.grandTotal, // paise
    currency: 'INR',
    accept_partial: false,
    reference_id: o.orderNumber,
    description: `Chito order ${o.orderNumber}`,
    customer: { name: o.customerName || 'Chito customer', contact: o.customerPhone },
    notify: { sms: false, email: false },
    reminder_enable: false,
    callback_url: callbackUrl(),
    callback_method: 'get',
    expire_by: expireBy,
  });
}

export const getPaymentLink = (id: string) => rp<PaymentLink>('GET', `/payment_links/${id}`);

export async function cancelPaymentLink(id: string) {
  try {
    await rp('POST', `/payment_links/${id}/cancel`);
  } catch {
    // already paid/expired — nothing to do
  }
}

export async function refundPayment(paymentId: string, amount: number) {
  return rp<{ id: string; status: string }>('POST', `/payments/${paymentId}/refund`, { amount, speed: 'normal' });
}

function safeEqualHex(a: string, b: string) {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Signature Razorpay appends to the callback: HMAC_SHA256(link_id|reference_id|status|payment_id, key_secret). */
export function verifyCallbackSignature(p: { linkId: string; referenceId: string; status: string; paymentId: string; signature: string }) {
  if (!env.RAZORPAY_KEY_SECRET || !/^[a-f0-9]+$/i.test(p.signature)) return false;
  const expected = createHmac('sha256', env.RAZORPAY_KEY_SECRET).update(`${p.linkId}|${p.referenceId}|${p.status}|${p.paymentId}`).digest('hex');
  return safeEqualHex(expected, p.signature);
}

/** Webhook signature: HMAC_SHA256(raw request body, webhook secret). */
export function verifyWebhookSignature(rawBody: Buffer, signature: string | undefined) {
  if (!env.RAZORPAY_WEBHOOK_SECRET || !signature || !/^[a-f0-9]+$/i.test(signature)) return false;
  const expected = createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
  return safeEqualHex(expected, signature);
}
