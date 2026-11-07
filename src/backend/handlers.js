import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { limit, orderBy, runTransaction, where } from 'firebase/firestore';
import { auth, db } from '../firebase.js';
import { ACCOUNT_DOMAIN } from '../config.js';
import { adminApi, driveApi } from './remote.js';
import { commit, many, one, ref, writeLog } from './store.js';
import {
  API_VERSION, AppError, FINANCE_KEYS, JENIS_OK, POLA_OK, PUBLIC_KEYS, SETTINGS_DEFAULT, SETTINGS_EDITABLE, TRX,
  byNama, calcTotal, inRange, mapBy, newId, nowIso, normSiswa, parseMediaLink, plusDays, predikat, round1, rp, str,
  termKey, termOf, termRange, today, validDate
} from './util.js';

/* Username/NISN -> email internal. Jika yang diketik sudah berupa email, dipakai apa adanya. */
export const toEmail = (username) => {
  const v = String(username).trim().toLowerCase();
  if (v.indexOf('@') > 0) return v;
  return v.replace(/[^a-z0-9._-]/g, '') + '@' + ACCOUNT_DOMAIN;
};

/* ===================== PENGATURAN ===================== */
async function rawSettings(ctx) {
  const m = Object.assign({}, await one('settings', 'app'));
  if (ctx && ctx.role === 'admin') Object.assign(m, await one('settings', 'finance'));
  return m;
}
async function getSettings(ctx) {
  const raw = await rawSettings(ctx);
  const out = {};
  Object.keys(SETTINGS_DEFAULT).forEach((k) => {
    if (FINANCE_KEYS.includes(k) && !(ctx && ctx.role === 'admin')) return;
    out[k] = raw[k] !== undefined && raw[k] !== '' ? raw[k] : (k === 'bannerUrl' ? (raw[k] || '') : SETTINGS_DEFAULT[k]);
  });
  return out;
}
async function writeSettings(obj) {
  const app = {}; const fin = {}; const pub = {};
  Object.keys(obj).forEach((k) => {
    const v = String(obj[k]);
    if (FINANCE_KEYS.includes(k)) fin[k] = v; else app[k] = v;
    if (PUBLIC_KEYS.includes(k)) pub[k] = v;
  });
  const ops = [];
  if (Object.keys(app).length) ops.push(['set', ref('settings', 'app'), app, { merge: true }]);
  if (Object.keys(fin).length) ops.push(['set', ref('settings', 'finance'), fin, { merge: true }]);
  if (Object.keys(pub).length) ops.push(['set', ref('settings', 'public'), pub, { merge: true }]);
  await commit(ops);
}

async function publicInfo() {
  const p = (await one('settings', 'public').catch(() => null)) || {};
  return {
    namaKlub: p.namaKlub || SETTINGS_DEFAULT.namaKlub,
    namaSekolah: p.namaSekolah || SETTINGS_DEFAULT.namaSekolah,
    logoUrl: p.logoUrl || SETTINGS_DEFAULT.logoUrl,
    version: API_VERSION
  };
}

async function saveSettings(p, ctx) {
  const input = p.settings || {};
  const cur = await getSettings(ctx);
  const merged = Object.assign({}, cur);
  const locked = cur.saldoAwalTerkunci === '1';
  if (input.saldoAwalKas !== undefined && locked && String(input.saldoAwalKas).trim() !== String(cur.saldoAwalKas)) {
    throw new AppError('Saldo awal kas terkunci. Klik "Buka Kunci" terlebih dahulu untuk mengubahnya.', 'LOCKED');
  }
  const out = {};
  SETTINGS_EDITABLE.forEach((k) => { if (input[k] !== undefined) { out[k] = String(input[k]).trim(); merged[k] = out[k]; } });
  ['namaKlub', 'namaSekolah'].forEach((k) => {
    if (!merged[k] || merged[k].length > 80) throw new AppError('Nama klub/sekolah wajib diisi (maksimal 80 karakter)', 'VALID');
  });
  ['logoUrl', 'logoSekolahUrl', 'bannerUrl'].forEach((k) => {
    if (merged[k] && (!/^https:\/\/\S+$/.test(merged[k]) || merged[k].length > 500)) throw new AppError('URL ' + k + ' harus diawali https://', 'VALID');
  });
  ['webSekolah', 'youtube', 'instagram'].forEach((k) => {
    if (!/^[\w.\-@/:]{1,80}$/.test(merged[k])) throw new AppError('Isian ' + k + ' tidak valid (tanpa spasi, maksimal 80 karakter)', 'VALID');
  });
  const num = (k, min, max) => {
    const v = merged[k];
    if (!/^\d{1,7}$/.test(String(v)) || Number(v) < min || Number(v) > max) throw new AppError('Nilai ' + k + ' harus berupa angka ' + min + '-' + max, 'VALID');
  };
  if (!/^\d{1,10}$/.test(String(merged.saldoAwalKas)) || Number(merged.saldoAwalKas) > 9999999999) throw new AppError('Saldo awal kas harus berupa angka bulat (rupiah)', 'VALID');
  num('iuranPerPertemuan', 0, 1000000);
  num('bobotHadir', 0, 100); num('bobotIndividu', 0, 100);
  num('batasA', 0, 100); num('batasB', 0, 100); num('batasC', 0, 100);
  if (Number(merged.bobotHadir) + Number(merged.bobotIndividu) !== 100) throw new AppError('Total bobot kehadiran dan kemampuan individu harus 100%', 'VALID');
  if (!(Number(merged.batasA) > Number(merged.batasB) && Number(merged.batasB) > Number(merged.batasC))) throw new AppError('Batas predikat harus A > B > C', 'VALID');
  ['namaBendahara', 'namaPembina'].forEach((k) => {
    if (!/^[^<>]{0,60}$/.test(merged[k])) throw new AppError('Nama penandatangan maksimal 60 karakter', 'VALID');
  });
  if (input.saldoAwalKas !== undefined) {
    if (Number(merged.saldoAwalKas) > 0) {
      if (!locked) { out.saldoAwalTerkunci = '1'; out.saldoAwalCatatan = today() + ' oleh ' + ctx.username; }
    } else { out.saldoAwalTerkunci = '0'; out.saldoAwalCatatan = ''; }
  }
  await writeSettings(out);
  await writeLog(ctx, 'saveSettings', Object.keys(out).join(','));
  return getSettings(ctx);
}

