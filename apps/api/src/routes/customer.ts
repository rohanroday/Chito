import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';

import { env } from '../config/env.js';
import { issueTokens, requireCustomer, userId, verifyRefresh } from '../lib/auth.js';
import { badRequest, HttpError, notFound, parse, unauthorized } from '../lib/http.js';
import { checkOtp, phoneSchema } from '../lib/otp.js';
import { Admin, Category, Order, Otp, Product, Rider, User } from '../models/index.js';
import { resolveSharedLocation } from '../lib/maplink.js';
import {
  cancelOrder,
  confirmCheckoutRedirect,
  createOrder,
  markOrderPaid,
  markRzpOrderPaid,
  refreshOnlinePayment,
  serializeOrder,
  startCheckout,
  verifyCheckout,
} from '../services/orders.js';
import { verifyCallbackSignature, verifyWebhookSignature } from '../services/razorpay.js';
import { checkServiceability, getStore, publicStore } from '../services/store.js';

export const customer = Router();

const OTP_TTL_MS = 5 * 60 * 1000;

// ── Auth (phone + OTP) ──
customer.post('/auth/otp/send', async (req, res) => {
  const { phone } = parse(z.object({ phone: phoneSchema }), req.body);
  if (env.OTP_DEV_MODE) {
    res.json({ sent: true, devMode: true });
    return;
  }
  const recent = await Otp.countDocuments({ phone, createdAt: { $gt: new Date(Date.now() - 10 * 60 * 1000) } });
  if (recent >= 3) throw new HttpError(429, 'TOO_MANY_OTPS', 'Too many OTP requests. Try again in 10 minutes.');
  const code = String(randomInt(1000, 10000));
  await Otp.create({ phone, codeHash: await bcrypt.hash(code, 8), expiresAt: new Date(Date.now() + OTP_TTL_MS) });
  // TODO(msg91): send `code` via MSG91 using MSG91_AUTH_KEY + DLT template MSG91_OTP_TEMPLATE_ID
  throw new HttpError(503, 'SMS_NOT_CONFIGURED', 'SMS is not set up yet. Turn on OTP_DEV_MODE for testing.');
});

customer.post('/auth/otp/verify', async (req, res) => {
  const { phone, code } = parse(z.object({ phone: phoneSchema, code: z.string().regex(/^\d{4}$/) }), req.body);
  await checkOtp(phone, code);
  const user = await User.findOneAndUpdate({ phone }, { $setOnInsert: { phone } }, { upsert: true, returnDocument: 'after' });
  if (user.isBlocked) throw new HttpError(403, 'BLOCKED', 'Your account is blocked. Please contact Chito.');
  res.json({
    user: { id: user._id.toString(), phone: user.phone, name: user.name },
    needsName: !user.name,
    ...issueTokens({ sub: user._id.toString(), kind: 'customer' }, user.tokenVersion),
  });
});

customer.post('/auth/refresh', async (req, res) => {
  const { refreshToken } = parse(z.object({ refreshToken: z.string() }), req.body);
  const c = readRefresh(refreshToken);
  // Re-check the account every time: deleted, blocked or logged-out sessions can't renew
  // (the app then shows the login screen). Tokens from before tokenVersion existed count as version 0.
  if (c.kind === 'customer') {
    const u = await User.findById(c.sub).catch(() => null);
    if (!u || u.isBlocked || (c.ver ?? 0) !== u.tokenVersion) throw unauthorized();
    res.json(issueTokens({ sub: c.sub, kind: 'customer' }, u.tokenVersion));
  } else if (c.kind === 'rider') {
    // A rider the store removed (or made inactive) can't keep using the rider app
    const r = await Rider.findById(c.sub).catch(() => null);
    if (!r || !r.isActive || (c.ver ?? 0) !== (r.tokenVersion ?? 0)) throw unauthorized();
    res.json(issueTokens({ sub: c.sub, kind: 'rider' }, r.tokenVersion ?? 0));
  } else {
    const a = await Admin.findById(c.sub).catch(() => null);
    if (!a || (c.ver ?? 0) !== a.tokenVersion) throw unauthorized();
    // Role comes from the database, so a demoted admin loses owner rights on the next refresh
    res.json(issueTokens({ sub: c.sub, kind: 'admin', role: a.role as 'OWNER' | 'STAFF' }, a.tokenVersion));
  }
});

