import { useMemo, useState } from 'react';
import { Pencil, Plus, UserMinus, UserCheck, Check } from 'lucide-react';
import { rpc } from '../lib/supabase';
import { useRpc, useSession } from '../lib/session';
import { fmtDateTime, fmtMoney, PERMISSION_LABEL } from '../lib/format';
import { Badge, Card, Field, Loading, Modal, Notice, PageHead, Person, Tabs, useToast } from '../components/ui';

const ALL_PERMS = Object.keys(PERMISSION_LABEL);

export default function Organisation() {
  const { orgId, bump } = useSession();
  const { data, reload } = useRpc<any>('grc_org', { p_org: orgId });
  const [tab, setTab] = useState('structure');
  const toast = useToast();
  if (!data) return <Card><Loading rows={8} /></Card>;
  const admin = data.me.is_admin;
  const done = () => { reload(); bump(); };
  return (
    <>
      <PageHead eyebrow="Configure" title="Organisation & Roles"
        desc={<>{data.org.name} · {data.org.industry}. Departments, roles, permissions and approval policy are data — administrators change them here without touching code. Every change is audited.</>} />
      {!admin && <Notice>You can read the configuration. Changes require the <b>org.admin</b> permission (Risk Coordinator / CRO).</Notice>}
      <Tabs value={tab} onChange={setTab} tabs={[
        { key: 'structure', label: 'Structure' }, { key: 'people', label: `People (${data.employees.length})` }, { key: 'roles', label: 'Roles & permissions' },
        { key: 'policy', label: `Approval policy (${data.rules.length})` }, { key: 'types', label: 'Action types' }, { key: 'delegations', label: 'Delegations' }]} />
      {tab === 'structure' && <Structure data={data} />}
      {tab === 'people' && <People data={data} admin={admin} done={done} toast={toast} />}
      {tab === 'roles' && <Roles data={data} admin={admin} done={done} toast={toast} />}
      {tab === 'policy' && <Policy data={data} admin={admin} done={done} />}
      {tab === 'types' && (
        <Card flush><div className="table-wrap"><table className="t responsive">
          <thead><tr><th>Action type</th><th>Domain</th><th>Assessor</th><th>Executed by</th><th>Consulted</th><th>Emergency</th><th>Verification criteria</th></tr></thead>
          <tbody>{data.action_types.map((t: any) => (
            <tr key={t.code}><td className="primary"><div className="cell-title">{t.name}</div><div className="cell-sub">{t.description}</div></td>
              <td data-label="Domain"><Badge>{t.domain}</Badge></td><td data-label="Assessor" className="small">{t.assessor ?? '—'}</td>
              <td data-label="Executor" className="small">{t.executors.join(', ') || 'Responsible employee'}</td><td data-label="Consulted" className="small">{t.consulted.join(', ') || '—'}</td>
              <td data-label="Emergency">{t.emergency_allowed ? <Badge tone="warning">Allowed</Badge> : <Badge tone="muted">No</Badge>}</td>
              <td data-label="Criteria" className="xs">{t.criteria.map((c: any) => c.label).join(' · ')}</td></tr>))}</tbody>
        </table></div></Card>
      )}
      {tab === 'delegations' && (
        <Card flush>{data.delegations.length === 0 ? <div className="empty">No delegations. Managers delegate their own authority from My Workspace.</div> :
          <div className="table-wrap"><table className="t responsive"><thead><tr><th>From</th><th>To</th><th>Authority</th><th>Until</th><th>Reason</th><th>Status</th></tr></thead>
            <tbody>{data.delegations.map((d: any) => <tr key={d.id}><td className="primary small">{d.from}</td><td data-label="To" className="small">{d.to}</td><td data-label="Role" className="small">{d.role}</td><td data-label="Until" className="small">{fmtDateTime(d.valid_until)}</td><td data-label="Reason" className="small">{d.reason}</td><td data-label="Status">{d.active ? <Badge tone="accent">Active</Badge> : <Badge tone="muted">{d.revoked_at ? 'Revoked' : 'Expired'}</Badge>}</td></tr>)}</tbody>
          </table></div>}</Card>
      )}
    </>
  );
}

