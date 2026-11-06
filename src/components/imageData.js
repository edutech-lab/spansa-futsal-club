import { api } from '../api.js';

const cache = new Map();
/* Mengubah gambar Google (logo, foto) menjadi data URL agar aman dipakai html2canvas. */
export async function toData(url) {
  if (!url) return '';
  if (cache.has(url)) return cache.get(url);
  try { const r = await api('imageData', { url }); cache.set(url, r.dataUrl); return r.dataUrl; } catch { return ''; }
}