async function unlockSaldoAwal(p, ctx) {
  await writeSettings({ saldoAwalTerkunci: '0' });
  const s = await getSettings(ctx);
  await writeLog(ctx, 'unlockSaldoAwal', 'saldo ' + s.saldoAwalKas);
  return s;
}

/* ===================== AKUN & PROFIL ===================== */
async function me(p, ctx) {
  const u = await one('users', ctx.uid);
  if (!u || u.status !== 'aktif') throw new AppError('Akun tidak aktif atau belum terdaftar. Hubungi admin.', 'AUTH');
  const user = { userId: ctx.uid, username: u.username, role: u.role, nisn: u.nisn || '', nama: u.nama, fotoUrl: u.fotoUrl || '' };
  return { user, settings: await getSettings(ctx), version: API_VERSION };
}

async function changePassword(p) {
  const u = auth.currentUser;
  if (!u) throw new AppError('Silakan login terlebih dahulu', 'AUTH');
  if (String(p.newPassword || '').length < 6) throw new AppError('Password baru minimal 6 karakter', 'VALID');
  try {
    await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, String(p.oldPassword || '')));
  } catch (e) {
    if (e.code === 'auth/too-many-requests') throw new AppError('Terlalu banyak percobaan. Coba lagi beberapa menit lagi.', 'RATE');
    throw new AppError('Password saat ini salah', 'AUTH');
  }
  await updatePassword(u, String(p.newPassword));
  return { ok: true };
}

async function updatePhoto(p, ctx) {
  const u = await one('users', ctx.uid);
  const r = await driveApi('upload', { kind: 'foto', name: 'foto_' + (ctx.nisn || ctx.username) + '.jpg', mime: p.mime, data: p.data, replaceUrl: (u && u.fotoUrl) || '' });
  const ops = [['update', ref('users', ctx.uid), { fotoUrl: r.url }]];
  if (ctx.role === 'anggota' && ctx.nisn) ops.push(['update', ref('anggota', ctx.nisn), { fotoUrl: r.url }]);
  await commit(ops);
  return { fotoUrl: r.url };
}

async function imageData(p) { return driveApi('imageData', { url: p.url }); }

/* ===================== SISWA ===================== */
async function listSiswa() {
  const ang = {};
  (await many('anggota', where('status', '==', 'aktif'))).forEach((a) => { ang[a.nisn] = true; });
  return (await many('siswa')).map((s) => ({ ...s, isAnggota: !!ang[s.nisn] }))
    .sort((a, b) => String(a.kelas).localeCompare(String(b.kelas), 'id', { numeric: true }) || byNama(a, b));
}

function syncOps(changed, anggotaMap, usersByNisn) {
  const ops = [];
  changed.forEach((s) => {
    if (anggotaMap[s.nisn]) ops.push(['update', ref('anggota', s.nisn), { nama: s.nama, jk: s.jk, kelas: s.kelas, tempatLahir: s.tempatLahir, tglLahir: s.tglLahir }]);
    const u = usersByNisn[s.nisn];
    if (u && u.nama !== s.nama) ops.push(['update', ref('users', u.userId), { nama: s.nama, updatedAt: nowIso() }]);
  });
  return ops;
}
async function syncContext() {
  const anggota = mapBy(await many('anggota'), 'nisn');
  const usersByNisn = mapBy(await many('users', where('role', '==', 'anggota')), 'nisn');
  return { anggota, usersByNisn };
}

async function saveSiswa(p, ctx) {
  const n = normSiswa(p.siswa || {});
  if (n.e.length) throw new AppError(n.e[0], 'VALID');
  const exist = await one('siswa', n.o.nisn);
  if (p.isEdit) { if (!exist) throw new AppError('Data siswa tidak ditemukan', 'NOTFOUND'); } else if (exist) throw new AppError('NISN sudah terdaftar', 'VALID');
  const { anggota, usersByNisn } = await syncContext();
  await commit([['set', ref('siswa', n.o.nisn), n.o], ...syncOps([n.o], anggota, usersByNisn)]);
  await writeLog(ctx, 'saveSiswa', n.o.nisn);
  return { ok: true };
}

async function deleteSiswa(p, ctx) {
  const nisn = String(p.nisn || '');
  if (!(await one('siswa', nisn))) throw new AppError('Data siswa tidak ditemukan', 'NOTFOUND');
  const ang = await one('anggota', nisn);
  if (ang && ang.status === 'aktif') throw new AppError('Siswa masih menjadi anggota futsal. Keluarkan dari menu Anggota Futsal terlebih dahulu.', 'VALID');
  if ((await many('presensi', where('nisn', '==', nisn), limit(1))).length) throw new AppError('Siswa memiliki riwayat presensi dan iuran sehingga tidak dapat dihapus.', 'VALID');
  await commit([['delete', ref('siswa', nisn)], ['delete', ref('anggota', nisn)]]);
  await adminApi('deleteAccounts', { nisns: [nisn] }).catch(() => {});
  await writeLog(ctx, 'deleteSiswa', nisn);
  return { ok: true };
}

async function importSiswa(p, ctx) {
  const input = p.rows;
  if (!Array.isArray(input) || !input.length) throw new AppError('Tidak ada data untuk diimpor', 'VALID');
  if (input.length > 2000) throw new AppError('Maksimal 2000 baris per impor', 'VALID');
  const have = mapBy(await many('siswa'), 'nisn');
  let tambah = 0; let ubah = 0;
  const gagal = []; const seen = {}; const changed = [];
  input.forEach((raw, i) => {
    const n = normSiswa(raw || {});
    if (n.e.length) { gagal.push({ baris: i + 1, pesan: n.e.join('; ') }); return; }
    if (seen[n.o.nisn]) { gagal.push({ baris: i + 1, pesan: 'NISN ganda dalam berkas' }); return; }
    seen[n.o.nisn] = true;
    if (have[n.o.nisn]) ubah++; else tambah++;
    changed.push(n.o);
  });
  if (changed.length) {
    const { anggota, usersByNisn } = await syncContext();
    await commit([...changed.map((s) => ['set', ref('siswa', s.nisn), s]), ...syncOps(changed, anggota, usersByNisn)]);
  }
  await writeLog(ctx, 'importSiswa', tambah + ' baru, ' + ubah + ' ubah');
  return { tambah, ubah, gagal };
}

