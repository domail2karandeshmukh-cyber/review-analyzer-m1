import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, X, Siren, ArrowUp } from 'lucide-react';
import { fmtDateTime, initials } from '../lib/format';

/* ---------------- Seal stamp (the one orchestrated motion) ---------------- */
type StampT = { word: string; who: string; role?: string; meta?: string; color?: string };
const StampCtx = createContext<(s: StampT) => void>(() => {});
export function StampProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<(StampT & { k: number }) | null>(null);
  const show = useCallback((x: StampT) => { const k = Date.now(); setS({ ...x, k }); setTimeout(() => setS(c => (c?.k === k ? null : c)), 1950); }, []);
  return (
    <StampCtx.Provider value={show}>
      {children}
      {s && (
        <div className="stamp-overlay" key={s.k} aria-live="polite">
          <div className="stamp" style={{ ['--seal-c' as any]: s.color }}>
            <div>
              <div className="s-word">{s.word}</div>
              <div className="s-who">{s.who}</div>
              {s.role && <div className="s-role">{s.role}</div>}
              {s.meta && <div className="s-meta">{s.meta}</div>}
            </div>
          </div>
        </div>
      )}
    </StampCtx.Provider>
  );
}
export const useStamp = () => useContext(StampCtx);

/* ---------------- Authority rail ---------------- */
type Link = { kind: string; title: string; who?: string | null; role?: string | null; at?: string | null; note?: string | null; hash?: string | null;
  state: 'sealed' | 'verified' | 'rejected' | 'now' | 'emerg' | 'future'; mark?: ReactNode };

export function buildRail(a: any): Link[] {
  const tl: any[] = a.timeline ?? [];
  const ev = (types: string[], nth = 0) => tl.filter(t => types.includes(t.event))[nth];
  const st = a.status as string;
  const L: Link[] = [];
  const propose = ev(['action_proposed']);
  L.push({ kind: 'Requested', title: a.people.requested_by?.name ?? '—', role: a.people.requested_by?.role, at: propose?.at ?? a.created_at, hash: propose?.hash,
    state: ['draft', 'reopened'].includes(st) ? 'now' : 'sealed', note: ['draft', 'reopened'].includes(st) ? 'Draft — not yet submitted' : null });

  if (a.type.assessor) {
    const as = ev(['action_assessed', 'assessment_not_recommended']);
    const done = !!a.assessed_by;
    L.push({ kind: 'Assessment', title: done ? a.assessed_by.name : a.type.assessor, role: done ? a.assessed_by.role : 'Designated assessor', at: as?.at, hash: as?.hash,
      note: done ? a.assessment : null,
      state: st === 'under_review' ? 'now' : done ? (ev(['assessment_not_recommended']) ? 'rejected' : 'sealed') : 'future' });
  }
  if (a.emergency) {
    const em = ev(['emergency_invoked']);
    L.push({ kind: 'Emergency procedure', title: em?.actor ?? 'Emergency authority', role: em?.role, at: em?.at, hash: em?.hash, note: a.emergency_reason, state: 'emerg', mark: <Siren size={17} /> });
  }
  const pre = (a.approvals ?? []).filter((x: any) => x.kind === 'pre');
  if (pre.length === 0 && !['draft', 'under_review', 'submitted', 'reopened', 'cancelled'].includes(st) && !(st === 'rejected' && a.assessed_by)) {
    const au = ev(['auto_authorised']);
    L.push({ kind: 'Authorisation', title: 'Authorised by policy', role: 'No approval rule matched', at: au?.at, hash: au?.hash, state: 'sealed', mark: <Check size={17} /> });
  }
  pre.forEach((p: any) => {
    L.push({
      kind: `Approval · step ${p.step}`, title: p.decided_by ? p.decided_by.name : p.role,
      role: p.decided_by ? `${p.role}${p.on_behalf_of ? ` · on behalf of ${p.on_behalf_of.name}` : ''}` : (p.eligible?.length ? p.eligible.join(', ') : 'No active holder'),
      at: p.decided_at, note: p.comment ?? (p.status === 'pending' || p.status === 'waiting' ? p.rationale : null),
      hash: tl.find(t => ['approval_granted', 'approval_rejected', 'approval_escalated'].includes(t.event) && t.summary?.includes(`step ${p.step}`))?.hash
        ?? tl.find(t => t.event === 'approval_escalated' && p.status === 'escalated')?.hash,
      state: p.status === 'approved' ? 'sealed' : p.status === 'rejected' ? 'rejected' : (p.status === 'pending' || p.status === 'info_requested') && ['awaiting_approval', 'escalated', 'submitted'].includes(st) ? 'now' : 'future',
      mark: p.status === 'escalated' ? <ArrowUp size={17} /> : undefined,
    });
  });
  const exe = ev(['execution_completed', 'execution_failed']);
  const execRec = (a.evidence ?? []).find((e: any) => e.kind === 'execution_record' || e.kind === 'device_report');
  L.push({ kind: 'Execution', title: a.people.executor?.name ?? (a.type.executors.join(' / ') || 'Responsible employee'), role: a.people.executor?.role ?? 'Authorised executor',
    at: exe?.at, hash: exe?.hash, note: execRec ? `${execRec.label ?? ''} ${execRec.summary}`.trim() : null,
    state: st === 'failed' ? 'rejected' : ['approved', 'scheduled', 'in_progress'].includes(st) ? 'now' : execRec ? 'sealed' : 'future' });
  const ver = ev(['verification_passed']);
  const lastVer = [...(a.evidence ?? [])].reverse().find((e: any) => e.kind === 'verification');
  L.push({ kind: 'Verification', title: ver ? ver.actor : 'Independent verifier', role: ver ? ver.role : 'Anyone with verification right except the executor',
    at: ver?.at, hash: ver?.hash, note: ver ? 'All criteria passed' : lastVer ? 'Last attempt failed — criteria not met' : null,
    state: st === 'completed' ? 'verified' : st === 'awaiting_verification' ? 'now' : 'future' });
  (a.approvals ?? []).filter((x: any) => x.kind === 'post_review').forEach((p: any) => {
    L.push({ kind: 'Post-emergency review', title: p.decided_by ? p.decided_by.name : p.role, role: p.decided_by ? p.role : (p.eligible ?? []).join(', '),
      at: p.decided_at, note: p.comment, hash: tl.find(t => t.event?.startsWith('post_emergency_review'))?.hash,
      state: p.status === 'approved' ? 'sealed' : p.status === 'rejected' ? 'rejected' : 'now' });
  });
  if (['rejected', 'cancelled'].includes(st)) L.forEach(l => { if (l.state === 'future' || l.state === 'now') l.state = 'future'; });
  return L;
}

