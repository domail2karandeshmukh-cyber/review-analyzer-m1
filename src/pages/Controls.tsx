import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Play, Cpu, Hand, Workflow, ShieldCheck, Radio, AlertTriangle, CalendarClock, Activity, Lock } from 'lucide-react';
import { rpc } from '../lib/supabase';
import { useRpc, useSession } from '../lib/session';
import { EFF, TEST, ago, fmtDate, fmtDateTime } from '../lib/format';
import { Badge, Card, CaseTag, Drawer, Empty, Loading, Modal, PageHead, Stat, useToast } from '../components/ui';
import { EffSev } from './Compliance';
import '../styles/compliance.css';

const MONITOR: Record<string, string> = {
  sod: 'Checks every approval: no requester approved their own action, no executor approved what they executed.',
  dual_control: 'Checks that every authorised payment decision of €100,000 or more has two distinct approvers.',
  audit_chain: 'Recomputes the SHA-256 fingerprint of every ledger entry and its link to the previous one.',
  overdue_actions: 'Counts open treatment actions past their deadline.',
};
const monitorText = (m?: string | null) => !m ? null : m.startsWith('kri:') ? `Reads the latest ${m.slice(4)} key risk indicator value against its warning and critical thresholds.` : MONITOR[m] ?? m;
const SOURCE: Record<string, string> = { platform_monitor: 'Platform monitor', manual: 'Manual test', simulated_feed: 'Simulated feed' };
const EFF_FACTOR: Record<string, number> = { effective: 1, partial: 0.5, not_assessed: 0.25, ineffective: 0 };
const FW_ORDER = ['ISO 27001', 'NIS2', 'GDPR', 'DORA'];
const today = new Date(new Date().toDateString()).getTime();
const isOver = (d?: string | null) => !!d && new Date(d).getTime() < today;
const cap = (s?: string) => (s ? s[0].toUpperCase() + s.slice(1) : '—');

function Automation({ v }: { v: string }) {
  const Ic = v === 'automated' ? Cpu : v === 'semi' ? Workflow : Hand;
  return <span className={`cx-auto ${v}`}><Ic size={13} />{v === 'semi' ? 'Semi-auto' : cap(v)}</span>;
}
function ResultBadge({ t }: { t: any }) {
  const m = TEST[t.result] ?? TEST.warn;
  return <Badge tone={m.tone} dot>{m.label}</Badge>;
}

