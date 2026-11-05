# Panduan Implementasi: Spansa Futsal Club
SMP Negeri 1 Bandar Lampung · Frontend React + Vite (GitHub → Vercel) · Backend Google Apps Script · Database Google Sheets

## 0. Catatan revisi terbaru
- **Backend berubah:** setelah mengganti `Code.gs`, wajib **Deploy > Manage deployments > Edit > Version: New version > Deploy**. Tanpa langkah ini Web App tetap memakai kode lama. Tidak perlu menjalankan ulang `setupDatabase()`; pengaturan baru terisi otomatis dengan nilai bawaan.
- **Frontend berubah:** commit dan push ke GitHub, Vercel membangun ulang otomatis.
- Rekap Iuran kini **khusus admin**: menu dan kartu "Total Iuran Saya" di dashboard dihapus untuk anggota, dan server tidak lagi mengirim data iuran ke anggota.
- Pengaturan baru (menu Pengaturan > Identitas & Tampilan): URL logo sekolah, website, YouTube, Instagram untuk kartu anggota.
- Perbaikan Formasi: halaman kini menunggu data selesai dimuat; ditambah pengaman agar error satu halaman tidak membuat layar putih.

## 1. Struktur proyek
```
spansa-futsal-club/
├── index.html, package.json, vite.config.js, vercel.json, .gitignore, .env.example
├── public/            manifest.webmanifest, sw.js, icon.svg, icon-192.png, icon-512.png (PWA)
├── src/
│   ├── main.jsx, App.jsx (router hash), auth.jsx, api.js, config.js, utils.js, ui.jsx, styles.css
│   ├── components/    Layout.jsx (sidebar, header, profil), Banner.jsx (banner vektor), Pitch.jsx (lapangan formasi)
│   └── pages/         Login, Dashboard, Siswa, Anggota, Kartu, Hadir, Jadwal, Formasi, Nilai,
│                      RekapHadir, RekapIuran, Pengeluaran, RekapKas, Pengaturan
└── gas-backend/       Code.gs, appsscript.json
```

## 2. Backend: Google Sheets + Apps Script
1. Buat Google Sheets baru, beri nama **Database Spansa Futsal Club**.
2. Menu **Extensions > Apps Script**. Hapus isi `Code.gs`, tempel isi `gas-backend/Code.gs`.
3. Klik ikon roda gigi **Project Settings**, centang **Show "appsscript.json" manifest file**, lalu ganti isinya dengan `gas-backend/appsscript.json`.
4. Di **Project Settings > Script Properties**, tambahkan:
   - `ADMIN_INITIAL_PASSWORD` = password admin awal (minimal 8 karakter, buat sendiri)
   - (opsional) `ADMIN_USERNAME` (default `admin`) dan `ADMIN_NAMA`
5. Pilih fungsi **setupDatabase** di editor, klik **Run**, setujui izin (Spreadsheet dan Drive). Fungsi ini membuat 12 sheet beserta header, memformat kolom NISN, Kelas, dan tanggal sebagai **teks**, mengisi pengaturan awal, dan membuat folder Drive **Spansa Futsal Club** berisi `Foto Profil`, `Bukti Pengeluaran`, dan `Backup`.
6. Jalankan **createAdmin**. Setelah berhasil, **hapus** Script Property `ADMIN_INITIAL_PASSWORD`. Lupa password admin: isi lagi property tersebut, jalankan **resetAdminPassword**, lalu hapus property.
7. **Deploy > New deployment > Web app**: *Execute as* **Me**, *Who has access* **Anyone**. Salin URL yang berakhiran `/exec`.
   - Akses "Anyone" diperlukan agar aplikasi di Vercel dapat memanggil API tanpa login Google. Data tetap dilindungi: setiap aksi (kecuali login) wajib membawa token sesi yang diverifikasi server, dan hak akses admin/anggota diperiksa di server.
8. Uji: buka URL `/exec` di browser; harus tampil JSON `"Spansa Futsal Club API aktif"`.

Sheet database: `Users`, `Sessions`, `Settings`, `Siswa`, `Anggota`, `Pertemuan`, `Presensi`, `Jadwal`, `Formasi`, `Nilai`, `Pengeluaran`, `Log`. Jangan mengubah header atau mengisi sheet ini manual kecuali sangat perlu.

