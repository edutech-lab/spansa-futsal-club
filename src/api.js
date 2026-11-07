import { ROUTES } from './backend/handlers.js';
import { AppError } from './backend/util.js';
import { firebaseReady } from './firebase.js';

/* Sesi aktif (diisi oleh auth.jsx): { uid, role, nisn, username } */
let session = null;
export function setSession(s) { session = s; }
export function getSession() { return session; }

function friendly(e) {
  if (e instanceof AppError) return e;
  const code = e && e.code ? String(e.code) : '';
  if (code === 'permission-denied') return new AppError('Anda tidak memiliki akses ke data ini', 'FORBIDDEN');
  if (code === 'unavailable' || code === 'auth/network-request-failed') return new AppError('Koneksi ke server terputus. Periksa internet Anda lalu coba lagi.', 'NET');
  if (code === 'failed-precondition' && /index/i.test(e.message || '')) return new AppError('Indeks Firestore belum dibuat. Jalankan: firebase deploy --only firestore:indexes', 'INDEX');
  if (code === 'resource-exhausted') return new AppError('Kuota harian Firestore habis. Coba lagi besok atau tingkatkan paket Firebase.', 'QUOTA');
  console.error(e);
  return new AppError('Terjadi kesalahan. Silakan coba lagi.', 'SERVER');
}

export async function api(action, params = {}) {
  const def = ROUTES[action];
  if (!def) throw new AppError('Aksi tidak dikenal: ' + action, 'NOACTION');
  if (!firebaseReady) throw new AppError('Konfigurasi Firebase belum diisi. Lengkapi variabel VITE_FIREBASE_* pada environment.', 'SETUP');
  try {
    if (def.auth === false) return await def.fn(params, null);
    if (!session) throw new AppError('Sesi berakhir, silakan login kembali', 'AUTH');
    if (def.admin && session.role !== 'admin') throw new AppError('Anda tidak memiliki akses ke fitur ini', 'FORBIDDEN');
    return await def.fn(params, session);
  } catch (e) { throw friendly(e); }
}
