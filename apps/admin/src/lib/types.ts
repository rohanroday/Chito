// Mirrors the API serializers in apps/api/src (serializeOrder, serializeRider, publicStore, ...).

export type OrderStatus =
  | 'PAYMENT_PENDING'
  | 'PLACED'
  | 'CONFIRMED'
  | 'PACKED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'DELIVERY_FAILED'
  | 'CANCELLED';

export type Order = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  statusHistory: { status: OrderStatus; at: string }[];
  items: { slug: string; name: string; unit: string; image: string; price: number; mrp: number; qty: number }[];
  bill: { itemTotal: number; mrpTotal: number; deliveryFee: number; handlingFee: number; discount: number; grandTotal: number };
  paymentMethod: 'COD' | 'ONLINE';
  paymentStatus: 'PENDING' | 'PAID' | 'REFUNDED' | 'REFUND_FAILED';
  rider: { name: string; phone: string } | null;
  riderId: string | null;
  etaMin: number;
  distanceKm: number;
  address: {
    label: string;
    house: string;
    landmark: string;
    area: string;
    directions: string;
    /** Set when the customer ordered for someone else (e.g. family). The rider calls this person. */
    recipientName: string;
    recipientPhone: string;
    location: { lat: number; lng: number } | null;
  };
  customer: { name: string; phone: string };
  instructions: string;
  cancelReason: string;
  createdAt: string;
};

export type Rider = {
  id: string;
  name: string;
  phone: string;
  vehicle: 'SCOOTER' | 'BIKE' | 'ON_FOOT';
  status: 'AVAILABLE' | 'ON_DELIVERY' | 'OFF_DUTY';
  availableSince: string | null;
  codBalance: number;
  isActive: boolean;
  activeOrders?: number;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  unit: string;
  mrp: number;
  price: number;
  stock: number;
  lowStockThreshold: number;
  maxPerOrder: number;
  altNames: string[];
  images: string[];
  isActive: boolean;
};

export type Category = { slug: string; name: string; nameNe: string; sortOrder: number; isActive: boolean; productCount: number };

export type StoreSettings = {
  name: string;
  address: string;
  location: { lat: number; lng: number };
  serviceRadiusKm: number;
  isOpen: boolean;
  isOpenNow: boolean;
  closedMessage: string;
  openTime: string;
  closeTime: string;
  minOrderValue: number;
  deliveryFee: number;
  freeDeliveryAbove: number;
  handlingFee: number;
  baseEtaMin: number;
  supportPhone: string;
  /** Dev-only switches on the server (always false in production). */
  testMode?: { anyLocation: boolean; ignoreHours: boolean; fixedOtp: boolean };
};

export type Stats = {
  orders: number;
  delivered: number;
  cancelled: number;
  revenue: number;
  active: number;
  codPending: number;
  lowStock: number;
};

export type AdminUser = { id: string; email: string; name: string; role: 'OWNER' | 'STAFF' };

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PAYMENT_PENDING: 'Awaiting payment',
  PLACED: 'New',
  CONFIRMED: 'Confirmed',
  PACKED: 'Packed',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  DELIVERY_FAILED: 'Delivery failed',
  CANCELLED: 'Cancelled',
};

/** End-of-day summary from GET /admin/reports/day (all money in paise). */
export type DayReport = {
  date: string;
  counts: { total: number; delivered: number; cancelled: number; open: number };
  cash: { collected: number; orders: number; stillOut: number; stillOutOrders: number };
  online: { received: number; orders: number; refunded: number; refundedOrders: number; refundDue: number; refundDueOrders: number };
  sales: { items: number; deliveryFees: number; handlingFees: number; discounts: number; total: number };
  riders: { name: string; deliveries: number; cash: number; cashOrders: number }[];
  topItems: { name: string; unit: string; qty: number; amount: number }[];
  orders: Order[];
};

export type DaySummary = { date: string; orders: number; delivered: number; cash: number; online: number };
