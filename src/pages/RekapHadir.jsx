import { useState } from 'react';
import { Download } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Card, DataTable, ErrorBox, Loading, MonthSelect, PageHead, SearchBox, useLoad } from '../ui.jsx';
import { STATUS_LABEL, defaultMonth, exportXlsx, monthLabel, termRange, tglID } from '../utils.js';

export default function RekapHadir() {
  const { term, isAdmin } = useAuth();
  const [bulan, setBulan] = useState(defaultMonth(term));
  const [q, setQ] = useState('');
  const active = termRange(term).months.includes(bulan) ? bulan : defaultMonth(term);
  const { data, loading, error, reload } = useLoad(() => api('rekapHadir', { term, bulan: active }), [term, active]);
  const rows = (data ? data.rows : []).filter((r) => !q || (r.nama + ' ' + r.nisn).toLowerCase().includes(q.toLowerCase()));
  const exp = () => exportXlsx(`rekap_kehadiran_${active}.xlsx`, 'Rekap Kehadiran', ['No', 'NISN', 'Nama', 'Kelas', 'Hadir', 'Sakit', 'Izin', 'Alpa', 'Total Pertemuan', 'Persentase'],
    rows.map((r, i) => [i + 1, r.nisn, r.nama, r.kelas, r.H, r.S, r.I, r.A, data.totalPertemuan, r.persen + '%']), [1, 3]);

  return (
    <>
      <PageHead title="Rekap Kehadiran" subtitle={`${monthLabel(active)} · ${term}`}>
        <MonthSelect term={term} value={active} onChange={setBulan} />
        {isAdmin && <button className="btn sec" onClick={exp} disabled={!rows.length}><Download size={16} />Ekspor</button>}
      </PageHead>
      <Card plain>
        {isAdmin && <div className="toolbar"><SearchBox value={q} onChange={setQ} placeholder="Cari nama" />{data && <span className="chip">{data.totalPertemuan} pertemuan</span>}</div>}
        {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
          <>
            <DataTable pageSize={50} rows={rows} rowKey={(r) => r.nisn} empty={`Belum ada presensi pada ${monthLabel(active)}`} columns={[
              { label: 'No', render: (r, i) => i + 1, width: 50 }, { label: 'NISN', key: 'nisn', nowrap: true }, { label: 'Nama', key: 'nama' }, { label: 'Kelas', key: 'kelas' },
              { label: 'H', render: (r) => <span className="chip ok">{r.H}</span>, align: 'center' }, { label: 'S', render: (r) => <span className="chip warn">{r.S}</span>, align: 'center' },
              { label: 'I', render: (r) => <span className="chip">{r.I}</span>, align: 'center' }, { label: 'A', render: (r) => <span className="chip err">{r.A}</span>, align: 'center' },
              { label: 'Persentase', render: (r) => <b>{r.persen}%</b>, align: 'right' }
            ]} />
            {!isAdmin && data && data.detail.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div className="b" style={{ color: 'var(--navy)', marginBottom: 6 }}>Rincian per pertemuan</div>
                <DataTable rows={data.detail} empty="" columns={[
                  { label: 'Tanggal', render: (r) => tglID(r.tanggal), nowrap: true }, { label: 'Keterangan', render: (r) => r.keterangan || '-' },
                  { label: 'Presensi', render: (r) => <span className={'chip ' + (r.status === 'H' ? 'ok' : r.status === 'S' ? 'warn' : r.status === 'A' ? 'err' : '')}>{STATUS_LABEL[r.status]}</span> }
                ]} />
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}