/* ===================== ANGGOTA ===================== */
const memberOut = (a) => ({ nisn: a.nisn, nama: a.nama, jk: a.jk || '', kelas: a.kelas || '', tglBergabung: a.tglBergabung || '' });
async function activeMembers() {
  return (await many('anggota', where('status', '==', 'aktif'))).map(memberOut).sort(byNama);
}
async function scopeMembers(ctx) {
  if (ctx.role === 'admin') return activeMembers();
  const a = await one('anggota', ctx.nisn);
  return a && a.status === 'aktif' ? [memberOut(a)] : [];
}

async function listAnggota() {
  return (await many('anggota', where('status', '==', 'aktif'))).map((a) => ({ ...memberOut(a), fotoUrl: a.fotoUrl || '' })).sort(byNama);
}

async function addAnggota(p, ctx) {
  const nisns = Array.isArray(p.nisns) ? p.nisns.map(String) : [];
  if (!nisns.length || nisns.length > 300) throw new AppError('Pilih 1-300 siswa', 'VALID');
  const tgl = String(p.tglBergabung || '').trim();
  if (tgl && !validDate(tgl)) throw new AppError('Tanggal bergabung tidak valid', 'VALID');
  const siswa = mapBy(await many('siswa'), 'nisn');
  const ang = mapBy(await many('anggota'), 'nisn');
  const ops = [];
  nisns.forEach((n) => {
    const s = siswa[n];
    if (!s) throw new AppError('NISN ' + n + ' tidak ada di Data Siswa', 'VALID');
    const base = { nisn: n, nama: s.nama, jk: s.jk, kelas: s.kelas, tempatLahir: s.tempatLahir || '', tglLahir: s.tglLahir || '', status: 'aktif' };
    if (ang[n]) ops.push(['set', ref('anggota', n), { ...base, ...(tgl ? { tglBergabung: tgl } : {}) }, { merge: true }]);
    else ops.push(['set', ref('anggota', n), { ...base, tglBergabung: tgl, fotoUrl: '', createdAt: nowIso() }]);
  });
  await commit(ops);
  await adminApi('ensureAccounts', { nisns });
  await writeLog(ctx, 'addAnggota', nisns.length + ' siswa');
  return { jumlah: nisns.length };
}

async function updateAnggota(p) {
  const tgl = String(p.tglBergabung || '').trim();
  if (tgl && !validDate(tgl)) throw new AppError('Tanggal bergabung tidak valid', 'VALID');
  const a = await one('anggota', String(p.nisn));
  if (!a || a.status !== 'aktif') throw new AppError('Anggota tidak ditemukan', 'NOTFOUND');
  await commit([['update', ref('anggota', a.nisn), { tglBergabung: tgl }]]);
  return { ok: true };
}

async function removeAnggota(p, ctx) {
  const nisn = String(p.nisn || '');
  const a = await one('anggota', nisn);
  if (!a || a.status !== 'aktif') throw new AppError('Anggota tidak ditemukan', 'NOTFOUND');
  await commit([['update', ref('anggota', nisn), { status: 'nonaktif' }]]);
  await adminApi('disableAccounts', { nisns: [nisn] });
  await writeLog(ctx, 'removeAnggota', nisn);
  return { ok: true };
}

async function resetPassword(p, ctx) {
  const nisn = String(p.nisn || '');
  const a = await one('anggota', nisn);
  if (!a || a.status !== 'aktif') throw new AppError('Akun anggota tidak ditemukan', 'NOTFOUND');
  await adminApi('resetPassword', { nisn });
  await writeLog(ctx, 'resetPassword', nisn);
  return { ok: true };
}

async function getKartu(p, ctx) {
  const nisn = ctx.role === 'admin' ? String(p.nisn || '') : ctx.nisn;
  const a = await one('anggota', nisn);
  if (!a || a.status !== 'aktif') throw new AppError('Anggota tidak ditemukan', 'NOTFOUND');
  return { ...memberOut(a), tempatLahir: a.tempatLahir || '', tglLahir: a.tglLahir || '', fotoUrl: a.fotoUrl || '' };
}

/* ===================== PRESENSI & IURAN ===================== */
const byTgl = (a, b) => (a.tanggal < b.tanggal ? -1 : 1);
const rangeQ = (from, to) => [where('tanggal', '>=', from), where('tanggal', '<=', to)];
const meetingsIn = async (tr) => (await many('pertemuan', ...rangeQ(tr.from, tr.to))).sort(byTgl);
const idSet = (arr) => { const s = {}; arr.forEach((x) => { s[x.id] = true; }); return s; };
const monthEnd = (b) => b + '-31';

/* Admin: seluruh presensi pada rentang; anggota: hanya miliknya (sesuai Security Rules). */
async function presensiIn(ctx, from, to, ids) {
  if (ctx.role === 'admin') return many('presensi', ...rangeQ(from, to));
  return (await many('presensi', where('nisn', '==', ctx.nisn))).filter((x) => ids[x.pertemuanId]);
}

async function listPertemuan(p) {
  const tr = termRange(p.term);
  const st = mapBy(await many('pertemuanStat', ...rangeQ(tr.from, tr.to)), 'id');
  return (await meetingsIn(tr)).map((m) => {
    const s = st[m.id] || {};
    return { id: m.id, tanggal: m.tanggal, keterangan: m.keterangan || '', iuran: Number(m.iuran), hadir: Number(s.hadir) || 0, total: Number(s.total) || 0, iuranTotal: Number(s.iuranTotal) || 0 };
  }).reverse();
}

