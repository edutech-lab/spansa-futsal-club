import { useEffect, useState } from 'react';
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
  return <Layout route={key}><Page key={key} /></Layout>;
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
