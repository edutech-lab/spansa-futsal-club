import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Loader2, Printer } from 'lucide-react';
import html2canvas from 'html2canvas';
import { useAuth } from '../auth.jsx';
import { DEFAULT_LOGO } from '../config.js';
import { Modal, useUi } from '../ui.jsx';
import { rupiah, splitSchool, terbilang, tglID } from '../utils.js';
import { toData } from './imageData.js';

function Lines() {
  return (
    <svg className="nota-lines" width="100%" height="100%" aria-hidden="true">
      {Array.from({ length: 40 }, (_, i) => <line key={i} x1="0" x2="100%" y1={2 + i * 2.5} y2={2 + i * 2.5} stroke="#266FF2" strokeOpacity=".2" strokeWidth=".5" />)}
    </svg>
  );
}

export function NotaSheet({ d, logo, innerRef }) {
  const kota = splitSchool(d.namaSekolah)[1] || 'Bandar Lampung';
  return (
    <div className="nota" ref={innerRef}>
      <img className="nota-bg" src={logo} alt="" />
      <div className="nota-head">
        <img src={logo} alt="" />
        <div className="nh-t"><b>{String(d.namaKlub).toUpperCase()}</b><span>{d.namaSekolah}</span></div>
        <div className="nh-r"><b>KUITANSI</b><span>Bukti Pembayaran Honor Pelatih</span></div>
      </div>
      <div className="nota-no"><span>No. <b>{d.noNota}</b></span><span>Tanggal: <b>{tglID(d.tanggal)}</b></span></div>
      <div className="nota-body">
        <div className="nrow"><span>Dibayarkan kepada</span><b>: {d.penerima}</b></div>
        <div className="nrow"><span>Untuk pembayaran</span><b>: {d.keterangan}</b></div>
        <div className="nrow"><span>Rincian</span><b>: {d.jumlah} x {rupiah(d.nominal)}</b></div>
        <div className="nrow terb"><Lines /><span>Terbilang</span><i>{terbilang(d.total)}</i></div>
      </div>
      <div className="nota-foot">
        <div className="nota-amt"><Lines /><small>JUMLAH</small><b>{rupiah(d.total)}</b></div>
        <div className="nota-sign">
          <div className="sg-city">{kota}, {tglID(d.tanggal)}</div>
          <div className="sg-cols">
            <div><span>Penerima,</span><i /><b>{d.penerima}</b></div>
            <div><span>Bendahara,</span><i /><b>{d.namaBendahara || '(..................)'}</b></div>
            <div><span>Mengetahui, Pembina</span><i /><b>{d.namaPembina || '(..................)'}</b></div>
          </div>
        </div>
      </div>
      <div className="nota-stamp">LUNAS</div>
      <div className="nota-note">Kuitansi ini sah sebagai bukti pembayaran</div>
    </div>
  );
}

export function NotaModal({ open, onClose, item }) {
  const { toast } = useUi();
  const { settings } = useAuth();
  const logoUrl = settings.logoUrl || DEFAULT_LOGO;
  const [logo, setLogo] = useState('');
  const [scale, setScale] = useState(1);
  const [busy, setBusy] = useState(false);
  const wrap = useRef(null);
  const shot = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    let ok = true;
    setLogo('');
    toData(logoUrl).then((d) => { if (ok) setLogo(d || ''); });
    return () => { ok = false; };
  }, [open, logoUrl]);
  useEffect(() => {
    if (!open) return undefined;
    const fit = () => { if (wrap.current) setScale(Math.min(1, wrap.current.clientWidth / 800)); };
    const t = setTimeout(fit, 0);
    window.addEventListener('resize', fit);
    return () => { clearTimeout(t); window.removeEventListener('resize', fit); };
  }, [open]);
  if (!open || !item) return null;

  const d = {
    ...item,
    namaKlub: settings.namaKlub || 'Spansa Futsal Club',
    namaSekolah: settings.namaSekolah || 'SMP Negeri 1 Bandar Lampung',
    namaBendahara: settings.namaBendahara || '',
    namaPembina: settings.namaPembina || ''
  };
  const download = async () => {
    setBusy(true);
    try {
      const imgs = Array.from(shot.current.querySelectorAll('img'));
      await Promise.all(imgs.map((i) => (i.complete ? Promise.resolve() : new Promise((r) => { i.onload = r; i.onerror = r; }))));
      const canvas = await html2canvas(shot.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `nota_${String(d.noNota).replace(/\//g, '-')}.png`;
      a.click();
    } catch { toast('Gagal membuat gambar nota', 'err'); } finally { setBusy(false); }
  };
  const print = () => {
    document.body.classList.add('print-nota');
    const done = () => { document.body.classList.remove('print-nota'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
  };
  return (
    <>
      <Modal open onClose={onClose} wide title={`Nota Pelatih · ${d.noNota}`} footer={<>
        <button className="btn sec" onClick={print}><Printer size={16} />Cetak</button>
        <button className="btn" onClick={download} disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Download size={16} />}Unduh PNG</button>
        <button className="btn sec" onClick={onClose}>Tutup</button></>}>
        <div ref={wrap} className="kartu-wrap" style={{ height: 480 * scale }}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: 800 }}>
            <NotaSheet d={d} logo={logoUrl} />
          </div>
        </div>
        <p className="hint" style={{ marginTop: 10 }}>Nota diberikan kepada pelatih sebagai bukti pembayaran. Nama bendahara dan pembina diatur di menu Pengaturan.</p>
      </Modal>
      {createPortal(<div className="nota-print" aria-hidden="true"><NotaSheet d={d} logo={logo || logoUrl} innerRef={shot} /></div>, document.body)}
    </>
  );
}
