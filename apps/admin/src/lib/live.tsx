'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import { getSession, refresh, SOCKET_URL } from './api';

const LiveContext = createContext<{ socket: Socket | null; connected: boolean }>({ socket: null, connected: false });

/** One socket for the whole dashboard (room "admin" on the server). */
export function LiveProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const s = io(SOCKET_URL, {
      // Read the token on every (re)connect so refreshed tokens are used
      auth: (cb) => cb({ token: getSession()?.accessToken }),
      transports: ['websocket'],
    });
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    // The access token lasts 15 min. If the server rejects it, renew it and reconnect —
    // otherwise the board silently stops getting live orders.
    s.on('connect_error', async (err) => {
      setConnected(false);
      if (err.message === 'unauthorized' && (await refresh())) s.connect();
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- socket is an external system created here
    setSocket(s);
    return () => {
      s.close();
    };
  }, []);

  return <LiveContext.Provider value={{ socket, connected }}>{children}</LiveContext.Provider>;
}

export const useLive = () => useContext(LiveContext);

/** Subscribe to a server event; the latest handler is always used. */
export function useLiveEvent<T>(event: string, handler: (payload: T) => void) {
  const { socket } = useLive();
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    if (!socket) return;
    const fn = (p: T) => ref.current(p);
    socket.on(event, fn);
    return () => {
      socket.off(event, fn);
    };
  }, [socket, event]);
}
