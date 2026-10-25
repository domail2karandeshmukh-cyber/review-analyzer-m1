import { useEffect, useState } from 'react';
import { ArrowRight, Siren, Users, Wrench, ShieldCheck, ClipboardCheck } from 'lucide-react';
import { rpc } from '../lib/supabase';
import { fmtMoney } from '../lib/format';
import { Badge, Notice } from './ui';

/** Live answer to “Who can approve this?” — computed by the same policy engine used at submission. */
export function PolicyPreview({ org, actionType, severity, asset, amount, compact }: { org: string; actionType: string; severity: number; asset?: string | null; amount?: number | null; compact?: boolean }) {
  const [p, setP] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!actionType) return;
    let live = true;
    rpc('grc_policy_preview', { p_org: org, p_action_type: actionType, p_severity: severity, p_asset: asset || null, p_amount: amount ?? null })
      .then(d => { if (live) { setP(d); setErr(null); } }).catch(e => live && setErr(e.message));
    return () => { live = false; };
  }, [org, actionType, severity, asset, amount]);
  if (err) return <Notice kind="danger">{err}</Notice>;
  if (!p) return <div className="small muted">Evaluating policy…</div>;
  return (
    <div className="stack">
      <div className="small muted">
        {p.action_type} · severity {p.severity}{p.asset_criticality ? ` · asset criticality ${p.asset_criticality}` : ''}{p.amount ? ` · ${fmtMoney(p.amount)}` : ''}
      </div>
      <div className="row wrap" style={{ alignItems: 'stretch', gap: 6 }}>
        {p.assessor && <Box icon={<ShieldCheck size={14} />} k="Assess" title={p.assessor.role} people={p.assessor.people} />}
        {p.assessor && <ArrowRight size={14} className="muted" style={{ alignSelf: 'center' }} />}
        {p.approvals.length === 0
          ? <Box icon={<ClipboardCheck size={14} />} k="Authorise" title="No approval required" people={[]} tone="success" note="Pre-authorised by policy" />
          : p.approvals.map((s: any, i: number) => (
            <span key={i} className="row" style={{ alignItems: 'stretch', gap: 6 }}>
              <Box icon={<Users size={14} />} k={`Approve · step ${s.step}`} title={s.role} people={s.people} note={compact ? undefined : s.rationale} tone="warning" />
              {i < p.approvals.length - 1 && <ArrowRight size={14} className="muted" style={{ alignSelf: 'center' }} />}
            </span>))}
        <ArrowRight size={14} className="muted" style={{ alignSelf: 'center' }} />
        <Box icon={<Wrench size={14} />} k="Execute" title={p.executors.length ? p.executors.map((e: any) => e.role).join(' / ') : 'Responsible employee'}
          people={p.executors.flatMap((e: any) => e.people)} />
      </div>
      {!compact && (
        <div className="small stack tight">
          <div className="row wrap">
            <Siren size={14} />
            {p.emergency_allowed ? <>Emergency procedure <Badge tone="warning">allowed</Badge> for {p.emergency_roles.join(', ')} — {p.approvals.some((s: any) => s.in_emergency === 'still_required') ? 'but some steps stay mandatory' : 'other approvers review afterwards'}.</>
              : <>Emergency procedure <Badge tone="muted">not allowed</Badge> for this action type.</>}
          </div>
          {p.consulted.length > 0 && <div className="muted">Consulted: {p.consulted.join(', ')}</div>}
          <div className="muted xs">{p.separation_of_duties.join(' · ')}</div>
        </div>
      )}
    </div>
  );
}

function Box({ icon, k, title, people, note, tone }: { icon: React.ReactNode; k: string; title: string; people: string[]; note?: string; tone?: string }) {
  return (
    <div className="card" style={{ padding: '8px 10px', boxShadow: 'none', minWidth: 150, maxWidth: 260, borderColor: tone === 'warning' ? 'var(--warning-line)' : tone === 'success' ? 'var(--success-line)' : undefined }}>
      <div className="xs muted row" style={{ gap: 5 }}>{icon}{k}</div>
      <div className="small strong">{title}</div>
      {people.length > 0 && <div className="xs muted">{people.join(', ')}</div>}
      {note && <div className="xs muted" style={{ marginTop: 3 }}>{note}</div>}
    </div>
  );
}
