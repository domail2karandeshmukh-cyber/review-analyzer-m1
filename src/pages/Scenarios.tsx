import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Pause, RotateCcw, ArrowRight, MonitorPlay } from 'lucide-react';
import { rpc } from '../lib/supabase';
import { useRpc, useSession } from '../lib/session';
import { fmtDateTime, initials } from '../lib/format';
import { Badge, Card, Field, Loading, Modal, Notice, PageHead, Status, useToast } from '../components/ui';

export default function Scenarios() {
  const { memberships, setOrg, orgId, bump } = useSession();
  const nt = useRpc<any[]>(memberships.some(m => m.org_id === 'NT') ? 'grc_scenarios' : null, { p_org: 'NT' }, { poll: 6000 });
  const bk = useRpc<any[]>(memberships.some(m => m.org_id === 'BK') ? 'grc_scenarios' : null, { p_org: 'BK' }, { poll: 6000 });
  const toast = useToast();
  const [reset, setReset] = useState<any>(null);
  const [reason, setReason] = useState('');
  const all = [...(nt.data ?? []), ...(bk.data ?? [])];
  const act = async (fn: string, args: any, ok: string) => { try { await rpc(fn, args); toast('ok', ok); nt.reload(); bk.reload(); bump(); } catch (e: any) { toast('err', e.message); } };

  return (
    <>
      <PageHead title="Scenario center"
        desc="Each scenario creates a real incident in the database. Progress is computed from what people actually do — every step needs the right person to sign in and act within their authority." />
      <Notice>Detection events come from a <b>simulated feed</b>; the workflow, permissions, approvals, evidence and audit records are real. Resetting archives the run as read-only — the audit history is never deleted.</Notice>
      <div className="stack loose" style={{ marginTop: 16 }}>
        {!nt.data && !bk.data ? <Card><Loading rows={6} /></Card> : all.map(s => {
          const running = s.run && ['active', 'paused'].includes(s.run.status);
          const doneCount = s.run ? s.steps.filter((x: any) => x.done).length : 0;
          return (
            <Card key={s.code} title={<span className="row wrap">{s.title}{s.org_id === 'BK' && <Badge tone="warning">Fictional bank</Badge>}</span>} sub={s.summary}
              actions={<>
                <Link className="btn" to={`/present?org=${s.org_id}&s=${s.code}`}><MonitorPlay size={15} />Present</Link>
                {s.can_run && <>
                {!running && <button className="btn primary" onClick={() => act('grc_scenario_start', { p_code: s.code }, `${s.title} started`)}><Play size={15} />{s.run ? 'Start new run' : 'Start'}</button>}
                {running && <button className="btn" onClick={() => act('grc_scenario_set_paused', { p_run: s.run.id, p_paused: s.run.status === 'active' }, s.run.status === 'active' ? 'Paused' : 'Resumed')}>{s.run.status === 'active' ? <><Pause size={15} />Pause</> : <><Play size={15} />Resume</>}</button>}
                {s.run && s.run.status !== 'reset' && <button className="btn danger-ghost" onClick={() => { setReset(s); setReason(''); }}><RotateCcw size={15} />Reset</button>}
              </>}</>}>
              <div className="stack">
                <div className="row wrap small">
                  {s.run ? <><Status s={s.run.status} /><span className="muted">Started {fmtDateTime(s.run.started_at)} by {s.run.started_by}</span><b>{doneCount}/{s.steps.length} steps complete</b></> : <span className="muted">Not started.</span>}
                  {s.incident && <Link to={`/incidents/${s.incident.id}`} onClick={() => s.org_id !== orgId && setOrg(s.org_id)} className="btn sm">Incident {s.incident.ref} <ArrowRight size={13} /></Link>}
                </div>
                <ol className="story">
                  {s.steps.map((st: any) => {
                    const isNow = s.run && running && st.n === s.current_step;
                    return (
                      <li key={st.n} className={st.done ? 'done' : isNow ? 'now' : ''}>
                        <div className="story-n">{st.done ? '✓' : st.n}</div>
                        <div className="story-t">{st.title}</div>
                        <div className="story-d">{st.description}</div>
                        <div className="story-who">{(st.people?.length ? st.people : [st.who]).map((p: string) => <span key={p} className="avatar sm" title={p}>{initials(p)}</span>)}<span>{st.who}</span></div>
                      </li>
                    );
                  })}
                </ol>
                {s.actions.length > 0 && (
                  <div className="stack tight">
                    <div className="section-title">Actions in this run</div>
                    {s.actions.map((a: any) => (
                      <Link key={a.id} to={`/actions/${a.id}`} onClick={() => s.org_id !== orgId && setOrg(s.org_id)} className="row small" style={{ color: 'inherit' }}>
                        <span className="mono">{a.ref}</span><span className="grow">{a.title}</span><Status s={a.status} />
                      </Link>))}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      {reset && (
        <Modal title={`Reset ${reset.title}`} onClose={() => setReset(null)}
          footer={<><button className="btn" onClick={() => setReset(null)}>Cancel</button><button className="btn danger" onClick={async () => { await act('grc_scenario_reset', { p_run: reset.run.id, p_reason: reason }, 'Scenario reset — records archived'); setReset(null); }}>Reset</button></>}>
          <div className="stack">
            <Notice kind="warn">The incident and actions of this run become read-only and leave the active views. Nothing is deleted: the audit trail keeps every event and records this reset.</Notice>
            <Field label="Reason"><input className="input" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Rehearsal completed" /></Field>
          </div>
        </Modal>
      )}
    </>
  );
}
