import { useNavigate, Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, ShieldAlert, Siren, Stamp, ClipboardCheck, Wrench, Euro, Search, PenLine } from 'lucide-react';
import { useRpc, useSession } from '../lib/session';
import { ago, fmtMoney } from '../lib/format';
import { Badge, Card, ErrorBox, Loading, Notice, Score } from '../components/ui';
import { HeatMap, KriPill } from '../components/Heat';

const LENS: Record<string, string> = {
  ceo: 'You see enterprise exposure, decisions policy reserves for the CEO, escalations and emergency reviews. Routine technical changes never reach you.',
  cfo: 'You see financial exposure, payment decisions within your authority, and treatment budgets above the Finance threshold.',
  rssi: 'You see security incidents, assessments and containment approvals, and you hold emergency authority. Payment decisions stay with Finance.',
  riskco: 'You see the whole pipeline: bottlenecks, overdue actions, scenarios and reporting.',
  itops: 'You see authorised technical work ready to execute, and routine IT changes your team carries out.',
  analyst: 'You see incidents assigned to you. You investigate, record evidence and recommend containment.',
  auditor: 'Read-only. Every decision and the sealed audit chain are open to you.',
  hfc: 'You decide fraud holds and account freezes within your authority.',
  cro: 'Second line of defence: dual-control approvals, the register and reporting.',
};

export const TASK: Record<string, string> = {
  approve: 'Your decision', post_review: 'Review an emergency decision', assess: 'Your assessment', respond_info: 'Answer the approver',
  execute: 'Ready for you to execute', record_execution: 'Record the result', verify: 'Verify the result', submit: 'Submit your draft',
  investigate: 'Open the investigation', assess_security: 'Security assessment', assess_financial: 'Financial assessment', follow_up: 'Follow up',
};
export const TASK_ICON: Record<string, React.ReactNode> = {
  approve: <Stamp size={16} />, post_review: <AlertTriangle size={16} />, assess: <ShieldAlert size={16} />, respond_info: <PenLine size={16} />,
  execute: <Wrench size={16} />, record_execution: <Wrench size={16} />, verify: <ClipboardCheck size={16} />, submit: <ArrowRight size={16} />,
  investigate: <Search size={16} />, assess_security: <ShieldAlert size={16} />, assess_financial: <Euro size={16} />, follow_up: <Siren size={16} />,
};
export const TASK_TONE: Record<string, string> = {
  approve: 'approve', post_review: 'critical', assess: 'approve', respond_info: 'approve', execute: 'go', record_execution: 'go', verify: 'verify', submit: '',
  investigate: 'critical', assess_security: 'approve', assess_financial: 'approve', follow_up: '',
};

