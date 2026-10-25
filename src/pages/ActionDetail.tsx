import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight, CheckCircle2, XCircle, HelpCircle, Siren, Play, ClipboardCheck, RotateCcw, Ban, UserCog,
  ShieldCheck, Lock, Unlock, FileText, Flag, MessageSquarePlus, CalendarClock,
} from 'lucide-react';
import { rpc } from '../lib/supabase';
import { useRpc, useSession } from '../lib/session';
import { fmtDateTime, fmtMoney, fmtDate, due, STAGES, stageIndex, STAGE_LABEL, statusOf } from '../lib/format';
import { Badge, Card, ErrorBox, ExecLabel, Field, Level, Loading, Modal, Notice, Person, Progress, Score, Severity, Status, useToast } from '../components/ui';

type Op = { allowed: boolean; reason: string | null };

export default function ActionDetail() {
  const { id } = useParams();
  const { data: a, error, loading, reload } = useRpc<any>('grc_action', { p_id: id }, { poll: 6000 });
  const { bump } = useSession();
  const toast = useToast();
  const [dialog, setDialog] = useState<null | string>(null);

  if (loading && !a) return <Card><Loading rows={6} /></Card>;
  if (error) return <ErrorBox error={error} />;
  if (!a) return null;

  const ops: Record<string, Op> = a.ops;
  const run = async (fn: string, args: Record<string, unknown>, ok: string) => {
    try {
      const r = await rpc(fn, args);
      toast('ok', typeof r === 'string' ? `${ok} → ${statusOf(r).label}` : ok);
      setDialog(null); reload(); bump();
      return r;
    } catch (e: any) { toast('err', e.message); throw e; }
  };

  const stopped = ['rejected', 'cancelled', 'failed', 'blocked'].includes(a.status);
  const curStage = stageIndex[a.status] ?? 1;
  const next = a.next ?? {};
  const pre = a.approvals.filter((x: any) => x.kind === 'pre');
  const post = a.approvals.filter((x: any) => x.kind === 'post_review');

  return (
    <div className="stack loose">
      {/* Header */}
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <div className="eyebrow row wrap">
            <Link to="/actions">Action Plans</Link><span>/</span><span className="mono">{a.ref}</span>
            {a.archived && <Badge tone="muted">Archived scenario run · read-only</Badge>}
          </div>
          <h1>{a.title}</h1>
          <div className="row wrap" style={{ marginTop: 8 }}>
            <Status s={a.status} />
            <Badge tone="neutral">{a.type?.name}</Badge>
            <Severity s={a.severity} />
            <Badge tone={a.priority === 'P1' ? 'danger' : 'neutral'}>{a.priority}</Badge>
            {a.emergency && <Badge tone="critical"><Siren size={12} /> Emergency procedure</Badge>}
            {a.amount != null && <Badge tone="neutral">{fmtMoney(a.amount)}</Badge>}
            <span className={`badge ${a.execution_mode === 'device' ? 'label-dev' : 'label-sim'}`}>{a.execution_mode === 'device' ? 'Device execution' : 'Simulated execution'}</span>
          </div>
        </div>
      </div>

      {/* Stage tracker */}
      <div className="stages" aria-label="Workflow stage">
        {STAGES.map((s, i) => {
          const n = i + 1;
          const cls = n < curStage || a.status === 'completed' ? 'done' : n === curStage ? (stopped ? 'stop' : 'now') : '';
          return <div key={s.key} className={`stage ${cls}`}><div className="n">Stage {n}</div><div className="l">{s.label}</div></div>;
        })}
      </div>

      {/* Next step banner */}
      <div className={`next-banner ${next.stage === 'done' && a.status === 'completed' ? 'done' : stopped ? 'stop' : a.emergency && a.status !== 'completed' ? 'emerg' : ''}`}>
        <div className="ic">{next.stage === 'done' ? (a.status === 'completed' ? <CheckCircle2 size={18} /> : <XCircle size={18} />) : <ArrowRight size={18} />}</div>
        <div className="grow">
          <div className="xs muted" style={{ textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>Next required step · {STAGE_LABEL[next.stage] ?? ''}</div>
          <div className="strong" style={{ fontSize: 15 }}>{next.title}</div>
          {next.actor && <div className="small muted">Responsible: {next.actor}</div>}
          {a.info_request && <div className="small" style={{ marginTop: 4 }}><b>Question from approver:</b> {a.info_request}</div>}
          {a.blocked_reason && <div className="small" style={{ marginTop: 4 }}><b>Note:</b> {a.blocked_reason}</div>}
        </div>
        <ActionButtons ops={ops} a={a} setDialog={setDialog} />
      </div>

      <div className="grid g-main-wide">
        <div className="stack loose">
          {/* Context */}
          <Card title="Risk and business context">
            <dl className="kv">
              <dt>Linked risk</dt><dd>{a.risk ? <span className="row wrap"><Link to={`/risks?r=${a.risk.id}`}><b>{a.risk.code}</b> {a.risk.title}</Link><Score score={a.risk.score} /><Level score={a.risk.score} /></span> : '—'}</dd>
              <dt>Incident</dt><dd>{a.incident ? <Link to={`/incidents/${a.incident.id}`}><span className="mono">{a.incident.ref}</span> · {a.incident.title}</Link> : '—'}</dd>
              <dt>Affected asset</dt><dd>{a.asset ? <span>{a.asset.name} <Badge tone={a.asset.criticality >= 4 ? 'critical' : a.asset.criticality >= 3 ? 'danger' : 'neutral'}>Criticality {a.asset.criticality}</Badge><div className="small muted">{a.asset.service}</div></span> : '—'}</dd>
              <dt>Proposed action</dt><dd>{a.proposed_action || '—'}</dd>
              <dt>Justification</dt><dd>{a.justification || '—'}</dd>
              <dt>Business impact</dt><dd>{a.business_impact || '—'}</dd>
              <dt>Business process</dt><dd>{a.business_process || '—'}</dd>
              <dt>Treatment strategy</dt><dd>{a.treatment_strategy}</dd>
              {a.assessment && <><dt>Assessment</dt><dd>{a.assessment}<div className="small muted">{a.assessed_by?.name} · {a.assessed_by?.role}</div></dd></>}
              {a.emergency_reason && <><dt>Emergency reason</dt><dd>{a.emergency_reason}</dd></>}
            </dl>
          </Card>

          {/* Approval chain */}
          <Card title="Authorisation chain" sub={pre.length === 0 && a.status !== 'draft' && a.status !== 'under_review' ? 'No approval required by policy for this action, severity and amount.' : 'Determined by company policy at submission time'}>
            {a.approvals.length === 0 ? (
              <div className="small muted">{['draft', 'under_review', 'submitted', 'reopened'].includes(a.status) ? 'Approval steps are calculated from policy when the action is submitted (after assessment).' : 'Authorised by policy — no approval step matched.'}</div>
            ) : (
              <div className="chain">
                {[...pre, ...post].map((s: any) => (
                  <div key={s.id} className="chain-step">
                    <div className={`chain-dot ${s.status === 'approved' ? 'ok' : s.status === 'rejected' ? 'no' : s.status === 'pending' || s.status === 'info_requested' ? 'now' : s.status === 'escalated' ? 'esc' : ''}`}>
                      {s.status === 'approved' ? '✓' : s.status === 'rejected' ? '✕' : s.step}
                    </div>
                    <div>
                      <div className="row wrap">
                        <b>{s.role}</b>
                        <Status s={s.status} />
                        {s.kind === 'post_review' && <Badge tone="critical">Post-emergency review</Badge>}
                      </div>
                      <div className="small muted">{s.rationale}</div>
                      {s.decided_by ? (
                        <div className="small" style={{ marginTop: 4 }}>
                          {s.status === 'escalated' ? 'Escalated' : 'Decided'} by <b>{s.decided_by.name}</b>{s.on_behalf_of && <> on behalf of <b>{s.on_behalf_of.name}</b> (delegation)</>} · {fmtDateTime(s.decided_at)}
                          {s.comment && <div className="muted">“{s.comment}”</div>}
                        </div>
                      ) : (
                        <div className="small muted" style={{ marginTop: 4 }}>Authorised people: {s.eligible.length ? s.eligible.join(', ') : 'none active'}{s.comment && <> · “{s.comment}”</>}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Verification */}
          <Card title="Verification criteria" sub="Completion requires every criterion to pass — checked against recorded data, not a button">
            <div className="stack tight">
              {(a.criteria_preview ?? a.criteria).map((c: any) => (
                <div key={c.key} className="row top" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  {c.passed === true ? <CheckCircle2 size={17} color="var(--success)" /> : c.passed === false ? <XCircle size={17} color="var(--danger)" /> : <ClipboardCheck size={17} color="var(--text-3)" />}
                  <div className="grow">
                    <div className="small strong">{c.label}</div>
                    <div className="xs muted">{c.detail ?? critType(c.type)}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Evidence */}
          <Card title="Evidence" sub="Assessments, execution records, verification results and notes" actions={!a.archived && <button className="btn sm" onClick={() => setDialog('note')}><MessageSquarePlus size={14} /> Add note</button>}>
            {a.evidence.length === 0 ? <div className="small muted">No evidence yet.</div> : (
              <div className="stack">
                {a.evidence.map((e: any) => (
                  <div key={e.id} className="card" style={{ padding: 12, boxShadow: 'none' }}>
                    <div className="row wrap between">
                      <div className="row wrap"><Badge tone={e.kind === 'verification' ? (e.summary.startsWith('All') ? 'success' : 'danger') : e.kind === 'execution_record' ? 'accent' : 'neutral'}>{evLabel(e.kind)}</Badge><ExecLabel label={e.label} /></div>
                      <span className="xs muted">{e.by?.name} · {fmtDateTime(e.at)}</span>
                    </div>
                    <div className="small" style={{ marginTop: 6 }}>{e.summary}</div>
                    {e.kind === 'execution_record' && e.data?.simulation_notice && <div className="xs muted" style={{ marginTop: 4 }}>{e.data.simulation_notice} Target: {e.data.target ?? '—'}.</div>}
                    {e.kind === 'verification' && Array.isArray(e.data?.criteria) && (
                      <ul className="xs" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                        {e.data.criteria.map((c: any) => <li key={c.key} style={{ color: c.passed ? 'var(--success)' : 'var(--danger)' }}>{c.passed ? 'PASS' : 'FAIL'} — {c.label}: <span className="muted">{c.detail}</span></li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Timeline */}
          <Card title="Activity timeline" sub="From the hash-chained audit trail">
            <div className="timeline">
              {a.timeline.map((t: any) => (
                <div key={t.id} className="tl">
                  <div className="when">{fmtDateTime(t.at)}</div>
                  <div className={`pip ${t.stage}`} />
                  <div>
                    <div className="what">{t.summary}</div>
                    <div className="who">{t.actor} · {t.role} · <span className="mono">#{t.id} {t.hash}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="stack loose">
          <Card title="Responsibilities" actions={ops.reassign?.allowed && <button className="btn sm" onClick={() => setDialog('reassign')}><UserCog size={14} /> Reassign</button>}>
            <div className="stack">
              <Role label="Requested by" p={a.people.requested_by} />
              <Role label="Responsible (R)" p={a.people.responsible} />
              <Role label="Accountable (A)" p={a.people.accountable} />
              <Role label="Technical executor" p={a.people.executor} fallback={a.type.executors.length ? `Any: ${a.type.executors.join(' / ')}` : 'Responsible employee'} />
              <div className="divider" />
              <div className="section-title" style={{ margin: 0 }}>RACI</div>
              <div className="stack tight">
                {a.raci.map((r: any, i: number) => (
                  <div key={i} className="row"><Badge tone={r.raci === 'A' ? 'accent' : r.raci === 'R' ? 'info' : r.raci === 'C' ? 'warning' : 'muted'}>{r.raci}</Badge><span className="small">{r.employee?.name}</span><span className="xs muted">{r.employee?.role}</span></div>
                ))}
              </div>
            </div>
          </Card>

          <Card title="Your permissions on this action" sub="Computed by the server with the same checks it enforces">
            <div className="stack tight">
              {permRows(a.status).map(k => {
                const o = ops[k]; if (!o) return null;
                return (
                  <div key={k} className="row top" style={{ padding: '5px 0' }}>
                    {o.allowed ? <Unlock size={15} color="var(--success)" /> : <Lock size={15} color="var(--text-3)" />}
                    <div className="grow"><div className="small strong">{OPLABEL[k]}</div>{!o.allowed && <div className="xs muted">{o.reason}</div>}</div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="Why this route?" sub="Policy rules matched for this action">
            <div className="stack tight small">
              <div>Asset criticality: <b>{a.policy.asset_criticality ?? 'n/a'}</b> · Severity: <b>{a.severity}</b>{a.amount != null && <> · Amount: <b>{fmtMoney(a.amount)}</b></>}</div>
              {a.policy.matched_rules.length === 0 ? <div className="muted">No approval rule matches → authorised by policy.</div> :
                a.policy.matched_rules.map((r: any, i: number) => <div key={i} className="row top"><Flag size={14} style={{ marginTop: 3 }} /><div><b>{r.role}</b><div className="muted xs">{r.rationale}{r.in_emergency === 'still_required' ? ' · cannot be bypassed in an emergency' : ' · becomes post-review in an emergency'}</div></div></div>)}
              <div className="divider" />
              <div className="xs muted">Assessor: {a.type.assessor ?? 'none'} · Executors: {a.type.executors.join(', ') || 'responsible employee'} · Emergency procedure: {a.type.emergency_allowed ? 'allowed (RSSI / CEO)' : 'not allowed by policy'}</div>
              <div className="xs muted">Separation of duties: requester ≠ approver · each step a different person · approver ≠ executor · executor ≠ verifier.</div>
            </div>
          </Card>

          <Card title="Plan">
            <dl className="kv" style={{ gridTemplateColumns: '120px 1fr' }}>
              <dt>Deadline</dt><dd>{fmtDate(a.deadline)} <span className={`small ${a.overdue ? '' : 'muted'}`} style={{ color: a.overdue ? 'var(--danger)' : undefined }}>({due(a.deadline)})</span></dd>
              <dt>Progress</dt><dd><Progress value={a.progress} /><span className="xs muted">{a.progress}%</span></dd>
              <dt>Budget</dt><dd>{fmtMoney(a.budget)}</dd>
              <dt>Resources</dt><dd>{a.resources || '—'}</dd>
              {a.scheduled_for && <><dt>Scheduled</dt><dd>{fmtDateTime(a.scheduled_for)}</dd></>}
              <dt>Created</dt><dd>{fmtDateTime(a.created_at)}</dd>
              {a.completed_at && <><dt>Completed</dt><dd>{fmtDateTime(a.completed_at)}</dd></>}
              {(a.residual_likelihood && a.residual_impact) && <><dt>Residual</dt><dd>L{a.residual_likelihood} × I{a.residual_impact} = <Score score={a.residual_likelihood * a.residual_impact} /></dd></>}
            </dl>
          </Card>
        </div>
      </div>

      {dialog && <ActionDialog kind={dialog} a={a} onClose={() => setDialog(null)} run={run} />}
    </div>
  );
}

const OPLABEL: Record<string, string> = {
  submit: 'Submit for review', respond_info: 'Answer information request', cancel: 'Cancel action', assess: 'Assess',
  approve: 'Approve', reject: 'Reject', request_info: 'Request information', escalate: 'Escalate',
  emergency: 'Invoke emergency procedure', schedule: 'Schedule execution', start: 'Execute', record_execution: 'Record execution result',
  verify: 'Verify', reopen: 'Reopen', reassign: 'Reassign responsibilities',
};
function permRows(status: string) {
  if (['draft', 'reopened'].includes(status)) return ['submit', 'cancel', 'approve', 'start'];
  if (status === 'under_review') return ['assess', 'approve', 'emergency', 'start'];
  if (['awaiting_approval', 'escalated', 'submitted'].includes(status)) return ['approve', 'respond_info', 'emergency', 'start', 'cancel'];
  if (['approved', 'scheduled'].includes(status)) return ['start', 'schedule', 'approve', 'cancel'];
  if (status === 'in_progress') return ['record_execution', 'verify'];
  if (status === 'awaiting_verification') return ['verify', 'approve'];
  return ['reopen', 'approve', 'start'];
}
function critType(t: string) {
  return ({ execution_evidence: 'Requires a successful execution record', independent_verifier: 'Verifier must differ from the executor',
    kri_normal: 'Checks the live KRI reading at verification time', attestation: 'Verifier confirms with their identity recorded',
    post_reviews_approved: 'Required after an emergency', device_ack: 'Requires a report from the enrolled device' } as Record<string, string>)[t] ?? t;
}
function evLabel(k: string) {
  return ({ note: 'Note', assessment: 'Assessment', execution_record: 'Execution record', verification: 'Verification', device_report: 'Device report', kri_snapshot: 'KRI snapshot' } as Record<string, string>)[k] ?? k;
}
function Role({ label, p, fallback }: { label: string; p: any; fallback?: string }) {
  return <div><div className="xs muted" style={{ marginBottom: 3 }}>{label}</div>{p ? <Person p={p} /> : <span className="small muted">{fallback ?? 'Unassigned'}</span>}</div>;
}

function ActionButtons({ ops, a, setDialog }: { ops: Record<string, Op>; a: any; setDialog: (s: string) => void }) {
  const b: React.ReactNode[] = [];
  if (ops.submit?.allowed) b.push(<button key="s" className="btn primary" onClick={() => setDialog('submit')}><ArrowRight size={15} />Submit</button>);
  if (ops.respond_info?.allowed) b.push(<button key="ri" className="btn primary" onClick={() => setDialog('respond_info')}><HelpCircle size={15} />Answer</button>);
  if (ops.assess?.allowed) b.push(<button key="as" className="btn primary" onClick={() => setDialog('assess')}><ShieldCheck size={15} />Assess</button>);
  if (ops.approve?.allowed) b.push(<button key="ap" className="btn primary" onClick={() => setDialog('approve')}><CheckCircle2 size={15} />{a.status === 'completed' || a.status === 'in_progress' || a.status === 'approved' || a.status === 'awaiting_verification' ? 'Post-review' : 'Decide'}</button>);
  if (ops.emergency?.allowed) b.push(<button key="em" className="btn warn" onClick={() => setDialog('emergency')}><Siren size={15} />Emergency</button>);
  if (ops.start?.allowed) b.push(<button key="st" className="btn primary" onClick={() => setDialog('start')}><Play size={15} />Execute</button>);
  if (ops.schedule?.allowed) b.push(<button key="sc" className="btn" onClick={() => setDialog('schedule')}><CalendarClock size={15} />Schedule</button>);
  if (ops.record_execution?.allowed) b.push(<button key="re" className="btn primary" onClick={() => setDialog('record')}><FileText size={15} />Record result</button>);
  if (ops.verify?.allowed) b.push(<button key="ve" className="btn primary" onClick={() => setDialog('verify')}><ClipboardCheck size={15} />Verify</button>);
  if (ops.reopen?.allowed) b.push(<button key="ro" className="btn" onClick={() => setDialog('reopen')}><RotateCcw size={15} />Reopen</button>);
  if (ops.cancel?.allowed) b.push(<button key="ca" className="btn danger-ghost" onClick={() => setDialog('cancel')}><Ban size={15} />Cancel</button>);
  if (b.length === 0) return <div className="row small muted" style={{ maxWidth: 280 }}><Lock size={15} />No action for you at this stage</div>;
  return <div className="row wrap" style={{ justifyContent: 'flex-end' }}>{b}</div>;
}

function ActionDialog({ kind, a, onClose, run }: { kind: string; a: any; onClose: () => void; run: (fn: string, args: any, ok: string) => Promise<any> }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<'approve' | 'reject' | 'request_info' | 'escalate'>('approve');
  const [recommend, setRecommend] = useState(true);
  const [sev, setSev] = useState<number>(a.severity);
  const [outcome, setOutcome] = useState<'success' | 'failed'>('success');
  const [conf, setConf] = useState<Record<string, boolean>>({});
  const [rl, setRl] = useState<string>(''); const [ri, setRi] = useState<string>('');
  const [when, setWhen] = useState(new Date(Date.now() + 3600e3).toISOString().slice(0, 16));
  const [field, setField] = useState('executor'); const [emp, setEmp] = useState('');
  const [result, setResult] = useState<any>(null);
  const { orgId } = useSession();
  const org = useRpc<any>(kind === 'reassign' ? 'grc_org' : null, { p_org: orgId });
  const go = async (fn: () => Promise<any>) => { setBusy(true); try { const r = await fn(); if (kind === 'verify') setResult(r); } catch { /* toast shown */ } finally { setBusy(false); } };
  const pendingStep = a.approvals.find((x: any) => x.status === 'pending');

  let title = '', body: React.ReactNode = null, footer: React.ReactNode = null;
  const cancelBtn = <button className="btn" onClick={onClose}>Close</button>;
  switch (kind) {
    case 'submit':
      title = `Submit ${a.ref}`;
      body = <Notice>The platform will route this action according to policy: {a.type.assessor ? <>first an assessment by the <b>{a.type.assessor}</b>, then </> : null}the approval steps listed under “Why this route?”.</Notice>;
      footer = <>{cancelBtn}<button className="btn primary" disabled={busy} onClick={() => go(() => run('grc_submit_action', { p_id: a.id }, 'Submitted'))}>Submit</button></>;
      break;
    case 'respond_info':
      title = 'Answer the approver';
      body = <div className="stack"><Notice>{a.info_request}</Notice><Field label="Your answer"><textarea className="textarea" value={text} onChange={e => setText(e.target.value)} /></Field></div>;
      footer = <>{cancelBtn}<button className="btn primary" disabled={busy || !text.trim()} onClick={() => go(() => run('grc_respond_info', { p_id: a.id, p_response: text }, 'Answer sent'))}>Send to approver</button></>;
      break;
    case 'assess':
      title = `Assess ${a.ref}`;
      body = <div className="stack">
        <Field label="Assessment" help="Recorded as evidence with your identity and role."><textarea className="textarea" value={text} onChange={e => setText(e.target.value)} /></Field>
        <Field label="Confirmed severity (1–4)" help="Severity is used by the approval policy."><select className="select" value={sev} onChange={e => setSev(+e.target.value)}>{[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}</select></Field>
        <div className="seg"><button className={recommend ? 'on' : ''} onClick={() => setRecommend(true)}>Recommend</button><button className={!recommend ? 'on' : ''} onClick={() => setRecommend(false)}>Do not recommend</button></div>
      </div>;
      footer = <>{cancelBtn}<button className="btn primary" disabled={busy || !text.trim()} onClick={() => go(() => run('grc_assess_action', { p_id: a.id, p_assessment: text, p_recommend: recommend, p_severity: sev }, 'Assessment recorded'))}>Record assessment</button></>;
      break;
    case 'approve':
      title = pendingStep?.kind === 'post_review' ? `Post-emergency review · ${a.ref}` : `Decision · ${a.ref}`;
      body = <div className="stack">
        <Notice kind={pendingStep?.kind === 'post_review' ? 'warn' : 'info'}>You are deciding as <b>{pendingStep?.role}</b> (step {pendingStep?.step}). {pendingStep?.rationale}</Notice>
        <div className="seg" role="radiogroup">
          {(['approve', 'reject', 'request_info', 'escalate'] as const).filter(d => a.ops[d]?.allowed && (pendingStep?.kind !== 'post_review' || d !== 'request_info')).map(d =>
            <button key={d} className={decision === d ? 'on' : ''} onClick={() => setDecision(d)}>{({ approve: 'Approve', reject: 'Reject', request_info: 'Request information', escalate: 'Escalate' })[d]}</button>)}
        </div>
        <Field label={decision === 'approve' ? 'Comment (optional)' : 'Justification (required)'}><textarea className="textarea" value={text} onChange={e => setText(e.target.value)} /></Field>
        {decision === 'escalate' && <div className="small muted">The decision moves to the next authority in the reporting line.</div>}
      </div>;
      footer = <>{cancelBtn}<button className={`btn ${decision === 'reject' ? 'danger' : 'primary'}`} disabled={busy || (decision !== 'approve' && !text.trim())}
        onClick={() => go(() => run('grc_decide', { p_id: a.id, p_decision: decision, p_comment: text || null }, 'Decision recorded'))}>{({ approve: 'Approve', reject: 'Reject', request_info: 'Send question', escalate: 'Escalate' })[decision]}</button></>;
      break;
    case 'emergency':
      title = 'Invoke emergency procedure';
      body = <div className="stack">
        <Notice kind="warn">Use only when waiting for normal approval would cause serious harm. Your own approval authority applies immediately; the other authorities become <b>mandatory post-emergency reviews</b>. The action cannot be completed until those reviews are approved. Rules marked “still required” cannot be bypassed.</Notice>
        <Field label="Describe the emergency"><textarea className="textarea" value={text} onChange={e => setText(e.target.value)} /></Field>
      </div>;
      footer = <>{cancelBtn}<button className="btn warn" disabled={busy || text.trim().length < 10} onClick={() => go(() => run('grc_invoke_emergency', { p_id: a.id, p_reason: text }, 'Emergency recorded'))}><Siren size={15} />Invoke</button></>;
      break;
    case 'start':
      title = `Execute ${a.ref}`;
      body = <div className="stack">
        <Notice kind={a.execution_mode === 'device' ? 'warn' : 'info'}>{a.execution_mode === 'device'
          ? 'A command will be queued for the enrolled test device. The device reports the result itself.'
          : <>This is a <b>SIMULATED ACTION</b>: you will record what was done and the platform labels it as simulated. No production system is changed.</>}</Notice>
        <dl className="kv"><dt>Action</dt><dd>{a.type.name}</dd><dt>Target</dt><dd>{a.asset?.name ?? '—'}</dd><dt>Authorisation</dt><dd>{a.emergency ? 'Emergency procedure' : 'All required approvals granted'}</dd></dl>
      </div>;
      footer = <>{cancelBtn}<button className="btn primary" disabled={busy} onClick={() => go(() => run('grc_start_execution', { p_id: a.id }, 'Execution started'))}><Play size={15} />Start execution</button></>;
      break;
    case 'schedule':
      title = 'Schedule execution';
      body = <Field label="Planned execution time"><input className="input" type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} /></Field>;
      footer = <>{cancelBtn}<button className="btn primary" disabled={busy} onClick={() => go(() => run('grc_schedule_action', { p_id: a.id, p_when: new Date(when).toISOString() }, 'Scheduled'))}>Schedule</button></>;
      break;
    case 'record':
      title = 'Record execution result';
      body = <div className="stack">
        <div className="seg"><button className={outcome === 'success' ? 'on' : ''} onClick={() => setOutcome('success')}>Completed successfully</button><button className={outcome === 'failed' ? 'on' : ''} onClick={() => setOutcome('failed')}>Failed</button></div>
        <Field label="What was done (evidence)" help="Stored as an execution record labelled SIMULATED ACTION."><textarea className="textarea" value={text} onChange={e => setText(e.target.value)} placeholder="e.g. Account fin.user07 disabled in the identity provider; active sessions revoked." /></Field>
      </div>;
      footer = <>{cancelBtn}<button className="btn primary" disabled={busy || !text.trim()} onClick={() => go(() => run('grc_record_execution', { p_id: a.id, p_outcome: outcome, p_notes: text }, 'Execution recorded'))}>Record</button></>;
      break;
    case 'verify': {
      const att = (a.criteria as any[]).filter(c => c.type === 'attestation');
      title = `Verify ${a.ref}`;
      body = <div className="stack">
        <Notice>The server evaluates every criterion against recorded data. Automatic checks (execution record, independence, live KRI, post-emergency review) cannot be overridden here.</Notice>
        {att.length > 0 && <div className="stack tight"><div className="section-title">Your confirmations</div>{att.map(c => <label key={c.key} className="check"><input type="checkbox" checked={!!conf[c.key]} onChange={e => setConf({ ...conf, [c.key]: e.target.checked })} /><span className="small">{c.label}</span></label>)}</div>}
        <div className="grid g2">
          <Field label="Residual likelihood (1–4)"><select className="select" value={rl} onChange={e => setRl(e.target.value)}><option value="">—</option>{[1, 2, 3, 4].map(n => <option key={n}>{n}</option>)}</select></Field>
          <Field label="Residual impact (1–4)"><select className="select" value={ri} onChange={e => setRi(e.target.value)}><option value="">—</option>{[1, 2, 3, 4].map(n => <option key={n}>{n}</option>)}</select></Field>
        </div>
        <Field label="Verification notes"><textarea className="textarea" value={text} onChange={e => setText(e.target.value)} /></Field>
        {result && (
          <Notice kind={result.passed ? 'success' : 'danger'}>
            <b>{result.passed ? 'Verified — action completed.' : 'Verification failed — the action stays open.'}</b>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{result.criteria.map((c: any) => <li key={c.key}>{c.passed ? 'PASS' : 'FAIL'} — {c.label}: {c.detail}</li>)}</ul>
          </Notice>
        )}
      </div>;
      footer = <>{cancelBtn}{!result?.passed && <button className="btn primary" disabled={busy} onClick={() => go(() => run('grc_verify_action', { p_id: a.id, p_confirmations: conf, p_notes: text || null, p_residual_likelihood: rl ? +rl : null, p_residual_impact: ri ? +ri : null }, 'Verification evaluated'))}><ClipboardCheck size={15} />Run verification</button>}</>;
      break;
    }
    case 'cancel':
    case 'reopen':
      title = kind === 'cancel' ? `Cancel ${a.ref}` : `Reopen ${a.ref}`;
      body = <Field label="Reason (recorded in the audit trail)"><textarea className="textarea" value={text} onChange={e => setText(e.target.value)} /></Field>;
      footer = <>{cancelBtn}<button className={`btn ${kind === 'cancel' ? 'danger' : 'primary'}`} disabled={busy || !text.trim()} onClick={() => go(() => run(kind === 'cancel' ? 'grc_cancel_action' : 'grc_reopen_action', { p_id: a.id, p_reason: text }, kind === 'cancel' ? 'Cancelled' : 'Reopened'))}>{kind === 'cancel' ? 'Cancel action' : 'Reopen'}</button></>;
      break;
    case 'reassign':
      title = `Reassign responsibility · ${a.ref}`;
      body = <div className="stack">
        <Field label="Responsibility"><select className="select" value={field} onChange={e => setField(e.target.value)}><option value="executor">Technical executor</option><option value="responsible">Responsible (R)</option><option value="accountable">Accountable (A)</option></select></Field>
        <Field label="New assignee" help={field === 'executor' ? `Must hold: ${a.type.executors.join(' / ') || 'any role'}. The server refuses anyone else, and anyone who approved this action.` : undefined}>
          <select className="select" value={emp} onChange={e => setEmp(e.target.value)}><option value="">Select…</option>{(org.data?.employees ?? []).filter((e: any) => e.active).map((e: any) => <option key={e.id} value={e.id}>{e.name} — {e.role}</option>)}</select>
        </Field>
        <Field label="Reason"><textarea className="textarea" value={text} onChange={e => setText(e.target.value)} /></Field>
      </div>;
      footer = <>{cancelBtn}<button className="btn primary" disabled={busy || !emp || !text.trim()} onClick={() => go(() => run('grc_reassign_action', { p_id: a.id, p_field: field, p_employee: emp, p_reason: text }, 'Reassigned'))}>Reassign</button></>;
      break;
    case 'note':
      title = 'Add a note';
      body = <Field label="Note"><textarea className="textarea" value={text} onChange={e => setText(e.target.value)} /></Field>;
      footer = <>{cancelBtn}<button className="btn primary" disabled={busy || !text.trim()} onClick={() => go(() => run('grc_add_note', { p_entity_type: 'action', p_id: a.id, p_note: text }, 'Note added'))}>Add</button></>;
      break;
  }
  return <Modal title={title} onClose={onClose} footer={footer} wide={kind === 'verify'}>{body}</Modal>;
}
