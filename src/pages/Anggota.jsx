import { useMemo, useState } from 'react';
import { Check, Download, KeyRound, Pencil, Plus, Search, Trash2, UserPlus } from 'lucide-react';
import { api } from '../api.js';
import { Avatar, Card, DataTable, ErrorBox, Field, Loading, Modal, PageHead, SearchBox, useLoad, useUi } from '../ui.jsx';
import { exportXlsx, tglID } from '../utils.js';

export default function Anggota() {
  const { toast, confirm } = useUi();
  const { data, loading, error, reload } = useLoad(() => api('listAnggota'), []);
  const [q, setQ] = useState('');
  const [add, setAdd] = useState(false);
  const [edit, setEdit] = useState(null);

  const rows = useMemo(() => (data || []).filter((a) => !q || (a.nama + ' ' + a.nisn + ' ' + a.kelas).toLowerCase().includes(q.toLowerCase())), [data, q]);

  const remove = async (a) => {
    if (!(await confirm(`Keluarkan ${a.nama} dari anggota futsal? Riwayat presensi tetap tersimpan.`, { danger: true, okText: 'Keluarkan' }))) return;
    try { await api('removeAnggota', { nisn: a.nisn }); toast('Anggota dikeluarkan'); reload(); } catch (e) { toast(e.message, 'err'); }
  };
  const reset = async (a) => {
    if (!(await confirm(`Reset password ${a.nama} menjadi NISN?`))) return;
    try { await api('resetPassword', { nisn: a.nisn }); toast('Password dikembalikan ke NISN'); } catch (e) { toast(e.message, 'err'); }
  };
  const exp = () => exportXlsx('anggota_futsal.xlsx', 'Anggota Futsal', ['NISN', 'Nama', 'Jenis Kelamin', 'Kelas', 'Tanggal Bergabung'], rows.map((a) => [a.nisn, a.nama, a.jk, a.kelas, a.tglBergabung]), [0, 3, 4]);

  return (
    <>
      <PageHead title="Anggota Futsal" subtitle="Dipilih dari Data Siswa">
        <button className="btn sec" onClick={exp} disabled={!rows.length}><Download size={16} />Ekspor</button>
        <button className="btn" onClick={() => setAdd(true)}><UserPlus size={16} />Tambah Anggota</button>
      </PageHead>
      <Card plain>
        <div className="toolbar"><SearchBox value={q} onChange={setQ} placeholder="Cari nama, NISN, atau kelas" /><span className="hint">{rows.length} anggota</span></div>
        {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
          <DataTable rows={rows} rowKey={(r) => r.nisn} empty="Belum ada anggota futsal" columns={[
            { label: 'No', render: (r, i) => i + 1, width: 50 },
            { label: 'Nama', render: (r) => <span className="row"><Avatar src={r.fotoUrl} name={r.nama} size={32} />{r.nama}</span> },
            { label: 'NISN', key: 'nisn', nowrap: true }, { label: 'JK', key: 'jk', align: 'center' }, { label: 'Kelas', key: 'kelas' },
            { label: 'Bergabung', render: (r) => tglID(r.tglBergabung, true), nowrap: true },
            { label: 'Aksi', align: 'right', render: (r) => (<div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
              <button className="btn sec sm icon" aria-label="Ubah tanggal bergabung" onClick={() => setEdit({ nisn: r.nisn, nama: r.nama, tglBergabung: r.tglBergabung })}><Pencil size={14} /></button>
              <button className="btn sec sm icon" aria-label="Reset password" onClick={() => reset(r)}><KeyRound size={14} /></button>
              <button className="btn sec sm icon" aria-label="Keluarkan" onClick={() => remove(r)}><Trash2 size={14} color="#EF4444" /></button></div>) }
          ]} />
        )}
      </Card>
      <AddModal open={add} onClose={() => setAdd(false)} onDone={reload} />
      <Modal open={!!edit} onClose={() => setEdit(null)} title="Ubah Tanggal Bergabung" footer={<><button className="btn sec" onClick={() => setEdit(null)}>Batal</button><button className="btn" onClick={async () => {
        try { await api('updateAnggota', { nisn: edit.nisn, tglBergabung: edit.tglBergabung }); toast('Tersimpan'); setEdit(null); reload(); } catch (e) { toast(e.message, 'err'); }
      }}>Simpan</button></>}>
        {edit && <Field label={edit.nama} hint="Opsional, boleh dikosongkan"><input className="input" type="date" value={edit.tglBergabung || ''} onChange={(e) => setEdit({ ...edit, tglBergabung: e.target.value })} /></Field>}
      </Modal>
    </>
  );
}

