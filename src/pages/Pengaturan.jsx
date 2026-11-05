import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Card, Field, PageHead, useUi } from '../ui.jsx';
import { rupiah } from '../utils.js';

const KEYS = ['saldoAwalKas', 'namaKlub', 'namaSekolah', 'logoUrl', 'logoSekolahUrl', 'webSekolah', 'youtube', 'instagram', 'bannerUrl', 'iuranPerPertemuan', 'bobotHadir', 'bobotIndividu', 'batasA', 'batasB', 'batasC'];

export default function Pengaturan() {
  const { settings, setSettings } = useAuth();
  const { toast } = useUi();
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { const o = {}; KEYS.forEach((k) => { o[k] = settings[k] === undefined ? '' : String(settings[k]); }); setF(o); }, [settings]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const num = (k) => (e) => setF({ ...f, [k]: e.target.value.replace(/\D/g, '') });
  const save = async () => {
    setBusy(true);
    try { const r = await api('saveSettings', { settings: f }); setSettings(r); toast('Pengaturan disimpan'); } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHead title="Pengaturan" subtitle="Konfigurasi iuran, penilaian, dan tampilan"><button className="btn" onClick={save} disabled={busy}><Save size={16} />{busy ? 'Menyimpan...' : 'Simpan Pengaturan'}</button></PageHead>
      <div className="grid g-2e">
        <Card title="Iuran & Penilaian" plain>
          <div className="form-grid">
            <Field label="Saldo awal kas (Rp)" hint={`Saldo kas sebelum iuran pertama dicatat: ${rupiah(Number(f.saldoAwalKas) || 0)}. Isi sekali di awal, sebelum input iuran kas.`} className="full"><input className="input" inputMode="numeric" value={f.saldoAwalKas || ''} onChange={num('saldoAwalKas')} placeholder="0" /></Field>
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
