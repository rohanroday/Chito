'use client';

import { api } from './api';

const MAX_BYTES = 5 * 1024 * 1024;

/** Read a picked photo and upload it via the API (ImageKit key stays on the server). Returns the ImageKit path. */
export async function uploadProductPhoto(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Use a JPG, PNG or WEBP photo');
  if (file.size > MAX_BYTES) throw new Error('Photo is too big (max 5 MB)');
  const dataBase64 = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Could not read the photo'));
    r.readAsDataURL(file);
  });
  const { path } = await api<{ path: string }>('/admin/uploads', { method: 'POST', body: { fileName: file.name, dataBase64 } });
  return path;
}
