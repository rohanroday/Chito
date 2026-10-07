// Edge-case + abuse tests against a RUNNING API (npm run dev) and the real database.
// Creates its own test customer, rider, category and product, and removes all of them at the end.
// Usage (from apps/api): npm run edge
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

import { env } from '../src/config/env.js';
import { Category, Order, Product, Rider, Store, User } from '../src/models/index.js';

const BASE = `http://localhost:${env.PORT}`;
const API = `${BASE}/api/v1`;
const PHONE = '+919999900002';
const OTHER_PHONE = '+919999900009';
const SINGTAM = { lat: 27.2345, lng: 88.4995 };

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, info?: unknown) {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name}`, info === undefined ? '' : JSON.stringify(info).slice(0, 300));
  }
}

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- loose test payloads
async function raw(method: string, path: string, body?: string, token?: string, headers: Record<string, string> = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }), ...headers },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as Json;
  return { status: res.status, json };
}
const call = (method: string, path: string, body?: unknown, token?: string, headers: Record<string, string> = {}) =>
  raw(method, path, body === undefined ? undefined : JSON.stringify(body), token, headers);

const key = () => `edge-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const address = (location?: { lat: number; lng: number }) => ({
  label: 'Home',
  house: 'Edge house',
  landmark: 'Near Singtam Hospital',
  area: 'Singtam Bazaar',
  ...(location && { location }),
});
const order = (token: string, items: { slug: string; qty: number }[], extra: Json = {}, idem = key()) =>
  call('POST', '/orders', { items, address: address(SINGTAM), paymentMethod: 'COD', ...extra }, token, { 'Idempotency-Key': idem });

