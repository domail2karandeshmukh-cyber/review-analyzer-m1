import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CalendarX2, Download, FileWarning, ShieldOff } from 'lucide-react';
import { rpc } from '../lib/supabase';
import { useRpc, useSession } from '../lib/session';
import { fmtDate, fmtMoneyShort, due, TIER } from '../lib/format';
import { Badge, Card, Drawer, Empty, ErrorBox, Field, Loading, Notice, PageHead, Stat, Tabs, useToast } from '../components/ui';
import '../styles/ops.css';

type V = any;
const TIERS = ['critical', 'high', 'medium', 'low'] as const;
const ACCESS: Record<string, string> = { none: 'No data', internal: 'Internal', personal: 'Personal data', sensitive: 'Sensitive' };
const Q: { k: string; t: string; w: number }[] = [
  { k: 'cert', t: 'Current security certification (ISO 27001, SOC 2 or equivalent)', w: 15 },
  { k: 'mfa', t: 'MFA enforced for every account that reaches our data or systems', w: 15 },
  { k: 'encryption', t: 'Encryption at rest and in transit', w: 10 },
  { k: 'incident_notice', t: 'Contractual incident notice to us within 24 h', w: 10 },
  { k: 'subprocessors', t: 'Sub-processors disclosed and approved by us', w: 10 },
  { k: 'bcp_tested', t: 'Continuity plan tested in the last 12 months', w: 10 },
  { k: 'vuln_mgmt', t: 'Vulnerability management with a patch SLA', w: 10 },
  { k: 'eu_data', t: 'Our data stays in the EU / EEA', w: 5 },
  { k: 'audit_right', t: 'Audit right written into the contract', w: 10 },
  { k: 'exit_clause', t: 'Exit and transition assistance clause', w: 5 },
];

const scoreColor = (s: number) => (s >= 60 ? 'var(--crit)' : s >= 45 ? 'var(--high)' : s >= 30 ? 'var(--medium)' : 'var(--pass)');
const short = (n: string) => n.replace(/ (SAS|SARL|SA)$/, '').replace(/ \(.*\)$/, '');

function ScoreBar({ inh, res }: { inh: number; res: number }) {
  return (
    <div className="scorebar" title={`Inherent ${inh} → residual ${res}`}>
      <div className="sb-t"><div className="sb-i" style={{ width: `${inh}%` }} /><div className="sb-r" style={{ width: `${res}%`, background: scoreColor(res) }} /></div>
      <b>{res}</b>
    </div>
  );
}

function flagsOf(v: V) {
  const f: { t: string; c: 'bad' | 'warn' }[] = [];
  if (v.contract_expired) f.push({ t: 'Contract expired', c: 'bad' });
  if (v.review_overdue) f.push({ t: 'Review overdue', c: 'bad' });
  if ((v.tier === 'critical' || v.tier === 'high') && !v.exit_plan) f.push({ t: 'No exit plan', c: 'warn' });
  if (v.data_access === 'sensitive' && (v.certifications ?? []).length === 0) f.push({ t: 'No certification', c: 'warn' });
  if (v.ict_service && v.supports_critical_function && v.substitutability === 'difficult') f.push({ t: 'Hard to substitute', c: 'warn' });
  return f;
}

