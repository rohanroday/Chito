import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';

import { env } from '../config/env.js';
import { verifyAccess } from './auth.js';

let io: Server | null = null;

/** Rooms: "admin" (all staff), "user:<id>" (one customer). */
export function initRealtime(server: HttpServer) {
  io = new Server(server, { cors: { origin: env.corsOrigins } });
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error('unauthorized'));
      socket.data.claims = verifyAccess(token);
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });
  io.on('connection', (socket) => {
    const c = socket.data.claims;
    socket.join(c.kind === 'admin' ? 'admin' : `user:${c.sub}`);
  });
  return io;
}

export function emitToAdmins(event: string, payload: unknown) {
  io?.to('admin').emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}

/** Everyone connected (admins + customers), e.g. the store opening or closing. */
export function emitToAll(event: string, payload: unknown) {
  io?.emit(event, payload);
}
