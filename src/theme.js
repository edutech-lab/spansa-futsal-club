const KEY = 'theme';

export function getTheme() {
  try { const t = localStorage.getItem(KEY); if (t === 'dark' || t === 'light') return t; } catch { /* abaikan */ }
  return 'light';
}

export function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', t === 'dark' ? '#010309' : '#266FF2');
}

export function saveTheme(t) {
  try { localStorage.setItem(KEY, t); } catch { /* abaikan */ }
  applyTheme(t);
}
