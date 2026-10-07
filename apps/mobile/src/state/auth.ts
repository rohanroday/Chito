import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Tokens } from '@/api/types';

import { persistStorage, securePersistStorage } from './storage';

export type Pin = { lat: number; lng: number };
/** The server's answer for a pin (it re-checks at checkout anyway). */
export type PinCheck = { location: Pin; distanceKm: number; serviceable: boolean };

export type Address = {
  id: string;
  /** Free text: "Home", "Work", "Mom's house"… */
  label: string;
  /** Who takes the order at the door. Empty = the customer themself. */
  recipientName: string;
  recipientPhone: string;
  house: string;
  landmark: string;
  area: string;
  directions: string;
  location?: Pin;
  /** Straight-line km from the store, as measured by the server. */
  distanceKm: number;
  serviceable?: boolean;
};

export type AddressInput = Omit<Address, 'id' | 'location' | 'distanceKm' | 'serviceable'>;

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ── Session (tokens) — encrypted on the phone ──
type SessionState = {
  tokens: Tokens | null;
  /** Set only after OTP + name are done; gates the app. */
  phone: string | null;
  name: string;
  hydrated: boolean;
  setTokens: (t: Tokens) => void;
  finishLogin: (phone: string, name: string) => void;
  setName: (name: string) => void;
  logout: () => void;
};

export const useAuth = create<SessionState>()(
  persist(
    (set) => ({
      tokens: null,
      phone: null,
      name: '',
      hydrated: false,
      setTokens: (tokens) => set({ tokens }),
      finishLogin: (phone, name) => set({ phone, name: name.trim() }),
      setName: (name) => set({ name: name.trim() }),
      logout: () => set({ tokens: null, phone: null, name: '' }),
    }),
    {
      name: 'chito-session',
      storage: securePersistStorage,
      partialize: ({ tokens, phone, name }) => ({ tokens, phone, name }),
      onRehydrateStorage: () => () => useAuth.setState({ hydrated: true }),
    },
  ),
);

// ── Profile prefs (saved addresses, notifications) — not secret ──
type ProfileState = {
  addresses: Address[];
  /** The address the next order goes to. */
  selectedId: string | null;
  notifications: boolean;
  hydrated: boolean;
  /** Create (no id) or update an address; it becomes the selected one. Returns its id. */
  saveAddress: (input: AddressInput, check: PinCheck | null, id?: string) => string;
  removeAddress: (id: string) => void;
  selectAddress: (id: string) => void;
  setNotifications: (on: boolean) => void;
};

/** A typed address counts as saved even without a pin; the pin is needed to order. */
export const hasTypedAddress = (a: Address | null | undefined): a is Address => !!a && a.landmark.trim().length > 0;
export const addressLine = (a: Address) => [a.house, a.landmark, a.area].filter((s) => s.trim()).join(', ');
export const isForSomeoneElse = (a: Address) => a.recipientName.trim().length > 0;

export const useProfile = create<ProfileState>()(
  persist(
    (set, get) => ({
      addresses: [],
      selectedId: null,
      notifications: true,
      hydrated: false,
      saveAddress: (input, check, id) => {
        const existing = id ? get().addresses.find((a) => a.id === id) : undefined;
        const pin = check ?? (existing?.location ? { location: existing.location, distanceKm: existing.distanceKm, serviceable: existing.serviceable === true } : null);
        const next: Address = { ...input, id: existing?.id ?? newId(), location: pin?.location, distanceKm: pin?.distanceKm ?? 0, serviceable: pin?.serviceable };
        set((s) => ({
          addresses: existing ? s.addresses.map((a) => (a.id === existing.id ? next : a)) : [...s.addresses, next],
          selectedId: next.id,
        }));
        return next.id;
      },
      removeAddress: (id) =>
        set((s) => {
          const addresses = s.addresses.filter((a) => a.id !== id);
          return { addresses, selectedId: s.selectedId === id ? (addresses[0]?.id ?? null) : s.selectedId };
        }),
      selectAddress: (selectedId) => set({ selectedId }),
      setNotifications: (notifications) => set({ notifications }),
    }),
    {
      name: 'chito-profile',
      storage: persistStorage,
      version: 1,
      // v0 kept a single `address`; turn it into the first saved address
      migrate: (old, version) => {
        const o = (old ?? {}) as { address?: Omit<Address, 'id' | 'recipientName' | 'recipientPhone'>; notifications?: boolean };
        if (version === 0 && o.address && (o.address.landmark?.trim() || o.address.location)) {
          const a: Address = { ...o.address, id: newId(), recipientName: '', recipientPhone: '' };
          return { addresses: [a], selectedId: a.id, notifications: o.notifications ?? true };
        }
        return { addresses: [], selectedId: null, notifications: o.notifications ?? true, ...(old as object) };
      },
      partialize: ({ addresses, selectedId, notifications }) => ({ addresses, selectedId, notifications }),
      onRehydrateStorage: () => () => useProfile.setState({ hydrated: true }),
    },
  ),
);

/** The address the next order goes to (or null if none saved). */
export function useSelectedAddress() {
  return useProfile((s) => s.addresses.find((a) => a.id === s.selectedId) ?? s.addresses[0] ?? null);
}
