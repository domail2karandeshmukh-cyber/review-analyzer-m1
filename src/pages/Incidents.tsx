import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, ShieldCheck, Euro, Search, CheckCircle2, MessageSquarePlus, ListPlus } from 'lucide-react';
import { rpc } from '../lib/supabase';
import { useRpc, useSession } from '../lib/session';
import { ago, fmtDateTime, fmtMoney } from '../lib/format';
import { Badge, Card, Empty, ErrorBox, Field, Level, Loading, Locked, Modal, Notice, PageHead, Person, Score, Severity, Status, useToast } from '../components/ui';
import { NewActionModal } from '../components/NewAction';
import { RegClocks } from '../components/RegClocks';

export function Incidents() {
  const { orgId, can } = useSession();
  const [archived, setArchived] = useState(false);
  const { data, error, loading } = useRpc<any[]>('grc_incidents', { p_org: orgId, p_include_archived: archived }, { poll: 10000 });
  const [newOpen, setNewOpen] = useState(false);
  const nav = useNavigate();
  return (
    <>
      <PageHead title="Incidents" desc="Security, financial and operational events under investigation. An incident can only be closed once every linked action is verified."
        actions={can('incident.create') && <button className="btn primary" onClick={() => setNewOpen(true)}><Plus size={16} />Report incident</button>} />
      <Card flush>
        <div className="toolbar"><label className="row small muted" style={{ marginLeft: 'auto' }}><input type="checkbox" checked={archived} onChange={e => setArchived(e.target.checked)} /> Include archived scenario runs</label></div>
        <ErrorBox error={error} />
        {loading && !data ? <Loading /> : (data ?? []).length === 0 ? <div className="quiet"><div className="quiet-ring"><ShieldCheck size={26} /></div><h2>All quiet.</h2><p>No open incident. When the detection feed raises one, it lands here and the investigator is notified.</p><div className="row wrap" style={{ justifyContent: 'center' }}><Link className="btn" to="/scenarios">Scenario center</Link><Link className="btn primary" to="/present">Open present mode</Link></div></div> : (
          <div className="table-wrap"><table className="t responsive">
            <thead><tr><th>Incident</th><th>Severity</th><th>Status</th><th>Investigator</th><th>Assessments</th><th>Actions</th><th>Detected</th></tr></thead>
            <tbody>{data!.map(i => (
              <tr key={i.id} className={`click ${i.archived ? 'dim' : ''}`} onClick={() => nav(`/incidents/${i.id}`)}>
                <td className="primary"><div className="cell-title">{i.title}</div><div className="cell-sub"><span className="mono">{i.ref}</span> · {i.category}{i.asset && ` · ${i.asset}`}{i.financial_exposure && ` · ${fmtMoney(i.financial_exposure)}`}{i.archived && ' · archived'}</div></td>
                <td data-label="Severity"><Severity s={i.severity} /></td>
                <td data-label="Status"><Status s={i.status} /></td>
                <td data-label="Investigator" className="small">{i.assigned_to?.name ?? '—'}</td>
                <td data-label="Assessments"><div className="row"><Badge tone={i.has_security_assessment ? 'success' : 'muted'}>Security</Badge>{i.financial_exposure != null && <Badge tone={i.has_financial_assessment ? 'success' : 'muted'}>Financial</Badge>}</div></td>
                <td data-label="Actions" className="small">{i.actions - i.open_actions}/{i.actions} done</td>
                <td data-label="Detected" className="small nowrap">{ago(i.detected_at)}</td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Card>
      {newOpen && <NewIncident onClose={() => setNewOpen(false)} />}
    </>
  );
}

function NewIncident({ onClose }: { onClose: () => void }) {
  const { orgId, bump } = useSession();
  const org = useRpc<any>('grc_org', { p_org: orgId });
  const risks = useRpc<any[]>('grc_risks', { p_org: orgId });
  const nav = useNavigate();
  const toast = useToast();
  const [f, setF] = useState<any>({ title: '', description: '', category: 'Security', severity: 2, risk_id: '', asset_id: '', assigned_to: '', financial_exposure: '' });
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title="Report an incident" onClose={onClose} wide footer={<><button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" disabled={!f.title} onClick={async () => { try { const id = await rpc<string>('grc_create_incident', { p_org: orgId, p: f }); toast('ok', 'Incident created'); bump(); nav(`/incidents/${id}`); } catch (e: any) { setErr(e.message); } }}>Create</button></>}>
      <div className="stack">
        <Field label="Title"><input className="input" value={f.title} onChange={set('title')} /></Field>
        <Field label="Description"><textarea className="textarea" value={f.description} onChange={set('description')} /></Field>
        <div className="grid g3">
          <Field label="Category"><select className="select" value={f.category} onChange={set('category')}>{['Security', 'Cyber-enabled payment fraud', 'Operational', 'Supplier', 'Compliance', 'Payment fraud'].map(c => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Severity"><select className="select" value={f.severity} onChange={set('severity')}>{[1, 2, 3, 4].map(n => <option key={n}>{n}</option>)}</select></Field>
          <Field label="Financial exposure (€)"><input className="input" type="number" value={f.financial_exposure} onChange={set('financial_exposure')} /></Field>
        </div>
        <div className="grid g3">
          <Field label="Related risk"><select className="select" value={f.risk_id} onChange={set('risk_id')}><option value="">—</option>{(risks.data ?? []).map((r: any) => <option key={r.id} value={r.id}>{r.code} · {r.title}</option>)}</select></Field>
          <Field label="Asset"><select className="select" value={f.asset_id} onChange={set('asset_id')}><option value="">—</option>{(org.data?.assets ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <Field label="Assign investigator"><select className="select" value={f.assigned_to} onChange={set('assigned_to')}><option value="">—</option>{(org.data?.employees ?? []).filter((e: any) => e.active && e.has_login).map((e: any) => <option key={e.id} value={e.id}>{e.name} — {e.role}</option>)}</select></Field>
        </div>
        {err && <Notice kind="danger">{err}</Notice>}
      </div>
    </Modal>
  );
}

export function IncidentDetail() {
  const { id } = useParams();
  const { data: i, error, loading, reload } = useRpc<any>('grc_incident', { p_id: id }, { poll: 6000 });
  const { bump } = useSession();
  const toast = useToast();
  const [dlg, setDlg] = useState<string | null>(null);
  const [text, setText] = useState(''); const [rec, setRec] = useState(''); const [sev, setSev] = useState(3); const [st, setSt] = useState('contained');
  const nav = useNavigate();
  if (loading && !i) return <Card><Loading rows={6} /></Card>;
  if (error) return <ErrorBox error={error} />;
  if (!i) return null;
  const close = () => { setDlg(null); setText(''); setRec(''); };
  const run = async (fn: string, args: any, ok: string) => { try { await rpc(fn, args); toast('ok', ok); close(); reload(); bump(); } catch (e: any) { toast('err', e.message); } };
  const openActions = i.actions.filter((a: any) => !['completed', 'cancelled', 'rejected'].includes(a.status)).length;

  return (
    <div className="stack loose">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <div className="eyebrow row"><Link to="/incidents">Incidents</Link> / <span className="mono">{i.ref}</span>{i.archived && <Badge tone="muted">Archived · read-only</Badge>}</div>
          <h1>{i.title}</h1>
          <div className="row wrap" style={{ marginTop: 8 }}><Status s={i.status} /><Severity s={i.severity} /><Badge>{i.category}</Badge>{i.financial_exposure != null && <Badge tone="danger">Exposure {fmtMoney(i.financial_exposure)}</Badge>}
            <Badge tone="muted">{i.source === 'simulated_detection_feed' ? 'Simulated detection feed' : i.source === 'kri_alert' ? 'From KRI alert' : 'Manual report'}</Badge></div>
        </div>
        <div className="row wrap">
          {i.can.investigate && <button className="btn primary" onClick={() => setDlg('investigate')}><Search size={15} />Open investigation</button>}
          {i.can.assess_security && <button className={`btn ${!i.security_assessment ? 'primary' : ''}`} onClick={() => setDlg('security')}><ShieldCheck size={15} />{i.security_assessment ? 'Update' : 'Record'} security assessment</button>}
          {i.can.assess_financial && <button className={`btn ${!i.financial_assessment ? 'primary' : ''}`} onClick={() => setDlg('financial')}><Euro size={15} />{i.financial_assessment ? 'Update' : 'Record'} financial assessment</button>}
          {i.can.propose_action && i.status !== 'new' && <button className="btn" onClick={() => setDlg('action')}><ListPlus size={15} />Propose response</button>}
          {i.can.change_status && <button className="btn" onClick={() => setDlg('status')}>Update status</button>}
          {i.can.close && <button className="btn" disabled={openActions > 0} title={openActions > 0 ? `${openActions} action(s) not yet verified` : ''} onClick={() => setDlg('close')}><CheckCircle2 size={15} />Close incident</button>}
        </div>
      </div>
      {i.can.close && openActions > 0 && <Locked>Closing is blocked: {openActions} linked action(s) are not completed and verified.</Locked>}

      <div className="grid g-main-wide">
        <div className="stack loose">
          <Card title="What happened"><p style={{ margin: 0 }}>{i.description}</p></Card>
          <div className="grid g2">
            <Assess title="Security assessment" who="RSSI / CISO" a={i.security_assessment} />
            <Assess title="Financial assessment" who="Finance authority" a={i.financial_assessment} na={i.financial_exposure == null} />
          </div>
          <Card title="Response actions" flush actions={i.can.propose_action && i.status !== 'new' && <button className="btn sm" onClick={() => setDlg('action')}><Plus size={14} />Propose</button>}>
            {i.actions.length === 0 ? <Empty title="No response proposed yet">{i.status === 'new' ? 'Open the investigation first.' : 'Propose containment or business actions; policy decides who approves.'}</Empty> :
              i.actions.map((a: any) => (
                <div key={a.id} className="list-row click" onClick={() => nav(`/actions/${a.id}`)}>
                  <div className="grow"><div className="strong small">{a.title}</div><div className="xs muted"><span className="mono">{a.ref}</span> · {a.type_name}{a.amount != null && ` · ${fmtMoney(a.amount)}`} · next: {a.next?.title}{a.next?.actor && ` (${a.next.actor})`}</div></div>
                  <Status s={a.status} />
                </div>
              ))}
          </Card>
          <Card title="Incident timeline" sub="Incident and linked action events from the audit trail">
            <div className="timeline">{i.timeline.map((t: any) => (
              <div key={t.id} className="tl"><div className="when">{fmtDateTime(t.at)}</div><div className={`pip ${t.stage}`} /><div><div className="what">{t.summary}</div><div className="who">{t.actor} · {t.role}</div></div></div>
            ))}</div>
          </Card>
        </div>
        <div className="stack loose">
          <RegClocks incidentId={i.id} archived={i.archived} />
          <Card title="People">
            <div className="stack">
              <div><div className="xs muted">Investigator</div><Person p={i.assigned_to} /></div>
              {i.reported_by && <div><div className="xs muted">Reported by</div><Person p={i.reported_by} /></div>}
              {i.risk?.owner && <div><div className="xs muted">Risk owner (accountable)</div><Person p={i.risk.owner} /></div>}
            </div>
          </Card>
          <Card title="Context">
            <dl className="kv" style={{ gridTemplateColumns: '110px 1fr' }}>
              <dt>Risk</dt><dd>{i.risk ? <span className="row wrap"><Link to={`/risks?r=${i.risk.id}`}>{i.risk.code} {i.risk.title}</Link><Score score={i.risk.score} /><Level score={i.risk.score} /></span> : '—'}</dd>
              <dt>Asset</dt><dd>{i.asset ? <>{i.asset.name}<div className="xs muted">Criticality {i.asset.criticality} · {i.asset.department}</div></> : '—'}</dd>
              <dt>Affected service</dt><dd>{i.asset?.service ?? '—'}</dd>
              <dt>Detected</dt><dd>{fmtDateTime(i.detected_at)}</dd>
              {i.closed_at && <><dt>Closed</dt><dd>{fmtDateTime(i.closed_at)}</dd></>}
            </dl>
          </Card>
          <Card title="Evidence & notes" actions={!i.archived && <button className="btn sm" onClick={() => setDlg('note')}><MessageSquarePlus size={14} />Add</button>}>
            {i.evidence.length === 0 ? <div className="small muted">No evidence yet.</div> : <div className="stack">{i.evidence.map((e: any) => (
              <div key={e.id}><div className="small">{e.summary}</div><div className="xs muted">{e.by?.name} · {e.by?.role} · {fmtDateTime(e.at)}</div></div>))}</div>}
          </Card>
        </div>
      </div>

      {dlg === 'action' && <NewActionModal incident={i} onClose={() => setDlg(null)} />}
      {dlg && dlg !== 'action' && (
        <Modal title={({ investigate: 'Open investigation', security: 'Security assessment', financial: 'Financial assessment', status: 'Update incident status', close: 'Close incident', note: 'Add evidence or note' } as any)[dlg]}
          onClose={close} footer={<><button className="btn" onClick={close}>Cancel</button>
            <button className="btn primary" disabled={!text.trim()} onClick={() => {
              if (dlg === 'investigate') run('grc_incident_transition', { p_id: i.id, p_status: 'investigating', p_note: text }, 'Investigation opened');
              else if (dlg === 'security' || dlg === 'financial') run('grc_assess_incident', { p_id: i.id, p_kind: dlg, p_summary: text, p_severity: sev, p_recommendation: rec }, 'Assessment recorded');
              else if (dlg === 'status') run('grc_incident_transition', { p_id: i.id, p_status: st, p_note: text }, 'Status updated');
              else if (dlg === 'close') run('grc_incident_transition', { p_id: i.id, p_status: 'closed', p_note: text }, 'Incident closed');
              else run('grc_add_note', { p_entity_type: 'incident', p_id: i.id, p_note: text }, 'Note added');
            }}>Save</button></>}>
          <div className="stack">
            {(dlg === 'security' || dlg === 'financial') && <Notice>{dlg === 'security' ? 'Recorded under your RSSI authority. Affected business services are taken from the asset record.' : 'Recorded under your financial authority: exposure, cash and operational consequences.'}</Notice>}
            <Field label={dlg === 'investigate' ? 'Initial findings' : dlg === 'close' ? 'Closure summary for management' : dlg === 'note' ? 'Note' : 'Assessment'}><textarea className="textarea" value={text} onChange={e => setText(e.target.value)} /></Field>
            {(dlg === 'security' || dlg === 'financial') && <>
              <Field label="Assessed severity"><select className="select" value={sev} onChange={e => setSev(+e.target.value)}>{[1, 2, 3, 4].map(n => <option key={n}>{n}</option>)}</select></Field>
              <Field label="Recommendation"><textarea className="textarea" value={rec} onChange={e => setRec(e.target.value)} placeholder="e.g. Disable account; hold payment pending call-back" /></Field>
            </>}
            {dlg === 'status' && <Field label="New status"><select className="select" value={st} onChange={e => setSt(e.target.value)}><option value="contained">Contained</option><option value="resolved">Resolved</option></select></Field>}
          </div>
        </Modal>
      )}
    </div>
  );
}

function Assess({ title, who, a, na }: { title: string; who: string; a: any; na?: boolean }) {
  return (
    <Card title={title} sub={who}>
      {na ? <div className="small muted">No financial exposure recorded for this incident.</div> : !a ? <div className="small muted">Not yet recorded.</div> : (
        <div className="stack tight">
          <div className="small">{a.summary}</div>
          {a.recommendation && <div className="small"><b>Recommendation:</b> {a.recommendation}</div>}
          {a.affected_service && <div className="small"><b>Affected service:</b> {a.affected_service}</div>}
          <div className="row"><Severity s={a.severity} /><span className="xs muted">{a.by} · {a.role} · {fmtDateTime(a.at)}</span></div>
        </div>
      )}
    </Card>
  );
}
