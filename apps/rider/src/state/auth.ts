import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { securePersistStorage } from './storage';

export type Tokens = { accessToken: string; refreshToken: string };
export type RiderProfile = { id: string; name: string; phone: string };

// The rider's session, encrypted on the phone (SecureStore)
type SessionState = {
  tokens: Tokens | null;
  rider: RiderProfile | null;
  hydrated: boolean;
  setTokens: (t: Tokens) => void;
  login: (rider: RiderProfile, tokens: Tokens) => void;
  logout: () => void;
};

export const useAuth = create<SessionState>()(
  persist(
    (set) => ({
      tokens: null,
      rider: null,
      hydrated: false,
      setTokens: (tokens) => set({ tokens }),
      login: (rider, tokens) => set({ rider, tokens }),
      logout: () => set({ tokens: null, rider: null }),
    }),
    {
      name: 'chito-rider-session',
      storage: securePersistStorage,
      partialize: ({ tokens, rider }) => ({ tokens, rider }),
      onRehydrateStorage: () => () => useAuth.setState({ hydrated: true }),
    },
  ),
);
