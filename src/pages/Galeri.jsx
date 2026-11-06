import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Images, Link2, Loader2, Pencil, Play, Plus, Trash2, Upload, X } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Card, Empty, ErrorBox, Field, Loading, Modal, SearchBox, useLoad, useUi } from '../ui.jsx';
import { compressImage, fmtSize, parseMediaLink, tglID, ymd } from '../utils.js';

const ALBUM_DEFAULT = ['Pertandingan', 'Latihan', 'Kegiatan', 'Prestasi', 'Lainnya'];
const TIPE_LABEL = { drive: 'Google Drive', youtube: 'YouTube', gambar: 'Gambar tautan', upload: 'Unggahan' };
const fullSrc = (g) => (g.tipe === 'upload' || g.tipe === 'drive' ? `https://lh3.googleusercontent.com/d/${g.fileId}=w1600` : g.url);

function Thumb({ g }) {
  const [bad, setBad] = useState(false);
  if (bad) return <div className="gal-ph"><Images size={34} /></div>;
  return <img src={g.thumb} alt={g.judul} loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} />;
}

function Lightbox({ items, index, onClose, onNav }) {
  const g = items[index];
  const [fail, setFail] = useState(false);
  useEffect(() => setFail(false), [index]);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowLeft') onNav(-1); if (e.key === 'ArrowRight') onNav(1); };
    document.addEventListener('keydown', k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, [onClose, onNav]);
  if (!g) return null;
  let media;
  if (g.tipe === 'youtube') media = <iframe title={g.judul} src={`https://www.youtube-nocookie.com/embed/${g.fileId}?rel=0`} allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen />;
  else if ((g.tipe === 'drive' || g.tipe === 'upload') && fail) media = <iframe title={g.judul} src={`https://drive.google.com/file/d/${g.fileId}/preview`} allow="autoplay" />;
  else media = <img src={fullSrc(g)} alt={g.judul} referrerPolicy="no-referrer" onError={() => setFail(true)} />;
  const openUrl = g.tipe === 'upload' ? `https://drive.google.com/file/d/${g.fileId}/view` : g.url;
  return (
    <div className="lb" role="dialog" aria-modal="true" aria-label={g.judul} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <span className="lb-count">{index + 1} / {items.length}</span>
      <button className="lb-btn lb-close" onClick={onClose} aria-label="Tutup"><X size={22} /></button>
      {items.length > 1 && <button className="lb-btn lb-nav l" onClick={() => onNav(-1)} aria-label="Sebelumnya"><ChevronLeft size={26} /></button>}
      <div className="lb-stage">
        {media}
        <div className="lb-cap">
          <b>{g.judul}</b>
          <small>{g.album} · {tglID(g.tanggal)}{' '}<a href={openUrl} target="_blank" rel="noreferrer"><ExternalLink size={12} /> Buka asli</a></small>
        </div>
      </div>
      {items.length > 1 && <button className="lb-btn lb-nav r" onClick={() => onNav(1)} aria-label="Berikutnya"><ChevronRight size={26} /></button>}
    </div>
  );
}

