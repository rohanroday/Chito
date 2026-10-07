const ENDPOINT = process.env.EXPO_PUBLIC_IMAGEKIT_URL_ENDPOINT ?? '';

/**
 * The API returns ImageKit paths like "/chito/products/dairy/amul-butter.jpg".
 * ImageKit resizes + picks the best format (f-auto) per device, keeping thumbnails tiny for slow hill networks.
 */
export function imageUrl(path: string | undefined, width: number): string {
  if (!path) return '';
  return `${ENDPOINT}${path.startsWith('/') ? path : `/${path}`}?tr=w-${width},f-auto,q-80`;
}
