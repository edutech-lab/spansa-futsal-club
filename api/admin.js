/* Vercel Function: operasi akun yang membutuhkan Firebase Admin SDK.
   Hanya dapat dipanggil oleh admin (ID token + Custom Claim role=admin). */
import { createHash, timingSafeEqual } from 'node:crypto';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const DOMAIN = 'spansa.club';

function normKey(raw) {
  let k = String(raw || '').trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) k = k.slice(1, -1);
  return k.replace(/\\n/g, '\n').replace(/\r/g, '');
}

function init() {
  if (getApps().length) return;
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) throw new Fail('Variabel FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, dan FIREBASE_PRIVATE_KEY belum diisi di Vercel.', 'SETUP', 500);
  try {
    initializeApp({ credential: cert({ projectId: FIREBASE_PROJECT_ID.trim(), clientEmail: FIREBASE_CLIENT_EMAIL.trim(), privateKey: normKey(FIREBASE_PRIVATE_KEY) }) });
  } catch (e) {
    throw new Fail('FIREBASE_PRIVATE_KEY di Vercel tidak valid (format kunci rusak). Salin ulang private_key dari file JSON service account apa adanya, lalu redeploy.', 'SETUP', 500);
  }
}

/* Terjemahkan error Firebase Admin ke pesan yang bisa ditindaklanjuti. */
function explain(e) {
  const code = String((e && e.code) || '');
  const msg = String((e && e.message) || '');
  if (code === 'auth/configuration-not-found' || /CONFIGURATION_NOT_FOUND/.test(msg)) return 'Firebase Authentication belum diaktifkan. Buka Firebase Console > Authentication > Get started, lalu aktifkan provider Email/Password.';
  if (code === 'auth/operation-not-allowed') return 'Provider Email/Password belum diaktifkan di Firebase Authentication.';
  if (code === 'auth/password-does-not-meet-requirements' || code === 'auth/invalid-password') return 'Password awal (NISN) ditolak oleh kebijakan password Firebase. Matikan kebijakan password yang ketat di Authentication > Settings > Password policy.';
  if (code === 'auth/email-already-exists') return 'Email akun untuk NISN ini sudah dipakai akun lain di Firebase Authentication.';
  if (code === 'auth/insufficient-permission' || code === 'auth/internal-error' && /permission/i.test(msg)) return 'Service account tidak punya izin Firebase Authentication. Beri peran "Firebase Authentication Admin" pada service account.';
  if (code === 'auth/too-many-requests' || code === 'auth/quota-exceeded') return 'Terlalu banyak permintaan ke Firebase Authentication. Tunggu beberapa menit lalu coba lagi.';
  if (code === '7' || /PERMISSION_DENIED/.test(msg)) return 'Service account tidak punya izin ke Cloud Firestore. Beri peran "Cloud Datastore User" (atau Firebase Admin SDK Administrator) pada service account.';
  if (code === '5' || /NOT_FOUND/.test(msg)) return 'Database Cloud Firestore belum dibuat atau bukan database default "(default)".';
  if (/undefined/.test(msg) && /Firestore/i.test(msg)) return 'Data siswa tidak lengkap (ada field kosong). Lengkapi nama siswa di menu Data Siswa.';
  return 'Kesalahan tak terduga' + (code ? ' (' + code + ')' : '') + ': ' + msg.slice(0, 160);
}

class Fail extends Error { constructor(message, code, status) { super(message); this.code = code; this.status = status || 400; } }

const emailOf = (nisn) => nisn + '@' + DOMAIN;
const nowIso = () => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T');
const listOf = (p) => {
  const a = Array.isArray(p.nisns) ? p.nisns.map(String) : [];
  if (!a.length || a.length > 300 || a.some((n) => !/^\d{6,20}$/.test(n))) throw new Fail('Daftar NISN tidak valid (6-20 digit, maksimal 300)', 'VALID');
  return a;
};
const notFound = (e) => e && e.code === 'auth/user-not-found';

