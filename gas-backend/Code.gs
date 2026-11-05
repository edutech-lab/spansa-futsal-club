/**
 * SPANSA FUTSAL CLUB - Backend Google Apps Script (Web App + Google Sheets)
 * SMP Negeri 1 Bandar Lampung
 *
 * Skrip ini dipasang pada Google Sheets (Extensions > Apps Script).
 * Langkah awal: jalankan setupDatabase(), lalu createAdmin(), lalu Deploy sebagai Web App.
 */

/* ===================== KONFIGURASI ===================== */
const APP = {
  TZ: 'Asia/Jakarta',
  SESSION_HOURS: 12,
  HASH_ROUNDS: 50,
  MAX_FAIL: 8,
  LOCK_SECONDS: 600,
  DEFAULT_LOGO: 'https://lh3.googleusercontent.com/d/1zpjLOtbR-nLzBll8bfwlas6mgrWfBYUf'
};

const SCHEMA = {
  Users: ['userId', 'username', 'role', 'nisn', 'nama', 'passwordHash', 'salt', 'status', 'fotoUrl', 'createdAt', 'updatedAt'],
  Sessions: ['tokenHash', 'userId', 'role', 'nisn', 'expiresAt'],
  Settings: ['key', 'value'],
  Siswa: ['nisn', 'nama', 'jk', 'kelas', 'tempatLahir', 'tglLahir'],
  Anggota: ['nisn', 'tglBergabung', 'status', 'createdAt'],
  Pertemuan: ['id', 'tanggal', 'tahunAjaran', 'keterangan', 'iuran', 'createdAt'],
  Presensi: ['pertemuanId', 'nisn', 'status', 'iuran'],
  Jadwal: ['id', 'tanggal', 'jam', 'lawan', 'lokasi', 'jenis', 'catatan', 'createdAt'],
  Formasi: ['jadwalId', 'pola', 'lineup', 'cadangan', 'updatedAt'],
  Nilai: ['nisn', 'tahunAjaran', 'persenHadir', 'kemampuan', 'total', 'predikat', 'updatedAt'],
  Pengeluaran: ['id', 'tanggal', 'keterangan', 'nominal', 'jumlah', 'total', 'buktiUrl', 'createdAt'],
  Log: ['waktu', 'user', 'action', 'detail']
};

// Kolom bertipe angka. Semua kolom lain disimpan sebagai TEKS (format "@"), termasuk NISN, Kelas, dan tanggal.
const NUMERIC = {
  Sessions: ['expiresAt'],
  Pertemuan: ['iuran'],
  Presensi: ['iuran'],
  Nilai: ['persenHadir', 'kemampuan', 'total'],
  Pengeluaran: ['nominal', 'jumlah', 'total']
};

const SETTINGS_DEFAULT = {
  namaKlub: 'Spansa Futsal Club',
  namaSekolah: 'SMP Negeri 1 Bandar Lampung',
  logoUrl: APP.DEFAULT_LOGO,
  logoSekolahUrl: 'https://lh3.googleusercontent.com/d/1GDe6aqXyF_RR6kL3jMCy0vWqaO83jgyp',
  webSekolah: 'smpn1-bandarlampung.sch.id',
  youtube: 'spansa_official',
  instagram: 'spansa_official',
  bannerUrl: '',
  saldoAwalKas: '0',
  iuranPerPertemuan: '5000',
  bobotHadir: '70',
  bobotIndividu: '30',
  batasA: '85',
  batasB: '75',
  batasC: '60'
};
const SETTINGS_EDITABLE = Object.keys(SETTINGS_DEFAULT);
const SETTINGS_PRIVATE = ['folderRoot', 'folderFoto', 'folderBukti', 'folderBackup'];
const POLA_OK = ['1-2-1', '2-2', '3-1', '1-1-2'];
const JENIS_OK = ['Persahabatan', 'Turnamen', 'Liga', 'Latih Tanding'];

class AppError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code || 'ERR';
  }
}

/* ===================== ROUTER ===================== */
const ROUTES = {
  publicInfo: { auth: false, fn: publicInfo_ },
  login: { auth: false, write: true, fn: login_ },
  me: { fn: me_ },
  logout: { write: true, fn: logout_ },
  changePassword: { write: true, fn: changePassword_ },
  updatePhoto: { write: true, fn: updatePhoto_ },
  imageData: { fn: imageData_ },
  saveSettings: { admin: true, write: true, fn: saveSettings_ },
  listSiswa: { admin: true, fn: listSiswa_ },
  saveSiswa: { admin: true, write: true, fn: saveSiswa_ },
  deleteSiswa: { admin: true, write: true, fn: deleteSiswa_ },
  importSiswa: { admin: true, write: true, fn: importSiswa_ },
  listAnggota: { admin: true, fn: listAnggota_ },
  addAnggota: { admin: true, write: true, fn: addAnggota_ },
  updateAnggota: { admin: true, write: true, fn: updateAnggota_ },
  removeAnggota: { admin: true, write: true, fn: removeAnggota_ },
  resetPassword: { admin: true, write: true, fn: resetPassword_ },
  getKartu: { fn: getKartu_ },
  listPertemuan: { admin: true, fn: listPertemuan_ },
  getPresensi: { admin: true, fn: getPresensi_ },
  savePresensi: { admin: true, write: true, fn: savePresensi_ },
  deletePertemuan: { admin: true, write: true, fn: deletePertemuan_ },
  rekapHadir: { fn: rekapHadir_ },
  rekapIuran: { admin: true, fn: rekapIuran_ },
  listNilai: { admin: true, fn: listNilai_ },
  saveNilai: { admin: true, write: true, fn: saveNilai_ },
  listJadwal: { admin: true, fn: listJadwal_ },
  saveJadwal: { admin: true, write: true, fn: saveJadwal_ },
  deleteJadwal: { admin: true, write: true, fn: deleteJadwal_ },
  upcoming: { fn: upcoming_ },
  getFormasi: { admin: true, fn: getFormasi_ },
  saveFormasi: { admin: true, write: true, fn: saveFormasi_ },
  listPengeluaran: { admin: true, fn: listPengeluaran_ },
  savePengeluaran: { admin: true, write: true, fn: savePengeluaran_ },
  deletePengeluaran: { admin: true, write: true, fn: deletePengeluaran_ },
  rekapKas: { admin: true, fn: rekapKas_ },
  dashboard: { fn: dashboard_ }
};

function doGet() {
  return out_({ success: true, message: 'Spansa Futsal Club API aktif', data: { waktu: now_() } });
}

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return out_({ success: false, message: 'Permintaan tidak valid', data: null });
  }
  return out_(handle_(req));
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function handle_(req) {
  const action = String((req && req.action) || '');
  const params = (req && req.params) || {};
  try {
    const def = ROUTES[action];
    if (!def) throw new AppError('Aksi tidak dikenal: ' + action, 'NOACTION');
    let ctx = null;
    if (def.auth !== false) {
      ctx = authenticate_(req.token);
      if (def.admin && ctx.role !== 'admin') throw new AppError('Anda tidak memiliki akses ke fitur ini', 'FORBIDDEN');
    }
    let data;
    if (def.write) {
      const lock = LockService.getScriptLock();
      if (!lock.tryLock(25000)) throw new AppError('Server sedang sibuk, coba lagi sebentar', 'BUSY');
      try {
        resetCache_();
        data = def.fn(params, ctx);
      } finally {
        lock.releaseLock();
      }
    } else {
      resetCache_();
      data = def.fn(params, ctx);
    }
    return { success: true, message: 'OK', data: data === undefined ? null : data };
  } catch (err) {
    if (err instanceof AppError) return { success: false, message: err.message, code: err.code, data: null };
    console.error(err && err.stack ? err.stack : String(err));
    return { success: false, message: 'Terjadi kesalahan pada server. Silakan coba lagi.', code: 'SERVER', data: null };
  }
}

