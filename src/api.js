import { GAS_URL } from './config.js';

const KEY = 'sfc_token';
let token = '';
try { token = localStorage.getItem(KEY) || ''; } catch { token = ''; }
let onExpired = () => {};

export const getToken = () => token;
export function setToken(t) {
  token = t || '';
  try { if (token) localStorage.setItem(KEY, token); else localStorage.removeItem(KEY); } catch { /* penyimpanan tidak tersedia */ }
}
export const setExpiredHandler = (fn) => { onExpired = fn; };

export async function api(action, params = {}) {
  if (!GAS_URL) throw new Error('VITE_GAS_URL belum diatur. Isi URL Web App Google Apps Script pada environment variable.');
  let res;
  try {
    res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token, params }),
      redirect: 'follow'
    });
  } catch {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new Error('Tidak ada koneksi internet. Periksa jaringan Anda lalu coba lagi.');
    }
    throw new Error('Tidak dapat terhubung ke server. Periksa koneksi internet Anda. Jika internet normal, pastikan VITE_GAS_URL di Vercel adalah URL /exec deployment terbaru, akses Web App \"Anyone\", dan Vercel sudah di-redeploy.');
  }
  let json;
  try { json = await res.json(); } catch {
    throw new Error('Respons server tidak valid. Pastikan URL Web App benar dan akses deployment diatur ke "Anyone".');
  }
  if (!json || json.success !== true) {
    if (json && json.code === 'AUTH') { setToken(''); onExpired(); }
    const err = new Error((json && json.message) || 'Permintaan gagal diproses');
    err.code = json && json.code;
    throw err;
  }
  return json.data;
}
