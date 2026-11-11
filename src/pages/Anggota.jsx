import { useMemo, useRef, useState } from 'react';
import { Camera, Check, Download, KeyRound, Loader2, Pencil, Plus, Search, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Avatar, Card, DataTable, Empty, ErrorBox, Field, Loading, Modal, PageHead, SearchBox, useLoad, useUi } from '../ui.jsx';
import PhotoCropper from '../components/PhotoCropper.jsx';
import { exportXlsx, tglID } from '../utils.js';

export default function Anggota() {
  const { isAdmin } = useAuth();
  return isAdmin ? <AnggotaAdmin /> : <AnggotaView />;
}

/* Tampilan anggota: hanya lihat. Data dari daftar "roster" (tanpa NISN dan data kelahiran). */
function AnggotaView() {
  const { data, loading, error, reload } = useLoad(() => api('listRoster'), []);
  const [q, setQ] = useState('');
  const rows = useMemo(() => (data || []).filter((a) => !q || (a.nama + ' ' + a.kelas).toLowerCase().includes(q.toLowerCase())), [data, q]);
  return (
    <>
      <PageHead title="Anggota Futsal" subtitle="Daftar anggota klub (hanya lihat)" />
      <Card plain>
        <div className="toolbar"><SearchBox value={q} onChange={setQ} placeholder="Cari nama atau kelas" /><span className="hint">{rows.length} anggota</span></div>
        {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : rows.length === 0 ? <Empty text={q ? 'Anggota tidak ditemukan' : 'Belum ada data anggota. Admin perlu membuka menu Anggota Futsal sekali untuk menyiapkan daftar.'} /> : (
          <div className="roster">
            {rows.map((a) => (
              <div key={a.rid} className="rcard">
                <Avatar src={a.fotoUrl} name={a.nama} size={64} />
                <b>{a.nama}</b>
                <span className="chip">Kelas {a.kelas || '-'}</span>
                <small>{a.jk === 'L' ? 'Laki-laki' : a.jk === 'P' ? 'Perempuan' : '-'}{a.tglBergabung ? ' · Bergabung ' + tglID(a.tglBergabung, true) : ''}</small>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

function AnggotaAdmin() {
  const { toast, confirm } = useUi();
  const fileRef = useRef(null);
  const photoFor = useRef(null);
  const [fixing, setFixing] = useState(false);
  const [cropFile, setCropFile] = useState(null);
  const [sel, setSel] = useState({});
  const [bulk, setBulk] = useState('');
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
  const pickPhoto = (a) => { photoFor.current = a; fileRef.current.click(); };
  const onPhoto = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\//.test(file.type)) return toast('Berkas harus berupa gambar', 'err');
    setCropFile(file);
  };
  const uploadPhoto = async (img) => {
    const a = photoFor.current;
    if (!a) throw new Error('Anggota tidak dipilih');
    await api('updateAnggotaPhoto', { nisn: a.nisn, ...img });
    setCropFile(null);
    toast('Foto ' + a.nama + ' diperbarui');
    reload();
  };
  const selected = (data || []).map((a) => a.nisn).filter((n) => sel[n]);
  const allSel = rows.length > 0 && rows.every((r) => sel[r.nisn]);
  const toggleAll = () => { const next = { ...sel }; rows.forEach((r) => { next[r.nisn] = !allSel; }); setSel(next); };
  const runReset = async (all) => {
    const list = all ? (data || []).map((a) => a.nisn) : selected;
    if (!list.length) return;
    const msg = all
      ? `Reset password SEMUA ${list.length} anggota aktif menjadi NISN masing-masing? Anggota yang pernah mengganti password harus masuk dengan NISN lagi, dan sesi login mereka akan keluar.`
      : `Reset password ${list.length} anggota terpilih menjadi NISN? Sesi login mereka akan keluar.`;
    if (!(await confirm(msg, { danger: all, okText: 'Reset password' }))) return;
    setBulk('0/' + list.length);
    try {
      const r = await api('resetPasswords', { nisns: list, onProgress: (d, t) => setBulk(d + '/' + t) });
      if (r.gagal.length) toast(`${r.ok} dari ${r.total} berhasil. Gagal: ` + r.gagal.slice(0, 2).map((g) => g.nama + ' - ' + g.alasan).join(' | '), 'err');
      else toast(`Password ${r.ok} anggota dikembalikan ke NISN`);
      setSel({});
    } catch (e) { toast(e.message, 'err'); } finally { setBulk(''); }
  };
  const fixAccounts = async () => {
    if (!(await confirm('Periksa dan perbaiki akun login SEMUA anggota aktif? Akun yang belum ada akan dibuat (password awal = NISN). Password yang sudah diganti anggota tidak berubah.'))) return;
    setFixing(true);
    try {
      toast('Memeriksa akun anggota...', 'load');
      const r = await api('syncAccounts');
      if (r.gagal.length) toast(`${r.total - r.gagal.length} dari ${r.total} akun siap. Gagal: ` + r.gagal.slice(0, 2).map((g) => g.nama + ' - ' + g.alasan).join(' | '), 'err');
      else toast(`Semua ${r.total} akun anggota siap dipakai`);
      reload();
    } catch (e) { toast(e.message, 'err'); } finally { setFixing(false); }
  };
  const exp = () => exportXlsx('anggota_futsal.xlsx', 'Anggota Futsal', ['NISN', 'Nama', 'Jenis Kelamin', 'Kelas', 'Tanggal Bergabung'], rows.map((a) => [a.nisn, a.nama, a.jk, a.kelas, a.tglBergabung]), [0, 3, 4]);

  return (
    <>
      <PageHead title="Anggota Futsal" subtitle="Dipilih dari Data Siswa">
        <button className="btn sec" onClick={fixAccounts} disabled={fixing} title="Buat/aktifkan ulang akun login anggota yang bermasalah">{fixing ? <Loader2 size={16} className="spin" /> : <ShieldCheck size={16} />}Perbaiki Akun Login</button>
        <button className="btn sec" onClick={exp} disabled={!rows.length}><Download size={16} />Ekspor</button>
        <button className="btn" onClick={() => setAdd(true)}><UserPlus size={16} />Tambah Anggota</button>
      </PageHead>
      <Card plain>
        <div className="toolbar"><SearchBox value={q} onChange={setQ} placeholder="Cari nama, NISN, atau kelas" /><span className="hint">{rows.length} anggota{selected.length ? ` · ${selected.length} dipilih` : ''}</span>
          <div className="row wrap" style={{ marginLeft: 'auto', gap: 8 }}>
            {selected.length > 0 && <button className="btn sec sm" onClick={() => setSel({})} disabled={!!bulk}>Kosongkan pilihan</button>}
            <button className="btn sec sm" onClick={() => runReset(false)} disabled={!!bulk || !selected.length}><KeyRound size={14} />{bulk ? `Mereset ${bulk}...` : `Reset Password Terpilih${selected.length ? ` (${selected.length})` : ''}`}</button>
            <button className="btn sec sm" onClick={() => runReset(true)} disabled={!!bulk || !(data || []).length}><KeyRound size={14} />Reset Semua</button>
          </div></div>
        {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
          <DataTable rows={rows} rowKey={(r) => r.nisn} empty="Belum ada anggota futsal" columns={[
            { key: 'sel', label: <input type="checkbox" aria-label="Pilih semua anggota" checked={allSel} onChange={toggleAll} />, width: 36, render: (r) => <input type="checkbox" aria-label={'Pilih ' + r.nama} checked={!!sel[r.nisn]} onChange={() => setSel({ ...sel, [r.nisn]: !sel[r.nisn] })} /> },
            { label: 'No', render: (r, i) => i + 1, width: 50 },
            { label: 'Nama', render: (r) => <span className="row"><Avatar src={r.fotoUrl} name={r.nama} size={32} />{r.nama}</span> },
            { label: 'NISN', key: 'nisn', nowrap: true }, { label: 'JK', key: 'jk', align: 'center' }, { label: 'Kelas', key: 'kelas' },
            { label: 'Bergabung', render: (r) => tglID(r.tglBergabung, true), nowrap: true },
            { label: 'Aksi', align: 'right', render: (r) => (<div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
              <button className="btn sec sm icon" aria-label="Ganti foto" title="Unggah foto anggota" onClick={() => pickPhoto(r)}><Camera size={14} /></button>
              <button className="btn sec sm icon" aria-label="Ubah tanggal bergabung" onClick={() => setEdit({ nisn: r.nisn, nama: r.nama, tglBergabung: r.tglBergabung })}><Pencil size={14} /></button>
              <button className="btn sec sm icon" aria-label="Reset password" onClick={() => reset(r)}><KeyRound size={14} /></button>
              <button className="btn sec sm icon" aria-label="Keluarkan" onClick={() => remove(r)}><Trash2 size={14} color="#EF4444" /></button></div>) }
          ]} />
        )}
      </Card>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto} />
      <PhotoCropper file={cropFile} onCancel={() => setCropFile(null)} onDone={uploadPhoto} />
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