async function getPresensi(p) {
  const tanggal = String(p.tanggal || '');
  if (!validDate(tanggal)) throw new AppError('Tanggal tidak valid', 'VALID');
  const pert = (await many('pertemuan', where('tanggal', '==', tanggal), limit(1)))[0] || null;
  const nominal = pert ? Number(pert.iuran) : Number((await getSettings({ role: 'admin' })).iuranPerPertemuan);
  const rows = {};
  if (pert) (await many('presensi', where('pertemuanId', '==', pert.id))).forEach((x) => { rows[x.nisn] = x; });
  const anggota = (await activeMembers()).map((m) => {
    const r = rows[m.nisn];
    return { nisn: m.nisn, nama: m.nama, kelas: m.kelas, status: r ? r.status : 'H', iuran: r ? Number(r.iuran) : nominal };
  });
  return { pertemuan: pert ? { id: pert.id, tanggal: pert.tanggal, keterangan: pert.keterangan || '' } : null, tanggal, nominal, anggota };
}

async function savePresensi(p, ctx) {
  const tanggal = String(p.tanggal || '');
  if (!validDate(tanggal)) throw new AppError('Tanggal tidak valid', 'VALID');
  const items = Array.isArray(p.items) ? p.items : [];
  if (!items.length) throw new AppError('Tidak ada data presensi', 'VALID');
  const members = mapBy(await activeMembers(), 'nisn');
  let cur = (await many('pertemuan', where('tanggal', '==', tanggal), limit(1)))[0];
  const nominal = cur ? Number(cur.iuran) : Number((await getSettings({ role: 'admin' })).iuranPerPertemuan);
  if (!cur) cur = { id: newId('P'), tanggal, tahunAjaran: termOf(tanggal), iuran: nominal, createdAt: nowIso() };
  const existing = mapBy(await many('presensi', where('pertemuanId', '==', cur.id)), 'nisn');
  const seen = {}; const ops = []; const final = {};
  Object.keys(existing).forEach((n) => { final[n] = existing[n]; });
  items.forEach((it) => {
    const nisn = String(it.nisn); const st = String(it.status);
    if (!members[nisn]) throw new AppError('NISN ' + nisn + ' bukan anggota aktif', 'VALID');
    if (['H', 'S', 'I', 'A'].indexOf(st) < 0) throw new AppError('Status presensi harus H, S, I, atau A', 'VALID');
    if (seen[nisn]) return;
    seen[nisn] = true;
    const row = { pertemuanId: cur.id, nisn, tanggal, status: st, iuran: st === 'H' ? nominal : 0 };
    final[nisn] = row;
    ops.push(['set', ref('presensi', cur.id + '_' + nisn), row]);
  });
  Object.keys(existing).forEach((n) => {
    if (members[n] && !seen[n]) { delete final[n]; ops.push(['delete', ref('presensi', cur.id + '_' + n)]); }
  });
  const counts = { H: 0, S: 0, I: 0, A: 0 };
  let iuranTotal = 0; let total = 0;
  Object.keys(final).forEach((n) => { const r = final[n]; total++; if (counts[r.status] !== undefined) counts[r.status]++; iuranTotal += Number(r.iuran) || 0; });
  const pert = { id: cur.id, tanggal, tahunAjaran: cur.tahunAjaran || termOf(tanggal), iuran: nominal, createdAt: cur.createdAt, keterangan: str(p.keterangan, 100) };
  ops.push(['set', ref('pertemuan', cur.id), pert]);
  /* Agregat iuran/kehadiran disimpan terpisah (hanya admin yang bisa membaca). */
  ops.push(['set', ref('pertemuanStat', cur.id), { id: cur.id, tanggal, createdAt: cur.createdAt, hadir: counts.H, total, iuranTotal, counts }]);
  await commit(ops);
  await writeLog(ctx, 'savePresensi', tanggal + ' hadir ' + counts.H);
  return { id: cur.id, iuranTotal, hadir: counts.H };
}

async function deletePertemuan(p, ctx) {
  const id = String(p.id || '');
  if (!(await one('pertemuan', id))) throw new AppError('Pertemuan tidak ditemukan', 'NOTFOUND');
  const rows = await many('presensi', where('pertemuanId', '==', id));
  await commit([...rows.map((x) => ['delete', ref('presensi', id + '_' + x.nisn)]), ['delete', ref('pertemuan', id)], ['delete', ref('pertemuanStat', id)]]);
  await writeLog(ctx, 'deletePertemuan', id);
  return { ok: true };
}

function monthCheck(term, bulan) {
  const tr = termRange(term);
  if (tr.months.indexOf(String(bulan)) < 0) throw new AppError('Bulan berada di luar tahun ajaran terpilih', 'VALID');
  return tr;
}
async function monthData(ctx, bulan) {
  const ms = (await many('pertemuan', ...rangeQ(bulan + '-01', monthEnd(bulan)))).sort(byTgl);
  const ids = idSet(ms);
  const pres = await presensiIn(ctx, bulan + '-01', monthEnd(bulan), ids);
  return { ms, pres: pres.filter((x) => ids[x.pertemuanId]) };
}

async function rekapHadir(p, ctx) {
  monthCheck(p.term, p.bulan);
  const { ms, pres } = await monthData(ctx, p.bulan);
  const rows = (await scopeMembers(ctx)).map((m) => {
    const c = { H: 0, S: 0, I: 0, A: 0 };
    pres.forEach((x) => { if (x.nisn === m.nisn && c[x.status] !== undefined) c[x.status]++; });
    return { nisn: m.nisn, nama: m.nama, kelas: m.kelas, H: c.H, S: c.S, I: c.I, A: c.A, persen: ms.length ? round1(c.H / ms.length * 100) : 0 };
  });
  let detail = [];
  if (ctx.role !== 'admin') {
    const mine = {};
    pres.forEach((x) => { if (x.nisn === ctx.nisn) mine[x.pertemuanId] = x.status; });
    detail = ms.filter((m) => mine[m.id]).map((m) => ({ tanggal: m.tanggal, keterangan: m.keterangan || '', status: mine[m.id] }));
  }
  return { bulan: p.bulan, totalPertemuan: ms.length, rows, detail };
}

