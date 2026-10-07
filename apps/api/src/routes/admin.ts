import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';

import { env } from '../config/env.js';
import { issueTokens, requireAdmin, requireOwner, userId } from '../lib/auth.js';
import { toPoint } from '../lib/geo.js';
import { badRequest, conflict, HttpError, notFound, parse, unauthorized } from '../lib/http.js';
import { ORDER_STATUSES } from '../lib/order-status.js';
import { failureLimiter } from '../lib/rate-limit.js';
import { emitToAdmins, emitToAll } from '../lib/realtime.js';
import { Admin, Category, Order, Product, Rider, Store, User } from '../models/index.js';
import { advanceOrder, assignRider, cancelOrder, serializeOrder } from '../services/orders.js';
import { getStore, publicStore } from '../services/store.js';

export const admin = Router();

// ── Login (no public signup; the OWNER is created by the seed script) ──
// 5 wrong passwords for one email from one address → wait 15 minutes
const loginLimit = failureLimiter({ max: 5, windowMs: 15 * 60 * 1000, message: 'Too many wrong passwords.' });

admin.post('/auth/login', async (req, res) => {
  const { email, password } = parse(z.object({ email: z.email(), password: z.string().min(1) }), req.body);
  const limitKey = `${req.ip}|${email.toLowerCase()}`;
  loginLimit.assertAllowed(limitKey);
  const a = await Admin.findOne({ email: email.toLowerCase() });
  // Same error for unknown email and wrong password
  if (!a || !(await bcrypt.compare(password, a.passwordHash))) {
    loginLimit.fail(limitKey);
    throw unauthorized('Wrong email or password');
  }
  loginLimit.succeed(limitKey);
  res.json({
    admin: { id: a._id.toString(), email: a.email, name: a.name, role: a.role },
    ...issueTokens({ sub: a._id.toString(), kind: 'admin', role: a.role as 'OWNER' | 'STAFF' }, a.tokenVersion),
  });
});

admin.use(requireAdmin);

admin.get('/me', async (req, res) => {
  const a = await Admin.findById(userId(req));
  if (!a) throw notFound('Admin');
  res.json({ id: a._id.toString(), email: a.email, name: a.name, role: a.role });
});

// ── Dashboard numbers (today, Asia/Kolkata) ──
function startOfTodayIST() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - 5.5 * 3600 * 1000);
}

// ── Day report (end-of-day summary, Asia/Kolkata days) ──
const IST_MS = 5.5 * 3600 * 1000;
const todayIST = () => new Date(Date.now() + IST_MS).toISOString().slice(0, 10);
/** "2026-10-06" → that IST day as a UTC range [start, end). */
function istDayRange(day: string) {
  const start = new Date(`${day}T00:00:00+05:30`);
  return { start, end: new Date(start.getTime() + 24 * 3600 * 1000) };
}
// Online orders nobody paid for never reached the store, so reports leave them out
const NEVER_REACHED_STORE = [
  { status: 'PAYMENT_PENDING' as const },
  { status: 'CANCELLED' as const, paymentMethod: 'ONLINE' as const, paymentStatus: 'PENDING' as const },
];

