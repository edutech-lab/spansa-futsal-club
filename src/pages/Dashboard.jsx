import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, Award, CalendarDays, Clock, Coins, LayoutGrid, MapPin, PiggyBank, TrendingUp, Users, Wallet } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Banner from '../components/Banner.jsx';
import Pitch from '../components/Pitch.jsx';
import { Card, Empty, ErrorBox, Skeleton, useLoad } from '../ui.jsx';
import { hariTgl, monthShort, rupiah, shortName, timeAgo } from '../utils.js';

const COLORS = { H: '#1E5BE6', S: '#F5A524', I: '#7FB0F5', A: '#EF4444' };
const NAMES = { H: 'Hadir', S: 'Sakit', I: 'Izin', A: 'Alpa' };

function Stat({ icon: Icon, color, label, value, sub, ghost: Ghost }) {
  return (
    <div className="card stat">
      <div className="ic" style={{ background: color }}><Icon size={24} /></div>
      <div><div className="st-lb">{label}</div><div className="vl">{value}</div><div className="sub">{sub}</div></div>
      {Ghost && <Ghost className="ghost" size={64} />}
    </div>
  );
}

const rpShort = (v) => (v >= 1000000 ? (v / 1000000).toFixed(1) + 'jt' : v >= 1000 ? Math.round(v / 1000) + 'rb' : v);

