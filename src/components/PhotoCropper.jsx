import { useEffect, useRef, useState } from 'react';
import { Loader2, Minus, Plus } from 'lucide-react';
import { Modal } from '../ui.jsx';

/* Rasio foto pada Kartu Anggota: 124 x 156 px (.k-photo). Kotak potong dibuat 2x, hasil akhir 3x agar tajam. */
const BOX_W = 248; const BOX_H = 312;
const OUT_W = 372; const OUT_H = 468;

/* Potong foto (geser + zoom) sesuai rasio foto kartu, lalu kembalikan { mime, data(base64) } lewat onDone.
   onDone boleh async; bila melempar error, pesannya tampil di dialog dan dialog tetap terbuka. */
export default function PhotoCropper({ file, onCancel, onDone }) {
  const [url, setUrl] = useState('');
  const [nat, setNat] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const imgRef = useRef(null);
  const drag = useRef(null);

  useEffect(() => {
    setNat(null); setZoom(1); setErr(''); setBusy(false);
    if (!file) { setUrl(''); return undefined; }
    const u = URL.createObjectURL(file);
    setUrl(u);
    const im = new Image();
    im.onload = () => {
      const w = im.naturalWidth; const h = im.naturalHeight;
      const base = Math.max(BOX_W / w, BOX_H / h);
      setNat({ w, h });
      setPos({ x: (BOX_W - w * base) / 2, y: (BOX_H - h * base) / 2 });
    };
    im.onerror = () => setErr('Gambar tidak dapat dibaca. Pilih berkas JPG atau PNG lain.');
    im.src = u;
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const base = nat ? Math.max(BOX_W / nat.w, BOX_H / nat.h) : 1;
  const scale = base * zoom;
  const clamp = (x, y, sc) => ({ x: Math.min(0, Math.max(BOX_W - nat.w * sc, x)), y: Math.min(0, Math.max(BOX_H - nat.h * sc, y)) });

  const changeZoom = (z) => {
    if (!nat) return;
    const nz = Math.min(4, Math.max(1, z));
    const ns = base * nz;
    const cx = (BOX_W / 2 - pos.x) / scale; const cy = (BOX_H / 2 - pos.y) / scale;
    setZoom(nz);
    setPos(clamp(BOX_W / 2 - cx * ns, BOX_H / 2 - cy * ns, ns));
  };
  const down = (e) => {
    if (!nat) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
  };
  const move = (e) => {
    const d = drag.current;
    if (!d || !nat) return;
    setPos(clamp(d.ox + e.clientX - d.sx, d.oy + e.clientY - d.sy, scale));
  };
  const up = () => { drag.current = null; };

  const save = async () => {
    if (!nat || !imgRef.current) return;
    setBusy(true); setErr('');
    try {
      const c = document.createElement('canvas');
      c.width = OUT_W; c.height = OUT_H;
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, OUT_W, OUT_H);
      g.imageSmoothingQuality = 'high';
      g.drawImage(imgRef.current, -pos.x / scale, -pos.y / scale, BOX_W / scale, BOX_H / scale, 0, 0, OUT_W, OUT_H);
      await onDone({ mime: 'image/jpeg', data: c.toDataURL('image/jpeg', 0.88).split(',')[1] });
    } catch (e) { setErr((e && e.message) || 'Gagal memproses foto'); } finally { setBusy(false); }
  };

  return (
    <Modal open={!!file} onClose={() => { if (!busy) onCancel(); }} title="Atur foto"
      footer={<><button className="btn sec" onClick={onCancel} disabled={busy}>Batal</button><button className="btn" onClick={save} disabled={busy || !nat}>{busy ? <><Loader2 size={16} className="spin" />Mengunggah...</> : 'Simpan foto'}</button></>}>
      <div className="crop">
        <div className="crop-box" style={{ width: BOX_W, height: BOX_H }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={(e) => changeZoom(zoom + (e.deltaY < 0 ? 0.1 : -0.1))}>
          {nat ? <img ref={imgRef} src={url} alt="Foto yang dipotong" draggable={false} style={{ left: pos.x, top: pos.y, width: nat.w * scale, height: nat.h * scale }} /> : <div className="crop-ph">{err || 'Memuat foto...'}</div>}
          <i className="crop-g" aria-hidden="true" />
        </div>
        <div className="crop-zoom">
          <button type="button" className="btn sec sm icon" aria-label="Perkecil" onClick={() => changeZoom(zoom - 0.2)}><Minus size={14} /></button>
          <input type="range" min="1" max="4" step="0.01" value={zoom} onChange={(e) => changeZoom(Number(e.target.value))} aria-label="Zoom" disabled={!nat} />
          <button type="button" className="btn sec sm icon" aria-label="Perbesar" onClick={() => changeZoom(zoom + 0.2)}><Plus size={14} /></button>
        </div>
        <p className="hint c">Geser foto untuk mengatur posisi wajah, geser slider untuk zoom. Bingkai mengikuti rasio foto di Kartu Anggota (4:5).</p>
        {err && nat && <p className="hint c" style={{ color: '#B91C1C' }} role="alert">{err}</p>}
      </div>
    </Modal>
  );
}