admin.get('/reports/day', async (req, res) => {
  const { date } = parse(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }), req.query);
  const day = date ?? todayIST();
  const { start, end } = istDayRange(day);
  // JavaScript quietly turns "31 Feb" into 3 March, so the date must come back unchanged
  if (Number.isNaN(start.getTime()) || new Date(start.getTime() + IST_MS).toISOString().slice(0, 10) !== day) {
    throw badRequest('BAD_DATE', 'Pick a valid date');
  }
  const orders = await Order.find({ createdAt: { $gte: start, $lt: end } })
    .nor(NEVER_REACHED_STORE)
    .sort({ createdAt: 1 });

  const sum = (list: typeof orders, f: (o: (typeof orders)[number]) => number) => list.reduce((t, o) => t + f(o), 0);
  const total = (list: typeof orders) => sum(list, (o) => o.bill?.grandTotal ?? 0);
  const delivered = orders.filter((o) => o.status === 'DELIVERED');
  const cancelled = orders.filter((o) => o.status === 'CANCELLED');
  const open = orders.filter((o) => !['DELIVERED', 'CANCELLED'].includes(o.status));
  const codDelivered = delivered.filter((o) => o.paymentMethod === 'COD');
  const codOpen = open.filter((o) => o.paymentMethod === 'COD');
  const online = orders.filter((o) => o.paymentMethod === 'ONLINE');
  const onlineKept = online.filter((o) => o.paymentStatus === 'PAID');
  const refunded = online.filter((o) => o.paymentStatus === 'REFUNDED');
  const refundDue = online.filter((o) => o.paymentStatus === 'REFUND_FAILED');

  // Per rider: what they delivered and the cash they collected that day
  const riders = new Map<string, { name: string; deliveries: number; cash: number; cashOrders: number }>();
  for (const o of delivered) {
    const key = o.riderId?.toString() ?? 'none';
    const r = riders.get(key) ?? { name: o.rider?.name || 'No rider', deliveries: 0, cash: 0, cashOrders: 0 };
    r.deliveries += 1;
    if (o.paymentMethod === 'COD') {
      r.cash += o.bill?.grandTotal ?? 0;
      r.cashOrders += 1;
    }
    riders.set(key, r);
  }

  // Best sellers among delivered orders
  const items = new Map<string, { name: string; unit: string; qty: number; amount: number }>();
  for (const o of delivered)
    for (const i of o.items) {
      const it = items.get(i.slug ?? '') ?? { name: i.name ?? '', unit: i.unit ?? '', qty: 0, amount: 0 };
      it.qty += i.qty ?? 0;
      it.amount += (i.price ?? 0) * (i.qty ?? 0);
      items.set(i.slug ?? '', it);
    }

  res.json({
    date: day,
    counts: { total: orders.length, delivered: delivered.length, cancelled: cancelled.length, open: open.length },
    cash: { collected: total(codDelivered), orders: codDelivered.length, stillOut: total(codOpen), stillOutOrders: codOpen.length },
    online: {
      received: total(onlineKept),
      orders: onlineKept.length,
      refunded: total(refunded),
      refundedOrders: refunded.length,
      refundDue: total(refundDue),
      refundDueOrders: refundDue.length,
    },
    // Delivered orders only: what the day actually earned
    sales: {
      items: sum(delivered, (o) => o.bill?.itemTotal ?? 0),
      deliveryFees: sum(delivered, (o) => o.bill?.deliveryFee ?? 0),
      handlingFees: sum(delivered, (o) => o.bill?.handlingFee ?? 0),
      discounts: sum(delivered, (o) => o.bill?.discount ?? 0),
      total: total(delivered),
    },
    riders: [...riders.values()].sort((a, b) => b.deliveries - a.deliveries),
    topItems: [...items.values()].sort((a, b) => b.qty - a.qty).slice(0, 10),
    orders: orders.map((o) => serializeOrder(o, true)),
  });
});

/** Recent days at a glance (for picking a day). */
admin.get('/reports/days', async (_req, res) => {
  const since = new Date(istDayRange(todayIST()).start.getTime() - 29 * 24 * 3600 * 1000);
  const rows = await Order.aggregate<{ _id: string; orders: number; delivered: number; cash: number; online: number }>([
    { $match: { createdAt: { $gte: since }, $nor: NEVER_REACHED_STORE } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } },
        orders: { $sum: 1 },
        delivered: { $sum: { $cond: [{ $eq: ['$status', 'DELIVERED'] }, 1, 0] } },
        cash: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'DELIVERED'] }, { $eq: ['$paymentMethod', 'COD'] }] }, '$bill.grandTotal', 0] } },
        online: { $sum: { $cond: [{ $and: [{ $eq: ['$paymentMethod', 'ONLINE'] }, { $eq: ['$paymentStatus', 'PAID'] }] }, '$bill.grandTotal', 0] } },
      },
    },
    { $sort: { _id: -1 } },
  ]);
  res.json({ today: todayIST(), days: rows.map(({ _id, ...r }) => ({ date: _id, ...r })) });
});

