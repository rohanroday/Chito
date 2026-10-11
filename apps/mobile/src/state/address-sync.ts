// Saved addresses belong to the ACCOUNT, not the phone.
// - After login (and when the app comes back) the account's list is loaded from the server.
// - Every add / edit / delete / select is saved back to the server.
// - On logout the phone forgets the addresses and the jhola, so the next person starts fresh.
// Kept out of state/auth.ts to avoid an import cycle (api/client → state/auth).
import { api } from '@/api/client';

import { type Address, useAuth, useProfile } from './auth';
import { useCart } from './cart';

type ServerAddress = Omit<Address, 'location' | 'serviceable'> & { location: Address['location'] | null; serviceable: boolean };
type ServerList = { addresses: ServerAddress[]; selectedId: string | null };

const fromServer = (a: ServerAddress): Address => ({ ...a, location: a.location ?? undefined });

// Only push after this account's list has been loaded, so another account's leftovers are never uploaded
let loadedFor: string | null = null;
let applying = false;

/** Load the logged-in account's addresses (replaces whatever is on the phone). */
export async function pullAddresses() {
  const phone = useAuth.getState().phone;
  if (!phone) return;
  const r = await api<ServerList>('/me/addresses');
  if (useAuth.getState().phone !== phone) return; // logged out meanwhile
  applying = true;
  useProfile.getState().replaceFromServer(r.addresses.map(fromServer), r.selectedId);
  applying = false;
  loadedFor = phone;
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
function pushSoon() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    const phone = useAuth.getState().phone;
    if (!phone || loadedFor !== phone) return;
    const { addresses, selectedId } = useProfile.getState();
    api<ServerList>('/me/addresses', {
      method: 'PUT',
      body: {
        selectedId,
        addresses: addresses.map(({ serviceable: _s, distanceKm: _d, ...a }) => ({ ...a, location: a.location ?? null })),
      },
    })
      .then((r) => {
        // The server re-measures distances: keep its answer
        if (useAuth.getState().phone !== phone) return;
        applying = true;
        useProfile.getState().replaceFromServer(r.addresses.map(fromServer), r.selectedId);
        applying = false;
      })
      .catch(() => undefined); // offline: the next pull/push catches up
  }, 400);
}

useProfile.subscribe((s, prev) => {
  if (applying) return;
  if (s.addresses !== prev.addresses || s.selectedId !== prev.selectedId) pushSoon();
});

useAuth.subscribe((s, prev) => {
  if (prev.phone && !s.phone) {
    // Logged out (by the user, or because the session ended): forget this account's things
    loadedFor = null;
    if (pushTimer) clearTimeout(pushTimer);
    applying = true;
    useProfile.getState().clearAddresses();
    applying = false;
    useCart.getState().clear();
  }
});
