import type { NextFunction, Request, Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';

import { env } from '../config/env.js';
import { forbidden, unauthorized } from './http.js';

export type CustomerClaims = { sub: string; kind: 'customer' };
export type AdminClaims = { sub: string; kind: 'admin'; role: 'OWNER' | 'STAFF' };
export type Claims = CustomerClaims | AdminClaims;

declare module 'express-serve-static-core' {
  interface Request {
    auth?: Claims;
  }
}

/** Refresh tokens also carry the account's tokenVersion; bumping it (logout) kills every older refresh token. */
export type RefreshClaims = Claims & { ver?: number };

/**
 * Access token: short-lived, checked without a DB lookup.
 * Refresh token: long-lived, re-checked against the DB on every use (see POST /auth/refresh).
 */
export function issueTokens(claims: Claims, tokenVersion = 0) {
  const access = jwt.sign(claims, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'] });
  // The dashboard has more power than a customer, so its sessions end sooner
  const refreshTtl = claims.kind === 'admin' ? env.JWT_ADMIN_REFRESH_EXPIRES_IN : env.JWT_REFRESH_EXPIRES_IN;
  const refresh = jwt.sign({ ...claims, ver: tokenVersion }, env.JWT_REFRESH_SECRET, { expiresIn: refreshTtl as SignOptions['expiresIn'] });
  return { accessToken: access, refreshToken: refresh };
}

export function verifyAccess(token: string): Claims {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as Claims;
}

export function verifyRefresh(token: string): RefreshClaims {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshClaims;
}

function readBearer(req: Request): Claims {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) throw unauthorized();
  try {
    return verifyAccess(h.slice(7));
  } catch {
    throw unauthorized('Session expired');
  }
}

export function requireCustomer(req: Request, _res: Response, next: NextFunction) {
  const c = readBearer(req);
  if (c.kind !== 'customer') throw forbidden();
  req.auth = c;
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const c = readBearer(req);
  if (c.kind !== 'admin') throw forbidden();
  req.auth = c;
  next();
}

export function requireOwner(req: Request, _res: Response, next: NextFunction) {
  const c = readBearer(req);
  if (c.kind !== 'admin' || c.role !== 'OWNER') throw forbidden('Only the owner can change this');
  req.auth = c;
  next();
}

export const userId = (req: Request) => req.auth!.sub;