admin.get('/stats/today', async (_req, res) => {
  const since = startOfTodayIST();
  const [agg] = await Order.aggregate([
    // Unpaid online orders never reached the store, so they don't count
    { $match: { createdAt: { $gte: since }, $nor: [{ status: 'PAYMENT_PENDING' }, { status: 'CANCELLED', paymentMethod: 'ONLINE', paymentStatus: 'PENDING' }] } },
    {
      $group: {
        _id: null,
        orders: { $sum: 1 },
        delivered: { $sum: { $cond: [{ $eq: ['$status', 'DELIVERED'] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] } },
        revenue: { $sum: { $cond: [{ $eq: ['$status', 'DELIVERED'] }, '$bill.grandTotal', 0] } },
      },
    },
  ]);
  const [active, codPending, lowStock] = await Promise.all([
    Order.countDocuments({ status: { $in: ['PLACED', 'CONFIRMED', 'PACKED', 'OUT_FOR_DELIVERY'] } }),
    Rider.aggregate([{ $group: { _id: null, total: { $sum: '$codBalance' } } }]),
    Product.countDocuments({ isActive: true, $expr: { $lte: ['$stock', '$lowStockThreshold'] } }),
  ]);
  res.json({
    orders: agg?.orders ?? 0,
    delivered: agg?.delivered ?? 0,
    cancelled: agg?.cancelled ?? 0,
    revenue: agg?.revenue ?? 0,
    active,
    codPending: codPending[0]?.total ?? 0,
    lowStock,
  });
});

// ── Orders ──
admin.get('/orders', async (req, res) => {
  const q = parse(
    z.object({ status: z.enum(ORDER_STATUSES).optional(), scope: z.enum(['board', 'all']).default('board') }),
    req.query,
  );
  // "board" = everything still moving + today's finished orders.
  // Online orders the customer never paid for never reached the store, so they stay off the board.
  const query = q.status
    ? Order.find({ status: q.status })
    : q.scope === 'board'
      ? Order.find({ $or: [{ status: { $in: ['PLACED', 'CONFIRMED', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERY_FAILED'] } }, { updatedAt: { $gte: startOfTodayIST() } }] }).nor([
          { status: 'PAYMENT_PENDING' },
          { status: 'CANCELLED', paymentMethod: 'ONLINE', paymentStatus: 'PENDING' },
        ])
      : Order.find();
  const orders = await query.sort({ createdAt: -1 }).limit(300);
  res.json(orders.map((o) => serializeOrder(o, true)));
});

admin.patch('/orders/:id/status', async (req, res) => {
  const { status } = parse(z.object({ status: z.enum(['CONFIRMED', 'PACKED', 'DELIVERED', 'DELIVERY_FAILED']) }), req.body);
  res.json(serializeOrder(await advanceOrder(String(req.params.id), status, userId(req)), true));
});

admin.post('/orders/:id/assign-rider', async (req, res) => {
  const { riderId } = parse(z.object({ riderId: z.string().min(1) }), req.body);
  res.json(serializeOrder(await assignRider(String(req.params.id), riderId, userId(req)), true));
});

admin.post('/orders/:id/cancel', async (req, res) => {
  const { reason } = parse(z.object({ reason: z.string().trim().min(2).max(200) }), req.body);
  res.json(serializeOrder(await cancelOrder(String(req.params.id), 'admin', reason), true));
});

// ── Riders ──
const serializeRider = (r: InstanceType<typeof Rider>) => ({
  id: r._id.toString(),
  name: r.name,
  phone: r.phone,
  vehicle: r.vehicle,
  status: r.status,
  availableSince: r.availableSince,
  codBalance: r.codBalance,
  isActive: r.isActive,
});

admin.get('/riders', async (_req, res) => {
  const riders = await Rider.find({ isActive: true }).sort({ name: 1 });
  const active = await Order.aggregate([
    { $match: { status: 'OUT_FOR_DELIVERY', riderId: { $ne: null } } },
    { $group: { _id: '$riderId', n: { $sum: 1 } } },
  ]);
  const counts = new Map(active.map((a) => [a._id.toString(), a.n as number]));
  res.json(riders.map((r) => ({ ...serializeRider(r), activeOrders: counts.get(r._id.toString()) ?? 0 })));
});

const riderBody = z.object({
  name: z.string().trim().min(2).max(40),
  phone: z.string().regex(/^\+91[6-9]\d{9}$/, 'Use +91 and 10 digits'),
  vehicle: z.enum(['SCOOTER', 'BIKE', 'ON_FOOT']).default('SCOOTER'),
});

admin.post('/riders', requireOwner, async (req, res) => {
  const r = await Rider.create(parse(riderBody, req.body));
  res.status(201).json(serializeRider(r));
});

admin.patch('/riders/:id', async (req, res) => {
  const body = parse(
    riderBody.partial().extend({ status: z.enum(['AVAILABLE', 'OFF_DUTY']).optional(), isActive: z.boolean().optional() }),
    req.body,
  );
  const r = await Rider.findById(req.params.id);
  if (!r) throw notFound('Rider');
  if (body.status === 'AVAILABLE' && r.status !== 'AVAILABLE') r.availableSince = new Date();
  if (body.status === 'OFF_DUTY') r.availableSince = null;
  // A rider who's out delivering can't be marked available/off duty by mistake
  if (body.status && r.status === 'ON_DELIVERY') delete body.status;
  Object.assign(r, body);
  await r.save();
  emitToAdmins('rider:updated', serializeRider(r));
  res.json(serializeRider(r));
});

admin.post('/riders/:id/settle-cod', async (req, res) => {
  // Atomic swap to 0: cash from a delivery finishing at the same moment isn't lost
  const before = await Rider.findOneAndUpdate({ _id: req.params.id }, { $set: { codBalance: 0 } }, { new: false });
  if (!before) throw notFound('Rider');
  const settled = before.codBalance;
  before.codBalance = 0;
  res.json({ ...serializeRider(before), settled });
});

// ── Catalogue ──
/** "Amul Taaza Milk 500ml" → "amul-taaza-milk-500ml", made unique with -2, -3… */
async function uniqueSlug(model: typeof Product | typeof Category, text: string) {
  const base =
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'item';
  let slug = base;
  for (let n = 2; await (model as typeof Product).exists({ slug }); n++) slug = `${base}-${n}`;
  return slug;
}

const serializeProduct = (p: { _id: { toString(): string } } & Record<string, unknown>) => ({ ...p, id: p._id.toString(), _id: undefined });

async function assertCategory(slug: string) {
  if (!(await Category.exists({ slug }))) throw badRequest('UNKNOWN_CATEGORY', 'Pick an existing category');
}

admin.get('/categories', async (_req, res) => {
  const [cats, counts] = await Promise.all([
    Category.find().sort({ sortOrder: 1 }).lean(),
    Product.aggregate([{ $group: { _id: '$category', n: { $sum: 1 } } }]),
  ]);
  const n = new Map(counts.map((c) => [c._id as string, c.n as number]));
  res.json(cats.map((c) => ({ slug: c.slug, name: c.name, nameNe: c.nameNe, sortOrder: c.sortOrder, isActive: c.isActive, productCount: n.get(c.slug) ?? 0 })));
});

const categoryBody = z.object({ name: z.string().trim().min(2).max(40), nameNe: z.string().trim().max(40).default('') });

admin.post('/categories', async (req, res) => {
  const body = parse(categoryBody, req.body);
  const last = await Category.findOne().sort({ sortOrder: -1 }).lean();
  const c = await Category.create({ ...body, slug: await uniqueSlug(Category, body.name), sortOrder: (last?.sortOrder ?? -1) + 1, isActive: true });
  res.status(201).json({ slug: c.slug, name: c.name, nameNe: c.nameNe, sortOrder: c.sortOrder, isActive: c.isActive, productCount: 0 });
});

admin.patch('/categories/:slug', async (req, res) => {
  const body = parse(categoryBody.partial().extend({ isActive: z.boolean().optional() }), req.body);
  const c = await Category.findOneAndUpdate({ slug: req.params.slug }, body, { new: true }).lean();
  if (!c) throw notFound('Category');
  res.json({ slug: c.slug, name: c.name, nameNe: c.nameNe, sortOrder: c.sortOrder, isActive: c.isActive });
});

/** Save the order shown in the admin: slugs[0] appears first in the app. */
admin.post('/categories/reorder', async (req, res) => {
  const { slugs } = parse(z.object({ slugs: z.array(z.string()).min(1).max(200) }), req.body);
  await Category.bulkWrite(slugs.map((slug, i) => ({ updateOne: { filter: { slug }, update: { $set: { sortOrder: i } } } })));
  res.json({ ok: true });
});

admin.delete('/categories/:slug', async (req, res) => {
  const inUse = await Product.countDocuments({ category: req.params.slug });
  if (inUse) throw conflict('CATEGORY_NOT_EMPTY', `Move or remove its ${inUse} products first, or just hide the category.`);
  const r = await Category.deleteOne({ slug: req.params.slug });
  if (!r.deletedCount) throw notFound('Category');
  res.json({ ok: true });
});

admin.get('/products', async (_req, res) => {
  const products = await Product.find().sort({ category: 1, name: 1 }).lean();
  res.json(products.map(serializeProduct));
});

const productFields = z.object({
  name: z.string().trim().min(2).max(80),
  category: z.string().min(1),
  unit: z.string().trim().min(1).max(30),
  mrp: z.number().int().min(0),
  price: z.number().int().min(0),
  stock: z.number().int().min(0),
  maxPerOrder: z.number().int().min(1).max(50),
  altNames: z.array(z.string().trim().min(1).max(30)).max(15),
  images: z.array(z.string().startsWith('/')).max(6),
  isActive: z.boolean(),
});

admin.post('/products', async (req, res) => {
  const body = parse(
    productFields.partial({ altNames: true, images: true, isActive: true, maxPerOrder: true }).refine((b) => b.price <= b.mrp, { message: 'Price can’t be more than MRP', path: ['price'] }),
    req.body,
  );
  await assertCategory(body.category);
  const p = await Product.create({ ...body, slug: await uniqueSlug(Product, body.name), maxPerOrder: body.maxPerOrder ?? 10 });
  emitToAdmins('product:updated', { id: p._id.toString() });
  res.status(201).json(serializeProduct(p.toObject()));
});

admin.patch('/products/:id', async (req, res) => {
  const body = parse(productFields.partial(), req.body);
  if (body.category) await assertCategory(body.category);
  const current = await Product.findById(req.params.id).lean();
  if (!current) throw notFound('Product');
  // Check the price/MRP pair as it will be after the edit (only one of them may be sent)
  if ((body.price ?? current.price) > (body.mrp ?? current.mrp)) {
    throw badRequest('VALIDATION', 'Price can’t be more than MRP', { price: ['Price can’t be more than MRP'] });
  }
  const p = await Product.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true }).lean();
  if (!p) throw notFound('Product');
  emitToAdmins('product:updated', { id: p._id.toString() });
  res.json(serializeProduct(p));
});

/** Upload a product photo to ImageKit (the private key never leaves the server). Returns its path. */
admin.post('/uploads', async (req, res) => {
  const { fileName, dataBase64 } = parse(
    z.object({ fileName: z.string().min(1).max(120), dataBase64: z.string().min(100).max(8_000_000) }),
    req.body,
  );
  if (!env.IMAGEKIT_PRIVATE_KEY) throw new HttpError(503, 'UPLOADS_NOT_CONFIGURED', 'ImageKit private key is not set on the server');
  const ext = (fileName.match(/\.(jpe?g|png|webp)$/i)?.[1] ?? '').toLowerCase();
  if (!ext) throw badRequest('BAD_IMAGE', 'Use a JPG, PNG or WEBP photo');
  const form = new FormData();
  form.append('file', dataBase64.replace(/^data:[^,]+,/, ''));
  form.append('fileName', `${Date.now()}.${ext === 'jpeg' ? 'jpg' : ext}`);
  form.append('folder', `${env.IMAGEKIT_FOLDER}/products/uploads`);
  form.append('useUniqueFileName', 'true');
  const r = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${env.IMAGEKIT_PRIVATE_KEY}:`).toString('base64') },
    body: form,
  });
  if (!r.ok) throw new HttpError(502, 'UPLOAD_FAILED', 'Photo upload failed. Please try again.');
  const j = (await r.json()) as { filePath: string };
  res.status(201).json({ path: j.filePath });
});

// ── Store settings ──
admin.get('/store', async (_req, res) => {
  res.json(publicStore(await getStore()));
});

admin.patch('/store', requireOwner, async (req, res) => {
  const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
  const body = parse(
    z
      .object({
        isOpen: z.boolean(),
        closedMessage: z.string().max(160),
        openTime: hhmm,
        closeTime: hhmm,
        serviceRadiusKm: z.number().min(0.5).max(10),
        minOrderValue: z.number().int().min(0),
        deliveryFee: z.number().int().min(0),
        freeDeliveryAbove: z.number().int().min(0),
        handlingFee: z.number().int().min(0),
        baseEtaMin: z.number().int().min(5).max(120),
        supportPhone: z.string().max(20),
        location: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
      })
      .partial(),
    req.body,
  );
  const { location, ...rest } = body;
  // Hours are checked as they'll be after the edit (only one side may be sent). Overnight hours aren't supported.
  if (body.openTime || body.closeTime) {
    const now = await getStore();
    if ((body.openTime ?? now.openTime) >= (body.closeTime ?? now.closeTime)) {
      throw badRequest('VALIDATION', 'Closing time must be after opening time', { closeTime: ['Closing time must be after opening time'] });
    }
  }
  const store = await Store.findOneAndUpdate({}, { ...rest, ...(location && { location: toPoint(location) }) }, { new: true });
  if (!store) throw notFound('Store');
  const pub = publicStore(store);
  emitToAll('store:updated', pub);
  res.json(pub);
});

// Small helper for the "Open/Closed" switch, allowed for STAFF too (e.g. sudden rain)
admin.post('/store/open', async (req, res) => {
  const { isOpen, closedMessage } = parse(z.object({ isOpen: z.boolean(), closedMessage: z.string().max(160).optional() }), req.body);
  const store = await Store.findOneAndUpdate({}, { isOpen, ...(closedMessage !== undefined && { closedMessage }) }, { new: true });
  if (!store) throw notFound('Store');
  const pub = publicStore(store);
  emitToAll('store:updated', pub);
  res.json(pub);
});

// ── Customers ──
admin.get('/customers', async (_req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).limit(200).lean();
  res.json(users.map((u) => ({ id: u._id.toString(), phone: u.phone, name: u.name, isBlocked: u.isBlocked, createdAt: u.createdAt })));
});

/** Lost phone / suspicious login: end all of a customer's sessions (they log in again with OTP within 15 min). */
admin.post('/customers/:id/logout-everywhere', requireOwner, async (req, res) => {
  const u = await User.findByIdAndUpdate(req.params.id, { $inc: { tokenVersion: 1 } }, { new: true }).catch(() => null);
  if (!u) throw notFound('Customer');
  res.json({ ok: true });
});
