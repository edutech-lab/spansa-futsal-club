import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, Award, CalendarDays, ChevronRight, Coins, LayoutGrid, PiggyBank, Plus, TrendingUp, Trophy, Users, Wallet } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Banner from '../components/Banner.jsx';
import Pitch from '../components/Pitch.jsx';
import { Card, Empty, ErrorBox, Skeleton, useLoad } from '../ui.jsx';
import { hariTgl, initials, monthShort, rupiah, shortName, timeAgo } from '../utils.js';

const COLORS = { H: '#2E9E7A', S: '#F5A524', I: '#266FF2', A: '#E5484D' };
const NAMES = { H: 'Hadir', S: 'Sakit', I: 'Izin', A: 'Alpa' };

function Stat({ icon: Icon, color, label, value, sub }) {
  return (
    <div className="card stat">
      <div className="ic" style={{ background: color }}><Icon size={14} /></div>
      <div><div className="st-lb">{label}</div><div className="vl">{value}</div><div className="sub">{sub}</div></div>
    </div>
  );
}

const rpShort = (v) => (v >= 1000000 ? (v / 1000000).toFixed(1) + 'jt' : v >= 1000 ? Math.round(v / 1000) + 'rb' : v);

function splitRupiah(n) {
  const str = Math.round(n || 0).toLocaleString('id-ID');
  const cut = str.lastIndexOf('.');
  return cut > 0 ? [str.slice(0, cut + 1), str.slice(cut + 1)] : [str, ''];
}