/** Exposure map: one lane per tier, each supplier drawn from inherent (hollow) to residual (filled) score. */
function ExposureMap({ vendors, onPick, selected }: { vendors: V[]; onPick: (id: string) => void; selected?: string | null }) {
  const W = 900, L = 96, R = 24, top = 26, laneH = 66;
  const H = top + laneH * TIERS.length + 30;
  const x = (s: number) => L + ((W - L - R) * s) / 100;
  const maxSpend = Math.max(...vendors.map(v => v.annual_spend ?? 0), 1);
  return (
    <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Supplier exposure by tier, inherent to residual risk score">
      {[0, 25, 50, 75, 100].map(t => (
        <g key={t}><line className="grid dash" x1={x(t)} x2={x(t)} y1={top - 6} y2={top + laneH * TIERS.length} /><text x={x(t)} y={H - 10} textAnchor="middle">{t}</text></g>
      ))}
      <text x={L - 8} y={H - 10} textAnchor="end" style={{ fontSize: 10.5 }}>Score</text>
      <rect x={x(60)} y={top - 6} width={x(100) - x(60)} height={laneH * TIERS.length + 6} fill="var(--crit-wash)" opacity=".55" />
      <text x={x(80)} y={top - 10} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--crit-2)' }}>above tolerance (60+)</text>
      {TIERS.map((t, i) => {
        const y0 = top + laneH * i;
        const lane = vendors.filter(v => v.tier === t).sort((a, b) => a.residual_score - b.residual_score);
        return (
          <g key={t}>
            <line className="grid" x1={L - 8} x2={W - R} y1={y0 + laneH} y2={y0 + laneH} />
            <text className="lane-l" x={8} y={y0 + laneH / 2 + 4}>{TIER[t].label}</text>
            <text x={8} y={y0 + laneH / 2 + 18} style={{ fontSize: 10.5 }}>{lane.length} supplier{lane.length === 1 ? '' : 's'}</text>
            {lane.map((v, j) => {
              const cy = y0 + 16 + (j % 3) * 17;
              const r = 4 + 6 * Math.sqrt((v.annual_spend ?? 0) / maxSpend);
              const bad = v.review_overdue || v.contract_expired;
              const col = scoreColor(v.residual_score);
              return (
                <g key={v.id} className="pt" onClick={() => onPick(v.id)} opacity={selected && selected !== v.id ? 0.45 : 1}>
                  <title>{`${v.name}: inherent ${v.inherent_score} → residual ${v.residual_score}`}</title>
                  <line x1={x(v.inherent_score)} x2={x(v.residual_score)} y1={cy} y2={cy} stroke="var(--border-2)" strokeWidth={1.5} />
                  <circle cx={x(v.inherent_score)} cy={cy} r={3} fill="var(--panel)" stroke="var(--text-4)" />
                  <circle className="dotr" cx={x(v.residual_score)} cy={cy} r={r} fill={col} fillOpacity={0.85} stroke={bad ? 'var(--crit-2)' : 'none'} strokeWidth={bad ? 2 : 0} strokeDasharray={bad ? '2 2' : undefined} />
                  <text className="vlab" x={x(v.residual_score) - r - 5} y={cy + 4} textAnchor="end">{short(v.name)}</text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

function toCsv(rows: V[]) {
  const head = ['Provider', 'ICT service', 'Function supported', 'Supports critical or important function', 'Substitutability', 'Exit plan', 'Data location', 'Data access', 'Sub-processors', 'Contract start', 'Contract end', 'Tier', 'Last assessed'];
  const esc = (s: any) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const lines = rows.map(v => [v.name, v.category, v.service, v.supports_critical_function ? 'Yes' : 'No', v.substitutability, v.exit_plan ? 'Yes' : 'No', v.country, ACCESS[v.data_access] ?? v.data_access,
    (v.subprocessors ?? []).join('; '), v.contract_start, v.contract_end, v.tier, v.last_assessed ?? ''].map(esc).join(','));
  return [head.map(esc).join(','), ...lines].join('\r\n');
}

export default function Vendors() {
  const { orgId } = useSession();
  const { data, error, loading, reload } = useRpc<{ vendors: V[]; can_manage: boolean }>('grc_vendors', { p_org: orgId });
  const [sp, setSp] = useSearchParams();
  const [tab, setTab] = useState('portfolio');
  const [tier, setTier] = useState('');
  const [q, setQ] = useState('');
  const sel = sp.get('v');
  const open = (id: string | null) => { const n = new URLSearchParams(sp); if (id) n.set('v', id); else n.delete('v'); setSp(n, { replace: true }); };
  const vs: V[] = data?.vendors ?? [];
  const rows = useMemo(() => vs.filter(v => (!tier || v.tier === tier) && (!q || `${v.name} ${v.service} ${v.category} ${v.country}`.toLowerCase().includes(q.toLowerCase()))), [vs, tier, q]);
  const ict = vs.filter(v => v.ict_service);
  const k = {
    critical: vs.filter(v => v.tier === 'critical').length,
    overdue: vs.filter(v => v.review_overdue).length,
    expired: vs.filter(v => v.contract_expired).length,
    noexit: vs.filter(v => (v.tier === 'critical' || v.tier === 'high') && !v.exit_plan).length,
    cif: ict.filter(v => v.supports_critical_function).length,
    spend: vs.reduce((s, v) => s + (v.annual_spend ?? 0), 0),
  };
  const attention = vs.flatMap(v => flagsOf(v).map(f => ({ v, ...f }))).sort((a, b) => (a.c === 'bad' ? 0 : 1) - (b.c === 'bad' ? 0 : 1));

  function exportCsv() {
    const blob = new Blob(['﻿' + toCsv(ict)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `register-of-information-${orgId}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  return (
    <>
      <PageHead title="Third parties" desc="Every supplier tiered by criticality and data access, assessed against a weighted security questionnaire, and linked to the processes and risks it can disrupt."
        actions={<button className="btn" onClick={exportCsv} disabled={!data}><Download size={14} />Export DORA register</button>} />
      <ErrorBox error={error} />
      {loading && !data ? <Card><Loading rows={6} /></Card> : vs.length === 0 ? <Card><Empty title="No suppliers recorded">Suppliers appear here once Procurement registers them.</Empty></Card> : (
        <div className="stack loose">
          <div className="stats">
            <Stat k="Critical suppliers" v={k.critical} d={`of ${vs.length} suppliers · ${fmtMoneyShort(k.spend)} annual spend`} />
            <Stat k="Reviews overdue" v={k.overdue} d={k.overdue ? 'Reassessment past due date' : 'All reviews in date'} tone={k.overdue ? 'down' : 'up'} />
            <Stat k="Contracts expired" v={k.expired} d={k.expired ? 'Running without a valid contract' : 'All contracts valid'} tone={k.expired ? 'down' : 'up'} />
            <Stat k="Critical / high without exit plan" v={k.noexit} d="DORA Art. 28 exit strategies" tone={k.noexit ? 'down' : 'up'} />
            <Stat k="ICT suppliers on critical functions" v={k.cif} d={`of ${ict.length} ICT arrangements`} />
          </div>

          <Tabs value={tab} onChange={setTab} tabs={[{ key: 'portfolio', label: 'Portfolio' }, { key: 'register', label: <>DORA register of information <span className="muted">{ict.length}</span></> }]} />

          {tab === 'portfolio' ? (
            <>
              <div className="ops-split">
                <Card title="Exposure by tier" sub="Each line runs from inherent risk (hollow) to residual risk after controls (filled). Dot size = annual spend.">
                  <ExposureMap vendors={vs} onPick={open} selected={sel} />
                  <div className="legend-row" style={{ margin: '8px -16px -16px' }}>
                    <span><i style={{ background: 'var(--pass)' }} />Residual &lt; 30</span><span><i style={{ background: 'var(--medium)' }} />30–44</span>
                    <span><i style={{ background: 'var(--high)' }} />45–59</span><span><i style={{ background: 'var(--crit)' }} />60+</span>
                    <span><i style={{ background: 'transparent', border: '2px dashed var(--crit-2)' }} />Review or contract lapsed</span>
                  </div>
                </Card>
                <Card title="Needs attention" sub={`${attention.length} open issue${attention.length === 1 ? '' : 's'} across ${new Set(attention.map(a => a.v.id)).size} suppliers`} flush>
                  {attention.length === 0 ? <Empty title="Nothing outstanding" /> : (
                    <div className="att-list" style={{ maxHeight: 360, overflowY: 'auto' }}>
                      {attention.map((a, i) => (
                        <div key={i} className="att-row" onClick={() => open(a.v.id)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && open(a.v.id)}>
                          <span className={`att-ic ${a.c}`}>{a.t.startsWith('Contract') ? <CalendarX2 size={14} /> : a.t.startsWith('Review') ? <FileWarning size={14} /> : a.t.startsWith('No exit') ? <ShieldOff size={14} /> : <AlertTriangle size={14} />}</span>
                          <div className="grow"><div className="small strong">{a.t}</div><div className="xs muted">{a.v.name} · {TIER[a.v.tier].label} tier</div></div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              <Card flush>
                <div className="toolbar">
                  <div className="seg">{['', ...TIERS].map(t => <button key={t} className={tier === t ? 'on' : ''} onClick={() => setTier(t)}>{t ? TIER[t].label : 'All tiers'}<span className="muted"> {t ? vs.filter(v => v.tier === t).length : vs.length}</span></button>)}</div>
                  <input className="input" placeholder="Filter suppliers" value={q} onChange={e => setQ(e.target.value)} style={{ marginLeft: 'auto', width: 220 }} />
                </div>
                <div className="table-wrap"><table className="t responsive">
                  <thead><tr><th>Supplier</th><th>Tier</th><th>Data access</th><th>Residual risk</th><th>Next review</th><th>Contract end</th><th>Certifications</th><th>DORA</th></tr></thead>
                  <tbody>{rows.map(v => (
                    <tr key={v.id} className={`click ${sel === v.id ? 'on' : ''}`} onClick={() => open(v.id)}>
                      <td className="primary"><div className="cell-title">{v.name}</div><div className="cell-sub">{v.service}</div></td>
                      <td data-label="Tier"><Badge tone={TIER[v.tier].tone}>{TIER[v.tier].label}</Badge></td>
                      <td data-label="Data access" className="small">{ACCESS[v.data_access] ?? v.data_access}</td>
                      <td data-label="Residual risk"><ScoreBar inh={v.inherent_score} res={v.residual_score} /></td>
                      <td data-label="Next review" className="small nowrap">{v.next_review ? <>{fmtDate(v.next_review)}<div className={`flag ${v.review_overdue ? 'bad' : 'mute'}`}>{due(v.next_review)}</div></> : <span className="muted">Not scheduled</span>}</td>
                      <td data-label="Contract end" className="small nowrap">{fmtDate(v.contract_end)}{v.contract_expired && <div className="flag bad">Expired</div>}</td>
                      <td data-label="Certifications"><div className="chips">{(v.certifications ?? []).length ? v.certifications.map((c: string) => <span key={c} className="chip">{c}</span>) : <span className="xs muted">None</span>}</div></td>
                      <td data-label="DORA"><div className="chips">{v.ict_service ? <span className="chip">ICT</span> : <span className="xs muted">—</span>}{v.supports_critical_function && <Badge tone="danger" title="Supports a critical or important function (DORA)">CIF</Badge>}</div></td>
                    </tr>))}</tbody>
                </table></div>
                {rows.length === 0 && <Empty title="No supplier matches the filter" />}
              </Card>
            </>
          ) : (
            <Card title="Register of information — ICT third-party arrangements" sub="Structure follows DORA Art. 28(3) and Implementing Regulation (EU) 2024/2956; export for the client's register."
              actions={<button className="btn sm" onClick={exportCsv}><Download size={13} />CSV</button>} flush>
              <div style={{ padding: '12px 16px 0' }}><Notice>NOVATECH is not a financial entity: DORA applies indirectly, because NOVATECH is itself an ICT provider to banks and insurers who must list it in their own register and flow DORA clauses (Art. 30) down to it.</Notice></div>
              <div className="table-wrap" style={{ marginTop: 12 }}><table className="t responsive">
                <thead><tr><th>Provider</th><th>Function supported</th><th>Critical / important</th><th>Substitutability</th><th>Exit plan</th><th>Data location</th><th>Sub-processors</th><th>Contract</th></tr></thead>
                <tbody>{ict.map(v => (
                  <tr key={v.id} className="click" onClick={() => open(v.id)}>
                    <td className="primary"><div className="cell-title">{v.name}</div><div className="cell-sub">{v.category}</div></td>
                    <td data-label="Function" className="small">{v.service}</td>
                    <td data-label="Critical">{v.supports_critical_function ? <Badge tone="danger">Yes</Badge> : <span className="xs muted">No</span>}</td>
                    <td data-label="Substitutability" className="small" style={{ textTransform: 'capitalize' }}>{v.substitutability}</td>
                    <td data-label="Exit plan">{v.exit_plan ? <span className="flag ok">Documented</span> : <span className={`flag ${v.supports_critical_function || v.tier === 'critical' ? 'bad' : 'warn'}`}>Missing</span>}</td>
                    <td data-label="Location" className="small">{v.country}</td>
                    <td data-label="Sub-processors"><div className="chips">{(v.subprocessors ?? []).length ? v.subprocessors.map((s: string) => <span key={s} className="chip">{s}</span>) : <span className="xs muted">None declared</span>}</div></td>
                    <td data-label="Contract" className="small nowrap">{fmtDate(v.contract_start)} → {fmtDate(v.contract_end)}{v.contract_expired && <div className="flag bad">Expired</div>}</td>
                  </tr>))}</tbody>
              </table></div>
            </Card>
          )}
        </div>
      )}
      {sel && <VendorDrawer id={sel} onClose={() => open(null)} onSaved={reload} />}
    </>
  );
}

function VendorDrawer({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: () => void }) {
  const { orgId } = useSession();
  const { data: v, error, loading, reload } = useRpc<V>('grc_vendor', { p_org: orgId, p_id: id });
  const [assess, setAssess] = useState(false);
  return (
    <Drawer wide onClose={onClose} title={v?.name ?? 'Supplier'} sub={v ? `${v.category} · ${v.country}` : undefined}
      actions={v?.can_manage && !assess && <button className="btn sm primary" onClick={() => setAssess(true)}>Assess</button>}>
      {error && <div style={{ padding: 16 }}><ErrorBox error={error} /></div>}
      {loading && !v ? <Loading rows={8} /> : v && (assess
        ? <AssessForm v={v} onCancel={() => setAssess(false)} onDone={() => { setAssess(false); reload(); onSaved(); }} />
        : <>
          <div className="ops-sec">
            <div className="row wrap" style={{ marginBottom: 10 }}>
              <Badge tone={TIER[v.tier].tone}>{TIER[v.tier].label} tier</Badge>
              {v.ict_service && <Badge tone="neutral">ICT service</Badge>}
              {v.supports_critical_function && <Badge tone="danger">Supports a critical function</Badge>}
              {flagsOf(v).map(f => <Badge key={f.t} tone={f.c === 'bad' ? 'critical' : 'warning'}>{f.t}</Badge>)}
            </div>
            <div className="preview">
              <div><b>{v.inherent_score}</b><span>Inherent risk</span></div>
              <div><b style={{ color: scoreColor(v.residual_score) }}>{v.residual_score}</b><span>Residual risk</span></div>
              <div><b>{fmtMoneyShort(v.annual_spend)}</b><span>Annual spend</span></div>
            </div>
            {v.notes && <p className="small" style={{ color: 'var(--text-2)' }}>{v.notes}</p>}
          </div>
          <div className="ops-sec"><h4>Profile</h4>
            <dl className="ops-kv">
              <dt>Service</dt><dd>{v.service}</dd>
              <dt>Owner</dt><dd>{v.owner ?? '—'} <span className="muted small">· {v.owner_role}</span></dd>
              <dt>Data access</dt><dd>{ACCESS[v.data_access] ?? v.data_access}</dd>
              <dt>Contract</dt><dd>{fmtDate(v.contract_start)} → {fmtDate(v.contract_end)} {v.contract_expired && <span className="flag bad">· expired</span>}</dd>
              <dt>Last assessed</dt><dd>{fmtDate(v.last_assessed)} · next {v.next_review ? <span className={v.review_overdue ? 'flag bad' : ''}>{fmtDate(v.next_review)} ({due(v.next_review)})</span> : 'not scheduled'}</dd>
              <dt>Substitutability</dt><dd><span style={{ textTransform: 'capitalize' }}>{v.substitutability}</span> · exit plan {v.exit_plan ? 'documented' : <span className="flag bad">missing</span>}</dd>
            </dl>
          </div>
          <div className="ops-sec"><h4>Linked risk and dependent processes</h4>
            <div className="stack tight">
              {v.risk ? <Link to={`/risks?r=${v.risk.id}`} className="small">{v.risk.code} · {v.risk.title} <span className="muted">(score {v.risk.score})</span></Link> : <span className="small muted">No register risk linked</span>}
              {(v.processes ?? []).length ? v.processes.map((p: any) => <Link key={p.id} to="/continuity" className="small"><span className={`tier-pill t${p.tier}`}>{p.tier}</span> {p.name}</Link>) : <span className="small muted">No business process depends on this supplier</span>}
            </div>
          </div>
          <div className="ops-sec"><h4>Certifications and sub-processors</h4>
            <div className="chips" style={{ marginBottom: 8 }}>{(v.certifications ?? []).length ? v.certifications.map((c: string) => <span key={c} className="chip">{c}</span>) : <span className="small muted">No certification on file</span>}</div>
            <div className="chips">{(v.subprocessors ?? []).length ? v.subprocessors.map((c: string) => <span key={c} className="chip">↳ {c}</span>) : <span className="small muted">No sub-processor declared</span>}</div>
          </div>
          <div className="ops-sec"><h4>Assessment history</h4>
            {(v.assessments ?? []).length === 0 ? <div className="small muted">No questionnaire recorded in the platform yet. Ratings above are the case-study baseline.{v.can_manage ? ' Use Assess to record one.' : ''}</div> :
              v.assessments.map((a: any) => (
                <div key={a.id} className="hist">
                  <span className="muted">{fmtDate(a.assessed_on)}</span>
                  <div><div>{a.findings || <span className="muted">No findings noted</span>}</div><div className="xs muted">{a.assessor ?? 'System'}</div></div>
                  <Badge tone={a.score >= 75 ? 'success' : a.score >= 50 ? 'warning' : 'critical'}>{a.score}/100</Badge>
                </div>
              ))}
          </div>
        </>)}
    </Drawer>
  );
}

function AssessForm({ v, onCancel, onDone }: { v: V; onCancel: () => void; onDone: () => void }) {
  const { orgId } = useSession();
  const toast = useToast();
  const [ans, setAns] = useState<Record<string, string>>({});
  const [findings, setFindings] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const score = Q.reduce((s, x) => s + x.w * (ans[x.k] === 'yes' ? 1 : ans[x.k] === 'partial' ? 0.5 : 0), 0);
  const resid = Math.round((v.inherent_score ?? 50) * (1 - (score / 100) * 0.6));
  const complete = Q.every(x => ans[x.k]);
  async function save() {
    setBusy(true); setErr(null);
    try {
      const r = await rpc<any>('grc_vendor_assess', { p_org: orgId, p_vendor: v.id, p_answers: ans, p_findings: findings });
      toast('ok', `${v.name} assessed: ${r.score}/100, residual risk ${r.residual}`); onDone();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  return (
    <div className="ops-sec">
      <div className="preview">
        <div><b>{Math.round(score)}<span style={{ fontSize: 12 }}>/100</span></b><span>Control score</span></div>
        <div><b>{v.inherent_score}</b><span>Inherent risk</span></div>
        <div><b style={{ color: scoreColor(resid) }}>{complete ? resid : '…'}</b><span>Residual if saved (now {v.residual_score})</span></div>
      </div>
      <div className="small muted" style={{ marginBottom: 6 }}>{Q.filter(x => ans[x.k]).length} of {Q.length} answered · residual = inherent × (1 − score × 0.6)</div>
      {Q.map(x => (
        <div key={x.k} className="qrow">
          <div><div className="qt">{x.t}</div><div className="qw">weight {x.w}</div></div>
          <div className="seg tri">{(['yes', 'partial', 'no'] as const).map(o => <button key={o} className={`${ans[x.k] === o ? 'on' : ''} ${o}`} onClick={() => setAns({ ...ans, [x.k]: o })}>{o === 'yes' ? 'Yes' : o === 'partial' ? 'Partly' : 'No'}</button>)}</div>
        </div>
      ))}
      <div style={{ marginTop: 12 }}><Field label="Findings and evidence"><textarea className="textarea" value={findings} onChange={e => setFindings(e.target.value)} placeholder="e.g. MFA missing for 2 of 6 developer accounts; SOC 2 report received" /></Field></div>
      {err && <div style={{ marginTop: 10 }}><Notice kind="danger">{err}</Notice></div>}
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn primary" disabled={!complete || busy} onClick={save}>{busy ? 'Saving' : 'Record assessment'}</button>
      </div>
      <div className="xs muted" style={{ marginTop: 8 }}>Saved to the supplier record and the hash-chained audit ledger under your name.</div>
    </div>
  );
}