export function AuthorityRail({ links, action }: { links: Link[]; action?: ReactNode }) {
  let nowShown = false;
  return (
    <div className="rail">
      {links.map((l, i) => {
        const isNow = l.state === 'now' && !nowShown;
        if (isNow) nowShown = true;
        const cls = l.state === 'sealed' ? 'sealed' : l.state === 'verified' ? 'verified' : l.state === 'rejected' ? 'rejected' : l.state === 'emerg' ? 'emerg' : isNow ? 'now' : 'future';
        const next = links[i + 1];
        const linkCls = (l.state === 'sealed' || l.state === 'emerg') && next && next.state !== 'future' ? 'sealed-ink' : l.state === 'verified' ? 'done' : '';
        return (
          <div key={i} className={`rail-link ${linkCls}`}>
            <div className={`seal-mark ${cls}`} aria-hidden>
              {l.mark ?? (l.state === 'rejected' ? <X size={17} /> : l.state === 'future' || isNow ? i + 1 : initials(l.title))}
            </div>
            <div className="rail-body">
              <div className="rail-kind">{l.kind}{l.state === 'rejected' && ' — refused'}</div>
              <div className="rail-title">{l.title}</div>
              {l.role && <div className="rail-meta">{l.role}</div>}
              {l.at && <div className="rail-meta">{fmtDateTime(l.at)}</div>}
              {l.note && <div className="small" style={{ marginTop: 3, color: 'var(--ink-2)' }}>{l.note}</div>}
              {l.hash && <div className="rail-hash">sealed #{l.hash}</div>}
              {isNow && action && <div className="rail-now-slot">{action}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
