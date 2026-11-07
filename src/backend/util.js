/* Pembantu murni (tanpa Firebase) untuk lapisan data. */
export class AppError extends Error {
  constructor(message, code) { super(message); this.code = code || 'ERR'; }
}

export const API_VERSION = '2026.11.07-firebase';
export const TZ = 'Asia/Jakarta';

export const SETTINGS_DEFAULT = {
  namaKlub: 'Spansa Futsal Club',
  namaSekolah: 'SMP Negeri 1 Bandar Lampung',
  logoUrl: 'https://lh3.googleusercontent.com/d/1zpjLOtbR-nLzBll8bfwlas6mgrWfBYUf',
  logoSekolahUrl: 'https://lh3.googleusercontent.com/d/1GDe6aqXyF_RR6kL3jMCy0vWqaO83jgyp',
  webSekolah: 'smpn1-bandarlampung.sch.id',
  youtube: 'spansa_official',
  instagram: 'spansa_official',
  bannerUrl: '',
  saldoAwalKas: '0',
  saldoAwalTerkunci: '0',
  saldoAwalCatatan: '',
  namaBendahara: '',
  namaPembina: '',
  iuranPerPertemuan: '5000',
  bobotHadir: '70',
  bobotIndividu: '30',
  batasA: '85',
  batasB: '75',
  batasC: '60'
};
/* Kunci yang disimpan terpisah: settings/finance hanya bisa dibaca admin. */
export const FINANCE_KEYS = ['saldoAwalKas', 'saldoAwalTerkunci', 'saldoAwalCatatan'];
export const PUBLIC_KEYS = ['namaKlub', 'namaSekolah', 'logoUrl'];
export const SETTINGS_SYSTEM = ['saldoAwalTerkunci', 'saldoAwalCatatan'];
export const SETTINGS_EDITABLE = Object.keys(SETTINGS_DEFAULT).filter((k) => !SETTINGS_SYSTEM.includes(k));
export const POLA_OK = ['1-2-1', '2-2', '3-1', '1-1-2'];
export const JENIS_OK = ['Persahabatan', 'Turnamen', 'Liga', 'Latih Tanding'];
export const TRX = {
  pengeluaran: { col: 'pengeluaran', kategori: ['Umum', 'Pelatih'], def: 'Umum', label: 'pengeluaran', prefix: 'X' },
  pemasukan: { col: 'pemasukan', kategori: ['Donasi', 'Sponsor', 'Bantuan Sekolah', 'Penjualan', 'Lainnya'], def: 'Lainnya', label: 'pemasukan', prefix: 'M' }
};

export const pad2 = (n) => (n < 10 ? '0' : '') + n;
export const round1 = (n) => Math.round(n * 10) / 10;
export const byNama = (a, b) => String(a.nama).localeCompare(String(b.nama), 'id');
export const mapBy = (arr, key) => { const m = {}; arr.forEach((x) => { m[x[key]] = x; }); return m; };
export const str = (v, max) => String(v === undefined || v === null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max || 200);
export const newId = (p) => p + Date.now().toString(36) + Math.floor(Math.random() * 1679616).toString(36);

export function today() { return new Date().toLocaleDateString('sv-SE', { timeZone: TZ }); }
export function plusDays(n) { return new Date(Date.now() + n * 86400000).toLocaleDateString('sv-SE', { timeZone: TZ }); }
export function nowIso() { return new Date().toLocaleString('sv-SE', { timeZone: TZ }).replace(' ', 'T'); }

export function validDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const p = s.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  return d.getUTCFullYear() === p[0] && d.getUTCMonth() === p[1] - 1 && d.getUTCDate() === p[2];
}

