/* Pemanggilan layanan eksternal: (1) Vercel Function /api/admin, (2) layanan file Google Drive (Apps Script). */
import { auth } from '../firebase.js';
import { DRIVE_URL } from '../config.js';
import { AppError } from './util.js';

async function idToken() {
  const u = auth.currentUser;
  if (!u) throw new AppError('Silakan login terlebih dahulu', 'AUTH');
  return u.getIdToken();
}

async function parse(res, fallback) {
  let json;
  try { json = await res.json(); } catch { throw new AppError(fallback, 'REMOTE'); }
  if (!json || json.success !== true) throw new AppError((json && json.message) || fallback, (json && json.code) || 'REMOTE');
  return json.data;
}

/* Operasi akun yang butuh Firebase Admin SDK: ensureAccounts, disableAccounts, deleteAccounts, resetPassword */
export async function adminApi(action, params = {}) {
  const token = await idToken();
  let res;
  try {
    res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ action, params })
    });
  } catch {
    throw new AppError('Tidak dapat menghubungi server akun. Periksa koneksi internet Anda. Saat pengembangan lokal, jalankan "vercel dev" agar folder /api aktif.', 'REMOTE');
  }
  return parse(res, 'Respons server akun tidak valid. Pastikan Vercel Function /api/admin sudah ter-deploy dan variabel FIREBASE_* sudah diisi.');
}

/* Layanan file Google Drive: upload, trash, imageData */
export async function driveApi(action, params = {}) {
  if (!DRIVE_URL) throw new AppError('VITE_DRIVE_URL belum diatur. Isi URL Web App layanan file Google Drive pada environment variable.', 'SETUP');
  const token = await idToken();
  let res;
  try {
    res = await fetch(DRIVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, idToken: token, params }),
      redirect: 'follow'
    });
  } catch {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new AppError('Tidak ada koneksi internet. Periksa jaringan Anda lalu coba lagi.', 'REMOTE');
    throw new AppError('Tidak dapat terhubung ke layanan file Google Drive. Pastikan VITE_DRIVE_URL adalah URL /exec deployment terbaru, akses Web App "Anyone", lalu redeploy Vercel.', 'REMOTE');
  }
  return parse(res, 'Respons layanan file tidak valid. Pastikan URL Web App benar dan akses deployment diatur ke "Anyone".');
}
