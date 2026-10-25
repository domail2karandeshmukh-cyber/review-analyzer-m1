import { useNavigate, Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Clock, ShieldAlert, Siren, Stamp, ClipboardCheck, Wrench, Euro } from 'lucide-react';
import { useRpc, useSession } from '../lib/session';
import { ago, fmtMoney } from '../lib/format';
import { Badge, Card, ErrorBox, Loading, Notice, PageHead, Score } from '../components/ui';
import { HeatMap, KriPill } from '../components/Heat';

const FOCUS: Record<string, { title: string; text: string }> = {
  ceo: { title: 'Executive view', text: 'Enterprise exposure, decisions that policy reserves for the CEO, escalations and post-emergency reviews. Routine technical changes never reach you.' },
  cfo: { title: 'Finance view', text: 'Financial exposure of open incidents, payment decisions within your authority and treatment budgets above the Finance threshold.' },
  rssi: { title: 'Security view', text: 'Security incidents, assessments, containment approvals and emergency authority. Financial decisions stay with Finance.' },
  riskco: { title: 'Coordination view', text: 'Cross-department pipeline, bottlenecks, overdue actions, scenario control and reporting.' },
  itops: { title: 'IT operations view', text: 'Authorised technical tasks ready for execution and routine IT changes executed by your team.' },
  analyst: { title: 'Analyst view', text: 'Incidents assigned to you, evidence and containment recommendations.' },
  auditor: { title: 'Independent oversight', text: 'Read-only access to every decision and the hash-chained audit trail.' },
  hfc: { title: 'Financial crime view', text: 'Fraud holds and account freezes within your authority.' },
  cro: { title: 'Second line of defence', text: 'Dual-control approvals, risk register and reporting.' },
};