function Structure({ data }: { data: any }) {
  const roles = data.roles as any[];
  const byParent = useMemo(() => {
    const m: Record<string, any[]> = {};
    roles.forEach(r => { const k = r.reports_to ?? '_root'; (m[k] ??= []).push(r); });
    return m;
  }, [roles]);
  const Node = ({ r, depth }: { r: any; depth: number }) => (
    <div style={{ marginLeft: depth ? 22 : 0, borderLeft: depth ? '2px solid var(--border)' : undefined, paddingLeft: depth ? 12 : 0 }}>
      <div className="card" style={{ padding: '10px 12px', margin: '6px 0', boxShadow: 'none' }}>
        <div className="row wrap between">
          <div><div className="strong small">{r.name}</div><div className="xs muted">{r.department} · authority level {r.authority_level}</div></div>
          <div className="row wrap">{r.holders.length ? r.holders.map((h: string) => <Badge key={h} tone="accent">{h}</Badge>) : <Badge tone="muted">vacant</Badge>}</div>
        </div>
      </div>
      {(byParent[r.id] ?? []).map(c => <Node key={c.id} r={c} depth={depth + 1} />)}
    </div>
  );
  return (
    <div className="grid g-main">
      <Card title="Reporting lines" sub="Configurable hierarchy — escalation follows these lines">
        {(byParent._root ?? []).map(r => <Node key={r.id} r={r} depth={0} />)}
      </Card>
      <Card title="Departments">
        <div className="stack tight">{data.departments.map((d: any) => <div key={d.id} style={{ marginLeft: d.parent_id ? 16 : 0 }}><div className="small strong">{d.name}</div><div className="xs muted">{d.description}</div></div>)}</div>
      </Card>
    </div>
  );
}

function People({ data, admin, done, toast }: any) {
  const { orgId, current } = useSession();
  const [edit, setEdit] = useState<any>(null);
  const [deact, setDeact] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<any>(null);
  return (
    <>
      <Card flush actions={admin && <button className="btn sm primary" onClick={() => setEdit({ full_name: '', role_id: data.roles[0].id })}><Plus size={14} />Add employee</button>} title="Directory">
        <div className="table-wrap"><table className="t responsive">
          <thead><tr><th>Person</th><th>Role</th><th>Department</th><th>Reports to</th><th>Access</th><th /></tr></thead>
          <tbody>{data.employees.map((e: any) => (
            <tr key={e.id} className={e.active ? '' : 'dim'}>
              <td className="primary"><Person p={{ name: e.name, role: e.email ?? 'no login' }} /></td>
              <td data-label="Role" className="small">{e.role} {e.is_student && <Badge tone="accent">Group 1</Badge>}</td>
              <td data-label="Department" className="small">{e.department}</td>
              <td data-label="Manager" className="small">{e.manager ?? '—'}</td>
              <td data-label="Access">{!e.active ? <Badge tone="muted">Deactivated</Badge> : e.has_login ? <Badge tone="success">Sign-in</Badge> : <Badge tone="neutral">Directory only</Badge>}</td>
              <td className="right nowrap">{admin && e.id !== current?.employee_id && <>
                <button className="btn sm ghost" onClick={() => setEdit({ id: e.id, full_name: e.name, role_id: e.role_id })} aria-label="Edit"><Pencil size={14} /></button>
                <button className="btn sm ghost" onClick={() => { setDeact(e); setReason(''); setResult(null); }} aria-label={e.active ? 'Deactivate' : 'Reactivate'}>{e.active ? <UserMinus size={14} /> : <UserCheck size={14} />}</button></>}</td>
            </tr>))}</tbody>
        </table></div>
      </Card>
      {edit && (
        <Modal title={edit.id ? `Change role · ${edit.full_name}` : 'Add employee'} onClose={() => setEdit(null)}
          footer={<><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn primary" onClick={async () => {
            try { await rpc('grc_admin_employee_save', { p_org: orgId, p: edit }); toast('ok', 'Saved — permissions follow the new role immediately'); setEdit(null); done(); } catch (er: any) { toast('err', er.message); } }}>Save</button></>}>
          <div className="stack">
            {!edit.id && <Field label="Full name"><input className="input" value={edit.full_name} onChange={e => setEdit({ ...edit, full_name: e.target.value })} /></Field>}
            <Field label="Role" help="Department and manager follow the role's position in the structure."><select className="select" value={edit.role_id} onChange={e => setEdit({ ...edit, role_id: e.target.value })}>{data.roles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
            {!edit.id && <div className="xs muted">New directory records can be assigned responsibilities immediately. Sign-in accounts are issued separately by the identity administrator.</div>}
          </div>
        </Modal>
      )}
      {deact && (
        <Modal title={`${deact.active ? 'Deactivate' : 'Reactivate'} ${deact.name}`} onClose={() => setDeact(null)}
          footer={<><button className="btn" onClick={() => setDeact(null)}>Close</button>{!result && <button className={`btn ${deact.active ? 'danger' : 'primary'}`} disabled={!reason.trim()} onClick={async () => {
            try { const r = await rpc('grc_admin_set_active', { p_emp: deact.id, p_active: !deact.active, p_reason: reason }); setResult(r); toast('ok', 'Account updated'); done(); } catch (er: any) { toast('err', er.message); } }}>{deact.active ? 'Deactivate' : 'Reactivate'}</button>}</>}>
          <div className="stack">
            {deact.active && <Notice kind="warn">Access is removed immediately and any delegation to or from this person is revoked. Open responsibilities must be reassigned.</Notice>}
            {!result ? <Field label="Reason"><input className="input" value={reason} onChange={e => setReason(e.target.value)} /></Field> :
              result.open_items.length === 0 ? <Notice kind="success">No open responsibilities.</Notice> :
              <Notice kind="warn"><b>{result.open_items.length} open responsibility(ies) need reassignment:</b><ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{result.open_items.map((o: any) => <li key={o.id}><a href={`/actions/${o.id}`}>{o.ref}</a> — {o.title} ({o.as})</li>)}</ul></Notice>}
          </div>
        </Modal>
      )}
    </>
  );
}