## 3. Frontend: GitHub dan Vercel
1. Buat repositori GitHub baru (mis. `spansa-futsal-club`), unggah **seluruh isi folder proyek kecuali `gas-backend` jika ingin dipisah** (aman juga bila ikut). `.gitignore` sudah mengecualikan `node_modules`, `dist`, dan `.env*`.
2. Di Vercel: **Add New > Project > Import** repositori. Preset: **Vite** (otomatis). Build command `npm run build`, output `dist`.
3. Sebelum Deploy, buka **Environment Variables**, tambahkan `VITE_GAS_URL` = URL `/exec` dari langkah 2.7 (semua environment).
4. **Deploy**. Buka URL Vercel, login.
5. Pengembangan lokal (opsional): `npm install`, salin `.env.example` menjadi `.env.local`, isi URL, jalankan `npm run dev`.

## 4. Pemakaian awal
1. Login `admin` dengan password dari langkah 2.4. Pilih tahun ajaran (default tahun ajaran berjalan).
2. **Pengaturan**: cek iuran per pertemuan (default Rp5.000), bobot nilai (70/30), batas predikat, dan logo.
3. **Data Siswa**: impor Excel (unduh template dulu) atau tambah manual.
4. **Anggota Futsal**: tambahkan dari Data Siswa. Akun anggota dibuat otomatis, username dan password awal = NISN (tidak wajib diganti; anggota dapat mengganti kapan saja dari menu profil).
5. **Daftar Hadir** tiap latihan, **Jadwal**, **Formasi**, **Nilai** per semester, **Pengeluaran Kas**.
6. Instal sebagai aplikasi: di HP buka URL, menu browser > *Add to Home screen*.

Aturan periode: Ganjil = Juli-Desember, Genap = Januari-Juni. Semua daftar, rekap, dan grafik hanya menampilkan data pada semester terpilih. Saldo kas tetap terbawa (saldo awal semester = akumulasi sebelumnya).

## 5. Memperbarui aplikasi
- **Frontend**: ubah file, commit dan push ke GitHub; Vercel build ulang otomatis.
- **Backend**: ganti kode di Apps Script, lalu **Deploy > Manage deployments > Edit (ikon pensil) > Version: New version > Deploy**. URL `/exec` tidak berubah. Menyimpan kode saja tanpa deploy versi baru **tidak** memperbarui Web App.

## 6. Pemecahan masalah
| Gejala | Penyebab / solusi |
|---|---|
| "VITE_GAS_URL belum diatur" | Tambahkan variabel di Vercel lalu **Redeploy** (variabel dibaca saat build). |
| "Respons server tidak valid" | URL bukan `/exec`, akses deployment bukan *Anyone*, atau belum deploy versi baru. |
| "Database belum disiapkan" | Jalankan `setupDatabase()`. |
| Login admin gagal | Pastikan `createAdmin()` sudah dijalankan; gunakan `resetAdminPassword()`. |
| "Terlalu banyak percobaan gagal" | Tunggu 10 menit (pembatasan login per username). |
| Foto/bukti gagal: "tidak dapat dibagikan" | Akun Google Workspace sekolah membatasi berbagi tautan Drive. Minta admin domain mengizinkan, atau deploy dengan akun Gmail pribadi. |
| Foto kartu tidak tampil di PNG | Pastikan foto bisa dibuka lewat tautannya; ganti foto profil lalu coba unduh lagi. |
| NISN kehilangan nol di depan setelah edit manual di Excel | Isi kolom NISN dan Kelas sebagai **Text**; impor akan melengkapi nol bila NISN kurang dari 10 digit dan sel berformat angka. |
| Error izin saat Run | Setujui ulang izin (Review permissions > Advanced > Go to project). |
| Build Vercel gagal | Periksa log; pastikan Node 18+ dan `package.json` tidak diubah. |

## 7. Keamanan
- Password disimpan sebagai hash SHA-256 bergaram + pepper (di Script Properties), tidak pernah dikirim ke browser.
- Token sesi acak berlaku 12 jam, disimpan di server dalam bentuk hash, dicabut saat logout, ganti/reset password.
- Percobaan login dibatasi; semua input divalidasi di server; anggota hanya bisa membaca data dirinya.
- Jangan membagikan akses edit Google Sheets ke orang lain; pengguna Sheets dapat membaca hash password.
