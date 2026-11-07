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
  const c = e && e.code;
  if (c === 'auth/user-disabled') return new AppError('Akun dinonaktifkan. Hubungi admin.', 'AUTH');
  if (c === 'auth/too-many-requests') return new AppError('Terlalu banyak percobaan gagal. Coba lagi beberapa menit lagi.', 'RATE');
  if (c === 'auth/network-request-failed') return new AppError('Tidak dapat terhubung. Periksa koneksi internet Anda.', 'NET');
  if (c === 'auth/operation-not-allowed') return new AppError('Metode Email/Password belum diaktifkan di Firebase Authentication.', 'SETUP');
  if (e instanceof AppError) return e;
  return new AppError('Username atau password salah', 'AUTH');
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
    manual.current = true;
    try {
      let cred;
      try { cred = await signInWithEmailAndPassword(auth, toEmail(username), password); } catch (e) { throw loginError(e); }
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