export default function Controls() {
  const { orgId } = useSession();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const list = useRpc<any[]>('grc_controls', { p_org: orgId }, { poll: 30000 });
  const comp = useRpc<any>('grc_compliance', { p_org: orgId }, { poll: 30000 });
  const canTest = !!comp.data?.can_test;
  const [q, setQ] = useState('');
  const [dom, setDom] = useState('');
  const [eff, setEff] = useState('');
  const [auto, setAuto] = useState('');
  const [fw, setFw] = useState('');
  const [res, setRes] = useState(sp.get('r') === 'issues' ? 'issues' : '');
  const [runOpen, setRunOpen] = useState(sp.get('run') === '1');
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<any[] | null>(null);
  const sel = sp.get('c');

  const data = list.data ?? [];
  const domains = useMemo(() => [...new Set(data.map(c => c.domain))].sort(), [data]);
  const rows = useMemo(() => data.filter(c =>
    (!q || `${c.code} ${c.title} ${c.description} ${c.owner ?? ''} ${c.owner_role ?? ''}`.toLowerCase().includes(q.toLowerCase())) &&
    (!dom || c.domain === dom) && (!eff || c.operating_eff === eff) && (!auto || c.automation === auto) &&
    (!fw || (c.requirements ?? []).some((r: any) => r.framework === fw)) &&
    (!res || (res === 'issues' ? ['fail', 'warn'].includes(c.last_test?.result) || isOver(c.next_test) : res === 'monitored' ? !!c.monitor : true))), [data, q, dom, eff, auto, fw, res]);

  const total = data.length;
  const effective = data.filter(c => c.operating_eff === 'effective').length;
  const monitored = data.filter(c => c.monitor).length;
  const issues = data.filter(c => ['fail', 'warn'].includes(c.last_test?.result)).length;
  const overdue = data.filter(c => isOver(c.next_test)).length;

  async function runMonitoring() {
    setRunning(true);
    try {
      const r = await rpc<any[]>('grc_monitor_run', { p_org: orgId });
      setRunResult(r);
      const n = (k: string) => r.filter(x => x.result === k).length;
      toast('ok', `Monitoring complete: ${r.length} tests · ${n('pass')} pass · ${n('warn')} warning · ${n('fail')} fail`);
      list.reload(); comp.reload();
    } catch (e: any) { toast('err', e.message); }
    setRunning(false);
  }
  useEffect(() => { if (sp.get('run') === '1') { setRunOpen(true); } }, [sp]);
  const closeRun = () => { setRunOpen(false); setRunResult(null); if (sp.get('run')) { sp.delete('run'); setSp(sp); } };
  const filtersOn = q || dom || eff || auto || fw || res;

  return (
    <>
      <PageHead title="Controls library"
        desc="Each control has an owner, a test schedule and a measured effect on the risks it reduces. Select a row to inspect it without leaving the list."
        actions={<>
          <Link className="btn" to="/compliance">Frameworks</Link>
          {canTest ? <button className="btn primary" onClick={() => setRunOpen(true)}><Play size={14} />Run monitoring</button>
            : comp.data && <span className="btn" style={{ cursor: 'default' }} title="Requires the control-testing permission"><Lock size={13} />Monitoring: view only</span>}
        </>} />

      <div className="stats">
        <Stat k="Controls" icon={<ShieldCheck size={13} />} v={total || '—'} d={`${data.filter(c => c.status === 'implemented').length} implemented · ${data.filter(c => c.status !== 'implemented').length} in progress or planned`} />
        <Stat k="Operating effectively" v={<>{total ? Math.round((effective / total) * 100) : 0}<small>%</small></>} d={`${effective} effective · ${data.filter(c => c.operating_eff === 'partial').length} partial`} bar={total ? (effective / total) * 100 : 0} />
        <Stat k="Continuously monitored" icon={<Radio size={13} />} v={monitored} d={comp.data?.last_monitor_run ? `Last run ${ago(comp.data.last_monitor_run)}` : 'Not run yet'} />
        <Stat k="Failing or warning" icon={<AlertTriangle size={13} />} v={issues} d={issues ? data.filter(c => ['fail', 'warn'].includes(c.last_test?.result)).map(c => c.code).join(' · ') : 'All latest results pass'} tone={issues ? 'down' : 'up'} />
        <Stat k="Tests overdue" icon={<CalendarClock size={13} />} v={overdue} d={overdue ? 'Scheduled test date has passed' : 'All tests on schedule'} tone={overdue ? 'down' : undefined} />
      </div>

      <div className="cx-honest">
        <span className="live"><i />Live monitoring</span>
        <span className="grow" style={{ minWidth: 260 }}>Tests read real records: approvals (segregation of duties, dual control), the ledger hash chain, overdue actions and KRI readings. No result is invented.</span>
        <CaseTag>Effectiveness ratings: case-study inputs</CaseTag>
      </div>

      <Card flush>
        <div className="cx-filters">
          <div className="cx-search"><Search size={14} /><input className="input" placeholder="Search code, title, owner" value={q} onChange={e => setQ(e.target.value)} /></div>
          <select className="select" value={fw} onChange={e => setFw(e.target.value)} aria-label="Framework"><option value="">All frameworks</option>{FW_ORDER.map(f => <option key={f}>{f}</option>)}</select>
          <select className="select" value={dom} onChange={e => setDom(e.target.value)} aria-label="Domain"><option value="">All domains</option>{domains.map(d => <option key={d}>{d}</option>)}</select>
          <select className="select" value={eff} onChange={e => setEff(e.target.value)} aria-label="Operating effectiveness"><option value="">Any effectiveness</option>{Object.entries(EFF).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
          <select className="select" value={auto} onChange={e => setAuto(e.target.value)} aria-label="Automation"><option value="">Any automation</option><option value="automated">Automated</option><option value="semi">Semi-automated</option><option value="manual">Manual</option></select>
          <div className="seg"><button className={res === '' ? 'on' : ''} onClick={() => setRes('')}>All</button><button className={res === 'monitored' ? 'on' : ''} onClick={() => setRes('monitored')}>Monitored</button><button className={res === 'issues' ? 'on' : ''} onClick={() => setRes('issues')}>Needs attention</button></div>
          {filtersOn && <button className="btn ghost sm" onClick={() => { setQ(''); setDom(''); setEff(''); setAuto(''); setFw(''); setRes(''); }}>Clear</button>}
          <span className="cx-count">{rows.length} of {total}</span>
        </div>
        {list.loading && !list.data ? <Loading rows={8} /> : rows.length === 0 ? <Empty title="No control matches these filters" /> : (
          <div className="table-wrap"><table className="t cx-t responsive">
            <thead><tr><th style={{ width: 60 }}>Code</th><th>Control</th><th>Owner</th><th>Automation</th><th>Design · Operating</th><th>Latest result</th><th>Next test</th></tr></thead>
            <tbody>{rows.map(c => (
              <tr key={c.id} className={`click ${sel === c.id ? 'on' : ''}`} onClick={() => setSp({ c: c.id })}>
                <td data-label="Code"><span className="cx-code">{c.code}</span></td>
                <td className="primary"><div className="cx-title">{c.title}</div><div className="cx-desc" title={c.description}>{c.domain} · {cap(c.control_type)} · {c.description}</div></td>
                <td data-label="Owner" className="small"><div style={{ whiteSpace: 'nowrap' }}>{c.owner ?? '—'}</div><div className="cell-sub cx-role" title={c.owner_role}>{c.owner_role}</div></td>
                <td data-label="Automation"><Automation v={c.automation} /></td>
                <td data-label="Effectiveness"><div className="cx-res"><span className="row" style={{ gap: 6 }}><span className="xs muted" style={{ width: 14 }}>D</span><EffSev v={c.design_eff} /></span><span className="row" style={{ gap: 6 }}><span className="xs muted" style={{ width: 14 }}>O</span><EffSev v={c.operating_eff} /></span></div></td>
                <td data-label="Latest result">{c.last_test ? <div className="cx-res"><ResultBadge t={c.last_test} /><span className="src">{SOURCE[c.last_test.source]} · {ago(c.last_test.run_at)}</span></div>
                  : <div className="cx-res"><span className="small muted">No test in platform</span>{c.last_tested && <span className="src">Last reviewed {fmtDate(c.last_tested)}</span>}</div>}</td>
                <td data-label="Next test">{c.monitor ? <span className="cx-due" style={{ color: 'var(--text-3)' }}>Continuous</span> : c.next_test ?
                  <span className={`cx-due ${isOver(c.next_test) ? 'over' : ''}`}>{fmtDate(c.next_test)}<span className="sub">{c.frequency}{isOver(c.next_test) ? ' · overdue' : ''}</span></span> : <span className="muted small">—</span>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>

      {sel && <ControlDrawer id={sel} onClose={() => { sp.delete('c'); setSp(sp); }} onChanged={() => { list.reload(); comp.reload(); }} />}

      {runOpen && (
        <Modal title="Run continuous monitoring" sub="Tests every monitored control against live platform data" onClose={closeRun}
          footer={runResult ? <button className="btn primary" onClick={closeRun}>Done</button> : canTest ? <>
            <button className="btn" onClick={closeRun}>Cancel</button>
            <button className="btn primary" disabled={running} onClick={runMonitoring}><Play size={14} />{running ? 'Running tests…' : `Run ${monitored} tests`}</button>
          </> : <button className="btn" onClick={closeRun}>Close</button>}>
          {runResult ? (
            <div className="stack">
              <div className="small muted">Results recorded against each control and sealed in the audit ledger.</div>
              <div className="cx-runlist">{runResult.map((r, i) => <div key={i}><span className="c">{r.code}</span><span><ResultBadge t={r} /></span><span className="small">{r.detail}</span></div>)}</div>
            </div>
          ) : (
            <div className="stack">
              <div className="cx-monitor"><Activity size={15} /><div>Each test reads real records: approvals for segregation of duties, payment approvals for dual control, the ledger hash chain, open actions past deadline, and the latest KRI readings. The run is recorded in the audit ledger under your name.</div></div>
              <div className="cx-runlist">{data.filter(c => c.monitor).map(c => <div key={c.id}><span className="c">{c.code}</span><span className="xs muted">{c.monitor.startsWith('kri:') ? 'KRI' : 'Rule'}</span><span className="small">{c.title}</span></div>)}</div>
              {!canTest && <div className="small muted"><Lock size={12} /> Your role can view results but not run tests (control-testing permission required).</div>}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

function ControlDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { orgId } = useSession();
  const toast = useToast();
  const { data: c, loading, reload } = useRpc<any>('grc_control', { p_org: orgId, p_id: id });
  const [result, setResult] = useState<'pass' | 'warn' | 'fail'>('pass');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const byFw = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const r of c?.requirements ?? []) (m[r.framework] ??= []).push(r);
    return FW_ORDER.filter(f => m[f]).map(f => [f, m[f]] as const);
  }, [c]);

  async function record() {
    setBusy(true);
    try {
      await rpc('grc_control_test_record', { p_org: orgId, p_control: id, p_result: result, p_detail: detail });
      toast('ok', `${c.code} test recorded: ${TEST[result].label}`); setDetail(''); reload(); onChanged();
    } catch (e: any) { toast('err', e.message); }
    setBusy(false);
  }
  const factor = EFF_FACTOR[c?.operating_eff ?? 'not_assessed'];

  return (
    <Drawer wide onClose={onClose} title={c ? <span className="row" style={{ gap: 8 }}><span className="cx-code">{c.code}</span>{c.title}</span> : 'Control'}
      sub={c ? `${c.domain} · ${cap(c.control_type)} · ${c.frequency}` : undefined}>
      {loading && !c ? <Loading rows={8} /> : c && (
        <>
          <div className="cx-sec">
            <div className="lead">{c.description}</div>
            <div className="row wrap" style={{ marginTop: 12, gap: 6 }}>
              <span className="xs muted">Design</span><EffSev v={c.design_eff} /><span className="xs muted" style={{ marginLeft: 10 }}>Operating</span><EffSev v={c.operating_eff} />
              <span style={{ marginLeft: 'auto' }}><CaseTag>Rating: case-study input</CaseTag></span>
            </div>
          </div>

          <div className="cx-sec">
            <dl className="cx-kv">
              <dt>Owner</dt><dd>{c.owner ?? '—'}<div className="xs muted">{c.owner_role}</div></dd>
              <dt>Automation</dt><dd><Automation v={c.automation} /></dd>
              <dt>Status</dt><dd>{c.status === 'implemented' ? 'Implemented' : c.status === 'in_progress' ? 'Implementation in progress' : 'Planned'}</dd>
              <dt>Test schedule</dt><dd>{c.monitor ? 'Continuous (platform monitor)' : <>{c.frequency}{c.next_test && <> · next {fmtDate(c.next_test)}{isOver(c.next_test) && <Badge tone="critical">Overdue</Badge>}</>}</>}</dd>
              {c.monitor && <><dt>Monitor logic</dt><dd className="small" style={{ color: 'var(--text-2)' }}>{monitorText(c.monitor)}</dd></>}
            </dl>
          </div>

          <div className="cx-sec">
            <h4>Satisfies {c.requirements.length} requirement{c.requirements.length === 1 ? '' : 's'} across {byFw.length} framework{byFw.length === 1 ? '' : 's'}</h4>
            {byFw.length === 0 ? <div className="small muted">Not mapped to a framework requirement.</div> : byFw.map(([f, reqs]) => (
              <div key={f} className="cx-fwrow"><span className="f">{f}</span><div className="stack tight">{reqs.map((r: any) => <div key={r.id} className="cx-reqline"><b>{r.ref}</b>{r.title}</div>)}</div></div>
            ))}
          </div>

          <div className="cx-sec">
            <h4><span>Risks reduced</span><span className="xs" style={{ fontWeight: 400 }}>Applied reduction = design reduction × {factor} ({EFF[c.operating_eff]?.label.toLowerCase()})</span></h4>
            {c.risks.length === 0 ? <div className="small muted">No risk linked.</div> : c.risks.map((r: any) => (
              <div key={r.id} className="cx-risk">
                <span className="rc">{r.code}</span>
                <Link to={`/risks?r=${r.id}`} className="rt" style={{ color: 'var(--text)' }}>{r.title}</Link>
                <div className="cx-rbar">
                  <div className="tr"><i className="design" style={{ width: `${r.reduction}%` }} /><i className="eff" style={{ width: `${Math.round(r.reduction * factor)}%` }} /></div>
                  <span><b>−{Math.round(r.reduction * factor)}%</b> of {r.reduction}% design</span>
                </div>
              </div>
            ))}
          </div>

          <div className="cx-sec">
            <h4><span>Test history</span><span className="xs" style={{ fontWeight: 400 }}>{c.tests.length} recorded</span></h4>
            {c.tests.length === 0 ? <div className="small muted">No test recorded in the platform yet.{c.last_tested && ` Last off-platform review on ${fmtDate(c.last_tested)} (case-study record).`}</div> : (
              <div className="cx-tl">{c.tests.slice(0, 12).map((t: any) => (
                <div key={t.id} className="cx-tlrow"><span className={`p ${t.result}`} />
                  <div><div className="row wrap" style={{ gap: 6 }}><ResultBadge t={t} /><span className="xs muted">{SOURCE[t.source]}{t.tester ? ` · ${t.tester}` : t.source === 'platform_monitor' ? ' · system' : ''}</span></div>
                    <div className="x">{t.detail}</div><div className="m">{fmtDateTime(t.run_at)}</div></div>
                </div>
              ))}</div>
            )}
          </div>

          <div className="cx-sec">
            <h4>Record a test result</h4>
            {c.can_test ? (
              <div className="cx-form">
                <div className="seg cx-resseg">{(['pass', 'warn', 'fail'] as const).map(k => <button key={k} className={`${result === k ? 'on' : ''} ${k}`} onClick={() => setResult(k)}>{TEST[k].label}</button>)}</div>
                <textarea className="textarea" placeholder="What was tested, the sample and the evidence reviewed (e.g. 'Q4 review of 14 ERP admin accounts: 2 stale accounts removed, ticket CHG-2231')" value={detail} onChange={e => setDetail(e.target.value)} />
                <div className="row between"><span className="xs muted">Recorded under your name and sealed in the audit ledger.</span><button className="btn primary" disabled={busy || !detail.trim()} onClick={record}>{busy ? 'Recording…' : 'Record result'}</button></div>
              </div>
            ) : <div className="locked"><Lock size={13} /><div>Your role can view this control but not record tests. Testing is done by the control-testing roles (RSSI, compliance, IT operations, risk coordination).</div></div>}
          </div>
        </>
      )}
    </Drawer>
  );
}
