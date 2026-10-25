import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { X, Lock, Inbox, AlertTriangle, CheckCircle2, Info, FlaskConical } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { initials, levelOf, statusOf, SEVERITY } from '../lib/format';
import type { Tone } from '../lib/format';

export function Badge({ tone = 'neutral', children, dot, title }: { tone?: Tone; children: ReactNode; dot?: boolean; title?: string }) {
  return <span className={`badge t-${tone}`} title={title}>{dot && <span className="bdot" />}{children}</span>;
}
export function Status({ s }: { s?: string | null }) {
  const st = statusOf(s);
  return <Badge tone={st.tone} dot>{st.label}</Badge>;
}
export function Score({ score }: { score?: number | null }) {
  const l = levelOf(score);
  return <span className={`score t-${l.tone}`} title={`${l.label} (teacher scale: 1–3 Low, 4–7 Moderate, 8–11 High, 12–16 Critical)`}>{score ?? '—'}</span>;
}
export function Level({ score }: { score?: number | null }) {
  const l = levelOf(score);
  return <Badge tone={l.tone}>{l.label}</Badge>;
}
export function Severity({ s }: { s?: number | null }) {
  const v = SEVERITY[s ?? 0];
  return v ? <Badge tone={v.tone}>{v.label}</Badge> : <span className="muted">—</span>;
}
export function ExecLabel({ label }: { label?: string | null }) {
  if (!label) return null;
  return <span className={`badge ${label === 'SIMULATED ACTION' ? 'label-sim' : 'label-dev'}`}>{label}</span>;
}

export function Avatar({ name, size }: { name?: string | null; size?: 'sm' | 'lg' }) {
  return <span className={`avatar ${size ?? ''}`} aria-hidden>{initials(name)}</span>;
}
export function Person({ p, size }: { p?: { name: string; role?: string } | null; size?: 'sm' | 'lg' }) {
  if (!p) return <span className="muted">Unassigned</span>;
  return (
    <span className="person">
      <Avatar name={p.name} size={size} />
      <span style={{ minWidth: 0 }}>
        <div className="pn">{p.name}</div>
        {p.role && <div className="pr">{p.role}</div>}
      </span>
    </span>
  );
}