async function rekapIuran(p, ctx) {
  monthCheck(p.term, p.bulan);
  const { ms, pres } = await monthData(ctx, p.bulan);
  const per = ms.length ? Number(ms[ms.length - 1].iuran) : Number((await getSettings({ role: 'admin' })).iuranPerPertemuan);
  const rows = (await scopeMembers(ctx)).map((m) => {
    let n = 0; let tot = 0;
    pres.forEach((x) => { if (x.nisn === m.nisn) { if (x.status === 'H') n++; tot += Number(x.iuran) || 0; } });
    return { nisn: m.nisn, nama: m.nama, kelas: m.kelas, perPertemuan: per, jumlahBayar: n, total: tot };
  });
  let totalKas = 0;
  if (ctx.role === 'admin') pres.forEach((x) => { totalKas += Number(x.iuran) || 0; });
  let detail = [];
  if (ctx.role !== 'admin') {
    const mine = {};
    pres.forEach((x) => { if (x.nisn === ctx.nisn) mine[x.pertemuanId] = x; });
    detail = ms.filter((m) => mine[m.id]).map((m) => ({ tanggal: m.tanggal, status: mine[m.id].status, iuran: Number(mine[m.id].iuran) }));
  }
  return { bulan: p.bulan, totalPertemuan: ms.length, totalKas, rows, detail };
}

/* ===================== NILAI ===================== */
async function nilaiRows(term) {
  const tr = termRange(term);
  const cfg = await getSettings({ role: 'admin' });
  const ms = await meetingsIn(tr);
  const ids = idSet(ms);
  const hadir = {};
  (await many('presensi', ...rangeQ(tr.from, tr.to))).forEach((x) => { if (ids[x.pertemuanId] && x.status === 'H') hadir[x.nisn] = (hadir[x.nisn] || 0) + 1; });
  const saved = mapBy(await many('nilai', where('tahunAjaran', '==', term)), 'nisn');
  const rows = (await activeMembers()).map((m) => {
    const h = hadir[m.nisn] || 0;
    const persen = ms.length ? round1(h / ms.length * 100) : 0;
    const sv = saved[m.nisn];
    const kem = sv && sv.kemampuan !== '' && sv.kemampuan !== undefined ? sv.kemampuan : '';
    const tot = kem === '' ? '' : calcTotal(persen, kem, cfg);
    return { nisn: m.nisn, nama: m.nama, kelas: m.kelas, hadir: h, persenHadir: persen, kemampuan: kem, total: tot, predikat: tot === '' ? '-' : predikat(tot, cfg) };
  });
  return { term, totalPertemuan: ms.length, rows };
}
const listNilai = (p) => nilaiRows(p.term);

async function saveNilai(p, ctx) {
  termRange(p.term);
  const items = Array.isArray(p.items) ? p.items : [];
  const cur = await nilaiRows(p.term);
  const byN = mapBy(cur.rows, 'nisn');
  const cfg = await getSettings({ role: 'admin' });
  const ops = [];
  items.forEach((it) => {
    const nisn = String(it.nisn);
    const row = byN[nisn];
    if (!row) throw new AppError('NISN ' + nisn + ' bukan anggota aktif', 'VALID');
    const id = termKey(p.term) + '_' + nisn;
    if (it.kemampuan === '' || it.kemampuan === null || it.kemampuan === undefined) { ops.push(['delete', ref('nilai', id)]); return; }
    const k = Number(it.kemampuan);
    if (!isFinite(k) || k < 0 || k > 100) throw new AppError('Nilai kemampuan harus 0-100', 'VALID');
    const tot = calcTotal(row.persenHadir, k, cfg);
    ops.push(['set', ref('nilai', id), { nisn, tahunAjaran: p.term, persenHadir: row.persenHadir, kemampuan: k, total: tot, predikat: predikat(tot, cfg), updatedAt: nowIso() }]);
  });
  await commit(ops);
  await writeLog(ctx, 'saveNilai', p.term);
  return nilaiRows(p.term);
}

/* ===================== JADWAL & FORMASI ===================== */
const sortJadwal = (a, b) => ((a.tanggal + a.jam) < (b.tanggal + b.jam) ? -1 : 1);
const jadwalOut = (j) => ({ id: j.id, tanggal: j.tanggal, jam: j.jam, lawan: j.lawan, lokasi: j.lokasi || '', jenis: j.jenis, catatan: j.catatan || '' });

async function listJadwal(p) {
  const tr = termRange(p.term);
  return (await many('jadwal', ...rangeQ(tr.from, tr.to))).sort(sortJadwal).map(jadwalOut);
}

async function saveJadwal(p, ctx) {
  const j = p.jadwal || {};
  const o = { id: String(j.id || ''), tanggal: String(j.tanggal || '').trim(), jam: String(j.jam || '').trim(), lawan: str(j.lawan, 60), lokasi: str(j.lokasi, 80), jenis: str(j.jenis, 20), catatan: str(j.catatan, 200) };
  if (!validDate(o.tanggal)) throw new AppError('Tanggal tidak valid', 'VALID');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(o.jam)) throw new AppError('Jam harus berformat HH:mm', 'VALID');
  if (!o.lawan) throw new AppError('Nama lawan wajib diisi', 'VALID');
  if (JENIS_OK.indexOf(o.jenis) < 0) o.jenis = 'Persahabatan';
  if (o.id) {
    const old = await one('jadwal', o.id);
    if (!old) throw new AppError('Jadwal tidak ditemukan', 'NOTFOUND');
    o.createdAt = old.createdAt || nowIso();
  } else { o.id = newId('J'); o.createdAt = nowIso(); }
  await commit([['set', ref('jadwal', o.id), o]]);
  await writeLog(ctx, 'saveJadwal', o.tanggal + ' vs ' + o.lawan);
  return { id: o.id };
}

async function deleteJadwal(p, ctx) {
  const id = String(p.id || '');
  if (!(await one('jadwal', id))) throw new AppError('Jadwal tidak ditemukan', 'NOTFOUND');
  await commit([['delete', ref('jadwal', id)], ['delete', ref('formasi', id)]]);
  await writeLog(ctx, 'deleteJadwal', id);
  return { ok: true };
}

const upcoming = async () => (await many('jadwal', ...rangeQ(today(), plusDays(14)))).sort(sortJadwal).map(jadwalOut);

