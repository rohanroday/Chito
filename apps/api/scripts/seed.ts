// Seeds the store, catalogue, first OWNER admin and demo riders.
// Safe to re-run: prices/stock edited in the admin dashboard are NOT overwritten.
// Usage (from apps/api): npm run seed   [-- --reset-admin-password]
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { toPoint } from '../src/lib/geo.js';
import { Admin, Category, Counter, Order, Otp, Product, Rider, Store, User } from '../src/models/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const readJson = <T>(f: string): T => JSON.parse(readFileSync(join(here, '..', 'seed', f), 'utf8')) as T;
const env = process.env;
const int = (v: string | undefined, d: number) => (v ? Number(v) : d);

type SeedCategory = { slug: string; name: string; nameNe: string; sortOrder: number };
type SeedProduct = {
  slug: string; name: string; category: string; unit: string; mrp: number; price: number;
  stock: number; lowStockThreshold: number; maxPerOrder: number; altNames: string[]; images: string[];
};

async function main() {
  if (!env.MONGODB_URI) throw new Error('MONGODB_URI missing');
  await mongoose.connect(env.MONGODB_URI);
  console.log(`Connected to ${mongoose.connection.name}`);

  // Collections must exist before multi-document transactions use them
  for (const m of [User, Otp, Store, Category, Product, Rider, Order, Admin, Counter]) {
    await m.createCollection().catch(() => undefined);
    await m.syncIndexes();
  }

  // Store
  if (!(await Store.exists({}))) {
    await Store.create({
      name: env.STORE_NAME ?? 'Chito Singtam Bazaar',
      address: env.STORE_ADDRESS ?? 'Singtam Bazaar, East Sikkim 737134',
      location: toPoint({ lat: Number(env.STORE_LAT ?? 27.234), lng: Number(env.STORE_LNG ?? 88.499) }),
      serviceRadiusKm: Number(env.SERVICE_RADIUS_KM ?? 3),
      openTime: env.STORE_OPEN_TIME ?? '06:00',
      closeTime: env.STORE_CLOSE_TIME ?? '22:00',
      minOrderValue: int(env.MIN_ORDER_VALUE_PAISE, 9900),
      deliveryFee: int(env.DELIVERY_FEE_PAISE, 2000),
      freeDeliveryAbove: int(env.FREE_DELIVERY_ABOVE_PAISE, 19900),
      supportPhone: env.SUPPORT_PHONE ?? '',
    });
    console.log('✓ Store created');
  } else console.log('• Store exists (kept admin settings)');

  // Categories
  const cats = readJson<SeedCategory[]>('categories.json');
  for (const c of cats) {
    await Category.updateOne({ slug: c.slug }, { $set: { name: c.name, nameNe: c.nameNe, sortOrder: c.sortOrder } }, { upsert: true });
  }
  console.log(`✓ ${cats.length} categories`);

  // Products — images point at ImageKit (uploaded by scripts/upload-seed-images.mjs)
  const folder = env.IMAGEKIT_FOLDER ?? '/chito';
  const products = readJson<SeedProduct[]>('products.json');
  let inserted = 0;
  for (const p of products) {
    const images = p.images.map((i) => `${folder}/products/${i.replace(/^images\//, '')}`);
    const r = await Product.updateOne(
      { slug: p.slug },
      {
        $set: { name: p.name, category: p.category, unit: p.unit, altNames: p.altNames, images },
        // Only on first insert — later edits come from the admin dashboard
        $setOnInsert: { mrp: p.mrp, price: p.price, stock: p.stock, lowStockThreshold: p.lowStockThreshold, maxPerOrder: p.maxPerOrder, isActive: true },
      },
      { upsert: true },
    );
    if (r.upsertedCount) inserted++;
  }
  console.log(`✓ ${products.length} products (${inserted} new)`);

  // First OWNER admin
  const email = env.ADMIN_EMAIL?.toLowerCase();
  const password = env.ADMIN_PASSWORD;
  if (email && password) {
    const existing = await Admin.findOne({ email });
    if (!existing) {
      await Admin.create({ email, passwordHash: await bcrypt.hash(password, 12), name: 'Owner', role: 'OWNER' });
      console.log(`✓ Owner admin created: ${email}`);
    } else if (process.argv.includes('--reset-admin-password')) {
      existing.passwordHash = await bcrypt.hash(password, 12);
      await existing.save();
      console.log(`✓ Owner password reset: ${email}`);
    } else console.log(`• Owner admin exists: ${email}`);
    if (password.length < 12) console.log('  ⚠️  ADMIN_PASSWORD is short. Use 12+ characters before going live.');
  } else console.log('• ADMIN_EMAIL / ADMIN_PASSWORD not set: no admin created');

  // Demo riders (edit names/phones in the dashboard)
  if (!(await Rider.exists({}))) {
    await Rider.create([
      { name: 'Pemba', phone: '+919000000001', vehicle: 'SCOOTER', status: 'AVAILABLE', availableSince: new Date() },
      { name: 'Karma', phone: '+919000000002', vehicle: 'BIKE', status: 'AVAILABLE', availableSince: new Date() },
      { name: 'Suraj', phone: '+919000000003', vehicle: 'SCOOTER', status: 'OFF_DUTY' },
    ]);
    console.log('✓ 3 demo riders (placeholder phone numbers)');
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect();
  process.exit(1);
});
