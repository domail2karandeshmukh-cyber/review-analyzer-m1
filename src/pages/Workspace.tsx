import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, CheckCircle2 } from 'lucide-react';
import { rpc } from '../lib/supabase';
import { useRpc, useSession } from '../lib/session';
import { fmtDateTime, fmtMoney, due } from '../lib/format';
import { Badge, Card, Empty, Field, Loading, Modal, Notice, PageHead, Person, Score, Severity, useToast } from '../components/ui';
import { KriPill } from '../components/Heat';
import { TASK, TASK_ICON } from './Overview';

const ORDER = ['post_review', 'approve', 'assess', 'respond_info', 'execute', 'record_execution', 'verify', 'submit'];

export default function Workspace() {
  const { orgId, current, can, bump } = useSession();
  const { data, loading, reload } = useRpc<any>('grc_my_work', { p_org: orgId }, { poll: 8000 });
  const nav = useNavigate();
  const toast = useToast();
  const [deleg, setDeleg] = useState(false);
  if (loading && !data) return <Card><Loading rows={6} /></Card>;
  const tasks = [...(data?.tasks ?? [])].sort((a, b) => ORDER.indexOf(a.task) - ORDER.indexOf(b.task));
  const inc = data?.incidents ?? [];

  return (
    <div className="stack loose">
      <PageHead eyebrow="My Workspace" title={current?.role ?? ''} desc={<span className="row wrap"><Person p={{ name: current?.full_name ?? '', role: current?.department }} />{current?.is_student && <Badge tone="accent">Demonstration role</Badge>}</span>}
        actions={can('authority.delegate') && <button className="btn" onClick={() => setDeleg(true)}><UserPlus size={15} />Delegate my authority</button>} />

      {data?.delegations_in?.map((d: any) => <Notice key={d.id} kind="info">You are acting for <b>{d.from}</b> as <b>{d.role}</b> until {fmtDateTime(d.until)} — “{d.reason}”. Your decisions are recorded as “on behalf of”.</Notice>)}
      {data?.delegations_out?.map((d: any) => (
        <Notice key={d.id} kind="warn"><div className="row between wrap" style={{ width: '100%' }}><span>Your authority is delegated to <b>{d.to}</b> until {fmtDateTime(d.until)}.</span>
          <button className="btn sm" onClick={async () => { try { await rpc('grc_revoke_delegation', { p_id: d.id }); toast('ok', 'Delegation revoked'); reload(); bump(); } catch (e: any) { toast('err', e.message); } }}>Revoke</button></div></Notice>))}

      <div className="grid g-main">
        <div className="stack loose">
          <Card title="Incidents needing you" flush>
            {inc.length === 0 ? <Empty title="No incident needs you" /> : inc.map((i: any) => (
              <div key={i.id} className="list-row click" onClick={() => nav(`/incidents/${i.id}`)}>
                <div className="grow"><div className="small strong">{i.title}</div><div className="xs muted"><span className="mono">{i.ref}</span></div></div>
                <Severity s={i.severity} /><Badge tone="danger">{TASK[i.task]}</Badge>
              </div>))}
          </Card>
          <Card title="Actions needing you" sub="The server decides what appears here, using the same checks it enforces" flush>
            {tasks.length === 0 ? <Empty icon={<CheckCircle2 size={28} />} title="You are up to date" /> : tasks.map((a: any) => (
              <div key={a.id} className="list-row click" onClick={() => nav(`/actions/${a.id}`)}>
                {TASK_ICON[a.task]}
                <div className="grow"><div className="small strong">{a.title}</div>
                  <div className="xs muted"><span className="mono">{a.ref}</span> · {a.type_name}{a.amount != null && ` · ${fmtMoney(a.amount)}`} · {due(a.deadline)}</div></div>
                <Badge tone={a.task === 'post_review' ? 'critical' : a.task === 'approve' ? 'warning' : a.task === 'verify' ? 'success' : 'accent'}>{TASK[a.task]}</Badge>
              </div>))}
          </Card>
        </div>
        <div className="stack loose">
          <Card title="Risks you own" sub="You are Accountable (A)" flush>
            {(data?.owned_risks ?? []).length === 0 ? <div className="empty small">You do not own a risk.</div> : data.owned_risks.map((r: any) => (
              <Link key={r.id} to={`/risks?r=${r.id}`} className="list-row" style={{ color: 'inherit', textDecoration: 'none' }}>
                <Badge>{r.code}</Badge><div className="grow small">{r.title}</div>{r.kri && <KriPill s={r.kri} />}<Score score={r.score} />
              </Link>))}
          </Card>
          <Card title="Your permissions">
            <div className="row wrap">{current?.permissions.map(p => <Badge key={p} tone="neutral">{p}</Badge>)}</div>
            <div className="xs muted" style={{ marginTop: 8 }}>Approval authority is not a permission: it comes from the approval policy for your role ({current?.role}).</div>
          </Card>
        </div>
      </div>
      {deleg && <Delegate onClose={() => { setDeleg(false); reload(); bump(); }} />}
    </div>
  );
}

function Delegate({ onClose }: { onClose: () => void }) {
  const { orgId, current } = useSession();
  const org = useRpc<any>('grc_org', { p_org: orgId });
  const toast = useToast();
  const [to, setTo] = useState(''); const [reason, setReason] = useState('');
  const [until, setUntil] = useState(new Date(Date.now() + 2 * 86400e3).toISOString().slice(0, 16));
  const [err, setErr] = useState<string | null>(null);
  return (
    <Modal title="Delegate approval authority" sub={`Temporarily allow a colleague to decide as ${current?.role}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!to || !reason.trim()} onClick={async () => {
        try { await rpc('grc_delegate', { p_org: orgId, p_to: to, p_until: new Date(until).toISOString(), p_reason: reason }); toast('ok', 'Authority delegated'); onClose(); } catch (e: any) { setErr(e.message); } }}>Delegate</button></>}>
      <div className="stack">
        <Notice>Delegated decisions are recorded as “on behalf of” you. Separation of duties still applies: a delegate cannot approve their own request. Maximum 30 days.</Notice>
        <Field label="Delegate to"><select className="select" value={to} onChange={e => setTo(e.target.value)}><option value="">Select…</option>{(org.data?.employees ?? []).filter((e: any) => e.active && e.has_login && e.id !== current?.employee_id).map((e: any) => <option key={e.id} value={e.id}>{e.name} — {e.role}</option>)}</select></Field>
        <Field label="Valid until"><input className="input" type="datetime-local" value={until} onChange={e => setUntil(e.target.value)} /></Field>
        <Field label="Reason"><textarea className="textarea" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. On leave Monday–Tuesday" /></Field>
        {err && <Notice kind="danger">{err}</Notice>}
      </div>
    </Modal>
  );
}