/* ===================== SETUP (dijalankan manual dari editor) ===================== */
function setupDatabase() {
  const ss = ss_();
  Object.keys(SCHEMA).forEach(function (name) {
    const cols = SCHEMA[name];
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getMaxColumns() < cols.length) sh.insertColumnsAfter(sh.getMaxColumns(), cols.length - sh.getMaxColumns());
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold').setBackground('#0A2A94').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
    const rows = Math.max(sh.getMaxRows() - 1, 1);
    cols.forEach(function (c, i) {
      sh.getRange(2, i + 1, rows, 1).setNumberFormat(isNumeric_(name, c) ? '0' : '@');
    });
  });
  const def = ss.getSheetByName('Sheet1') || ss.getSheetByName('Sheet 1') || ss.getSheetByName('Lembar1');
  if (def && ss.getSheets().length > 1 && def.getLastRow() <= 1) ss.deleteSheet(def);
  resetCache_();
  const cur = readTable_('Settings');
  const have = {};
  cur.forEach(function (r) { have[r.key] = true; });
  const add = [];
  Object.keys(SETTINGS_DEFAULT).forEach(function (k) { if (!have[k]) add.push({ key: k, value: SETTINGS_DEFAULT[k] }); });
  if (add.length) writeTable_('Settings', cur.concat(add));
  ensureFolders_();
  pepper_();
  Logger.log('setupDatabase selesai. Sheet: ' + Object.keys(SCHEMA).join(', '));
  Logger.log('Langkah berikutnya: atur Script Property ADMIN_INITIAL_PASSWORD lalu jalankan createAdmin().');
}

function ensureFolders_() {
  const s = rawSettings_();
  let root = null;
  if (s.folderRoot) {
    try { root = DriveApp.getFolderById(s.folderRoot); } catch (e) { root = null; }
  }
  if (!root) {
    const it = DriveApp.getFoldersByName('Spansa Futsal Club');
    root = it.hasNext() ? it.next() : DriveApp.createFolder('Spansa Futsal Club');
  }
  const sub = function (n) {
    const it = root.getFoldersByName(n);
    return it.hasNext() ? it.next() : root.createFolder(n);
  };
  upsertSettings_({
    folderRoot: root.getId(),
    folderFoto: sub('Foto Profil').getId(),
    folderBukti: sub('Bukti Pengeluaran').getId(),
    folderBackup: sub('Backup').getId()
  });
}

function createAdmin() {
  const props = PropertiesService.getScriptProperties();
  const pw = props.getProperty('ADMIN_INITIAL_PASSWORD');
  const username = (props.getProperty('ADMIN_USERNAME') || 'admin').trim();
  const nama = props.getProperty('ADMIN_NAMA') || 'Administrator';
  if (!pw || pw.length < 8) throw new Error('Atur Script Property ADMIN_INITIAL_PASSWORD (minimal 8 karakter) terlebih dahulu.');
  resetCache_();
  const users = readTable_('Users');
  if (users.some(function (u) { return u.role === 'admin'; })) {
    Logger.log('Akun admin sudah ada. Gunakan resetAdminPassword() bila perlu mengganti password.');
    return;
  }
  const salt = Utilities.getUuid();
  users.push({ userId: newId_('U'), username: username, role: 'admin', nisn: '', nama: nama, passwordHash: hashPassword_(pw, salt), salt: salt, status: 'aktif', fotoUrl: '', createdAt: now_(), updatedAt: now_() });
  writeTable_('Users', users);
  Logger.log('Akun admin dibuat. Username: ' + username + '. Hapus Script Property ADMIN_INITIAL_PASSWORD setelah ini.');
}

function resetAdminPassword() {
  const props = PropertiesService.getScriptProperties();
  const pw = props.getProperty('ADMIN_INITIAL_PASSWORD');
  if (!pw || pw.length < 8) throw new Error('Atur Script Property ADMIN_INITIAL_PASSWORD (minimal 8 karakter) terlebih dahulu.');
  resetCache_();
  const users = readTable_('Users');
  const a = users.filter(function (u) { return u.role === 'admin'; })[0];
  if (!a) throw new Error('Akun admin belum ada. Jalankan createAdmin().');
  a.salt = Utilities.getUuid();
  a.passwordHash = hashPassword_(pw, a.salt);
  a.status = 'aktif';
  a.updatedAt = now_();
  writeTable_('Users', users);
  writeTable_('Sessions', readTable_('Sessions').filter(function (s) { return s.userId !== a.userId; }));
  Logger.log('Password admin direset. Hapus Script Property ADMIN_INITIAL_PASSWORD setelah ini.');
}

/* ===================== DATABASE HELPER ===================== */
let _ss = null;
let _cache = {};

function resetCache_() { _cache = {}; }

function ss_() {
  if (_ss) return _ss;
  let s = null;
  try { s = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { s = null; }
  if (!s) {
    const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (!id) throw new Error('Skrip tidak terikat ke spreadsheet. Isi Script Property SPREADSHEET_ID.');
    s = SpreadsheetApp.openById(id);
  }
  _ss = s;
  return s;
}

function sheet_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh) throw new AppError('Database belum disiapkan. Jalankan setupDatabase() di editor Apps Script.', 'SETUP');
  return sh;
}

function isNumeric_(name, col) { return (NUMERIC[name] || []).indexOf(col) >= 0; }

function readTable_(name) {
  const cols = SCHEMA[name];
  const sh = sheet_(name);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const vals = sh.getRange(2, 1, last - 1, cols.length).getValues();
  const out = [];
  for (let r = 0; r < vals.length; r++) {
    const row = vals[r];
    let empty = true;
    for (let c = 0; c < row.length; c++) { if (row[c] !== '' && row[c] !== null) { empty = false; break; } }
    if (empty) continue;
    const o = {};
    for (let c = 0; c < cols.length; c++) {
      let v = row[c];
      if (v instanceof Date) v = Utilities.formatDate(v, APP.TZ, 'yyyy-MM-dd');
      if (isNumeric_(name, cols[c])) o[cols[c]] = (v === '' || v === null || v === undefined) ? '' : Number(v);
      else o[cols[c]] = (v === null || v === undefined) ? '' : String(v);
    }
    out.push(o);
  }
  return out;
}

function writeTable_(name, rows) {
  const cols = SCHEMA[name];
  const sh = sheet_(name);
  const last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, cols.length).clearContent();
  if (!rows.length) return;
  const need = rows.length + 1;
  if (sh.getMaxRows() < need) sh.insertRowsAfter(sh.getMaxRows(), need - sh.getMaxRows());
  cols.forEach(function (c, i) {
    sh.getRange(2, i + 1, rows.length, 1).setNumberFormat(isNumeric_(name, c) ? '0' : '@');
  });
  const data = rows.map(function (r) {
    return cols.map(function (c) { return r[c] === undefined || r[c] === null ? '' : r[c]; });
  });
  sh.getRange(2, 1, rows.length, cols.length).setValues(data);
}

function log_(user, action, detail) {
  try {
    sheet_('Log').appendRow([now_(), user || '-', action, String(detail || '').slice(0, 200)]);
  } catch (e) { /* log tidak boleh menggagalkan proses */ }
}

function now_() { return Utilities.formatDate(new Date(), APP.TZ, "yyyy-MM-dd'T'HH:mm:ss"); }
function today_() { return Utilities.formatDate(new Date(), APP.TZ, 'yyyy-MM-dd'); }
function newId_(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 1679616).toString(36); }
function round1_(n) { return Math.round(n * 10) / 10; }
function byNama_(a, b) { return String(a.nama).localeCompare(String(b.nama), 'id'); }
function mapBy_(arr, key) { const m = {}; arr.forEach(function (x) { m[x[key]] = x; }); return m; }
function str_(v, max) { return String(v === undefined || v === null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max || 200); }

function validDate_(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const p = s.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  return d.getUTCFullYear() === p[0] && d.getUTCMonth() === p[1] - 1 && d.getUTCDate() === p[2];
}

/* ===================== PENGATURAN ===================== */
function rawSettings_() {
  if (_cache.settings) return _cache.settings;
  const m = {};
  readTable_('Settings').forEach(function (r) { m[r.key] = r.value; });
  _cache.settings = m;
  return m;
}

function getSettings_() {
  const raw = rawSettings_();
  const out = {};
  Object.keys(SETTINGS_DEFAULT).forEach(function (k) { out[k] = raw[k] !== undefined && raw[k] !== '' ? raw[k] : (k === 'bannerUrl' ? (raw[k] || '') : SETTINGS_DEFAULT[k]); });
  return out;
}

function publicSettings_() { return getSettings_(); }

