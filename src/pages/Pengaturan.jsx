import { useEffect, useState } from 'react';
import { Lock, LockOpen, Save, TriangleAlert } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Card, Field, PageHead, useUi } from '../ui.jsx';
import { rupiah } from '../utils.js';

const KEYS = ['saldoAwalKas', 'namaBendahara', 'namaPembina', 'namaKlub', 'namaSekolah', 'logoUrl', 'logoSekolahUrl', 'webSekolah', 'youtube', 'instagram', 'bannerUrl', 'iuranPerPertemuan', 'bobotHadir', 'bobotIndividu', 'batasA', 'batasB', 'batasC'];

export default function Pengaturan() {
  const { settings, setSettings } = useAuth();
  const { toast, confirm } = useUi();
  const locked = settings.saldoAwalTerkunci === '1';
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { const o = {}; KEYS.forEach((k) => { o[k] = settings[k] === undefined ? '' : String(settings[k]); }); setF(o); }, [settings]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const num = (k) => (e) => setF({ ...f, [k]: e.target.value.replace(/\D/g, '') });
  const save = async () => {
    setBusy(true);
    try {
      const r = await api('saveSettings', { settings: f });
      setSettings(r);
      if (r.saldoAwalTerkunci === undefined || String(r.saldoAwalKas) !== String(f.saldoAwalKas)) {
        toast('Disimpan, tetapi saldo awal tidak tercatat: backend belum diperbarui. Deploy Code.gs terbaru sebagai versi baru.', 'err');
      } else toast('Pengaturan disimpan');
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const unlock = async () => {
    const ok = await confirm('PERINGATAN: mengubah saldo awal kas akan menggeser seluruh saldo di Rekap Keuangan dan Dashboard untuk semua semester. Buka kunci hanya bila saldo awal memang salah input. Lanjutkan?', { danger: true, okText: 'Ya, buka kunci' });
    if (!ok) return;
    try { const r = await api('unlockSaldoAwal'); setSettings(r); toast('Kunci dibuka. Ubah nilai lalu simpan; saldo akan terkunci kembali.'); } catch (e) { toast(e.message, 'err'); }
  };
  return (
    <>
      <PageHead title="Pengaturan" subtitle="Konfigurasi iuran, penilaian, dan tampilan"><button className="btn" onClick={save} disabled={busy}><Save size={16} />{busy ? 'Menyimpan...' : 'Simpan Pengaturan'}</button></PageHead>
      <div className="grid g-2e">
        <Card title="Iuran & Penilaian" plain>
          <div className="form-grid">
            <div className="field full">
              <span>Saldo awal kas (Rp)</span>
              <div className="lockrow">
                <input className="input" inputMode="numeric" value={f.saldoAwalKas || ''} disabled={locked} onChange={num('saldoAwalKas')} placeholder="0" aria-label="Saldo awal kas" />
                {locked && <button type="button" className="btn sec" onClick={unlock}><LockOpen size={16} />Buka Kunci</button>}
              </div>
              {locked ? (
                <span className="hint lockbadge"><Lock size={13} color="#047857" />Terkunci · {rupiah(Number(settings.saldoAwalKas) || 0)}{settings.saldoAwalCatatan ? ` · dikunci ${settings.saldoAwalCatatan}` : ''}</span>
              ) : (
                <span className="hint lockbadge"><TriangleAlert size={13} color="#B45309" />Saldo kas sebelum iuran pertama dicatat ({rupiah(Number(f.saldoAwalKas) || 0)}). Isi sekali di awal; setelah disimpan akan terkunci. Perubahan di kemudian hari menggeser seluruh saldo semua semester.</span>
              )}
            </div>
            <Field label="Iuran kas per pertemuan (Rp)" hint="Hanya berlaku untuk pertemuan baru; data lama tidak berubah" className="full"><input className="input" inputMode="numeric" value={f.iuranPerPertemuan || ''} onChange={num('iuranPerPertemuan')} /></Field>
            <Field label="Bobot kehadiran (%)"><input className="input" inputMode="numeric" value={f.bobotHadir || ''} onChange={num('bobotHadir')} /></Field>
            <Field label="Bobot kemampuan individu (%)"><input className="input" inputMode="numeric" value={f.bobotIndividu || ''} onChange={num('bobotIndividu')} /></Field>
            <Field label="Batas predikat A (≥)"><input className="input" inputMode="numeric" value={f.batasA || ''} onChange={num('batasA')} /></Field>
            <Field label="Batas predikat B (≥)"><input className="input" inputMode="numeric" value={f.batasB || ''} onChange={num('batasB')} /></Field>
            <Field label="Batas predikat C (≥)" hint="Di bawah batas C = D"><input className="input" inputMode="numeric" value={f.batasC || ''} onChange={num('batasC')} /></Field>
          </div>
        </Card>
        <Card title="Identitas & Tampilan" plain>
          <div className="stack" style={{ gap: 12 }}>
            <Field label="Nama bendahara (tanda tangan nota)"><input className="input" value={f.namaBendahara || ''} onChange={set('namaBendahara')} maxLength={60} /></Field>
            <Field label="Nama pembina (tanda tangan nota)"><input className="input" value={f.namaPembina || ''} onChange={set('namaPembina')} maxLength={60} /></Field>
            <Field label="Nama klub"><input className="input" value={f.namaKlub || ''} onChange={set('namaKlub')} /></Field>
            <Field label="Nama sekolah"><input className="input" value={f.namaSekolah || ''} onChange={set('namaSekolah')} /></Field>
            <Field label="URL logo klub"><input className="input" value={f.logoUrl || ''} onChange={set('logoUrl')} placeholder="https://..." /></Field>
            <Field label="URL logo sekolah (kartu anggota)"><input className="input" value={f.logoSekolahUrl || ''} onChange={set('logoSekolahUrl')} placeholder="https://..." /></Field>
            <Field label="Website sekolah"><input className="input" value={f.webSekolah || ''} onChange={set('webSekolah')} /></Field>
            <div className="form-grid">
              <Field label="YouTube"><input className="input" value={f.youtube || ''} onChange={set('youtube')} /></Field>
              <Field label="Instagram"><input className="input" value={f.instagram || ''} onChange={set('instagram')} /></Field>
            </div>
            <Field label="URL foto banner (opsional)" hint="Kosongkan untuk memakai banner vektor bawaan"><input className="input" value={f.bannerUrl || ''} onChange={set('bannerUrl')} placeholder="https://..." /></Field>
          </div>
        </Card>
      </div>
    </>
  );
}