const formasiView = (jadwal, row) => ({
  jadwal: jadwalOut(jadwal), pola: row ? row.pola : '1-2-1', lineup: row ? (row.lineup || {}) : {},
  cadangan: row ? (row.cadangan || []) : [], names: row ? (row.names || {}) : {}
});

async function getFormasi(p) {
  const jadwal = await one('jadwal', String(p.jadwalId));
  if (!jadwal) throw new AppError('Jadwal tidak ditemukan', 'NOTFOUND');
  const v = formasiView(jadwal, await one('formasi', jadwal.id));
  v.anggota = (await activeMembers()).map((m) => ({ nisn: m.nisn, nama: m.nama, kelas: m.kelas }));
  return v;
}

async function saveFormasi(p, ctx) {
  const jadwal = await one('jadwal', String(p.jadwalId));
  if (!jadwal) throw new AppError('Jadwal tidak ditemukan', 'NOTFOUND');
  if (POLA_OK.indexOf(p.pola) < 0) throw new AppError('Pola formasi tidak valid', 'VALID');
  const members = mapBy(await activeMembers(), 'nisn');
  const src = p.lineup || {}; const lineup = {}; const used = {}; const names = {};
  for (let i = 0; i < 5; i++) {
    const v = String(src['s' + i] || '');
    if (v) {
      if (!members[v]) throw new AppError('Pemain pada posisi ' + (i + 1) + ' bukan anggota aktif', 'VALID');
      if (used[v]) throw new AppError('Satu pemain tidak boleh menempati dua posisi', 'VALID');
      used[v] = true; names[v] = members[v].nama;
    }
    lineup['s' + i] = v;
  }
  const cad = [];
  (Array.isArray(p.cadangan) ? p.cadangan : []).forEach((n) => {
    n = String(n);
    if (!members[n] || used[n] || cad.indexOf(n) >= 0) return;
    cad.push(n); names[n] = members[n].nama;
  });
  await commit([['set', ref('formasi', jadwal.id), { jadwalId: jadwal.id, pola: p.pola, lineup, cadangan: cad, names, updatedAt: nowIso() }]]);
  await writeLog(ctx, 'saveFormasi', jadwal.id);
  return { ok: true };
}

/* ===================== TRANSAKSI KAS ===================== */
const trxOut = (cfg, x) => ({
  id: x.id, tanggal: x.tanggal, kategori: x.kategori || cfg.def, keterangan: x.keterangan, nominal: Number(x.nominal),
  jumlah: Number(x.jumlah), total: Number(x.total), buktiUrl: x.buktiUrl || '', penerima: x.penerima || '', noNota: x.noNota || ''
});

async function listTrx(cfg, p) {
  const tr = termRange(p.term);
  return (await many(cfg.col, ...rangeQ(tr.from, tr.to)))
    .sort((a, b) => ((a.tanggal + a.createdAt) < (b.tanggal + b.createdAt) ? 1 : -1)).map((x) => trxOut(cfg, x));
}

async function nextNota(tanggal) {
  const cref = ref('counters', 'nota_' + tanggal.slice(0, 4) + '_' + tanggal.slice(5, 7));
  const n = await runTransaction(db, async (tx) => {
    const s = await tx.get(cref);
    const v = (s.exists() ? Number(s.data().n) || 0 : 0) + 1;
    tx.set(cref, { n: v });
    return v;
  });
  return 'NP/' + tanggal.slice(0, 4) + '/' + tanggal.slice(5, 7) + '/' + (String(n).length < 3 ? ('000' + n).slice(-3) : String(n));
}

