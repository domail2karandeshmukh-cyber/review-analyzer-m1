import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Plus, X, Activity, Siren } from 'lucide-react';
import { rpc } from '../lib/supabase';
import { useRpc, useSession } from '../lib/session';
import { ago, fmtDateTime } from '../lib/format';
import { Badge, Card, Empty, Field, Level, Loading, Modal, Notice, PageHead, Person, Score, Status, Tabs, useToast } from '../components/ui';
import { HeatMap, KriPill } from '../components/Heat';
import { NewActionModal } from '../components/NewAction';

export default function Risks() {
  const { orgId, can } = useSession();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') ?? 'register';
  const sel = sp.get('r');
  const { data, loading } = useRpc<any[]>('grc_risks', { p_org: orgId }, { poll: 15000 });
  const [newOpen, setNewOpen] = useState(false);
  const caseRisks = (data ?? []).filter(r => r.origin === 'case');
  const total = caseRisks.reduce((s, r) => s + r.score, 0);
  const top5 = [...caseRisks].sort((a, b) => b.score - a.score).slice(0, 5).reduce((s, r) => s + r.score, 0);
  const risk = data?.find(r => r.id === sel);

  return (
    <>
      <PageHead title="Risk portfolio"
        desc={orgId === 'NT' ? <>R1–R6 are the Group 1 case register; their scores are read live from the original records (case total {total || '…'}, Top-5 {top5 || '…'}). R7–R8 extend the register for the Finance department.</> : 'Fictional bank register (template).'}
        actions={can('risk.manage') && <button className="btn primary" onClick={() => setNewOpen(true)}><Plus size={16} />Identify a risk</button>} />
      <Tabs value={tab} onChange={k => setSp(k === 'register' ? {} : { tab: k })} tabs={[{ key: 'register', label: 'Register' }, { key: 'matrix', label: 'Heat map' }, ...(orgId === 'NT' ? [{ key: 'monitoring', label: 'KRI monitoring & alerts' }] : [])]} />
      {loading && !data ? <Card><Loading rows={6} /></Card> : tab === 'register' ? (
        <Card flush>
          <div className="table-wrap"><table className="t responsive">
            <thead><tr><th>Risk</th><th>L × I</th><th>Score</th><th>Owner (A)</th><th>Department</th><th>KRI</th><th>Treatment</th><th>Residual</th></tr></thead>
            <tbody>{data!.map(r => (
              <tr key={r.id} className="click" onClick={() => setSp({ r: r.id })}>
                <td className="primary"><div className="row"><Badge>{r.code}</Badge><span className="cell-title">{r.title}</span></div><div className="cell-sub">{r.category}{r.origin === 'governance_upgrade' && ' · Finance register addition'}</div></td>
                <td data-label="L × I" className="mono nowrap">{r.likelihood} × {r.impact}</td>
                <td data-label="Score"><span className="row"><Score score={r.score} /><Level score={r.score} /></span></td>
                <td data-label="Owner" className="small">{r.owner?.name}<div className="cell-sub">{r.owner?.role}</div></td>
                <td data-label="Department" className="small">{r.department}</td>
                <td data-label="KRI">{r.kri ? <KriPill s={r.kri} /> : <span className="muted small">—</span>}</td>
                <td data-label="Treatment" className="small">{r.open_actions} open · {r.completed_actions} done</td>
                <td data-label="Residual">{r.residual_score ? <Score score={r.residual_score} /> : <span className="xs muted">{r.residual_target_score ? `target ${r.residual_target_score}` : '—'}</span>}</td>
              </tr>))}</tbody>
          </table></div>
        </Card>
      ) : tab === 'matrix' ? (
        <div className="grid g-main">
          <Card title="Inherent risk heat map"><HeatMap items={data!.map(r => ({ id: r.id, code: r.code, l: r.likelihood, i: r.impact, title: r.title }))} /></Card>
          <Card title="How scores are calculated">
            <div className="stack small">
              <div>Score = <b>Likelihood × Impact</b>, each on the 1–4 teacher scale.</div>
              <div className="row wrap"><Badge tone="success">1–3 Low</Badge><Badge tone="warning">4–7 Moderate</Badge><Badge tone="danger">8–11 High</Badge><Badge tone="critical">12–16 Critical</Badge></div>
              {orgId === 'NT' && <div>Case register (R1–R6): total <b>{total}</b>, Top-5 exposure <b>{top5}</b>. Values are computed from the stored likelihood and impact — not hard-coded.</div>}
              <div className="muted">Residual risk is recorded by the verifier when a treatment action is completed, so improvement is measured, not assumed.</div>
            </div>
          </Card>
        </div>
      ) : <Monitoring />}
      {risk && <RiskDrawer risk={risk} onClose={() => setSp(tab === 'register' ? {} : { tab })} />}
      {newOpen && <NewRisk onClose={() => setNewOpen(false)} />}
    </>
  );
}

