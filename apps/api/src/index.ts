import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { createServer } from 'node:http';

import { env } from './config/env.js';
import { errorHandler } from './lib/http.js';
import { initRealtime } from './lib/realtime.js';
import { admin } from './routes/admin.js';
import { customer } from './routes/customer.js';
import { rider } from './routes/rider.js';
import { expireUnpaidOrders } from './services/orders.js';

const app = express();
app.disable('x-powered-by');
app.use(helmet());
// Native apps send no Origin header, so they pass; browsers must be allow-listed
app.use(cors({ origin: env.corsOrigins }));
// Razorpay webhooks are verified against the exact raw bytes, so keep them unparsed
app.use('/api/v1/webhooks/razorpay', express.raw({ type: '*/*', limit: '1mb' }));
// Product photo uploads arrive as base64 JSON, so that one route gets a bigger limit
app.use('/api/v1/admin/uploads', express.json({ limit: '8mb' }));
// Razorpay Checkout (redirect mode) posts its result as a form
app.use('/api/v1/payments/razorpay/checkout-callback', express.urlencoded({ extended: true, limit: '20kb' }));
app.use(express.json({ limit: '200kb' }));

// Opening the bare address in a browser shouldn't look like an error
app.get('/', (_req, res) => {
  res.json({ name: 'Chito API', ok: true, health: '/health', api: '/api/v1' });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, db: mongoose.connection.readyState === 1 });
});
app.use('/api/v1', customer);
app.use('/api/v1/admin', admin);
app.use('/api/v1/rider', rider);
app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});
app.use(errorHandler);

async function main() {
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const server = createServer(app);
  initRealtime(server);
  // 0.0.0.0 so phones on the same Wi-Fi can reach this PC
  // Release stock held by online orders that were never paid.
  // Caught: a network blip to Atlas must not crash the whole server.
  setInterval(() => {
    expireUnpaidOrders().catch((e: unknown) => console.error('expireUnpaidOrders failed (will retry):', (e as Error).message));
  }, 60_000);
  server.listen(env.PORT, '0.0.0.0', () => {
    console.log(`🛵 Chito API on http://localhost:${env.PORT}/api/v1 (db: ${mongoose.connection.name})`);
    if (env.OTP_DEV_MODE) console.log('   ⚠️  OTP_DEV_MODE on: OTP is always 1234');
    if (env.devIgnoreStoreHours) console.log('   ⚠️  DEV_IGNORE_STORE_HOURS on: store hours ignored');
  });
}

// Safety net: log stray promise errors instead of exiting (Node's default), so one bad call can't take every customer offline
process.on('unhandledRejection', (e) => console.error('Unhandled rejection:', e instanceof Error ? e.message : e));

main().catch((e) => {
  console.error('Failed to start:', e);
  process.exit(1);
});
