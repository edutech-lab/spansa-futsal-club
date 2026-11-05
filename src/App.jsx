import { Component, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './auth.jsx';
import { UiProvider, Loading } from './ui.jsx';
import Layout, { MENU } from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Siswa from './pages/Siswa.jsx';
import Anggota from './pages/Anggota.jsx';
import Kartu from './pages/Kartu.jsx';
import Hadir from './pages/Hadir.jsx';
import Jadwal from './pages/Jadwal.jsx';
import Formasi from './pages/Formasi.jsx';
import Nilai from './pages/Nilai.jsx';
import RekapHadir from './pages/RekapHadir.jsx';
import RekapIuran from './pages/RekapIuran.jsx';
import Pengeluaran from './pages/Pengeluaran.jsx';
import RekapKas from './pages/RekapKas.jsx';
import Pengaturan from './pages/Pengaturan.jsx';

const PAGES = {
  dashboard: Dashboard, siswa: Siswa, anggota: Anggota, kartu: Kartu, hadir: Hadir, jadwal: Jadwal, formasi: Formasi,
  nilai: Nilai, 'rekap-hadir': RekapHadir, 'rekap-iuran': RekapIuran, pengeluaran: Pengeluaran, 'rekap-kas': RekapKas, pengaturan: Pengaturan
};

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) { console.error(err); }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="card" style={{ padding: 28, textAlign: 'center' }}>
        <h2 style={{ color: 'var(--navy)', marginBottom: 6 }}>Halaman gagal ditampilkan</h2>
        <p className="mut" style={{ marginBottom: 14 }}>{String(this.state.err && this.state.err.message ? this.state.err.message : this.state.err)}</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn" onClick={() => window.location.reload()}>Muat ulang</button>
          <a className="btn sec" href="#/dashboard" onClick={() => this.setState({ err: null })}>Ke Dashboard</a>
        </div>
      </div>
    );
  }
}

function useRoute() {
  const read = () => (window.location.hash.replace(/^#\/?/, '').split('?')[0] || 'dashboard');
  const [r, setR] = useState(read);
  useEffect(() => {
    const h = () => setR(read());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  return r;
}

function Shell() {
  const { user, booting } = useAuth();
  const route = useRoute();
  if (booting) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Loading text="Memuat aplikasi..." /></div>;
  if (!user) return <Login />;
  const allowed = MENU.find((m) => m.path === route && m.roles.includes(user.role));
  const key = allowed ? route : 'dashboard';
  const Page = PAGES[key];
  return <Layout route={key}><ErrorBoundary key={key}><Page /></ErrorBoundary></Layout>;
}

export default function App() {
  return (
    <UiProvider>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </UiProvider>
  );
}
