import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setExpiredHandler, setToken } from './api.js';
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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({});
  const [term, setTermState] = useState(initialTerm);
  const [booting, setBooting] = useState(!!getToken());
  const [apiVersion, setApiVersion] = useState('');

  const setTerm = useCallback((t) => {
    setTermState(t);
    try { localStorage.setItem(TERM_KEY, t); } catch { /* abaikan */ }
  }, []);

  useEffect(() => {
    setExpiredHandler(() => { setUser(null); });
    if (!getToken()) return;
    api('me').then((d) => { setUser(d.user); setSettings(d.settings); setApiVersion(d.version || 'lama'); }).catch(() => { setToken(''); }).finally(() => setBooting(false));
  }, []);

  const login = useCallback(async (username, password, selTerm) => {
    const d = await api('login', { username, password });
    setToken(d.token);
    setTerm(selTerm);
    setSettings(d.settings);
    setApiVersion(d.version || 'lama');
    setUser(d.user);
  }, [setTerm]);

  const logout = useCallback(async () => {
    try { await api('logout'); } catch { /* sesi sudah berakhir */ }
    setToken('');
    setUser(null);
  }, []);

  const value = { apiVersion, user, setUser, settings, setSettings, term, setTerm, login, logout, booting, isAdmin: !!user && user.role === 'admin' };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
