import mongoose, { type Types } from 'mongoose';
import { randomInt } from 'node:crypto';

import { env } from '../config/env.js';
import { fromPoint, type LatLng, toPoint } from '../lib/geo.js';
import { badRequest, conflict, HttpError, notFound, unauthorized } from '../lib/http.js';
import { ACTIVE_STATUSES, canTransition, CUSTOMER_CANCELLABLE, type OrderStatus } from '../lib/order-status.js';
import { emitToAdmins, emitToRider, emitToUser } from '../lib/realtime.js';
import { Category, Counter, Order, type OrderInstance, Product, Rider, User } from '../models/index.js';
import {
  cancelPaymentLink,
  capturePayment,
  createPaymentLink,
  createRzpOrder,
  getPayment,
  getPaymentLink,
  getRzpOrderPayments,
  PAYMENT_WINDOW_MIN,
  refundPayment,
  type RzpPayment,
  verifyCheckoutSignature,
} from './razorpay.js';
import { checkServiceability, computeBill, etaFor, getStore, isOpenNow } from './store.js';

type OrderHydrated = OrderInstance;

export type CreateOrderInput = {
  items: { slug: string; qty: number }[];
  address: {
    label: string;
    house: string;
    landmark: string;
    area: string;
    directions: string;
    recipientName?: string;
    recipientPhone?: string;
    location?: LatLng;
  };
  paymentMethod: 'COD' | 'ONLINE';
  /** ONLINE: pay in the app's native Razorpay Checkout, or on a Razorpay Payment Link page (default). */
  payVia?: 'checkout' | 'link';
  instructions?: string;
  /** App link to return to after paying, with ORDER_ID as a placeholder (checked by the route). */
  returnUrl?: string;
};

/** Shape sent to apps (customer + admin). */
export function serializeOrder(o: OrderHydrated, forAdmin = false) {
  return {
    id: o._id.toString(),
    orderNumber: o.orderNumber,
    status: o.status,
    statusHistory: o.statusHistory.map((h) => ({ status: h.status, at: h.at })),
    items: o.items,
    bill: o.bill,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    rider: o.rider?.name ? { name: o.rider.name, phone: o.rider.phone } : null,
    etaMin: o.etaMin,
    distanceKm: o.distanceKm,
    address: {
      label: o.address?.label,
      house: o.address?.house,
      landmark: o.address?.landmark,
      area: o.address?.area,
      directions: o.address?.directions,
      recipientName: o.address?.recipientName ?? '',
      recipientPhone: o.address?.recipientPhone ?? '',
      location: o.address?.location?.coordinates?.length ? fromPoint(o.address.location as { coordinates: number[] }) : null,
    },
    instructions: o.instructions,
    cancelReason: o.cancelReason,
    failReason: o.failReason ?? '',
    // Who marked it delivered: "rider" (with the customer's code) or "admin" (override without a code)
    deliveredBy: deliveredBy(o),
    // The code proves delivery, so ONLY the customer sees it, and only while the rider is on the way
    ...(!forAdmin && o.status === 'OUT_FOR_DELIVERY' && o.deliveryCode && { deliveryCode: o.deliveryCode }),
    // Where to pay, while an online order is waiting for payment. url = Razorpay's page ('' = pay in the app's Checkout)
    payment:
      o.status === 'PAYMENT_PENDING' && (o.payment?.linkUrl || o.payment?.rzpOrderId)
        ? { url: o.payment.linkUrl ?? '', inApp: !!o.payment.rzpOrderId, expiresAt: o.payment.expiresAt }
        : null,
    createdAt: (o as unknown as { createdAt: Date }).createdAt,
    ...(forAdmin && { customer: o.customer, riderId: o.riderId?.toString() ?? null }),
  };
}

function deliveredBy(o: OrderHydrated): 'rider' | 'admin' | null {
  const h = [...o.statusHistory].reverse().find((x) => x.status === 'DELIVERED');
  if (!h) return null;
  return h.by?.startsWith('rider:') ? 'rider' : 'admin';
}

/** What the rider app shows: everything needed at the door, never the delivery code. */
export function serializeOrderForRider(o: OrderHydrated) {
  const full = serializeOrder(o, true);
  const { deliveryCode: _hidden, ...rest } = full as typeof full & { deliveryCode?: string };
  return {
    ...rest,
    // How much cash to collect at the door (0 when paid online)
    collect: o.paymentMethod === 'COD' && o.paymentStatus !== 'PAID' ? (o.bill?.grandTotal ?? 0) : 0,
  };
}

