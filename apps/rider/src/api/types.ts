// Mirrors apps/api/src/routes/rider.ts (serializeOrderForRider, GET /rider/me).

export type OrderStatus = 'OUT_FOR_DELIVERY' | 'DELIVERY_FAILED' | 'DELIVERED' | 'CANCELLED' | 'PLACED' | 'CONFIRMED' | 'PACKED' | 'PAYMENT_PENDING';

export type RiderOrder = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  statusHistory: { status: OrderStatus; at: string }[];
  items: { slug: string; name: string; unit: string; qty: number; price: number }[];
  bill: { grandTotal: number };
  paymentMethod: 'COD' | 'ONLINE';
  paymentStatus: string;
  /** Cash to collect at the door, in paise (0 = paid online). */
  collect: number;
  distanceKm: number;
  address: {
    label: string;
    house: string;
    landmark: string;
    area: string;
    directions: string;
    recipientName: string;
    recipientPhone: string;
    location: { lat: number; lng: number } | null;
  };
  customer: { name: string; phone: string };
  instructions: string;
  failReason: string;
  createdAt: string;
};

export type RiderMe = {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  status: 'AVAILABLE' | 'ON_DELIVERY' | 'OFF_DUTY';
  /** Cash the rider is carrying, to hand to the store. */
  codBalance: number;
  today: { delivered: number; cashCollected: number };
};