function upsertSettings_(obj) {
  const rows = readTable_('Settings');
  const idx = mapBy_(rows, 'key');
  Object.keys(obj).forEach(function (k) {
    if (idx[k]) idx[k].value = String(obj[k]);
    else rows.push({ key: k, value: String(obj[k]) });
  });
  writeTable_('Settings', rows);
  _cache.settings = null;
}

function publicInfo_() {
  const s = getSettings_();
  return { namaKlub: s.namaKlub, namaSekolah: s.namaSekolah, logoUrl: s.logoUrl };
}

function saveSettings_(p, ctx) {
  const input = p.settings || {};
  const merged = getSettings_();
  const out = {};
  SETTINGS_EDITABLE.forEach(function (k) {
    if (input[k] !== undefined) { out[k] = String(input[k]).trim(); merged[k] = out[k]; }
  });
  ['namaKlub', 'namaSekolah'].forEach(function (k) {
    if (!merged[k] || merged[k].length > 80) throw new AppError('Nama klub/sekolah wajib diisi (maksimal 80 karakter)', 'VALID');
  });
  ['logoUrl', 'logoSekolahUrl', 'bannerUrl'].forEach(function (k) {
    if (merged[k] && (!/^https:\/\/\S+$/.test(merged[k]) || merged[k].length > 500)) throw new AppError('URL ' + k + ' harus diawali https://', 'VALID');
  });
  ['webSekolah', 'youtube', 'instagram'].forEach(function (k) {
    if (!/^[\w.\-@\/:]{1,80}$/.test(merged[k])) throw new AppError('Isian ' + k + ' tidak valid (tanpa spasi, maksimal 80 karakter)', 'VALID');
  });
  const num = function (k, min, max) {
    const v = merged[k];
    if (!/^\d{1,7}$/.test(String(v)) || Number(v) < min || Number(v) > max) throw new AppError('Nilai ' + k + ' harus berupa angka ' + min + '-' + max, 'VALID');
  };
  if (!/^\d{1,10}$/.test(String(merged.saldoAwalKas)) || Number(merged.saldoAwalKas) > 9999999999) throw new AppError('Saldo awal kas harus berupa angka bulat (rupiah)', 'VALID');
  num('iuranPerPertemuan', 0, 1000000);
  num('bobotHadir', 0, 100); num('bobotIndividu', 0, 100);
  num('batasA', 0, 100); num('batasB', 0, 100); num('batasC', 0, 100);
  if (Number(merged.bobotHadir) + Number(merged.bobotIndividu) !== 100) throw new AppError('Total bobot kehadiran dan kemampuan individu harus 100%', 'VALID');
  if (!(Number(merged.batasA) > Number(merged.batasB) && Number(merged.batasB) > Number(merged.batasC))) throw new AppError('Batas predikat harus A > B > C', 'VALID');
  upsertSettings_(out);
  log_(ctx.username, 'saveSettings', Object.keys(out).join(','));
  return publicSettings_();
}

/* ===================== AUTENTIKASI ===================== */
function sha256hex_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function pepper_() {
  const props = PropertiesService.getScriptProperties();
  let p = props.getProperty('PASSWORD_PEPPER');
  if (!p) {
    p = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('PASSWORD_PEPPER', p);
  }
  return p;
}

function hashPassword_(pw, salt) {
  const pep = pepper_();
  let h = pw + '|' + salt + '|' + pep;
  for (let i = 0; i < APP.HASH_ROUNDS; i++) h = sha256hex_(h + salt);
  return h;
}

function safeEq_(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function authenticate_(token) {
  if (!token) throw new AppError('Silakan login terlebih dahulu', 'AUTH');
  const h = sha256hex_(String(token));
  const s = readTable_('Sessions').filter(function (x) { return x.tokenHash === h; })[0];
  if (!s || Number(s.expiresAt) < Date.now()) throw new AppError('Sesi berakhir, silakan login kembali', 'AUTH');
  const u = readTable_('Users').filter(function (x) { return x.userId === s.userId; })[0];
  if (!u || u.status !== 'aktif') throw new AppError('Akun tidak aktif', 'AUTH');
  return { userId: u.userId, role: u.role, nisn: u.nisn, username: u.username, nama: u.nama, tokenHash: h };
}

function userOut_(u) {
  const o = { userId: u.userId, username: u.username, role: u.role, nisn: u.nisn, nama: u.nama, fotoUrl: u.fotoUrl || '' };
  if (u.role === 'anggota') {
    const s = readTable_('Siswa').filter(function (x) { return x.nisn === u.nisn; })[0];
    if (s) { o.kelas = s.kelas; o.jk = s.jk; }
  }
  return o;
}

function login_(p) {
  const username = str_(p.username, 60);
  const password = String(p.password || '');
  if (!username || !password) throw new AppError('Username dan password wajib diisi', 'VALID');
  const cache = CacheService.getScriptCache();
  const fkey = 'fail_' + sha256hex_(username.toLowerCase()).slice(0, 24);
  const fails = Number(cache.get(fkey) || 0);
  if (fails >= APP.MAX_FAIL) throw new AppError('Terlalu banyak percobaan gagal. Coba lagi dalam beberapa menit.', 'LOCKED');
  const u = readTable_('Users').filter(function (x) { return x.username.toLowerCase() === username.toLowerCase(); })[0];
  if (!u || u.status !== 'aktif' || !safeEq_(hashPassword_(password, u.salt), u.passwordHash)) {
    cache.put(fkey, String(fails + 1), APP.LOCK_SECONDS);
    throw new AppError('Username atau password salah', 'LOGIN');
  }
  cache.remove(fkey);
  const sessions = readTable_('Sessions').filter(function (s) { return Number(s.expiresAt) > Date.now(); });
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  sessions.push({ tokenHash: sha256hex_(token), userId: u.userId, role: u.role, nisn: u.nisn, expiresAt: Date.now() + APP.SESSION_HOURS * 3600 * 1000 });
  writeTable_('Sessions', sessions);
  log_(u.username, 'login', u.role);
  return { token: token, user: userOut_(u), settings: publicSettings_() };
}

function me_(p, ctx) {
  const u = readTable_('Users').filter(function (x) { return x.userId === ctx.userId; })[0];
  return { user: userOut_(u), settings: publicSettings_() };
}

function logout_(p, ctx) {
  writeTable_('Sessions', readTable_('Sessions').filter(function (s) { return s.tokenHash !== ctx.tokenHash; }));
  return { ok: true };
}

function changePassword_(p, ctx) {
  const oldPw = String(p.oldPassword || '');
  const newPw = String(p.newPassword || '');
  if (newPw.length < 6 || newPw.length > 64) throw new AppError('Password baru harus 6-64 karakter', 'VALID');
  const users = readTable_('Users');
  const u = users.filter(function (x) { return x.userId === ctx.userId; })[0];
  if (!safeEq_(hashPassword_(oldPw, u.salt), u.passwordHash)) throw new AppError('Password saat ini salah', 'VALID');
  u.salt = Utilities.getUuid();
  u.passwordHash = hashPassword_(newPw, u.salt);
  u.updatedAt = now_();
  writeTable_('Users', users);
  writeTable_('Sessions', readTable_('Sessions').filter(function (s) { return s.userId !== u.userId || s.tokenHash === ctx.tokenHash; }));
  log_(u.username, 'changePassword', '');
  return { ok: true };
}

function fileIdFromUrl_(url) {
  const m = /\/d\/([-\w]{20,})/.exec(String(url || '')) || /[?&]id=([-\w]{20,})/.exec(String(url || ''));
  return m ? m[1] : '';
}

function trashByUrl_(url) {
  const id = fileIdFromUrl_(url);
  if (!id) return;
  try { DriveApp.getFileById(id).setTrashed(true); } catch (e) { /* berkas sudah tidak ada */ }
}

function saveFile_(folderId, name, mime, b64) {
  if (!folderId) throw new AppError('Folder Drive belum disiapkan. Jalankan setupDatabase().', 'SETUP');
  let bytes;
  try { bytes = Utilities.base64Decode(String(b64)); } catch (e) { throw new AppError('Data berkas tidak valid', 'VALID'); }
  const file = DriveApp.getFolderById(folderId).createFile(Utilities.newBlob(bytes, mime, name));
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    file.setTrashed(true);
    throw new AppError('Berkas tidak dapat dibagikan. Periksa kebijakan berbagi Google Workspace sekolah.', 'DRIVE');
  }
  return file;
}

