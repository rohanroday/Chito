import { io, type Socket } from 'socket.io-client';

import { useAuth } from '@/state/auth';

import { refreshTokens } from './session';
import { SOCKET_URL } from './config';

let socket: Socket | null = null;

/** One shared socket per session; the server puts customers in room "user:<id>". */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket'],
      // Read the token on every (re)connect so refreshed tokens are used
      auth: (cb) => cb({ token: useAuth.getState().tokens?.accessToken }),
    });
    // Access tokens last 15 min: if the server rejects ours, renew it and reconnect
    const s = socket;
    s.on('connect_error', async (err) => {
      if (err.message === 'unauthorized' && (await refreshTokens())) s.connect();
    });
  }
  return socket;
}

export function closeSocket() {
  socket?.close();
  socket = null;
}
