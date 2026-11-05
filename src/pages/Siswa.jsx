import { useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { api } from '../api.js';
import { DataTable, Field, Loading, ErrorBox, Modal, PageHead, SearchBox, useLoad, useUi, Card } from '../ui.jsx';
import { cellDate, cellStr, exportXlsx, readSheetCells, tglID } from '../utils.js';

const EMPTY = { nisn: '', nama: '', jk: 'L', kelas: '', tempatLahir: '', tglLahir: '' };
const HEAD = {
  nisn: ['nisn'], nama: ['nama', 'nama siswa', 'nama lengkap'], jk: ['jenis kelamin', 'jk', 'l/p', 'gender'],
  kelas: ['kelas'], tempatLahir: ['tempat lahir', 'tempat'], tglLahir: ['tanggal lahir', 'tgl lahir', 'tanggal']
};
const XLS_HEAD = ['NISN', 'Nama', 'Jenis Kelamin', 'Kelas', 'Tempat Lahir', 'Tanggal Lahir'];

function parseSheet(cells) {
  let hi = -1;
  let map = {};
  for (let r = 0; r < Math.min(cells.length, 10) && hi < 0; r++) {
    const m = {};
    cells[r].forEach((c, i) => {
      const t = cellStr(c).toLowerCase();
      Object.keys(HEAD).forEach((k) => { if (HEAD[k].includes(t) && m[k] === undefined) m[k] = i; });
    });
    if (m.nisn !== undefined && m.nama !== undefined && m.kelas !== undefined) { hi = r; map = m; }
  }
  if (hi < 0) throw new Error('Header tidak ditemukan. Gunakan template: NISN, Nama, Jenis Kelamin, Kelas, Tempat Lahir, Tanggal Lahir.');
  const rows = [];
  const seen = new Set();
  for (let r = hi + 1; r < cells.length; r++) {
    const g = (k) => (map[k] === undefined ? null : cells[r][map[k]]);
    const nisn = cellStr(g('nisn'), { pad: 10 });
    const nama = cellStr(g('nama'));
    const kelas = cellStr(g('kelas'));
    if (!nisn && !nama && !kelas) continue;
    const jkRaw = cellStr(g('jk')).toUpperCase();
    const jk = /^(L|LAKI)/.test(jkRaw) ? 'L' : /^(P|W|PEREMPUAN)/.test(jkRaw) ? 'P' : '';
    const tgl = cellDate(g('tglLahir'));
    const errs = [];
    if (!/^\d{5,20}$/.test(nisn)) errs.push('NISN harus angka 5-20 digit');
    if (seen.has(nisn)) errs.push('NISN ganda di berkas');
    if (!nama) errs.push('Nama kosong');
    if (!jk) errs.push('Jenis kelamin harus L/P');
    if (!kelas) errs.push('Kelas kosong');
    if (!tgl.ok) errs.push('Tanggal lahir tidak valid');
    seen.add(nisn);
    rows.push({ baris: r + 1, nisn, nama, jk, kelas, tempatLahir: cellStr(g('tempatLahir')), tglLahir: tgl.value, errs });
  }
  if (!rows.length) throw new Error('Tidak ada baris data pada berkas.');
  return rows;
}

function ImportModal({ open, onClose, onDone }) {
  const { toast } = useUi();
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const valid = rows ? rows.filter((r) => !r.errs.length) : [];
  const close = () => { setRows(null); onClose(); };
  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try { setRows(parseSheet(await readSheetCells(f))); } catch (err) { setRows(null); toast(err.message, 'err'); }
  };
  const submit = async () => {
    setBusy(true);
    try {
      const res = await api('importSiswa', { rows: valid.map(({ nisn, nama, jk, kelas, tempatLahir, tglLahir }) => ({ nisn, nama, jk, kelas, tempatLahir, tglLahir })) });
      toast(`Impor selesai: ${res.tambah} ditambah, ${res.ubah} diperbarui${res.gagal.length ? `, ${res.gagal.length} gagal` : ''}`);
      setRows(null); onDone(); onClose();
    } catch (err) { toast(err.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={close} wide title="Impor Data Siswa (Excel)" footer={<><button className="btn sec" onClick={close}>Tutup</button><button className="btn" disabled={busy || !valid.length} onClick={submit}>{busy ? 'Menyimpan...' : `Simpan ${valid.length} baris valid`}</button></>}>
      <div className="row wrap" style={{ marginBottom: 12 }}>
        <button className="btn sec" onClick={() => exportXlsx('template_data_siswa.xlsx', 'Data Siswa', XLS_HEAD, [['0012345678', 'Contoh Nama Siswa', 'L', '7A', 'Bandar Lampung', '2013-05-21']], [0, 3, 5])}><FileSpreadsheet size={16} />Unduh Template</button>
        <button className="btn" onClick={() => ref.current.click()}><Upload size={16} />Pilih Berkas .xlsx</button>
        <input ref={ref} type="file" hidden accept=".xlsx,.xls" onChange={onFile} />
      </div>
      <p className="hint" style={{ marginBottom: 10 }}>NISN dan Kelas dibaca sebagai teks. Siswa dengan NISN yang sudah ada akan diperbarui. Format tanggal: yyyy-mm-dd atau dd/mm/yyyy.</p>
      {rows && (
        <>
          <p style={{ marginBottom: 8 }}><span className="chip ok">{valid.length} valid</span> <span className="chip err">{rows.length - valid.length} bermasalah</span></p>
          <div className="tw" style={{ maxHeight: 320, border: '1px solid var(--bd)', borderRadius: 12 }}>
            <table><thead><tr><th>Baris</th><th>NISN</th><th>Nama</th><th>JK</th><th>Kelas</th><th>Tgl Lahir</th><th>Status</th></tr></thead>
              <tbody>{rows.map((r) => <tr key={r.baris}><td>{r.baris}</td><td>{r.nisn}</td><td>{r.nama}</td><td>{r.jk}</td><td>{r.kelas}</td><td>{r.tglLahir}</td><td>{r.errs.length ? <span className="err-t">{r.errs.join('; ')}</span> : <span className="chip ok">OK</span>}</td></tr>)}</tbody></table>
          </div>
        </>
      )}
    </Modal>
  );
}

export default function Siswa() {
  const { toast, confirm } = useUi();
  const { data, loading, error, reload } = useLoad(() => api('listSiswa'), []);
  const [q, setQ] = useState('');
  const [kelas, setKelas] = useState('');
  const [form, setForm] = useState(null);
  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imp, setImp] = useState(false);

  const list = data || [];
  const kelasList = useMemo(() => [...new Set(list.map((s) => s.kelas))].sort((a, b) => a.localeCompare(b, 'id', { numeric: true })), [list]);
  const rows = useMemo(() => list.filter((s) => (!kelas || s.kelas === kelas) && (!q || (s.nama + ' ' + s.nisn).toLowerCase().includes(q.toLowerCase()))), [list, q, kelas]);

  const save = async () => {
    if (!/^\d{5,20}$/.test(form.nisn)) return toast('NISN harus berupa angka (5-20 digit)', 'err');
    if (!form.nama.trim() || !form.kelas.trim()) return toast('Nama dan kelas wajib diisi', 'err');
    setSaving(true);
    try { await api('saveSiswa', { siswa: form, isEdit: edit }); toast('Data siswa disimpan'); setForm(null); reload(); } catch (e) { toast(e.message, 'err'); } finally { setSaving(false); }
  };
  const del = async (s) => {
    if (!(await confirm(`Hapus data siswa ${s.nama}?`, { danger: true, okText: 'Hapus' }))) return;
    try { await api('deleteSiswa', { nisn: s.nisn }); toast('Data siswa dihapus'); reload(); } catch (e) { toast(e.message, 'err'); }
  };
  const exp = () => exportXlsx('data_siswa.xlsx', 'Data Siswa', XLS_HEAD, rows.map((s) => [s.nisn, s.nama, s.jk, s.kelas, s.tempatLahir, s.tglLahir]), [0, 3, 5]);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <PageHead title="Data Siswa" subtitle="Sumber data anggota futsal">
        <button className="btn sec" onClick={exp} disabled={!rows.length}><Download size={16} />Ekspor</button>
        <button className="btn sec" onClick={() => setImp(true)}><Upload size={16} />Impor</button>
        <button className="btn" onClick={() => { setEdit(false); setForm({ ...EMPTY }); }}><Plus size={16} />Tambah</button>
      </PageHead>
      <Card plain>
        <div className="toolbar">
          <SearchBox value={q} onChange={setQ} placeholder="Cari nama atau NISN" />
          <select className="input" style={{ width: 'auto' }} value={kelas} onChange={(e) => setKelas(e.target.value)}><option value="">Semua kelas</option>{kelasList.map((k) => <option key={k}>{k}</option>)}</select>
          <span className="hint">{rows.length} siswa</span>
        </div>
        {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
          <DataTable rows={rows} rowKey={(r) => r.nisn} empty="Belum ada data siswa" columns={[
            { label: 'No', render: (r, i) => i + 1, width: 50 }, { label: 'NISN', key: 'nisn', nowrap: true }, { label: 'Nama', key: 'nama' },
            { label: 'JK', render: (r) => r.jk, align: 'center' }, { label: 'Kelas', key: 'kelas' }, { label: 'Tempat Lahir', key: 'tempatLahir' },
            { label: 'Tanggal Lahir', render: (r) => tglID(r.tglLahir, true), nowrap: true },
            { label: 'Aksi', align: 'right', render: (r) => (<div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
              <button className="btn sec sm icon" aria-label="Ubah" onClick={() => { setEdit(true); setForm({ ...r }); }}><Pencil size={14} /></button>
              <button className="btn sec sm icon" aria-label="Hapus" onClick={() => del(r)}><Trash2 size={14} color="#EF4444" /></button></div>) }
          ]} />
        )}
      </Card>
      <Modal open={!!form} onClose={() => setForm(null)} title={edit ? 'Ubah Data Siswa' : 'Tambah Siswa'} footer={<><button className="btn sec" onClick={() => setForm(null)}>Batal</button><button className="btn" disabled={saving} onClick={save}>{saving ? 'Menyimpan...' : 'Simpan'}</button></>}>
        {form && (
          <div className="form-grid">
            <Field label="NISN" className="full"><input className="input" inputMode="numeric" value={form.nisn} disabled={edit} onChange={set('nisn')} placeholder="Contoh: 0012345678" /></Field>
            <Field label="Nama Lengkap" className="full"><input className="input" value={form.nama} onChange={set('nama')} /></Field>
            <Field label="Jenis Kelamin"><select className="input" value={form.jk} onChange={set('jk')}><option value="L">Laki-laki</option><option value="P">Perempuan</option></select></Field>
            <Field label="Kelas"><input className="input" value={form.kelas} onChange={set('kelas')} placeholder="Contoh: 8A" /></Field>
            <Field label="Tempat Lahir"><input className="input" value={form.tempatLahir} onChange={set('tempatLahir')} /></Field>
            <Field label="Tanggal Lahir"><input className="input" type="date" value={form.tglLahir} onChange={set('tglLahir')} /></Field>
          </div>
        )}
      </Modal>
      <ImportModal open={imp} onClose={() => setImp(false)} onDone={reload} />
    </>
  );
}