function RiskDrawer({ risk: r, onClose }: { risk: any; onClose: () => void }) {
  const { orgId, can, bump } = useSession();
  const acts = useRpc<any[]>('grc_actions', { p_org: orgId });
  const org = useRpc<any>(can('risk.manage') ? 'grc_org' : null, { p_org: orgId });
  const nav = useNavigate();
  const toast = useToast();
  const [edit, setEdit] = useState(false);
  const [act, setAct] = useState(false);
  const [f, setF] = useState({ likelihood: r.likelihood, impact: r.impact, owner_id: r.owner?.id ?? '' });
  const mine = (acts.data ?? []).filter(a => a.risk_id === r.id);
  return (
    <>
      <div className="overlay" style={{ background: 'rgba(9,15,30,.25)' }} onClick={onClose} />
      <aside className="drawer" style={{ width: 'min(520px, 100%)' }}>
        <div className="drawer-head"><div className="row"><Badge>{r.code}</Badge><b>{r.title}</b></div><button className="iconbtn" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        <div className="drawer-body" style={{ padding: 16 }}>
          <div className="stack loose">
            <div className="row wrap"><Score score={r.score} /><Level score={r.score} /><span className="mono small">L{r.likelihood} × I{r.impact}</span>{r.residual_score && <><span className="muted small">→ residual</span><Score score={r.residual_score} /></>}</div>
            <p style={{ margin: 0 }}>{r.description}</p>
            <dl className="kv" style={{ gridTemplateColumns: '120px 1fr' }}>
              <dt>Category</dt><dd>{r.category}</dd><dt>Department</dt><dd>{r.department}</dd><dt>Treatment</dt><dd>{r.treatment ?? '—'}</dd>
              {r.legacy_id && <><dt>Source</dt><dd className="small">Original case record {r.legacy_id} (single source of truth)</dd></>}
            </dl>
            {r.kri && <Card title="Key risk indicator"><div className="row between"><div className="small">{r.kri.kri}<div className="xs muted">warning {r.kri.warning} · critical {r.kri.critical} · {ago(r.kri.recorded_at)}</div></div><KriPill s={r.kri} /></div></Card>}
            <div>
              <div className="section-title">Responsibility (RACI)</div>
              <div className="stack tight">{r.raci.map((x: any, i: number) => <div key={i} className="row"><Badge tone={x.raci === 'A' ? 'accent' : x.raci === 'R' ? 'info' : x.raci === 'C' ? 'warning' : 'muted'}>{x.raci}</Badge><Person p={x.employee} size="sm" /></div>)}</div>
            </div>
            <div>
              <div className="row between"><div className="section-title">Treatment actions</div>{can('action.propose') && <button className="btn sm" onClick={() => setAct(true)}><Plus size={14} />Propose</button>}</div>
              {mine.length === 0 ? <div className="small muted">No action plan yet.</div> : <div className="stack tight">{mine.map(a => (
                <div key={a.id} className="row click" style={{ cursor: 'pointer' }} onClick={() => nav(`/actions/${a.id}`)}><span className="mono small">{a.ref}</span><span className="small grow">{a.title}</span><Status s={a.status} /></div>))}</div>}
            </div>
            {can('risk.manage') && !edit && <button className="btn" onClick={() => setEdit(true)}>Edit scoring / owner</button>}
            {edit && (
              <Card title="Edit risk">
                <div className="stack">
                  <div className="grid g2">
                    <Field label="Likelihood"><select className="select" value={f.likelihood} onChange={e => setF({ ...f, likelihood: +e.target.value })}>{[1, 2, 3, 4].map(n => <option key={n}>{n}</option>)}</select></Field>
                    <Field label="Impact"><select className="select" value={f.impact} onChange={e => setF({ ...f, impact: +e.target.value })}>{[1, 2, 3, 4].map(n => <option key={n}>{n}</option>)}</select></Field>
                  </div>
                  <Field label="Accountable owner"><select className="select" value={f.owner_id} onChange={e => setF({ ...f, owner_id: e.target.value })}>{(org.data?.employees ?? []).filter((e: any) => e.active).map((e: any) => <option key={e.id} value={e.id}>{e.name} — {e.role}</option>)}</select></Field>
                  {r.legacy_id && <Notice kind="warn">Changing L or I updates the original case record {r.legacy_id} (shared with the previous dashboard).</Notice>}
                  <div className="row"><button className="btn" onClick={() => setEdit(false)}>Cancel</button><button className="btn primary" onClick={async () => {
                    try { const p: any = { id: r.id, owner_id: f.owner_id }; if (f.likelihood !== r.likelihood || f.impact !== r.impact) { p.likelihood = f.likelihood; p.impact = f.impact; }
                      await rpc('grc_risk_save', { p_org: orgId, p }); toast('ok', 'Risk updated'); setEdit(false); bump(); } catch (e: any) { toast('err', e.message); } }}>Save</button></div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </aside>
      {act && <NewActionModal riskId={r.id} onClose={() => setAct(false)} />}
    </>
  );
}

function NewRisk({ onClose }: { onClose: () => void }) {
  const { orgId, bump } = useSession();
  const org = useRpc<any>('grc_org', { p_org: orgId });
  const toast = useToast();
  const [f, setF] = useState<any>({ title: '', category: 'Operational', department_id: '', description: '', likelihood: 2, impact: 2, owner_id: '', treatment: 'Reduce' });
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title="Identify a new risk" sub="A risk cannot be saved without an accountable owner." onClose={onClose} wide
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!f.title || !f.owner_id} onClick={async () => {
        try { await rpc('grc_risk_save', { p_org: orgId, p: { ...f, likelihood: +f.likelihood, impact: +f.impact } }); toast('ok', 'Risk added; owner notified'); bump(); onClose(); } catch (e: any) { setErr(e.message); } }}>Add to register</button></>}>
      <div className="stack">
        <Field label="Title"><input className="input" value={f.title} onChange={set('title')} /></Field>
        <div className="grid g3">
          <Field label="Category"><input className="input" value={f.category} onChange={set('category')} /></Field>
          <Field label="Department"><select className="select" value={f.department_id} onChange={set('department_id')}><option value="">—</option>{(org.data?.departments ?? []).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          <Field label="Accountable owner"><select className="select" value={f.owner_id} onChange={set('owner_id')}><option value="">Select…</option>{(org.data?.employees ?? []).filter((e: any) => e.active).map((e: any) => <option key={e.id} value={e.id}>{e.name} — {e.role}</option>)}</select></Field>
        </div>
        <div className="grid g3">
          <Field label="Likelihood (1–4)"><select className="select" value={f.likelihood} onChange={set('likelihood')}>{[1, 2, 3, 4].map(n => <option key={n}>{n}</option>)}</select></Field>
          <Field label="Impact (1–4)"><select className="select" value={f.impact} onChange={set('impact')}>{[1, 2, 3, 4].map(n => <option key={n}>{n}</option>)}</select></Field>
          <Field label="Score"><div className="row" style={{ height: 38 }}><Score score={f.likelihood * f.impact} /><Level score={f.likelihood * f.impact} /></div></Field>
        </div>
        <Field label="Description"><textarea className="textarea" value={f.description} onChange={set('description')} /></Field>
        {err && <Notice kind="danger">{err}</Notice>}
      </div>
    </Modal>
  );
}

