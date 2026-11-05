import { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { DEFAULT_LOGO } from '../config.js';
import { Field } from '../ui.jsx';
import { currentTerm, termOptions } from '../utils.js';

export default function Login() {
  const { login } = useAuth();
  const [info, setInfo] = useState({ namaKlub: 'Spansa Futsal Club', namaSekolah: 'SMP Negeri 1 Bandar Lampung', logoUrl: DEFAULT_LOGO });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [term, setTerm] = useState(currentTerm());
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

  return (
    <div className="login">
      <svg className="court" viewBox="0 0 800 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><g stroke="#fff" strokeWidth="3" fill="none"><circle cx="400" cy="300" r="140" /><path d="M0 200 H800" /><rect x="250" y="120" width="300" height="180" /><path d="M0 300 L250 120 M800 300 L550 120" /></g></svg>
      <form className="login-card" onSubmit={submit}>
        <div className="lg">
          <img src={info.logoUrl || DEFAULT_LOGO} alt="Logo" referrerPolicy="no-referrer" />
          <h1>{info.namaKlub}</h1>
          <div className="mut" style={{ marginTop: 2 }}>{info.namaSekolah}</div>
          <div className="stripe" />
        </div>
        <div className="stack" style={{ gap: 12 }}>
          <Field label="Username / NISN"><input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" inputMode="text" autoFocus placeholder="admin atau NISN anggota" /></Field>
          <Field label="Password">
            <div className="pw">
              <input className="input" type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="Password" />
              <button type="button" onClick={() => setShow(!show)} aria-label="Tampilkan password">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
          </Field>
          <Field label="Tahun Ajaran">
            <select className="input" value={term} onChange={(e) => setTerm(e.target.value)}>
              {termOptions().map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          {error && <div className="err-t" role="alert">{error}</div>}
          <button className="btn" style={{ height: 46 }} disabled={busy}>{busy ? <Loader2 size={18} className="spin" /> : <LogIn size={18} />}{busy ? 'Memproses...' : 'Masuk'}</button>
          <p className="hint c">Anggota: username dan password awal adalah NISN.</p>
        </div>
      </form>
    </div>
  );
}