/* Menyiapkan satu akun anggota (idempotent): buat bila belum ada, aktifkan, pasang claims, tulis dokumen users.
   Password akun yang sudah ada TIDAK diubah. Mengembalikan 'dibuat' atau 'diaktifkan'. */
async function ensureOne(n, db, auth) {
  if (!/^\d{6,20}$/.test(n)) throw new Fail('NISN ' + n + ' tidak valid untuk akun login (harus 6-20 digit angka). Perbaiki di Data Siswa.', 'VALID');
  const [sis, ang] = await Promise.all([db.collection('siswa').doc(n).get(), db.collection('anggota').doc(n).get()]);
  if (!sis.exists || !ang.exists) throw new Fail('NISN ' + n + ' belum terdaftar sebagai siswa/anggota', 'VALID');
  if (ang.data().status !== 'aktif') throw new Fail('NISN ' + n + ' bukan anggota aktif', 'VALID');
  const nama = String(sis.data().nama || ang.data().nama || n);
  let uid; let hasil;
  try {
    const u = await auth.getUserByEmail(emailOf(n));
    uid = u.uid;
    await auth.updateUser(uid, { disabled: false, displayName: nama });
    hasil = 'diaktifkan';
  } catch (e) {
    if (!notFound(e)) throw e;
    const u = await auth.createUser({ email: emailOf(n), password: n, displayName: nama, disabled: false });
    uid = u.uid; hasil = 'dibuat';
  }
  await auth.setCustomUserClaims(uid, { role: 'anggota', nisn: n });
  const uref = db.collection('users').doc(uid);
  const cur = await uref.get();
  await uref.set({
    userId: uid, username: n, role: 'anggota', nisn: n, nama, status: 'aktif', updatedAt: nowIso(),
    ...(cur.exists ? {} : { fotoUrl: '', createdAt: nowIso() })
  }, { merge: true });
  return hasil;
}

const ACTIONS = {
  /* Diproses 5 NISN paralel agar muat dalam batas waktu Vercel Function; satu NISN bermasalah tidak menggagalkan yang lain. */
  async ensureAccounts(p, db, auth) {
    const nisns = (Array.isArray(p.nisns) ? p.nisns : []).map((x) => String(x).trim());
    if (!nisns.length || nisns.length > 100) throw new Fail('Daftar NISN tidak valid (1-100 per permintaan)', 'VALID');
    let dibuat = 0; let diaktifkan = 0;
    const gagal = [];
    for (let i = 0; i < nisns.length; i += 5) {
      const res = await Promise.all(nisns.slice(i, i + 5).map(async (n) => {
        try { return { n, r: await ensureOne(n, db, auth) }; } catch (e) {
          console.error('ensureAccounts gagal untuk', n, e && e.code, e && e.message);
          return { n, err: e instanceof Fail ? e.message : explain(e) };
        }
      }));
      res.forEach((x) => { if (x.err) gagal.push({ nisn: x.n, alasan: x.err }); else if (x.r === 'dibuat') dibuat++; else diaktifkan++; });
    }
    return { dibuat, diaktifkan, gagal };
  },

  async disableAccounts(p, db, auth) {
    for (const n of listOf(p)) {
      try {
        const u = await auth.getUserByEmail(emailOf(n));
        await auth.updateUser(u.uid, { disabled: true });
        await auth.revokeRefreshTokens(u.uid);
        await db.collection('users').doc(u.uid).set({ status: 'nonaktif', updatedAt: nowIso() }, { merge: true });
      } catch (e) { if (!notFound(e)) throw e; }
    }
    return { ok: true };
  },

  async deleteAccounts(p, db, auth) {
    for (const n of listOf(p)) {
      try {
        const u = await auth.getUserByEmail(emailOf(n));
        await auth.deleteUser(u.uid);
        await db.collection('users').doc(u.uid).delete();
      } catch (e) { if (!notFound(e)) throw e; }
    }
    return { ok: true };
  },

  async resetPassword(p, db, auth) {
    const n = String(p.nisn || '');
    if (!/^\d{6,20}$/.test(n)) throw new Fail('NISN tidak valid', 'VALID');
    await ensureOne(n, db, auth); // membuat akun bila belum ada, memperbaiki claims bila hilang
    const u = await auth.getUserByEmail(emailOf(n));
    await auth.updateUser(u.uid, { password: n, disabled: false });
    await auth.revokeRefreshTokens(u.uid);
    return { ok: true };
  }
};

