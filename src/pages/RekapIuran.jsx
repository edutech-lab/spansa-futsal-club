import { useState } from 'react';
import { Download } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Card, DataTable, ErrorBox, Loading, MonthSelect, PageHead, SearchBox, useLoad } from '../ui.jsx';
import { defaultMonth, exportXlsx, monthLabel, rupiah, termRange, tglID } from '../utils.js';

export default function RekapIuran() {
  const { term, isAdmin } = useAuth();
  const [bulan, setBulan] = useState(defaultMonth(term));
  const [q, setQ] = useState('');
  const active = termRange(term).months.includes(bulan) ? bulan : defaultMonth(term);
  const { data, loading, error, reload } = useLoad(() => api('rekapIuran', { term, bulan: active }), [term, active]);
  const rows = (data ? data.rows : []).filter((r) => !q || (r.nama + ' ' + r.nisn).toLowerCase().includes(q.toLowerCase()));
  const total = rows.reduce((a, r) => a + r.total, 0);
  const exp = () => exportXlsx(`rekap_iuran_${active}.xlsx`, 'Rekap Iuran', ['No', 'NISN', 'Nama', 'Kelas', 'Iuran per Pertemuan', 'Jumlah Bayar (kali)', 'Total Iuran'],
    [...rows.map((r, i) => [i + 1, r.nisn, r.nama, r.kelas, r.perPertemuan, r.jumlahBayar, r.total]), ['', '', 'TOTAL', '', '', '', total]], [1, 3]);

  return (
    <>
      <PageHead title="Rekap Iuran" subtitle={`${monthLabel(active)} · ${term}`}>
        <MonthSelect term={term} value={active} onChange={setBulan} />
        {isAdmin && <button className="btn sec" onClick={exp} disabled={!rows.length}><Download size={16} />Ekspor</button>}
      </PageHead>
      <Card plain>
        <div className="toolbar">
          {isAdmin && <SearchBox value={q} onChange={setQ} placeholder="Cari nama" />}
          {data && <span className="chip">{data.totalPertemuan} pertemuan bulan ini</span>}
          {data && isAdmin && <span className="chip vio">Total kas masuk: {rupiah(data.totalKas)}</span>}
        </div>
        {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
          <>
            <DataTable pageSize={50} rows={rows} rowKey={(r) => r.nisn} empty={`Belum ada iuran pada ${monthLabel(active)}`}
              foot={rows.length > 1 ? <tr><td colSpan={6} className="r">Total</td><td className="r">{rupiah(total)}</td></tr> : null}
              columns={[
                { label: 'No', render: (r, i) => i + 1, width: 50 }, { label: 'NISN', key: 'nisn', nowrap: true }, { label: 'Nama', key: 'nama' }, { label: 'Kelas', key: 'kelas' },
                { label: 'Iuran / Pertemuan', render: (r) => rupiah(r.perPertemuan), align: 'right' }, { label: 'Bayar (kali)', key: 'jumlahBayar', align: 'center' },
                { label: 'Total Iuran', render: (r) => <b>{rupiah(r.total)}</b>, align: 'right' }
              ]} />
            {!isAdmin && data && data.detail.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div className="b" style={{ color: 'var(--navy)', marginBottom: 6 }}>Rincian per pertemuan</div>
                <DataTable rows={data.detail} empty="" columns={[
                  { label: 'Tanggal', render: (r) => tglID(r.tanggal), nowrap: true },
                  { label: 'Presensi', render: (r) => <span className={'chip ' + (r.status === 'H' ? 'ok' : '')}>{r.status}</span> },
                  { label: 'Iuran', render: (r) => rupiah(r.iuran), align: 'right' }
                ]} />
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}
