import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight, CheckCircle2, XCircle, HelpCircle, Siren, Play, ClipboardCheck, RotateCcw, Ban, UserCog,
  ShieldCheck, Lock, Unlock, FileText, Flag, MessageSquarePlus, CalendarClock,
} from 'lucide-react';
import { rpc } from '../lib/supabase';
import { useRpc, useSession } from '../lib/session';
import { fmtDateTime, fmtMoney, fmtDate, due, STAGES, stageIndex, statusOf } from '../lib/format';
import { Badge, Card, ErrorBox, ExecLabel, Field, Level, Loading, Modal, Notice, Person, Score, Severity, Status, useToast } from '../components/ui';
import { AuthorityRail, buildRail, useStamp } from '../components/Authority';

type Op = { allowed: boolean; reason: string | null };

export default function ActionDetail() {
  const { id } = useParams();
  const { data: a, error, loading, reload } = useRpc<any>('grc_action', { p_id: id }, { poll: 6000 });
  const { bump, current } = useSession();
  const toast = useToast();
  const stamp = useStamp();
  const [dialog, setDialog] = useState<null | string>(null);

  if (loading && !a) return <Card><Loading rows={6} /></Card>;
  if (error) return <ErrorBox error={error} />;
  if (!a) return null;

  const ops: Record<string, Op> = a.ops;
  const run = async (fn: string, args: Record<string, unknown>, ok: string) => {
    try {
      const r: any = await rpc(fn, args);
      const word = STAMP_WORD(fn, args, r);
      if (word) stamp({ word: word.w, color: word.c, who: current?.full_name ?? '', role: current?.role, meta: `${a.ref} · ${new Date().toLocaleTimeString('en-GB')}` });
      else toast('ok', typeof r === 'string' ? `${ok} — ${statusOf(r).label}` : ok);
      if (fn === 'grc_verify_action' && r && r.passed === false) toast('err', 'Verification failed: one or more criteria are not met. The action stays open.');
      setDialog(fn === 'grc_verify_action' && r && r.passed === false ? 'verify' : null); reload(); bump();
      return r;
    } catch (e: any) { toast('err', e.message); throw e; }
  };

  const stopped = ['rejected', 'cancelled', 'failed', 'blocked'].includes(a.status);
  const curStage = stageIndex[a.status] ?? 1;
  const next = a.next ?? {};
  const links = buildRail(a);
  const myButtons = <ActionButtons ops={ops} a={a} setDialog={setDialog} />;
  const hasMine = Object.entries(ops).some(([k, v]) => v.allowed && !['reassign', 'cancel', 'schedule', 'reopen'].includes(k));

  return (
    <div className="stack loose">
      <div className="row between wrap">
        <div className="eyebrow row wrap" style={{ margin: 0 }}>
          <Link to="/actions">Actions</Link><span>/</span><span className="mono">{a.ref}</span>
          {a.archived && <Badge tone="muted">Archived scenario run, read-only</Badge>}
          <Status s={a.status} />
          <span className={`badge ${a.execution_mode === 'device' ? 'label-dev' : MANUAL.includes(a.action_type) ? 'label-man' : 'label-sim'}`}>{a.execution_mode === 'device' ? 'DEVICE EXECUTION' : MANUAL.includes(a.action_type) ? 'MANUAL EXECUTION' : 'SIMULATED EXECUTION'}</span>
        </div>
        <div className="row wrap no-print">
          {ops.reassign?.allowed && <button className="btn sm" onClick={() => setDialog('reassign')}><UserCog size={14} />Reassign</button>}
          {ops.schedule?.allowed && <button className="btn sm" onClick={() => setDialog('schedule')}><CalendarClock size={14} />Schedule</button>}
          {ops.reopen?.allowed && <button className="btn sm" onClick={() => setDialog('reopen')}><RotateCcw size={14} />Reopen</button>}
          {ops.cancel?.allowed && <button className="btn sm danger-ghost" onClick={() => setDialog('cancel')}><Ban size={14} />Cancel action</button>}
        </div>
      </div>

      <div className="stages" aria-label="Workflow stage">
        {STAGES.map((s, i) => {
          const n = i + 1;
          const cls = n < curStage || a.status === 'completed' ? 'done' : n === curStage ? (stopped ? 'stop' : 'now') : '';
          return <div key={s.key} className={`stage ${cls}`}><div className="n">0{n}</div><div className="l">{s.label}</div></div>;
        })}
      </div>

      <div className="grid g-main-wide" style={{ alignItems: 'start' }}>
        <div className="stack loose">
          <article className="letter">
            <div className="wax">{a.emergency ? <>Emergency{" "}authority</> : a.status === 'completed' ? <>Sealed &amp; verified</> : a.approvals.filter((x: any) => x.kind === 'pre').length > 1 ? <>Dual control</> : <>{a.type.domain === 'finance' || a.type.domain === 'banking' ? 'Financial' : 'Security'}{" "}decision</>}</div>
            <div className="lk">{a.ref} · {a.type.name.toUpperCase()}</div>
            <h2>{a.title}</h2>
            {a.proposed_action && <p style={{ maxWidth: '62ch' }}>{a.proposed_action}</p>}
            {a.amount != null && <div className="amt">{fmtMoney(a.amount)}</div>}
            <div className="row wrap" style={{ margin: '12px 0 18px' }}>
              <Severity s={a.severity} />{a.priority === 'P1' && <Badge tone="danger">Priority 1</Badge>}{a.emergency && <Badge tone="critical"><Siren size={12} /> Emergency procedure</Badge>}
              <span className="xs" style={{ color: 'var(--letter-muted)' }}>Deadline {fmtDate(a.deadline)} ({due(a.deadline)})</span>
            </div>
            <div className="divider" />
            <dl className="kv" style={{ marginTop: 14 }}>
              <dt>Linked risk</dt><dd>{a.risk ? <span className="row wrap"><Link to={`/risks?r=${a.risk.id}`}>{a.risk.code} {a.risk.title}</Link><Score score={a.risk.score} /><Level score={a.risk.score} /></span> : '—'}</dd>
              <dt>Incident</dt><dd>{a.incident ? <Link to={`/incidents/${a.incident.id}`}>{a.incident.ref} {a.incident.title}</Link> : '—'}</dd>
              <dt>Affected asset</dt><dd>{a.asset ? <>{a.asset.name} <Badge tone={a.asset.criticality >= 4 ? 'critical' : 'neutral'}>Criticality {a.asset.criticality}</Badge><div className="small" style={{ color: 'var(--letter-muted)' }}>{a.asset.service}</div></> : '—'}</dd>
              <dt>Justification</dt><dd>{a.justification || '—'}</dd>
              <dt>Business impact</dt><dd>{a.business_impact || '—'}</dd>
              <dt>Treatment</dt><dd>{a.treatment_strategy}{a.budget != null && ` · budget ${fmtMoney(a.budget)}`}</dd>
              {a.info_request && <><dt>Open question</dt><dd><b>{a.info_request}</b></dd></>}
              {a.blocked_reason && <><dt>Note</dt><dd>{a.blocked_reason}</dd></>}
              {(a.residual_likelihood && a.residual_impact) ? <><dt>Residual risk</dt><dd>L{a.residual_likelihood} × I{a.residual_impact} = {a.residual_likelihood * a.residual_impact}</dd></> : null}
            </dl>
          </article>

          <Card title="Proof of completion" sub="Every criterion is checked by the server against recorded data. A button click alone cannot complete this action.">
            <div className="stack tight">
              {(a.criteria_preview ?? a.criteria).map((c: any) => (
                <div key={c.key} className="perm-row">
                  {c.passed === true ? <CheckCircle2 size={17} color="var(--seal)" /> : c.passed === false ? <XCircle size={17} color="var(--danger)" /> : <ClipboardCheck size={17} color="var(--ink-4)" />}
                  <div><div className="small strong">{c.label}</div><div className="xs muted">{c.detail ?? critType(c.type)}</div></div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Evidence" sub="Assessments, execution records, verification results and notes" actions={!a.archived && <button className="btn sm" onClick={() => setDialog('note')}><MessageSquarePlus size={14} />Add note</button>}>
            {a.evidence.length === 0 ? <div className="small muted">No evidence yet. It appears here as people assess, execute and verify.</div> : (
              <div className="stack">
                {a.evidence.map((e: any) => (
                  <div key={e.id} style={{ borderLeft: `3px solid ${e.kind === 'verification' ? (e.summary.startsWith('All') ? 'var(--seal)' : 'var(--danger)') : e.kind === 'execution_record' ? 'var(--authority)' : 'var(--line-2)'}`, paddingLeft: 12 }}>
                    <div className="row wrap between">
                      <div className="row wrap"><span className="small strong">{evLabel(e.kind)}</span><ExecLabel label={e.label} /></div>
                      <span className="xs muted">{e.by?.name}, {fmtDateTime(e.at)}</span>
                    </div>
                    <div className="small" style={{ marginTop: 4 }}>{e.summary}</div>
                    {e.kind === 'execution_record' && e.data?.simulation_notice && <div className="xs muted" style={{ marginTop: 3 }}>{e.data.simulation_notice} Target: {e.data.target ?? '—'}.</div>}
                    {e.kind === 'verification' && Array.isArray(e.data?.criteria) && (
                      <ul className="xs" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                        {e.data.criteria.map((c: any) => <li key={c.key} style={{ color: c.passed ? 'var(--seal)' : 'var(--danger)' }}>{c.passed ? 'Pass' : 'Fail'}: {c.label}. <span className="muted">{c.detail}</span></li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Activity" sub="Each line is a sealed entry in the audit chain">
            <div className="timeline">
              {a.timeline.map((t: any) => (
                <div key={t.id} className="tl">
                  <div className="when">{fmtDateTime(t.at)}</div>
                  <div className={`pip ${t.stage}`} />
                  <div><div className="what">{t.summary}</div><div className="who">{t.actor}, {t.role} <span className="mono">#{t.hash}</span></div></div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="stack loose rail-col">
          <Card title={'Chain of authority'} sub={next.stage === 'done' ? next.title : `Now: ${next.title}${next.actor ? ` · ${next.actor}` : ''}`}>
            <AuthorityRail links={links} action={hasMine ? <div className="rail-now mine"><div className="xs muted" style={{ marginBottom: 6 }}>This step is yours, {current?.full_name.split(' ')[0]}.</div>{myButtons}</div>
              : !['completed', 'cancelled', 'rejected'].includes(a.status) ? <div className="rail-now"><div className="small row top"><Lock size={14} style={{ marginTop: 3 }} /><span>Waiting for {next.actor ?? 'the responsible person'}. You cannot act on this step.</span></div></div> : null} />
          </Card>

          <Card title="What you can do here" sub="Computed by the server with the same checks it enforces">
            <div>
              {permRows(a.status).map(k => {
                const o = ops[k]; if (!o) return null;
                return (
                  <div key={k} className="perm-row">
                    {o.allowed ? <Unlock size={15} color="var(--seal)" /> : <Lock size={15} color="var(--ink-4)" />}
                    <div><div className="small strong">{OPLABEL[k]}{o.allowed ? '' : ': not allowed'}</div>{!o.allowed && <div className="xs muted">{o.reason}</div>}</div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="Why this route" sub="Approval rules that matched this request">
            <div className="stack tight small">
              <div className="muted">Asset criticality {a.policy.asset_criticality ?? 'n/a'}, severity {a.severity}{a.amount != null && `, amount ${fmtMoney(a.amount)}`}</div>
              {a.policy.matched_rules.length === 0 ? <div>No approval rule matches, so the action is authorised by policy.</div> :
                a.policy.matched_rules.map((r: any, i: number) => <div key={i} className="row top"><Flag size={14} style={{ marginTop: 3 }} /><div><b>{r.role}</b><div className="muted xs">{r.rationale}{r.in_emergency === 'still_required' ? ' Cannot be bypassed in an emergency.' : ' Becomes a review afterwards in an emergency.'}</div></div></div>)}
              <div className="divider" />
              <div className="xs muted">Assessor: {a.type.assessor ?? 'none'}. Executed by: {a.type.executors.join(', ') || 'the responsible employee'}. Emergency procedure: {a.type.emergency_allowed ? 'allowed for RSSI and CEO' : 'not allowed'}.</div>
            </div>
          </Card>

          <Card title="RACI">
            <div className="stack tight">
              {a.raci.map((r: any, i: number) => (
                <div key={i} className="row"><Badge tone={r.raci === 'A' ? 'accent' : r.raci === 'R' ? 'info' : r.raci === 'C' ? 'warning' : 'muted'}>{({ R: 'Responsible', A: 'Accountable', C: 'Consulted', I: 'Informed' } as any)[r.raci]}</Badge><Person p={r.employee} size="sm" /></div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {dialog && <ActionDialog kind={dialog} a={a} onClose={() => setDialog(null)} run={run} />}
    </div>
  );
}

function STAMP_WORD(fn: string, args: any, r: any): { w: string; c?: string } | null {
  if (fn === 'grc_decide') return args.p_decision === 'approve' ? { w: 'APPROVED' } : args.p_decision === 'reject' ? { w: 'REJECTED', c: 'var(--danger)' } : args.p_decision === 'escalate' ? { w: 'ESCALATED', c: 'var(--pending)' } : null;
  if (fn === 'grc_verify_action') return r?.passed ? { w: 'VERIFIED' } : null;
  if (fn === 'grc_invoke_emergency') return { w: 'EMERGENCY', c: 'var(--critical)' };
  if (fn === 'grc_record_execution') return args.p_outcome === 'success' ? { w: 'EXECUTED', c: 'var(--authority)' } : { w: 'FAILED', c: 'var(--danger)' };
  if (fn === 'grc_assess_action') return args.p_recommend ? { w: 'ASSESSED', c: 'var(--authority)' } : { w: 'NOT RECOMMENDED', c: 'var(--danger)' };
  return null;
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
function ActionButtons({ ops, a, setDialog }: { ops: Record<string, Op>; a: any; setDialog: (s: string) => void }) {
  const b: React.ReactNode[] = [];
  if (ops.submit?.allowed) b.push(<button key="s" className="btn primary" onClick={() => setDialog('submit')}><ArrowRight size={15} />Submit for review</button>);
  if (ops.respond_info?.allowed) b.push(<button key="ri" className="btn primary" onClick={() => setDialog('respond_info')}><HelpCircle size={15} />Answer the approver</button>);
  if (ops.assess?.allowed) b.push(<button key="as" className="btn primary" onClick={() => setDialog('assess')}><ShieldCheck size={15} />Record assessment</button>);
  if (ops.approve?.allowed) b.push(<button key="ap" className="btn primary lg" onClick={() => setDialog('approve')}><CheckCircle2 size={15} />{a.status === 'completed' || a.status === 'in_progress' || a.status === 'approved' || a.status === 'awaiting_verification' ? 'Review emergency decision' : 'Sign or decline'}</button>);
  if (ops.emergency?.allowed) b.push(<button key="em" className="btn warn" onClick={() => setDialog('emergency')}><Siren size={15} />Use emergency procedure</button>);
  if (ops.start?.allowed) b.push(<button key="st" className="btn primary" onClick={() => setDialog('start')}><Play size={15} />Start execution</button>);
  if (ops.record_execution?.allowed) b.push(<button key="re" className="btn primary" onClick={() => setDialog('record')}><FileText size={15} />Record result</button>);
  if (ops.verify?.allowed) b.push(<button key="ve" className="btn primary" onClick={() => setDialog('verify')}><ClipboardCheck size={15} />Run verification</button>);
  if (b.length === 0) return null;
  return <div className="row wrap">{b}</div>;
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
          : MANUAL.includes(a.action_type)
            ? <>This is a <b>MANUAL ACTION</b>: you carry it out yourself on the computer (for example Start → Shut down), then record what you did. The platform does not control the device.</>
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
        <Field label="What was done (evidence)" help={`Stored as an execution record labelled ${MANUAL.includes(a.action_type) ? 'MANUAL ACTION' : 'SIMULATED ACTION'}.`}><textarea className="textarea" value={text} onChange={e => setText(e.target.value)} placeholder={MANUAL.includes(a.action_type) ? 'e.g. FIN-LT-07 shut down by hand at 10:42; screen off, disconnected from the network.' : 'e.g. Account fin.user07 disabled in the identity provider; active sessions revoked.'} /></Field>
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

const MANUAL = ['endpoint_shutdown', 'lock_device'];