function updatePhoto_(p, ctx) {
  const mime = String(p.mime || '');
  const data = String(p.data || '');
  if (['image/jpeg', 'image/png', 'image/webp'].indexOf(mime) < 0) throw new AppError('Foto harus berformat JPG, PNG, atau WEBP', 'VALID');
  if (!data || data.length > 600000) throw new AppError('Ukuran foto terlalu besar', 'VALID');
  const users = readTable_('Users');
  const u = users.filter(function (x) { return x.userId === ctx.userId; })[0];
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  const file = saveFile_(rawSettings_().folderFoto, 'foto_' + (u.nisn || u.username) + '_' + Date.now() + '.' + ext, mime, data);
  const old = u.fotoUrl;
  u.fotoUrl = 'https://lh3.googleusercontent.com/d/' + file.getId();
  u.updatedAt = now_();
  writeTable_('Users', users);
  if (old) trashByUrl_(old);
  return { fotoUrl: u.fotoUrl };
}

function imageData_(p) {
  const url = String(p.url || '');
  if (!/^https:\/\/(lh3\.googleusercontent\.com|drive\.google\.com)\//.test(url)) throw new AppError('Sumber gambar tidak diizinkan', 'VALID');
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  if (res.getResponseCode() !== 200) throw new AppError('Gambar tidak dapat diambil', 'NOTFOUND');
  const blob = res.getBlob();
  const bytes = blob.getBytes();
  const type = String(blob.getContentType() || '');
  if (bytes.length > 2 * 1024 * 1024 || type.indexOf('image/') !== 0) throw new AppError('Berkas bukan gambar atau terlalu besar', 'VALID');
  return { dataUrl: 'data:' + type + ';base64,' + Utilities.base64Encode(bytes) };
}

/* ===================== PERIODE (TAHUN AJARAN) ===================== */
function pad2_(n) { return (n < 10 ? '0' : '') + n; }

function termRange_(term) {
  const m = /^(\d{4})\/(\d{4}) (Ganjil|Genap)$/.exec(String(term || ''));
  if (!m || Number(m[2]) !== Number(m[1]) + 1) throw new AppError('Tahun ajaran tidak valid', 'VALID');
  const y1 = Number(m[1]);
  const y2 = Number(m[2]);
  const months = [];
  if (m[3] === 'Ganjil') {
    for (let i = 7; i <= 12; i++) months.push(y1 + '-' + pad2_(i));
    return { term: term, from: y1 + '-07-01', to: y1 + '-12-31', months: months };
  }
  for (let j = 1; j <= 6; j++) months.push(y2 + '-' + pad2_(j));
  return { term: term, from: y2 + '-01-01', to: y2 + '-06-30', months: months };
}

function termOf_(tanggal) {
  const y = Number(tanggal.slice(0, 4));
  const mo = Number(tanggal.slice(5, 7));
  return mo >= 7 ? y + '/' + (y + 1) + ' Ganjil' : (y - 1) + '/' + y + ' Genap';
}

function inRange_(t, tr) { return t >= tr.from && t <= tr.to; }

/* ===================== SISWA ===================== */
function normSiswa_(s) {
  const o = {
    nisn: String(s.nisn === undefined || s.nisn === null ? '' : s.nisn).trim(),
    nama: str_(s.nama, 100),
    jk: String(s.jk || '').toUpperCase(),
    kelas: str_(s.kelas, 10),
    tempatLahir: str_(s.tempatLahir, 60),
    tglLahir: String(s.tglLahir || '').trim()
  };
  const e = [];
  if (!/^\d{5,20}$/.test(o.nisn)) e.push('NISN harus berupa angka 5-20 digit');
  if (!o.nama) e.push('Nama wajib diisi');
  if (o.jk !== 'L' && o.jk !== 'P') e.push('Jenis kelamin harus L atau P');
  if (!o.kelas) e.push('Kelas wajib diisi');
  if (o.tglLahir && !validDate_(o.tglLahir)) e.push('Tanggal lahir tidak valid');
  return { o: o, e: e };
}

function syncUserNames_(siswaList) {
  const users = readTable_('Users');
  const idx = {};
  siswaList.forEach(function (s) { idx[s.nisn] = s.nama; });
  let changed = false;
  users.forEach(function (u) {
    if (u.role === 'anggota' && idx[u.nisn] !== undefined && u.nama !== idx[u.nisn]) { u.nama = idx[u.nisn]; u.updatedAt = now_(); changed = true; }
  });
  if (changed) writeTable_('Users', users);
}

function listSiswa_() {
  const ang = {};
  readTable_('Anggota').forEach(function (a) { if (a.status === 'aktif') ang[a.nisn] = true; });
  return readTable_('Siswa').map(function (s) { s.isAnggota = !!ang[s.nisn]; return s; }).sort(function (a, b) {
    return String(a.kelas).localeCompare(String(b.kelas), 'id', { numeric: true }) || byNama_(a, b);
  });
}

function saveSiswa_(p, ctx) {
  const n = normSiswa_(p.siswa || {});
  if (n.e.length) throw new AppError(n.e[0], 'VALID');
  const rows = readTable_('Siswa');
  const i = rows.findIndex(function (x) { return x.nisn === n.o.nisn; });
  if (p.isEdit) {
    if (i < 0) throw new AppError('Data siswa tidak ditemukan', 'NOTFOUND');
    rows[i] = n.o;
  } else {
    if (i >= 0) throw new AppError('NISN sudah terdaftar', 'VALID');
    rows.push(n.o);
  }
  writeTable_('Siswa', rows);
  syncUserNames_([n.o]);
  log_(ctx.username, 'saveSiswa', n.o.nisn);
  return { ok: true };
}

function deleteSiswa_(p, ctx) {
  const nisn = String(p.nisn || '');
  const rows = readTable_('Siswa');
  if (!rows.some(function (x) { return x.nisn === nisn; })) throw new AppError('Data siswa tidak ditemukan', 'NOTFOUND');
  const aktif = readTable_('Anggota').some(function (a) { return a.nisn === nisn && a.status === 'aktif'; });
  if (aktif) throw new AppError('Siswa masih menjadi anggota futsal. Keluarkan dari menu Anggota Futsal terlebih dahulu.', 'VALID');
  if (readTable_('Presensi').some(function (x) { return x.nisn === nisn; })) throw new AppError('Siswa memiliki riwayat presensi dan iuran sehingga tidak dapat dihapus.', 'VALID');
  writeTable_('Siswa', rows.filter(function (x) { return x.nisn !== nisn; }));
  writeTable_('Anggota', readTable_('Anggota').filter(function (a) { return a.nisn !== nisn; }));
  const users = readTable_('Users');
  const gone = users.filter(function (u) { return u.role === 'anggota' && u.nisn === nisn; }).map(function (u) { return u.userId; });
  if (gone.length) {
    writeTable_('Users', users.filter(function (u) { return gone.indexOf(u.userId) < 0; }));
    writeTable_('Sessions', readTable_('Sessions').filter(function (s) { return gone.indexOf(s.userId) < 0; }));
  }
  log_(ctx.username, 'deleteSiswa', nisn);
  return { ok: true };
}

function importSiswa_(p, ctx) {
  const input = p.rows;
  if (!Array.isArray(input) || !input.length) throw new AppError('Tidak ada data untuk diimpor', 'VALID');
  if (input.length > 2000) throw new AppError('Maksimal 2000 baris per impor', 'VALID');
  const rows = readTable_('Siswa');
  const idx = {};
  rows.forEach(function (r, i) { idx[r.nisn] = i; });
  let tambah = 0, ubah = 0;
  const gagal = [];
  const seen = {};
  const changed = [];
  input.forEach(function (raw, i) {
    const n = normSiswa_(raw || {});
    if (n.e.length) { gagal.push({ baris: i + 1, pesan: n.e.join('; ') }); return; }
    if (seen[n.o.nisn]) { gagal.push({ baris: i + 1, pesan: 'NISN ganda dalam berkas' }); return; }
    seen[n.o.nisn] = true;
    if (idx[n.o.nisn] !== undefined) { rows[idx[n.o.nisn]] = n.o; ubah++; } else { idx[n.o.nisn] = rows.length; rows.push(n.o); tambah++; }
    changed.push(n.o);
  });
  if (tambah + ubah > 0) { writeTable_('Siswa', rows); syncUserNames_(changed); }
  log_(ctx.username, 'importSiswa', tambah + ' baru, ' + ubah + ' ubah');
  return { tambah: tambah, ubah: ubah, gagal: gagal };
}

/* ===================== ANGGOTA ===================== */
function activeMembers_() {
  const siswa = mapBy_(readTable_('Siswa'), 'nisn');
  return readTable_('Anggota').filter(function (a) { return a.status === 'aktif'; }).map(function (a) {
    const s = siswa[a.nisn] || {};
    return { nisn: a.nisn, nama: s.nama || '(data siswa terhapus)', jk: s.jk || '', kelas: s.kelas || '', tglBergabung: a.tglBergabung };
  }).sort(byNama_);
}

function listAnggota_() {
  const foto = {};
  readTable_('Users').forEach(function (u) { if (u.role === 'anggota') foto[u.nisn] = u.fotoUrl; });
  return activeMembers_().map(function (m) { m.fotoUrl = foto[m.nisn] || ''; return m; });
}

function addAnggota_(p, ctx) {
  const nisns = Array.isArray(p.nisns) ? p.nisns.map(String) : [];
  if (!nisns.length || nisns.length > 300) throw new AppError('Pilih 1-300 siswa', 'VALID');
  const tgl = String(p.tglBergabung || '').trim();
  if (tgl && !validDate_(tgl)) throw new AppError('Tanggal bergabung tidak valid', 'VALID');
  const siswa = mapBy_(readTable_('Siswa'), 'nisn');
  const ang = readTable_('Anggota');
  const aIdx = mapBy_(ang, 'nisn');
  const users = readTable_('Users');
  const uIdx = {};
  users.forEach(function (u) { if (u.role === 'anggota') uIdx[u.nisn] = u; });
  nisns.forEach(function (n) {
    const s = siswa[n];
    if (!s) throw new AppError('NISN ' + n + ' tidak ada di Data Siswa', 'VALID');
    if (aIdx[n]) { aIdx[n].status = 'aktif'; if (tgl) aIdx[n].tglBergabung = tgl; } else { ang.push({ nisn: n, tglBergabung: tgl, status: 'aktif', createdAt: now_() }); }
    if (uIdx[n]) { uIdx[n].status = 'aktif'; uIdx[n].nama = s.nama; uIdx[n].updatedAt = now_(); } else {
      const salt = Utilities.getUuid();
      users.push({ userId: newId_('U'), username: n, role: 'anggota', nisn: n, nama: s.nama, passwordHash: hashPassword_(n, salt), salt: salt, status: 'aktif', fotoUrl: '', createdAt: now_(), updatedAt: now_() });
    }
  });
  writeTable_('Anggota', ang);
  writeTable_('Users', users);
  log_(ctx.username, 'addAnggota', nisns.length + ' siswa');
  return { jumlah: nisns.length };
}

function updateAnggota_(p) {
  const tgl = String(p.tglBergabung || '').trim();
  if (tgl && !validDate_(tgl)) throw new AppError('Tanggal bergabung tidak valid', 'VALID');
  const ang = readTable_('Anggota');
  const a = ang.filter(function (x) { return x.nisn === String(p.nisn) && x.status === 'aktif'; })[0];
  if (!a) throw new AppError('Anggota tidak ditemukan', 'NOTFOUND');
  a.tglBergabung = tgl;
  writeTable_('Anggota', ang);
  return { ok: true };
}

function removeAnggota_(p, ctx) {
  const nisn = String(p.nisn || '');
  const ang = readTable_('Anggota');
  const a = ang.filter(function (x) { return x.nisn === nisn && x.status === 'aktif'; })[0];
  if (!a) throw new AppError('Anggota tidak ditemukan', 'NOTFOUND');
  a.status = 'nonaktif';
  writeTable_('Anggota', ang);
  const users = readTable_('Users');
  const ids = [];
  users.forEach(function (u) { if (u.role === 'anggota' && u.nisn === nisn) { u.status = 'nonaktif'; u.updatedAt = now_(); ids.push(u.userId); } });
  writeTable_('Users', users);
  writeTable_('Sessions', readTable_('Sessions').filter(function (s) { return ids.indexOf(s.userId) < 0; }));
  log_(ctx.username, 'removeAnggota', nisn);
  return { ok: true };
}

function resetPassword_(p, ctx) {
  const nisn = String(p.nisn || '');
  const users = readTable_('Users');
  const u = users.filter(function (x) { return x.role === 'anggota' && x.nisn === nisn && x.status === 'aktif'; })[0];
  if (!u) throw new AppError('Akun anggota tidak ditemukan', 'NOTFOUND');
  u.salt = Utilities.getUuid();
  u.passwordHash = hashPassword_(nisn, u.salt);
  u.updatedAt = now_();
  writeTable_('Users', users);
  writeTable_('Sessions', readTable_('Sessions').filter(function (s) { return s.userId !== u.userId; }));
  log_(ctx.username, 'resetPassword', nisn);
  return { ok: true };
}

function getKartu_(p, ctx) {
  const nisn = ctx.role === 'admin' ? String(p.nisn || '') : ctx.nisn;
  const m = activeMembers_().filter(function (x) { return x.nisn === nisn; })[0];
  if (!m) throw new AppError('Anggota tidak ditemukan', 'NOTFOUND');
  const s = readTable_('Siswa').filter(function (x) { return x.nisn === nisn; })[0] || {};
  const u = readTable_('Users').filter(function (x) { return x.role === 'anggota' && x.nisn === nisn; })[0] || {};
  return { nisn: m.nisn, nama: m.nama, jk: m.jk, kelas: m.kelas, tglBergabung: m.tglBergabung, tempatLahir: s.tempatLahir || '', tglLahir: s.tglLahir || '', fotoUrl: u.fotoUrl || '' };
}

/* ===================== PRESENSI & IURAN ===================== */
function meetingsIn_(tr) {
  return readTable_('Pertemuan').filter(function (m) { return inRange_(m.tanggal, tr); }).sort(function (a, b) { return a.tanggal < b.tanggal ? -1 : 1; });
}

function idSet_(arr) { const s = {}; arr.forEach(function (x) { s[x.id] = true; }); return s; }

function listPertemuan_(p) {
  const tr = termRange_(p.term);
  const ms = meetingsIn_(tr);
  const ids = idSet_(ms);
  const agg = {};
  readTable_('Presensi').forEach(function (x) {
    if (!ids[x.pertemuanId]) return;
    const a = agg[x.pertemuanId] || (agg[x.pertemuanId] = { hadir: 0, total: 0, iuranTotal: 0 });
    a.total++;
    if (x.status === 'H') a.hadir++;
    a.iuranTotal += Number(x.iuran) || 0;
  });
  return ms.map(function (m) {
    const a = agg[m.id] || { hadir: 0, total: 0, iuranTotal: 0 };
    return { id: m.id, tanggal: m.tanggal, keterangan: m.keterangan, iuran: Number(m.iuran), hadir: a.hadir, total: a.total, iuranTotal: a.iuranTotal };
  }).reverse();
}

function getPresensi_(p) {
  const tanggal = String(p.tanggal || '');
  if (!validDate_(tanggal)) throw new AppError('Tanggal tidak valid', 'VALID');
  const pert = readTable_('Pertemuan').filter(function (m) { return m.tanggal === tanggal; })[0] || null;
  const nominal = pert ? Number(pert.iuran) : Number(getSettings_().iuranPerPertemuan);
  const rows = {};
  if (pert) readTable_('Presensi').forEach(function (x) { if (x.pertemuanId === pert.id) rows[x.nisn] = x; });
  const anggota = activeMembers_().map(function (m) {
    const r = rows[m.nisn];
    return { nisn: m.nisn, nama: m.nama, kelas: m.kelas, status: r ? r.status : 'H', iuran: r ? Number(r.iuran) : nominal };
  });
  return { pertemuan: pert ? { id: pert.id, tanggal: pert.tanggal, keterangan: pert.keterangan } : null, tanggal: tanggal, nominal: nominal, anggota: anggota };
}

function savePresensi_(p, ctx) {
  const tanggal = String(p.tanggal || '');
  if (!validDate_(tanggal)) throw new AppError('Tanggal tidak valid', 'VALID');
  const items = Array.isArray(p.items) ? p.items : [];
  if (!items.length) throw new AppError('Tidak ada data presensi', 'VALID');
  const members = mapBy_(activeMembers_(), 'nisn');
  const pert = readTable_('Pertemuan');
  let cur = pert.filter(function (m) { return m.tanggal === tanggal; })[0];
  const nominal = cur ? Number(cur.iuran) : Number(getSettings_().iuranPerPertemuan);
  if (!cur) {
    cur = { id: newId_('P'), tanggal: tanggal, tahunAjaran: termOf_(tanggal), keterangan: '', iuran: nominal, createdAt: now_() };
    pert.push(cur);
  }
  cur.keterangan = str_(p.keterangan, 100);
  const pres = readTable_('Presensi');
  const keep = pres.filter(function (x) { return x.pertemuanId !== cur.id || !members[x.nisn]; });
  const seen = {};
  let iuranTotal = 0;
  let hadir = 0;
  items.forEach(function (it) {
    const nisn = String(it.nisn);
    const st = String(it.status);
    if (!members[nisn]) throw new AppError('NISN ' + nisn + ' bukan anggota aktif', 'VALID');
    if (['H', 'S', 'I', 'A'].indexOf(st) < 0) throw new AppError('Status presensi harus H, S, I, atau A', 'VALID');
    if (seen[nisn]) return;
    seen[nisn] = true;
    const iur = st === 'H' ? nominal : 0;
    iuranTotal += iur;
    if (st === 'H') hadir++;
    keep.push({ pertemuanId: cur.id, nisn: nisn, status: st, iuran: iur });
  });
  writeTable_('Pertemuan', pert);
  writeTable_('Presensi', keep);
  log_(ctx.username, 'savePresensi', tanggal + ' hadir ' + hadir);
  return { id: cur.id, iuranTotal: iuranTotal, hadir: hadir };
}

function deletePertemuan_(p, ctx) {
  const id = String(p.id || '');
  const pert = readTable_('Pertemuan');
  if (!pert.some(function (m) { return m.id === id; })) throw new AppError('Pertemuan tidak ditemukan', 'NOTFOUND');
  writeTable_('Pertemuan', pert.filter(function (m) { return m.id !== id; }));
  writeTable_('Presensi', readTable_('Presensi').filter(function (x) { return x.pertemuanId !== id; }));
  log_(ctx.username, 'deletePertemuan', id);
  return { ok: true };
}

function monthCheck_(term, bulan) {
  const tr = termRange_(term);
  if (tr.months.indexOf(String(bulan)) < 0) throw new AppError('Bulan berada di luar tahun ajaran terpilih', 'VALID');
  return tr;
}

function scopeMembers_(ctx) {
  const all = activeMembers_();
  return ctx.role === 'admin' ? all : all.filter(function (m) { return m.nisn === ctx.nisn; });
}

function rekapHadir_(p, ctx) {
  monthCheck_(p.term, p.bulan);
  const ms = readTable_('Pertemuan').filter(function (m) { return m.tanggal.slice(0, 7) === p.bulan; }).sort(function (a, b) { return a.tanggal < b.tanggal ? -1 : 1; });
  const ids = idSet_(ms);
  const pres = readTable_('Presensi').filter(function (x) { return ids[x.pertemuanId]; });
  const members = scopeMembers_(ctx);
  const rows = members.map(function (m) {
    const c = { H: 0, S: 0, I: 0, A: 0 };
    pres.forEach(function (x) { if (x.nisn === m.nisn && c[x.status] !== undefined) c[x.status]++; });
    return { nisn: m.nisn, nama: m.nama, kelas: m.kelas, H: c.H, S: c.S, I: c.I, A: c.A, persen: ms.length ? round1_(c.H / ms.length * 100) : 0 };
  });
  let detail = [];
  if (ctx.role !== 'admin') {
    const mine = {};
    pres.forEach(function (x) { if (x.nisn === ctx.nisn) mine[x.pertemuanId] = x.status; });
    detail = ms.filter(function (m) { return mine[m.id]; }).map(function (m) { return { tanggal: m.tanggal, keterangan: m.keterangan, status: mine[m.id] }; });
  }
  return { bulan: p.bulan, totalPertemuan: ms.length, rows: rows, detail: detail };
}

function rekapIuran_(p, ctx) {
  monthCheck_(p.term, p.bulan);
  const ms = readTable_('Pertemuan').filter(function (m) { return m.tanggal.slice(0, 7) === p.bulan; }).sort(function (a, b) { return a.tanggal < b.tanggal ? -1 : 1; });
  const ids = idSet_(ms);
  const pres = readTable_('Presensi').filter(function (x) { return ids[x.pertemuanId]; });
  const per = ms.length ? Number(ms[ms.length - 1].iuran) : Number(getSettings_().iuranPerPertemuan);
  const members = scopeMembers_(ctx);
  const rows = members.map(function (m) {
    let n = 0, tot = 0;
    pres.forEach(function (x) { if (x.nisn === m.nisn) { if (x.status === 'H') n++; tot += Number(x.iuran) || 0; } });
    return { nisn: m.nisn, nama: m.nama, kelas: m.kelas, perPertemuan: per, jumlahBayar: n, total: tot };
  });
  let totalKas = 0;
  if (ctx.role === 'admin') pres.forEach(function (x) { totalKas += Number(x.iuran) || 0; });
  let detail = [];
  if (ctx.role !== 'admin') {
    const mine = {};
    pres.forEach(function (x) { if (x.nisn === ctx.nisn) mine[x.pertemuanId] = x; });
    detail = ms.filter(function (m) { return mine[m.id]; }).map(function (m) { return { tanggal: m.tanggal, status: mine[m.id].status, iuran: Number(mine[m.id].iuran) }; });
  }
  return { bulan: p.bulan, totalPertemuan: ms.length, totalKas: totalKas, rows: rows, detail: detail };
}

/* ===================== NILAI ===================== */
function predikat_(total, cfg) {
  const t = Number(total);
  if (t >= Number(cfg.batasA)) return 'A';
  if (t >= Number(cfg.batasB)) return 'B';
  if (t >= Number(cfg.batasC)) return 'C';
  return 'D';
}

function calcTotal_(persen, kemampuan, cfg) {
  return round1_((Number(persen) * Number(cfg.bobotHadir) + Number(kemampuan) * Number(cfg.bobotIndividu)) / 100);
}

function nilaiRows_(term) {
  const tr = termRange_(term);
  const cfg = getSettings_();
  const ms = meetingsIn_(tr);
  const ids = idSet_(ms);
  const hadir = {};
  readTable_('Presensi').forEach(function (x) { if (ids[x.pertemuanId] && x.status === 'H') hadir[x.nisn] = (hadir[x.nisn] || 0) + 1; });
  const saved = {};
  readTable_('Nilai').forEach(function (n) { if (n.tahunAjaran === term) saved[n.nisn] = n; });
  const rows = activeMembers_().map(function (m) {
    const h = hadir[m.nisn] || 0;
    const persen = ms.length ? round1_(h / ms.length * 100) : 0;
    const sv = saved[m.nisn];
    const kem = sv && sv.kemampuan !== '' ? sv.kemampuan : '';
    const tot = kem === '' ? '' : calcTotal_(persen, kem, cfg);
    return { nisn: m.nisn, nama: m.nama, kelas: m.kelas, hadir: h, persenHadir: persen, kemampuan: kem, total: tot, predikat: tot === '' ? '-' : predikat_(tot, cfg) };
  });
  return { term: term, totalPertemuan: ms.length, rows: rows };
}

function listNilai_(p) { return nilaiRows_(p.term); }

function saveNilai_(p, ctx) {
  termRange_(p.term);
  const items = Array.isArray(p.items) ? p.items : [];
  const cur = nilaiRows_(p.term);
  const byN = mapBy_(cur.rows, 'nisn');
  const cfg = getSettings_();
  const all = readTable_('Nilai');
  const keep = all.filter(function (n) { return n.tahunAjaran !== p.term; });
  const old = {};
  all.forEach(function (n) { if (n.tahunAjaran === p.term) old[n.nisn] = n; });
  const seen = {};
  items.forEach(function (it) {
    const nisn = String(it.nisn);
    const row = byN[nisn];
    if (!row) throw new AppError('NISN ' + nisn + ' bukan anggota aktif', 'VALID');
    seen[nisn] = true;
    if (it.kemampuan === '' || it.kemampuan === null || it.kemampuan === undefined) return;
    const k = Number(it.kemampuan);
    if (!isFinite(k) || k < 0 || k > 100) throw new AppError('Nilai kemampuan harus 0-100', 'VALID');
    const tot = calcTotal_(row.persenHadir, k, cfg);
    keep.push({ nisn: nisn, tahunAjaran: p.term, persenHadir: row.persenHadir, kemampuan: k, total: tot, predikat: predikat_(tot, cfg), updatedAt: now_() });
  });
  Object.keys(old).forEach(function (n) { if (!seen[n]) keep.push(old[n]); });
  writeTable_('Nilai', keep);
  log_(ctx.username, 'saveNilai', p.term);
  return nilaiRows_(p.term);
}

/* ===================== JADWAL & FORMASI ===================== */
function sortJadwal_(a, b) { return (a.tanggal + a.jam) < (b.tanggal + b.jam) ? -1 : 1; }

function jadwalOut_(j) { return { id: j.id, tanggal: j.tanggal, jam: j.jam, lawan: j.lawan, lokasi: j.lokasi, jenis: j.jenis, catatan: j.catatan }; }

function listJadwal_(p) {
  const tr = termRange_(p.term);
  return readTable_('Jadwal').filter(function (j) { return inRange_(j.tanggal, tr); }).sort(sortJadwal_).map(jadwalOut_);
}

function saveJadwal_(p, ctx) {
  const j = p.jadwal || {};
  const o = { id: String(j.id || ''), tanggal: String(j.tanggal || '').trim(), jam: String(j.jam || '').trim(), lawan: str_(j.lawan, 60), lokasi: str_(j.lokasi, 80), jenis: str_(j.jenis, 20), catatan: str_(j.catatan, 200) };
  if (!validDate_(o.tanggal)) throw new AppError('Tanggal tidak valid', 'VALID');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(o.jam)) throw new AppError('Jam harus berformat HH:mm', 'VALID');
  if (!o.lawan) throw new AppError('Nama lawan wajib diisi', 'VALID');
  if (JENIS_OK.indexOf(o.jenis) < 0) o.jenis = 'Persahabatan';
  const rows = readTable_('Jadwal');
  if (o.id) {
    const i = rows.findIndex(function (x) { return x.id === o.id; });
    if (i < 0) throw new AppError('Jadwal tidak ditemukan', 'NOTFOUND');
    o.createdAt = rows[i].createdAt;
    rows[i] = o;
  } else {
    o.id = newId_('J');
    o.createdAt = now_();
    rows.push(o);
  }
  writeTable_('Jadwal', rows);
  log_(ctx.username, 'saveJadwal', o.tanggal + ' vs ' + o.lawan);
  return { id: o.id };
}

