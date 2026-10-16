const raw = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
// "/api/v1" (one-container deploy, see Dockerfile): the API lives on the same site as the web page.
// Made absolute so the socket client (which needs a full address) connects to this site too.
const sameSite = raw.startsWith('/') && typeof window !== 'undefined' && window.location ? window.location.origin : '';
export const API_URL = sameSite + raw;
export const SOCKET_URL = API_URL.replace(/\/api\/v1\/?$/, '');