function AddModal({ open, onClose, onDone }) {
  const { toast } = useUi();
  const { data, loading, reload } = useLoad(() => (open ? api('listSiswa') : Promise.resolve([])), [open]);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState({});
  const [tgl, setTgl] = useState('');
  const [busy, setBusy] = useState(false);
  const cand = useMemo(() => (data || []).filter((s) => !s.isAnggota && (!q || (s.nama + ' ' + s.nisn + ' ' + s.kelas).toLowerCase().includes(q.toLowerCase()))).slice(0, 200), [data, q]);
  const nisns = Object.keys(sel).filter((k) => sel[k]);
  const close = () => { setSel({}); setQ(''); setTgl(''); onClose(); };
  const toggle = (n) => setSel({ ...sel, [n]: !sel[n] });
  const allShown = cand.length > 0 && cand.every((s) => sel[s.nisn]);
  const toggleAll = () => { const next = { ...sel }; cand.forEach((s) => { next[s.nisn] = !allShown; }); setSel(next); };
  const submit = async () => {
    setBusy(true);
    try { await api('addAnggota', { nisns, tglBergabung: tgl }); toast(`${nisns.length} anggota ditambahkan`); onDone(); reload(); close(); } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={close} wide title="Tambah Anggota dari Data Siswa" footer={<><button className="btn sec" onClick={close}>Batal</button><button className="btn" disabled={busy || !nisns.length} onClick={submit}><Plus size={16} />{busy ? 'Menyimpan...' : `Tambahkan ${nisns.length} siswa`}</button></>}>
      <div className="pair">
        <Field label="Cari siswa">
          <div className="search full"><Search size={16} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nama, NISN, atau kelas" /></div>
        </Field>
        <Field label="Tanggal bergabung (opsional)"><input className="input" type="date" value={tgl} onChange={(e) => setTgl(e.target.value)} /></Field>
      </div>
      <div className="row between wrap" style={{ margin: '14px 0 8px' }}>
        <span className={'chip ' + (nisns.length ? '' : 'warn')}>{nisns.length} siswa dipilih</span>
        <div className="row">
          {nisns.length > 0 && <button type="button" className="btn ghost sm" onClick={() => setSel({})}>Kosongkan</button>}
          <button type="button" className="btn sec sm" onClick={toggleAll} disabled={!cand.length}>{allShown ? 'Batal pilih semua' : 'Pilih semua hasil'}</button>
        </div>
      </div>
      {loading ? <Loading /> : cand.length === 0 ? <p className="mut c" style={{ padding: 20 }}>Tidak ada siswa yang dapat ditambahkan. Pastikan Data Siswa sudah diisi.</p> : (
        <div className="pick-list" role="group" aria-label="Daftar siswa">
          {cand.map((s) => (
            <button key={s.nisn} type="button" role="checkbox" aria-checked={!!sel[s.nisn]} className={'pick' + (sel[s.nisn] ? ' on' : '')} onClick={() => toggle(s.nisn)}>
              <Avatar name={s.nama} size={38} />
              <span className="tx"><b>{s.nama}</b><small>{s.nisn} · Kelas {s.kelas} · {s.jk === 'L' ? 'Laki-laki' : 'Perempuan'}</small></span>
              <span className="tick"><Check size={14} strokeWidth={3} /></span>
            </button>
          ))}
        </div>
      )}
      <p className="hint" style={{ marginTop: 10 }}>Akun login anggota dibuat otomatis: username dan password awal adalah NISN.</p>
    </Modal>
  );
}
