import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Clock, FileText, Presentation, ShieldCheck, Siren, TriangleAlert, Gavel, Activity, Compass } from 'lucide-react';
import { useRpc, useSession } from '../lib/session';
import { ago, fmtMoney, fmtDateTime } from '../lib/format';
import { Badge, Card, ErrorBox, Loading, Meter, Sev, Stat, CaseTag } from '../components/ui';
import { HeatMap } from '../components/Heat';
import { TASK, TASK_ICON, TASK_TONE } from './Overview';
import { useTour } from '../components/Tour';

type Q = { key: string; icon: React.ReactNode; tone: string; title: string; sub: string; tag: React.ReactNode; to: string; urgency: number };

function hoursLeft(d: string) { return (new Date(d).getTime() - Date.now()) / 3600000; }
function clock(d: string) {
  const h = hoursLeft(d);
  if (h < 0) return { t: `${Math.ceil(-h)} h overdue`, tone: 'critical' as const };
  if (h < 24) return { t: `${Math.floor(h)} h ${Math.floor((h % 1) * 60)} min left`, tone: 'critical' as const };
  return { t: `${Math.floor(h / 24)} d ${Math.floor(h % 24)} h left`, tone: 'warning' as const };
}
const covOf = (f: any) => (f.total ? (f.met + f.partial * 0.5) / f.total : 0);

