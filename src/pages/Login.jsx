import { useEffect, useState } from 'react';
import { AlertCircle, CalendarDays, ClipboardCheck, CreditCard, Eye, EyeOff, Loader2, Lock, LogIn, Trophy, User, Wallet } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { DEFAULT_LOGO } from '../config.js';
import { currentTerm, termOptions } from '../utils.js';

const FEATURES = [
  [ClipboardCheck, 'Presensi & rekap latihan', 'Kehadiran tiap pertemuan tercatat otomatis'],
  [Wallet, 'Kas klub transparan', 'Iuran, pemasukan, dan pengeluaran tertata rapi'],
  [Trophy, 'Jadwal & formasi pertandingan', 'Informasi laga selalu terbaru untuk seluruh anggota'],
  [CreditCard, 'Kartu anggota digital', 'Dapat diunduh kapan saja dalam format gambar']
];

export default function Login() {
  const { login } = useAuth();
  const [info, setInfo] = useState({ namaKlub: 'Spansa Futsal Club', namaSekolah: 'SMP Negeri 1 Bandar Lampung', logoUrl: DEFAULT_LOGO });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [term, setTerm] = useState(() => { const t = currentTerm(); return termOptions().includes(t) ? t : termOptions()[0]; });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { api('publicInfo').then((d) => setInfo((p) => ({ ...p, ...d }))).catch(() => {}); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) return setError('Username dan password wajib diisi');
    setBusy(true);
    try { await login(username.trim(), password, term); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const logo = info.logoUrl || DEFAULT_LOGO;

  return (
    <div className="auth">
      <aside className="auth-brand">
        <svg className="auth-court" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g stroke="#fff" strokeWidth="3" fill="none"><rect x="60" y="60" width="680" height="480" rx="6" /><path d="M400 60 V540" /><circle cx="400" cy="300" r="90" /><rect x="60" y="190" width="120" height="220" /><rect x="620" y="190" width="120" height="220" /><circle cx="400" cy="300" r="5" fill="#fff" /></g></svg>
        <div className="auth-brand-in">
          <div className="auth-logo"><img src={logo} alt="Logo klub" referrerPolicy="no-referrer" /></div>
          <h1>{info.namaKlub}</h1>
          <div className="auth-school">{info.namaSekolah}</div>
          <div className="auth-rule" />
          <p className="auth-lead">Sistem informasi untuk mengelola keanggotaan, latihan, pertandingan, dan keuangan klub futsal sekolah.</p>
          <ul className="auth-feats">
            {FEATURES.map(([I, t, d]) => (
              <li key={t}><span className="ico"><I size={18} /></span><span><b>{t}</b><small>{d}</small></span></li>
            ))}
          </ul>
        </div>
        <div className="auth-copy">&copy; {new Date().getFullYear()} {info.namaKlub}</div>
      </aside>

      <main className="auth-panel">
        <form className="auth-form" onSubmit={submit} noValidate>
          <div className="auth-mobile-brand">
            <div className="auth-logo sm"><img src={logo} alt="Logo klub" referrerPolicy="no-referrer" /></div>
            <div><b>{info.namaKlub}</b><small>{info.namaSekolah}</small></div>
          </div>
          <h2>Selamat datang</h2>
          <p className="auth-sub">Masuk untuk melanjutkan ke dashboard klub.</p>

          <label className="afield">
            <span>Username / NISN</span>
            <div className="aw"><User size={18} /><input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus placeholder="admin atau NISN anggota" /></div>
          </label>
          <label className="afield">
            <span>Password</span>
            <div className="aw">
              <Lock size={18} />
              <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="Masukkan password" />
              <button type="button" className="eye" onClick={() => setShow(!show)} aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
          </label>
          <label className="afield">
            <span>Tahun Ajaran</span>
            <div className="aw sel">
              <CalendarDays size={18} />
              <select value={term} onChange={(e) => setTerm(e.target.value)}>
                {termOptions().map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </label>

          {error && <div className="auth-err" role="alert"><AlertCircle size={17} /><span>{error}</span></div>}

          <button className="auth-btn" disabled={busy}>
            {busy ? <Loader2 size={19} className="spin" /> : <LogIn size={19} />}{busy ? 'Memproses...' : 'Masuk'}
          </button>
          <p className="auth-hint">Anggota: username dan password awal adalah NISN.</p>
        </form>
      </main>
    </div>
  );
}