function Spark({ pts, warn, crit, dir }: { pts: { v: number }[]; warn: number; crit: number; dir: string }) {
  if (!pts?.length) return null;
  const vals = pts.map(p => +p.v);
  const lo = Math.min(...vals, warn, crit), hi = Math.max(...vals, warn, crit);
  const W = 140, H = 34, y = (v: number) => H - 3 - ((v - lo) / (hi - lo || 1)) * (H - 6);
  const x = (i: number) => (i / Math.max(1, vals.length - 1)) * W;
  return (
    <svg width={W} height={H} aria-hidden>
      <line x1={0} x2={W} y1={y(warn)} y2={y(warn)} stroke="#e0a100" strokeDasharray="3 3" strokeWidth={1} />
      <line x1={0} x2={W} y1={y(crit)} y2={y(crit)} stroke="#c0391b" strokeDasharray="3 3" strokeWidth={1} />
      <polyline fill="none" stroke="#2448d8" strokeWidth={1.6} points={vals.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
      <circle cx={x(vals.length - 1)} cy={y(vals[vals.length - 1])} r={2.6} fill={dir === 'higher_is_worse' ? (vals[vals.length - 1] >= crit ? '#c0391b' : vals[vals.length - 1] >= warn ? '#e0a100' : '#1d7a46') : (vals[vals.length - 1] <= crit ? '#c0391b' : vals[vals.length - 1] <= warn ? '#e0a100' : '#1d7a46')} />
    </svg>
  );
}

function Monitoring() {
  const { orgId, bump } = useSession();
  const { data, reload } = useRpc<any>('grc_monitoring', { p_org: orgId }, { poll: 8000 });
  const toast = useToast();
  const nav = useNavigate();
  const [rec, setRec] = useState<any>(null);
  const [val, setVal] = useState(''); const [note, setNote] = useState('');
  const kris = useMemo(() => data?.kris ?? [], [data]);
  if (!data) return <Card><Loading rows={6} /></Card>;
  return (
    <div className="stack loose">
      <Notice>KRI readings feed the existing monitoring pipeline. A threshold crossing creates an alert and notifies the <b>risk owner</b> — it never authorises an action by itself. Values are academic demonstration data.</Notice>
      <Card title="Key risk indicators" flush>
        <div className="table-wrap"><table className="t responsive">
          <thead><tr><th>Risk</th><th>Indicator</th><th>Latest</th><th>Thresholds</th><th>Trend</th><th>Owner</th><th></th></tr></thead>
          <tbody>{kris.map((k: any) => (
            <tr key={k.risk_id}>
              <td className="primary"><Badge>{k.code}</Badge> <span className="small">{k.title}</span></td>
              <td data-label="Indicator" className="small">{k.state?.kri}</td>
              <td data-label="Latest"><KriPill s={k.state} /><div className="xs muted">{ago(k.state?.recorded_at)}</div></td>
              <td data-label="Thresholds" className="small nowrap">W {k.state?.warning} · C {k.state?.critical}<div className="xs muted">{k.state?.direction === 'higher_is_worse' ? 'higher is worse' : 'lower is worse'}</div></td>
              <td data-label="Trend"><Spark pts={k.history} warn={+k.state?.warning} crit={+k.state?.critical} dir={k.state?.direction} /></td>
              <td data-label="Owner" className="small">{k.owner}</td>
              <td>{data.can_record && <button className="btn sm" onClick={() => { setRec(k); setVal(String(k.state?.value ?? '')); setNote(''); }}><Activity size={14} />Record</button>}</td>
            </tr>))}</tbody>
        </table></div>
      </Card>
      <Card title="Recent monitoring alerts" sub="From the existing alert pipeline" flush>
        {data.alerts.length === 0 ? <Empty title="No alerts" /> : data.alerts.map((a: any) => (
          <div key={a.id} className="list-row">
            <Status s={a.severity} />
            <div className="grow"><div className="small">{a.message}</div><div className="xs muted">#{a.id} · {fmtDateTime(a.created_at)} · {a.status}</div></div>
            {a.incident ? <Link className="btn sm" to={`/incidents/${a.incident.id}`}>{a.incident.ref}</Link> :
              data.can_open_incident && a.severity !== 'recovery' && <button className="btn sm" onClick={async () => { try { const id = await rpc<string>('grc_incident_from_alert', { p_org: orgId, p_alert_id: a.id }); toast('ok', 'Incident opened — the alert itself authorises nothing'); bump(); nav(`/incidents/${id}`); } catch (e: any) { toast('err', e.message); } }}><Siren size={14} />Open incident</button>}
          </div>))}
      </Card>
      {rec && (
        <Modal title={`Record ${rec.state?.kri}`} sub={`${rec.code} · warning ${rec.state?.warning} · critical ${rec.state?.critical} ${rec.state?.unit}`} onClose={() => setRec(null)}
          footer={<><button className="btn" onClick={() => setRec(null)}>Cancel</button><button className="btn primary" disabled={val === ''} onClick={async () => {
            try { const st = await rpc<any>('grc_record_kri', { p_org: orgId, p_legacy_risk: rec.legacy_id, p_value: +val, p_note: note }); toast(st.level === 'normal' ? 'ok' : 'err', `${rec.code} → ${st.level.toUpperCase()}`); setRec(null); reload(); bump(); } catch (e: any) { toast('err', e.message); } }}>Record reading</button></>}>
          <div className="stack">
            <Field label={`Value (${rec.state?.unit})`}><input className="input" type="number" step="any" value={val} onChange={e => setVal(e.target.value)} /></Field>
            <Field label="Note"><input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="Source or context" /></Field>
            <div className="xs muted">Stored with your name and source “governance_platform”. Verification criteria that reference this KRI read the latest value.</div>
          </div>
        </Modal>
      )}
    </div>
  );
}
