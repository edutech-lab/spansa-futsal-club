/* Migrasi data lama (Google Sheets) -> Cloud Firestore + akun Firebase Auth.
   Pemakaian:  ADMIN_PASSWORD="passwordAdminBaru" node scripts/import-to-firestore.mjs scripts/spansa-export.json
   Aman dijalankan ulang (dokumen ditimpa dengan ID yang sama; akun yang sudah ada tidak dibuat ulang). */
import { readFileSync, existsSync } from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}
const file = process.argv[2];
if (!file || !existsSync(file)) { console.error('Pemakaian: node scripts/import-to-firestore.mjs <spansa-export.json>'); process.exit(1); }
const { FIREBASE_PROJECT_ID: projectId, FIREBASE_CLIENT_EMAIL: clientEmail, FIREBASE_PRIVATE_KEY: pk } = process.env;
if (!projectId || !clientEmail || !pk) { console.error('Isi FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY terlebih dahulu.'); process.exit(1); }

initializeApp({ credential: cert({ projectId, clientEmail, privateKey: pk.replace(/\\n/g, '\n') }) });
const db = getFirestore(); const auth = getAuth();
const d = JSON.parse(readFileSync(file, 'utf8'));
const L = (k) => d[k] || [];
const termKey = (t) => String(t).replace('/', '-').replace(' ', '_');
const nowIso = () => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T');
const writer = db.bulkWriter();
const put = (col, id, data, merge) => writer.set(db.collection(col).doc(String(id)), data, merge ? { merge: true } : {});
const count = {};
const inc = (k) => { count[k] = (count[k] || 0) + 1; };

/* pengaturan (ID folder Drive tidak dimigrasikan; pindah ke Script Properties layanan Drive) */
const raw = {}; L('Settings').forEach((r) => { raw[r.key] = r.value; });
const FIN = ['saldoAwalKas', 'saldoAwalTerkunci', 'saldoAwalCatatan']; const PUB = ['namaKlub', 'namaSekolah', 'logoUrl'];
const app = {}; const fin = {}; const pub = {};
Object.keys(raw).forEach((k) => {
  if (/^folder/.test(k)) return;
  if (FIN.includes(k)) fin[k] = String(raw[k]); else app[k] = String(raw[k]);
  if (PUB.includes(k)) pub[k] = String(raw[k]);
});
put('settings', 'app', app, true); put('settings', 'finance', fin, true); put('settings', 'public', pub, true);

const siswa = {}; L('Siswa').forEach((s) => { siswa[s.nisn] = s; put('siswa', s.nisn, { nisn: s.nisn, nama: s.nama, jk: s.jk, kelas: s.kelas, tempatLahir: s.tempatLahir || '', tglLahir: s.tglLahir || '' }); inc('siswa'); });
const foto = {}; L('Users').forEach((u) => { if (u.role === 'anggota') foto[u.nisn] = u.fotoUrl || ''; });
L('Anggota').forEach((a) => {
  const s = siswa[a.nisn] || {};
  put('anggota', a.nisn, { nisn: a.nisn, nama: s.nama || '(data siswa terhapus)', jk: s.jk || '', kelas: s.kelas || '', tempatLahir: s.tempatLahir || '', tglLahir: s.tglLahir || '', tglBergabung: a.tglBergabung || '', status: a.status || 'aktif', fotoUrl: foto[a.nisn] || '', createdAt: a.createdAt || nowIso() });
  inc('anggota');
});

const pert = {}; L('Pertemuan').forEach((m) => { pert[m.id] = m; });
const stat = {};
L('Presensi').forEach((x) => {
  const m = pert[x.pertemuanId]; if (!m) return;
  put('presensi', x.pertemuanId + '_' + x.nisn, { pertemuanId: x.pertemuanId, nisn: x.nisn, tanggal: m.tanggal, status: x.status, iuran: Number(x.iuran) || 0 }); inc('presensi');
  const s = stat[m.id] || (stat[m.id] = { id: m.id, tanggal: m.tanggal, createdAt: m.createdAt || nowIso(), hadir: 0, total: 0, iuranTotal: 0, counts: { H: 0, S: 0, I: 0, A: 0 } });
  s.total++; if (s.counts[x.status] !== undefined) s.counts[x.status]++; if (x.status === 'H') s.hadir++; s.iuranTotal += Number(x.iuran) || 0;
});
Object.values(pert).forEach((m) => {
  put('pertemuan', m.id, { id: m.id, tanggal: m.tanggal, tahunAjaran: m.tahunAjaran, keterangan: m.keterangan || '', iuran: Number(m.iuran) || 0, createdAt: m.createdAt || nowIso() }); inc('pertemuan');
  put('pertemuanStat', m.id, stat[m.id] || { id: m.id, tanggal: m.tanggal, createdAt: m.createdAt || nowIso(), hadir: 0, total: 0, iuranTotal: 0, counts: { H: 0, S: 0, I: 0, A: 0 } });
});