/* Pembuatan admin pertama tanpa instal apa pun di komputer: dipanggil dari /setup-admin.html.
   Hanya aktif bila variabel SETUP_KEY (min. 12 karakter) diisi di Vercel. HAPUS variabel itu setelah selesai. */
async function bootstrapAdmin(p, db, auth) {
  const key = process.env.SETUP_KEY || '';
  if (key.length < 12) throw new Fail('Fitur setup nonaktif. Isi variabel SETUP_KEY (minimal 12 karakter) di Vercel lalu redeploy.', 'SETUP', 403);
  const h = (v) => createHash('sha256').update(String(v)).digest();
  if (!timingSafeEqual(h(p.setupKey || ''), h(key))) throw new Fail('Kunci setup salah', 'FORBIDDEN', 403);
  const username = String(p.username || 'admin').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  const password = String(p.password || '');
  const nama = String(p.nama || 'Administrator').trim().slice(0, 60) || 'Administrator';
  if (!username) throw new Fail('Username tidak valid', 'VALID');
  if (password.length < 8) throw new Fail('Password minimal 8 karakter', 'VALID');
  const email = emailOf(username);
  let uid; let baru = false;
  try {
    uid = (await auth.getUserByEmail(email)).uid;
    await auth.updateUser(uid, { password, disabled: false, displayName: nama });
  } catch (e) {
    if (!notFound(e)) throw e;
    uid = (await auth.createUser({ email, password, displayName: nama })).uid; baru = true;
  }
  await auth.setCustomUserClaims(uid, { role: 'admin' });
  await auth.revokeRefreshTokens(uid);
  await db.collection('users').doc(uid).set({ userId: uid, username, role: 'admin', nisn: '', nama, status: 'aktif', fotoUrl: '', updatedAt: nowIso(), createdAt: nowIso() }, { merge: true });
  return { username, baru };
}

export default async function handler(req, res) {
  const reply = (status, body) => res.status(status).json(body);
  if (req.method !== 'POST') return reply(405, { success: false, message: 'Metode tidak diizinkan', data: null });
  try {
    init();
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (body.action === 'bootstrapAdmin') {
      const data = await bootstrapAdmin(body.params || {}, getFirestore(), getAuth());
      return reply(200, { success: true, message: 'OK', data });
    }
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    if (!m) throw new Fail('Sesi tidak valid. Silakan login ulang.', 'AUTH', 401);
    let claims;
    try { claims = await getAuth().verifyIdToken(m[1], true); } catch { throw new Fail('Sesi berakhir. Silakan login ulang.', 'AUTH', 401); }
    if (claims.role !== 'admin') throw new Fail('Anda tidak memiliki akses ke fitur ini', 'FORBIDDEN', 403);
    const fn = ACTIONS[body.action];
    if (!fn) throw new Fail('Aksi tidak dikenal', 'NOACTION');
    const data = await fn(body.params || {}, getFirestore(), getAuth());
    return reply(200, { success: true, message: 'OK', data });
  } catch (e) {
    if (e instanceof Fail) return reply(e.status, { success: false, message: e.message, code: e.code, data: null });
    console.error(e);
    return reply(500, { success: false, message: explain(e), code: 'SERVER', data: null });
  }
}
