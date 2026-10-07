import { useAuth } from '@/state/auth';

import { API_URL } from './config';

/** Tell the server this session is over, so the saved refresh token can't be reused. Never blocks logging out. */
export function endServerSession() {
  const refreshToken = useAuth.getState().tokens?.refreshToken;
  if (!refreshToken) return;
  fetch(`${API_URL}/auth/logout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  }).catch(() => undefined);
}

/** Swap the refresh token for a new access token. Shared by the API client and the live socket. */
export async function refreshTokens(): Promise<boolean> {
  const refreshToken = useAuth.getState().tokens?.refreshToken;
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    useAuth.getState().setTokens((await res.json()) as { accessToken: string; refreshToken: string });
    return true;
  } catch {
    return false;
  }
}