function deleteJadwal_(p, ctx) {
  const id = String(p.id || '');
  const rows = readTable_('Jadwal');
  if (!rows.some(function (x) { return x.id === id; })) throw new AppError('Jadwal tidak ditemukan', 'NOTFOUND');
  writeTable_('Jadwal', rows.filter(function (x) { return x.id !== id; }));
  writeTable_('Formasi', readTable_('Formasi').filter(function (f) { return f.jadwalId !== id; }));
  log_(ctx.username, 'deleteJadwal', id);
  return { ok: true };
}

function upcoming_() {
  const t0 = today_();
  const t1 = Utilities.formatDate(new Date(Date.now() + 14 * 86400000), APP.TZ, 'yyyy-MM-dd');
  return readTable_('Jadwal').filter(function (j) { return j.tanggal >= t0 && j.tanggal <= t1; }).sort(sortJadwal_).map(jadwalOut_);
}

function parseJson_(s, fallback) { try { const v = JSON.parse(s); return v === null ? fallback : v; } catch (e) { return fallback; } }

function formasiView_(jadwal, row) {
  const lineup = row ? parseJson_(row.lineup, {}) : {};
  const cad = row ? parseJson_(row.cadangan, []) : [];
  const names = {};
  const siswa = mapBy_(readTable_('Siswa'), 'nisn');
  Object.keys(lineup).forEach(function (k) { if (lineup[k] && siswa[lineup[k]]) names[lineup[k]] = siswa[lineup[k]].nama; });
  cad.forEach(function (n) { if (siswa[n]) names[n] = siswa[n].nama; });
  return { jadwal: jadwalOut_(jadwal), pola: row ? row.pola : '1-2-1', lineup: lineup, cadangan: cad, names: names };
}