export function termRange(term) {
  const m = /^(\d{4})\/(\d{4}) (Ganjil|Genap)$/.exec(String(term || ''));
  if (!m || Number(m[2]) !== Number(m[1]) + 1) throw new AppError('Tahun ajaran tidak valid', 'VALID');
  const y1 = Number(m[1]); const y2 = Number(m[2]);
  const months = [];
  if (m[3] === 'Ganjil') {
    for (let i = 7; i <= 12; i++) months.push(y1 + '-' + pad2(i));
    return { term, from: y1 + '-07-01', to: y1 + '-12-31', months };
  }
  for (let j = 1; j <= 6; j++) months.push(y2 + '-' + pad2(j));
  return { term, from: y2 + '-01-01', to: y2 + '-06-30', months };
}
export function termOf(tanggal) {
  const y = Number(tanggal.slice(0, 4)); const mo = Number(tanggal.slice(5, 7));
  return mo >= 7 ? y + '/' + (y + 1) + ' Ganjil' : (y - 1) + '/' + y + ' Genap';
}
/* ID dokumen tidak boleh memuat "/" -> 2026/2027 Ganjil menjadi 2026-2027_Ganjil */
export const termKey = (term) => String(term).replace('/', '-').replace(' ', '_');
export const inRange = (t, tr) => t >= tr.from && t <= tr.to;

export function predikat(total, cfg) {
  const t = Number(total);
  if (t >= Number(cfg.batasA)) return 'A';
  if (t >= Number(cfg.batasB)) return 'B';
  if (t >= Number(cfg.batasC)) return 'C';
  return 'D';
}
export function calcTotal(persen, kemampuan, cfg) {
  return round1((Number(persen) * Number(cfg.bobotHadir) + Number(kemampuan) * Number(cfg.bobotIndividu)) / 100);
}
export const rp = (n) => 'Rp' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export function normSiswa(s) {
  const o = {
    nisn: String(s.nisn === undefined || s.nisn === null ? '' : s.nisn).trim(),
    nama: str(s.nama, 100),
    jk: String(s.jk || '').toUpperCase(),
    kelas: str(s.kelas, 10),
    tempatLahir: str(s.tempatLahir, 60),
    tglLahir: String(s.tglLahir || '').trim()
  };
  const e = [];
  if (!/^\d{6,20}$/.test(o.nisn)) e.push('NISN harus berupa angka 6-20 digit');
  if (!o.nama) e.push('Nama wajib diisi');
  if (o.jk !== 'L' && o.jk !== 'P') e.push('Jenis kelamin harus L atau P');
  if (!o.kelas) e.push('Kelas wajib diisi');
  if (o.tglLahir && !validDate(o.tglLahir)) e.push('Tanggal lahir tidak valid');
  return { o, e };
}

export function parseMediaLink(url) {
  url = String(url || '').trim();
  if (!/^https:\/\/\S{4,500}$/.test(url)) throw new AppError('Tautan harus diawali https://', 'VALID');
  if (/^https:\/\/drive\.google\.com\/drive\/(u\/\d+\/)?folders\//.test(url)) throw new AppError('Tautan folder tidak didukung. Gunakan tautan berkas (file) Google Drive.', 'VALID');
  let m = /^https:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#\s]*&)?id=|thumbnail\?(?:[^#\s]*&)?id=)([-\w]{20,})/.exec(url) ||
    /^https:\/\/lh3\.googleusercontent\.com\/d\/([-\w]{20,})/.exec(url);
  if (m) return { tipe: 'drive', fileId: m[1], url: 'https://drive.google.com/file/d/' + m[1] + '/view', thumb: 'https://lh3.googleusercontent.com/d/' + m[1] + '=w640' };
  m = /^https:\/\/(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|shorts\/|embed\/)([-\w]{11})/.exec(url) || /^https:\/\/youtu\.be\/([-\w]{11})/.exec(url);
  if (m) return { tipe: 'youtube', fileId: m[1], url: 'https://www.youtube.com/watch?v=' + m[1], thumb: 'https://img.youtube.com/vi/' + m[1] + '/hqdefault.jpg' };
  if (/^https:\/\/[^\s?#]+\.(?:jpe?g|png|webp|gif)(?:[?#]\S*)?$/i.test(url)) return { tipe: 'gambar', fileId: '', url, thumb: url };
  throw new AppError('Tautan tidak didukung. Gunakan tautan berkas Google Drive, YouTube, atau alamat gambar langsung (.jpg, .png, .webp).', 'VALID');
}
