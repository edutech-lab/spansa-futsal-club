import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, PiggyBank, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Card, DataTable, ErrorBox, Loading, PageHead, useLoad } from '../ui.jsx';
import { exportXlsx, monthLabel, monthShort, rupiah } from '../utils.js';

export default function RekapKas() {
  const { term } = useAuth();
  const { data, loading, error, reload } = useLoad(() => api('rekapKas', { term }), [term]);
  const d = data;
  const exp = () => exportXlsx(`rekap_keuangan_${term.replace('/', '-').replace(' ', '_')}.xlsx`, 'Rekap Keuangan', ['Bulan', 'Iuran Anggota', 'Pemasukan Lain', 'Pengeluaran', 'Saldo'],
    [['Saldo awal', '', '', '', d.saldoAwal], ...d.rows.map((r) => [monthLabel(r.bulan), r.masuk, r.masukLain, r.keluar, r.saldo]), ['TOTAL', d.totalMasuk, d.totalMasukLain, d.totalKeluar, d.saldoAkhir]]);
  const Box = ({ icon: I, color, label, value, sub }) => (
    <div className="card stat"><div className="ic" style={{ background: color }}><I size={22} /></div><div><div className="lb">{label}</div><div className="vl" style={{ fontSize: 22 }}>{rupiah(value)}</div>{sub && <div className="sub">{sub}</div>}</div></div>
  );
  return (
    <>
      <PageHead title="Rekap Pemasukan & Pengeluaran" subtitle={term}>
        <button className="btn sec" onClick={exp} disabled={!d}><Download size={16} />Ekspor</button>
      </PageHead>
      {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <div className="stack">
          <div className="grid g-stats">
            <Box icon={Wallet} color="#6D4AE0" label="Saldo Awal" value={d.saldoAwal} sub="Saldo awal kas + akumulasi sebelumnya" />
            <Box icon={TrendingUp} color="#1E63F0" label="Total Pemasukan" value={d.totalMasuk + d.totalMasukLain} sub={`Iuran ${rupiah(d.totalMasuk)} · Lain ${rupiah(d.totalMasukLain)}`} />
            <Box icon={TrendingDown} color="#F59E0B" label="Total Pengeluaran" value={d.totalKeluar} />
            <Box icon={PiggyBank} color="#10B981" label="Saldo Akhir" value={d.saldoAkhir} />
          </div>
          <div className="grid g-2">
            <Card title="Rincian per Bulan" plain>
              <DataTable rows={d.rows} rowKey={(r) => r.bulan} pageSize={12}
                foot={<tr><td>Total</td><td className="r">{rupiah(d.totalMasuk)}</td><td className="r">{rupiah(d.totalMasukLain)}</td><td className="r">{rupiah(d.totalKeluar)}</td><td className="r">{rupiah(d.saldoAkhir)}</td></tr>}
                columns={[
                  { label: 'Bulan', render: (r) => monthLabel(r.bulan), nowrap: true }, { label: 'Iuran', render: (r) => rupiah(r.masuk), align: 'right' },
                  { label: 'Pemasukan Lain', render: (r) => rupiah(r.masukLain), align: 'right' },
                  { label: 'Pengeluaran', render: (r) => rupiah(r.keluar), align: 'right' }, { label: 'Saldo', render: (r) => <b>{rupiah(r.saldo)}</b>, align: 'right' }
                ]} />
            </Card>
            <Card title="Grafik Bulanan" plain>
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={d.rows.map((r) => ({ ...r, label: monthShort(r.bulan) }))} margin={{ top: 6, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E3EAF8" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => (v >= 1000 ? Math.round(v / 1000) + 'rb' : v)} />
                    <Tooltip formatter={(v) => rupiah(v)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="masuk" name="Iuran" stackId="in" fill="#1D5FE8" maxBarSize={24} />
                    <Bar dataKey="masukLain" name="Pemasukan lain" stackId="in" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={24} />
                    <Bar dataKey="keluar" name="Pengeluaran" fill="#FFC20E" radius={[6, 6, 0, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
