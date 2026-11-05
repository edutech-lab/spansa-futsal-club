import { useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Pitch, { POLA, POLA_LIST } from '../components/Pitch.jsx';
import { Card, Empty, ErrorBox, Field, Loading, PageHead, useLoad, useUi } from '../ui.jsx';
import { tglID } from '../utils.js';

export default function Formasi() {
  const { term } = useAuth();
  const { toast } = useUi();
  const jl = useLoad(() => api('listJadwal', { term }), [term]);
  const [id, setId] = useState('');
  useEffect(() => { if (jl.data) setId((cur) => (jl.data.some((j) => j.id === cur) ? cur : jl.data[0] ? jl.data[0].id : '')); }, [jl.data]);
  const fm = useLoad(() => (id ? api('getFormasi', { jadwalId: id }) : Promise.resolve(null)), [id]);
  const [pola, setPola] = useState('1-2-1');
  const [lineup, setLineup] = useState({});
  const [cad, setCad] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (fm.data) { setPola(fm.data.pola); setLineup(fm.data.lineup || {}); setCad(fm.data.cadangan || []); }
  }, [fm.data]);

  const names = useMemo(() => { const m = {}; (fm.data ? fm.data.anggota : []).forEach((a) => { m[a.nisn] = a.nama; }); return m; }, [fm.data]);
  const used = new Set(Object.values(lineup).filter(Boolean));
  const setSlot = (i, v) => { setLineup({ ...lineup, ['s' + i]: v }); setCad(cad.filter((n) => n !== v)); };
  const toggleCad = (n) => setCad(cad.includes(n) ? cad.filter((x) => x !== n) : [...cad, n]);

  const save = async () => {
    setBusy(true);
    try { await api('saveFormasi', { jadwalId: id, pola, lineup, cadangan: cad }); toast('Formasi disimpan'); fm.reload(); } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };

  if (jl.loading) return <Loading />;
  if (jl.error) return <ErrorBox message={jl.error} onRetry={jl.reload} />;
  const jadwal = (jl.data || []).find((j) => j.id === id);

  return (
    <>
      <PageHead title="Formasi Pertandingan" subtitle="Posisi awal pemain, tampil di dashboard anggota">
        <button className="btn" onClick={save} disabled={busy || !id}><Save size={16} />{busy ? 'Menyimpan...' : 'Simpan Formasi'}</button>
      </PageHead>
      {(jl.data || []).length === 0 ? <Card><Empty text={`Belum ada jadwal pertandingan pada ${term}. Buat jadwal terlebih dahulu.`} /></Card> : (
        <div className="grid g-2e">
          <Card plain>
            <div className="stack" style={{ gap: 14 }}>
              <Field label="Pertandingan">
                <select className="input" value={id} onChange={(e) => setId(e.target.value)}>
                  {jl.data.map((j) => <option key={j.id} value={j.id}>{tglID(j.tanggal, true)} · vs {j.lawan}</option>)}
                </select>
              </Field>
              <div className="field">
                <span>Pola formasi</span>
                <div className="row wrap">{POLA_LIST.map((p) => <button key={p} type="button" className={'btn sm ' + (pola === p ? '' : 'sec')} onClick={() => setPola(p)}>{p}</button>)}</div>
              </div>
              {fm.loading || (!fm.data && !fm.error) ? <Loading /> : fm.error ? <ErrorBox message={fm.error} onRetry={fm.reload} /> : (
                <>
                  <div className="form-grid">
                    {POLA[pola].map(([label], i) => (
                      <Field key={label + i} label={`${i === 0 ? 'GK' : i} · ${label}`}>
                        <select className="input" value={lineup['s' + i] || ''} onChange={(e) => setSlot(i, e.target.value)}>
                          <option value="">- Pilih pemain -</option>
                          {fm.data.anggota.map((a) => <option key={a.nisn} value={a.nisn} disabled={used.has(a.nisn) && lineup['s' + i] !== a.nisn}>{a.nama} ({a.kelas})</option>)}
                        </select>
                      </Field>
                    ))}
                  </div>
                  <div className="field">
                    <span>Pemain cadangan</span>
                    <div className="row wrap" style={{ gap: 6 }}>
                      {fm.data.anggota.filter((a) => !used.has(a.nisn)).map((a) => (
                        <button key={a.nisn} type="button" className={'btn sm ' + (cad.includes(a.nisn) ? '' : 'sec')} onClick={() => toggleCad(a.nisn)}>{a.nama}</button>
                      ))}
                      {fm.data.anggota.filter((a) => !used.has(a.nisn)).length === 0 && <span className="hint">Semua anggota sudah masuk susunan utama</span>}
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>
          <Card title={jadwal ? `vs ${jadwal.lawan}` : 'Pratinjau'} plain>
            <Pitch pola={pola} lineup={lineup} nameOf={(n) => names[n] || ''} />
            <p className="hint c" style={{ marginTop: 8 }}>Pratinjau seperti yang dilihat anggota. Kiper berada di bagian bawah lapangan.</p>
          </Card>
        </div>
      )}
    </>
  );
}