export default function Overview() {
  const { orgId, current } = useSession();
  const ov = useRpc<any>('grc_overview', { p_org: orgId }, { poll: 15000 });
  const work = useRpc<any>('grc_my_work', { p_org: orgId }, { poll: 15000 });
  const nav = useNavigate();
  if (ov.error) return <ErrorBox error={ov.error} />;
  if (!ov.data) return <Card><Loading rows={8} /></Card>;
  const d = ov.data;
  const roleKey = current?.role_id.split('-')[1] ?? '';
  const focus = FOCUS[roleKey];
  const tasks = work.data?.tasks ?? [];
  const inc = work.data?.incidents ?? [];
  const hour = new Date().getHours();

  return (
    <div className="stack loose">
      <PageHead eyebrow={d.org.name + (d.org.kind === 'template' ? ' · fictional template' : '')}
        title={`${hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}, ${current?.full_name.split(' ')[0]}`}
        desc={focus ? <><b>{focus.title}.</b> {focus.text}</> : undefined}
        actions={<Link className="btn primary" to="/workspace">Open my workspace <Badge tone="accent">{tasks.length + inc.length}</Badge></Link>} />

      {d.org.kind === 'template' && <Notice kind="warn">Fictional bank used to show the same engine with different roles, thresholds and policies. No real bank, customer or transaction is involved.</Notice>}

      <div className="grid g4">
        <Kpi icon={<ShieldAlert size={14} />} label={d.org.kind === 'primary' ? 'Case register exposure (R1–R6)' : 'Register exposure'} value={d.register.case_total ?? d.matrix.reduce((s: number, r: any) => s + r.score, 0)}
          hint={d.org.kind === 'primary' ? `Top-5 = ${d.register.case_top5} · ${d.register.critical} critical risks` : `${d.register.critical} critical risks`} onClick={() => nav('/risks')} />
        <Kpi icon={<Siren size={14} />} label="Open incidents" value={d.incidents.open} hint={d.incidents.exposure > 0 ? `${fmtMoney(d.incidents.exposure)} financial exposure` : 'No open financial exposure'} onClick={() => nav('/incidents')} />
        <Kpi icon={<Stamp size={14} />} label="Awaiting approval" value={d.actions.awaiting_approval} hint={d.actions.emergency_open_reviews ? `${d.actions.emergency_open_reviews} post-emergency review(s) open` : 'Routed by policy'} onClick={() => nav('/approvals')} />
        <Kpi icon={<Clock size={14} />} label="Overdue actions" value={d.actions.overdue} hint={`${d.actions.in_execution} in execution · ${d.actions.awaiting_verification} to verify`} tone={d.actions.overdue ? 'danger' : undefined} onClick={() => nav('/actions')} />
      </div>

      <div className="grid g-main">
        <div className="stack loose">
          <Card title="Requires your action" sub="Only items your role is authorised to act on" flush actions={<Link to="/workspace" className="btn sm ghost">All <ArrowRight size={14} /></Link>}>
            {tasks.length + inc.length === 0 ? <div className="empty">Nothing waiting for you.</div> : <>
              {inc.slice(0, 4).map((i: any) => (
                <div key={i.id} className="list-row click" onClick={() => nav(`/incidents/${i.id}`)}>
                  <Siren size={16} color="var(--danger)" />
                  <div className="grow"><div className="small strong">{i.title}</div><div className="xs muted"><span className="mono">{i.ref}</span> · {TASK[i.task]}</div></div>
                  <Badge tone="danger">{TASK[i.task]}</Badge>
                </div>))}
              {tasks.slice(0, 6).map((a: any) => (
                <div key={a.id} className="list-row click" onClick={() => nav(`/actions/${a.id}`)}>
                  {TASK_ICON[a.task]}
                  <div className="grow"><div className="small strong">{a.title}</div><div className="xs muted"><span className="mono">{a.ref}</span> · {a.type_name}{a.amount != null && ` · ${fmtMoney(a.amount)}`}</div></div>
                  <Badge tone={a.task === 'post_review' ? 'critical' : a.task === 'approve' ? 'warning' : 'accent'}>{TASK[a.task]}</Badge>
                </div>))}
            </>}
          </Card>

          <Card title="Departments" sub="Risk ownership and open treatment by department" flush actions={<Link to="/departments" className="btn sm ghost">Details <ArrowRight size={14} /></Link>}>
            <div className="table-wrap"><table className="t">
              <thead><tr><th>Department</th><th>Risks</th><th>Highest score</th><th>Open actions</th></tr></thead>
              <tbody>{d.departments.filter((x: any) => x.risks > 0 || x.open_actions > 0).map((x: any) => (
                <tr key={x.id}><td className="strong">{x.name}</td><td>{x.risks}</td><td>{x.max_score ? <Score score={x.max_score} /> : '—'}</td><td>{x.open_actions}</td></tr>))}</tbody>
            </table></div>
          </Card>

          <Card title="Recent governance activity" flush actions={<Link to="/audit" className="btn sm ghost">Audit trail <ArrowRight size={14} /></Link>}>
            {d.recent.map((e: any) => (
              <div key={e.id} className="list-row"><span className={`badge t-${STAGE_TONE[e.stage] ?? 'neutral'}`} style={{ minWidth: 76, justifyContent: 'center' }}>{e.stage}</span>
                <div className="grow"><div className="small">{e.summary}</div><div className="xs muted">{e.actor} · {e.role} · {ago(e.at)}</div></div></div>))}
          </Card>
        </div>

        <div className="stack loose">
          <Card title="Risk heat map" sub="Teacher scale · likelihood × impact (1–4)">
            <HeatMap items={d.matrix.map((r: any) => ({ id: r.id, code: r.code, l: r.l, i: r.i, title: r.title }))} />
          </Card>
          {d.kri.length > 0 && (
            <Card title="Key risk indicators" sub="Live readings from the monitoring pipeline" flush actions={<Link to="/risks?tab=monitoring" className="btn sm ghost">Monitor <ArrowRight size={14} /></Link>}>
              {d.kri.map((k: any) => (
                <div key={k.risk} className="list-row">
                  <Badge>{k.risk}</Badge>
                  <div className="grow small">{k.state?.kri}<div className="xs muted">warning {k.state?.warning} · critical {k.state?.critical}</div></div>
                  <KriPill s={k.state} />
                </div>))}
            </Card>
          )}
          <Card title="Treatment pipeline">
            <div className="stack tight small">
              {[['Draft / review', (d.actions.by_status.draft ?? 0) + (d.actions.by_status.under_review ?? 0) + (d.actions.by_status.submitted ?? 0)],
                ['Awaiting approval', d.actions.awaiting_approval], ['In execution', d.actions.in_execution],
                ['Awaiting verification', d.actions.awaiting_verification], ['Completed & verified', d.actions.completed]].map(([l, n]) => (
                <div key={l as string} className="row between"><span>{l}</span><b>{n as number}</b></div>))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export const TASK: Record<string, string> = {
  approve: 'Decision required', post_review: 'Post-emergency review', assess: 'Assessment required', respond_info: 'Answer approver',
  execute: 'Ready to execute', record_execution: 'Record result', verify: 'Verify', submit: 'Submit draft',
  investigate: 'Open investigation', assess_security: 'Security assessment', assess_financial: 'Financial assessment', follow_up: 'Follow up',
};
export const TASK_ICON: Record<string, React.ReactNode> = {
  approve: <Stamp size={16} color="var(--warning)" />, post_review: <AlertTriangle size={16} color="var(--critical)" />, assess: <ShieldAlert size={16} color="var(--info)" />,
  respond_info: <AlertTriangle size={16} color="var(--info)" />, execute: <Wrench size={16} color="var(--accent)" />, record_execution: <Wrench size={16} color="var(--accent)" />,
  verify: <ClipboardCheck size={16} color="var(--success)" />, submit: <ArrowRight size={16} />, assess_financial: <Euro size={16} />,
};
const STAGE_TONE: Record<string, string> = { detect: 'info', assess: 'info', authorise: 'warning', execute: 'accent', verify: 'success', scenario: 'muted', admin: 'muted', governance: 'neutral' };

function Kpi({ icon, label, value, hint, onClick, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string; onClick?: () => void; tone?: string }) {
  return (
    <div className="card kpi link" onClick={onClick} role="button" tabIndex={0}>
      <div className="label">{icon}{label}</div>
      <div className="value" style={{ color: tone === 'danger' ? 'var(--danger)' : undefined }}>{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}
