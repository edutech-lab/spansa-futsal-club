# Panduan Implementasi: Spansa Futsal Club (versi Firebase)
SMP Negeri 1 Bandar Lampung · Frontend React + Vite (GitHub → Vercel) · Database **Cloud Firestore** · Login **Firebase Authentication** · Berkas (foto/bukti/galeri) tetap di **Google Drive**

## 0. Yang berubah dari versi Google Sheets
| Bagian | Sebelumnya | Sekarang |
|---|---|---|
| Database | Google Sheets via Apps Script | Cloud Firestore |
| Login | Sesi buatan sendiri + hash di Sheets | Firebase Authentication (Email/Password). Username/NISN dipetakan ke `username@spansa.club` |
| Peran admin/anggota | Kolom `role` di Sheets | Custom Claims (hanya server yang bisa mengisi) + Security Rules |
| Buat akun, reset password | Apps Script | Vercel Function `api/admin.js` (Firebase Admin SDK) |
| Foto, bukti, galeri | Folder Google Drive via Apps Script | **Tetap** folder Google Drive via Apps Script tipis (`gas-drive/Code.gs`) |

Semua halaman, tema Medlio, PWA, dan fitur tetap sama. Dua penyesuaian kecil:
- **NISN minimal 6 digit** (syarat password Firebase; password awal anggota = NISN).
- Peringatan "backend belum diperbarui" dihapus karena sudah tidak relevan.

## 1. Struktur proyek
```
├── api/admin.js            Vercel Function: buat/nonaktifkan/hapus akun, reset password
├── firebase/               firestore.rules, firestore.indexes.json   (+ firebase.json)
├── gas-drive/              Code.gs, appsscript.json  (layanan file Google Drive)
├── scripts/                create-admin.mjs, ExportData.gs, import-to-firestore.mjs
└── src/
    ├── backend/            util.js (aturan murni), handlers.js (seluruh logika Firestore),
    │                       store.js, remote.js (panggilan /api/admin dan layanan Drive)
    ├── api.js, auth.jsx, firebase.js, config.js
    └── components/, pages/ (tidak berubah)
```

## 2. Siapkan Firebase
1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project**.
2. **Build > Authentication > Get started > Sign-in method > Email/Password > Enable**.
3. **Build > Firestore Database > Create database** (mode produksi, region `asia-southeast2` Jakarta).
4. **Project settings > Your apps > Web (`</>`)**: daftarkan aplikasi, salin `apiKey`, `authDomain`, `projectId`, `appId`.
5. **Project settings > Service accounts > Generate new private key**: file JSON berisi `project_id`, `client_email`, `private_key` (RAHASIA, jangan di-commit).
6. Pasang **Security Rules**: tab **Firestore > Rules**, tempel isi `firebase/firestore.rules`, **Publish**. (Atau `firebase deploy --only firestore:rules` bila memakai Firebase CLI.)

## 3. Layanan file Google Drive (Apps Script tipis)
Dapat memakai project Apps Script lama atau yang baru. **Gantikan seluruh isi `Code.gs`** dengan `gas-drive/Code.gs`, dan manifest dengan `gas-drive/appsscript.json` (Project Settings > Show appsscript.json).
1. **Project Settings > Script Properties**, tambahkan `FIREBASE_API_KEY` = apiKey dari langkah 2.4.
2. Jalankan fungsi **setupFolders** sekali (setujui izin Drive). Folder `Spansa Futsal Club` yang sudah ada dipakai ulang beserta sub-folder `Foto Profil` dan `Bukti Pengeluaran`; sub-folder `Galeri` dibuat bila belum ada. Foto/bukti lama tetap dapat dibuka.
3. **Deploy > New deployment > Web app**: *Execute as* **Me**, *Who has access* **Anyone**. Salin URL `/exec`.
   - Bila memakai project lama dan sudah punya deployment, pakai **Manage deployments > Edit > Version: New version** agar URL tidak berubah.
4. Uji: buka URL `/exec` di browser, harus tampil `"layanan file Drive aktif"`.

Keamanan: setiap permintaan wajib membawa Firebase ID token yang diverifikasi; unggah bukti/galeri hanya untuk admin, anggota hanya foto profilnya sendiri, dan hanya berkas di folder aplikasi yang bisa dibuang.

