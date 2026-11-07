/**
 * Spansa Futsal Club - Layanan File Google Drive (tipis)
 * Database sudah pindah ke Firebase. Skrip ini HANYA mengurus berkas di Google Drive:
 *   upload  : simpan foto profil / bukti kas / foto galeri
 *   trash   : buang berkas ke tempat sampah
 *   imageData : ubah gambar Google menjadi data URL (untuk unduh kartu/nota)
 * Setiap permintaan wajib membawa Firebase ID token yang diverifikasi ke Firebase.
 *
 * Script Properties yang dibutuhkan:
 *   FIREBASE_API_KEY  = Web API Key proyek Firebase (sama dengan VITE_FIREBASE_API_KEY)
 *   FOLDER_FOTO, FOLDER_BUKTI, FOLDER_GALERI = ID folder (dibuat otomatis oleh setupFolders())
 */
const API_VERSION = '2026.11.07-drive';
const MAX_BYTES_B64 = 5600000;

function AppError(message, code) { this.message = message; this.code = code || 'ERR'; }

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'Spansa Futsal Club - layanan file Drive aktif', version: API_VERSION }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return out_({ success: false, message: 'Permintaan tidak valid', data: null }); }
  try {
    const user = verify_(String(req.idToken || ''));
    const p = req.params || {};
    let data;
    switch (String(req.action)) {
      case 'upload': data = upload_(p, user); break;
      case 'trash': data = trash_(p, user); break;
      case 'imageData': data = imageData_(p); break;
      default: throw new AppError('Aksi tidak dikenal', 'NOACTION');
    }
    return out_({ success: true, message: 'OK', data: data });
  } catch (err) {
    if (err instanceof AppError) return out_({ success: false, message: err.message, code: err.code, data: null });
    console.error(err && err.stack ? err.stack : String(err));
    return out_({ success: false, message: 'Terjadi kesalahan pada layanan file. Silakan coba lagi.', code: 'SERVER', data: null });
  }
}

function out_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k) || ''; }

/* ---------- Verifikasi Firebase ID token ---------- */
function verify_(token) {
  if (!token) throw new AppError('Sesi tidak valid. Silakan login ulang.', 'AUTH');
  const key = prop_('FIREBASE_API_KEY');
  if (!key) throw new AppError('FIREBASE_API_KEY belum diatur di Script Properties.', 'SETUP');
  const cache = CacheService.getScriptCache();
  const ck = 'tok_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token)).slice(0, 40);
  const hit = cache.get(ck);
  if (hit) return JSON.parse(hit);
  const res = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(key), {
    method: 'post', contentType: 'application/json', payload: JSON.stringify({ idToken: token }), muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) throw new AppError('Sesi berakhir. Silakan login ulang.', 'AUTH');
  const u = (JSON.parse(res.getContentText()).users || [])[0];
  if (!u || u.disabled) throw new AppError('Akun tidak aktif.', 'AUTH');
  let claims = {};
  try { claims = JSON.parse(u.customAttributes || '{}'); } catch (e) { claims = {}; }
  if (claims.role !== 'admin' && claims.role !== 'anggota') throw new AppError('Akun belum disiapkan oleh admin.', 'AUTH');
  const user = { uid: u.localId, role: claims.role, nisn: claims.nisn || '' };
  cache.put(ck, JSON.stringify(user), 300);
  return user;
}

/* ---------- Folder ---------- */
const KINDS = {
  foto: { prop: 'FOLDER_FOTO', admin: false, mimes: ['image/jpeg'], max: 600000 },
  bukti: { prop: 'FOLDER_BUKTI', admin: true, mimes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], max: MAX_BYTES_B64 },
  galeri: { prop: 'FOLDER_GALERI', admin: true, mimes: ['image/jpeg', 'image/png', 'image/webp'], max: 900000 }
};

function folderIds_() { return [prop_('FOLDER_FOTO'), prop_('FOLDER_BUKTI'), prop_('FOLDER_GALERI')].filter(String); }

function fileId_(url) {
  const m = /\/d\/([-\w]{20,})/.exec(String(url || '')) || /[?&]id=([-\w]{20,})/.exec(String(url || ''));
  return m ? m[1] : '';
}

function inAppFolder_(file, onlyFolder) {
  const allowed = onlyFolder ? [onlyFolder] : folderIds_();
  const it = file.getParents();
  while (it.hasNext()) { if (allowed.indexOf(it.next().getId()) >= 0) return true; }
  return false;
}

function upload_(p, user) {
  const k = KINDS[String(p.kind)];
  if (!k) throw new AppError('Jenis berkas tidak dikenal', 'VALID');
  if (k.admin && user.role !== 'admin') throw new AppError('Anda tidak memiliki akses ke fitur ini', 'FORBIDDEN');
  const mime = String(p.mime || '');
  if (k.mimes.indexOf(mime) < 0) throw new AppError('Jenis berkas tidak diizinkan', 'VALID');
  const b64 = String(p.data || '');
  if (!b64 || b64.length > k.max) throw new AppError('Ukuran berkas melebihi batas', 'VALID');
  const folderId = prop_(k.prop);
  if (!folderId) throw new AppError('Folder Drive belum disiapkan. Jalankan setupFolders() di editor Apps Script.', 'SETUP');
  let bytes;
  try { bytes = Utilities.base64Decode(b64); } catch (e) { throw new AppError('Data berkas tidak valid', 'VALID'); }
  const name = String(p.name || 'berkas').replace(/[^\w.\- ]/g, '_').slice(0, 120);
  const file = DriveApp.getFolderById(folderId).createFile(Utilities.newBlob(bytes, mime, name));
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {
    file.setTrashed(true);
    throw new AppError('Berkas tidak dapat dibagikan. Periksa kebijakan berbagi Google Workspace sekolah.', 'DRIVE');
  }
  if (p.replaceUrl) trashFile_(p.replaceUrl, user, k.admin ? '' : folderId);
  return { fileId: file.getId(), url: file.getUrl() };
}

/* Hanya berkas di folder milik aplikasi yang boleh dibuang; anggota hanya folder foto profil. */
function trashFile_(url, user, onlyFolder) {
  const id = fileId_(url);
  if (!id) return false;
  try {
    const f = DriveApp.getFileById(id);
    if (!inAppFolder_(f, onlyFolder)) return false;
    f.setTrashed(true);
    return true;
  } catch (e) { return false; }
}

function trash_(p, user) {
  const only = user.role === 'admin' ? '' : prop_('FOLDER_FOTO');
  return { ok: trashFile_(p.url, user, only) };
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

/* ---------- SETUP: jalankan sekali dari editor ---------- */
function setupFolders() {
  const it = DriveApp.getFoldersByName('Spansa Futsal Club');
  const root = it.hasNext() ? it.next() : DriveApp.createFolder('Spansa Futsal Club');
  const sub = function (n) { const i = root.getFoldersByName(n); return i.hasNext() ? i.next() : root.createFolder(n); };
  const props = PropertiesService.getScriptProperties();
  props.setProperty('FOLDER_FOTO', sub('Foto Profil').getId());
  props.setProperty('FOLDER_BUKTI', sub('Bukti Pengeluaran').getId());
  props.setProperty('FOLDER_GALERI', sub('Galeri').getId());
  Logger.log('Folder siap. Jika folder lama "Spansa Futsal Club" ada di Drive yang sama, folder itu dipakai ulang.');
  Logger.log('Pastikan Script Property FIREBASE_API_KEY sudah diisi.');
}