function Roles({ data, admin, done, toast }: any) {
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <Card flush title="Permission matrix" sub="Enforced by the database on every call. Approval authority comes from the policy, not from these permissions.">
      <div className="table-wrap"><table className="t">
        <thead><tr><th>Permission</th>{data.roles.map((r: any) => <th key={r.id} style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 150, verticalAlign: 'bottom' }}>{r.name}</th>)}</tr></thead>
        <tbody>{ALL_PERMS.map(p => (
          <tr key={p}><td className="small nowrap"><div className="strong">{PERMISSION_LABEL[p]}</div><div className="cell-sub mono">{p}</div></td>
            {data.roles.map((r: any) => {
              const has = r.permissions.includes(p); const k = r.id + p;
              return <td key={r.id} style={{ textAlign: 'center' }}>
                {admin ? <button className={`btn sm ${has ? 'primary' : 'ghost'}`} style={{ width: 30, padding: 0 }} disabled={busy === k} aria-label={`${has ? 'Revoke' : 'Grant'} ${p} for ${r.name}`}
                  onClick={async () => { setBusy(k); try { await rpc('grc_admin_set_permission', { p_role: r.id, p_perm: p, p_grant: !has }); done(); } catch (e: any) { toast('err', e.message); } finally { setBusy(null); } }}>{has ? <Check size={14} /> : '·'}</button>
                  : has ? <Check size={15} color="var(--success)" /> : <span className="muted">·</span>}
              </td>;
            })}</tr>))}</tbody>
      </table></div>
    </Card>
  );
}