function getFormasi_(p) {
  const jadwal = readTable_('Jadwal').filter(function (j) { return j.id === String(p.jadwalId); })[0];
  if (!jadwal) throw new AppError('Jadwal tidak ditemukan', 'NOTFOUND');
  const row = readTable_('Formasi').filter(function (f) { return f.jadwalId === jadwal.id; })[0] || null;
  const v = formasiView_(jadwal, row);
  v.anggota = activeMembers_().map(function (m) { return { nisn: m.nisn, nama: m.nama, kelas: m.kelas }; });
  return v;
}

function saveFormasi_(p, ctx) {
  const jadwal = readTable_('Jadwal').filter(function (j) { return j.id === String(p.jadwalId); })[0];
  if (!jadwal) throw new AppError('Jadwal tidak ditemukan', 'NOTFOUND');
  if (POLA_OK.indexOf(p.pola) < 0) throw new AppError('Pola formasi tidak valid', 'VALID');
  const members = mapBy_(activeMembers_(), 'nisn');
  const src = p.lineup || {};
  const lineup = {};
  const used = {};
  for (let i = 0; i < 5; i++) {
    const v = String(src['s' + i] || '');
    if (v) {
      if (!members[v]) throw new AppError('Pemain pada posisi ' + (i + 1) + ' bukan anggota aktif', 'VALID');
      if (used[v]) throw new AppError('Satu pemain tidak boleh menempati dua posisi', 'VALID');
      used[v] = true;
    }
    lineup['s' + i] = v;
  }
  const cad = [];
  (Array.isArray(p.cadangan) ? p.cadangan : []).forEach(function (n) {
    n = String(n);
    if (!members[n] || used[n] || cad.indexOf(n) >= 0) return;
    cad.push(n);
  });
  const rows = readTable_('Formasi').filter(function (f) { return f.jadwalId !== jadwal.id; });
  rows.push({ jadwalId: jadwal.id, pola: p.pola, lineup: JSON.stringify(lineup), cadangan: JSON.stringify(cad), updatedAt: now_() });
  writeTable_('Formasi', rows);
  log_(ctx.username, 'saveFormasi', jadwal.id);
  return { ok: true };
}