export default function Overview() {
  const { orgId, current } = useSession();
  const ov = useRpc<any>('grc_overview', { p_org: orgId }, { poll: 15000 });
  const work = useRpc<any>('grc_my_work', { p_org: orgId }, { poll: 15000 });
  const nav = useNavigate();
  if (ov.error) return <ErrorBox error={ov.error} />;
  if (!ov.data) return <Card><Loading rows={8} /></Card>;
  const d = ov.data;
  const lens = LENS[current?.role_id.split('-')[1] ?? ''];
  const tasks = work.data?.tasks ?? [];
  const inc = work.data?.incidents ?? [];
  const queue = [...inc.map((i: any) => ({ ...i, kind: 'incident' })), ...tasks.map((t: any) => ({ ...t, kind: 'action' }))];
  const n = queue.length;
  const hour = new Date().getHours();
  const total = d.register.case_total ?? d.matrix.reduce((s: number, r: any) => s + r.score, 0);

  return (
    <div className="stack loose">
      <section className="briefing">
        <div className="ring" /><div className="ring r2" />
        <div className="who">{hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}, {current?.full_name.split(' ')[0]}. {current?.role}, {d.org.name}.</div>
        <h1>
          {n === 0 ? <>Nothing needs your decision right now.</> : <><b>{n} {n === 1 ? 'item needs' : 'items need'} you.</b></>}{' '}
          {d.incidents.open === 0 ? <>No incident is open.</> : <>{d.incidents.open} open {d.incidents.open === 1 ? 'incident' : 'incidents'}{d.incidents.exposure > 0 && <> with <b>{fmtMoney(d.incidents.exposure)}</b> at stake</>}.</>}
        </h1>
        <div className="facts">
          <div className="fact"><div className="v">{total}</div><div className="k">{d.org.kind === 'primary' ? `Case exposure R1–R6, top five ${d.register.case_top5}` : 'Register exposure'}</div></div>
          <div className="fact"><div className="v">{d.register.critical}</div><div className="k">Critical risks</div></div>
          <div className="fact"><div className="v">{d.actions.awaiting_approval}</div><div className="k">Awaiting approval</div></div>
          <div className="fact"><div className="v">{d.actions.awaiting_verification}</div><div className="k">Awaiting verification</div></div>
          <div className="fact"><div className="v" style={{ color: d.actions.overdue ? '#ffb4a3' : undefined }}>{d.actions.overdue}</div><div className="k">Overdue</div></div>
          {d.actions.emergency_open_reviews > 0 && <div className="fact"><div className="v" style={{ color: '#ff9aa5' }}>{d.actions.emergency_open_reviews}</div><div className="k">Emergency reviews open</div></div>}
        </div>
        {lens && <p style={{ marginTop: 18, color: '#9fb0cf', maxWidth: '78ch', fontSize: 13.5 }}>{lens}</p>}
      </section>

      {d.org.kind === 'template' && <Notice kind="warn">Banque Atlantique is fictional. It shows the same engine running with a bank's roles, thresholds and policy. No real bank, customer or transaction is involved.</Notice>}

      <div className="grid g-main" style={{ alignItems: 'start' }}>
        <div className="stack loose">
          <Card title="Your queue" sub="Only items your role is authorised to act on, in order of urgency" flush actions={<Link to="/workspace" className="btn sm ghost">Open workspace <ArrowRight size={14} /></Link>}>
            {n === 0 ? <div className="empty">You are up to date. New decisions appear here and in the notification bell.</div> :
              queue.slice(0, 8).map((x: any) => (
                <div key={x.id} className="queue-row" onClick={() => nav(x.kind === 'incident' ? `/incidents/${x.id}` : `/actions/${x.id}`)} role="button" tabIndex={0}>
                  <div className={`q-ic ${TASK_TONE[x.task] ?? ''}`}>{TASK_ICON[x.task]}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="small strong" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.title}</div>
                    <div className="xs muted"><span className="mono">{x.ref}</span> {x.kind === 'action' ? x.type_name : 'incident'}{x.amount != null && `, ${fmtMoney(x.amount)}`}</div>
                  </div>
                  <span className="small strong" style={{ color: x.task === 'post_review' || x.kind === 'incident' ? 'var(--critical)' : 'var(--ink-2)' }}>{TASK[x.task]}</span>
                </div>
              ))}
          </Card>

          <Card title="Latest sealed entries" flush actions={<Link to="/audit" className="btn sm ghost">Audit trail <ArrowRight size={14} /></Link>}>
            <div className="ledger">
              {d.recent.map((e: any) => (
                <div key={e.id} className="ledger-row ok" style={{ gridTemplateColumns: '26px 1fr', cursor: 'default' }}>
                  <div className="knot" />
                  <div><div className="small">{e.summary}</div><div className="xs muted">{e.actor}, {e.role}, {ago(e.at)}</div></div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Departments" sub="Who owns which risk, and how much treatment is open" flush actions={<Link to="/departments" className="btn sm ghost">Departments <ArrowRight size={14} /></Link>}>
            <div className="table-wrap"><table className="t">
              <thead><tr><th>Department</th><th>Risks owned</th><th>Highest score</th><th>Open actions</th></tr></thead>
              <tbody>{d.departments.filter((x: any) => x.risks > 0 || x.open_actions > 0).map((x: any) => (
                <tr key={x.id}><td className="strong">{x.name}</td><td>{x.risks}</td><td>{x.max_score ? <Score score={x.max_score} /> : '—'}</td><td>{x.open_actions}</td></tr>))}</tbody>
            </table></div>
          </Card>
        </div>

        <div className="stack loose">
          <Card title="Risk landscape" sub="Likelihood × impact on the 1–4 teacher scale">
            <HeatMap items={d.matrix.map((r: any) => ({ id: r.id, code: r.code, l: r.l, i: r.i, title: r.title }))} />
          </Card>
          {d.kri.length > 0 && (
            <Card title="Early-warning indicators" sub="Latest readings from the monitoring pipeline" flush actions={<Link to="/risks?tab=monitoring" className="btn sm ghost">Monitor</Link>}>
              {d.kri.map((k: any) => (
                <div key={k.risk} className="list-row">
                  <Badge>{k.risk}</Badge>
                  <div className="grow small">{k.state?.kri}<div className="xs muted">Warning at {k.state?.warning}, critical at {k.state?.critical}</div></div>
                  <KriPill s={k.state} />
                </div>))}
            </Card>
          )}
          <Card title="Treatment pipeline">
            <div className="stack tight small">
              {[['Draft or in review', (d.actions.by_status.draft ?? 0) + (d.actions.by_status.under_review ?? 0) + (d.actions.by_status.submitted ?? 0)],
                ['Awaiting approval', d.actions.awaiting_approval], ['Authorised or executing', d.actions.in_execution],
                ['Awaiting verification', d.actions.awaiting_verification], ['Completed and verified', d.actions.completed]].map(([l, v]) => (
                <div key={l as string} className="row between" style={{ padding: '3px 0', borderBottom: '1px dashed var(--line)' }}><span>{l}</span><b style={{ fontVariantNumeric: 'tabular-nums' }}>{v as number}</b></div>))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
