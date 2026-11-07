import { collection, doc, getDoc, getDocs, query, writeBatch, addDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { nowIso } from './util.js';

export const ref = (col, id) => doc(db, col, String(id));
export const colRef = (col) => collection(db, col);

export async function one(col, id) {
  const s = await getDoc(ref(col, id));
  return s.exists() ? s.data() : null;
}
export async function many(col, ...cons) {
  const s = await getDocs(cons.length ? query(colRef(col), ...cons) : colRef(col));
  return s.docs.map((d) => d.data());
}
/* ops: [['set'|'update'|'delete', docRef, data?, options?]] dipecah per 400 operasi (batas Firestore 500). */
export async function commit(ops) {
  for (let i = 0; i < ops.length; i += 400) {
    const b = writeBatch(db);
    ops.slice(i, i + 400).forEach(([t, r, d, o]) => {
      if (t === 'set') b.set(r, d, o || {}); else if (t === 'update') b.update(r, d); else b.delete(r);
    });
    await b.commit();
  }
}
export async function writeLog(ctx, action, detail) {
  try {
    if (ctx && ctx.role === 'admin') await addDoc(colRef('logs'), { waktu: nowIso(), user: ctx.username || '-', action, detail: String(detail || '').slice(0, 200) });
  } catch { /* log tidak boleh menggagalkan proses */ }
}
