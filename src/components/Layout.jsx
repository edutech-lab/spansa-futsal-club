import { useEffect, useRef, useState } from 'react';
import { Award, Banknote, Bell, CalendarDays, Camera, ChevronDown, ClipboardCheck, Coins, CreditCard, GraduationCap, Home, Images, KeyRound, LayoutGrid, LogOut, Menu, PiggyBank, Receipt, Settings, Users, Wallet } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { DEFAULT_LOGO, REQUIRED_API } from '../config.js';
import { Avatar, Field, Modal, useUi } from '../ui.jsx';
import { fileToResizedBase64, hariTgl, termOptions } from '../utils.js';

export const MENU = [
  { path: 'dashboard', label: 'Dashboard', icon: Home, roles: ['admin', 'anggota'], grp: 'Utama' },
  { path: 'siswa', label: 'Data Siswa', icon: GraduationCap, roles: ['admin'], grp: 'Keanggotaan' },
  { path: 'anggota', label: 'Anggota Futsal', icon: Users, roles: ['admin'], grp: 'Keanggotaan' },
  { path: 'kartu', label: 'Kartu Anggota', icon: CreditCard, roles: ['admin', 'anggota'], grp: 'Keanggotaan' },
  { path: 'galeri', label: 'Galeri', icon: Images, roles: ['admin', 'anggota'], grp: 'Keanggotaan' },
  { path: 'hadir', label: 'Daftar Hadir', icon: ClipboardCheck, roles: ['admin'], grp: 'Latihan & Pertandingan' },
  { path: 'jadwal', label: 'Jadwal Pertandingan', icon: CalendarDays, roles: ['admin'], grp: 'Latihan & Pertandingan' },
  { path: 'formasi', label: 'Formasi', icon: LayoutGrid, roles: ['admin'], grp: 'Latihan & Pertandingan' },
  { path: 'nilai', label: 'Nilai', icon: Award, roles: ['admin'], grp: 'Latihan & Pertandingan' },
  { path: 'rekap-hadir', label: 'Rekap Kehadiran', icon: ClipboardCheck, roles: ['admin', 'anggota'], grp: 'Latihan & Pertandingan' },
  { path: 'rekap-iuran', label: 'Rekap Iuran', icon: Coins, roles: ['admin'], grp: 'Keuangan' },
  { path: 'pemasukan', label: 'Pemasukan Kas', icon: Banknote, roles: ['admin'], grp: 'Keuangan' },
  { path: 'pengeluaran', label: 'Pengeluaran Kas', icon: Receipt, roles: ['admin'], grp: 'Keuangan' },
  { path: 'rekap-kas', label: 'Rekap Keuangan', icon: PiggyBank, roles: ['admin'], grp: 'Keuangan' },
  { path: 'pengaturan', label: 'Pengaturan', icon: Settings, roles: ['admin'], grp: 'Sistem' }
];