export default function Dashboard() {
  const { user, term, settings, isAdmin } = useAuth();
  const { data, loading, error, reload } = useLoad(() => api('dashboard', { term }), [term]);

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const d = data;
  const s = d ? d.stats : null;
  const donut = d ? ['H', 'S', 'I', 'A'].map((k) => ({ key: k, name: NAMES[k], value: d.kehadiran[k] })) : [];
  const donutTotal = donut.reduce((a, b) => a + b.value, 0);
  const nameOf = (nisn) => (d && d.formasi && d.formasi.names[nisn]) || '';

  // data arus kas & saldo (admin)
  const kas = d && isAdmin ? d.kas.map((k) => ({ ...k, label: monthShort(k.bulan) })) : [];
  const maxMasuk = Math.max(0, ...kas.map((k) => k.masuk));
  let saldoSeries = [];
  let pct = null;
  if (d && isAdmin && kas.length) {
    let run = s.saldo - kas.reduce((a, k) => a + (k.masuk - k.keluar), 0);
    saldoSeries = kas.map((k) => ({ label: k.label, v: (run += k.masuk - k.keluar) }));
    if (saldoSeries.length > 1) {
      const prev = saldoSeries[saldoSeries.length - 2].v;
      const last = saldoSeries[saldoSeries.length - 1].v;
      if (prev > 0) pct = Math.round(((last - prev) / prev) * 100);
    }
  }
  const [saldoMain, saldoTail] = d && isAdmin ? splitRupiah(s.saldo) : ['', ''];

  const dots = d ? (
    <>
      <div className="dotrow"><i style={{ background: COLORS.H }} /><div>Hadir: <b>{d.kehadiran.H}</b><small>Total presensi tercatat</small></div></div>
      <div className="dotrow"><i style={{ background: COLORS.S }} /><div>Sakit &amp; Izin: <b>{d.kehadiran.S + d.kehadiran.I}</b><small>Perlu tindak lanjut</small></div></div>
      <div className="dotrow"><i style={{ background: COLORS.A }} /><div>Alpa: <b>{d.kehadiran.A}</b><small>Periode berjalan</small></div></div>
    </>
  ) : null;

  return (
    <>
      {settings.bannerUrl && <div style={{ marginBottom: 14 }}><Banner settings={settings} /></div>}
      <div className="pg-top" style={{ marginBottom: 16 }}>
        <h1 className="pg-title">Dashboard</h1>
        {isAdmin && <a className="btn" href="#/jadwal"><Plus size={16} />Jadwal Baru</a>}
      </div>

      {loading || !d ? (
        <div className="grid g-stats">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={96} />)}</div>
      ) : isAdmin ? (
        <div className="grid g-stats" style={{ marginBottom: 14 }}>
          <Stat icon={CalendarDays} color="#266FF2" label="Jadwal Mendatang" value={s.jadwalMendatang} sub="Pertandingan" />
          <Stat icon={Users} color="#266FF2" label="Total Anggota" value={s.anggota} sub="Anggota aktif" />
          <Stat icon={Coins} color="#266FF2" label="Pemasukan Iuran" value={rupiah(s.pemasukan)} sub={term} />
          <Stat icon={PiggyBank} color="#266FF2" label="Saldo Kas" value={rupiah(s.saldo)} sub="Hingga akhir periode" />
        </div>
      ) : (
        <div className="grid g-stats three" style={{ marginBottom: 14 }}>
          <Stat icon={TrendingUp} color="#266FF2" label="Kehadiran Saya" value={s.persenHadir + '%'} sub={`${s.hadir} dari ${s.totalPertemuan} latihan`} />
          <Stat icon={CalendarDays} color="#266FF2" label="Jadwal Mendatang" value={s.jadwalMendatang} sub="Pertandingan" />
          <Stat icon={Award} color="#266FF2" label="Nilai Semester" value={s.nilai ? s.nilai.predikat : '-'} sub={s.nilai ? `Total ${s.nilai.total}` : 'Belum diinput'} />
        </div>
      )}

      {d && (
        <>
          <div className="dash">
            <Card className="first" title={isAdmin ? 'Arus Kas Bulanan' : 'Tren Kehadiran Saya'} icon={isAdmin ? Wallet : TrendingUp}>
              {isAdmin ? (
                <>
                  <div className="row hint" style={{ gap: 16, marginBottom: 6 }}>
                    <span className="row" style={{ gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 99, background: '#0066F7', display: 'inline-block' }} />Pemasukan</span>
                    <span className="row" style={{ gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 99, background: '#BBD3FB', display: 'inline-block' }} />Pengeluaran</span>
                  </div>
                  <div style={{ height: 270 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={kas} margin={{ top: 28, right: 8, left: -6, bottom: 0 }} barGap={4}>
                        <defs>
                          <linearGradient id="bk-d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0066F7" /><stop offset="1" stopColor="#014BFC" /></linearGradient>
                          <linearGradient id="bk-l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8DBBFB" /><stop offset="1" stopColor="#5F9FF9" /></linearGradient>
                        </defs>
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8B95A7' }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#8B95A7' }} tickLine={false} axisLine={false} tickFormatter={rpShort} />
                        <Tooltip formatter={(v) => rupiah(v)} cursor={{ fill: 'rgba(38,111,242,.06)' }} />
                        <Bar dataKey="masuk" name="Pemasukan" radius={[22, 22, 22, 22]} maxBarSize={30}>
                          {kas.map((k, i) => <Cell key={i} fill={maxMasuk > 0 && k.masuk === maxMasuk ? 'url(#bk-d)' : 'url(#bk-l)'} />)}
                        </Bar>
                        <Bar dataKey="keluar" name="Pengeluaran" fill="#BBD3FB" radius={[22, 22, 22, 22]} maxBarSize={30} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <div style={{ height: 290 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={d.tren.map((k) => ({ ...k, label: monthShort(k.bulan) }))} margin={{ top: 10, right: 8, left: -14, bottom: 0 }}>
                      <defs><linearGradient id="ar-t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#266FF2" stopOpacity=".28" /><stop offset="1" stopColor="#266FF2" stopOpacity=".02" /></linearGradient></defs>
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8B95A7' }} tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#8B95A7' }} tickLine={false} axisLine={false} unit="%" />
                      <Tooltip formatter={(v) => v + '%'} />
                      <Area type="monotone" dataKey="persen" name="Kehadiran" stroke="#5F9FF9" strokeWidth={2.5} fill="url(#ar-t)" dot={{ r: 4, fill: '#fff', stroke: '#266FF2', strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            {isAdmin ? (
              <Card title="Saldo Kas" icon={TrendingUp}>
                <div className="hint">Akumulasi periode berjalan{pct !== null && <span className="badge-up">{pct > 0 ? '+' : ''}{pct}%</span>}</div>
                <div className="bignum" style={{ margin: '6px 0 14px' }}>{saldoMain}<small>{saldoTail}</small></div>
                <div style={{ height: 190 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={saldoSeries} margin={{ top: 8, right: 6, left: 6, bottom: 0 }}>
                      <defs><linearGradient id="ar-s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#266FF2" stopOpacity=".28" /><stop offset="1" stopColor="#266FF2" stopOpacity=".02" /></linearGradient></defs>
                      <XAxis dataKey="label" hide />
                      <YAxis hide domain={['dataMin', 'dataMax']} />
                      <Tooltip formatter={(v) => rupiah(v)} />
                      <Area type="monotone" dataKey="v" name="Saldo" stroke="#5F9FF9" strokeWidth={2.5} fill="url(#ar-s)" dot={false} activeDot={{ r: 5, fill: '#fff', stroke: '#266FF2', strokeWidth: 2.5 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            ) : (
              <Card title="Kehadiran Saya" icon={Users}>
                <div className="hint">Persentase kehadiran latihan</div>
                <div className="bignum" style={{ margin: '6px 0 16px' }}>{s.persenHadir}<small>%</small></div>
                {dots}
              </Card>
            )}

            <Card title="Pertandingan" icon={Trophy} action={isAdmin ? 'Lihat semua' : null} onAction={() => { window.location.hash = '#/jadwal'; }}>
              {d.jadwal.length === 0 ? <Empty text="Belum ada pertandingan mendatang" /> : d.jadwal.map((j, i) => { const t = hariTgl(j.tanggal); return (
                <div key={j.id} className="li">
                  <span className="ico"><CalendarDays size={16} /></span>
                  <div><b>Spansa FC vs {j.lawan}</b><small className={i === 0 ? 'ok' : 'wait'}>{t.hari}, {t.tgl} {t.bln} · {j.jam}</small></div>
                  <span className="go"><ChevronRight size={16} /></span>
                </div>
              ); })}
              {isAdmin && (<><div className="sec-t">Kehadiran</div>{dots}</>)}
            </Card>

            <Card className="wide" title="Aktivitas Terbaru" icon={Activity}>
              {d.aktivitas.length === 0 ? <Empty text="Belum ada aktivitas" /> : d.aktivitas.map((a, i) => (
                <div key={i} className="arow">
                  <span className="av">{initials(a.tipe || 'A').slice(0, 2)}</span>
                  <div><b>{a.teks}</b><small>{a.tipe}</small></div>
                  <div className="meta"><span>{timeAgo(a.waktu)}</span><span className="stp sch">Tercatat</span></div>
                </div>
              ))}
            </Card>
          </div>

          <div className="grid g-2e" style={{ marginTop: 14 }}>
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
            <Card title={isAdmin ? 'Komposisi Kehadiran' : 'Kehadiran Saya'} icon={Users}>
              {donutTotal === 0 ? <Empty text="Belum ada data presensi" /> : (
                <div className="row" style={{ gap: 18 }}>
                  <div style={{ width: 170, height: 170, position: 'relative', flex: 'none' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart><Pie data={donut} dataKey="value" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="none">{donut.map((x) => <Cell key={x.key} fill={COLORS[x.key]} />)}</Pie><Tooltip /></PieChart>
                    </ResponsiveContainer>
                    <div className="c" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
                      <div><div style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy)', lineHeight: 1 }}>{donutTotal}</div><div className="hint">Presensi</div></div>
                    </div>
                  </div>
                  <div className="stack" style={{ gap: 8, flex: 1 }}>
                    {donut.map((x) => <div key={x.key} className="row between"><span className="row" style={{ gap: 8 }}><i style={{ width: 10, height: 10, borderRadius: 99, background: COLORS[x.key], display: 'inline-block' }} />{x.name}</span><b>{x.value}</b></div>)}
                  </div>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
      {!isAdmin && <div className="hint c" style={{ marginTop: 14 }}>Masuk sebagai {user.nama}</div>}
    </>
  );
}
