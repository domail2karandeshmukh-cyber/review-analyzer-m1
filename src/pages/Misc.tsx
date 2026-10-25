import { Link } from 'react-router-dom';
import { Printer, Cpu, ShieldOff, ShieldCheck } from 'lucide-react';
import { useRpc, useSession } from '../lib/session';
import { fmtDateTime, fmtMoney } from '../lib/format';
import { Badge, Card, Level, Loading, Notice, PageHead, Person, Score, Status } from '../components/ui';
import { KriPill } from '../components/Heat';

export function Departments() {
  const { orgId } = useSession();
  const org = useRpc<any>('grc_org', { p_org: orgId });
  const risks = useRpc<any[]>('grc_risks', { p_org: orgId });
  const acts = useRpc<any[]>('grc_actions', { p_org: orgId });
  if (!org.data || !risks.data || !acts.data) return <Card><Loading rows={8} /></Card>;
  const depts = org.data.departments.filter((d: any) => !d.parent_id || risks.data!.some(r => r.department_id === d.id));
  return (
    <>
      <PageHead title="Departments" desc="Each department owns its risks through an accountable owner. Cross-department risks (e.g. finance-system access) name Finance as owner and the RSSI as consulted." />
      <div className="grid g2">
        {depts.map((d: any) => {
          const rs = risks.data!.filter(r => r.department_id === d.id);
          const roles = org.data.roles.filter((r: any) => r.department === d.name);
          const open = acts.data!.filter(a => rs.some(r => r.id === a.risk_id) && !['completed', 'cancelled', 'rejected'].includes(a.status));
          return (
            <Card key={d.id} title={d.name} sub={d.description}>
              <div className="stack">
                <div className="row wrap">{roles.map((r: any) => <Badge key={r.id} tone="neutral">{r.name}{r.holders.length ? ` · ${r.holders.join(', ')}` : ''}</Badge>)}</div>
                {rs.length === 0 ? <div className="small muted">No risk owned by this department.</div> : rs.map(r => (
                  <Link key={r.id} to={`/risks?r=${r.id}`} className="row" style={{ color: 'inherit' }}>
                    <Badge>{r.code}</Badge><span className="small grow">{r.title}</span>{r.kri && <KriPill s={r.kri} />}<Score score={r.score} />
                  </Link>))}
                <div className="xs muted">{open.length} open treatment action(s)</div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

export function Assets() {
  const { orgId } = useSession();
  const org = useRpc<any>('grc_org', { p_org: orgId });
  if (!org.data) return <Card><Loading rows={8} /></Card>;
  const devices = org.data.assets.filter((a: any) => a.device);
  return (
    <>
      <PageHead title="Assets and devices" desc="Asset criticality (1–4) drives the approval policy: interrupting a criticality-4 client-facing service brings the CEO into the decision." />
      <div className="stack loose">
        <Card flush title="Asset inventory">
          <div className="table-wrap"><table className="t responsive">
            <thead><tr><th>Asset</th><th>Type</th><th>Criticality</th><th>Business service</th><th>Department</th><th>Owner role</th></tr></thead>
            <tbody>{org.data.assets.map((a: any) => (
              <tr key={a.id}><td className="primary"><div className="cell-title">{a.name}</div><div className="cell-sub mono">{a.id}</div></td>
                <td data-label="Type" className="small">{a.type}</td>
                <td data-label="Criticality"><Badge tone={a.criticality >= 4 ? 'critical' : a.criticality === 3 ? 'danger' : a.criticality === 2 ? 'warning' : 'success'}>{a.criticality}</Badge></td>
                <td data-label="Service" className="small">{a.service}</td><td data-label="Department" className="small">{a.department}</td><td data-label="Owner" className="small">{a.owner_role}</td></tr>))}</tbody>
          </table></div>
        </Card>
        <Card title={<span className="row"><Cpu size={16} />Controlled device actions</span>} sub="Real execution on an explicitly enrolled test device — disabled by default">
          <div className="stack">
            {devices.length === 0 ? <Notice kind="info"><b>No device is enrolled.</b> Every action in this platform is currently a <span className="badge label-sim">SIMULATED ACTION</span>. Real execution requires an IT administrator to enrol a lab machine, issue it a separate device credential and enable it.</Notice> :
              devices.map((a: any) => <div key={a.id} className="row between"><div><b>{a.device.name}</b><div className="xs muted">{a.name} · {a.device.platform ?? 'unknown platform'} · last seen {fmtDateTime(a.device.last_seen_at)}</div></div>
                {a.device.enabled ? <Badge tone="success"><ShieldCheck size={12} />Enabled · {a.device.allowed_commands.join(', ')}</Badge> : <Badge tone="muted"><ShieldOff size={12} />Disabled</Badge>}</div>)}
            <div className="grid g2 small">
              <div className="stack tight"><div className="section-title">Safeguards</div>
                <div>• Only enrolled lab devices; never the presentation laptop or devices reached by a link.</div>
                <div>• Allow-list of commands (notify, lock screen). No remote shell.</div>
                <div>• Separate device token; the device pulls commands, nothing is pushed into it.</div>
                <div>• Command only after full approval, with a cancellation window and expiry.</div>
                <div>• The device reports its own result; the platform never fabricates “success”.</div></div>
              <div className="stack tight"><div className="section-title">Labels</div>
                <div><span className="badge label-sim">SIMULATED ACTION</span> recorded by a person in the platform; no system changed.</div>
                <div><span className="badge label-dev">EXECUTED ON ENROLLED TEST DEVICE</span> reported by the device agent after it ran the command.</div></div>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

export function Reports() {
  const { orgId, current } = useSession();
  const ov = useRpc<any>('grc_overview', { p_org: orgId });
  const risks = useRpc<any[]>('grc_risks', { p_org: orgId });
  const acts = useRpc<any[]>('grc_actions', { p_org: orgId });
  const inc = useRpc<any[]>('grc_incidents', { p_org: orgId });
  if (!ov.data || !risks.data || !acts.data || !inc.data) return <Card><Loading rows={8} /></Card>;
  const d = ov.data;
  const reduced = risks.data.filter(r => r.residual_score);
  return (
    <>
      <PageHead title="Management risk report" desc={`${d.org.name} · generated ${fmtDateTime(new Date().toISOString())} by ${current?.full_name}. All figures are computed from live records.`}
        actions={<button className="btn primary no-print" onClick={() => window.print()}><Printer size={15} />Print / save as PDF</button>} />
      <div className="stack loose">
        <div className="grid g4">
          <Card><div className="kpi" style={{ padding: 0 }}><div className="label">Case register exposure</div><div className="value">{d.register.case_total ?? '—'}</div><div className="hint">Top-5 {d.register.case_top5 ?? '—'}</div></div></Card>
          <Card><div className="kpi" style={{ padding: 0 }}><div className="label">Critical risks</div><div className="value">{d.register.critical}</div><div className="hint">{d.register.high} high</div></div></Card>
          <Card><div className="kpi" style={{ padding: 0 }}><div className="label">Open incidents</div><div className="value">{d.incidents.open}</div><div className="hint">{fmtMoney(d.incidents.exposure)} exposure</div></div></Card>
          <Card><div className="kpi" style={{ padding: 0 }}><div className="label">Verified actions</div><div className="value">{d.actions.completed}</div><div className="hint">{d.actions.overdue} overdue</div></div></Card>
        </div>
        <Card title="1. Risk register" flush>
          <table className="t"><thead><tr><th>Risk</th><th>Owner</th><th>Inherent</th><th>Residual</th><th>Treatment</th></tr></thead>
            <tbody>{risks.data.map(r => <tr key={r.id}><td><b>{r.code}</b> {r.title}</td><td className="small">{r.owner?.name}<div className="cell-sub">{r.owner?.role}</div></td><td><span className="row"><Score score={r.score} /><Level score={r.score} /></span></td><td>{r.residual_score ? <Score score={r.residual_score} /> : '—'}</td><td className="small">{r.open_actions} open · {r.completed_actions} verified</td></tr>)}</tbody></table>
        </Card>
        {reduced.length > 0 && <Card title="2. Measured risk reduction">
          <div className="stack tight small">{reduced.map(r => <div key={r.id}><b>{r.code}</b>: {r.score} → {r.residual_score} — {Math.round((r.score - r.residual_score) / r.score * 100)}% reduction in the assessed risk score (recorded by the verifier).</div>)}</div>
        </Card>}
        <Card title={`${reduced.length ? 3 : 2}. Actions`} flush>
          <table className="t"><thead><tr><th>Action</th><th>Status</th><th>Accountable</th><th>Next step</th></tr></thead>
            <tbody>{acts.data.map(a => <tr key={a.id}><td><span className="mono small">{a.ref}</span> {a.title}{a.emergency && <> <Badge tone="critical">Emergency</Badge></>}</td><td><Status s={a.status} /></td><td className="small">{a.accountable}</td><td className="small">{a.next?.title}</td></tr>)}</tbody></table>
        </Card>
        <Card title={`${reduced.length ? 4 : 3}. Incidents`} flush>
          {inc.data.length === 0 ? <div className="empty small">No active incidents.</div> :
            <table className="t"><thead><tr><th>Incident</th><th>Status</th><th>Investigator</th><th>Exposure</th></tr></thead>
              <tbody>{inc.data.map(i => <tr key={i.id}><td><span className="mono small">{i.ref}</span> {i.title}</td><td><Status s={i.status} /></td><td className="small">{i.assigned_to?.name}</td><td className="small">{fmtMoney(i.financial_exposure)}</td></tr>)}</tbody></table>}
        </Card>
        <div className="xs muted">Academic demonstration (ESAIP · Group 1). Detection feeds are simulated; decisions, permissions and audit records are real platform data. KRI thresholds are demonstration assumptions to be calibrated with historical data and management-approved risk appetite.</div>
      </div>
    </>
  );
}

export function Guide() {
  const { current, memberships } = useSession();
  return (
    <>
      <PageHead title="Guide" desc="A short guide for presenters and for anyone exploring the platform independently." />
      <div className="grid g-main">
        <div className="stack loose">
          <Card title="The five stages">
            <div className="stack small">
              <div><b>1 · Detect</b> — an alert, KRI threshold or person reports an incident. Monitoring alerts notify the risk owner but never authorise an action.</div>
              <div><b>2 · Assess</b> — the analyst investigates; the RSSI records the security assessment; Finance records the financial assessment. Each can only record their own.</div>
              <div><b>3 · Authorise</b> — the policy engine decides the approvers from action type, severity, asset criticality, amount and delegation. Requesters cannot approve themselves; dual-control steps need different people.</div>
              <div><b>4 · Execute</b> — only a role allowed to execute that action type can start, and only after authorisation (or a recorded emergency). Executions are labelled SIMULATED unless performed by an enrolled device.</div>
              <div><b>5 · Verify</b> — someone other than the executor runs verification. Criteria are checked against data (execution record, live KRI, post-emergency review). Only then is the action completed and residual risk recorded.</div>
            </div>
          </Card>
          <Card title="Demonstration script (Scenario A — about 6 minutes)">
            <ol className="small" style={{ margin: 0, paddingLeft: 18 }}>
              <li><b>Karan</b> starts Scenario A in the Scenario Center.</li>
              <li><b>Nandini</b> opens the incident and starts the investigation.</li>
              <li><b>Vijay</b> records the security assessment; <b>Srija</b> records the financial assessment.</li>
              <li><b>Nandini</b> proposes two responses: disable account fin.user07, and hold the €184,500 payment. The policy route is shown before she submits.</li>
              <li>Show the refusals: Vijay cannot approve the payment hold; Pavan cannot execute before approval.</li>
              <li><b>Vijay</b> assesses and approves the account action. <b>Srija</b> assesses and approves the payment hold; <b>Vandana</b> approves as CEO because it is ≥ €100,000.</li>
              <li><b>Pavan</b> executes the account action; <b>Léa</b> (Accounts Payable) applies the hold.</li>
              <li><b>Vijay</b> and <b>Srija</b> verify. Try verifying without the call-back confirmation first — it fails.</li>
              <li><b>Karan</b> closes the incident and opens the Audit Trail → Verify integrity.</li>
            </ol>
          </Card>
          <Card title="Professor questions → where to answer them">
            <table className="t"><tbody>
              {[
                ['Who can approve this?', 'Approval Center → Who can approve this?'],
                ['What if the Finance Director rejects?', 'Action → Decide → Reject: status Rejected, execution blocked, requester and owner notified.'],
                ['Can the IT Manager shut down a server without approval?', 'Action → Your permissions: “Execution blocked: approval still required…”'],
                ['What if it is urgent?', 'Emergency procedure (RSSI / CEO) with mandatory post-emergency review.'],
                ['How does Finance participate?', 'Scenario A; payment holds need Finance authority; treatment budgets ≥ €10k.'],
                ['What if this were a bank?', 'Switch organisation (sidebar) → Banque Atlantique; Scenario C.'],
                ['How do we know it worked?', 'Verification criteria evaluated against data; evidence; residual risk.'],
                ['Can someone change the history?', 'Audit Trail → Verify integrity (hash chain; updates blocked by the database).'],
              ].map(([q, a]) => <tr key={q}><td className="small strong">{q}</td><td className="small">{a}</td></tr>)}
            </tbody></table>
          </Card>
        </div>
        <div className="stack loose">
          <Card title="Your account">
            <div className="stack">
              <Person p={{ name: current?.full_name ?? '', role: current?.role }} />
              {memberships.map(m => <div key={m.org_id} className="small">{m.org_name}: <b>{m.role}</b></div>)}
              <div className="xs muted">Sign out from the menu at the top right. Passwords are individual; ask the Risk Coordinator if you need a reset.</div>
            </div>
          </Card>
          <Card title="Notifications">
            <div className="small stack tight">
              <div>Notifications are routed to the people who must act (approver role, executor, verifier, risk owner, RACI).</div>
              <div>The in-app centre (bell icon) is the reliable channel. Browser alerts can be enabled from the bell panel and appear while the app is open; background delivery on every phone is not guaranteed.</div>
            </div>
          </Card>
          <Card title="What is real and what is simulated">
            <div className="small stack tight">
              <div><Badge tone="success">Real</Badge> accounts, roles, permissions, approval routing, state changes, evidence, notifications, audit trail, KRI readings.</div>
              <div><Badge tone="warning">Simulated</Badge> detection feeds in scenarios, and technical/financial executions (labelled SIMULATED ACTION).</div>
              <div><Badge tone="muted">Fictional</Badge> Banque Atlantique and demo staff (Léa, Thomas, Camille, Julie).</div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
