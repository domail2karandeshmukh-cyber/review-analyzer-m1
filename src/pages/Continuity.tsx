import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ClipboardCheck } from 'lucide-react';
import { rpc } from '../lib/supabase';
import { useRpc, useSession } from '../lib/session';
import { fmtDate, fmtMoneyShort, TEST, TIER } from '../lib/format';
import { Badge, CaseTag, Card, Drawer, Empty, ErrorBox, Field, Loading, Notice, PageHead, Stat, useToast } from '../components/ui';
import '../styles/ops.css';

type P = any;
const PLAN: Record<string, { label: string; tone: any }> = {
  documented: { label: 'Documented', tone: 'success' }, draft: { label: 'Draft', tone: 'warning' }, not_started: { label: 'Not started', tone: 'critical' },
};
const hrs = (h?: number | null) => (h === null || h === undefined ? '—' : h >= 48 && h % 24 === 0 ? `${h / 24} d` : `${h} h`);
const isCase = (n?: string | null) => !!n && n.startsWith('Case-study record:');
const stripCase = (n?: string | null) => { const s = (n ?? '').replace(/^Case-study record:\s*/, ''); return s.charAt(0).toUpperCase() + s.slice(1); };

function lastTimed(p: P) { return (p.tests ?? []).find((t: any) => t.achieved_rto_hours !== null && t.achieved_rto_hours !== undefined); }

/** Single points of failure: an asset shared by 3+ processes incl. a tier-1, or a supplier with no exit plan behind a tier 1–2 process. */
function spofs(ps: P[]) {
  const assetUse: Record<string, P[]> = {};
  const vendorUse: Record<string, P[]> = {};
  ps.forEach(p => { (p.assets ?? []).forEach((a: any) => (assetUse[a.id] ??= []).push(p)); (p.vendors ?? []).forEach((v: any) => (vendorUse[v.id] ??= []).push(p)); });
  const out: Record<string, string> = {};
  Object.entries(assetUse).forEach(([id, list]) => { if (list.length >= 3 && list.some(p => p.tier === 1)) out[id] = `Shared by ${list.length} processes, incl. tier 1`; });
  ps.forEach(p => (p.vendors ?? []).forEach((v: any) => { if (!v.exit_plan && p.tier <= 2) out[v.id] = `No exit plan behind tier-${p.tier} “${p.name}”`; }));
  return out;
}

function RtoCell({ p }: { p: P }) {
  const t = lastTimed(p);
  if (!t) return <span className="xs muted">No timed test</span>;
  const max = Math.max(p.rto_hours, t.achieved_rto_hours) * 1.15;
  const miss = t.achieved_rto_hours > p.rto_hours;
  return (
    <div className="rto-cell" title={`Achieved ${t.achieved_rto_hours} h against a ${p.rto_hours} h objective`}>
      <div className="rto-bar"><div className="ach" style={{ width: `${(t.achieved_rto_hours / max) * 100}%`, background: miss ? 'var(--crit)' : 'var(--pass)' }} /><div className="tgt" style={{ left: `${(p.rto_hours / max) * 100}%` }} /></div>
      <span className={`flag ${miss ? 'bad' : 'ok'}`}>{hrs(t.achieved_rto_hours)} vs {hrs(p.rto_hours)} {miss ? '· missed' : '· met'}</span>
    </div>
  );
}

