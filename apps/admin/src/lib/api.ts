'use client';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const KEY = 'chito-admin-session';

type Session = { accessToken: string; refreshToken: string };

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

// Stored in localStorage for v1. TODO(security): move to httpOnly cookies before going public.
export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function setSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    // storage unavailable (private mode) — session lasts until reload
  }
}

/** Log out here and end the session on the server too, so the saved refresh token can't be reused. */
export function logoutSession() {
  const s = getSession();
  setSession(null);
  if (s) {
    // Fire-and-forget: logging out must work even when the API is unreachable
    fetch(`${API}/auth/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: s.refreshToken }),
    }).catch(() => undefined);
  }
}

/** Get a fresh access token using the refresh token (also used by the live socket). */
export async function refresh(): Promise<boolean> {
  const s = getSession();
  if (!s) return false;
  const res = await fetch(`${API}/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: s.refreshToken }),
  });
  if (!res.ok) return false;
  setSession((await res.json()) as Session);
  return true;
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}, retried = false): Promise<T> {
  const s = getSession();
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: init.method ?? 'GET',
      headers: { 'content-type': 'application/json', ...(s && { authorization: `Bearer ${s.accessToken}` }) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Can’t reach the Chito server. Is it running?');
  }
  if (res.status === 401 && !retried && !path.startsWith('/admin/auth') && (await refresh())) {
    return api<T>(path, init, true);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/admin/auth')) {
      setSession(null);
      // Hard redirect from a non-component helper is intentional: drop all in-memory state
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      if (typeof window !== 'undefined') window.location.href = '/login';
    }
    const e = (json as { error?: { code: string; message: string } }).error;
    throw new ApiError(res.status, e?.code ?? 'ERROR', e?.message ?? `Request failed (${res.status})`);
  }
  return json as T;
}

export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000';