async function saveTrx(cfg, p, ctx) {
  const it = p.item || {};
  const tanggal = String(it.tanggal || '').trim();
  const nominal = Number(it.nominal); const jumlah = Number(it.jumlah);
  if (!validDate(tanggal)) throw new AppError('Tanggal tidak valid', 'VALID');
  const ket = str(it.keterangan, 150);
  if (!ket) throw new AppError('Keterangan wajib diisi', 'VALID');
  if (!isFinite(nominal) || nominal < 1 || nominal > 1000000000 || Math.floor(nominal) !== nominal) throw new AppError('Nominal harus bilangan bulat lebih dari 0', 'VALID');
  if (!isFinite(jumlah) || jumlah < 1 || jumlah > 100000 || Math.floor(jumlah) !== jumlah) throw new AppError('Jumlah harus bilangan bulat lebih dari 0', 'VALID');
  const kat = str(it.kategori, 30) || cfg.def;
  if (cfg.kategori.indexOf(kat) < 0) throw new AppError('Kategori tidak valid', 'VALID');
  let row;
  if (it.id) {
    row = await one(cfg.col, String(it.id));
    if (!row) throw new AppError('Data ' + cfg.label + ' tidak ditemukan', 'NOTFOUND');
  } else row = { id: newId(cfg.prefix), buktiUrl: '', createdAt: nowIso() };
  row = { ...row, tanggal, keterangan: ket, kategori: kat, nominal, jumlah, total: nominal * jumlah };
  if (cfg.col === 'pengeluaran') {
    if (kat === 'Pelatih') {
      const pen = str(it.penerima, 80);
      if (!pen) throw new AppError('Nama pelatih wajib diisi', 'VALID');
      row.penerima = pen;
      if (!row.noNota) row.noNota = await nextNota(tanggal);
    } else { row.penerima = ''; row.noNota = ''; }
  }
  const b = p.bukti;
  let oldBukti = '';
  if (b && b.data) {
    const mime = String(b.mime || '');
    if (['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].indexOf(mime) < 0) throw new AppError('Bukti harus JPG, PNG, WEBP, atau PDF', 'VALID');
    if (String(b.data).length > 5600000) throw new AppError('Ukuran bukti maksimal 4 MB', 'VALID');
    const ext = mime === 'application/pdf' ? 'pdf' : mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const f = await driveApi('upload', { kind: 'bukti', name: 'bukti_' + cfg.label + '_' + tanggal + '_' + row.id + '.' + ext, mime, data: b.data });
    oldBukti = row.buktiUrl; row.buktiUrl = f.url;
  }
  await commit([['set', ref(cfg.col, row.id), row]]);
  if (oldBukti) driveApi('trash', { url: oldBukti }).catch(() => {});
  await writeLog(ctx, 'save' + cfg.col, ket + ' ' + row.total);
  return { id: row.id, total: row.total, noNota: row.noNota || '' };
}

async function deleteTrx(cfg, p, ctx) {
  const row = await one(cfg.col, String(p.id));
  if (!row) throw new AppError('Data ' + cfg.label + ' tidak ditemukan', 'NOTFOUND');
  await commit([['delete', ref(cfg.col, row.id)]]);
  if (row.buktiUrl) driveApi('trash', { url: row.buktiUrl }).catch(() => {});
  await writeLog(ctx, 'delete' + cfg.col, row.id);
  return { ok: true };
}

/* ===================== KEUANGAN ===================== */
async function financeData() {
  const incomes = (await many('pertemuanStat')).filter((m) => Number(m.iuranTotal) > 0).map((m) => ({ tanggal: m.tanggal, nominal: Number(m.iuranTotal) }));
  const others = (await many('pemasukan')).map((x) => ({ tanggal: x.tanggal, nominal: Number(x.total) }));
  const spends = (await many('pengeluaran')).map((x) => ({ tanggal: x.tanggal, nominal: Number(x.total) }));
  return { incomes, others, spends };
}
const sumBefore = (arr, from) => arr.reduce((s, x) => (x.tanggal < from ? s + x.nominal : s), 0);
const sumMonth = (arr, b) => arr.reduce((s, x) => (x.tanggal.slice(0, 7) === b ? s + x.nominal : s), 0);

async function kasOf(term, fin) {
  const tr = termRange(term);
  const base = Number((await getSettings({ role: 'admin' })).saldoAwalKas) || 0;
  const saldoAwal = base + sumBefore(fin.incomes, tr.from) + sumBefore(fin.others, tr.from) - sumBefore(fin.spends, tr.from);
  let saldo = saldoAwal; let tm = 0; let tl = 0; let tk = 0;
  const rows = tr.months.map((b) => {
    const masuk = sumMonth(fin.incomes, b); const masukLain = sumMonth(fin.others, b); const keluar = sumMonth(fin.spends, b);
    saldo += masuk + masukLain - keluar; tm += masuk; tl += masukLain; tk += keluar;
    return { bulan: b, masuk, masukLain, keluar, saldo };
  });
  return { saldoAwal, rows, totalMasuk: tm, totalMasukLain: tl, totalKeluar: tk, saldoAkhir: saldo };
}
const rekapKas = async (p) => kasOf(p.term, await financeData());

/* ===================== GALERI ===================== */
const galeriOut = (g) => ({ id: g.id, judul: g.judul, album: g.album, tanggal: g.tanggal, tipe: g.tipe, fileId: g.fileId, url: g.url, thumb: g.thumb });

async function listGaleri() {
  return (await many('galeri')).sort((a, b) => ((a.tanggal + a.createdAt) < (b.tanggal + b.createdAt) ? 1 : -1)).map(galeriOut);
}

async function saveGaleri(p, ctx) {
  const it = p.item || {};
  const judul = str(it.judul, 100); const album = str(it.album, 60) || 'Umum';
  const tanggal = String(it.tanggal || '').trim() || today();
  if (!validDate(tanggal)) throw new AppError('Tanggal tidak valid', 'VALID');
  if (it.id) {
    const g = await one('galeri', String(it.id));
    if (!g) throw new AppError('Item galeri tidak ditemukan', 'NOTFOUND');
    await commit([['update', ref('galeri', g.id), { judul, album, tanggal }]]);
    await writeLog(ctx, 'saveGaleri', g.id);
    return { id: g.id };
  }
  const id = newId('G');
  let media;
  if (p.file && p.file.data) {
    const mime = String(p.file.mime || '');
    if (['image/jpeg', 'image/png', 'image/webp'].indexOf(mime) < 0) throw new AppError('Foto harus JPG, PNG, atau WEBP', 'VALID');
    if (String(p.file.data).length * 0.75 > 600 * 1024) throw new AppError('Ukuran foto maksimal 500 KB', 'VALID');
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const f = await driveApi('upload', { kind: 'galeri', name: 'galeri_' + tanggal + '_' + id + '.' + ext, mime, data: p.file.data });
    media = { tipe: 'upload', fileId: f.fileId, url: f.url, thumb: 'https://lh3.googleusercontent.com/d/' + f.fileId + '=w640' };
  } else if (p.link) media = parseMediaLink(p.link);
  else throw new AppError('Pilih foto atau isi tautan', 'VALID');
  await commit([['set', ref('galeri', id), { id, judul, album, tanggal, ...media, createdAt: nowIso() }]]);
  await writeLog(ctx, 'saveGaleri', id);
  return { id };
}

async function deleteGaleri(p, ctx) {
  const g = await one('galeri', String(p.id));
  if (!g) throw new AppError('Item galeri tidak ditemukan', 'NOTFOUND');
  await commit([['delete', ref('galeri', g.id)]]);
  if (g.tipe === 'upload') driveApi('trash', { url: g.url }).catch(() => {});
  await writeLog(ctx, 'deleteGaleri', g.id);
  return { ok: true };
}

/* ===================== DASHBOARD ===================== */
const recent = (col) => many(col, orderBy('createdAt', 'desc'), limit(6));

async function dashboard(p, ctx) {
  const tr = termRange(p.term);
  const up = (await many('jadwal', ...rangeQ(today(), tr.to))).sort(sortJadwal).filter((j) => j.tanggal >= tr.from);
  const ms = await meetingsIn(tr);
  let formasi = null;
  for (let i = 0; i < up.length && !formasi; i++) {
    const row = await one('formasi', up[i].id);
    if (row) formasi = formasiView(up[i], row);
  }
  const base = { role: ctx.role, jadwal: up.slice(0, 3).map(jadwalOut), formasi };

  if (ctx.role === 'admin') {
    const kas = await kasOf(p.term, await financeData());
    const keh = { H: 0, S: 0, I: 0, A: 0 }; let pemasukan = 0;
    (await many('pertemuanStat', ...rangeQ(tr.from, tr.to))).forEach((m) => { const c = m.counts || {}; Object.keys(keh).forEach((k) => { keh[k] += Number(c[k]) || 0; }); pemasukan += Number(m.iuranTotal) || 0; });
    const act = [];
    (await recent('pertemuanStat')).forEach((m) => act.push({ tipe: 'Presensi', teks: 'Presensi ' + m.tanggal + ': ' + (m.hadir || 0) + ' dari ' + (m.total || 0) + ' hadir', waktu: m.createdAt }));
    (await recent('pengeluaran')).forEach((x) => act.push({ tipe: 'Kas', teks: 'Pengeluaran ' + x.keterangan + ' ' + rp(x.total), waktu: x.createdAt }));
    (await recent('jadwal')).forEach((j) => act.push({ tipe: 'Jadwal', teks: 'Jadwal vs ' + j.lawan + ' (' + j.tanggal + ')', waktu: j.createdAt }));
    act.sort((a, b) => (a.waktu < b.waktu ? 1 : -1));
    base.stats = { anggota: (await activeMembers()).length, jadwalMendatang: up.length, pemasukan, saldo: kas.saldoAkhir };
    base.kehadiran = keh;
    base.kas = kas.rows.map((r) => ({ bulan: r.bulan, masuk: r.masuk + r.masukLain, keluar: r.keluar }));
    base.aktivitas = act.slice(0, 6);
    return base;
  }

  const ids = idSet(ms);
  const mine = (await many('presensi', where('nisn', '==', ctx.nisn))).filter((x) => ids[x.pertemuanId]);
  const keh = { H: 0, S: 0, I: 0, A: 0 };
  mine.forEach((x) => { if (keh[x.status] !== undefined) keh[x.status]++; });
  const persen = ms.length ? round1(keh.H / ms.length * 100) : 0;
  const sv = await one('nilai', termKey(p.term) + '_' + ctx.nisn);
  const tren = [];
  tr.months.forEach((b) => {
    const mm = ms.filter((m) => m.tanggal.slice(0, 7) === b);
    if (!mm.length) return;
    const mid = idSet(mm);
    const h = mine.filter((x) => mid[x.pertemuanId] && x.status === 'H').length;
    tren.push({ bulan: b, persen: round1(h / mm.length * 100) });
  });
  const LBL = { H: 'Hadir', S: 'Sakit', I: 'Izin', A: 'Alpa' };
  const dateOf = {};
  ms.forEach((m) => { dateOf[m.id] = m.tanggal; });
  const act = mine.filter((x) => dateOf[x.pertemuanId]).map((x) => ({ tipe: 'Presensi', teks: 'Latihan ' + dateOf[x.pertemuanId] + ': ' + LBL[x.status], waktu: dateOf[x.pertemuanId] + 'T00:00:00' }));
  (await recent('jadwal')).forEach((j) => act.push({ tipe: 'Jadwal', teks: 'Jadwal vs ' + j.lawan + ' (' + j.tanggal + ')', waktu: j.createdAt }));
  act.sort((a, b) => (a.waktu < b.waktu ? 1 : -1));
  base.stats = { persenHadir: persen, hadir: keh.H, totalPertemuan: ms.length, jadwalMendatang: up.length, nilai: sv ? { total: sv.total, predikat: sv.predikat } : null };
  base.kehadiran = keh;
  base.tren = tren;
  base.aktivitas = act.slice(0, 6);
  return base;
}

/* ===================== RUTE ===================== */
export const ROUTES = {
  publicInfo: { fn: publicInfo, auth: false },
  me: { fn: me },
  changePassword: { fn: changePassword },
  updatePhoto: { fn: updatePhoto },
  imageData: { fn: imageData },
  upcoming: { fn: upcoming },
  dashboard: { fn: dashboard },
  getKartu: { fn: getKartu },
  rekapHadir: { fn: rekapHadir },
  rekapIuran: { fn: rekapIuran },
  listJadwal: { fn: listJadwal },
  getFormasi: { fn: getFormasi },
  listGaleri: { fn: listGaleri },
  saveSettings: { fn: saveSettings, admin: true },
  unlockSaldoAwal: { fn: unlockSaldoAwal, admin: true },
  listSiswa: { fn: listSiswa, admin: true },
  saveSiswa: { fn: saveSiswa, admin: true },
  deleteSiswa: { fn: deleteSiswa, admin: true },
  importSiswa: { fn: importSiswa, admin: true },
  listAnggota: { fn: listAnggota, admin: true },
  addAnggota: { fn: addAnggota, admin: true },
  updateAnggota: { fn: updateAnggota, admin: true },
  removeAnggota: { fn: removeAnggota, admin: true },
  resetPassword: { fn: resetPassword, admin: true },
  listPertemuan: { fn: listPertemuan, admin: true },
  getPresensi: { fn: getPresensi, admin: true },
  savePresensi: { fn: savePresensi, admin: true },
  deletePertemuan: { fn: deletePertemuan, admin: true },
  listNilai: { fn: listNilai, admin: true },
  saveNilai: { fn: saveNilai, admin: true },
  saveJadwal: { fn: saveJadwal, admin: true },
  deleteJadwal: { fn: deleteJadwal, admin: true },
  saveFormasi: { fn: saveFormasi, admin: true },
  listPengeluaran: { fn: (p) => listTrx(TRX.pengeluaran, p), admin: true },
  savePengeluaran: { fn: (p, c) => saveTrx(TRX.pengeluaran, p, c), admin: true },
  deletePengeluaran: { fn: (p, c) => deleteTrx(TRX.pengeluaran, p, c), admin: true },
  listPemasukan: { fn: (p) => listTrx(TRX.pemasukan, p), admin: true },
  savePemasukan: { fn: (p, c) => saveTrx(TRX.pemasukan, p, c), admin: true },
  deletePemasukan: { fn: (p, c) => deleteTrx(TRX.pemasukan, p, c), admin: true },
  rekapKas: { fn: rekapKas, admin: true },
  saveGaleri: { fn: saveGaleri, admin: true },
  deleteGaleri: { fn: deleteGaleri, admin: true }
};
