import { useEffect, useMemo, useState } from 'react';
import { CheckCheck, Download, Save, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Card, ErrorBox, Field, Loading, PageHead, SearchBox, useLoad, useUi } from '../ui.jsx';
import { STATUS_LABEL, exportXlsx, rupiah, termRange, tglID, ymd } from '../utils.js';

export default function Hadir() {
  const { term } = useAuth();
  const { toast, confirm } = useUi();
  const range = termRange(term);
  const today = ymd(new Date());
  const [tanggal, setTanggal] = useState(today >= range.from && today <= range.to ? today : range.from);
  const [rows, setRows] = useState([]);
  const [ket, setKet] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { setTanggal(today >= range.from && today <= range.to ? today : range.from); }, [term]); // eslint-disable-line
  const list = useLoad(() => api('listPertemuan', { term }), [term]);
  const cur = useLoad(() => api('getPresensi', { tanggal }), [tanggal]);

  useEffect(() => {
    if (cur.data) { setRows(cur.data.anggota.map((a) => ({ ...a }))); setKet(cur.data.pertemuan ? cur.data.pertemuan.keterangan : ''); }
  }, [cur.data]);

  const nominal = cur.data ? cur.data.nominal : 0;
  const view = useMemo(() => rows.filter((r) => !q || (r.nama + ' ' + r.nisn).toLowerCase().includes(q.toLowerCase())), [rows, q]);
  const count = (s) => rows.filter((r) => r.status === s).length;
  const totalIuran = count('H') * nominal;
  const setStatus = (nisn, s) => setRows(rows.map((r) => (r.nisn === nisn ? { ...r, status: s } : r)));
  const exists = !!(cur.data && cur.data.pertemuan);

  const save = async () => {
    if (!rows.length) return toast('Belum ada anggota futsal', 'err');
    setBusy(true);
    try {
      const r = await api('savePresensi', { tanggal, keterangan: ket, items: rows.map((x) => ({ nisn: x.nisn, status: x.status })) });
      toast(`Presensi tersimpan. Iuran terkumpul ${rupiah(r.iuranTotal)}`);
      cur.reload(); list.reload();
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const del = async () => {
    if (!(await confirm(`Hapus presensi tanggal ${tglID(tanggal)}? Iuran hari itu ikut terhapus.`, { danger: true, okText: 'Hapus' }))) return;
    try { await api('deletePertemuan', { id: cur.data.pertemuan.id }); toast('Presensi dihapus'); cur.reload(); list.reload(); } catch (e) { toast(e.message, 'err'); }
  };
  const exp = () => exportXlsx(`presensi_${tanggal}.xlsx`, 'Presensi', ['No', 'NISN', 'Nama', 'Kelas', 'Keterangan', 'Iuran Kas'], rows.map((r, i) => [i + 1, r.nisn, r.nama, r.kelas, STATUS_LABEL[r.status], r.status === 'H' ? nominal : 0]), [1, 3]);

  return (
    <>
      <PageHead title="Daftar Hadir" subtitle={`Iuran kas otomatis ${rupiah(nominal)} per anggota yang hadir`}>
        <button className="btn sec" onClick={exp} disabled={!rows.length}><Download size={16} />Ekspor</button>
        {exists && <button className="btn sec" onClick={del}><Trash2 size={16} color="#EF4444" />Hapus</button>}
      </PageHead>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 280px', alignItems: 'start' }}>
        <Card plain>
          <div className="toolbar">
            <Field label="Tanggal latihan"><input className="input" type="date" min={range.from} max={range.to} value={tanggal} onChange={(e) => e.target.value && setTanggal(e.target.value)} /></Field>
            <Field label="Keterangan (opsional)" className="grow"><input className="input" value={ket} onChange={(e) => setKet(e.target.value)} placeholder="Contoh: Latihan rutin" /></Field>
          </div>
          <div className="toolbar">
            <SearchBox value={q} onChange={setQ} placeholder="Cari nama" />
            <button className="btn sec sm" onClick={() => setRows(rows.map((r) => ({ ...r, status: 'H' })))}><CheckCheck size={14} />Semua Hadir</button>
            {['H', 'S', 'I', 'A'].map((s) => <span key={s} className={'chip ' + (s === 'H' ? 'ok' : s === 'S' ? 'warn' : s === 'A' ? 'err' : '')}>{s}: {count(s)}</span>)}
            <span className="chip vio">Total iuran: {rupiah(totalIuran)}</span>
            {exists ? <span className="chip ok">Tersimpan</span> : <span className="chip warn">Belum disimpan</span>}
          </div>
          {cur.loading ? <Loading /> : cur.error ? <ErrorBox message={cur.error} onRetry={cur.reload} /> : rows.length === 0 ? <p className="mut c" style={{ padding: 24 }}>Belum ada anggota futsal. Tambahkan di menu Anggota Futsal.</p> : (
            <div className="tw">
              <table>
                <thead><tr><th>No</th><th>NISN</th><th>Nama</th><th>Kelas</th><th>Keterangan</th><th className="r">Iuran Kas</th></tr></thead>
                <tbody>
                  {view.map((r, i) => (
                    <tr key={r.nisn}>
                      <td>{i + 1}</td><td className="nowrap">{r.nisn}</td><td>{r.nama}</td><td>{r.kelas}</td>
                      <td><div className="seg">{['H', 'S', 'I', 'A'].map((s) => <button key={s} className={s + (r.status === s ? ' on' : '')} onClick={() => setStatus(r.nisn, s)} aria-label={STATUS_LABEL[s]}>{s}</button>)}</div></td>
                      <td className="r b">{rupiah(r.status === 'H' ? nominal : 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr>
                  <td colSpan={3}><button className="btn" onClick={save} disabled={busy || cur.loading}><Save size={16} />{busy ? 'Menyimpan...' : 'Simpan Presensi'}</button></td>
                  <td colSpan={2} className="r">Total iuran hari ini</td><td className="r">{rupiah(totalIuran)}</td>
                </tr></tfoot>
              </table>
            </div>
          )}
        </Card>
        <Card title="Riwayat Pertemuan" plain>
          {list.loading ? <Loading /> : (list.data || []).length === 0 ? <p className="mut">Belum ada presensi pada {term}.</p> : (
            <div className="stack" style={{ gap: 6, maxHeight: 520, overflowY: 'auto' }}>
              {list.data.map((p) => (
                <button key={p.id} className="btn sec" style={{ justifyContent: 'space-between', height: 'auto', padding: '8px 12px', background: p.tanggal === tanggal ? '#EEF3FF' : '#fff' }} onClick={() => setTanggal(p.tanggal)}>
                  <span style={{ textAlign: 'left' }}>{tglID(p.tanggal, true)}<br /><small className="mut">{p.hadir}/{p.total} hadir</small></span><span className="chip ok">{rupiah(p.iuranTotal)}</span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
      <style>{'@media (max-width:1024px){.grid[style*="280px"]{grid-template-columns:1fr!important}}'}</style>
    </>
  );
}
