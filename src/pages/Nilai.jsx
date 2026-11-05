import { useEffect, useState } from 'react';
import { Download, Save } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Card, DataTable, ErrorBox, Loading, PageHead, SearchBox, useLoad, useUi } from '../ui.jsx';
import { exportXlsx } from '../utils.js';

const CHIP = { A: 'ok', B: '', C: 'warn', D: 'err' };

export default function Nilai() {
  const { term, settings } = useAuth();
  const { toast } = useUi();
  const { data, loading, error, reload } = useLoad(() => api('listNilai', { term }), [term]);
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const bh = Number(settings.bobotHadir || 70);
  const bi = Number(settings.bobotIndividu || 30);
  const bA = Number(settings.batasA || 85);
  const bB = Number(settings.batasB || 75);
  const bC = Number(settings.batasC || 60);

  useEffect(() => { if (data) setRows(data.rows.map((r) => ({ ...r }))); }, [data]);

  const calc = (r) => {
    if (r.kemampuan === '' || r.kemampuan === null) return { total: '', predikat: '-' };
    const total = Math.round(((r.persenHadir * bh + Number(r.kemampuan) * bi) / 100) * 10) / 10;
    return { total, predikat: total >= bA ? 'A' : total >= bB ? 'B' : total >= bC ? 'C' : 'D' };
  };
  const setK = (nisn, v) => {
    if (v !== '' && (!/^\d{0,3}(\.\d{0,1})?$/.test(v) || Number(v) > 100)) return;
    setRows(rows.map((r) => (r.nisn === nisn ? { ...r, kemampuan: v } : r)));
  };
  const view = rows.filter((r) => !q || (r.nama + ' ' + r.nisn).toLowerCase().includes(q.toLowerCase()));
  const save = async () => {
    setBusy(true);
    try {
      await api('saveNilai', { term, items: rows.map((r) => ({ nisn: r.nisn, kemampuan: r.kemampuan === '' ? '' : Number(r.kemampuan) })) });
      toast('Nilai semester tersimpan'); reload();
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const exp = () => exportXlsx(`nilai_${term.replace('/', '-').replace(' ', '_')}.xlsx`, 'Nilai', ['NISN', 'Nama', 'Kelas', `Kehadiran (${bh}%)`, `Kemampuan Individu (${bi}%)`, 'Total Nilai', 'Predikat'],
    rows.map((r) => { const c = calc(r); return [r.nisn, r.nama, r.kelas, Math.round(r.persenHadir * bh) / 100, r.kemampuan === '' ? '' : Math.round(Number(r.kemampuan) * bi) / 100, c.total, c.predikat]; }), [0, 2]);

  return (
    <>
      <PageHead title="Nilai Semester" subtitle={`${term} · ${bh}% kehadiran + ${bi}% kemampuan individu`}>
        <button className="btn sec" onClick={exp} disabled={!rows.length}><Download size={16} />Ekspor</button>
        <button className="btn" onClick={save} disabled={busy || !rows.length}><Save size={16} />{busy ? 'Menyimpan...' : 'Simpan Nilai'}</button>
      </PageHead>
      <Card plain>
        <div className="toolbar">
          <SearchBox value={q} onChange={setQ} placeholder="Cari nama" />
          {data && <span className="chip">{data.totalPertemuan} pertemuan semester ini</span>}
          <span className="hint">Predikat: A ≥ {bA}, B ≥ {bB}, C ≥ {bC}, D di bawahnya</span>
        </div>
        {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
          <DataTable pageSize={50} rows={view} rowKey={(r) => r.nisn} empty="Belum ada anggota futsal" columns={[
            { label: 'No', render: (r, i) => i + 1, width: 50 }, { label: 'NISN', key: 'nisn', nowrap: true }, { label: 'Nama', key: 'nama' }, { label: 'Kelas', key: 'kelas' },
            { label: 'Kehadiran', render: (r) => <span>{r.hadir}/{data.totalPertemuan} · <b>{r.persenHadir}%</b></span>, nowrap: true },
            { label: `Nilai Hadir (${bh}%)`, render: (r) => Math.round(r.persenHadir * bh) / 100, align: 'right' },
            { label: `Kemampuan (${bi}%)`, render: (r) => <input className="input" style={{ width: 90, height: 34, textAlign: 'right' }} inputMode="decimal" value={r.kemampuan} onChange={(e) => setK(r.nisn, e.target.value)} placeholder="0-100" aria-label={`Kemampuan ${r.nama}`} />, align: 'right' },
            { label: 'Total', render: (r) => <b>{calc(r).total === '' ? '-' : calc(r).total}</b>, align: 'right' },
            { label: 'Predikat', render: (r) => { const p = calc(r).predikat; return <span className={'chip ' + (CHIP[p] || '')}>{p}</span>; }, align: 'center' }
          ]} />
        )}
      </Card>
    </>
  );
}
