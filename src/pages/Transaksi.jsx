import { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, Eye, FileText, Maximize2, Paperclip, Pencil, Plus, Receipt, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { NotaModal } from '../components/Nota.jsx';
import { Card, DataTable, ErrorBox, Field, Loading, Modal, PageHead, useLoad, useUi } from '../ui.jsx';
import { b64Blob, driveId, exportXlsx, fileToBase64, rupiah, termRange, tglID, ymd } from '../utils.js';

const CFG = {
  pengeluaran: {
    title: 'Pengeluaran Kas', list: 'listPengeluaran', save: 'savePengeluaran', del: 'deletePengeluaran', add: 'Tambah Pengeluaran', formName: 'Pengeluaran',
    kLabel: 'Jenis pengeluaran', kategori: [['Umum', 'Umum'], ['Pelatih', 'Pelatih (dengan nota)']], def: 'Umum', file: 'pengeluaran', foot: 'Total pengeluaran', ph: 'Contoh: Beli bola futsal'
  },
  pemasukan: {
    title: 'Pemasukan Kas', sub: 'Pemasukan di luar iuran anggota', list: 'listPemasukan', save: 'savePemasukan', del: 'deletePemasukan', add: 'Tambah Pemasukan', formName: 'Pemasukan',
    kLabel: 'Sumber pemasukan', kategori: ['Donasi', 'Sponsor', 'Bantuan Sekolah', 'Penjualan', 'Lainnya'].map((x) => [x, x]), def: 'Donasi', file: 'pemasukan', foot: 'Total pemasukan', ph: 'Contoh: Donasi alumni'
  }
};

function DriveThumb({ id }) {
  const [bad, setBad] = useState(false);
  if (bad || !id) return <FileText size={30} color="#64748B" />;
  return <img src={`https://drive.google.com/thumbnail?id=${id}&sz=w400`} alt="Bukti" referrerPolicy="no-referrer" onError={() => setBad(true)} />;
}

export default function Transaksi({ jenis }) {
  const cfg = CFG[jenis];
  const { term } = useAuth();
  const { toast, confirm } = useUi();
  const { data, loading, error, reload } = useLoad(() => api(cfg.list, { term }), [term, jenis]);
  const [form, setForm] = useState(null);
  const [bukti, setBukti] = useState(null);
  const [blobUrl, setBlobUrl] = useState('');
  const [viewer, setViewer] = useState(null);
  const [nota, setNota] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const range = termRange(term);
  const today = ymd(new Date());
  const rows = data || [];
  const sum = rows.reduce((a, r) => a + r.total, 0);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const intOnly = (k) => (e) => { const v = e.target.value.replace(/\D/g, ''); setForm({ ...form, [k]: v }); };
  const totalForm = form ? (Number(form.nominal) || 0) * (Number(form.jumlah) || 0) : 0;
  const empty = { id: '', tanggal: '', kategori: cfg.def, keterangan: '', nominal: '', jumlah: '1', buktiUrl: '', penerima: '' };
  const open = (r) => { setBukti(null); setForm(r ? { ...empty, ...r, nominal: String(r.nominal), jumlah: String(r.jumlah) } : { ...empty, tanggal: today >= range.from && today <= range.to ? today : range.from }); };

  useEffect(() => {
    if (!bukti) { setBlobUrl(''); return undefined; }
    const u = URL.createObjectURL(b64Blob(bukti.data, bukti.mime));
    setBlobUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [bukti]);

  const current = bukti
    ? { kind: bukti.mime === 'application/pdf' ? 'pdf' : 'image', url: blobUrl, openUrl: blobUrl, title: bukti.name }
    : form && form.buktiUrl ? { kind: 'drive', id: driveId(form.buktiUrl), openUrl: form.buktiUrl, title: form.keterangan || 'Bukti' } : null;

  const pick = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try { setBukti(await fileToBase64(f)); } catch (err) { toast(err.message, 'err'); }
  };
  const isPelatih = jenis === 'pengeluaran' && form && form.kategori === 'Pelatih';
  const save = async () => {
    if (!form.keterangan.trim()) return toast('Keterangan wajib diisi', 'err');
    if (isPelatih && !form.penerima.trim()) return toast('Nama pelatih wajib diisi', 'err');
    if (!Number(form.nominal) || !Number(form.jumlah)) return toast('Nominal dan jumlah harus lebih dari 0', 'err');
    setBusy(true);
    try {
      const item = { id: form.id, tanggal: form.tanggal, kategori: form.kategori, keterangan: form.keterangan, nominal: Number(form.nominal), jumlah: Number(form.jumlah), penerima: form.penerima };
      const res = await api(cfg.save, { item, bukti });
      toast(`${cfg.formName} disimpan`);
      const snap = { ...item, total: item.nominal * item.jumlah, noNota: res.noNota };
      setForm(null); reload();
      if (res.noNota && snap.kategori === 'Pelatih') setNota(snap);
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const del = async (r) => {
    if (!(await confirm(`Hapus ${cfg.formName.toLowerCase()} "${r.keterangan}"?`, { danger: true, okText: 'Hapus' }))) return;
    try { await api(cfg.del, { id: r.id }); toast(`${cfg.formName} dihapus`); reload(); } catch (e) { toast(e.message, 'err'); }
  };
  const exp = () => exportXlsx(`${cfg.file}_${term.replace('/', '-').replace(' ', '_')}.xlsx`, cfg.formName, ['No', 'Tanggal', cfg.kLabel, 'Keterangan', 'Penerima/Pelatih', 'No. Nota', 'Nominal', 'Jumlah', 'Total', 'Bukti'],
    [...rows.map((r, i) => [i + 1, r.tanggal, r.kategori, r.keterangan, r.penerima, r.noNota, r.nominal, r.jumlah, r.total, r.buktiUrl || '']), ['', '', '', 'TOTAL', '', '', '', '', sum, '']], [1, 5]);

  return (
    <>
      <PageHead title={cfg.title} subtitle={cfg.sub ? `${cfg.sub} · ${term}` : term}>
        <button className="btn sec" onClick={exp} disabled={!rows.length}><Download size={16} />Ekspor</button>
        <button className="btn" onClick={() => open(null)}><Plus size={16} />{cfg.add}</button>
      </PageHead>
      <Card plain>
        {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
          <DataTable rows={rows} rowKey={(r) => r.id} empty={`Belum ada ${cfg.formName.toLowerCase()} pada ${term}`}
            foot={rows.length ? <tr><td colSpan={5} className="r">{cfg.foot}</td><td className="r">{rupiah(sum)}</td><td colSpan={2} /></tr> : null}
            columns={[
              { label: 'Tanggal', render: (r) => tglID(r.tanggal, true), nowrap: true },
              { label: cfg.kLabel.split(' ')[0], render: (r) => <span className={'chip ' + (r.kategori === 'Pelatih' ? 'vio' : '')}>{r.kategori}</span> },
              { label: 'Keterangan', render: (r) => <span>{r.keterangan}{r.penerima && <small className="mut" style={{ display: 'block' }}>{r.penerima} · {r.noNota}</small>}</span> },
              { label: 'Nominal', render: (r) => rupiah(r.nominal), align: 'right' }, { label: 'Jumlah', key: 'jumlah', align: 'center' },
              { label: 'Total', render: (r) => <b>{rupiah(r.total)}</b>, align: 'right' },
              { label: 'Bukti', render: (r) => (r.buktiUrl ? <button type="button" className="chip chip-btn" onClick={() => setViewer({ kind: 'drive', id: driveId(r.buktiUrl), openUrl: r.buktiUrl, title: r.keterangan })}><Eye size={12} />Lihat</button> : <span className="mut">-</span>) },
              { label: 'Aksi', align: 'right', render: (r) => (<div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                {r.noNota && <button className="btn gold sm" aria-label="Nota pelatih" onClick={() => setNota(r)}><Receipt size={14} />Nota</button>}
                <button className="btn sec sm icon" aria-label="Ubah" onClick={() => open(r)}><Pencil size={14} /></button>
                <button className="btn sec sm icon" aria-label="Hapus" onClick={() => del(r)}><Trash2 size={14} color="#EF4444" /></button></div>) }
            ]} />
        )}
      </Card>

      <Modal open={!!form} onClose={() => setForm(null)} title={form && form.id ? `Ubah ${cfg.formName}` : cfg.add} footer={<><button className="btn sec" onClick={() => setForm(null)}>Batal</button><button className="btn" disabled={busy} onClick={save}>{busy ? 'Menyimpan...' : 'Simpan'}</button></>}>
        {form && (
          <div className="form-grid">
            <Field label="Tanggal"><input className="input" type="date" min={range.from} max={range.to} value={form.tanggal} onChange={set('tanggal')} /></Field>
            <Field label={cfg.kLabel}>
              <select className="input" value={form.kategori} onChange={set('kategori')}>{cfg.kategori.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </Field>
            {isPelatih && <Field label="Nama pelatih (penerima)" className="full" hint="Nota pembayaran dibuat otomatis untuk diberikan kepada pelatih"><input className="input" value={form.penerima} onChange={set('penerima')} placeholder="Nama lengkap pelatih" /></Field>}
            <Field label={isPelatih ? 'Keterangan pembayaran' : 'Keterangan'} className="full"><input className="input" value={form.keterangan} onChange={set('keterangan')} placeholder={isPelatih ? 'Contoh: Honor melatih bulan November' : cfg.ph} /></Field>
            <div className="full pair2">
              <Field label="Nominal satuan (Rp)"><input className="input" inputMode="numeric" value={form.nominal} onChange={intOnly('nominal')} placeholder="0" /></Field>
              <Field label="Jumlah (qty)"><input className="input" inputMode="numeric" value={form.jumlah} onChange={intOnly('jumlah')} /></Field>
            </div>
            <div className="full total-box"><span>Total</span><b>{rupiah(totalForm)}</b></div>
            <div className="full">
              <input ref={fileRef} type="file" hidden accept="image/jpeg,image/png,image/webp,application/pdf" onChange={pick} />
              <div className="field">
                <span>Bukti (opsional)</span>
                {!bukti && !form.buktiUrl ? (
                  <button type="button" className="bukti-drop" onClick={() => fileRef.current.click()}><Paperclip size={20} /><b>Unggah bukti</b><small>JPG, PNG, WEBP, atau PDF maks. 4 MB</small></button>
                ) : (
                  <div className="bukti-box">
                    <button type="button" className="bukti-thumb" onClick={() => setViewer(current)} aria-label="Lihat penuh">
                      {bukti ? (bukti.mime === 'application/pdf' ? <span className="pdfbox"><FileText size={30} />PDF</span> : <img src={blobUrl} alt="Pratinjau bukti" />) : <DriveThumb id={driveId(form.buktiUrl)} />}
                    </button>
                    <div className="bukti-info">
                      <b>{bukti ? bukti.name : 'Bukti tersimpan'}</b>
                      <small>{bukti ? `${bukti.mime === 'application/pdf' ? 'PDF' : 'Gambar'} · ${Math.max(1, Math.round(bukti.data.length * 0.75 / 1024))} KB · belum disimpan` : 'Tersimpan di Google Drive'}</small>
                      <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
                        <button type="button" className="btn sm" onClick={() => setViewer(current)}><Maximize2 size={14} />Lihat penuh</button>
                        <button type="button" className="btn sec sm" onClick={() => fileRef.current.click()}>Ganti</button>
                        {bukti && <button type="button" className="btn ghost sm" onClick={() => setBukti(null)}>Batalkan pilihan</button>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!viewer} onClose={() => setViewer(null)} wide title={viewer ? viewer.title : ''} footer={<>
        {viewer && viewer.openUrl && <a className="btn sec" href={viewer.openUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} />Buka di tab baru</a>}
        <button className="btn" onClick={() => setViewer(null)}>Tutup</button></>}>
        {viewer && (
          <div className="viewer">
            {viewer.kind === 'image' && <img src={viewer.url} alt={viewer.title} />}
            {viewer.kind === 'pdf' && <iframe title="Bukti PDF" src={viewer.url} />}
            {viewer.kind === 'drive' && <iframe title="Bukti" src={`https://drive.google.com/file/d/${viewer.id}/preview`} allow="autoplay" />}
          </div>
        )}
      </Modal>
      <NotaModal open={!!nota} item={nota} onClose={() => setNota(null)} />
    </>
  );
}