export default function Dashboard() {
  const { user, term, settings, isAdmin } = useAuth();
  const { data, loading, error, reload } = useLoad(() => api('dashboard', { term }), [term]);

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const d = data;
  const s = d ? d.stats : null;
  const donut = d ? ['H', 'S', 'I', 'A'].map((k) => ({ key: k, name: NAMES[k], value: d.kehadiran[k] })) : [];
  const donutTotal = donut.reduce((a, b) => a + b.value, 0);
  const nameOf = (nisn) => (d && d.formasi && d.formasi.names[nisn]) || '';

  return (
    <div className="stack">
      <Banner settings={settings} />
      {loading || !d ? (
        <div className="grid g-stats">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={86} />)}</div>
      ) : isAdmin ? (
        <div className="grid g-stats">
          <Stat icon={Users} color="#1E63F0" label="Total Anggota" value={s.anggota} sub="Anggota aktif" ghost={Users} />
          <Stat icon={CalendarDays} color="#10B981" label="Jadwal Mendatang" value={s.jadwalMendatang} sub="Pertandingan" ghost={CalendarDays} />
          <Stat icon={Coins} color="#F59E0B" label="Pemasukan Iuran" value={rupiah(s.pemasukan)} sub={term} ghost={Coins} />
          <Stat icon={PiggyBank} color="#6D4AE0" label="Saldo Kas" value={rupiah(s.saldo)} sub="Hingga akhir periode" ghost={Wallet} />
        </div>
      ) : (
        <div className="grid g-stats three">
          <Stat icon={TrendingUp} color="#1E63F0" label="Kehadiran Saya" value={s.persenHadir + '%'} sub={`${s.hadir} dari ${s.totalPertemuan} latihan`} ghost={TrendingUp} />
          <Stat icon={CalendarDays} color="#10B981" label="Jadwal Mendatang" value={s.jadwalMendatang} sub="Pertandingan" ghost={CalendarDays} />
          <Stat icon={Award} color="#6D4AE0" label="Nilai Semester" value={s.nilai ? s.nilai.predikat : '-'} sub={s.nilai ? `Total ${s.nilai.total}` : 'Belum diinput'} ghost={Award} />
        </div>
      )}

      {d && (
        <>
          <div className="grid g-2">
            <Card title="Pertandingan Mendatang" icon={CalendarDays} action={isAdmin ? 'Kelola' : null} onAction={() => { window.location.hash = '#/jadwal'; }}>
              {d.jadwal.length === 0 ? <Empty text="Belum ada pertandingan mendatang" /> : (
                <div className="stack" style={{ gap: 10 }}>
                  {d.jadwal.map((j) => { const t = hariTgl(j.tanggal); return (
                    <div key={j.id} className="row" style={{ border: '1px solid var(--bd)', borderRadius: 14, padding: 10, gap: 14 }}>
                      <div className="c" style={{ background: '#EEF3FF', color: 'var(--navy)', borderRadius: 12, padding: '8px 12px', minWidth: 62 }}>
                        <div style={{ fontSize: 12, fontWeight: 700 }}>{t.hari}</div><div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{t.tgl}</div><div style={{ fontSize: 12, fontWeight: 700 }}>{t.bln}</div>
                      </div>
                      <div className="grow">
                        <div className="b" style={{ color: 'var(--navy)', fontSize: 15 }}>Spansa FC <span style={{ color: 'var(--blue)' }}>VS</span> {j.lawan}</div>
                        <div className="hint row wrap" style={{ gap: 12, marginTop: 4 }}><span className="row" style={{ gap: 4 }}><Clock size={13} />{j.jam} WIB</span><span className="row" style={{ gap: 4 }}><MapPin size={13} />{j.lokasi || '-'}</span></div>
                      </div>
                      {j.jenis && <span className="chip">{j.jenis}</span>}
                    </div>
                  ); })}
                </div>
              )}
            </Card>
            <Card title="Formasi Awal Pertandingan" icon={LayoutGrid}>
              {!d.formasi ? <Empty text="Formasi belum ditentukan" /> : (
                <div className="grid" style={{ gridTemplateColumns: 'minmax(0,220px) 1fr', gap: 14, alignItems: 'center' }}>
                  <Pitch pola={d.formasi.pola} lineup={d.formasi.lineup} nameOf={nameOf} />
                  <div>
                    <div className="b" style={{ color: 'var(--navy)' }}>vs {d.formasi.jadwal.lawan}</div>
                    <div className="hint">{hariTgl(d.formasi.jadwal.tanggal).hari}, {hariTgl(d.formasi.jadwal.tanggal).tgl} {hariTgl(d.formasi.jadwal.tanggal).bln} · {d.formasi.jadwal.jam} WIB</div>
                    <div style={{ margin: '8px 0' }}><span className="chip">Pola {d.formasi.pola}</span></div>
                    {d.formasi.cadangan.length > 0 && <div className="hint"><b>Cadangan:</b> {d.formasi.cadangan.map((n) => shortName(nameOf(n))).join(', ')}</div>}
                  </div>
                </div>
              )}
            </Card>
          </div>

          <div className="grid g-2">
            <Card title={isAdmin ? 'Arus Kas Bulanan' : 'Tren Kehadiran Saya'} icon={isAdmin ? Wallet : TrendingUp}>
              <div style={{ height: 210 }}>
                <ResponsiveContainer width="100%" height="100%">
                  {isAdmin ? (
                    <BarChart data={d.kas.map((k) => ({ ...k, label: monthShort(k.bulan) }))} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E3EAF8" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={rpShort} />
                      <Tooltip formatter={(v) => rupiah(v)} />
                      <Bar dataKey="masuk" name="Pemasukan" fill="#1D5FE8" radius={[6, 6, 0, 0]} maxBarSize={22} />
                      <Bar dataKey="keluar" name="Pengeluaran" fill="#FFC20E" radius={[6, 6, 0, 0]} maxBarSize={22} />
                    </BarChart>
                  ) : (
                    <AreaChart data={d.tren.map((k) => ({ ...k, label: monthShort(k.bulan) }))} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
                      <defs><linearGradient id="ar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1D5FE8" stopOpacity=".35" /><stop offset="1" stopColor="#1D5FE8" stopOpacity="0" /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E3EAF8" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} unit="%" />
                      <Tooltip formatter={(v) => v + '%'} />
                      <Area type="monotone" dataKey="persen" name="Kehadiran" stroke="#1D5FE8" strokeWidth={2.5} fill="url(#ar)" dot={{ r: 4, fill: '#1D5FE8' }} />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title={isAdmin ? 'Komposisi Kehadiran' : 'Kehadiran Saya'} icon={Users}>
              {donutTotal === 0 ? <Empty text="Belum ada data presensi" /> : (
                <div className="row" style={{ gap: 18 }}>
                  <div style={{ width: 170, height: 170, position: 'relative', flex: 'none' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart><Pie data={donut} dataKey="value" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="none">{donut.map((x) => <Cell key={x.key} fill={COLORS[x.key]} />)}</Pie><Tooltip /></PieChart>
                    </ResponsiveContainer>
                    <div className="c" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
                      <div><div style={{ fontSize: 24, fontWeight: 800, color: 'var(--navy)', lineHeight: 1 }}>{donutTotal}</div><div className="hint">Presensi</div></div>
                    </div>
                  </div>
                  <div className="stack" style={{ gap: 8, flex: 1 }}>
                    {donut.map((x) => <div key={x.key} className="row between"><span className="row" style={{ gap: 8 }}><i style={{ width: 10, height: 10, borderRadius: 99, background: COLORS[x.key], display: 'inline-block' }} />{x.name}</span><b>{x.value}</b></div>)}
                  </div>
                </div>
              )}
            </Card>
          </div>

          <Card title="Aktivitas Terbaru" icon={Activity}>
            {d.aktivitas.length === 0 ? <Empty text="Belum ada aktivitas" /> : d.aktivitas.map((a, i) => (
              <div key={i} className="row between" style={{ padding: '10px 0', borderTop: i ? '1px solid var(--bd)' : 0, gap: 12 }}>
                <span className="row" style={{ gap: 10 }}><span className="chip">{a.tipe}</span><span>{a.teks}</span></span>
                <span className="hint nowrap">{timeAgo(a.waktu)}</span>
              </div>
            ))}
          </Card>
        </>
      )}
      {!isAdmin && <div className="hint c">Masuk sebagai {user.nama}</div>}
    </div>
  );
}
