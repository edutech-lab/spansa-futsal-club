import { useEffect, useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { DEFAULT_LOGO } from '../config.js';
import { Card, ErrorBox, Loading, PageHead, useLoad, useUi } from '../ui.jsx';
import { initials, tglID } from '../utils.js';

function Kartu({ d, logo, foto, innerRef }) {
  return (
    <div className="kartu" ref={innerRef}>
      <div className="k-strip" /><div className="k-strip2" />
      <div className="k-top"><img src={logo} alt="" /><div><b>KARTU ANGGOTA</b><span>{d.namaKlub}</span></div></div>
      <div className="k-photo">{foto ? <img src={foto} alt="" /> : initials(d.nama)}</div>
      <div className="k-info">
        <small>NAMA</small><div className="nm">{d.nama}</div>
        <small>NISN</small><b>{d.nisn}</b>
        <small>KELAS</small><b>{d.kelas} · {d.jk === 'L' ? 'Laki-laki' : 'Perempuan'}</b>
        <small>BERGABUNG</small><b>{d.tglBergabung ? tglID(d.tglBergabung) : '-'}</b>
      </div>
      <div className="k-foot">{d.namaSekolah}</div>
    </div>
  );
}

const cache = new Map();
async function toData(url) {
  if (!url) return '';
  if (cache.has(url)) return cache.get(url);
  try { const r = await api('imageData', { url }); cache.set(url, r.dataUrl); return r.dataUrl; } catch { return ''; }
}

function CardView({ nisn }) {
  const { toast } = useUi();
  const { settings } = useAuth();
  const { data, loading, error, reload } = useLoad(() => api('getKartu', { nisn }), [nisn]);
  const [inl, setInl] = useState({ logo: '', foto: '' });
  const [scale, setScale] = useState(1);
  const wrap = useRef(null);
  const shot = useRef(null);
  const [busy, setBusy] = useState(false);
  const logoUrl = settings.logoUrl || DEFAULT_LOGO;

  useEffect(() => {
    setInl({ logo: '', foto: '' });
    if (!data) return;
    let ok = true;
    Promise.all([toData(logoUrl), toData(data.fotoUrl)]).then(([logo, foto]) => { if (ok) setInl({ logo, foto }); });
    return () => { ok = false; };
  }, [data, logoUrl]);
  useEffect(() => {
    const fit = () => { if (wrap.current) setScale(Math.min(1, wrap.current.clientWidth / 540)); };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [data]);

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const full = { ...data, namaKlub: settings.namaKlub || 'Spansa Futsal Club', namaSekolah: settings.namaSekolah || 'SMP Negeri 1 Bandar Lampung' };

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
          <Kartu d={full} logo={logoUrl} foto={data.fotoUrl} />
        </div>
      </div>
      <div style={{ position: 'fixed', left: -10000, top: 0 }} aria-hidden="true">
        <Kartu d={full} logo={inl.logo || logoUrl} foto={inl.foto || data.fotoUrl} innerRef={shot} />
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn gold" onClick={download} disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Download size={16} />}Unduh Kartu (PNG)</button>
        <span className="hint">Foto kartu mengikuti foto profil.</span>
      </div>
    </>
  );
}

export default function KartuPage() {
  const { isAdmin, user } = useAuth();
  const { data: list } = useLoad(() => (isAdmin ? api('listAnggota') : Promise.resolve([])), [isAdmin]);
  const [sel, setSel] = useState('');
  useEffect(() => { if (isAdmin && list && list.length && !sel) setSel(list[0].nisn); }, [list, isAdmin, sel]);
  const nisn = isAdmin ? sel : user.nisn;
  return (
    <>
      <PageHead title="Kartu Anggota" subtitle="Kartu digital anggota futsal" />
      <Card plain>
        {isAdmin && (
          <div className="toolbar">
            <select className="input" style={{ maxWidth: 360 }} value={sel} onChange={(e) => setSel(e.target.value)} aria-label="Pilih anggota">
              {(list || []).map((a) => <option key={a.nisn} value={a.nisn}>{a.nama} ({a.kelas})</option>)}
            </select>
          </div>
        )}
        {nisn ? <CardView key={nisn} nisn={nisn} /> : <p className="mut c" style={{ padding: 24 }}>Belum ada anggota futsal.</p>}
      </Card>
    </>
  );
}