function broadcast(o: OrderHydrated, event: 'order:new' | 'order:updated') {
  emitToAdmins(event, serializeOrder(o, true));
  emitToUser(o.userId.toString(), 'order:updated', serializeOrder(o));
  if (o.riderId) emitToRider(o.riderId.toString(), 'order:updated', serializeOrderForRider(o));
}

async function nextOrderNumber(session: mongoose.ClientSession) {
  const c = await Counter.findOneAndUpdate({ _id: 'order' }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after', session });
  return `CH-${String(c.seq).padStart(6, '0')}`;
}

async function restoreStock(o: OrderHydrated, session: mongoose.ClientSession) {
  for (const it of o.items) {
    await Product.updateOne({ slug: it.slug }, { $inc: { stock: it.qty ?? 0 } }, { session });
  }
}

export async function createOrder(userId: string, idempotencyKey: string, input: CreateOrderInput) {
  // Idempotency: a retried request (bad network) returns the first order instead of a duplicate
  const existing = await Order.findOne({ userId, idempotencyKey });
  if (existing) return existing;

  const [store, user] = await Promise.all([getStore(), User.findById(userId)]);
  if (!user) throw unauthorized(); // account was removed: the app logs out
  if (user.isBlocked) throw new HttpError(403, 'BLOCKED', 'Your account is blocked. Please contact Chito.');
  if (!isOpenNow(store)) {
    throw conflict('STORE_CLOSED', store.isOpen ? `We're closed now. We open at ${store.openTime}.` : store.closedMessage || 'The store is closed right now.');
  }

  // Serviceability is decided HERE, never trusted from the client
  const svc = checkServiceability(store, input.address.location);
  if (!svc.serviceable) {
    throw conflict(
      svc.reason === 'NO_LOCATION' ? 'LOCATION_REQUIRED' : 'OUT_OF_RANGE',
      svc.reason === 'NO_LOCATION'
        ? 'Please set your delivery location first.'
        : `This address is ${svc.distanceKm} km away. We deliver within ${store.serviceRadiusKm} km of our store.`,
    );
  }

  // Merge duplicate lines
  const qtyBySlug = new Map<string, number>();
  for (const it of input.items) qtyBySlug.set(it.slug, (qtyBySlug.get(it.slug) ?? 0) + it.qty);

  try {
    return await placeOrder(store, user, idempotencyKey, input, qtyBySlug);
  } catch (e) {
    // The same order sent twice at the same moment (double tap, flaky network): the unique index lets
    // only one through. Hand the other request that same order once it has been saved.
    if ((e as { code?: number }).code !== 11000) throw e;
    for (let i = 0; i < 20; i++) {
      const first = await Order.findOne({ userId, idempotencyKey });
      if (first) return first;
      await new Promise((r) => setTimeout(r, 150));
    }
    throw e;
  }
}

async function placeOrder(
  store: Awaited<ReturnType<typeof getStore>>,
  user: { _id: Types.ObjectId; name: string; phone: string },
  idempotencyKey: string,
  input: CreateOrderInput,
  qtyBySlug: Map<string, number>,
) {
  const svc = checkServiceability(store, input.address.location);
  const session = await mongoose.startSession();
  try {
    let created: OrderHydrated | null = null;
    await session.withTransaction(async () => {
      const lines: CreateOrderInputLine[] = [];
      for (const [slug, qty] of qtyBySlug) {
        const product = await Product.findOne({ slug, isActive: true }, null, { session });
        // A hidden category hides its products too (same rule as the catalogue)
        const shown = product && (await Category.exists({ slug: product.category, isActive: true }).session(session));
        if (!product || !shown) throw conflict('PRODUCT_UNAVAILABLE', `An item in your jhola is no longer available.`, { slug });
        if (qty > product.maxPerOrder) throw badRequest('MAX_PER_ORDER', `You can order at most ${product.maxPerOrder} of ${product.name}.`, { slug });
        // Atomic decrement: only succeeds if enough stock remains
        const updated = await Product.findOneAndUpdate({ _id: product._id, stock: { $gte: qty } }, { $inc: { stock: -qty } }, { session, returnDocument: 'after' });
        if (!updated) throw conflict('OUT_OF_STOCK', `Sorry, ${product.name} just went out of stock.`, { slug, available: product.stock });
        // Prices come from the DB, never from the client
        lines.push({ slug, name: product.name, unit: product.unit, image: product.images[0] ?? '', price: product.price, mrp: product.mrp, qty });
      }

      const itemTotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
      const mrpTotal = lines.reduce((s, l) => s + l.mrp * l.qty, 0);
      if (itemTotal < store.minOrderValue) {
        throw badRequest('BELOW_MINIMUM', `Minimum order is ₹${Math.round(store.minOrderValue / 100)}.`);
      }

      const [order] = await Order.create(
        [
          {
            orderNumber: await nextOrderNumber(session),
            userId: user._id,
            customer: { name: user.name, phone: user.phone },
            items: lines,
            address: { ...input.address, location: input.address.location ? toPoint(input.address.location) : undefined },
            distanceKm: svc.distanceKm,
            bill: computeBill(store, itemTotal, mrpTotal),
            paymentMethod: input.paymentMethod,
            // Online orders wait for payment; stock is held meanwhile
            status: input.paymentMethod === 'ONLINE' ? 'PAYMENT_PENDING' : 'PLACED',
            statusHistory: [{ status: input.paymentMethod === 'ONLINE' ? 'PAYMENT_PENDING' : 'PLACED', by: 'customer' }],
            etaMin: etaFor(store, svc.distanceKm),
            instructions: input.instructions ?? '',
            idempotencyKey,
          },
        ],
        { session },
      );
      created = order;
    });
    const order = created as unknown as OrderHydrated;
    if (order.paymentMethod === 'COD') {
      broadcast(order, 'order:new');
      return order;
    }
    // Online: the store only hears about the order once it's paid.
    try {
      if (input.payVia === 'checkout') {
        // In-app Checkout: only a Razorpay Order, no payment page, so the order can't be paid in two places
        const rzp = await createRzpOrder({ orderNumber: order.orderNumber, grandTotal: order.bill?.grandTotal ?? 0 });
        order.payment = { linkId: '', linkUrl: '', rzpOrderId: rzp.id, paymentId: '', expiresAt: new Date(Date.now() + PAYMENT_WINDOW_MIN * 60_000), returnUrl: '' };
        await order.save();
        return order;
      }
      const link = await createPaymentLink({
        orderNumber: order.orderNumber,
        grandTotal: order.bill?.grandTotal ?? 0,
        customerName: user.name,
        customerPhone: user.phone,
      });
      order.payment = { linkId: link.id, linkUrl: link.short_url, rzpOrderId: '', paymentId: '', expiresAt: new Date(link.expire_by * 1000), returnUrl: input.returnUrl ?? '' };
      await order.save();
      return order;
    } catch (e) {
      await cancelOrder(order._id.toString(), 'system', 'Payment could not be started');
      throw e;
    }
  } finally {
    await session.endSession();
  }
}
type CreateOrderInputLine = { slug: string; name: string; unit: string; image: string; price: number; mrp: number; qty: number };

/** Cancel (customer or admin). Restores stock atomically. */
export async function cancelOrder(orderId: string, by: 'customer' | 'admin' | 'system', reason: string, userId?: string) {
  const session = await mongoose.startSession();
  try {
    let result: OrderHydrated | null = null;
    await session.withTransaction(async () => {
      const o = await Order.findById(orderId, null, { session });
      if (!o || (userId && o.userId.toString() !== userId)) throw notFound('Order');
      const allowed =
        by === 'customer'
          ? CUSTOMER_CANCELLABLE.includes(o.status as OrderStatus)
          : by === 'system'
            ? o.status === 'PAYMENT_PENDING'
            : canTransition(o.status as OrderStatus, 'CANCELLED');
      if (!allowed) throw conflict('CANNOT_CANCEL', by === 'customer' ? 'This order is already being packed and can’t be cancelled. Please call us.' : `Can't cancel an order that is ${o.status}.`);
      await restoreStock(o, session);
      o.status = 'CANCELLED';
      o.cancelReason = reason;
      o.statusHistory.push({ status: 'CANCELLED', at: new Date(), by });
      await o.save({ session });
      result = o;
    });
    const o = result as unknown as OrderHydrated;
    await settleOnlinePaymentOnCancel(o);
    broadcast(o, 'order:updated');
    return o;
  } finally {
    await session.endSession();
  }
}

/** Online orders: refund if already paid, otherwise close the payment page so it can't be paid later. */
async function settleOnlinePaymentOnCancel(o: OrderHydrated) {
  if (o.paymentMethod !== 'ONLINE') return;
  if (o.paymentStatus === 'PAID' && o.payment?.paymentId) {
    try {
      await refundPayment(o.payment.paymentId, o.bill?.grandTotal ?? 0);
      o.paymentStatus = 'REFUNDED';
    } catch {
      o.paymentStatus = 'REFUND_FAILED'; // shown in the admin so the owner can refund from the Razorpay dashboard
    }
    await o.save();
  } else if (o.payment?.linkId) {
    await cancelPaymentLink(o.payment.linkId);
  }
}

/**
 * Razorpay confirmed a payment (link callback, in-app checkout, status check or webhook). Safe to call more than once.
 * `match` finds the order by the Razorpay object that was paid: the Payment Link or the Razorpay Order.
 */
async function confirmPayment(match: { 'payment.linkId': string } | { 'payment.rzpOrderId': string }, paymentId: string) {
  const o = await Order.findOneAndUpdate(
    { ...match, status: 'PAYMENT_PENDING' },
    {
      $set: { status: 'PLACED', paymentStatus: 'PAID', 'payment.paymentId': paymentId },
      $push: { statusHistory: { status: 'PLACED', at: new Date(), by: 'payment' } },
    },
    { returnDocument: 'after' },
  );
  if (o) {
    broadcast(o, 'order:new'); // now the store hears about it
    // Paid in the app: close the Razorpay page so the same order can't be paid twice
    if ('payment.rzpOrderId' in match && o.payment?.linkId) await cancelPaymentLink(o.payment.linkId);
    return o;
  }
  const other = await Order.findOne(match);
  if (!other || !paymentId) return other;
  if (other.status === 'CANCELLED' && other.paymentStatus === 'PENDING') {
    // Paid after we already gave up on it (expired/cancelled): refund automatically
    other.payment!.paymentId = paymentId;
    other.paymentStatus = 'PAID';
    await settleOnlinePaymentOnCancel(other);
  } else if (other.paymentStatus !== 'PENDING' && other.payment?.paymentId && other.payment.paymentId !== paymentId) {
    // Paid a second time (e.g. on the link AND in the app): give the extra payment back
    await refundPayment(paymentId, other.bill?.grandTotal ?? 0).catch((e) => console.error('duplicate payment refund failed', other.orderNumber, paymentId, e));
  }
  return other;
}

export const markOrderPaid = (linkId: string, paymentId: string) => confirmPayment({ 'payment.linkId': linkId }, paymentId);
export const markRzpOrderPaid = (rzpOrderId: string, paymentId: string) => confirmPayment({ 'payment.rzpOrderId': rzpOrderId }, paymentId);

/** A payment on our Razorpay Order that should count: captured, or authorized (then capture it). */
async function settledPayment(o: OrderHydrated, p: RzpPayment) {
  if (p.order_id !== o.payment?.rzpOrderId || p.amount !== (o.bill?.grandTotal ?? 0)) return null;
  if (p.status === 'captured') return p;
  if (p.status === 'authorized') return capturePayment(p.id, p.amount).then((c) => (c.status === 'captured' ? c : null));
  return null;
}

/** The app is about to open Razorpay's native Checkout: make (once) the Razorpay Order it pays. */
export async function startCheckout(orderId: string, userId: string) {
  let o = await Order.findOne({ _id: orderId, userId }).catch(() => null);
  if (!o) throw notFound('Order');
  if (o.paymentMethod !== 'ONLINE') throw conflict('NOT_ONLINE', 'This order is Cash on Delivery.');
  // Already paid or expired on Razorpay's side? Settle that first.
  if (o.status === 'PAYMENT_PENDING') o = await refreshOnlinePayment(o);
  if (o.status !== 'PAYMENT_PENDING') throw conflict('NOT_AWAITING_PAYMENT', o.paymentStatus === 'PAID' ? 'This order is already paid.' : 'This order can no longer be paid. Please place it again.');
  const secondsLeft = Math.floor(((o.payment?.expiresAt?.getTime() ?? 0) - Date.now()) / 1000);
  if (secondsLeft < 60) throw conflict('PAYMENT_EXPIRED', 'The time to pay for this order is over. Please place it again.');
  if (!o.payment?.rzpOrderId) {
    const rzp = await createRzpOrder({ orderNumber: o.orderNumber, grandTotal: o.bill?.grandTotal ?? 0 });
    // Conditional: two taps at once reuse the first Razorpay Order instead of making two
    const saved = await Order.findOneAndUpdate({ _id: o._id, 'payment.rzpOrderId': '' }, { $set: { 'payment.rzpOrderId': rzp.id } }, { returnDocument: 'after' });
    o = saved ?? (await Order.findById(o._id))!;
  }
  const user = await User.findById(o.userId, { name: 1, phone: 1 }).lean();
  return {
    keyId: env.RAZORPAY_KEY_ID ?? '',
    rzpOrderId: o.payment!.rzpOrderId,
    amount: o.bill?.grandTotal ?? 0, // paise
    currency: 'INR',
    description: `Chito order ${o.orderNumber}`,
    prefill: { name: user?.name ?? '', contact: user?.phone ?? '' },
    // Razorpay closes the Checkout when our payment window ends, so nobody pays for an order we're about to drop
    timeoutSec: secondsLeft,
  };
}

/** The native Checkout reported success. Trust only the signature + Razorpay's own record of the payment. */
export async function verifyCheckout(orderId: string, userId: string, r: { rzpOrderId: string; paymentId: string; signature: string }) {
  const o = await Order.findOne({ _id: orderId, userId }).catch(() => null);
  if (!o) throw notFound('Order');
  if (!o.payment?.rzpOrderId || r.rzpOrderId !== o.payment.rzpOrderId || !verifyCheckoutSignature(r)) {
    throw badRequest('BAD_PAYMENT_SIGNATURE', 'We could not confirm this payment. If money was taken, it will be confirmed automatically or refunded.');
  }
  const p = await settledPayment(o, await getPayment(r.paymentId));
  if (!p) throw conflict('PAYMENT_NOT_COMPLETE', 'The payment is not complete yet. Please check again in a moment.');
  return (await markRzpOrderPaid(o.payment.rzpOrderId, p.id)) ?? o;
}

/** Ask Razorpay where an unpaid order stands: mark it paid, or cancel it when the link has expired. */
export async function refreshOnlinePayment(o: OrderHydrated) {
  if (o.status !== 'PAYMENT_PENDING' || !(o.payment?.linkId || o.payment?.rzpOrderId)) return o;
  // Paid in the app (even if the app closed before telling us)?
  if (o.payment.rzpOrderId) {
    for (const p of await getRzpOrderPayments(o.payment.rzpOrderId)) {
      const ok = await settledPayment(o, p).catch(() => null);
      if (ok) return (await markRzpOrderPaid(o.payment.rzpOrderId, ok.id)) ?? o;
    }
  }
  if (!o.payment.linkId) {
    // In-app only: Razorpay Orders never expire, so our own window decides (the Checkout closed itself at the end of it;
    // a payment that still sneaks in later is refunded automatically when its webhook arrives)
    const over = (o.payment.expiresAt?.getTime() ?? 0) + 60_000 < Date.now();
    return over ? cancelOrder(o._id.toString(), 'system', 'Payment was not completed in time') : o;
  }
  const link = await getPaymentLink(o.payment.linkId);
  if (link.status === 'paid') {
    const paid = link.payments?.find((p) => p.status === 'captured') ?? link.payments?.[0];
    return (await markOrderPaid(link.id, paid?.payment_id ?? '')) ?? o;
  }
  if (link.status === 'expired' || link.status === 'cancelled') {
    return cancelOrder(o._id.toString(), 'system', 'Payment was not completed in time');
  }
  return o;
}

/** Every minute: release stock held by online orders whose payment window has passed. */
export async function expireUnpaidOrders() {
  const stale = await Order.find({ status: 'PAYMENT_PENDING', 'payment.expiresAt': { $lt: new Date(Date.now() - 60_000) } }).limit(20);
  for (const o of stale) {
    try {
      await refreshOnlinePayment(o);
    } catch (e) {
      console.error('expire check failed', o.orderNumber, e);
    }
  }
}

/**
 * Moves an order forward (not for assigning riders or cancelling).
 * `by` is recorded in the history: "admin:<id>" or "rider:<id>".
 */
export async function advanceOrder(orderId: string, to: OrderStatus, by: string, extra: { failReason?: string } = {}) {
  if (to === 'CANCELLED') throw badRequest('USE_CANCEL', 'Use the cancel action');
  if (to === 'OUT_FOR_DELIVERY') throw badRequest('USE_ASSIGN', 'Assign a rider to send the order out');
  const current = await Order.findById(orderId);
  if (!current) throw notFound('Order');
  const from = current.status as OrderStatus;
  if (!canTransition(from, to)) throw conflict('BAD_TRANSITION', `Can't move an order from ${from} to ${to}.`);

  // Atomic: only moves if nobody else moved it first (a double click must not count the rider's cash twice)
  const o = await Order.findOneAndUpdate(
    { _id: current._id, status: from },
    {
      $set: {
        status: to,
        ...(to === 'DELIVERED' && current.paymentMethod === 'COD' && { paymentStatus: 'PAID' }),
        ...(to === 'DELIVERY_FAILED' && { failReason: extra.failReason ?? '' }),
      },
      $push: { statusHistory: { status: to, at: new Date(), by } },
    },
    { returnDocument: 'after' },
  );
  if (!o) throw conflict('ALREADY_UPDATED', 'This order was just updated. Refresh to see the latest.');
  if (to === 'DELIVERED') await settleRiderAfterDelivery(o);
  if (to === 'DELIVERY_FAILED' && o.riderId) await freeRiderIfIdle(o.riderId, o._id);
  broadcast(o, 'order:updated');
  return o;
}

/** Admin hands a packed order to a rider waiting at the store. */
export async function assignRider(orderId: string, riderId: string, adminId: string) {
  const [current, rider] = await Promise.all([Order.findById(orderId), Rider.findById(riderId)]);
  if (!current) throw notFound('Order');
  if (!rider || !rider.isActive) throw notFound('Rider');
  const from = current.status as OrderStatus;
  if (!canTransition(from, 'OUT_FOR_DELIVERY')) throw conflict('NOT_READY', 'Pack the order before assigning a rider.');
  if (rider.status === 'OFF_DUTY') throw conflict('RIDER_OFF_DUTY', `${rider.name} is off duty.`);

  // Atomic: two clicks (or two admins) can't send the same order out twice
  const o = await Order.findOneAndUpdate(
    { _id: current._id, status: from },
    {
      // A new 4-digit code for every trip (also when re-assigned after a failed attempt)
      $set: {
        riderId: rider._id,
        rider: { name: rider.name, phone: rider.phone },
        status: 'OUT_FOR_DELIVERY',
        deliveryCode: String(randomInt(1000, 10000)),
        failReason: '',
      },
      $push: { statusHistory: { status: 'OUT_FOR_DELIVERY', at: new Date(), by: `admin:${adminId}` } },
    },
    { returnDocument: 'after' },
  );
  if (!o) throw conflict('ALREADY_UPDATED', 'This order was just updated. Refresh to see the latest.');
  await Rider.updateOne({ _id: rider._id }, { status: 'ON_DELIVERY' }); // a rider may carry several orders (batching)
  rider.status = 'ON_DELIVERY';
  broadcast(o, 'order:updated');
  emitToRider(rider._id.toString(), 'order:assigned', serializeOrderForRider(o));
  emitToAdmins('rider:updated', { id: rider._id.toString(), status: rider.status });
  return o;
}

async function settleRiderAfterDelivery(o: OrderHydrated) {
  if (!o.riderId) return;
  if (o.paymentMethod === 'COD') await Rider.updateOne({ _id: o.riderId }, { $inc: { codBalance: o.bill?.grandTotal ?? 0 } });
  await freeRiderIfIdle(o.riderId, o._id);
}

/** Rider goes back to AVAILABLE when they have no other active orders. */
async function freeRiderIfIdle(riderId: Types.ObjectId, exceptOrderId: Types.ObjectId) {
  const others = await Order.countDocuments({ riderId, _id: { $ne: exceptOrderId }, status: 'OUT_FOR_DELIVERY' });
  if (others === 0) {
    await Rider.updateOne({ _id: riderId, status: 'ON_DELIVERY' }, { status: 'AVAILABLE', availableSince: new Date() });
    emitToAdmins('rider:updated', { id: riderId.toString(), status: 'AVAILABLE' });
  }
}

export const activeOrderFilter = { status: { $in: ACTIVE_STATUSES } };