function DependencyMap({ ps, sel, onPick }: { ps: P[]; sel: string | null; onPick: (id: string) => void }) {
  const sp = spofs(ps);
  const assets: any[] = []; const vendors: any[] = [];
  ps.forEach(p => { (p.assets ?? []).forEach((a: any) => { if (!assets.find(x => x.id === a.id)) assets.push(a); }); (p.vendors ?? []).forEach((v: any) => { if (!vendors.find(x => x.id === v.id)) vendors.push(v); }); });
  assets.sort((a, b) => b.criticality - a.criticality);
  const W = 880, NW = 230, NH = 40, G = 10, top = 34;
  const colX = [0, (W - NW) / 2, W - NW];
  const n = Math.max(ps.length, assets.length, vendors.length);
  const H = top + n * (NH + G) + 4;
  const yOf = (i: number, count: number) => top + ((n - count) * (NH + G)) / 2 + i * (NH + G);
  const pPos: Record<string, number> = {}; ps.forEach((p, i) => (pPos[p.id] = yOf(i, ps.length)));
  const aPos: Record<string, number> = {}; assets.forEach((a, i) => (aPos[a.id] = yOf(i, assets.length)));
  const vPos: Record<string, number> = {}; vendors.forEach((v, i) => (vPos[v.id] = yOf(i, vendors.length)));
  const linked = (id: string) => !sel || sel === id || ps.find(p => p.id === sel)?.assets?.some((a: any) => a.id === id) || ps.find(p => p.id === sel)?.vendors?.some((v: any) => v.id === id);
  const curve = (x1: number, y1: number, x2: number, y2: number) => { const mx = (x1 + x2) / 2; return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`; };
  const trunc = (s: string, m = 30) => (s.length > m ? s.slice(0, m - 1) + '…' : s);
  return (
    <svg className="dep-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Dependency map: supporting assets, business processes and suppliers">
      <text className="col-h" x={colX[0]} y={14}>SUPPORTING ASSETS</text>
      <text className="col-h" x={colX[1]} y={14}>BUSINESS PROCESSES</text>
      <text className="col-h" x={colX[2]} y={14}>SUPPLIERS</text>
      {ps.map(p => (p.assets ?? []).map((a: any) => {
        const hot = sel === p.id; const s = !!sp[a.id];
        return <path key={`${p.id}-${a.id}`} className={`edge ${hot ? 'hot' : ''} ${s && (!sel || hot) ? 'spof' : ''} ${sel && !hot ? 'dim' : ''}`} d={curve(colX[1], pPos[p.id] + NH / 2, colX[0] + NW, aPos[a.id] + NH / 2)} />;
      }))}
      {ps.map(p => (p.vendors ?? []).map((v: any) => {
        const hot = sel === p.id; const s = !!sp[v.id];
        return <path key={`${p.id}-${v.id}`} className={`edge ${hot ? 'hot' : ''} ${s && (!sel || hot) ? 'spof' : ''} ${sel && !hot ? 'dim' : ''}`} d={curve(colX[1] + NW, pPos[p.id] + NH / 2, colX[2], vPos[v.id] + NH / 2)} />;
      }))}
      {assets.map(a => (
        <g key={a.id} className={`node ${sp[a.id] ? 'spof' : ''} ${linked(a.id) ? '' : 'dim'}`} transform={`translate(${colX[0]},${aPos[a.id]})`}>
          <title>{a.name}{sp[a.id] ? ` — single point of failure: ${sp[a.id]}` : ''}</title>
          <rect width={NW} height={NH} rx={8} />
          <text className="nt" x={12} y={17}>{trunc(a.name.split(' · ')[0], 28)}</text>
          <text className="ns" x={12} y={31}>Criticality {a.criticality}{sp[a.id] ? ' · single point of failure' : ''}</text>
        </g>
      ))}
      {ps.map(p => {
        const t = lastTimed(p); const miss = t && t.achieved_rto_hours > p.rto_hours;
        return (
          <g key={p.id} className={`node ${sel === p.id ? 'sel' : ''} ${sel && sel !== p.id ? 'dim' : ''}`} transform={`translate(${colX[1]},${pPos[p.id]})`} onClick={() => onPick(p.id)}>
            <rect width={NW} height={NH} rx={8} />
            <rect width={4} height={NH - 12} y={6} x={6} rx={2} style={{ fill: p.tier === 1 ? 'var(--crit)' : p.tier === 2 ? 'var(--high)' : 'var(--medium)', stroke: 'none' }} />
            <text className="nt" x={18} y={17}>{trunc(p.name, 27)}</text>
            <text className="ns" x={18} y={31}>Tier {p.tier} · RTO {hrs(p.rto_hours)}{miss ? ' · last test missed' : ''}</text>
          </g>
        );
      })}
      {vendors.map(v => (
        <g key={v.id} className={`node ${sp[v.id] ? 'spof' : ''} ${linked(v.id) ? '' : 'dim'}`} transform={`translate(${colX[2]},${vPos[v.id]})`}>
          <title>{v.name}{sp[v.id] ? ` — ${sp[v.id]}` : ''}</title>
          <rect width={NW} height={NH} rx={8} />
          <text className="nt" x={12} y={17}>{trunc(v.name, 28)}</text>
          <text className="ns" x={12} y={31}>{TIER[v.tier]?.label ?? v.tier} tier · {v.exit_plan ? 'exit plan' : 'no exit plan'}</text>
        </g>
      ))}
    </svg>
  );
}

export default function Continuity() {
  const { orgId } = useSession();
  const { data, error, loading, reload } = useRpc<{ processes: P[]; can_manage: boolean }>('grc_continuity', { p_org: orgId });
  const [sp, setSp] = useSearchParams();
  const [focus, setFocus] = useState<string | null>(null);
  const sel = sp.get('p');
  const open = (id: string | null) => { const n = new URLSearchParams(sp); if (id) n.set('p', id); else n.delete('p'); setSp(n, { replace: true }); };
  const ps: P[] = data?.processes ?? [];
  const spf = useMemo(() => spofs(ps), [ps]);
  const timed = ps.filter(lastTimed);
  const met = timed.filter(p => lastTimed(p).achieved_rto_hours <= p.rto_hours).length;
  const untested = ps.filter(p => (p.tests ?? []).length === 0).length;
  const t1 = ps.filter(p => p.tier === 1);

  return (
    <>
      <PageHead title="Business continuity" desc="Business impact analysis: how long each process can be down (RTO), how much data it can lose (RPO), what it depends on, and whether recovery was proven in a test." />
      <ErrorBox error={error} />
      {loading && !data ? <Card><Loading rows={6} /></Card> : ps.length === 0 ? <Card><Empty title="No process analysed yet" /></Card> : (
        <div className="stack loose">
          <div className="stats">
            <Stat k="Processes analysed" v={ps.length} d={`${fmtMoneyShort(ps.reduce((s, p) => s + (p.impact_per_day ?? 0), 0))} combined impact per day of outage`} />
            <Stat k="Tier 1 (restore ≤ 4 h)" v={t1.length} d={t1.map(p => p.name).join(' · ')} />
            <Stat k="RTO met in last timed test" v={<>{met}<small>/{timed.length}</small></>} d={timed.length - met ? `${timed.length - met} recovery objective missed` : 'All objectives met'} tone={timed.length - met ? 'down' : 'up'} bar={timed.length ? (met / timed.length) * 100 : 0} />
            <Stat k="Never tested" v={untested} d={untested ? 'No exercise on record' : 'Every process exercised'} tone={untested ? 'down' : 'up'} />
            <Stat k="Single points of failure" v={Object.keys(spf).length} d="Shared assets and suppliers without exit" tone={Object.keys(spf).length ? 'down' : 'up'} />
          </div>

          <Card title="Dependency map" sub="Assets on the left, suppliers on the right. Red, dashed links mark single points of failure. Click a process to trace it." flush
            actions={focus && <button className="btn sm" onClick={() => setFocus(null)}>Show all</button>}>
            <div style={{ padding: 16, overflowX: 'auto' }}><div style={{ minWidth: 720 }}><DependencyMap ps={ps} sel={focus} onPick={id => { setFocus(id); open(id); }} /></div></div>
            {Object.keys(spf).length > 0 && (
              <div className="legend-row" style={{ flexDirection: 'column', gap: 6 }}>
                {Object.entries(spf).map(([id, why]) => {
                  const name = ps.flatMap(p => [...(p.assets ?? []), ...(p.vendors ?? [])]).find((x: any) => x.id === id)?.name ?? id;
                  return <span key={id} style={{ color: 'var(--text-2)' }}><AlertTriangle size={13} color="var(--crit-2)" /><b>{name.split(' · ')[0]}</b> — {why}</span>;
                })}
              </div>
            )}
          </Card>

          <Card title="Business impact analysis" sub="Objectives approved in the BCP policy (POL-06). The bar shows achieved recovery time against the objective (tick)." flush>
            <div className="table-wrap"><table className="t responsive">
              <thead><tr><th>Process</th><th>Tier</th><th className="num">RTO</th><th className="num">RPO</th><th className="num">MTPD</th><th className="num">Impact / day</th><th>Owner</th><th>Plan</th><th>Last test</th><th>Recovery vs objective</th></tr></thead>
              <tbody>{ps.map(p => {
                const t = (p.tests ?? [])[0];
                return (
                  <tr key={p.id} className={`click ${sel === p.id ? 'on' : ''}`} onClick={() => open(p.id)}>
                    <td className="primary"><div className="cell-title">{p.name}</div><div className="cell-sub">{p.department}</div></td>
                    <td data-label="Tier"><span className={`tier-pill t${p.tier}`}>{p.tier}</span></td>
                    <td data-label="RTO" className="num">{hrs(p.rto_hours)}</td>
                    <td data-label="RPO" className="num">{hrs(p.rpo_hours)}</td>
                    <td data-label="MTPD" className="num">{hrs(p.mtpd_hours)}</td>
                    <td data-label="Impact/day" className="num">{fmtMoneyShort(p.impact_per_day)}</td>
                    <td data-label="Owner" className="small">{p.owner ?? '—'}<div className="cell-sub">{p.owner_role}</div></td>
                    <td data-label="Plan"><Badge tone={PLAN[p.plan_status]?.tone ?? 'neutral'}>{PLAN[p.plan_status]?.label ?? p.plan_status}</Badge></td>
                    <td data-label="Last test" className="small nowrap">{t ? <><Badge tone={TEST[t.result]?.tone} dot>{TEST[t.result]?.label}</Badge><div className="cell-sub">{fmtDate(t.tested_on)}</div></> : <span className="flag bad">Never tested</span>}</td>
                    <td data-label="Recovery"><RtoCell p={p} /></td>
                  </tr>);
              })}</tbody>
            </table></div>
          </Card>
        </div>
      )}
      {sel && ps.find(p => p.id === sel) && <ProcessDrawer p={ps.find(p => p.id === sel)} can={!!data?.can_manage} spf={spf} onClose={() => { open(null); setFocus(null); }} onSaved={reload} />}
    </>
  );
}

function ProcessDrawer({ p, can, spf, onClose, onSaved }: { p: P; can: boolean; spf: Record<string, string>; onClose: () => void; onSaved: () => void }) {
  const [rec, setRec] = useState(false);
  const dims: [string, string][] = [['financial', 'Financial'], ['regulatory', 'Regulatory'], ['reputation', 'Reputation'], ['clients', 'Clients']];
  return (
    <Drawer wide onClose={onClose} title={p.name} sub={`${p.department} · owner ${p.owner ?? p.owner_role}`}
      actions={can && !rec && <button className="btn sm primary" onClick={() => setRec(true)}><ClipboardCheck size={13} />Record test</button>}>
      {rec ? <RecordTest p={p} onCancel={() => setRec(false)} onDone={() => { setRec(false); onSaved(); }} /> : <>
        <div className="ops-sec">
          <div className="row wrap" style={{ marginBottom: 10 }}><span className={`tier-pill t${p.tier}`}>{p.tier}</span><span className="small">Tier {p.tier} process</span><Badge tone={PLAN[p.plan_status]?.tone}>{PLAN[p.plan_status]?.label} plan</Badge></div>
          <p className="small" style={{ color: 'var(--text-2)', marginBottom: 12 }}>{p.description}</p>
          <div className="preview" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div><b>{hrs(p.rto_hours)}</b><span>RTO</span></div><div><b>{hrs(p.rpo_hours)}</b><span>RPO</span></div>
            <div><b>{hrs(p.mtpd_hours)}</b><span>Max tolerable</span></div><div><b>{fmtMoneyShort(p.impact_per_day)}</b><span>Impact / day</span></div>
          </div>
        </div>
        <div className="ops-sec"><h4>Impact if disrupted (1 = minor · 4 = severe)</h4>
          {dims.map(([k, l]) => { const v = p.impacts?.[k] ?? 0; return (
            <div key={k} className="dim-row"><span className="muted">{l}</span><div className="pips">{[1, 2, 3, 4].map(i => <i key={i} className={i <= v ? `on${v}` : ''} />)}</div><b className="small">{v}</b></div>); })}
        </div>
        <div className="ops-sec"><h4>Depends on</h4>
          <div className="stack tight">
            {(p.upstream ?? []).map((u: any) => <div key={u.id} className="small">↑ Process · {u.name}</div>)}
            {(p.assets ?? []).map((a: any) => <div key={a.id} className="small row">Asset · {a.name} <span className="muted">(crit. {a.criticality})</span>{spf[a.id] && <Badge tone="critical">SPOF</Badge>}</div>)}
            {(p.vendors ?? []).map((v: any) => <Link key={v.id} to={`/vendors?v=${v.id}`} className="small row">Supplier · {v.name} <span className="muted">({v.tier}{v.exit_plan ? ', exit plan' : ', no exit plan'})</span>{spf[v.id] && <Badge tone="critical">SPOF</Badge>}</Link>)}
            {!(p.assets ?? []).length && !(p.vendors ?? []).length && <span className="small muted">No dependency recorded</span>}
          </div>
          {p.risk && <div className="small" style={{ marginTop: 10 }}>Linked risk: <Link to={`/risks?r=${p.risk.id}`}>{p.risk.code} · {p.risk.title}</Link> <span className="muted">(score {p.risk.score})</span></div>}
        </div>
        <div className="ops-sec"><h4>Test history</h4>
          {(p.tests ?? []).length === 0 ? <Notice kind="warn">Never tested. ISO 22301 and NIS2 Art. 21(2)(c) expect the plan to be exercised.</Notice> :
            p.tests.map((t: any) => (
              <div key={t.id} className="hist">
                <span className="muted">{fmtDate(t.tested_on)}</span>
                <div><div className="strong small">{t.test_type}</div><div className="small" style={{ color: 'var(--text-2)' }}>{stripCase(t.notes)}</div>
                  <div className="row wrap" style={{ marginTop: 4 }}>
                    {t.achieved_rto_hours != null && <span className={`flag ${t.achieved_rto_hours > p.rto_hours ? 'bad' : 'ok'}`}>RTO {hrs(t.achieved_rto_hours)} / {hrs(p.rto_hours)}</span>}
                    {t.achieved_rpo_hours != null && <span className={`flag ${t.achieved_rpo_hours > p.rpo_hours ? 'bad' : 'ok'}`}>RPO {hrs(t.achieved_rpo_hours)} / {hrs(p.rpo_hours)}</span>}
                    {isCase(t.notes) ? <CaseTag /> : <span className="xs muted">Recorded by {t.recorded_by ?? 'system'}</span>}
                  </div></div>
                <Badge tone={TEST[t.result]?.tone} dot>{TEST[t.result]?.label}</Badge>
              </div>
            ))}
        </div>
      </>}
    </Drawer>
  );
}

function RecordTest({ p, onCancel, onDone }: { p: P; onCancel: () => void; onDone: () => void }) {
  const { orgId } = useSession();
  const toast = useToast();
  const [f, setF] = useState<any>({ tested_on: new Date().toISOString().slice(0, 10), test_type: 'Tabletop exercise', achieved_rto_hours: '', achieved_rpo_hours: '', result: '', notes: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const rtoMiss = f.achieved_rto_hours !== '' && Number(f.achieved_rto_hours) > p.rto_hours;
  async function save() {
    setBusy(true); setErr(null);
    try { await rpc('grc_bcp_test_record', { p_org: orgId, p_process: p.id, p: f }); toast('ok', `Test recorded for ${p.name}`); onDone(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  return (
    <div className="ops-sec stack">
      <div className="grid g2">
        <Field label="Date"><input type="date" className="input" value={f.tested_on} onChange={set('tested_on')} /></Field>
        <Field label="Type of test"><select className="select" value={f.test_type} onChange={set('test_type')}>{['Tabletop exercise', 'Backup restore test', 'Zone failover exercise', 'Full disaster recovery test', 'Communication drill'].map(x => <option key={x}>{x}</option>)}</select></Field>
        <Field label={`Achieved recovery time, hours (objective ${p.rto_hours} h)`} help={rtoMiss ? 'Above the objective: record a partial or failed result and an improvement action.' : undefined}><input className="input" type="number" min="0" step="0.5" value={f.achieved_rto_hours} onChange={set('achieved_rto_hours')} placeholder="leave empty for a tabletop" /></Field>
        <Field label={`Achieved data loss, hours (objective ${p.rpo_hours} h)`}><input className="input" type="number" min="0" step="0.5" value={f.achieved_rpo_hours} onChange={set('achieved_rpo_hours')} /></Field>
      </div>
      <Field label="Result">
        <div className="seg tri">{(['pass', 'partial', 'fail'] as const).map(r => <button key={r} className={`${f.result === r ? 'on' : ''} ${r === 'pass' ? 'yes' : r === 'partial' ? 'partial' : 'no'}`} onClick={() => setF({ ...f, result: r })}>{TEST[r].label}</button>)}</div>
      </Field>
      <Field label="What happened and what changes"><textarea className="textarea" value={f.notes} onChange={set('notes')} placeholder="e.g. Restore completed in 3 h; runbook step 4 updated" /></Field>
      {err && <Notice kind="danger">{err}</Notice>}
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={onCancel}>Cancel</button><button className="btn primary" disabled={!f.result || busy} onClick={save}>{busy ? 'Saving' : 'Record result'}</button></div>
      <div className="xs muted">Saved to the process record and the audit ledger under your name.</div>
    </div>
  );
}
