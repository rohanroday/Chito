import mongoose, { type InferSchemaType, Schema } from 'mongoose';

import { ORDER_STATUSES } from '../lib/order-status.js';

// All money is integer paise. All points are GeoJSON [lng, lat].
const pointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },
  },
  { _id: false },
);

// ── Customers ──
const userSchema = new Schema(
  {
    phone: { type: String, required: true, unique: true },
    name: { type: String, default: '' },
    isBlocked: { type: Boolean, default: false },
    pushTokens: { type: [String], default: [] },
    /** Bumped on logout / "log out everywhere": older refresh tokens stop working. */
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);
export const User = mongoose.model('User', userSchema);

const otpSchema = new Schema({
  phone: { type: String, required: true, index: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true, expires: 0 }, // TTL index
  createdAt: { type: Date, default: Date.now },
});
export const Otp = mongoose.model('Otp', otpSchema);

// ── Store settings (single document, edited from the admin dashboard) ──
const storeSchema = new Schema(
  {
    name: { type: String, required: true },
    address: { type: String, required: true },
    location: { type: pointSchema, required: true },
    serviceRadiusKm: { type: Number, default: 3 },
    isOpen: { type: Boolean, default: true },
    closedMessage: { type: String, default: '' },
    openTime: { type: String, default: '06:00' }, // HH:mm, Asia/Kolkata
    closeTime: { type: String, default: '22:00' },
    minOrderValue: { type: Number, default: 9900 },
    deliveryFee: { type: Number, default: 2000 },
    freeDeliveryAbove: { type: Number, default: 19900 },
    handlingFee: { type: Number, default: 500 },
    baseEtaMin: { type: Number, default: 15 },
    supportPhone: { type: String, default: '' },
  },
  { timestamps: true },
);
storeSchema.index({ location: '2dsphere' });
export const Store = mongoose.model('Store', storeSchema);
export type StoreDoc = InferSchemaType<typeof storeSchema>;

// ── Catalogue ──
const categorySchema = new Schema({
  slug: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  nameNe: { type: String, default: '' },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
});
export const Category = mongoose.model('Category', categorySchema);

const productSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    category: { type: String, required: true, index: true }, // category slug
    unit: { type: String, required: true },
    mrp: { type: Number, required: true },
    price: { type: Number, required: true },
    stock: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5 },
    maxPerOrder: { type: Number, default: 10 },
    altNames: { type: [String], default: [] },
    images: { type: [String], default: [] }, // ImageKit paths, e.g. /chito/products/dairy/amul-butter.jpg
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
productSchema.index({ name: 'text', altNames: 'text' });
export const Product = mongoose.model('Product', productSchema);

// ── Riders (no app in v1 — managed by admin) ──
const riderSchema = new Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    vehicle: { type: String, enum: ['SCOOTER', 'BIKE', 'ON_FOOT'], default: 'SCOOTER' },
    status: { type: String, enum: ['AVAILABLE', 'ON_DELIVERY', 'OFF_DUTY'], default: 'OFF_DUTY', index: true },
    availableSince: { type: Date, default: null },
    codBalance: { type: Number, default: 0 }, // cash collected, not yet handed to the store
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
export const Rider = mongoose.model('Rider', riderSchema);

// ── Orders ──
const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    customer: { name: String, phone: String },
    items: [
      {
        _id: false,
        slug: String,
        name: String,
        unit: String,
        image: String,
        price: Number,
        mrp: Number,
        qty: Number,
      },
    ],
    address: {
      label: String,
      house: String,
      landmark: String,
      area: String,
      directions: String,
      // Who receives the order (e.g. Mom), when different from the customer who placed it
      recipientName: { type: String, default: '' },
      recipientPhone: { type: String, default: '' },
      location: { type: pointSchema, required: false },
    },
    distanceKm: { type: Number, default: 0 },
    bill: {
      itemTotal: Number,
      mrpTotal: Number,
      deliveryFee: Number,
      handlingFee: Number,
      discount: { type: Number, default: 0 },
      grandTotal: Number,
    },
    paymentMethod: { type: String, enum: ['COD', 'ONLINE'], required: true },
    paymentStatus: { type: String, enum: ['PENDING', 'PAID', 'REFUNDED', 'REFUND_FAILED'], default: 'PENDING' },
    // Razorpay Payment Link for ONLINE orders (the customer pays on Razorpay's page)
    payment: {
      linkId: { type: String, default: '' },
      linkUrl: { type: String, default: '' },
      paymentId: { type: String, default: '' },
      expiresAt: { type: Date, default: null },
      /** Where the payment result page sends the customer back to (the app's own link). */
      returnUrl: { type: String, default: '' },
    },
    status: { type: String, enum: ORDER_STATUSES, default: 'PLACED', index: true },
    statusHistory: [{ _id: false, status: String, at: { type: Date, default: Date.now }, by: String }],
    riderId: { type: Schema.Types.ObjectId, ref: 'Rider', default: null, index: true },
    rider: { name: String, phone: String },
    etaMin: { type: Number, default: 20 },
    instructions: { type: String, default: '' },
    cancelReason: { type: String, default: '' },
    idempotencyKey: { type: String, required: true },
  },
  { timestamps: true },
);
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
orderSchema.index({ 'payment.linkId': 1 });
export const Order = mongoose.model('Order', orderSchema);
export type OrderDoc = InferSchemaType<typeof orderSchema>;
export type OrderInstance = InstanceType<typeof Order>;

// ── Admins ──
const adminSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, default: '' },
    role: { type: String, enum: ['OWNER', 'STAFF'], default: 'STAFF' },
    /** Bumped on logout: older refresh tokens stop working. */
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);
export const Admin = mongoose.model('Admin', adminSchema);

// ── Counters (sequential order numbers CH-000001) ──
const counterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } });
export const Counter = mongoose.model('Counter', counterSchema);
