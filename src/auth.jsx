import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { api, setSession } from './api.js';
import { auth, firebaseReady } from './firebase.js';
import { AppError } from './backend/util.js';
import { toEmail } from './backend/handlers.js';
import { currentTerm, termOptions } from './utils.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

const TERM_KEY = 'sfc_term';
function initialTerm() {
  try {
    const t = localStorage.getItem(TERM_KEY);
    if (t && termOptions().includes(t)) return t;
  } catch { /* abaikan */ }
  const cur = currentTerm();
  return termOptions().includes(cur) ? cur : termOptions()[0];
}

function loginError(e) {
  if (e instanceof AppError) return e;
  const c = String((e && e.code) || '');
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email', 'auth/missing-password'].includes(c)) return new AppError('Username atau password salah', 'AUTH');
  if (c === 'auth/user-disabled') return new AppError('Akun dinonaktifkan. Hubungi admin.', 'AUTH');
  if (c === 'auth/too-many-requests') return new AppError('Terlalu banyak percobaan gagal. Coba lagi beberapa menit lagi.', 'RATE');
  if (c === 'auth/network-request-failed') return new AppError('Tidak dapat terhubung. Periksa koneksi internet Anda.', 'NET');
  if (c === 'auth/operation-not-allowed') return new AppError('Metode Email/Password belum diaktifkan di Firebase Authentication.', 'SETUP');
  if (c === 'auth/invalid-api-key' || c === 'auth/api-key-not-valid.-please-pass-a-valid-api-key.') return new AppError('API key Firebase tidak valid. Periksa VITE_FIREBASE_API_KEY di Vercel, lalu redeploy.', 'SETUP');
  if (c === 'auth/configuration-not-found') return new AppError('Firebase Authentication belum diaktifkan. Buka Build > Authentication > Get started.', 'SETUP');
  if (c === 'auth/unauthorized-domain') return new AppError('Domain ini belum diizinkan. Tambahkan di Authentication > Settings > Authorized domains.', 'SETUP');
  if (c === 'permission-denied') return new AppError('Akses data ditolak. Pastikan firestore.rules sudah dipublikasikan.', 'FORBIDDEN');
  return new AppError('Gagal masuk' + (c ? ' (' + c + ')' : '') + '. Hubungi admin dengan menyertakan kode ini.', 'ERR');
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({});
  const [term, setTermState] = useState(initialTerm);
  const [booting, setBooting] = useState(firebaseReady);
  const manual = useRef(false);

  const setTerm = useCallback((t) => {
    setTermState(t);
    try { localStorage.setItem(TERM_KEY, t); } catch { /* abaikan */ }
  }, []);

  /* Peran berasal dari Custom Claims yang hanya bisa diisi server (Admin SDK). */
  const loadProfile = useCallback(async (fb) => {
    const { claims } = await fb.getIdTokenResult();
    if (!claims.role) throw new AppError('Akun belum disiapkan oleh admin. Hubungi admin.', 'AUTH');
    setSession({ uid: fb.uid, role: claims.role, nisn: claims.nisn || '', username: '' });
    const d = await api('me');
    setSession({ uid: fb.uid, role: claims.role, nisn: claims.nisn || '', username: d.user.username });
    setSettings(d.settings);
    setUser(d.user);
    // Admin: pastikan daftar anggota untuk tampilan anggota selalu mutakhir (tanpa menunggu admin membuka menu).
    if (claims.role === 'admin') api('syncRoster').catch(() => {});
  }, []);

  useEffect(() => {
    if (!firebaseReady) return undefined;
    return onAuthStateChanged(auth, async (fb) => {
      if (manual.current) return;
      if (!fb) { setSession(null); setUser(null); setBooting(false); return; }
      try { await loadProfile(fb); } catch { await signOut(auth).catch(() => {}); setSession(null); setUser(null); } finally { setBooting(false); }
    });
  }, [loadProfile]);

  const login = useCallback(async (username, password, selTerm) => {
    if (!firebaseReady) throw new AppError('Konfigurasi Firebase belum diisi. Lengkapi variabel VITE_FIREBASE_* di Vercel lalu redeploy.', 'SETUP');
    manual.current = true;
    try {
      let cred;
      try { cred = await signInWithEmailAndPassword(auth, toEmail(username), password); } catch (e) {
        // NISN 10 digit sering kehilangan angka 0 di depan (mis. dari Excel / diketik tanpa 0): coba versi 10 digit.
        const u = String(username).trim();
        const wrong = ['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password'].includes(e && e.code);
        if (!(wrong && /^\d{6,9}$/.test(u))) throw loginError(e);
        const full = u.padStart(10, '0');
        try { cred = await signInWithEmailAndPassword(auth, toEmail(full), password === u ? full : password); } catch { throw loginError(e); }
      }
      try { await loadProfile(cred.user); } catch (e) { await signOut(auth).catch(() => {}); setSession(null); throw loginError(e); }
      setTerm(selTerm);
    } finally { manual.current = false; }
  }, [loadProfile, setTerm]);

  const logout = useCallback(async () => {
    await signOut(auth).catch(() => {});
    setSession(null);
    setUser(null);
  }, []);

  const value = { user, setUser, settings, setSettings, term, setTerm, login, logout, booting, isAdmin: !!user && user.role === 'admin' };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
