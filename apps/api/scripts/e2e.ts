// End-to-end test against a RUNNING API (npm run dev) and the real database.
// Uses a dedicated test customer and cleans up everything it creates.
// Usage (from apps/api): npm run e2e
import mongoose from 'mongoose';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { io, type Socket } from 'socket.io-client';

import { env } from '../src/config/env.js';
import { issueTokens } from '../src/lib/auth.js';
import { Admin, Order, Product, Rider, Store, User } from '../src/models/index.js';
import { checkServiceability } from '../src/services/store.js';

const seedCount = (f: string) => (JSON.parse(readFileSync(new URL(`../seed/${f}`, import.meta.url), 'utf8')) as unknown[]).length;
const BASE = `http://localhost:${env.PORT}`;
const API = `${BASE}/api/v1`;
const TEST_PHONE = '+919999900001';
const SINGTAM = { lat: 27.2345, lng: 88.4995 };
const GANGTOK = { lat: 27.3314, lng: 88.6138 };

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, info?: unknown) {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name}`, info ?? '');
  }
}

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- loose test payloads
async function call(method: string, path: string, body?: unknown, token?: string, headers: Record<string, string> = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Json;
  return { status: res.status, json };
}

const address = (location?: { lat: number; lng: number }) => ({
  label: 'Home',
  house: 'Test house',
  landmark: 'Near Singtam Hospital',
  area: 'Singtam Bazaar',
  directions: 'e2e test',
  ...(location && { location }),
});
const key = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function listen(socket: Socket, events: string[]) {
  const got: { event: string; payload: Json }[] = [];
  for (const e of events) socket.on(e, (payload: Json) => got.push({ event: e, payload }));
  return got;
}

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  const health = await fetch(`${BASE}/health`).then((r) => r.json() as Promise<Json>).catch(() => null);
  if (!health?.ok) throw new Error(`API not running on ${BASE}. Start it with: npm run dev`);

  // Clean slate for the test customer
  const old = await User.findOne({ phone: TEST_PHONE });
  if (old) await Order.deleteMany({ userId: old._id });
  await User.deleteOne({ phone: TEST_PHONE });

  console.log('\nCustomer auth');
  check('send OTP (dev mode)', (await call('POST', '/auth/otp/send', { phone: TEST_PHONE })).json.sent === true);
  check('wrong OTP rejected', (await call('POST', '/auth/otp/verify', { phone: TEST_PHONE, code: '9999' })).status === 400);
  check('invalid phone rejected', (await call('POST', '/auth/otp/send', { phone: '12345' })).status === 400);
  const login = await call('POST', '/auth/otp/verify', { phone: TEST_PHONE, code: '1234' });
  check('OTP 1234 logs in + new user needs name', login.status === 200 && login.json.needsName === true, login.json);
  const ct = login.json.accessToken as string;
  check('GET /me without token → 401', (await call('GET', '/me')).status === 401);
  const me = await call('PATCH', '/me', { name: 'E2E Tester' }, ct);
  check('PATCH /me sets name', me.json.name === 'E2E Tester');
  const relog = await call('POST', '/auth/otp/verify', { phone: TEST_PHONE, code: '1234' });
  check('returning user does not need name', relog.json.needsName === false);
  const refreshed = await call('POST', '/auth/refresh', { refreshToken: login.json.refreshToken });
  check('refresh token issues new access token', typeof refreshed.json.accessToken === 'string');
  // Log out: every refresh token from before stops working; the short-lived access token runs out within 15 min
  const logout = await call('POST', '/auth/logout', { refreshToken: refreshed.json.refreshToken });
  check('logout accepted', logout.status === 200 && logout.json.ok === true, logout.json);
  check('after logout, the refresh token is refused', (await call('POST', '/auth/refresh', { refreshToken: refreshed.json.refreshToken })).status === 401);
  check('…and so are older ones from other logins', (await call('POST', '/auth/refresh', { refreshToken: relog.json.refreshToken })).status === 401);
  const fresh = await call('POST', '/auth/otp/verify', { phone: TEST_PHONE, code: '1234' });
  // An old, already-dead token must not be able to end the new session
  await call('POST', '/auth/logout', { refreshToken: relog.json.refreshToken });
  check('logging in again gives a working session (a stale logout cannot end it)', (await call('POST', '/auth/refresh', { refreshToken: fresh.json.refreshToken })).status === 200);
  check('garbage refresh token → 401', (await call('POST', '/auth/refresh', { refreshToken: 'not-a-token' })).status === 401);
  // Accounts created before tokenVersion existed have no such field saved: logout must still work for them
  await User.updateOne({ phone: TEST_PHONE }, { $unset: { tokenVersion: 1 } });
  const legacy = await call('POST', '/auth/otp/verify', { phone: TEST_PHONE, code: '1234' });
  await call('POST', '/auth/logout', { refreshToken: legacy.json.refreshToken });
  check('logout also works for accounts from before this change', (await call('POST', '/auth/refresh', { refreshToken: legacy.json.refreshToken })).status === 401);
  const fresh2 = await call('POST', '/auth/otp/verify', { phone: TEST_PHONE, code: '1234' });

  console.log('\nStore + catalog');
  const store = (await call('GET', '/store')).json;
  check('store settings', store.name && store.serviceRadiusKm === 3 && store.openTime === '06:00', store);
  const catalog = (await call('GET', '/catalog')).json;
  const [nCat, nProd] = [seedCount('categories.json'), seedCount('products.json')];
  check(`catalog has ${nCat} categories + ${nProd} products`, catalog.categories?.length === nCat && catalog.products?.length === nProd, { got: [catalog.categories?.length, catalog.products?.length] });
  check('product images are ImageKit paths', String(catalog.products?.[0]?.images?.[0]).startsWith('/chito/products/'));
  const near = (await call('POST', '/serviceability/check', SINGTAM)).json;
  check('serviceability near store', near.serviceable === true && near.distanceKm < 1, near);

  // Out-of-range + missing-location rules (pure function, no HTTP). The 3 km rule has no bypass.
  const storeDoc = (await Store.findOne())!;
  const far = checkServiceability(storeDoc, GANGTOK);
  check('Gangtok (≈15 km) is out of range', far.serviceable === false && far.reason === 'OUT_OF_RANGE', far);
  check('no location is not serviceable', checkServiceability(storeDoc).serviceable === false);
  check('Singtam is in range', checkServiceability(storeDoc, SINGTAM).serviceable === true);

  console.log('\nAdmin auth');
  check('wrong admin password → 401', (await call('POST', '/admin/auth/login', { email: process.env.ADMIN_EMAIL, password: 'nope' })).status === 401);
  const adminLogin = await call('POST', '/admin/auth/login', { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
  check('admin login', adminLogin.json.admin?.role === 'OWNER', adminLogin.json);
  const at = adminLogin.json.accessToken as string;
  check('customer token cannot use admin API', (await call('GET', '/admin/orders', undefined, ct)).status === 403);
  const adminRefresh = await call('POST', '/auth/refresh', { refreshToken: adminLogin.json.refreshToken });
  check('admin refresh works (role read from the database)', adminRefresh.status === 200 && typeof adminRefresh.json.accessToken === 'string');
  // Simulate an out-of-date admin session without logging the real owner out
  const adminDoc = (await Admin.findOne({ email: String(process.env.ADMIN_EMAIL).toLowerCase() }))!;
  const staleAdmin = issueTokens({ sub: adminDoc._id.toString(), kind: 'admin', role: 'OWNER' }, adminDoc.tokenVersion + 1).refreshToken;
  check('admin refresh token from another session version → 401', (await call('POST', '/auth/refresh', { refreshToken: staleAdmin })).status === 401);
  const testUser0 = (await User.findOne({ phone: TEST_PHONE }))!;
  check(
    'only the owner can log a customer out everywhere',
    (await call('POST', `/admin/customers/${testUser0._id}/logout-everywhere`, {}, ct)).status === 403,
  );
  check('their session works before the owner steps in', (await call('POST', '/auth/refresh', { refreshToken: fresh2.json.refreshToken })).status === 200);
  check('owner logs a customer out everywhere', (await call('POST', `/admin/customers/${testUser0._id}/logout-everywhere`, {}, at)).json.ok === true);
  check('…their refresh token then stops working', (await call('POST', '/auth/refresh', { refreshToken: fresh2.json.refreshToken })).status === 401);

  // Live sockets
  const adminSock = io(BASE, { auth: { token: at }, transports: ['websocket'] });
  const userSock = io(BASE, { auth: { token: ct }, transports: ['websocket'] });
  const adminEvents = listen(adminSock, ['order:new', 'order:updated', 'rider:updated']);
  const userEvents = listen(userSock, ['order:updated']);
  await sleep(800);
  check('sockets connected', adminSock.connected && userSock.connected);

  console.log('\nOrders: validation');
  const milk = (await Product.findOne({ slug: 'amul-taaza-milk' }))!;
  const atta = (await Product.findOne({ slug: 'aashirvaad-atta' }))!;
  const before = { milk: milk.stock, atta: atta.stock };
  const tooMany = await call('POST', '/orders', { items: [{ slug: 'amul-taaza-milk', qty: 11 }], address: address(SINGTAM), paymentMethod: 'COD' }, ct, { 'Idempotency-Key': key() });
  check('more than max per order rejected', tooMany.json.error?.code === 'MAX_PER_ORDER', tooMany.json);
  // Fees/minimum come from the admin's store settings, so read them instead of assuming
  if (milk.price < store.minOrderValue) {
    const below = await call('POST', '/orders', { items: [{ slug: 'amul-taaza-milk', qty: 1 }], address: address(SINGTAM), paymentMethod: 'COD' }, ct, { 'Idempotency-Key': key() });
    check(`below minimum (₹${milk.price / 100} < ₹${store.minOrderValue / 100}) rejected`, below.json.error?.code === 'BELOW_MINIMUM', below.json);
    check('stock untouched after rejected order', (await Product.findById(milk._id))!.stock === before.milk);
  } else console.log(`  • skipped below-minimum test (minimum order is only ₹${store.minOrderValue / 100})`);
  const farOrder = await call('POST', '/orders', { items: [{ slug: 'aashirvaad-atta', qty: 1 }], address: address(GANGTOK), paymentMethod: 'COD' }, ct, { 'Idempotency-Key': key() });
  check('checkout from Gangtok (15.7 km) rejected, also in test mode', farOrder.json.error?.code === 'OUT_OF_RANGE', farOrder.json);
  const farCheck = (await call('POST', '/serviceability/check', GANGTOK)).json;
  check('serviceability reports true distance + withinRadius=false far away', farCheck.distanceKm > 15 && farCheck.withinRadius === false, farCheck);
  check('missing Idempotency-Key rejected', (await call('POST', '/orders', { items: [{ slug: 'aashirvaad-atta', qty: 1 }], address: address(SINGTAM), paymentMethod: 'COD' }, ct)).status === 400);
  const fakePrice = await call(
    'POST',
    '/orders',
    { items: [{ slug: 'aashirvaad-atta', qty: 1, price: 1 }], address: address(SINGTAM), paymentMethod: 'COD' },
    ct,
    { 'Idempotency-Key': key() },
  );
  check('client price ignored (server price used)', fakePrice.json.items?.[0]?.price === atta.price, fakePrice.json);
  if (fakePrice.json.id) await call('POST', `/orders/${fakePrice.json.id}/cancel`, {}, ct);

  console.log('\nOrders: out of stock + store closed');
  await call('PATCH', `/admin/products/${milk._id}`, { stock: 1 }, at);
  const oos = await call('POST', '/orders', { items: [{ slug: 'amul-taaza-milk', qty: 2 }, { slug: 'aashirvaad-atta', qty: 1 }], address: address(SINGTAM), paymentMethod: 'COD' }, ct, { 'Idempotency-Key': key() });
  check('out of stock → friendly error', oos.json.error?.code === 'OUT_OF_STOCK' && /out of stock/.test(oos.json.error?.message), oos.json);
  check('transaction rolled back (atta stock unchanged)', (await Product.findById(atta._id))!.stock === before.atta);
  await call('PATCH', `/admin/products/${milk._id}`, { stock: before.milk }, at);

  await call('POST', '/admin/store/open', { isOpen: false, closedMessage: 'Heavy rain in Singtam' }, at);
  const closed = await call('POST', '/orders', { items: [{ slug: 'aashirvaad-atta', qty: 1 }], address: address(SINGTAM), paymentMethod: 'COD' }, ct, { 'Idempotency-Key': key() });
  check('store closed → STORE_CLOSED with message', closed.json.error?.code === 'STORE_CLOSED' && closed.json.error.message === 'Heavy rain in Singtam', closed.json);
  check('public store shows closed', (await call('GET', '/store')).json.isOpenNow === false);
  await call('POST', '/admin/store/open', { isOpen: true, closedMessage: '' }, at);

  console.log('\nOrders: place + idempotency');
  const k = key();
  const body = { items: [{ slug: 'aashirvaad-atta', qty: 1 }, { slug: 'amul-taaza-milk', qty: 2 }], address: address(SINGTAM), paymentMethod: 'COD' };
  const placed = await call('POST', '/orders', body, ct, { 'Idempotency-Key': k });
  check('order placed (201)', placed.status === 201 && placed.json.status === 'PLACED', placed.json);
  const o = placed.json;
  const expectedItems = atta.price + 2 * milk.price;
  check('bill computed on server', o.bill?.itemTotal === expectedItems && o.bill.grandTotal === expectedItems + o.bill.deliveryFee + o.bill.handlingFee, o.bill);
  const expectedFee = expectedItems >= store.freeDeliveryAbove ? 0 : store.deliveryFee;
  check(`delivery fee follows settings (free above ₹${store.freeDeliveryAbove / 100})`, o.bill?.deliveryFee === expectedFee, o.bill);
  check('order number format', /^CH-\d{6}$/.test(o.orderNumber));
  const retry = await call('POST', '/orders', body, ct, { 'Idempotency-Key': k });
  check('same Idempotency-Key returns same order', retry.json.id === o.id);
  check('stock decremented once', (await Product.findById(milk._id))!.stock === before.milk - 2 && (await Product.findById(atta._id))!.stock === before.atta - 1);
  check('customer can list + fetch own order', (await call('GET', '/orders', undefined, ct)).json.some((x: Json) => x.id === o.id) && (await call('GET', `/orders/${o.id}`, undefined, ct)).json.id === o.id);
  await sleep(500);
  check('admin socket got order:new', adminEvents.some((e) => e.event === 'order:new' && e.payload.id === o.id));
  check('admin sees order with customer info', (await call('GET', '/admin/orders', undefined, at)).json.find((x: Json) => x.id === o.id)?.customer?.name === 'E2E Tester');

  console.log('\nAdmin: order lifecycle + rider');
  check('cannot jump PLACED → DELIVERED', (await call('PATCH', `/admin/orders/${o.id}/status`, { status: 'DELIVERED' }, at)).status === 409);
  check('confirm', (await call('PATCH', `/admin/orders/${o.id}/status`, { status: 'CONFIRMED' }, at)).json.status === 'CONFIRMED');
  check('pack', (await call('PATCH', `/admin/orders/${o.id}/status`, { status: 'PACKED' }, at)).json.status === 'PACKED');
  check('customer cannot cancel once packed', (await call('POST', `/orders/${o.id}/cancel`, {}, ct)).json.error?.code === 'CANNOT_CANCEL');

  const pemba = (await Rider.findOne({ name: 'Pemba' }))!;
  const riderBefore = { status: pemba.status, cod: pemba.codBalance };
  await call('PATCH', `/admin/riders/${pemba._id}`, { status: 'AVAILABLE' }, at);
  const assigned = await call('POST', `/admin/orders/${o.id}/assign-rider`, { riderId: pemba._id.toString() }, at);
  check('assign rider → OUT_FOR_DELIVERY with rider', assigned.json.status === 'OUT_FOR_DELIVERY' && assigned.json.rider?.name === 'Pemba', assigned.json);
  check('rider now ON_DELIVERY', (await Rider.findById(pemba._id))!.status === 'ON_DELIVERY');
  const delivered = await call('PATCH', `/admin/orders/${o.id}/status`, { status: 'DELIVERED' }, at);
  check('delivered + COD marked paid', delivered.json.status === 'DELIVERED' && delivered.json.paymentStatus === 'PAID');
  const pembaAfter = (await Rider.findById(pemba._id))!;
  check('rider back to AVAILABLE', pembaAfter.status === 'AVAILABLE');
  check('COD added to rider balance', pembaAfter.codBalance === riderBefore.cod + o.bill.grandTotal, { cod: pembaAfter.codBalance });
  const settled = await call('POST', `/admin/riders/${pemba._id}/settle-cod`, {}, at);
  check('settle COD', settled.json.codBalance === 0 && settled.json.settled === riderBefore.cod + o.bill.grandTotal);
  check('cannot change a delivered order', (await call('PATCH', `/admin/orders/${o.id}/status`, { status: 'PACKED' }, at)).status === 409);
  await sleep(500);
  check('customer socket got live updates', userEvents.filter((e) => e.payload.id === o.id).length >= 4, userEvents.length);
  const stats = (await call('GET', '/admin/stats/today', undefined, at)).json;
  check('today stats count the delivery', stats.delivered >= 1 && stats.revenue >= o.bill.grandTotal, stats);
  const report = (await call('GET', '/admin/reports/day', undefined, at)).json;
  check(
    'day report lists the order and counts its cash',
    report.orders?.some((x: Json) => x.id === o.id) && report.cash.collected >= o.bill.grandTotal && report.riders.some((r: Json) => r.cash >= o.bill.grandTotal),
    report.cash,
  );
  check('day report rejects a bad date', (await call('GET', '/admin/reports/day?date=06-10-2026', undefined, at)).status === 400);

  console.log('\nCancel restores stock');
  const milkNow = (await Product.findById(milk._id))!.stock;
  const c = await call('POST', '/orders', { items: [{ slug: 'amul-taaza-milk', qty: 4 }], address: address(SINGTAM), paymentMethod: 'COD' }, ct, { 'Idempotency-Key': key() });
  check('second order placed', c.status === 201, c.json);
  check('stock went down by 4', (await Product.findById(milk._id))!.stock === milkNow - 4);
  const cancelled = await call('POST', `/orders/${c.json.id}/cancel`, {}, ct);
  check('customer cancel while PLACED', cancelled.json.status === 'CANCELLED');
  check('stock restored', (await Product.findById(milk._id))!.stock === milkNow);
  const adminCancel = await call('POST', '/orders', { items: [{ slug: 'aashirvaad-atta', qty: 1 }], address: address(SINGTAM), paymentMethod: 'COD' }, ct, { 'Idempotency-Key': key() });
  check('admin cancel needs a reason', (await call('POST', `/admin/orders/${adminCancel.json.id}/cancel`, {}, at)).status === 400);
  check('admin cancel with reason', (await call('POST', `/admin/orders/${adminCancel.json.id}/cancel`, { reason: 'Customer asked' }, at)).json.status === 'CANCELLED');

  console.log('\nOnline payment (Razorpay test mode) + ordering for someone else');
  const attaBeforeOnline = (await Product.findById(atta._id))!.stock;
  const momAddress = { ...address(SINGTAM), label: "Mom's house", recipientName: 'Mom', recipientPhone: '+919800000001' };
  const EXPO_RETURN = 'exp://192.168.1.5:8081/--/payment-return/ORDER_ID';
  const evil = await call('POST', '/orders', { items: [{ slug: 'aashirvaad-atta', qty: 1 }], address: momAddress, paymentMethod: 'ONLINE', returnUrl: 'https://evil.example/ORDER_ID' }, ct, { 'Idempotency-Key': key() });
  check('return link must be our app (no open redirect)', evil.status === 400, evil.json);
  const on = await call('POST', '/orders', { items: [{ slug: 'aashirvaad-atta', qty: 1 }], address: momAddress, paymentMethod: 'ONLINE', returnUrl: EXPO_RETURN }, ct, { 'Idempotency-Key': key() });
  check('online order waits for payment with a Razorpay link', on.status === 201 && on.json.status === 'PAYMENT_PENDING' && /^https:\/\//.test(on.json.payment?.url ?? ''), on.json);
  check('recipient (Mom) saved on the order', on.json.address?.recipientName === 'Mom' && on.json.address?.recipientPhone === '+919800000001' && on.json.address?.label === "Mom's house");
  check('stock held while paying', (await Product.findById(atta._id))!.stock === attaBeforeOnline - 1);
  await sleep(400);
  check('store NOT alerted before payment', !adminEvents.some((e) => e.event === 'order:new' && e.payload.id === on.json.id));
  check('unpaid order not on admin board', !(await call('GET', '/admin/orders', undefined, at)).json.some((x: Json) => x.id === on.json.id));
  const stillWaiting = await call('POST', `/orders/${on.json.id}/payment/refresh`, {}, ct);
  check('payment status check: still waiting (nobody paid yet)', stillWaiting.json.status === 'PAYMENT_PENDING', stillWaiting.json);

  const linkId = (await Order.findById(on.json.id))!.payment!.linkId;
  const cb = (sig: string) =>
    `${BASE}/api/v1/payments/razorpay/callback?razorpay_payment_id=pay_e2eTest&razorpay_payment_link_id=${linkId}&razorpay_payment_link_reference_id=${on.json.orderNumber}&razorpay_payment_link_status=paid&razorpay_signature=${sig}`;
  const forged = await fetch(cb('deadbeefdeadbeef'));
  check('forged "paid" callback rejected', forged.status === 400 && (await Order.findById(on.json.id))!.status === 'PAYMENT_PENDING');
  const sig = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!).update(`${linkId}|${on.json.orderNumber}|paid|pay_e2eTest`).digest('hex');
  const good = await fetch(cb(sig));
  const goodHtml = await good.text();
  const paidOrder = (await Order.findById(on.json.id))!;
  check('correctly signed callback → order PLACED + PAID', good.status === 200 && paidOrder.status === 'PLACED' && paidOrder.paymentStatus === 'PAID', { s: paidOrder.status, p: paidOrder.paymentStatus });
  check('result page sends the customer back to the app (Expo Go link)', goodHtml.includes(`exp://192.168.1.5:8081/--/payment-return/${on.json.id}`));
  check('repeat callback is harmless', (await fetch(cb(sig))).status === 200 && (await Order.findById(on.json.id))!.statusHistory.length === 2);
  await sleep(400);
  check('store alerted once paid', adminEvents.some((e) => e.event === 'order:new' && e.payload.id === on.json.id));
  check('admin sees who receives it', (await call('GET', '/admin/orders', undefined, at)).json.find((x: Json) => x.id === on.json.id)?.address?.recipientName === 'Mom');
  const paidCancel = await call('POST', `/admin/orders/${on.json.id}/cancel`, { reason: 'e2e' }, at);
  // The fake payment id can't really be refunded, so REFUND_FAILED is the expected honest result here
  check('cancelling a paid order attempts a refund', paidCancel.json.status === 'CANCELLED' && ['REFUNDED', 'REFUND_FAILED'].includes(paidCancel.json.paymentStatus), paidCancel.json);
  check('stock restored after cancel', (await Product.findById(atta._id))!.stock === attaBeforeOnline);

  const on2 = await call('POST', '/orders', { items: [{ slug: 'aashirvaad-atta', qty: 1 }], address: momAddress, paymentMethod: 'ONLINE' }, ct, { 'Idempotency-Key': key() });
  const c2 = await call('POST', `/orders/${on2.json.id}/cancel`, {}, ct);
  check('customer can cancel an unpaid online order', c2.json.status === 'CANCELLED' && c2.json.paymentStatus === 'PENDING', c2.json);
  check('…and its stock is released', (await Product.findById(atta._id))!.stock === attaBeforeOnline);
  const badPhone = await call('POST', '/orders', { items: [{ slug: 'aashirvaad-atta', qty: 1 }], address: { ...momAddress, recipientPhone: '12345' }, paymentMethod: 'COD' }, ct, { 'Idempotency-Key': key() });
  check('invalid recipient phone rejected', badPhone.status === 400, badPhone.json);

  console.log('\nShared locations (WhatsApp / Google Maps)');
  const geo = (text: string) => call('POST', '/geo/resolve', { text }, ct);
  const g1 = await geo('27.2361, 88.5012');
  check('plain coordinates', g1.json.location?.lat === 27.2361 && g1.json.location?.lng === 88.5012 && g1.json.serviceable === true, g1.json);
  const g2 = await geo('Mom: https://maps.google.com/?q=27.2361,88.5012');
  check('WhatsApp-style location link', g2.json.location?.lat === 27.2361, g2.json);
  const g3 = await geo('https://www.google.com/maps/place/Gangtok/@27.33,88.61,15z/data=!3d27.3314!4d88.6138');
  check('Google Maps place link (pin, not map centre) + true distance', g3.json.location?.lat === 27.3314 && g3.json.distanceKm > 15 && g3.json.withinRadius === false, g3.json);
  check('text without a location rejected', (await geo('near the temple')).json.error?.code === 'NO_COORDINATES');
  check('unknown website never fetched', (await geo('https://example.com/maps?x=1')).json.error?.code === 'NO_COORDINATES');

  // ── Cleanup: remove test data, restore stock + rider ──
  adminSock.close();
  userSock.close();
  const testUser = await User.findOne({ phone: TEST_PHONE });
  await Order.deleteMany({ userId: testUser?._id });
  await User.deleteOne({ phone: TEST_PHONE });
  await Product.updateOne({ _id: milk._id }, { stock: before.milk });
  await Product.updateOne({ _id: atta._id }, { stock: before.atta });
  await Rider.updateOne({ _id: pemba._id }, { status: riderBefore.status, codBalance: riderBefore.cod });
  await mongoose.disconnect();

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log('Failed:\n - ' + failures.join('\n - '));
    process.exit(1);
  }
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect();
  process.exit(1);
});
