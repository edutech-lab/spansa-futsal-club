import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Inbox, Loader2, Search, X } from 'lucide-react';
import { DEFAULT_LOGO } from './config.js';
import { initials, monthLabel, photoSrc, termRange } from './utils.js';

const UiCtx = createContext(null);
export const useUi = () => useContext(UiCtx);

export function UiProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dlg, setDlg] = useState(null);
  const toast = useCallback((message, type = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  const confirm = useCallback((message, opt = {}) => new Promise((res) => setDlg({ message, okText: opt.okText || 'Ya, lanjutkan', danger: !!opt.danger, res })), []);
  const done = (v) => { dlg.res(v); setDlg(null); };
  return (
    <UiCtx.Provider value={{ toast, confirm }}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={'toast ' + (t.type === 'err' ? 'err' : t.type === 'load' ? 'load' : '')}>
            {t.type === 'err' ? <AlertCircle size={18} color="#EF4444" /> : t.type === 'load' ? <Loader2 size={18} className="spin" style={{ color: 'var(--blue)' }} /> : <CheckCircle2 size={18} color="#10B981" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
      {dlg && (
        <Modal open title="Konfirmasi" onClose={() => done(false)} footer={
          <>
            <button className="btn sec" onClick={() => done(false)}>Batal</button>
            <button className={'btn ' + (dlg.danger ? 'danger' : '')} onClick={() => done(true)}>{dlg.okText}</button>
          </>
        }>
          <p>{dlg.message}</p>
        </Modal>
      )}
    </UiCtx.Provider>
  );
}

const modalStack = [];
export function Modal({ open, title, onClose, children, footer, wide }) {
  const idRef = useRef(Symbol('modal'));
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return undefined;
    const id = idRef.current;
    modalStack.push(id);
    const onKey = (e) => { if (e.key === 'Escape' && modalStack[modalStack.length - 1] === id) closeRef.current(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      const i = modalStack.indexOf(id);
      if (i >= 0) modalStack.splice(i, 1);
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true">
        <div className="modal-h"><span>{title}</span><button className="iconbtn" onClick={onClose} aria-label="Tutup"><X size={20} /></button></div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}

export function Card({ title, icon: Icon, action, onAction, children, plain, className = '' }) {
  return (
    <section className={'card ' + className}>
      {title && (
        <div className="card-h">
          {Icon && <Icon size={19} />}<span>{title}</span>
          {action && <button className="act" onClick={onAction}>{action}<ChevronRight size={14} /></button>}
        </div>
      )}
      <div className={plain ? 'card-plain' : 'card-b'}>{children}</div>
    </section>
  );
}

export function PageHead({ title, subtitle, children }) {
  return (
    <div className="page-head">
      <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
      <div className="row wrap">{children}</div>
    </div>
  );
}

export function Field({ label, hint, children, className = '' }) {
  return <label className={'field ' + className}><span>{label}</span>{children}{hint && <span className="hint">{hint}</span>}</label>;
}

export function SearchBox({ value, onChange, placeholder = 'Cari...' }) {
  return (
    <div className="search"><Search size={16} /><input className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /></div>
  );
}

export function Avatar({ src, name, size = 36 }) {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [src]);
  const url = photoSrc(src, Math.max(160, Math.round(size * 3)));
  if (url && !bad) return <img className="avatar" src={url} alt={name || ''} width={size} height={size} style={{ width: size, height: size }} referrerPolicy="no-referrer" onError={() => setBad(true)} />;
  return <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials(name)}</span>;
}

export function Loading({ text = 'Memuat data...' }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="ring" aria-hidden="true" />
      <span className="ld-text">{text}</span>
      <span className="ld-bar" aria-hidden="true" />
    </div>
  );
}

export function Splash({ text = 'Memuat aplikasi...' }) {
  return (
    <div className="splash" role="status" aria-live="polite">
      <div className="splash-in">
        <div className="splash-logo">
          <span className="ring light" aria-hidden="true" />
          <img src={DEFAULT_LOGO} alt="" referrerPolicy="no-referrer" />
        </div>
        <b>Spansa Futsal Club</b>
        <span className="splash-text">{text}</span>
        <span className="ld-bar light" aria-hidden="true" />
      </div>
    </div>
  );
}
export function Empty({ text = 'Belum ada data' }) {
  return <div className="empty"><Inbox size={30} /><span>{text}</span></div>;
}
export function ErrorBox({ message, onRetry }) {
  return (
    <div className="empty">
      <AlertCircle size={30} color="#EF4444" />
      <span className="err-t">{message}</span>
      {onRetry && <button className="btn sec sm" onClick={onRetry}>Coba lagi</button>}
    </div>
  );
}
export function Skeleton({ h = 120 }) { return <div className="skel" style={{ height: h }} />; }

export function useLoad(fn, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const seq = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async () => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const data = await fn();
      if (id === seq.current) setState({ data, loading: false, error: '' });
    } catch (e) {
      if (id === seq.current) setState({ data: null, loading: false, error: e.message || 'Terjadi kesalahan' });
    }
  }, deps);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load, setData: (d) => setState((s) => ({ ...s, data: d })) };
}

export function DataTable({ columns, rows, pageSize = 25, empty, foot, rowKey }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  useEffect(() => { if (page > pages - 1) setPage(0); }, [rows.length, pages, page]);
  const slice = rows.slice(page * pageSize, page * pageSize + pageSize);
  if (!rows.length) return <Empty text={empty || 'Belum ada data'} />;
  return (
    <>
      <div className="tw">
        <table>
          <thead><tr>{columns.map((c) => <th key={c.key || c.label} className={c.align === 'right' ? 'r' : c.align === 'center' ? 'c' : ''} style={c.width ? { width: c.width } : undefined}>{c.label}</th>)}</tr></thead>
          <tbody>
            {slice.map((r, i) => (
              <tr key={rowKey ? rowKey(r) : i}>
                {columns.map((c) => (
                  <td key={c.key || c.label} className={(c.align === 'right' ? 'r ' : c.align === 'center' ? 'c ' : '') + (c.nowrap ? 'nowrap' : '')}>
                    {c.render ? c.render(r, page * pageSize + i) : r[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {foot && <tfoot>{foot}</tfoot>}
        </table>
      </div>
      {rows.length > pageSize && (
        <div className="pager">
          <span>Menampilkan {page * pageSize + 1}-{Math.min(rows.length, (page + 1) * pageSize)} dari {rows.length}</span>
          <div className="row">
            <button className="btn sec sm icon" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Sebelumnya"><ChevronLeft size={16} /></button>
            <span>{page + 1}/{pages}</span>
            <button className="btn sec sm icon" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Berikutnya"><ChevronRight size={16} /></button>
          </div>
        </div>
      )}
    </>
  );
}

export function MonthSelect({ term, value, onChange }) {
  const { months } = termRange(term);
  return (
    <select className="input" style={{ width: 'auto', minWidth: 170 }} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Pilih bulan">
      {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
    </select>
  );
}