/** Log out: ends this session and every other one on other devices (all older refresh tokens stop working). */
customer.post('/auth/logout', async (req, res) => {
  const { refreshToken } = parse(z.object({ refreshToken: z.string() }), req.body);
  const c = readRefresh(refreshToken);
  const Model = c.kind === 'admin' ? Admin : c.kind === 'rider' ? Rider : User;
  // Only the session that's still current can end it (an old token can't log someone out).
  // Accounts from before tokenVersion existed have no field saved yet; that counts as version 0.
  const ver = c.ver ?? 0;
  await (Model as typeof User)
    .updateOne({ _id: c.sub, tokenVersion: ver === 0 ? { $in: [0, null] } : ver }, { $inc: { tokenVersion: 1 } })
    .catch(() => null);
  res.json({ ok: true });
});

function readRefresh(token: string) {
  try {
    return verifyRefresh(token);
  } catch {
    throw unauthorized('Session expired');
  }
}

// ── Me ──
customer.get('/me', requireCustomer, async (req, res) => {
  const u = await User.findById(userId(req));
  if (!u) throw unauthorized(); // account was removed
  res.json({ id: u._id.toString(), phone: u.phone, name: u.name });
});

customer.patch('/me', requireCustomer, async (req, res) => {
  const body = parse(z.object({ name: z.string().trim().min(2).max(40) }), req.body);
  const u = await User.findByIdAndUpdate(userId(req), body, { returnDocument: 'after' });
  if (!u) throw unauthorized(); // account was removed
  res.json({ id: u._id.toString(), phone: u.phone, name: u.name });
});

// ── Saved addresses (per account, so each customer only ever sees their own) ──
const savedAddressBody = z.object({
  id: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1).max(30),
  recipientName: z.string().trim().max(40).default(''),
  recipientPhone: z.union([z.literal(''), z.string().regex(/^\+91[6-9]\d{9}$/)]).default(''),
  house: z.string().max(120).default(''),
  landmark: z.string().trim().max(160).default(''),
  area: z.string().trim().max(80).default(''),
  directions: z.string().max(300).default(''),
  location: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).nullish(),
});

async function addressesOf(id: string) {
  const u = await User.findById(id, { savedAddresses: 1, selectedAddressId: 1 }).lean();
  if (!u) throw unauthorized(); // account was removed
  return { addresses: u.savedAddresses ?? [], selectedId: u.selectedAddressId ?? null };
}

customer.get('/me/addresses', requireCustomer, async (req, res) => {
  res.json(await addressesOf(userId(req)));
});

/** Replace the whole list (the app sends it after every add/edit/delete/select). */
customer.put('/me/addresses', requireCustomer, async (req, res) => {
  const body = parse(z.object({ addresses: z.array(savedAddressBody).max(20), selectedId: z.string().max(40).nullable() }), req.body);
  const store = await getStore();
  // Distance and deliverability are measured here, never taken from the app
  const addresses = body.addresses.map((a) => {
    const check = a.location ? checkServiceability(store, a.location) : null;
    return { ...a, location: a.location ?? null, distanceKm: check?.distanceKm ?? 0, serviceable: check?.serviceable ?? false };
  });
  const selectedId = addresses.some((a) => a.id === body.selectedId) ? body.selectedId : (addresses[0]?.id ?? null);
  const u = await User.findByIdAndUpdate(userId(req), { savedAddresses: addresses, selectedAddressId: selectedId }, { returnDocument: 'after' });
  if (!u) throw unauthorized();
  res.json({ addresses, selectedId });
});

// ── Store + serviceability (public) ──
customer.get('/store', async (_req, res) => {
  res.json(publicStore(await getStore()));
});

customer.post('/serviceability/check', async (req, res) => {
  const at = parse(z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }), req.body);
  const store = await getStore();
  res.json({ ...checkServiceability(store, at), radiusKm: store.serviceRadiusKm });
});

