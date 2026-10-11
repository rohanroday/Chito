// The Chito Rider app: riders log in with their phone (OTP), see the orders the admin gave them,
// mark them delivered with the customer's code (or report a failed attempt) and share location while delivering.
import { Router } from 'express';
import { z } from 'zod';

import { issueTokens, requireRider, userId } from '../lib/auth.js';
import { badRequest, conflict, HttpError, notFound, parse } from '../lib/http.js';
import { checkOtp, phoneSchema } from '../lib/otp.js';
import { failureLimiter } from '../lib/rate-limit.js';
import { emitToAdmins, emitToUser } from '../lib/realtime.js';
import { Order, Rider } from '../models/index.js';
import { advanceOrder, serializeOrderForRider } from '../services/orders.js';

export const rider = Router();

const IST_MS = 5.5 * 3600 * 1000;
const startOfTodayIST = () => {
  const d = new Date(Date.now() + IST_MS);
  d.setUTCHours(0, 0, 0, 0);
  return new Date(d.getTime() - IST_MS);
};

// ── Login (only phones the store added as active riders) ──
rider.post('/auth/otp/verify', async (req, res) => {
  const { phone, code } = parse(z.object({ phone: phoneSchema, code: z.string().regex(/^\d{4}$/) }), req.body);
  const r = await Rider.findOne({ phone, isActive: true });
  // Checked before the code, so a customer number gets a helpful message instead of "wrong OTP"
  if (!r) throw new HttpError(403, 'NOT_A_RIDER', 'This number isn’t a Chito rider. Ask the store to add you.');
  await checkOtp(phone, code);
  res.json({ rider: { id: r._id.toString(), name: r.name, phone: r.phone }, ...issueTokens({ sub: r._id.toString(), kind: 'rider' }, r.tokenVersion ?? 0) });
});

rider.use(requireRider);

async function me(id: string) {
  const r = await Rider.findById(id);
  if (!r || !r.isActive) throw new HttpError(401, 'UNAUTHORIZED', 'Please log in again');
  return r;
}

// ── Profile + today's summary ──
rider.get('/me', async (req, res) => {
  const r = await me(userId(req));
  const [today] = await Order.aggregate<{ delivered: number; cash: number }>([
    { $match: { riderId: r._id, status: 'DELIVERED', updatedAt: { $gte: startOfTodayIST() } } },
    {
      $group: {
        _id: null,
        delivered: { $sum: 1 },
        cash: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'COD'] }, '$bill.grandTotal', 0] } },
      },
    },
  ]);
  res.json({
    id: r._id.toString(),
    name: r.name,
    phone: r.phone,
    vehicle: r.vehicle,
    status: r.status,
    // Cash the rider is carrying and must hand to the store (until the admin presses "Settle")
    codBalance: r.codBalance,
    today: { delivered: today?.delivered ?? 0, cashCollected: today?.cash ?? 0 },
  });
});

/** On duty / off duty. A rider out on a delivery stays "on delivery" until it's done. */
rider.patch('/me/status', async (req, res) => {
  const { status } = parse(z.object({ status: z.enum(['AVAILABLE', 'OFF_DUTY']) }), req.body);
  const r = await me(userId(req));
  if (r.status === 'ON_DELIVERY') throw conflict('ON_DELIVERY', 'Finish your deliveries first.');
  r.status = status;
  r.availableSince = status === 'AVAILABLE' ? new Date() : null;
  await r.save();
  emitToAdmins('rider:updated', { id: r._id.toString(), status: r.status });
  res.json({ status: r.status });
});

// ── Orders (only this rider's) ──
rider.get('/orders', async (req, res) => {
  const id = userId(req);
  const orders = await Order.find({
    riderId: id,
    $or: [{ status: { $in: ['OUT_FOR_DELIVERY', 'DELIVERY_FAILED'] } }, { status: 'DELIVERED', updatedAt: { $gte: startOfTodayIST() } }],
  }).sort({ updatedAt: -1 });
  res.json(orders.map(serializeOrderForRider));
});

async function myOrder(riderId: string, orderId: string) {
  const o = await Order.findById(orderId);
  // Someone else's order looks exactly like a missing one
  if (!o || o.riderId?.toString() !== riderId) throw notFound('Order');
  return o;
}

// 5 wrong codes for one order → 10 minutes' wait (stops guessing the 4 digits)
const codeLimit = failureLimiter({ max: 5, windowMs: 10 * 60 * 1000, message: 'Too many wrong codes. Ask the customer again or call the store.' });

rider.post('/orders/:id/deliver', async (req, res) => {
  const { code } = parse(z.object({ code: z.string().trim().regex(/^\d{4}$/, 'Enter the 4-digit code') }), req.body);
  const id = userId(req);
  const o = await myOrder(id, String(req.params.id));
  if (o.status !== 'OUT_FOR_DELIVERY') throw conflict('NOT_OUT', 'This order isn’t out for delivery.');
  const key = `${id}|${o._id}`;
  codeLimit.assertAllowed(key);
  if (!o.deliveryCode || code !== o.deliveryCode) {
    codeLimit.fail(key);
    throw badRequest('WRONG_CODE', 'Wrong code. Ask the customer for the 4-digit code in their Chito app.');
  }
  codeLimit.succeed(key);
  const done = await advanceOrder(o._id.toString(), 'DELIVERED', `rider:${id}`);
  res.json(serializeOrderForRider(done));
});

rider.post('/orders/:id/fail', async (req, res) => {
  const { reason } = parse(z.object({ reason: z.string().trim().min(2).max(200) }), req.body);
  const id = userId(req);
  const o = await myOrder(id, String(req.params.id));
  const failed = await advanceOrder(o._id.toString(), 'DELIVERY_FAILED', `rider:${id}`, { failReason: reason });
  res.json(serializeOrderForRider(failed));
});

// ── Live location (while delivering) ──
const lastPost = new Map<string, number>();

rider.post('/location', async (req, res) => {
  const { lat, lng } = parse(z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }), req.body);
  const id = userId(req);
  // At most one update every 10 s per rider (phones may send more often)
  const now = Date.now();
  if (now - (lastPost.get(id) ?? 0) < 10_000) {
    res.json({ ok: true, throttled: true });
    return;
  }
  lastPost.set(id, now);
  const at = new Date(now);
  const r = await Rider.findByIdAndUpdate(id, { lastLocation: { lat, lng, at } }, { returnDocument: 'after' });
  if (!r) throw notFound('Rider');
  emitToAdmins('rider:location', { id, name: r.name, lat, lng, at });
  // Customers waiting for this rider see the dot move
  const active = await Order.find({ riderId: id, status: 'OUT_FOR_DELIVERY' }, { userId: 1 }).lean();
  for (const o of active) emitToUser(o.userId.toString(), 'order:rider-location', { orderId: o._id.toString(), lat, lng, at });
  res.json({ ok: true });
});
