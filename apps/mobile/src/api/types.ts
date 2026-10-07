// Mirrors the API serializers in apps/api/src (customer routes).

export type Category = { slug: string; name: string; nameNe: string; sortOrder: number };

export type Product = {
  slug: string;
  name: string;
  category: string;
  unit: string;
  mrp: number; // paise
  price: number; // paise
  stock: number;
  maxPerOrder: number;
  altNames: string[];
  images: string[]; // ImageKit paths, e.g. /chito/products/dairy/amul-butter.jpg
};

export type StoreInfo = {
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
};

export type OrderStatus =
  | 'PAYMENT_PENDING'
  | 'PLACED'
  | 'CONFIRMED'
  | 'PACKED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'DELIVERY_FAILED'
  | 'CANCELLED';

export type OrderItem = { slug: string; name: string; unit: string; image: string; price: number; mrp: number; qty: number };

export type Order = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  statusHistory: { status: OrderStatus; at: string }[];
  items: OrderItem[];
  bill: { itemTotal: number; mrpTotal: number; deliveryFee: number; handlingFee: number; discount: number; grandTotal: number };
  paymentMethod: 'COD' | 'ONLINE';
  paymentStatus: 'PENDING' | 'PAID' | 'REFUNDED' | 'REFUND_FAILED';
  rider: { name: string; phone: string } | null;
  etaMin: number;
  distanceKm: number;
  address: {
    label: string;
    house: string;
    landmark: string;
    area: string;
    directions: string;
    /** Empty when the customer receives it themself. */
    recipientName: string;
    recipientPhone: string;
  };
  /** Razorpay page to pay on, only while the order is PAYMENT_PENDING. */
  payment: { url: string; expiresAt: string } | null;
  cancelReason: string;
  createdAt: string;
};

export type Me = { id: string; phone: string; name: string };

export type Tokens = { accessToken: string; refreshToken: string };
