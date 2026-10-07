import { useAuth } from '@/state/auth';

import { API_URL as API } from './config';
import { refreshTokens } from './session';
import { closeSocket } from './socket';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

type Init = { method?: string; body?: unknown; headers?: Record<string, string>; auth?: boolean };

/** Fetch wrapper: JSON in/out, bearer token, one silent token refresh, friendly errors. */
export async function api<T>(path: string, init: Init = {}, retried = false): Promise<T> {
  const token = init.auth === false ? undefined : useAuth.getState().tokens?.accessToken;
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: init.method ?? 'GET',
      headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }), ...init.headers },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'No connection to Chito. Check your internet and try again.');
  }

  if (res.status === 401 && token && !retried && (await refreshTokens())) return api<T>(path, init, true);

  const json = (await res.json().catch(() => ({}))) as { error?: { code: string; message: string } };
  if (!res.ok) {
    if (res.status === 401 && token) {
      // Session truly expired → back to login
      closeSocket();
      useAuth.getState().logout();
    }
    throw new ApiError(res.status, json.error?.code ?? 'ERROR', json.error?.message ?? 'Something went wrong. Please try again.');
  }
  return json as T;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Please try again.');