function AddModal({ open, onClose, onDone, albums }) {
  const { toast } = useUi();
  const [tab, setTab] = useState('file');
  const [album, setAlbum] = useState('Pertandingan');
  const [tanggal, setTanggal] = useState(ymd(new Date()));
  const [files, setFiles] = useState([]);
  const [proc, setProc] = useState(false);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState('');
  const [judul, setJudul] = useState('');
  const [drag, setDrag] = useState(false);
  const ref = useRef(null);
  const filesRef = useRef([]);
  filesRef.current = files;

  let info = null;
  let linkErr = '';
  if (link.trim()) { try { info = parseMediaLink(link); } catch (e) { linkErr = e.message; } }

  const reset = () => { filesRef.current.forEach((f) => URL.revokeObjectURL(f.preview)); setFiles([]); setLink(''); setJudul(''); setTab('file'); };
  const close = () => { if (busy) return; reset(); onClose(); };
  useEffect(() => () => { filesRef.current.forEach((f) => URL.revokeObjectURL(f.preview)); }, []);

  const addFiles = async (list) => {
    const arr = Array.from(list || []);
    if (!arr.length) return;
    const room = 20 - files.length;
    if (arr.length > room) toast(`Maksimal 20 foto sekali unggah. ${Math.max(room, 0)} foto pertama diproses.`, 'err');
    setProc(true);
    const out = [];
    for (const f of arr.slice(0, Math.max(room, 0))) {
      try { const r = await compressImage(f); out.push({ ...r, key: Math.random().toString(36).slice(2), judul: f.name.replace(/\.[^.]+$/, '').slice(0, 80), status: 'siap', msg: '' }); } catch (e) { toast(e.message, 'err'); }
    }
    setFiles((p) => [...p, ...out]);
    setProc(false);
  };
  const removeFile = (k) => setFiles((p) => { const f = p.find((x) => x.key === k); if (f) URL.revokeObjectURL(f.preview); return p.filter((x) => x.key !== k); });
  const setFile = (k, patch) => setFiles((p) => p.map((x) => (x.key === k ? { ...x, ...patch } : x)));

  const uploadAll = async () => {
    setBusy(true);
    let okN = 0;
    for (const f of filesRef.current.filter((x) => x.status !== 'selesai')) {
      setFile(f.key, { status: 'mengunggah', msg: '' });
      try {
        await api('saveGaleri', { item: { judul: f.judul, album, tanggal }, file: { mime: f.mime, data: f.data, name: f.name } });
        setFile(f.key, { status: 'selesai' }); okN++;
      } catch (e) { setFile(f.key, { status: 'gagal', msg: e.message }); }
    }
    setBusy(false);
    const total = filesRef.current.length;
    if (okN) { onDone(); toast(`${okN} foto berhasil diunggah`); }
    if (okN === total) { reset(); onClose(); }
  };
  const saveLink = async () => {
    setBusy(true);
    try { await api('saveGaleri', { item: { judul, album, tanggal }, link: link.trim() }); toast('Tautan ditambahkan ke galeri'); onDone(); reset(); onClose(); } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const pending = files.filter((f) => f.status !== 'selesai').length;

  return (
    <Modal open={open} onClose={close} wide title="Tambah ke Galeri" footer={<>
      <button className="btn sec" onClick={close} disabled={busy}>Batal</button>
      {tab === 'file'
        ? <button className="btn" onClick={uploadAll} disabled={busy || proc || !pending}>{busy ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}{busy ? 'Mengunggah...' : `Unggah ${pending} foto`}</button>
        : <button className="btn" onClick={saveLink} disabled={busy || !info}>{busy ? <Loader2 size={16} className="spin" /> : <Link2 size={16} />}Simpan tautan</button>}
    </>}>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" className={tab === 'file' ? 'on' : ''} onClick={() => setTab('file')}>Unggah File</button>
        <button type="button" role="tab" className={tab === 'link' ? 'on' : ''} onClick={() => setTab('link')}>Dari Tautan</button>
      </div>
      <div className="form-grid" style={{ marginBottom: 14 }}>
        <Field label="Album">
          <input className="input" list="album-list" value={album} onChange={(e) => setAlbum(e.target.value)} maxLength={30} />
          <datalist id="album-list">{albums.map((a) => <option key={a} value={a} />)}</datalist>
        </Field>
        <Field label="Tanggal"><input className="input" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} /></Field>
      </div>

      {tab === 'file' ? (
        <>
          <input ref={ref} type="file" multiple hidden accept="image/jpeg,image/png,image/webp" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          <button type="button" className={'bukti-drop' + (drag ? ' drag' : '')} onClick={() => ref.current.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}>
            {proc ? <Loader2 size={22} className="spin" /> : <Upload size={22} />}
            <b>{proc ? 'Memproses gambar...' : 'Pilih atau tarik foto ke sini'}</b>
            <small>JPG, PNG, WEBP · foto di atas 500 KB dikompres otomatis hingga di bawah 500 KB</small>
          </button>
          {files.length > 0 && (
            <div className="up-list" style={{ marginTop: 12 }}>
              {files.map((f) => (
                <div className="up-item" key={f.key}>
                  <img src={f.preview} alt="" />
                  <div className="grow">
                    <input className="input" style={{ height: 34 }} value={f.judul} onChange={(e) => setFile(f.key, { judul: e.target.value })} maxLength={80} aria-label="Judul foto" disabled={busy} />
                    <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                      {f.compressed ? <span className="chip ok">{fmtSize(f.original)} → {fmtSize(f.size)}</span> : <span className="chip">{fmtSize(f.size)}</span>}
                      {f.status === 'mengunggah' && <span className="chip warn">Mengunggah...</span>}
                      {f.status === 'selesai' && <span className="chip ok">Selesai</span>}
                      {f.status === 'gagal' && <span className="chip err" title={f.msg}>Gagal: {f.msg}</span>}
                    </div>
                  </div>
                  {!busy && f.status !== 'selesai' && <button type="button" className="btn sec sm icon" onClick={() => removeFile(f.key)} aria-label="Hapus dari daftar"><X size={14} /></button>}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          <Field label="Tautan" hint="Tautan berkas Google Drive (atur akses &quot;Siapa saja yang memiliki link&quot;), video YouTube, atau alamat gambar langsung (.jpg, .png, .webp)">
            <input className="input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://drive.google.com/file/d/..." />
          </Field>
          {linkErr && <div className="err-t">{linkErr}</div>}
          {info && (
            <div className="bukti-box">
              <div className="bukti-thumb" style={{ cursor: 'default' }}><img src={info.thumb} alt="Pratinjau tautan" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.opacity = 0.15; }} /></div>
              <div className="bukti-info"><b>{TIPE_LABEL[info.tipe]}</b><small>Pratinjau akan tampil jika berkas dapat diakses publik</small></div>
            </div>
          )}
          <Field label="Judul (opsional)"><input className="input" value={judul} onChange={(e) => setJudul(e.target.value)} maxLength={80} placeholder="Judul foto atau video" /></Field>
        </div>
      )}
    </Modal>
  );
}

export default function Galeri() {
  const { isAdmin } = useAuth();
  const { toast, confirm } = useUi();
  const { data, loading, error, reload } = useLoad(() => api('listGaleri'), []);
  const [album, setAlbum] = useState('Semua');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(24);
  const [lb, setLb] = useState(-1);
  const [add, setAdd] = useState(false);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);

  const all = data || [];
  const albums = useMemo(() => [...new Set([...ALBUM_DEFAULT, ...all.map((g) => g.album)])], [all]);
  const counts = useMemo(() => { const c = {}; all.forEach((g) => { c[g.album] = (c[g.album] || 0) + 1; }); return c; }, [all]);
  const list = useMemo(() => all.filter((g) => (album === 'Semua' || g.album === album) && (!q || (g.judul + ' ' + g.album).toLowerCase().includes(q.toLowerCase()))), [all, album, q]);
  useEffect(() => setLimit(24), [album, q]);
  const shown = list.slice(0, limit);
  const nav = useCallback((d) => setLb((i) => (list.length ? (i + d + list.length) % list.length : -1)), [list.length]);
  const closeLb = useCallback(() => setLb(-1), []);

  const del = async (g) => {
    if (!(await confirm(`Hapus "${g.judul}" dari galeri?`, { danger: true, okText: 'Hapus' }))) return;
    try { await api('deleteGaleri', { id: g.id }); toast('Item galeri dihapus'); reload(); } catch (e) { toast(e.message, 'err'); }
  };
  const saveEdit = async () => {
    if (!edit.judul.trim()) return toast('Judul wajib diisi', 'err');
    setBusy(true);
    try { await api('saveGaleri', { item: { id: edit.id, judul: edit.judul, album: edit.album, tanggal: edit.tanggal } }); toast('Perubahan disimpan'); setEdit(null); reload(); } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };

  return (
    <>
      <div className="gal-hero">
        <div>
          <h2>Galeri Spansa Futsal Club</h2>
          <p>{all.length} foto &amp; video · {Object.keys(counts).length} album</p>
        </div>
        {isAdmin && <button className="btn gold" onClick={() => setAdd(true)}><Plus size={16} />Tambah ke Galeri</button>}
      </div>
      <Card plain>
        <div className="toolbar">
          <SearchBox value={q} onChange={setQ} placeholder="Cari judul atau album" />
          <span className="hint">{list.length} item</span>
        </div>
        <div className="gal-pills" role="tablist" aria-label="Album">
          <button className={'pill' + (album === 'Semua' ? ' on' : '')} onClick={() => setAlbum('Semua')}>Semua<small>{all.length}</small></button>
          {Object.keys(counts).sort().map((a) => <button key={a} className={'pill' + (album === a ? ' on' : '')} onClick={() => setAlbum(a)}>{a}<small>{counts[a]}</small></button>)}
        </div>
        {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : list.length === 0 ? <Empty text={all.length ? 'Tidak ada item yang cocok' : (isAdmin ? 'Galeri masih kosong. Tambahkan foto pertama.' : 'Galeri masih kosong')} /> : (
          <>
            <div className="gal-grid">
              {shown.map((g, i) => (
                <div key={g.id} className="gal-card" role="button" tabIndex={0} aria-label={g.judul} onClick={() => setLb(i)} onKeyDown={(e) => { if (e.key === 'Enter') setLb(i); }}>
                  <Thumb g={g} />
                  {g.tipe === 'youtube' && <span className="gal-play"><Play size={22} /></span>}
                  <div className="gal-ov"><span className="chip">{g.album}</span><b>{g.judul}</b><small>{tglID(g.tanggal, true)}</small></div>
                  {isAdmin && (
                    <div className="gal-act" onClick={(e) => e.stopPropagation()}>
                      <button className="btn sec sm icon" aria-label="Ubah" onClick={() => setEdit({ id: g.id, judul: g.judul, album: g.album, tanggal: g.tanggal })}><Pencil size={14} /></button>
                      <button className="btn sec sm icon" aria-label="Hapus" onClick={() => del(g)}><Trash2 size={14} color="#EF4444" /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {list.length > shown.length && <div className="c" style={{ marginTop: 16 }}><button className="btn sec" onClick={() => setLimit(limit + 24)}>Muat lebih banyak ({list.length - shown.length})</button></div>}
          </>
        )}
      </Card>
      {lb >= 0 && list[lb] && <Lightbox items={list} index={lb} onClose={closeLb} onNav={nav} />}
      {isAdmin && <AddModal open={add} onClose={() => setAdd(false)} onDone={reload} albums={albums} />}
      <Modal open={!!edit} onClose={() => setEdit(null)} title="Ubah Item Galeri" footer={<><button className="btn sec" onClick={() => setEdit(null)}>Batal</button><button className="btn" disabled={busy} onClick={saveEdit}>{busy ? 'Menyimpan...' : 'Simpan'}</button></>}>
        {edit && (
          <div className="form-grid">
            <Field label="Judul" className="full"><input className="input" value={edit.judul} onChange={(e) => setEdit({ ...edit, judul: e.target.value })} maxLength={80} /></Field>
            <Field label="Album"><input className="input" list="album-list2" value={edit.album} onChange={(e) => setEdit({ ...edit, album: e.target.value })} maxLength={30} /><datalist id="album-list2">{albums.map((a) => <option key={a} value={a} />)}</datalist></Field>
            <Field label="Tanggal"><input className="input" type="date" value={edit.tanggal} onChange={(e) => setEdit({ ...edit, tanggal: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </>
  );
}