export default function Home() {
  const { orgId, current } = useSession();
  const h = useRpc<any>('grc_home', { p_org: orgId }, { poll: 20000 });
  const work = useRpc<any>('grc_my_work', { p_org: orgId }, { poll: 15000 });
  const nav = useNavigate();
  const tour = useTour();
  if (h.error) return <ErrorBox error={h.error} />;
  if (!h.data) return <div className="stack"><div className="skeleton" style={{ height: 70 }} /><div className="skeleton" style={{ height: 90 }} /><Card><Loading rows={8} /></Card></div>;
  const d = h.data;
  const hour = new Date().getHours();

  // Unified priority queue: decisions, incidents, regulatory clocks, policy acknowledgements, failing controls
  const queue: Q[] = [];
  for (const n of d.reg_due ?? []) {
    const c = clock(n.due_at);
    queue.push({ key: `r${n.id}`, icon: <Clock size={15} />, tone: 'critical', title: `${n.regime} ${n.stage.replace(/^\d · /, '')}`, sub: `${n.ref} · regulatory deadline`, tag: <Badge tone={c.tone}>{c.t}</Badge>, to: `/incidents/${n.incident_id}`, urgency: 0 + hoursLeft(n.due_at) / 1000 });
  }
  for (const i of work.data?.incidents ?? []) queue.push({ key: `i${i.id}`, icon: <Siren size={15} />, tone: 'critical', title: i.title, sub: `${i.ref} · ${TASK[i.task] ?? 'Incident'}`, tag: <Badge tone="critical">Incident</Badge>, to: `/incidents/${i.id}`, urgency: 1 });
  for (const t of work.data?.tasks ?? []) queue.push({ key: `a${t.id}`, icon: TASK_ICON[t.task] ?? <ArrowRight size={15} />, tone: TASK_TONE[t.task] ?? '', title: t.title, sub: `${t.ref} · ${TASK[t.task] ?? t.task}${t.amount ? ` · ${fmtMoney(t.amount)}` : ''}`, tag: <Badge tone={t.task === 'approve' ? 'accent' : 'neutral'}>{TASK[t.task] ?? t.task}</Badge>, to: `/actions/${t.id}`, urgency: t.task === 'approve' || t.task === 'post_review' ? 2 : 3 });
  for (const p of d.policies?.to_attest ?? []) queue.push({ key: `p${p.id}`, icon: <FileText size={15} />, tone: '', title: `Acknowledge ${p.code} ${p.title}`, sub: 'Policy attestation campaign', tag: <Badge tone="neutral">Policy</Badge>, to: `/policies?p=${p.id}`, urgency: 5 });
  for (const c of d.failing ?? []) if (c.last_test?.result === 'fail') queue.push({ key: `c${c.id}`, icon: <TriangleAlert size={15} />, tone: 'critical', title: `${c.code} ${c.title}`, sub: c.last_test.detail, tag: <Badge tone="critical">Control failing</Badge>, to: `/controls?c=${c.id}`, urgency: 4 });
  queue.sort((a, b) => a.urgency - b.urgency);

  const breaches = (d.appetite ?? []).flatMap((a: any) => a.risks.filter((r: any) => r.breach).map((r: any) => ({ ...r, cat: a.category })));
  const fw = d.frameworks ?? [];
  const avgCov = fw.length ? fw.reduce((s: number, f: any) => s + covOf(f), 0) / fw.length : 0;
  const effPct = d.controls?.total ? d.controls.effective / d.controls.total : 0;
  const riskItems = (d.risks ?? []).filter((r: any) => r.likelihood && r.impact).map((r: any) => ({ id: r.id, code: r.code, l: r.likelihood, i: r.impact, title: r.title }));
  const kriBad = (d.kri ?? []).filter((k: any) => k.level !== 'normal').length;

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="row between wrap" style={{ alignItems: 'flex-end' }}>
        <div>
          <div className="xs muted">{new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}</div>
          <h1 style={{ fontSize: 24, fontWeight: 650, letterSpacing: '-0.025em', marginTop: 2 }}>{hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}, {current?.full_name.split(' ')[0]}</h1>
          <div className="small muted" style={{ marginTop: 2 }}>
            {queue.length === 0 ? 'Nothing needs you right now.' : `${queue.length} ${queue.length === 1 ? 'item needs' : 'items need'} your attention`} · {breaches.length} {breaches.length === 1 ? 'risk' : 'risks'} outside appetite · {kriBad} risk {kriBad === 1 ? 'indicator' : 'indicators'} off normal
          </div>
        </div>
        <div className="row">
          {!tour.active && <button className="btn" onClick={tour.start}><Compass size={14} />Guided tour</button>}
          <Link to="/live" className="btn"><Activity size={14} />Live operations</Link>
          <Link to="/board" className="btn primary"><Presentation size={14} />Board pack</Link>
        </div>
      </div>

      <div className="stats">
        <Stat k="Outside appetite" v={<>{breaches.length}<small>/ {(d.risks ?? []).length}</small></>} d={breaches.length ? breaches.map((b: any) => b.code).join(', ') : 'All risks within appetite'} to="/risks" tone={breaches.length ? 'down' : 'up'} />
        <Stat k="Compliance coverage" v={`${Math.round(avgCov * 100)}%`} d={`${fw.length} frameworks · ISO 27001, NIS2, GDPR, DORA`} bar={avgCov * 100} to="/compliance" />
        <Stat k="Controls effective" v={`${Math.round(effPct * 100)}%`} d={`${d.controls?.effective ?? 0} of ${d.controls?.total ?? 0} · ${d.controls?.monitored ?? 0} monitored live`} bar={effPct * 100} to="/controls" />
        <Stat k="Open incidents" v={d.incidents?.open ?? 0} d={d.incidents?.exposure > 0 ? `${fmtMoney(d.incidents.exposure)} at stake` : 'No financial exposure open'} to="/incidents" tone={d.incidents?.open ? 'down' : undefined} />
        <Stat k="Treatment actions" v={d.actions?.open ?? 0} d={`${d.actions?.overdue ?? 0} overdue · ${d.actions?.awaiting_approval ?? 0} awaiting approval`} to="/actions" />
        <Stat k="Audit ledger" v={d.chain?.entries ?? 0} d={d.chain?.last_at ? `Last entry ${ago(d.chain.last_at)}` : 'Hash-chained'} to="/audit?verify=1" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.45fr) minmax(0, 1fr)' }}>
        <Card title="Your priorities" sub="Decisions, regulatory clocks, acknowledgements and failing controls, ranked by urgency" flush
          actions={<Link to="/workspace" className="btn sm ghost">All work <ArrowRight size={13} /></Link>}>
          {queue.length === 0 ? (
            <div className="empty"><ShieldCheck size={26} color="var(--pass)" /><div className="strong" style={{ color: 'var(--text-2)' }}>You're clear</div><div className="small">New decisions routed to your role appear here instantly.</div></div>
          ) : queue.slice(0, 8).map(q => (
            <div key={q.key} className="queue-row" onClick={() => nav(q.to)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && nav(q.to)}>
              <div className={`q-ic ${q.tone}`}>{q.icon}</div>
              <div style={{ minWidth: 0 }}><div className="cell-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.title}</div><div className="cell-sub" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.sub}</div></div>
              {q.tag}
            </div>
          ))}
        </Card>

        <Card title="Risk appetite" sub="Current score against the board's tolerance per category" actions={<CaseTag>Board statements</CaseTag>}>
          <div className="stack" style={{ gap: 12 }}>
            {(d.appetite ?? []).map((a: any) => {
              const worst = a.risks.reduce((m: number, r: any) => Math.max(m, r.score ?? 0), 0);
              const over = worst > a.max_score;
              return (
                <div key={a.id}>
                  <div className="row between small"><span className="strong" style={{ fontWeight: 550 }}>{a.category}</span><span className="xs muted">tolerance ≤ {a.max_score} · {a.tolerance}</span></div>
                  <div style={{ position: 'relative', height: 8, borderRadius: 9, background: 'var(--hover)', marginTop: 6 }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, (worst / 16) * 100)}%`, borderRadius: 9, background: over ? 'var(--crit)' : 'var(--pass)' }} />
                    <div title="Tolerance" style={{ position: 'absolute', top: -3, bottom: -3, width: 2, left: `${(a.max_score / 16) * 100}%`, background: 'var(--text-2)', borderRadius: 2 }} />
                  </div>
                  <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                    {a.risks.map((r: any) => <Link key={r.id} to={`/risks?r=${r.id}`} className="xs" style={{ color: r.breach ? 'var(--crit-2)' : 'var(--text-3)' }}>{r.code} · {r.score}</Link>)}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid g3">
        <Card title="Compliance frameworks" sub="Coverage from mapped, effective controls" actions={<Link to="/compliance" className="btn sm ghost">Open <ArrowUpRight size={13} /></Link>}>
          <div className="stack" style={{ gap: 14 }}>
            {fw.map((f: any) => (
              <Link key={f.id} to={`/compliance?f=${f.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                <div className="row between small"><span className="strong" style={{ fontWeight: 550 }}>{f.code}</span><span className="muted xs">{f.met} met · {f.partial} partial · {f.gap} gap</span></div>
                <div style={{ marginTop: 6 }}><Meter parts={[{ value: f.met, color: 'var(--pass)', title: 'Met' }, { value: f.partial, color: 'var(--medium)', title: 'Partial' }, { value: f.gap, color: 'var(--crit)', title: 'Gap' }]} label={`${Math.round(covOf(f) * 100)}%`} /></div>
              </Link>
            ))}
          </div>
        </Card>

        <Card title="Key risk indicators" sub="Latest readings against thresholds" actions={<Link to="/risks?tab=monitoring" className="btn sm ghost">Monitoring <ArrowUpRight size={13} /></Link>} flush>
          {(d.kri ?? []).map((k: any) => {
            const lvl = k.level === 'critical' ? 'critical' : k.level === 'warning' ? 'medium' : 'pass';
            return (
              <div key={k.risk_id} className="list-row" style={{ padding: '9px 16px' }}>
                <span className="mono xs muted" style={{ width: 22 }}>{k.code}</span>
                <div className="grow"><div className="small" style={{ fontWeight: 550 }}>{k.kri}</div><div className="xs muted">warn {k.warning} · crit {k.critical} {k.unit}</div></div>
                <div className="right"><div className="strong" style={{ fontVariantNumeric: 'tabular-nums' }}>{k.value} <span className="xs muted" style={{ fontWeight: 400 }}>{k.unit}</span></div><Sev level={lvl}><span className="xs">{k.level === 'normal' ? 'Normal' : k.level === 'warning' ? 'Warning' : 'Critical'}</span></Sev></div>
              </div>
            );
          })}
        </Card>

        <Card title="Risk landscape" sub="Likelihood × impact, NOVATECH register" actions={<Link to="/risks" className="btn sm ghost">Register <ArrowUpRight size={13} /></Link>}>
          <HeatMap items={riskItems} />
        </Card>
      </div>

      <div className="grid g4">
        <Health icon={<ShieldCheck size={15} />} title="Control monitoring" to="/controls"
          value={d.last_monitor_run ? ago(d.last_monitor_run) : 'Never run'} detail={`${(d.failing ?? []).filter((x: any) => x.last_test?.result === 'fail').length} failing · ${(d.failing ?? []).filter((x: any) => x.last_test?.result === 'warn').length} warnings`} />
        <Health icon={<Gavel size={15} />} title="EBIOS RM study" to="/ebios"
          value={d.ebios ? `${d.ebios.measures_done}/${d.ebios.measures} measures done` : 'Not started'} detail={d.ebios ? `${d.ebios.pending_acceptance} residual risks awaiting acceptance` : ''} />
        <Health icon={<TriangleAlert size={15} />} title="Third parties" to="/vendors"
          value={`${d.vendors?.review_overdue ?? 0} reviews overdue`} detail={`${d.vendors?.critical ?? 0} critical · ${d.vendors?.no_exit_plan_critical ?? 0} critical without exit plan`} bad={(d.vendors?.review_overdue ?? 0) > 0} />
        <Health icon={<Clock size={15} />} title="Continuity" to="/continuity"
          value={`${d.continuity?.rto_missed ?? 0} RTO missed in last test`} detail={`${d.continuity?.tier1 ?? 0} tier-1 processes · ${d.continuity?.untested ?? 0} never tested`} bad={(d.continuity?.rto_missed ?? 0) > 0} />
      </div>
      <div className="xs muted">Register scores, appetite statements, control ratings and supplier data are the NOVATECH case-study inputs. Monitoring results, decisions, attestations and the ledger are live records. Updated {fmtDateTime(new Date().toISOString())}.</div>
    </div>
  );
}

function Health({ icon, title, value, detail, to, bad }: { icon: React.ReactNode; title: string; value: string; detail: string; to: string; bad?: boolean }) {
  return (
    <Link to={to} className="card" style={{ padding: 14, color: 'inherit', textDecoration: 'none', display: 'block' }}>
      <div className="row xs muted" style={{ gap: 6 }}>{icon}{title}</div>
      <div className="strong" style={{ marginTop: 6, fontSize: 14, color: bad ? 'var(--high)' : 'var(--text)' }}>{value}</div>
      <div className="xs muted" style={{ marginTop: 2 }}>{detail}</div>
    </Link>
  );
}
