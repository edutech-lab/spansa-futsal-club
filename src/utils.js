import * as XLSX from 'xlsx';

export const pad2 = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const BULAN_S = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export const HARI_S = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export const rupiah = (n) => 'Rp' + Number(n || 0).toLocaleString('id-ID');

export function tglID(s, short) {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return '-';
  const [y, m, d] = s.split('-').map(Number);
  return `${pad2(d)} ${(short ? BULAN_S : BULAN)[m - 1]} ${y}`;
}
export function hariTgl(s) {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return { hari: '-', tgl: '--', bln: '-' };
  const [y, m, d] = s.split('-').map(Number);
  return { hari: HARI_S[new Date(y, m - 1, d).getDay()], tgl: pad2(d), bln: BULAN_S[m - 1] };
}
export function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${BULAN[m - 1]} ${y}`;
}
export function monthShort(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${BULAN_S[m - 1]} ${String(y).slice(2)}`;
}

/* Tahun ajaran: Ganjil = Juli-Desember, Genap = Januari-Juni */
export function currentTerm(d = new Date()) {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return m >= 7 ? `${y}/${y + 1} Ganjil` : `${y - 1}/${y} Genap`;
}
export function termOptions() {
  const cur = currentTerm();
  const y0 = Number(cur.slice(0, 4));
  const out = [];
  for (let y = y0; y >= y0 - 3; y--) {
    out.push(`${y}/${y + 1} Genap`);
    out.push(`${y}/${y + 1} Ganjil`);
  }
  return out;
}
export function termRange(term) {
  const m = /^(\d{4})\/(\d{4}) (Ganjil|Genap)$/.exec(term || '');
  if (!m) return { from: '', to: '', months: [] };
  const y1 = Number(m[1]);
  const y2 = Number(m[2]);
  if (m[3] === 'Ganjil') {
    return { from: `${y1}-07-01`, to: `${y1}-12-31`, months: [7, 8, 9, 10, 11, 12].map((n) => `${y1}-${pad2(n)}`) };
  }
  return { from: `${y2}-01-01`, to: `${y2}-06-30`, months: [1, 2, 3, 4, 5, 6].map((n) => `${y2}-${pad2(n)}`) };
}
export function defaultMonth(term) {
  const { months } = termRange(term);
  const now = ymd(new Date()).slice(0, 7);
  return months.includes(now) ? now : months[months.length - 1] || '';
}

export function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}
export function shortName(name) {
  const p = String(name || '').trim().split(/\s+/);
  return p.length > 1 ? `${p[0]} ${p[1][0]}.` : p[0] || '';
}
export function timeAgo(str) {
  if (!str) return '';
  const t = new Date(str + '+07:00').getTime();
  if (!t) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'baru saja';
  if (s < 3600) return `${Math.floor(s / 60)} menit yang lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam yang lalu`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} hari yang lalu`;
  return tglID(str.slice(0, 10), true);
}
export const STATUS_LABEL = { H: 'Hadir', S: 'Sakit', I: 'Izin', A: 'Alpa' };

/* ---------- Gambar ---------- */
export function fileToResizedBase64(file, maxSide = 320, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) return reject(new Error('Berkas harus berupa gambar'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      const size = Math.min(maxSide, side);
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      c.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve({ mime: 'image/jpeg', data: c.toDataURL('image/jpeg', quality).split(',')[1] });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Gambar tidak dapat dibaca')); };
    img.src = url;
  });
}
export function fileToBase64(file, maxSide = 1400) {
  return new Promise((resolve, reject) => {
    if (file.size > 4 * 1024 * 1024) return reject(new Error('Ukuran berkas maksimal 4 MB'));
    if (file.type === 'application/pdf') {
      const r = new FileReader();
      r.onload = () => resolve({ mime: file.type, data: String(r.result).split(',')[1], name: file.name });
      r.onerror = () => reject(new Error('Berkas tidak dapat dibaca'));
      r.readAsDataURL(file);
      return;
    }
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return reject(new Error('Bukti harus JPG, PNG, WEBP, atau PDF'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve({ mime: 'image/jpeg', data: c.toDataURL('image/jpeg', 0.82).split(',')[1], name: file.name });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Gambar tidak dapat dibaca')); };
    img.src = url;
  });
}

/* ---------- XLSX ---------- */
export function exportXlsx(filename, sheetName, headers, rows, textCols = []) {
  const aoa = [headers, ...rows.map((r) => r.map((v) => (v === null || v === undefined ? '' : v)))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const lastRow = aoa.length - 1;
  for (let R = 1; R <= lastRow; R++) {
    for (const C of textCols) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const raw = aoa[R][C];
      ws[addr] = { t: 's', v: String(raw === null || raw === undefined ? '' : raw), z: '@' };
    }
  }
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(lastRow, 0), c: headers.length - 1 } });
  ws['!cols'] = headers.map((h, i) => {
    let w = String(h).length + 2;
    for (const r of rows.slice(0, 300)) w = Math.max(w, String(r[i] ?? '').length + 2);
    return { wch: Math.min(45, w) };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
  XLSX.writeFile(wb, filename);
}

export async function readSheetCells(file) {
  if (!/\.(xlsx|xls)$/i.test(file.name)) throw new Error('Format berkas harus .xlsx atau .xls');
  if (file.size > 5 * 1024 * 1024) throw new Error('Ukuran berkas maksimal 5 MB');
  let wb;
  try {
    wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  } catch {
    throw new Error('Berkas tidak dapat dibaca. Pastikan berkas Excel tidak rusak atau diproteksi password.');
  }
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws || !ws['!ref']) throw new Error('Sheet pertama kosong');
  const range = XLSX.utils.decode_range(ws['!ref']);
  const out = [];
  for (let R = range.s.r; R <= range.e.r; R++) {
    const row = [];
    for (let C = range.s.c; C <= range.e.c; C++) row.push(ws[XLSX.utils.encode_cell({ r: R, c: C })] || null);
    out.push(row);
  }
  return out;
}

/* Teks sel; angka tidak dibaca sebagai notasi ilmiah. pad: lebar minimal bila sel numerik (mengembalikan nol di depan). */
export function cellStr(cell, opt = {}) {
  if (!cell || cell.v === undefined || cell.v === null) return '';
  if (cell.t === 'n') {
    let s = Number.isInteger(cell.v) ? cell.v.toLocaleString('fullwide', { useGrouping: false }) : String(cell.v);
    if (opt.pad && /^\d+$/.test(s) && s.length < opt.pad) s = s.padStart(opt.pad, '0');
    return s;
  }
  return String(cell.v).replace(/\s+/g, ' ').trim();
}
export function cellDate(cell) {
  if (!cell || cell.v === undefined || cell.v === null || cell.v === '') return { value: '', ok: true };
  const fmt = (y, m, d) => {
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return { value: '', ok: false };
    return { value: `${y}-${pad2(m)}-${pad2(d)}`, ok: true };
  };
  if (cell.t === 'n') {
    const p = XLSX.SSF.parse_date_code(cell.v);
    return p ? fmt(p.y, p.m, p.d) : { value: '', ok: false };
  }
  if (cell.v instanceof Date) return fmt(cell.v.getFullYear(), cell.v.getMonth() + 1, cell.v.getDate());
  const s = String(cell.v).trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (m) return fmt(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
  if (m) return fmt(+m[3], +m[2], +m[1]);
  return { value: '', ok: false };
}