/* ===================== PENGELUARAN & KEUANGAN ===================== */
function listPengeluaran_(p) {
  const tr = termRange_(p.term);
  return readTable_('Pengeluaran').filter(function (x) { return inRange_(x.tanggal, tr); }).sort(function (a, b) { return a.tanggal < b.tanggal ? 1 : -1; }).map(function (x) {
    return { id: x.id, tanggal: x.tanggal, keterangan: x.keterangan, nominal: Number(x.nominal), jumlah: Number(x.jumlah), total: Number(x.total), buktiUrl: x.buktiUrl };
  });
}

function savePengeluaran_(p, ctx) {
  const it = p.item || {};
  const tanggal = String(it.tanggal || '').trim();
  const nominal = Number(it.nominal);
  const jumlah = Number(it.jumlah);
  if (!validDate_(tanggal)) throw new AppError('Tanggal tidak valid', 'VALID');
  const ket = str_(it.keterangan, 150);
  if (!ket) throw new AppError('Keterangan wajib diisi', 'VALID');
  if (!isFinite(nominal) || nominal < 1 || nominal > 1000000000 || Math.floor(nominal) !== nominal) throw new AppError('Nominal harus bilangan bulat lebih dari 0', 'VALID');
  if (!isFinite(jumlah) || jumlah < 1 || jumlah > 100000 || Math.floor(jumlah) !== jumlah) throw new AppError('Jumlah harus bilangan bulat lebih dari 0', 'VALID');
  const rows = readTable_('Pengeluaran');
  let row;
  if (it.id) {
    row = rows.filter(function (x) { return x.id === String(it.id); })[0];
    if (!row) throw new AppError('Data pengeluaran tidak ditemukan', 'NOTFOUND');
  } else {
    row = { id: newId_('X'), buktiUrl: '', createdAt: now_() };
    rows.push(row);
  }
  row.tanggal = tanggal;
  row.keterangan = ket;
  row.nominal = nominal;
  row.jumlah = jumlah;
  row.total = nominal * jumlah;
  const b = p.bukti;
  if (b && b.data) {
    const mime = String(b.mime || '');
    if (['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].indexOf(mime) < 0) throw new AppError('Bukti harus JPG, PNG, WEBP, atau PDF', 'VALID');
    if (String(b.data).length > 5600000) throw new AppError('Ukuran bukti maksimal 4 MB', 'VALID');
    const ext = mime === 'application/pdf' ? 'pdf' : mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const file = saveFile_(rawSettings_().folderBukti, 'bukti_' + tanggal + '_' + row.id + '.' + ext, mime, b.data);
    if (row.buktiUrl) trashByUrl_(row.buktiUrl);
    row.buktiUrl = file.getUrl();
  }
  writeTable_('Pengeluaran', rows);
  log_(ctx.username, 'savePengeluaran', ket + ' ' + row.total);
  return { id: row.id, total: row.total };
}

function deletePengeluaran_(p, ctx) {
  const rows = readTable_('Pengeluaran');
  const row = rows.filter(function (x) { return x.id === String(p.id); })[0];
  if (!row) throw new AppError('Data pengeluaran tidak ditemukan', 'NOTFOUND');
  writeTable_('Pengeluaran', rows.filter(function (x) { return x.id !== row.id; }));
  if (row.buktiUrl) trashByUrl_(row.buktiUrl);
  log_(ctx.username, 'deletePengeluaran', row.id);
  return { ok: true };
}

function financeData_() {
  const meetDate = {};
  readTable_('Pertemuan').forEach(function (m) { meetDate[m.id] = m.tanggal; });
  const incomes = [];
  readTable_('Presensi').forEach(function (x) {
    const t = meetDate[x.pertemuanId];
    if (t && Number(x.iuran) > 0) incomes.push({ tanggal: t, nominal: Number(x.iuran) });
  });
  const spends = readTable_('Pengeluaran').map(function (x) { return { tanggal: x.tanggal, nominal: Number(x.total) }; });
  return { incomes: incomes, spends: spends };
}

function sumBefore_(arr, from) { let s = 0; arr.forEach(function (x) { if (x.tanggal < from) s += x.nominal; }); return s; }

function kasOf_(term, fin) {
  const tr = termRange_(term);
  const saldoAwal = (Number(getSettings_().saldoAwalKas) || 0) + sumBefore_(fin.incomes, tr.from) - sumBefore_(fin.spends, tr.from);
  let saldo = saldoAwal, tm = 0, tk = 0;
  const rows = tr.months.map(function (b) {
    let masuk = 0, keluar = 0;
    fin.incomes.forEach(function (x) { if (x.tanggal.slice(0, 7) === b) masuk += x.nominal; });
    fin.spends.forEach(function (x) { if (x.tanggal.slice(0, 7) === b) keluar += x.nominal; });
    saldo += masuk - keluar;
    tm += masuk; tk += keluar;
    return { bulan: b, masuk: masuk, keluar: keluar, saldo: saldo };
  });
  return { saldoAwal: saldoAwal, rows: rows, totalMasuk: tm, totalKeluar: tk, saldoAkhir: saldo };
}

function rekapKas_(p) { return kasOf_(p.term, financeData_()); }

/* ===================== DASHBOARD ===================== */
function rp_(n) { return 'Rp' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

function upcomingInTerm_(tr) {
  const t0 = today_();
  return readTable_('Jadwal').filter(function (j) { return inRange_(j.tanggal, tr) && j.tanggal >= t0; }).sort(sortJadwal_);
}

function firstFormasi_(list) {
  const rows = mapBy_(readTable_('Formasi'), 'jadwalId');
  for (let i = 0; i < list.length; i++) {
    if (rows[list[i].id]) return formasiView_(list[i], rows[list[i].id]);
  }
  return null;
}

function dashboard_(p, ctx) {
  const tr = termRange_(p.term);
  const up = upcomingInTerm_(tr);
  const ms = meetingsIn_(tr);
  const ids = idSet_(ms);
  const presAll = readTable_('Presensi');
  const presTerm = presAll.filter(function (x) { return ids[x.pertemuanId]; });
  const formasi = firstFormasi_(up);
  const base = { role: ctx.role, jadwal: up.slice(0, 3).map(jadwalOut_), formasi: formasi };

  if (ctx.role === 'admin') {
    const fin = financeData_();
    const kas = kasOf_(p.term, fin);
    const keh = { H: 0, S: 0, I: 0, A: 0 };
    let pemasukan = 0;
    presTerm.forEach(function (x) { if (keh[x.status] !== undefined) keh[x.status]++; pemasukan += Number(x.iuran) || 0; });
    const act = [];
    const hadirBy = {};
    const totalBy = {};
    presAll.forEach(function (x) { totalBy[x.pertemuanId] = (totalBy[x.pertemuanId] || 0) + 1; if (x.status === 'H') hadirBy[x.pertemuanId] = (hadirBy[x.pertemuanId] || 0) + 1; });
    readTable_('Pertemuan').forEach(function (m) { act.push({ tipe: 'Presensi', teks: 'Presensi ' + m.tanggal + ': ' + (hadirBy[m.id] || 0) + ' dari ' + (totalBy[m.id] || 0) + ' hadir', waktu: m.createdAt }); });
    readTable_('Pengeluaran').forEach(function (x) { act.push({ tipe: 'Kas', teks: 'Pengeluaran ' + x.keterangan + ' ' + rp_(x.total), waktu: x.createdAt }); });
    readTable_('Jadwal').forEach(function (j) { act.push({ tipe: 'Jadwal', teks: 'Jadwal vs ' + j.lawan + ' (' + j.tanggal + ')', waktu: j.createdAt }); });
    act.sort(function (a, b) { return a.waktu < b.waktu ? 1 : -1; });
    base.stats = { anggota: activeMembers_().length, jadwalMendatang: up.length, pemasukan: pemasukan, saldo: kas.saldoAkhir };
    base.kehadiran = keh;
    base.kas = kas.rows.map(function (r) { return { bulan: r.bulan, masuk: r.masuk, keluar: r.keluar }; });
    base.aktivitas = act.slice(0, 6);
    return base;
  }

  const me = ctx.nisn;
  const mine = presTerm.filter(function (x) { return x.nisn === me; });
  const keh = { H: 0, S: 0, I: 0, A: 0 };
  mine.forEach(function (x) { if (keh[x.status] !== undefined) keh[x.status]++; });
  const persen = ms.length ? round1_(keh.H / ms.length * 100) : 0;
  const sv = readTable_('Nilai').filter(function (n) { return n.nisn === me && n.tahunAjaran === p.term; })[0];
  const tren = [];
  tr.months.forEach(function (b) {
    const mm = ms.filter(function (m) { return m.tanggal.slice(0, 7) === b; });
    if (!mm.length) return;
    const mid = idSet_(mm);
    const h = mine.filter(function (x) { return mid[x.pertemuanId] && x.status === 'H'; }).length;
    tren.push({ bulan: b, persen: round1_(h / mm.length * 100) });
  });
  const dateOf = {};
  readTable_('Pertemuan').forEach(function (m) { dateOf[m.id] = m.tanggal; });
  const LBL = { H: 'Hadir', S: 'Sakit', I: 'Izin', A: 'Alpa' };
  const act = presAll.filter(function (x) { return x.nisn === me && dateOf[x.pertemuanId]; }).map(function (x) { return { tipe: 'Presensi', teks: 'Latihan ' + dateOf[x.pertemuanId] + ': ' + LBL[x.status], waktu: dateOf[x.pertemuanId] + 'T00:00:00' }; });
  readTable_('Jadwal').forEach(function (j) { act.push({ tipe: 'Jadwal', teks: 'Jadwal vs ' + j.lawan + ' (' + j.tanggal + ')', waktu: j.createdAt }); });
  act.sort(function (a, b) { return a.waktu < b.waktu ? 1 : -1; });
  base.stats = { persenHadir: persen, hadir: keh.H, totalPertemuan: ms.length, jadwalMendatang: up.length, nilai: sv ? { total: sv.total, predikat: sv.predikat } : null };
  base.kehadiran = keh;
  base.tren = tren;
  base.aktivitas = act.slice(0, 6);
  return base;
}
