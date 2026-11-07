/* Membuat / mereset akun admin di Firebase Auth + Firestore.
   Jalankan lokal:  ADMIN_PASSWORD="minimal8karakter" npm run create-admin
   Memerlukan FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY (file .env atau environment). */
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
const { FIREBASE_PROJECT_ID: projectId, FIREBASE_CLIENT_EMAIL: clientEmail, FIREBASE_PRIVATE_KEY: pk } = process.env;
if (!projectId || !clientEmail || !pk) { console.error('Isi FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY terlebih dahulu.'); process.exit(1); }
const password = process.env.ADMIN_PASSWORD || '';
if (password.length < 8) { console.error('Atur ADMIN_PASSWORD (minimal 8 karakter).'); process.exit(1); }
const username = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
const nama = process.env.ADMIN_NAMA || 'Administrator';

initializeApp({ credential: cert({ projectId, clientEmail, privateKey: pk.replace(/\\n/g, '\n') }) });
const auth = getAuth(); const db = getFirestore();
const email = (process.env.ADMIN_EMAIL || (username + '@spansa.club')).trim().toLowerCase();
let uid;
try { const u = await auth.getUserByEmail(email); uid = u.uid; await auth.updateUser(uid, { password, disabled: false, displayName: nama }); console.log('Akun admin sudah ada: password diperbarui.'); }
catch (e) { if (e.code !== 'auth/user-not-found') throw e; uid = (await auth.createUser({ email, password, displayName: nama })).uid; console.log('Akun admin dibuat.'); }
await auth.setCustomUserClaims(uid, { role: 'admin' });
await auth.revokeRefreshTokens(uid);
const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T');
await db.collection('users').doc(uid).set({ userId: uid, username, role: 'admin', nisn: '', nama, status: 'aktif', fotoUrl: '', updatedAt: now, createdAt: now }, { merge: true });
console.log('Selesai. Login dengan: ' + (process.env.ADMIN_EMAIL ? email : username));