## 4. Migrasi data lama (lewati bila mulai dari data kosong)
1. Di project Apps Script **lama** (terikat Sheets), tambah file, tempel `scripts/ExportData.gs`, jalankan **exportAll**. Berkas `spansa-export.json` muncul di My Drive. Unduh ke folder `scripts/`.
2. Buat `.env.local` dari `.env.example`, isi `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.
3. `npm install`, lalu:
   ```
   ADMIN_PASSWORD="passwordAdminBaru" node scripts/import-to-firestore.mjs scripts/spansa-export.json
   ```
   Skrip memindahkan siswa, anggota, presensi, nilai, jadwal, formasi, kas, galeri, dan pengaturan, lalu membuat akun: admin (password dari `ADMIN_PASSWORD`) dan anggota aktif (password awal = NISN). Password lama tidak bisa dipindahkan. Aman dijalankan ulang.
4. Hapus `spansa-export.json` setelah selesai (berisi data pribadi).

## 5. Akun admin (tanpa instal apa pun di komputer)
Setelah deploy ke Vercel (langkah 6):
1. Di Vercel > Settings > Environment Variables, tambahkan `SETUP_KEY` berisi teks acak minimal 12 karakter (contoh: `Futsal-Spansa-2026-xyz`), lalu **Redeploy**.
2. Buka `https://DOMAIN-ANDA/setup-admin.html`, isi Kunci setup, username (default `admin`), dan password baru (minimal 8 karakter), lalu klik **Buat Akun Admin**.
3. Login di halaman utama dengan username dan password tadi.
4. **Hapus variabel `SETUP_KEY` di Vercel lalu Redeploy** agar halaman setup nonaktif.

Lupa password admin? Ulangi langkah 1-4 dengan username yang sama untuk mengganti passwordnya.

**Jangan membuat/menghapus admin lewat Firebase Console.** Akun admin wajib memiliki Custom Claim `role=admin` dan dokumen `users/{uid}`, yang hanya dibuat oleh halaman setup (atau skrip `npm run create-admin` bagi yang memakai komputer). Akun yang dibuat manual di Console tidak bisa masuk.