L('Nilai').forEach((n) => { put('nilai', termKey(n.tahunAjaran) + '_' + n.nisn, { nisn: n.nisn, tahunAjaran: n.tahunAjaran, persenHadir: Number(n.persenHadir) || 0, kemampuan: Number(n.kemampuan), total: Number(n.total), predikat: n.predikat, updatedAt: n.updatedAt || nowIso() }); inc('nilai'); });
L('Jadwal').forEach((j) => { put('jadwal', j.id, { id: j.id, tanggal: j.tanggal, jam: j.jam, lawan: j.lawan, lokasi: j.lokasi || '', jenis: j.jenis, catatan: j.catatan || '', createdAt: j.createdAt || nowIso() }); inc('jadwal'); });
const parse = (s, fb) => { try { const v = JSON.parse(s); return v === null ? fb : v; } catch { return fb; } };
L('Formasi').forEach((f) => {
  const lineup = parse(f.lineup, {}); const cad = parse(f.cadangan, []); const names = {};
  [...Object.values(lineup), ...cad].forEach((n) => { if (n && siswa[n]) names[n] = siswa[n].nama; });
  put('formasi', f.jadwalId, { jadwalId: f.jadwalId, pola: f.pola, lineup, cadangan: cad, names, updatedAt: f.updatedAt || nowIso() }); inc('formasi');
});

const notaMax = {};
for (const [sheet, col] of [['Pengeluaran', 'pengeluaran'], ['Pemasukan', 'pemasukan']]) {
  L(sheet).forEach((x) => {
    const o = { id: x.id, tanggal: x.tanggal, kategori: x.kategori || (col === 'pengeluaran' ? 'Umum' : 'Lainnya'), keterangan: x.keterangan, nominal: Number(x.nominal), jumlah: Number(x.jumlah), total: Number(x.total), buktiUrl: x.buktiUrl || '', createdAt: x.createdAt || nowIso() };
    if (col === 'pengeluaran') {
      o.penerima = x.penerima || ''; o.noNota = x.noNota || '';
      const m = /^NP\/(\d{4})\/(\d{2})\/(\d+)$/.exec(o.noNota);
      if (m) { const k = 'nota_' + m[1] + '_' + m[2]; notaMax[k] = Math.max(notaMax[k] || 0, Number(m[3])); }
    }
    put(col, x.id, o); inc(col);
  });
}
Object.keys(notaMax).forEach((k) => put('counters', k, { n: notaMax[k] }));
L('Galeri').forEach((g) => { put('galeri', g.id, { id: g.id, judul: g.judul, album: g.album, tanggal: g.tanggal, tipe: g.tipe, fileId: g.fileId || '', url: g.url, thumb: g.thumb || '', createdAt: g.createdAt || nowIso() }); inc('galeri'); });
await writer.close();

/* akun Firebase Auth: password awal anggota = NISN; password admin dari ADMIN_PASSWORD */
async function account(username, role, nisn, nama, password, status, fotoUrl) {
  const email = username + '@spansa.club'; let uid;
  try { uid = (await auth.getUserByEmail(email)).uid; await auth.updateUser(uid, { disabled: status !== 'aktif', displayName: nama }); }
  catch (e) { if (e.code !== 'auth/user-not-found') throw e; uid = (await auth.createUser({ email, password, displayName: nama, disabled: status !== 'aktif' })).uid; inc('akun dibuat'); }
  await auth.setCustomUserClaims(uid, role === 'admin' ? { role } : { role, nisn });
  await db.collection('users').doc(uid).set({ userId: uid, username, role, nisn: nisn || '', nama, status, fotoUrl: fotoUrl || '', updatedAt: nowIso(), createdAt: nowIso() }, { merge: true });
}
const skipped = [];
for (const u of L('Users')) {
  if (u.role === 'admin') {
    const pw = process.env.ADMIN_PASSWORD || '';
    if (pw.length < 8) { console.warn('Lewati admin: atur ADMIN_PASSWORD (min 8 karakter) atau jalankan "npm run create-admin".'); continue; }
    await account(String(u.username).toLowerCase().replace(/[^a-z0-9._-]/g, ''), 'admin', '', u.nama, pw, 'aktif', u.fotoUrl);
  } else {
    if (!/^\d{6,20}$/.test(u.nisn)) { skipped.push(u.nisn); continue; }
    await account(u.nisn, 'anggota', u.nisn, u.nama, u.nisn, u.status === 'aktif' ? 'aktif' : 'nonaktif', u.fotoUrl);
  }
}
console.log('Selesai:', count);
if (skipped.length) console.warn('NISN kurang dari 6 digit (akun tidak dibuat, perbaiki lalu tambahkan ulang sebagai anggota):', skipped.join(', '));