export function Card({ title, sub, actions, children, flush, className }: { title?: ReactNode; sub?: ReactNode; actions?: ReactNode; children: ReactNode; flush?: boolean; className?: string }) {
  return (
    <section className={`card ${className ?? ''}`}>
      {(title || actions) && (
        <div className="card-head">
          <div>{title && <h3>{title}</h3>}{sub && <div className="sub">{sub}</div>}</div>
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      <div className={`card-body ${flush ? 'flush' : ''}`}>{children}</div>
    </section>
  );
}

const SECTION: [string, string][] = [['/risks', 'Risk'], ['/ebios', 'Risk · EBIOS Risk Manager'], ['/quant', 'Risk · Quantification'], ['/compliance', 'Compliance'], ['/controls', 'Compliance'],
  ['/policies', 'Compliance'], ['/incidents', 'Operations'], ['/actions', 'Operations'], ['/approvals', 'Operations'], ['/vendors', 'Operations · Third parties'], ['/continuity', 'Operations · Resilience'],
  ['/audit', 'Assurance'], ['/board', 'Assurance'], ['/reports', 'Assurance'], ['/scenarios', 'Assurance · Rehearsal'], ['/access', 'Workspace'], ['/organisation', 'Workspace'],
  ['/assets', 'Workspace'], ['/departments', 'Workspace'], ['/guide', 'Workspace'], ['/workspace', 'Overview'], ['/briefing', 'Overview']];
export function PageHead({ eyebrow, title, desc, actions }: { eyebrow?: string; title: ReactNode; desc?: ReactNode; actions?: ReactNode }) {
  const loc = useLocation();
  eyebrow = eyebrow ?? SECTION.find(([p]) => loc.pathname.startsWith(p))?.[1];
  return (
    <div className="page-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {desc && <p>{desc}</p>}
      </div>
      {actions && <div className="row wrap">{actions}</div>}
    </div>
  );
}

export function Empty({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return <div className="empty">{icon ?? <Inbox size={28} />}<div className="strong" style={{ color: 'var(--text-2)' }}>{title}</div>{children && <div className="small">{children}</div>}</div>;
}

export function Notice({ kind = 'info', children }: { kind?: 'info' | 'warn' | 'danger' | 'success'; children: ReactNode }) {
  const Ic = kind === 'danger' || kind === 'warn' ? AlertTriangle : kind === 'success' ? CheckCircle2 : Info;
  return <div className={`notice ${kind}`}><Ic size={16} /><div>{children}</div></div>;
}

export function Locked({ children }: { children: ReactNode }) {
  return <div className="locked"><Lock size={14} /><div>{children}</div></div>;
}

export function Loading({ rows = 3 }: { rows?: number }) {
  return <div className="stack" style={{ padding: 16 }}>{Array.from({ length: rows }).map((_, i) => <div key={i} className="skeleton" style={{ height: 16, width: `${90 - i * 12}%` }} />)}</div>;
}

export function ErrorBox({ error }: { error: { message: string; kind?: string } | null }) {
  if (!error) return null;
  return <Notice kind="danger"><b>{error.kind === 'DENIED' ? 'Not permitted. ' : error.kind === 'AUTH' ? 'Access. ' : ''}</b>{error.message}</Notice>;
}

export function Modal({ title, sub, onClose, children, footer, wide }: { title: ReactNode; sub?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div><h3>{title}</h3>{sub && <div className="small muted" style={{ marginTop: 2 }}>{sub}</div>}</div>
          <button className="iconbtn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, help, children }: { label: string; help?: ReactNode; children: ReactNode }) {
  return <div className="field"><label>{label}</label>{children}{help && <div className="help">{help}</div>}</div>;
}

export function Progress({ value }: { value: number }) {
  return <div className="progress" aria-label={`${value}%`}><div style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

export function Tabs({ tabs, value, onChange }: { tabs: { key: string; label: ReactNode }[]; value: string; onChange: (k: string) => void }) {
  return <div className="tabs" role="tablist">{tabs.map(t => <button key={t.key} role="tab" aria-selected={value === t.key} className={value === t.key ? 'on' : ''} onClick={() => onChange(t.key)}>{t.label}</button>)}</div>;
}

/* ---------------- Toasts ---------------- */
type ToastT = { id: number; kind: 'ok' | 'err' | 'info'; text: string };
const ToastCtx = createContext<(kind: ToastT['kind'], text: string) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastT[]>([]);
  const push = useCallback((kind: ToastT['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setItems(i => [...i, { id, kind, text }]);
    setTimeout(() => setItems(i => i.filter(x => x.id !== id)), kind === 'err' ? 7000 : 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map(t => <div key={t.id} className={`toast ${t.kind}`}>{t.kind === 'err' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}<div>{t.text}</div></div>)}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);


/* ---------------- Shared building blocks (enterprise layer) ---------------- */
/** Right-hand inspector panel: opens over the list without leaving the page. */
export function Drawer({ title, sub, onClose, children, actions, wide }: { title: ReactNode; sub?: ReactNode; onClose: () => void; children: ReactNode; actions?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <>
      <div className="overlay" style={{ background: 'transparent', backdropFilter: 'none' }} onClick={onClose} />
      <aside className={`drawer ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="drawer-head">
          <div style={{ minWidth: 0 }}><div className="strong" style={{ fontSize: 15 }}>{title}</div>{sub && <div className="xs muted" style={{ marginTop: 2 }}>{sub}</div>}</div>
          <div className="row">{actions}<button className="iconbtn" onClick={onClose} aria-label="Close"><X size={17} /></button></div>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </>
  );
}

/** KPI tile for the .stats strip: label, value, detail, optional bar and link. */
export function Stat({ k, v, d, to, bar, tone, icon }: { k: ReactNode; v: ReactNode; d?: ReactNode; to?: string; bar?: number; tone?: 'up' | 'down'; icon?: ReactNode }) {
  const body = (
    <>
      <div className="k">{icon}{k}</div>
      <div className="v">{v}</div>
      {d && <div className={`d ${tone ?? ''}`}>{d}</div>}
      {bar !== undefined && <div className="bar"><i style={{ width: `${Math.max(0, Math.min(100, bar))}%` }} /></div>}
    </>
  );
  return to ? <Link to={to} className="stat">{body}</Link> : <div className="stat">{body}</div>;
}

/** Severity / state marker: colour + shape + text. level: critical | high | medium | low | pass | none */
export function Sev({ level, children }: { level: string; children?: ReactNode }) {
  return <span className={`sev ${level}`}><i />{children}</span>;
}

/** Segmented horizontal bar (e.g. met / partial / gap). */
export function Meter({ parts, label }: { parts: { value: number; color: string; title?: string }[]; label?: ReactNode }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div className="meter">
      <div className="track">{parts.map((p, i) => <i key={i} title={p.title} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />)}</div>
      {label !== undefined && <b>{label}</b>}
    </div>
  );
}

/** Marks seeded case-study inputs so nothing is mistaken for real-world evidence. */
export function CaseTag({ children }: { children?: ReactNode }) {
  return <span className="case-tag" title="Fictional NOVATECH case-study input, not real-world evidence"><FlaskConical size={11} />{children ?? 'Case-study data'}</span>;
}