async function login(phone: string) {
  const r = await call('POST', '/auth/otp/verify', { phone, code: '1234' });
  return r.json as { accessToken: string; refreshToken: string; user: { id: string } };
}

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  const health = await fetch(`${BASE}/health`).then((r) => r.json() as Promise<Json>).catch(() => null);
  if (!health?.ok) throw new Error(`API not running on ${BASE}. Start it with: npm run dev`);

  const storeBefore = (await Store.findOne().lean())!;
  const created = { categorySlug: '', productId: '', riderId: '' };

  try {
    // ── Setup ──
    for (const p of [PHONE, OTHER_PHONE]) {
      const u = await User.findOne({ phone: p });
      if (u) await Order.deleteMany({ userId: u._id });
      await User.deleteOne({ phone: p });
    }
    const me = await login(PHONE);
    await call('PATCH', '/me', { name: 'Edge Tester' }, me.accessToken);
    const other = await login(OTHER_PHONE);
    const adminLogin = await call('POST', '/admin/auth/login', { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
    const at = adminLogin.json.accessToken as string;
    const ct = me.accessToken;

    const cat = await call('POST', '/admin/categories', { name: 'Edge Test Aisle' }, at);
    created.categorySlug = cat.json.slug;
    const prod = await call('POST', '/admin/products', { name: 'Edge Test Ghee', category: cat.json.slug, unit: '1 kg', mrp: 60000, price: 55000, stock: 1, maxPerOrder: 5 }, at);
    created.productId = prod.json.id;
    const slug = prod.json.slug as string;
    const rider = await call('POST', '/admin/riders', { name: 'Edge Rider', phone: '+919999900077' }, at);
    created.riderId = rider.json.id;
    await call('PATCH', `/admin/riders/${created.riderId}`, { status: 'AVAILABLE' }, at);
    check('setup: category, product, rider created', !!created.categorySlug && !!created.productId && !!created.riderId, { cat: cat.json, prod: prod.json, rider: rider.json });

    console.log('\nRequests the server must answer cleanly (no 500s)');
    const bad = await raw('POST', '/auth/otp/verify', '{"phone": "+9199', undefined);
    check('broken JSON → 400', bad.status === 400 && bad.json.error?.code === 'BAD_JSON', bad);
    const big = await raw('POST', '/auth/otp/verify', JSON.stringify({ phone: 'x'.repeat(300_000) }));
    check('oversized body → 413', big.status === 413, big);
    check('unknown route → 404', (await call('GET', '/nope')).status === 404);
    check('order with a malformed id → 404', (await call('GET', '/orders/not-an-id', undefined, ct)).status === 404);
    for (const [label, method, path, body] of [
      ['advance order', 'PATCH', '/admin/orders/not-an-id/status', { status: 'CONFIRMED' }],
      ['assign rider', 'POST', '/admin/orders/not-an-id/assign-rider', { riderId: 'also-bad' }],
      ['cancel order', 'POST', '/admin/orders/not-an-id/cancel', { reason: 'test' }],
      ['edit product', 'PATCH', '/admin/products/not-an-id', { price: 100 }],
      ['edit rider', 'PATCH', '/admin/riders/not-an-id', { name: 'Xy' }],
      ['settle rider cash', 'POST', '/admin/riders/not-an-id/settle-cod', {}],
      ['log customer out', 'POST', '/admin/customers/not-an-id/logout-everywhere', {}],
    ] as const) {
      const r = await call(method, path, body, at);
      check(`admin ${label} with a malformed id → 404`, r.status === 404, r);
    }
    const inj = await call('POST', '/auth/otp/verify', { phone: { $gt: '' }, code: '1234' });
    check('NoSQL-injection phone rejected', inj.status === 400, inj);
    check('orders without login → 401', (await call('GET', '/orders')).status === 401);
    check('admin token on customer orders → 403', (await call('GET', '/orders', undefined, at)).status === 403);
    const forged = jwt.sign({ sub: me.user.id, kind: 'customer' }, 'not-the-real-secret-not-the-real-secret');
    check('token signed with a wrong secret → 401', (await call('GET', '/me', undefined, forged)).status === 401);
    check('refresh token used as access token → 401', (await call('GET', '/me', undefined, me.refreshToken)).status === 401);
    check('access token used as refresh token → 401', (await call('POST', '/auth/refresh', { refreshToken: ct })).status === 401);
    const xss = await call('PATCH', '/me', { name: '<script>alert(1)</script>' }, ct);
    check('HTML in a name is stored as plain text', xss.json.name === '<script>alert(1)</script>');
    await call('PATCH', '/me', { name: 'Edge Tester' }, ct);

    console.log('\nOrder rules');
    const atta = (await Product.findOne({ slug: 'aashirvaad-atta' }))!;
    const attaStock = atta.stock;
    check('qty 0 rejected', (await order(ct, [{ slug: 'aashirvaad-atta', qty: 0 }])).status === 400);
    check('qty 51 rejected', (await order(ct, [{ slug: 'aashirvaad-atta', qty: 51 }])).status === 400);
    check('decimal qty rejected', (await order(ct, [{ slug: 'aashirvaad-atta', qty: 1.5 }])).status === 400);
    check('empty jhola rejected', (await order(ct, [])).status === 400);
    const unknown = await order(ct, [{ slug: 'no-such-thing', qty: 1 }]);
    check('unknown product → PRODUCT_UNAVAILABLE', unknown.json.error?.code === 'PRODUCT_UNAVAILABLE', unknown);
    const split = await order(ct, [
      { slug: 'aashirvaad-atta', qty: atta.maxPerOrder },
      { slug: 'aashirvaad-atta', qty: 1 },
    ]);
    check('splitting a line can’t beat the per-order limit', split.json.error?.code === 'MAX_PER_ORDER', split);
    const tampered = await call(
      'POST',
      '/orders',
      { items: [{ slug: 'aashirvaad-atta', qty: 1, price: 1 }], address: address(SINGTAM), paymentMethod: 'COD', bill: { grandTotal: 1 } },
      ct,
      { 'Idempotency-Key': key() },
    );
    check('prices sent by the app are ignored', tampered.status === 201 && tampered.json.items?.[0]?.price === atta.price, tampered);
    if (tampered.json.id) await call('POST', `/orders/${tampered.json.id}/cancel`, {}, ct);
    for (const [label, loc] of [
      ['latitude 387 (wraps round to Singtam)', { lat: SINGTAM.lat + 360, lng: SINGTAM.lng }],
      ['longitude 448', { lat: SINGTAM.lat, lng: SINGTAM.lng + 360 }],
    ] as const) {
      const r = await call('POST', '/orders', { items: [{ slug: 'aashirvaad-atta', qty: 1 }], address: address(loc), paymentMethod: 'COD' }, ct, { 'Idempotency-Key': key() });
      check(`impossible location (${label}) rejected`, r.status === 400, r);
    }
    const noLoc = await call('POST', '/orders', { items: [{ slug: 'aashirvaad-atta', qty: 1 }], address: address(), paymentMethod: 'COD' }, ct, { 'Idempotency-Key': key() });
    check('no location → LOCATION_REQUIRED', noLoc.json.error?.code === 'LOCATION_REQUIRED', noLoc);
    const shortLandmark = await call('POST', '/orders', { items: [{ slug: 'aashirvaad-atta', qty: 1 }], address: { ...address(SINGTAM), landmark: '  ' }, paymentMethod: 'COD' }, ct, { 'Idempotency-Key': key() });
    check('blank landmark rejected', shortLandmark.status === 400);
    check('missing Idempotency-Key rejected', (await call('POST', '/orders', { items: [{ slug: 'aashirvaad-atta', qty: 1 }], address: address(SINGTAM), paymentMethod: 'COD' }, ct)).status === 400);
    check('atta stock untouched by all the rejected orders', (await Product.findById(atta._id))!.stock === attaStock);

    // Hidden category: its products disappear from the app AND can't be ordered
    await call('PATCH', `/admin/categories/${created.categorySlug}`, { isActive: false }, at);
    const hiddenCat = await order(ct, [{ slug, qty: 1 }]);
    check('product in a hidden category can’t be ordered', hiddenCat.json.error?.code === 'PRODUCT_UNAVAILABLE', hiddenCat);
    const cat2 = (await call('GET', '/catalog')).json;
    check('…and isn’t in the catalogue', !cat2.products.some((p: Json) => p.slug === slug));
    await call('PATCH', `/admin/categories/${created.categorySlug}`, { isActive: true }, at);

    console.log('\nTwo people, one last item');
    const [a, b] = await Promise.all([order(ct, [{ slug, qty: 1 }]), order(other.accessToken, [{ slug, qty: 1 }])]);
    const wins = [a, b].filter((r) => r.status === 201).length;
    const loser = [a, b].find((r) => r.status !== 201);
    check('exactly one of two simultaneous orders gets the last item', wins === 1, [a.status, b.status]);
    check('the other gets a clear "out of stock"', loser?.json.error?.code === 'OUT_OF_STOCK', loser);
    check('stock never goes below zero', (await Product.findById(created.productId))!.stock === 0);
    const winner = a.status === 201 ? a : b;

    console.log('\nSame order sent twice at once (double tap / flaky network)');
    await call('PATCH', `/admin/products/${created.productId}`, { stock: 10 }, at);
    const idem = key();
    const [d1, d2] = await Promise.all([order(ct, [{ slug, qty: 1 }], {}, idem), order(ct, [{ slug, qty: 1 }], {}, idem)]);
    check('both requests succeed', d1.status === 201 && d2.status === 201, [d1.status, d2.status, d1.json.error, d2.json.error]);
    check('…with the same order', !!d1.json.id && d1.json.id === d2.json.id, [d1.json.id, d2.json.id]);
    check('only one order and one stock decrement', (await Order.countDocuments({ idempotencyKey: idem })) === 1 && (await Product.findById(created.productId))!.stock === 9);
    const other404 = await call('POST', `/orders/${d1.json.id}/cancel`, {}, other.accessToken);
    check('another customer can’t cancel your order', other404.status === 404, other404);
    check('…or see it', (await call('GET', `/orders/${d1.json.id}`, undefined, other.accessToken)).status === 404);

    console.log('\nStore closed');
    try {
      await call('POST', '/admin/store/open', { isOpen: false, closedMessage: 'Edge test: landslide' }, at);
      const closed = await order(ct, [{ slug, qty: 1 }]);
      check('ordering while closed → STORE_CLOSED with the message', closed.json.error?.code === 'STORE_CLOSED' && /landslide/.test(closed.json.error?.message ?? ''), closed);
    } finally {
      await call('POST', '/admin/store/open', { isOpen: storeBefore.isOpen, closedMessage: storeBefore.closedMessage ?? '' }, at);
    }

    console.log('\nAdmin double clicks');
    const o = d1.json.id as string;
    await call('PATCH', `/admin/orders/${o}/status`, { status: 'CONFIRMED' }, at);
    await call('PATCH', `/admin/orders/${o}/status`, { status: 'PACKED' }, at);
    const [as1, as2] = await Promise.all([
      call('POST', `/admin/orders/${o}/assign-rider`, { riderId: created.riderId }, at),
      call('POST', `/admin/orders/${o}/assign-rider`, { riderId: created.riderId }, at),
    ]);
    check('assigning the same order twice at once: one works, one is refused', [as1.status, as2.status].sort().join() === '200,409', [as1.status, as2.status]);
    const cashBefore = (await Rider.findById(created.riderId))!.codBalance;
    const [dl1, dl2] = await Promise.all([
      call('PATCH', `/admin/orders/${o}/status`, { status: 'DELIVERED' }, at),
      call('PATCH', `/admin/orders/${o}/status`, { status: 'DELIVERED' }, at),
    ]);
    const cashAfter = (await Rider.findById(created.riderId))!.codBalance;
    check('double-click "Delivered": one works, one is refused', [dl1.status, dl2.status].sort().join() === '200,409', [dl1.status, dl2.status]);
    check('…and the rider’s cash is counted once', cashAfter - cashBefore === d1.json.bill.grandTotal, { cashBefore, cashAfter, bill: d1.json.bill.grandTotal });
    const settle = await call('POST', `/admin/riders/${created.riderId}/settle-cod`, {}, at);
    check('settle cash returns what was collected and zeroes it', settle.json.settled === cashAfter && settle.json.codBalance === 0, settle.json);
    check('a delivered order can’t be cancelled', (await call('POST', `/admin/orders/${o}/cancel`, { reason: 'late' }, at)).status === 409);

    console.log('\nAdmin input rules');
    const pricey = await call('PATCH', `/admin/products/${created.productId}`, { price: 70000 }, at);
    check('editing price above MRP rejected', pricey.status === 400, pricey);
    const lowMrp = await call('PATCH', `/admin/products/${created.productId}`, { mrp: 100 }, at);
    check('editing MRP below price rejected', lowMrp.status === 400, lowMrp);
    const both = await call('PATCH', `/admin/products/${created.productId}`, { mrp: 50000, price: 45000 }, at);
    check('editing both together still works', both.status === 200 && both.json.price === 45000, both);
    const hours = await call('PATCH', '/admin/store', { openTime: '22:00', closeTime: '06:00' }, at);
    check('closing time before opening time rejected', hours.status === 400, hours);
    const oneSide = await call('PATCH', '/admin/store', { closeTime: '05:00' }, at);
    check('…also when only one side is changed', oneSide.status === 400, oneSide);
    check('store hours unchanged', (await Store.findOne().lean())!.closeTime === storeBefore.closeTime);
    check('deleting a category that has products → 409', (await call('DELETE', `/admin/categories/${created.categorySlug}`, undefined, at)).status === 409);
    check('reorder with an unknown slug doesn’t crash', (await call('POST', '/admin/categories/reorder', { slugs: ['no-such-aisle'] }, at)).status === 200);
    check('report for 31 Feb → 400', (await call('GET', '/admin/reports/day?date=2026-02-31', undefined, at)).status === 400);
    check('customer can’t reach admin reports', (await call('GET', '/admin/reports/day', undefined, ct)).status === 403);

    console.log('\nPassword guessing');
    const fakeEmail = `guess-${Date.now()}@example.com`;
    const tries: number[] = [];
    for (let i = 0; i < 12; i++) tries.push((await call('POST', '/admin/auth/login', { email: fakeEmail, password: `wrong${i}` })).status);
    check('admin login stops answering after repeated wrong passwords (429)', tries.includes(429), tries);
    check('…the first few tries get the normal "wrong password"', tries[0] === 401);
    const otpTries: number[] = [];
    for (let i = 0; i < 12; i++) otpTries.push((await call('POST', '/auth/otp/verify', { phone: '+919999900055', code: '0000' })).status);
    check('OTP guessing is slowed down too (429)', otpTries.includes(429), otpTries);

    void winner;
  } finally {
    // ── Cleanup (also after a crash): give back stock held by test orders, then delete them ──
    for (const p of [PHONE, OTHER_PHONE, '+919999900055']) {
      const u = await User.findOne({ phone: p });
      if (u) {
        for (const o of await Order.find({ userId: u._id, status: { $ne: 'CANCELLED' } })) {
          for (const it of o.items) await Product.updateOne({ slug: it.slug }, { $inc: { stock: it.qty ?? 0 } });
        }
        await Order.deleteMany({ userId: u._id });
      }
      await User.deleteOne({ phone: p });
    }
    if (created.productId) await Product.deleteOne({ _id: created.productId });
    if (created.categorySlug) await Category.deleteOne({ slug: created.categorySlug });
    if (created.riderId) await Rider.deleteOne({ _id: created.riderId });
    await Store.updateOne({}, { isOpen: storeBefore.isOpen, closedMessage: storeBefore.closedMessage, openTime: storeBefore.openTime, closeTime: storeBefore.closeTime });
    // Category order may have been touched by the reorder test: put the real order back
    const cats = await Category.find().sort({ sortOrder: 1 });
    await Category.bulkWrite(cats.map((c, i) => ({ updateOne: { filter: { _id: c._id }, update: { $set: { sortOrder: i } } } })));
    await mongoose.disconnect();
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log('Failed:\n - ' + failures.join('\n - '));
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
