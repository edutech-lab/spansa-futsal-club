/**
 * EKSPOR DATA LAMA (jalankan SEKALI di project Apps Script LAMA yang terikat ke Google Sheets).
 * 1. Buka project Apps Script lama (yang berisi Code.gs lama), tambah file baru, tempel isi file ini.
 * 2. Pilih fungsi exportAll, klik Run.
 * 3. File "spansa-export.json" dibuat di Google Drive Anda (My Drive). Unduh, simpan di folder scripts/.
 * File ini memakai fungsi bawaan Code.gs lama (readTable_, resetCache_), jangan hapus Code.gs lama.
 */
function exportAll() {
  resetCache_();
  const names = ['Settings', 'Siswa', 'Anggota', 'Users', 'Pertemuan', 'Presensi', 'Nilai', 'Jadwal', 'Formasi', 'Pengeluaran', 'Pemasukan', 'Galeri'];
  const data = {};
  names.forEach(function (n) {
    try { data[n] = readTable_(n); } catch (e) { data[n] = []; }
  });
  // Password tidak diekspor (Firebase membuat akun baru; password awal anggota = NISN).
  data.Users = data.Users.map(function (u) { return { userId: u.userId, username: u.username, role: u.role, nisn: u.nisn, nama: u.nama, status: u.status, fotoUrl: u.fotoUrl }; });
  const f = DriveApp.createFile('spansa-export.json', JSON.stringify(data), 'application/json');
  Logger.log('Selesai: ' + f.getUrl());
}
