import { useRef, useState } from 'react';
import { Download, ExternalLink, Paperclip, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Card, DataTable, ErrorBox, Field, Loading, Modal, PageHead, useLoad, useUi } from '../ui.jsx';
import { exportXlsx, fileToBase64, rupiah, termRange, tglID, ymd } from '../utils.js';

const EMPTY = { id: '', tanggal: '', keterangan: '', nominal: '', jumlah: '1', buktiUrl: '' };

export default function Pengeluaran() {
  const { term } = useAuth();
  const { toast, confirm } = useUi();
  const { data, loading, error, reload } = useLoad(() => api('listPengeluaran', { term }), [term]);
  const [form, setForm] = useState(null);
  const [bukti, setBukti] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const range = termRange(term);
  const today = ymd(new Date());
  const rows = data || [];
  const sum = rows.reduce((a, r) => a + r.total, 0);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const intOnly = (k) => (e) => { const v = e.target.value.replace(/\D/g, ''); setForm({ ...form, [k]: v }); };
  const totalForm = form ? (Number(form.nominal) || 0) * (Number(form.jumlah) || 0) : 0;
  const open = (r) => { setBukti(null); setForm(r ? { ...r, nominal: String(r.nominal), jumlah: String(r.jumlah) } : { ...EMPTY, tanggal: today >= range.from && today <= range.to ? today : range.from }); };

  const pick = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try { setBukti(await fileToBase64(f)); } catch (err) { toast(err.message, 'err'); }
  };
  const save = async () => {
    if (!form.keterangan.trim()) return toast('Keterangan wajib diisi', 'err');
    if (!Number(form.nominal) || !Number(form.jumlah)) return toast('Nominal dan jumlah harus lebih dari 0', 'err');
    setBusy(true);
    try {
      await api('savePengeluaran', { item: { id: form.id, tanggal: form.tanggal, keterangan: form.keterangan, nominal: Number(form.nominal), jumlah: Number(form.jumlah) }, bukti });
      toast('Pengeluaran disimpan'); setForm(null); reload();
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const del = async (r) => {
    if (!(await confirm(`Hapus pengeluaran "${r.keterangan}"?`, { danger: true, okText: 'Hapus' }))) return;
    try { await api('deletePengeluaran', { id: r.id }); toast('Pengeluaran dihapus'); reload(); } catch (e) { toast(e.message, 'err'); }
  };
  const exp = () => exportXlsx(`pengeluaran_${term.replace('/', '-').replace(' ', '_')}.xlsx`, 'Pengeluaran', ['No', 'Tanggal', 'Keterangan', 'Nominal', 'Jumlah', 'Total', 'Bukti'],
    [...rows.map((r, i) => [i + 1, r.tanggal, r.keterangan, r.nominal, r.jumlah, r.total, r.buktiUrl || '']), ['', '', 'TOTAL', '', '', sum, '']], [1]);

  return (
    <>
      <PageHead title="Pengeluaran Kas" subtitle={term}>
        <button className="btn sec" onClick={exp} disabled={!rows.length}><Download size={16} />Ekspor</button>
        <button className="btn" onClick={() => open(null)}><Plus size={16} />Tambah Pengeluaran</button>
      </PageHead>
      <Card plain>
        {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
          <DataTable rows={rows} rowKey={(r) => r.id} empty={`Belum ada pengeluaran pada ${term}`}
            foot={rows.length ? <tr><td colSpan={5} className="r">Total pengeluaran</td><td className="r">{rupiah(sum)}</td><td colSpan={2} /></tr> : null}
            columns={[
              { label: 'Tanggal', render: (r) => tglID(r.tanggal, true), nowrap: true }, { label: 'Keterangan', key: 'keterangan' },
              { label: 'Nominal', render: (r) => rupiah(r.nominal), align: 'right' }, { label: 'Jumlah', key: 'jumlah', align: 'center' },
              { label: 'Total', render: (r) => <b>{rupiah(r.total)}</b>, align: 'right' },
              { label: 'Bukti', render: (r) => (r.buktiUrl ? <a className="chip" href={r.buktiUrl} target="_blank" rel="noreferrer"><ExternalLink size={12} />Lihat</a> : <span className="mut">-</span>) },
              { label: 'Aksi', align: 'right', render: (r) => (<div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                <button className="btn sec sm icon" aria-label="Ubah" onClick={() => open(r)}><Pencil size={14} /></button>
                <button className="btn sec sm icon" aria-label="Hapus" onClick={() => del(r)}><Trash2 size={14} color="#EF4444" /></button></div>) }
            ]} />
        )}
      </Card>
      <Modal open={!!form} onClose={() => setForm(null)} title={form && form.id ? 'Ubah Pengeluaran' : 'Tambah Pengeluaran'} footer={<><button className="btn sec" onClick={() => setForm(null)}>Batal</button><button className="btn" disabled={busy} onClick={save}>{busy ? 'Menyimpan...' : 'Simpan'}</button></>}>
        {form && (
          <div className="form-grid">
            <Field label="Tanggal"><input className="input" type="date" min={range.from} max={range.to} value={form.tanggal} onChange={set('tanggal')} /></Field>
            <Field label="Jumlah (qty)"><input className="input" inputMode="numeric" value={form.jumlah} onChange={intOnly('jumlah')} /></Field>
            <Field label="Keterangan pengeluaran" className="full"><input className="input" value={form.keterangan} onChange={set('keterangan')} placeholder="Contoh: Beli bola futsal" /></Field>
            <Field label="Nominal satuan (Rp)"><input className="input" inputMode="numeric" value={form.nominal} onChange={intOnly('nominal')} /></Field>
            <Field label="Total"><input className="input" value={rupiah(totalForm)} readOnly /></Field>
            <div className="full">
              <button className="btn sec" onClick={() => fileRef.current.click()}><Paperclip size={16} />{bukti ? 'Ganti bukti' : 'Unggah bukti (opsional)'}</button>
              <input ref={fileRef} type="file" hidden accept="image/jpeg,image/png,image/webp,application/pdf" onChange={pick} />
              <span className="hint" style={{ marginLeft: 10 }}>{bukti ? `Dipilih: ${bukti.name}` : form.buktiUrl ? 'Bukti lama tersimpan' : 'JPG, PNG, WEBP, atau PDF maks. 4 MB'}</span>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