## 6. Deploy GitHub → Vercel
1. Push proyek ke GitHub (`.env*`, `node_modules`, `spansa-export.json` sudah di `.gitignore`).
2. Vercel: **Add New > Project** > pilih repo (preset Vite terdeteksi).
3. **Environment Variables** (Production dan Preview):
   - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`
   - `VITE_DRIVE_URL` = URL `/exec` langkah 3
   - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (tempel apa adanya termasuk `\n`)
   - `SETUP_KEY` (sementara, lihat langkah 5)
4. **Deploy**. Setelah itu di Firebase **Authentication > Settings > Authorized domains**, tambahkan domain Vercel/domain sendiri.
5. Pengembangan lokal: `npm install`, `npx vercel dev` (agar folder `/api` aktif; `npm run dev` saja tidak menjalankan `/api`).

## 7. Struktur Firestore
`settings/{public,app,finance}` · `users/{uid}` · `siswa/{nisn}` · `anggota/{nisn}` · `pertemuan/{id}` · `pertemuanStat/{id}` (agregat iuran, admin saja) · `presensi/{pertemuanId_nisn}` · `nilai/{tahun_semester_nisn}` · `jadwal/{id}` · `formasi/{jadwalId}` · `pengeluaran/{id}` · `pemasukan/{id}` · `galeri/{id}` · `counters/nota_YYYY_MM` · `logs/{auto}`

Hak akses (Security Rules): admin penuh; anggota hanya membaca data dirinya (anggota, presensi, nilai), jadwal, formasi, galeri, dan pertemuan; keuangan (`pengeluaran`, `pemasukan`, `pertemuanStat`, `settings/finance`) khusus admin.

## 8. Pemecahan masalah
- **"Username atau password salah"**: pastikan Email/Password aktif di Authentication; anggota baru harus ditambahkan lewat menu Anggota Futsal (akun dibuat saat itu). Anggota lupa password: admin klik reset (kembali ke NISN).
- **"Akun belum disiapkan oleh admin"**: akun belum punya Custom Claims. Jalankan ulang `create-admin` (admin) atau tambahkan ulang anggota (akun anggota).
- **Gagal menambah anggota / reset password**: cek Vercel > Functions > Logs untuk `/api/admin` dan pastikan tiga variabel `FIREBASE_*` terisi.
- **Unggah foto/bukti gagal**: periksa `VITE_DRIVE_URL` (harus `/exec` deployment terbaru), akses "Anyone", Script Property `FIREBASE_API_KEY`, dan `setupFolders()` sudah dijalankan.
- **Kuota**: paket gratis Firebase (Spark) cukup untuk satu klub sekolah. Vercel Function tidak memerlukan paket Blaze.

---

## Pembaruan v5 — langkah wajib setelah memperbarui kode

1. **Publikasikan Firestore Rules** (ada koleksi baru `roster`): `firebase deploy --only firestore:rules`
2. **Push ke GitHub** agar Vercel deploy ulang (`vercel.json` kini menaikkan batas waktu `/api/admin` menjadi 60 detik).
3. Login sebagai **admin → menu Anggota Futsal**:
   - Halaman ini otomatis menyiapkan daftar anggota yang dilihat sesama anggota (koleksi `roster`, tanpa NISN dan tanpa data kelahiran).
   - Klik **Perbaiki Akun Login** sekali. Tombol ini membuat/mengaktifkan akun semua anggota aktif yang akunnya belum siap. Password yang sudah diganti anggota tidak berubah. Jalankan ulang kapan pun ada anggota yang tidak bisa login.
4. Foto anggota: admin dapat mengunggah foto tiap anggota lewat ikon kamera di tabel Anggota Futsal. Anggota tetap bisa mengganti foto sendiri lewat menu profil.

### Penyebab masalah yang diperbaiki
- **Foto tidak tampil:** layanan Drive menyimpan tautan halaman (`/file/d/ID/view`) yang tidak bisa dipakai sebagai gambar. Aplikasi kini mengubahnya menjadi URL gambar langsung saat ditampilkan (foto lama ikut tampil, tanpa unggah ulang).
- **Anggota tidak bisa login / tambah anggota kadang gagal:** akun dibuat satu per satu dalam satu permintaan sehingga sering kena batas waktu Vercel saat banyak anggota dipilih, menyisakan anggota tanpa akun. Kini diproses per 5 NISN paralel dengan satu kali percobaan ulang, pesan error menyebut siswa dan alasannya, dan ada tombol Perbaiki Akun Login. Reset password juga membuat akun yang hilang.
- NISN yang bukan 6–20 digit angka tidak bisa dibuatkan akun; perbaiki NISN-nya di Data Siswa.

## Pembaruan v6
- **Reset password massal:** menu Anggota Futsal → centang anggota → *Reset Password Terpilih*, atau *Reset Semua*. Password kembali ke NISN, akun yang belum ada dibuat, claims yang hilang diperbaiki, dan sesi lama keluar. Dikerjakan per 5 anggota agar tidak kena batas waktu Vercel.
- **Login NISN tanpa angka 0 di depan:** jika NISN 10 digit diketik tanpa 0 di depan (mis. dari Excel), aplikasi otomatis mencoba versi 10 digit.
- **Potong foto:** unggah foto (profil sendiri maupun foto anggota oleh admin) membuka dialog potong dengan rasio 4:5 sesuai foto di Kartu Anggota (geser + zoom).
- **Daftar teman anggota:** daftar kini disinkronkan otomatis setiap admin login. Jika anggota melihat pesan "aturan Firestore belum dipublikasikan", jalankan `firebase deploy --only firestore:rules`.

## Pembaruan v7
- **Filter kelas** di menu Anggota Futsal (admin dan anggota): pilih semua kelas, satu tingkat (mis. semua kelas 7), atau satu kelas. Jumlah anggota tampil di tiap pilihan. Untuk admin, ekspor dan "pilih semua" mengikuti hasil filter, sehingga bisa memilih satu kelas lalu reset password sekaligus.
- **Tampilan anggota:** tombol Grid / List; pilihan diingat di perangkat masing-masing.
