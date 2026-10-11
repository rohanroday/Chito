import { Vibration } from 'react-native';
import { create } from 'zustand';

import { api, errorMessage } from '@/api/client';
import type { RiderMe, RiderOrder } from '@/api/types';

type DeliveriesState = {
  me: RiderMe | null;
  orders: RiderOrder[];
  loading: boolean;
  error: string;
  load: () => Promise<void>;
  /** From the live socket or after an action: replace one order (or add a newly assigned one). */
  upsert: (o: RiderOrder, isNew?: boolean) => void;
  setStatus: (status: RiderMe['status']) => void;
  reset: () => void;
};

export const useDeliveries = create<DeliveriesState>()((set, get) => ({
  me: null,
  orders: [],
  loading: false,
  error: '',
  load: async () => {
    set({ loading: true });
    try {
      const [me, orders] = await Promise.all([api<RiderMe>('/rider/me'), api<RiderOrder[]>('/rider/orders')]);
      set({ me, orders, error: '', loading: false });
    } catch (e) {
      set({ error: errorMessage(e), loading: false });
    }
  },
  upsert: (o, isNew) => {
    const others = get().orders.filter((x) => x.id !== o.id);
    set({ orders: [o, ...others] });
    // A new delivery: buzz so the rider notices even with the phone in a pocket
    if (isNew) Vibration.vibrate([0, 400, 200, 400]);
    // Cash and today's numbers change when an order is delivered or fails
    api<RiderMe>('/rider/me')
      .then((me) => set({ me }))
      .catch(() => undefined);
  },
  setStatus: (status) => set((s) => (s.me ? { me: { ...s.me, status } } : s)),
  reset: () => set({ me: null, orders: [], error: '' }),
}));

/** Orders the rider still has to take to the door. */
export const activeOrders = (orders: RiderOrder[]) => orders.filter((o) => o.status === 'OUT_FOR_DELIVERY');
