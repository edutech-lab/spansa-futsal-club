import { useState } from 'react';
import { Clock, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Card, DataTable, ErrorBox, Field, Loading, Modal, PageHead, useLoad, useUi } from '../ui.jsx';
import { tglID, termRange, ymd } from '../utils.js';

const EMPTY = { id: '', tanggal: '', jam: '15:00', lawan: '', lokasi: '', jenis: 'Persahabatan', catatan: '' };

export default function Jadwal() {
  const { term, isAdmin } = useAuth();
  const { toast, confirm } = useUi();
  const { data, loading, error, reload } = useLoad(() => api('listJadwal', { term }), [term]);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const range = termRange(term);
  const today = ymd(new Date());
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    if (!form.tanggal || !form.lawan.trim()) return toast('Tanggal dan lawan wajib diisi', 'err');
    setBusy(true);
    try { await api('saveJadwal', { jadwal: form }); toast('Jadwal disimpan'); setForm(null); reload(); } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const del = async (j) => {
    if (!(await confirm(`Hapus jadwal melawan ${j.lawan}? Formasi pertandingan ini ikut terhapus.`, { danger: true, okText: 'Hapus' }))) return;
    try { await api('deleteJadwal', { id: j.id }); toast('Jadwal dihapus'); reload(); } catch (e) { toast(e.message, 'err'); }
  };

  return (
    <>
      <PageHead title="Jadwal Pertandingan" subtitle={isAdmin ? 'Jadwal tampil sebagai pengingat di dashboard anggota' : 'Jadwal pertandingan klub (hanya lihat)'}>
        {isAdmin && <button className="btn" onClick={() => setForm({ ...EMPTY, tanggal: today >= range.from && today <= range.to ? today : range.from })}><Plus size={16} />Tambah Jadwal</button>}
      </PageHead>
      <Card plain>
        {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
          <DataTable rows={data || []} rowKey={(r) => r.id} empty={`Belum ada jadwal pada ${term}`} columns={[
            { label: 'Tanggal', render: (r) => tglID(r.tanggal), nowrap: true },
            { label: 'Jam', render: (r) => <span className="row" style={{ gap: 4 }}><Clock size={14} />{r.jam}</span> },
            { label: 'Pertandingan', render: (r) => <b>Spansa FC vs {r.lawan}</b> },
            { label: 'Lokasi', render: (r) => <span className="row" style={{ gap: 4 }}><MapPin size={14} />{r.lokasi || '-'}</span> },
            { label: 'Jenis', render: (r) => <span className="chip">{r.jenis}</span> },
            { label: 'Status', render: (r) => (r.tanggal >= today ? <span className="chip ok">Mendatang</span> : <span className="chip">Selesai</span>) },
            ...(isAdmin ? [{ label: 'Aksi', align: 'right', render: (r) => (<div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
              <button className="btn sec sm icon" aria-label="Ubah" onClick={() => setForm({ ...r })}><Pencil size={14} /></button>
              <button className="btn sec sm icon" aria-label="Hapus" onClick={() => del(r)}><Trash2 size={14} color="#EF4444" /></button></div>) }] : [])
          ]} />
        )}
      </Card>
      <Modal open={!!form} onClose={() => setForm(null)} title={form && form.id ? 'Ubah Jadwal' : 'Tambah Jadwal'} footer={<><button className="btn sec" onClick={() => setForm(null)}>Batal</button><button className="btn" disabled={busy} onClick={save}>{busy ? 'Menyimpan...' : 'Simpan'}</button></>}>
        {form && (
          <div className="form-grid">
            <Field label="Tanggal"><input className="input" type="date" min={range.from} max={range.to} value={form.tanggal} onChange={set('tanggal')} /></Field>
            <Field label="Jam (WIB)"><input className="input" type="time" value={form.jam} onChange={set('jam')} /></Field>
            <Field label="Lawan" className="full"><input className="input" value={form.lawan} onChange={set('lawan')} placeholder="Nama tim lawan" /></Field>
            <Field label="Lokasi"><input className="input" value={form.lokasi} onChange={set('lokasi')} placeholder="Nama GOR / lapangan" /></Field>
            <Field label="Jenis"><select className="input" value={form.jenis} onChange={set('jenis')}><option>Persahabatan</option><option>Turnamen</option><option>Liga</option><option>Latih Tanding</option></select></Field>
            <Field label="Catatan (opsional)" className="full"><textarea className="input" value={form.catatan} onChange={set('catatan')} /></Field>
          </div>
        )}
      </Modal>
    </>
  );
}