// ── Catalogue (public; small enough to send in one go) ──
customer.get('/catalog', async (_req, res) => {
  const [categories, products] = await Promise.all([
    Category.find({ isActive: true }).sort({ sortOrder: 1 }).lean(),
    Product.find({ isActive: true }).sort({ name: 1 }).lean(),
  ]);
  // Products in a hidden category are hidden too
  const visible = new Set(categories.map((c) => c.slug));
  res.json({
    categories: categories.map((c) => ({ slug: c.slug, name: c.name, nameNe: c.nameNe, sortOrder: c.sortOrder })),
    products: products.filter((p) => visible.has(p.category)).map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      unit: p.unit,
      mrp: p.mrp,
      price: p.price,
      stock: p.stock,
      maxPerOrder: p.maxPerOrder,
      altNames: p.altNames,
      images: p.images,
    })),
  });
});

// ── Orders ──
// Only our own app may be the target of the "back to Chito" link (no open redirects).
// exp:// is Expo Go, used while developing.
const appLink = z
  .string()
  .max(300)
  .refine((u) => u.startsWith('chito://') || (!env.isProd && /^exps?:\/\//.test(u)), 'Not an app link')
  .refine((u) => u.includes('ORDER_ID'), 'Missing ORDER_ID');

const orderBody = z.object({
  returnUrl: appLink.optional(),
  items: z.array(z.object({ slug: z.string().min(1), qty: z.number().int().min(1).max(50) })).min(1).max(60),
  address: z.object({
    label: z.string().trim().min(1).max(30), // "Home", "Work", "Mom's house"…
    recipientName: z.string().trim().max(40).default(''),
    recipientPhone: z.union([z.literal(''), z.string().regex(/^\+91[6-9]\d{9}$/, 'Use +91 and 10 digits')]).default(''),
    house: z.string().max(120).default(''),
    landmark: z.string().trim().min(3).max(160),
    area: z.string().trim().min(2).max(80),
    directions: z.string().max(300).default(''),
    // Real coordinates only: the distance maths repeats every 360°, so "lat 387" would look like Singtam
    location: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).optional(),
  }),
  paymentMethod: z.enum(['COD', 'ONLINE']),
  // ONLINE only: "checkout" (default) = a Razorpay Order paid in Razorpay Checkout (native SDK, or the standard
  // Checkout page). "link" = a Payment Link, kept only for apps that ask for it (test mode allows just 30 links, ever).
  payVia: z.enum(['checkout', 'link']).default('checkout'),
  instructions: z.string().max(300).optional(),
});

customer.post('/orders', requireCustomer, async (req, res) => {
  const key = req.header('Idempotency-Key');
  if (!key || key.length < 8 || key.length > 100) throw badRequest('IDEMPOTENCY_KEY', 'Missing Idempotency-Key header');
  const order = await createOrder(userId(req), key, parse(orderBody, req.body));
  res.status(201).json(serializeOrder(order));
});

customer.get('/orders', requireCustomer, async (req, res) => {
  const orders = await Order.find({ userId: userId(req) }).sort({ createdAt: -1 }).limit(50);
  res.json(orders.map((o) => serializeOrder(o)));
});

customer.get('/orders/:id', requireCustomer, async (req, res) => {
  const o = await Order.findOne({ _id: req.params.id, userId: userId(req) }).catch(() => null);
  if (!o) throw notFound('Order');
  // While it's on the way, include where the rider was last seen so the map isn't empty until the next GPS ping
  let riderLocation = null;
  if (o.status === 'OUT_FOR_DELIVERY' && o.riderId) {
    const loc = (await Rider.findById(o.riderId, { lastLocation: 1 }).lean())?.lastLocation;
    if (loc?.at && Date.now() - new Date(loc.at).getTime() < 10 * 60_000) riderLocation = { lat: loc.lat, lng: loc.lng, at: loc.at };
  }
  res.json({ ...serializeOrder(o), riderLocation });
});

/** After paying on Razorpay's page, the app asks the server to confirm (works even if the callback never arrived). */
customer.post('/orders/:id/payment/refresh', requireCustomer, async (req, res) => {
  const o = await Order.findOne({ _id: req.params.id, userId: userId(req) }).catch(() => null);
  if (!o) throw notFound('Order');
  res.json(serializeOrder(await refreshOnlinePayment(o)));
});

/** Native Razorpay Checkout inside the app: the options it opens with (a Razorpay Order for this order). */
customer.post('/orders/:id/payment/checkout', requireCustomer, async (req, res) => {
  res.json(await startCheckout(String(req.params.id), userId(req)));
});

/** The Checkout said "paid": the server checks the signature and Razorpay's record before placing the order. */
customer.post('/orders/:id/payment/verify', requireCustomer, async (req, res) => {
  const body = parse(
    z.object({
      razorpay_order_id: z.string().trim().min(1).max(60),
      razorpay_payment_id: z.string().trim().min(1).max(60),
      razorpay_signature: z.string().trim().min(1).max(200),
    }),
    req.body,
  );
  const o = await verifyCheckout(String(req.params.id), userId(req), {
    rzpOrderId: body.razorpay_order_id,
    paymentId: body.razorpay_payment_id,
    signature: body.razorpay_signature,
  });
  res.json(serializeOrder(o));
});

customer.post('/orders/:id/cancel', requireCustomer, async (req, res) => {
  const o = await cancelOrder(String(req.params.id), 'customer', 'Cancelled by customer', userId(req));
  res.json(serializeOrder(o));
});

// ── Payments (Razorpay) ──
const escapeHtml = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function resultPage(ok: boolean, title: string, body: string, order?: { id: string; returnUrl?: string | null }) {
  const deepLink = !order ? 'chito://' : order.returnUrl ? order.returnUrl.replace('ORDER_ID', order.id) : `chito://order/${order.id}`;
  // Safe inside <script>: JSON-quoted, and "<" can't close the tag
  const jsLink = JSON.stringify(deepLink).split('<').join('\\u003c');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chito</title><style>body{margin:0;font-family:system-ui,sans-serif;background:#FBF4E6;color:#24150F;display:flex;min-height:100vh;align-items:center;justify-content:center}
.c{background:#FFFDF7;border:1px solid #E8DCC4;border-radius:16px;padding:28px;max-width:360px;margin:16px;text-align:center}
.i{font-size:48px}h1{color:#7B1E28;margin:8px 0}a{display:inline-block;margin-top:16px;background:#7B1E28;color:#FFD60A;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700}</style></head>
<body><div class="c"><div class="i">${ok ? '✅' : '⚠️'}</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(body)}</p>
<a href="${escapeHtml(deepLink)}">Back to Chito</a><p style="font-size:13px;color:#7A6A5E">You can also close this page and return to the app.</p></div>
${ok ? `<script>setTimeout(function(){location.href=${jsLink}},1200)</script>` : ''}</body></html>`;
}

/** Razorpay sends the customer's browser here after paying. Trust only the signature. */
customer.get('/payments/razorpay/callback', async (req, res) => {
  // This one small page may run its own inline redirect back to the app; nothing else is allowed
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'");
  const q = req.query as Record<string, string | undefined>;
  const p = {
    linkId: q.razorpay_payment_link_id ?? '',
    referenceId: q.razorpay_payment_link_reference_id ?? '',
    status: q.razorpay_payment_link_status ?? '',
    paymentId: q.razorpay_payment_id ?? '',
    signature: q.razorpay_signature ?? '',
  };
  if (!p.linkId || !verifyCallbackSignature(p)) {
    res.status(400).type('html').send(resultPage(false, 'Could not confirm payment', 'If money was taken, it will be confirmed automatically or refunded. Please check your order in the app.'));
    return;
  }
  const order = p.status === 'paid' ? await markOrderPaid(p.linkId, p.paymentId) : await Order.findOne({ 'payment.linkId': p.linkId });
  const paid = order?.paymentStatus === 'PAID' && order.status !== 'CANCELLED';
  res
    .type('html')
    .send(
      paid
        ? resultPage(true, 'Payment received', `Order ${order!.orderNumber} is placed. The store is packing it now. 🙏`, { id: order!._id.toString(), returnUrl: order!.payment?.returnUrl })
        : resultPage(false, 'Payment not completed', 'No money was taken. You can try again from your order in the app.', order ? { id: order._id.toString(), returnUrl: order.payment?.returnUrl } : undefined),
    );
});

/**
 * Razorpay's standard Checkout, opened on the app's in-app payment page, posts here when payment ends (redirect mode).
 * Trust only the signature. The page tells the app (inside its WebView) to close and show the order.
 */
customer.post('/payments/razorpay/checkout-callback', async (req, res) => {
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'");
  const b = (req.body ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.slice(0, 200) : '');
  const r = { rzpOrderId: str(b.razorpay_order_id), paymentId: str(b.razorpay_payment_id), signature: str(b.razorpay_signature) };
  const order = r.rzpOrderId && r.paymentId && r.signature ? await confirmCheckoutRedirect(r).catch(() => null) : null;
  const paid = !!order && order.paymentStatus === 'PAID' && order.status !== 'CANCELLED';
  // Failed or cancelled payments arrive with error[...] fields and no signature
  const msg = JSON.stringify({ chitoPayment: paid ? 'paid' : 'failed' });
  // The web app passes ?return=<its order page>: send the browser back there, but only to one of our own sites
  const back = safeReturnUrl(req.query.return);
  res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chito</title><style>body{margin:0;font-family:system-ui,sans-serif;background:#FBF4E6;color:#24150F;display:flex;min-height:100vh;align-items:center;justify-content:center}
.c{background:#FFFDF7;border:1px solid #E8DCC4;border-radius:16px;padding:28px;max-width:360px;margin:16px;text-align:center}.i{font-size:48px}h1{color:#7B1E28;margin:8px 0}</style></head>
<body><div class="c"><div class="i">${paid ? '✅' : '⚠️'}</div><h1>${paid ? 'Payment received' : 'Payment not completed'}</h1>
<p>${paid ? `Order ${escapeHtml(order!.orderNumber)} is placed. Taking you back…` : 'No money was taken. You can try again from your order.'}</p></div>
<script>setTimeout(function(){if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(${JSON.stringify(msg)})}${back ? `else{location.replace(${JSON.stringify(back).split('<').join('\\u003c')})}` : ''}},${paid ? 900 : 1500})</script></body></html>`);
});

/**
 * Only "https://<one of our CORS sites>/order/<id>" (http for localhost), or this server's own address when it also
 * serves the web app (one-container deploy). Never anywhere else (no open redirect).
 */
function safeReturnUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 300) return null;
  try {
    const u = new URL(raw);
    const ownSite = !!env.PUBLIC_API_URL && new URL(env.PUBLIC_API_URL).origin === u.origin;
    if (!ownSite && !env.corsOrigins.includes(u.origin)) return null;
    if (!ownSite && u.protocol !== 'https:' && u.hostname !== 'localhost') return null;
    if (!/^\/order\/[a-f0-9]{24}$/.test(u.pathname) || u.search || u.hash) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Razorpay webhook (needs a public URL in production). Raw body is required for the signature. */
customer.post('/webhooks/razorpay', async (req, res) => {
  const raw = req.body as Buffer;
  if (!Buffer.isBuffer(raw) || !verifyWebhookSignature(raw, req.header('X-Razorpay-Signature'))) {
    res.status(400).json({ error: { code: 'BAD_SIGNATURE', message: 'Invalid signature' } });
    return;
  }
  const evt = JSON.parse(raw.toString('utf8')) as {
    event: string;
    payload?: {
      payment_link?: { entity?: { id?: string } };
      order?: { entity?: { id?: string } };
      payment?: { entity?: { id?: string; order_id?: string | null } };
    };
  };
  const paymentId = evt.payload?.payment?.entity?.id ?? '';
  if (evt.event === 'payment_link.paid') {
    const linkId = evt.payload?.payment_link?.entity?.id;
    if (linkId) await markOrderPaid(linkId, paymentId);
  } else if (evt.event === 'order.paid' || evt.event === 'payment.captured') {
    // Paid in the app's native Checkout. (A Payment Link's own internal order matches no stored rzpOrderId.)
    const rzpOrderId = evt.payload?.order?.entity?.id ?? evt.payload?.payment?.entity?.order_id;
    if (rzpOrderId && paymentId) await markRzpOrderPaid(rzpOrderId, paymentId);
  }
  res.json({ ok: true });
});

// ── Shared locations ("Mom sends her location on WhatsApp") ──
customer.post('/geo/resolve', requireCustomer, async (req, res) => {
  const { text } = parse(z.object({ text: z.string().trim().min(3).max(1000) }), req.body);
  const at = await resolveSharedLocation(text);
  if (!at) {
    throw badRequest(
      'NO_COORDINATES',
      'That link doesn’t contain a map pin. Ask them to share “Current location” (or drop a pin) in WhatsApp or Google Maps and send it again.',
    );
  }
  const store = await getStore();
  res.json({ location: at, ...checkServiceability(store, at), radiusKm: store.serviceRadiusKm });
});
