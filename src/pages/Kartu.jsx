import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Globe, Instagram, Loader2, Youtube } from 'lucide-react';
import html2canvas from 'html2canvas';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { DEFAULT_LOGO } from '../config.js';
import { Card, ErrorBox, Loading, PageHead, useLoad, useUi } from '../ui.jsx';
import { initials, splitSchool, tglID } from '../utils.js';

const SCHOOL_LOGO = 'https://lh3.googleusercontent.com/d/1GDe6aqXyF_RR6kL3jMCy0vWqaO83jgyp';

function Kartu({ d, logo, logoSekolah, foto, innerRef }) {
  const [l1, l2] = splitSchool(d.namaSekolah);
  return (
    <div className="kartu" ref={innerRef}>
      <div className="k-deco"><i className="a" /><i className="b" /></div>
      <div className="k-top">
        <div className="k-club"><img src={logo} alt="" /><div><b>KARTU ANGGOTA</b><span>{d.namaKlub}</span></div></div>
        <div className="k-school">
          <div className="k-sn"><b>{l1}</b><span>{l2}</span></div>
          <span className="k-sl"><img src={logoSekolah} alt="" /></span>
        </div>
      </div>
      <div className="k-photo">{foto ? <img src={foto} alt="" /> : initials(d.nama)}</div>
      <div className="k-info">
        <small>NAMA</small><div className="nm">{d.nama}</div>
        <small>NISN</small><b>{d.nisn}</b>
        <small>KELAS</small><b>{d.kelas} · {d.jk === 'L' ? 'Laki-laki' : 'Perempuan'}</b>
        <small>BERGABUNG</small><b>{d.tglBergabung ? tglID(d.tglBergabung) : '-'}</b>
      </div>
      <div className="k-foot">
        <span><Globe size={14} color="#1D5FE8" />{d.web}</span>
        <span><Youtube size={14} color="#FF0000" />{d.youtube}</span>
        <span><Instagram size={14} color="#E1306C" />{d.instagram}</span>
      </div>
    </div>
  );
}

const cache = new Map();
async function toData(url) {
  if (!url) return '';
  if (cache.has(url)) return cache.get(url);
  try { const r = await api('imageData', { url }); cache.set(url, r.dataUrl); return r.dataUrl; } catch { return ''; }
}

function CardView({ data }) {
  const { toast } = useUi();
  const { settings } = useAuth();
  const logoUrl = settings.logoUrl || DEFAULT_LOGO;
  const schoolUrl = settings.logoSekolahUrl || SCHOOL_LOGO;
  const [inl, setInl] = useState({ logo: '', school: '', foto: '', ready: false });
  const [scale, setScale] = useState(1);
  const wrap = useRef(null);
  const shot = useRef(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let ok = true;
    setInl((p) => ({ ...p, ready: false }));
    Promise.all([toData(logoUrl), toData(schoolUrl), toData(data.fotoUrl)]).then(([logo, school, foto]) => { if (ok) setInl({ logo, school, foto, ready: true }); });
    return () => { ok = false; };
  }, [logoUrl, schoolUrl, data.fotoUrl]);
  useEffect(() => {
    const fit = () => { if (wrap.current) setScale(Math.min(1, wrap.current.clientWidth / 540)); };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const full = {
    ...data,
    namaKlub: settings.namaKlub || 'Spansa Futsal Club',
    namaSekolah: settings.namaSekolah || 'SMP Negeri 1 Bandar Lampung',
    web: settings.webSekolah || 'smpn1-bandarlampung.sch.id',
    youtube: settings.youtube || 'spansa_official',
    instagram: settings.instagram || 'spansa_official'
  };

  const download = async () => {
    setBusy(true);
    try {
      const imgs = Array.from(shot.current.querySelectorAll('img'));
      await Promise.all(imgs.map((i) => (i.complete ? Promise.resolve() : new Promise((r) => { i.onload = r; i.onerror = r; }))));
      const canvas = await html2canvas(shot.current, { scale: 3, backgroundColor: null, useCORS: true, logging: false });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `kartu_${data.nisn}.png`;
      a.click();
    } catch { toast('Gagal membuat gambar kartu', 'err'); } finally { setBusy(false); }
  };

  return (
    <>
      <div ref={wrap} className="kartu-wrap" style={{ height: 340 * scale }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: 540 }}>
          <Kartu d={full} logo={logoUrl} logoSekolah={schoolUrl} foto={data.fotoUrl} />
        </div>
      </div>
      <div style={{ position: 'fixed', left: -10000, top: 0 }} aria-hidden="true">
        <Kartu d={full} logo={inl.logo || logoUrl} logoSekolah={inl.school || schoolUrl} foto={inl.foto || data.fotoUrl} innerRef={shot} />
      </div>
      <div className="row wrap" style={{ marginTop: 14 }}>
        <button className="btn gold" onClick={download} disabled={busy || !inl.ready}>{busy || !inl.ready ? <Loader2 size={16} className="spin" /> : <Download size={16} />}{inl.ready ? 'Unduh Kartu (PNG)' : 'Menyiapkan gambar...'}</button>
        <span className="hint">Foto kartu mengikuti foto profil.</span>
      </div>
    </>
  );
}

function MyCard({ nisn }) {
  const { data, loading, error, reload } = useLoad(() => api('getKartu', { nisn }), [nisn]);
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  return <CardView data={data} />;
}

export default function KartuPage() {
  const { isAdmin, user } = useAuth();
  const list = useLoad(() => (isAdmin ? api('listAnggota') : Promise.resolve([])), [isAdmin]);
  const [sel, setSel] = useState('');
  const members = list.data || [];
  // anggota pertama langsung terpilih tanpa menunggu efek; kartu tampil dari data daftar (tanpa permintaan tambahan)
  const idx = Math.max(0, members.findIndex((m) => m.nisn === sel));
  const current = members[idx] || null;
  const go = (d) => { const n = members[(idx + d + members.length) % members.length]; if (n) setSel(n.nisn); };

  return (
    <>
      <PageHead title="Kartu Anggota" subtitle="Kartu digital anggota futsal" />
      <Card plain>
        {isAdmin ? (
          list.loading ? <Loading text="Memuat daftar anggota..." /> : list.error ? <ErrorBox message={list.error} onRetry={list.reload} /> : !current ? <p className="mut c" style={{ padding: 24 }}>Belum ada anggota futsal.</p> : (
            <>
              <div className="toolbar">
                <button className="btn sec icon" onClick={() => go(-1)} aria-label="Anggota sebelumnya" disabled={members.length < 2}><ChevronLeft size={18} /></button>
                <select className="input" style={{ maxWidth: 360 }} value={current.nisn} onChange={(e) => setSel(e.target.value)} aria-label="Pilih anggota">
                  {members.map((a) => <option key={a.nisn} value={a.nisn}>{a.nama} ({a.kelas})</option>)}
                </select>
                <button className="btn sec icon" onClick={() => go(1)} aria-label="Anggota berikutnya" disabled={members.length < 2}><ChevronRight size={18} /></button>
                <span className="hint">{idx + 1} dari {members.length}</span>
              </div>
              <CardView key={current.nisn} data={current} />
            </>
          )
        ) : <MyCard nisn={user.nisn} />}
      </Card>
    </>
  );
}