function PasswordModal({ open, onClose }) {
  const { toast } = useUi();
  const [f, setF] = useState({ oldPassword: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setF({ oldPassword: '', newPassword: '', confirm: '' }); }, [open]);
  const save = async () => {
    if (f.newPassword.length < 6) return toast('Password baru minimal 6 karakter', 'err');
    if (f.newPassword !== f.confirm) return toast('Konfirmasi password tidak sama', 'err');
    setBusy(true);
    try {
      await api('changePassword', { oldPassword: f.oldPassword, newPassword: f.newPassword });
      toast('Password berhasil diganti');
      onClose();
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open={open} onClose={onClose} title="Ganti Password" footer={<><button className="btn sec" onClick={onClose}>Batal</button><button className="btn" disabled={busy} onClick={save}>{busy ? 'Menyimpan...' : 'Simpan'}</button></>}>
      <div className="stack" style={{ gap: 12 }}>
        <Field label="Password saat ini"><input className="input" type="password" autoComplete="current-password" value={f.oldPassword} onChange={set('oldPassword')} /></Field>
        <Field label="Password baru" hint="Minimal 6 karakter"><input className="input" type="password" autoComplete="new-password" value={f.newPassword} onChange={set('newPassword')} /></Field>
        <Field label="Ulangi password baru"><input className="input" type="password" autoComplete="new-password" value={f.confirm} onChange={set('confirm')} /></Field>
      </div>
    </Modal>
  );
}

export default function Layout({ route, children }) {
  const { user, setUser, settings, term, setTerm, logout, isAdmin, apiVersion } = useAuth();
  const { toast } = useUi();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [pop, setPop] = useState('');
  const [pw, setPw] = useState(false);
  const [up, setUp] = useState([]);
  const fileRef = useRef(null);
  const menu = MENU.filter((m) => m.roles.includes(user.role));
  const groups = menu.reduce((acc, m) => { const g = acc.find((x) => x.name === m.grp); if (g) g.items.push(m); else acc.push({ name: m.grp, items: [m] }); return acc; }, []);
  const cur = MENU.find((m) => m.path === route);

  useEffect(() => { setOpen(false); setPop(''); window.scrollTo(0, 0); }, [route]);
  useEffect(() => { api('upcoming').then(setUp).catch(() => setUp([])); }, [route === 'jadwal']);
  useEffect(() => {
    const close = (e) => { if (!e.target.closest('[data-pop]')) setPop(''); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const onPhoto = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      toast('Mengunggah foto...');
      const img = await fileToResizedBase64(file);
      const d = await api('updatePhoto', img);
      setUser({ ...user, fotoUrl: d.fotoUrl });
      toast('Foto profil diperbarui');
    } catch (err) { toast(err.message, 'err'); }
  };

  const bottom = isAdmin
    ? [['dashboard', 'Home', Home], ['hadir', 'Hadir', ClipboardCheck], ['rekap-kas', 'Kas', Wallet], ['kartu', 'Kartu', CreditCard]]
    : [['dashboard', 'Home', Home], ['rekap-hadir', 'Hadir', ClipboardCheck], ['kartu', 'Kartu', CreditCard], ['galeri', 'Galeri', Images]];

  return (
    <div className={(open ? 'open ' : '') + (collapsed ? 'collapsed' : '')}>
      <aside className="sidebar">
        <div className="sb-brand">
          <img src={settings.logoUrl || DEFAULT_LOGO} alt="Logo" referrerPolicy="no-referrer" />
          <b>{settings.namaKlub || 'Spansa Futsal Club'}</b>
        </div>
        <nav className="sb-nav">
          {groups.map((g, gi) => (
            <div key={g.name} className="sb-g">
              {gi > 0 && <div className="sb-sep" />}
              {gi > 0 && <div className="sb-grp">{g.name}</div>}
              {g.items.map((m) => (
                <a key={m.path} href={'#/' + m.path} className={route === m.path ? 'on' : ''}><m.icon size={20} />{m.label}</a>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <div className="overlay" onClick={() => setOpen(false)} />
      <div className="main">
        <header className="header">
          <button className="iconbtn" aria-label="Menu" onClick={() => (window.innerWidth <= 1024 ? setOpen(!open) : setCollapsed(!collapsed))}><Menu size={24} /></button>
          <div className="h-title grow">{cur ? cur.label : 'Spansa Futsal Club'}</div>
          <select className="term-sel" value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Tahun ajaran">
            {termOptions().map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <div style={{ position: 'relative' }} data-pop>
            <button className="iconbtn" aria-label="Pengingat pertandingan" onClick={() => setPop(pop === 'bell' ? '' : 'bell')}>
              <Bell size={22} />{up.length > 0 && <span className="badge-n">{up.length}</span>}
            </button>
            {pop === 'bell' && (
              <div className="pop" style={{ minWidth: 270 }}>
                <div className="b" style={{ padding: '6px 12px', color: 'var(--navy)' }}>Pertandingan 14 hari ke depan</div>
                {up.length === 0 && <div className="mut" style={{ padding: '8px 12px' }}>Tidak ada jadwal terdekat</div>}
                {up.map((j) => { const t = hariTgl(j.tanggal); return (
                  <a key={j.id} href="#/dashboard" style={{ borderRadius: 10 }}><span className="chip">{t.hari} {t.tgl} {t.bln}</span><span>vs {j.lawan}<br /><small className="mut">{j.jam} WIB · {j.lokasi}</small></span></a>
                ); })}
              </div>
            )}
          </div>
          <div style={{ position: 'relative' }} data-pop>
            <button className="profile" onClick={() => setPop(pop === 'me' ? '' : 'me')}>
              <Avatar src={user.fotoUrl} name={user.nama} size={38} /><span className="pn">{isAdmin ? 'Admin' : user.nama.split(' ')[0]}</span><ChevronDown size={16} />
            </button>
            {pop === 'me' && (
              <div className="pop">
                <div style={{ padding: '8px 12px' }}><div className="b" style={{ color: 'var(--navy)' }}>{user.nama}</div><div className="hint">{isAdmin ? 'Administrator' : `NISN ${user.nisn}`}</div></div>
                <button onClick={() => { setPop(''); fileRef.current.click(); }}><Camera size={18} />Ganti foto profil</button>
                <button onClick={() => { setPop(''); setPw(true); }}><KeyRound size={18} />Ganti password</button>
                <button onClick={logout} style={{ color: '#B91C1C' }}><LogOut size={18} />Keluar</button>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto} />
        </header>
        <main className="content">
          {isAdmin && apiVersion !== REQUIRED_API && (
            <div className="warnbar" role="alert">Backend (Google Apps Script) belum diperbarui ke versi terbaru. Tempel Code.gs terbaru, lalu Deploy &gt; Manage deployments &gt; Edit &gt; Version: New version &gt; Deploy. Sebelum itu, fitur baru (saldo awal terkunci, pemasukan, nota, galeri) belum berfungsi.</div>
          )}
          {children}
        </main>
      </div>
      <nav className="bottom-nav">
        {bottom.map(([p, l, I]) => <a key={p} href={'#/' + p} className={route === p ? 'on' : ''}><I size={21} />{l}</a>)}
        <button onClick={() => setOpen(true)}><Menu size={21} />Menu</button>
      </nav>
      <PasswordModal open={pw} onClose={() => setPw(false)} />
    </div>
  );
}
