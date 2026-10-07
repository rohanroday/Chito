export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
export const SOCKET_URL = API_URL.replace(/\/api\/v1\/?$/, '');