function Policy({ data, admin, done }: any) {
  const { orgId } = useSession();
  const toast = useToast();
  const [edit, setEdit] = useState<any>(null);
  const types = Object.fromEntries(data.action_types.map((t: any) => [t.code, t.name]));
  return (
    <>
      <Card flush title="Approval rules" sub="A request matches a rule when its severity, asset criticality and amount fall within the rule's range. Matching rules become ordered approval steps."
        actions={admin && <button className="btn sm primary" onClick={() => setEdit({ action_type: data.action_types[0].code, step: 1, approver_role_id: data.roles[0].id, min_severity: 1, max_severity: 4, min_asset_criticality: 1, min_amount: 0, in_emergency: 'post_review', rationale: '' })}><Plus size={14} />Add rule</button>}>
        <div className="table-wrap"><table className="t responsive">
          <thead><tr><th>Action</th><th>Step</th><th>Approver</th><th>Applies when</th><th>In emergency</th><th>Rationale</th><th /></tr></thead>
          <tbody>{data.rules.map((r: any) => (
            <tr key={r.id} className={r.active ? '' : 'dim'}>
              <td className="primary small strong">{types[r.action_type]}</td>
              <td data-label="Step">{r.step}</td>
              <td data-label="Approver"><Badge tone="warning">{r.approver}</Badge></td>
              <td data-label="When" className="xs">Severity {r.min_severity}–{r.max_severity}{r.min_asset_criticality > 1 && ` · asset crit ≥ ${r.min_asset_criticality}`}{+r.min_amount > 0 && ` · amount ≥ ${fmtMoney(r.min_amount)}`}</td>
              <td data-label="Emergency">{r.in_emergency === 'post_review' ? <Badge tone="info">Post-review</Badge> : <Badge tone="danger">Still required</Badge>}</td>
              <td data-label="Rationale" className="xs">{r.rationale}</td>
              <td>{admin && <button className="btn sm ghost" onClick={() => setEdit({ ...r })} aria-label="Edit rule"><Pencil size={14} /></button>}</td>
            </tr>))}</tbody>
        </table></div>
      </Card>
      {edit && (
        <Modal title={edit.id ? `Edit rule #${edit.id}` : 'New approval rule'} sub="Changes apply to new submissions immediately and are recorded with before/after values." onClose={() => setEdit(null)} wide
          footer={<><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn primary" disabled={!edit.rationale?.trim()} onClick={async () => {
            try { await rpc('grc_admin_rule_save', { p_org: orgId, p: edit }); toast('ok', 'Policy updated'); setEdit(null); done(); } catch (e: any) { toast('err', e.message); } }}>Save rule</button></>}>
          <div className="stack">
            <div className="grid g3">
              <Field label="Action type"><select className="select" disabled={!!edit.id} value={edit.action_type} onChange={e => setEdit({ ...edit, action_type: e.target.value })}>{data.action_types.map((t: any) => <option key={t.code} value={t.code}>{t.name}</option>)}</select></Field>
              <Field label="Step"><input className="input" type="number" min={1} value={edit.step} onChange={e => setEdit({ ...edit, step: +e.target.value })} /></Field>
              <Field label="Approver role"><select className="select" value={edit.approver_role_id} onChange={e => setEdit({ ...edit, approver_role_id: e.target.value })}>{data.roles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
            </div>
            <div className="grid g4">
              <Field label="Min severity"><select className="select" value={edit.min_severity} onChange={e => setEdit({ ...edit, min_severity: +e.target.value })}>{[1, 2, 3, 4].map(n => <option key={n}>{n}</option>)}</select></Field>
              <Field label="Max severity"><select className="select" value={edit.max_severity} onChange={e => setEdit({ ...edit, max_severity: +e.target.value })}>{[1, 2, 3, 4].map(n => <option key={n}>{n}</option>)}</select></Field>
              <Field label="Min asset criticality"><select className="select" value={edit.min_asset_criticality} onChange={e => setEdit({ ...edit, min_asset_criticality: +e.target.value })}>{[1, 2, 3, 4].map(n => <option key={n}>{n}</option>)}</select></Field>
              <Field label="Min amount (€)"><input className="input" type="number" value={edit.min_amount} onChange={e => setEdit({ ...edit, min_amount: +e.target.value })} /></Field>
            </div>
            <div className="grid g2">
              <Field label="During an emergency"><select className="select" value={edit.in_emergency} onChange={e => setEdit({ ...edit, in_emergency: e.target.value })}><option value="post_review">Becomes a post-emergency review</option><option value="still_required">Still required before execution</option></select></Field>
              {edit.id && <Field label="Active"><select className="select" value={String(edit.active)} onChange={e => setEdit({ ...edit, active: e.target.value === 'true' })}><option value="true">Active</option><option value="false">Disabled</option></select></Field>}
            </div>
            <Field label="Policy rationale (shown to approvers)"><textarea className="textarea" value={edit.rationale} onChange={e => setEdit({ ...edit, rationale: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
    </>
  );
}
