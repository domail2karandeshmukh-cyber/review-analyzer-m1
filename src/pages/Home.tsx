import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Clock, FileText, Presentation, ShieldCheck, Siren, TriangleAlert, Compass, Radar, Truck, LifeBuoy, ScrollText } from 'lucide-react';
import { useRpc, useSession } from '../lib/session';
import { ago, fmtMoney, fmtMoneyShort } from '../lib/format';
import { Badge, ErrorBox, Loading, Meter, CaseTag } from '../components/ui';
import { simulate } from '../lib/montecarlo';
import type { SimResult } from '../lib/montecarlo';
import { TASK, TASK_ICON, TASK_TONE } from './Overview';
import { useTour } from '../components/Tour';
import '../styles/home.css';

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
  const q = useRpc<any>('grc_quant', { p_org: orgId });
  const work = useRpc<any>('grc_my_work', { p_org: orgId }, { poll: 15000 });
  const [sim, setSim] = useState<SimResult | null>(null);
  const nav = useNavigate();
  const tour = useTour();
  useEffect(() => {
    let live = true;
    const risks = (q.data?.risks ?? []).filter((r: any) => r.quant);
    if (risks.length) simulate(risks).then(s => live && setSim(s));
    return () => { live = false; };
  }, [q.data]);
  if (h.error) return <ErrorBox error={h.error} />;
  if (!h.data) return <div className="stack"><div className="skeleton" style={{ height: 160 }} /><div className="skeleton" style={{ height: 120 }} /><Loading rows={6} /></div>;
  const d = h.data;
  const hour = new Date().getHours();

  const queue: Q[] = [];
  for (const n of d.reg_due ?? []) {
    const c = clock(n.due_at);
    queue.push({ key: `r${n.id}`, icon: <Clock size={16} />, tone: 'critical', title: `${n.regime} ${n.stage.replace(/^\d · /, '')}`, sub: `${n.ref} · regulatory deadline`, tag: <Badge tone={c.tone}>{c.t}</Badge>, to: `/incidents/${n.incident_id}`, urgency: hoursLeft(n.due_at) / 1000 });
  }
  for (const i of work.data?.incidents ?? []) queue.push({ key: `i${i.id}`, icon: <Siren size={16} />, tone: 'critical', title: i.title, sub: `${i.ref} · ${TASK[i.task] ?? 'Incident'}`, tag: <Badge tone="critical">Incident</Badge>, to: `/incidents/${i.id}`, urgency: 1 });
  for (const t of work.data?.tasks ?? []) queue.push({ key: `a${t.id}`, icon: TASK_ICON[t.task] ?? <ArrowRight size={16} />, tone: TASK_TONE[t.task] ?? '', title: t.title, sub: `${t.ref} · ${TASK[t.task] ?? t.task}${t.amount ? ` · ${fmtMoney(t.amount)}` : ''}`, tag: <Badge tone={t.task === 'approve' ? 'accent' : 'neutral'}>{TASK[t.task] ?? t.task}</Badge>, to: `/actions/${t.id}`, urgency: t.task === 'approve' || t.task === 'post_review' ? 2 : 3 });
  for (const p of d.policies?.to_attest ?? []) queue.push({ key: `p${p.id}`, icon: <FileText size={16} />, tone: '', title: `Acknowledge ${p.code} ${p.title}`, sub: 'Policy attestation campaign', tag: <Badge tone="neutral">Policy</Badge>, to: `/policies?p=${p.id}`, urgency: 5 });
  for (const c of d.failing ?? []) if (c.last_test?.result === 'fail') queue.push({ key: `c${c.id}`, icon: <TriangleAlert size={16} />, tone: 'critical', title: `${c.code} ${c.title}`, sub: c.last_test.detail, tag: <Badge tone="critical">Control failing</Badge>, to: `/controls?c=${c.id}`, urgency: 4 });
  queue.sort((a, b) => a.urgency - b.urgency);

  const breaches = (d.appetite ?? []).flatMap((a: any) => a.risks.filter((r: any) => r.breach).map((r: any) => ({ ...r, cat: a.category })));
  const catsOut = (d.appetite ?? []).filter((a: any) => a.risks.some((r: any) => r.breach));
  const fw = d.frameworks ?? [];
  const avgCov = fw.length ? fw.reduce((s: number, f: any) => s + covOf(f), 0) / fw.length : 0;
  const kriBad = (d.kri ?? []).filter((k: any) => k.level !== 'normal');
  const P = sim?.portfolio;
  const first = current?.full_name.split(' ')[0];

  return (
    <div className="home">
      <section className="h-hero">
        <div className="h-date">{new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())} · {current?.role}</div>
        <h1>{hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}, {first}.<br />
          <span>{breaches.length === 0 ? 'Every risk sits within appetite.' : <>{catsOut.length} of {(d.appetite ?? []).length} risk categories are outside the appetite the board approved.</>}</span>
        </h1>
        <p className="h-sub">
          {queue.length ? `${queue.length} ${queue.length === 1 ? 'item needs' : 'items need'} you` : 'Nothing needs you right now'}
          {' · '}{kriBad.length} early-warning {kriBad.length === 1 ? 'indicator' : 'indicators'} off normal{' · '}{d.incidents?.open ? `${d.incidents.open} open incidents` : 'no open incident'}
        </p>
        <div className="row wrap" style={{ gap: 10, marginTop: 26 }}>
          <a href="#needs" className="btn primary lg">Review what needs me <ArrowRight size={16} /></a>
          <Link to="/board" className="btn lg"><Presentation size={16} />Board pack</Link>
          {!tour.active && <button className="btn lg ghost" onClick={tour.start}><Compass size={16} />Guided tour</button>}
        </div>
      </section>

      <section className="h-band">
        <Link to="/quant" className="hb">
          <div className="hb-k">Expected annual loss</div>
          <div className="hb-v">{P ? fmtMoneyShort(P.residual.mean) : '…'}</div>
          <div className="hb-d">{P ? <>after controls · {fmtMoneyShort(P.inherent.mean)} without · 1-in-10-year {fmtMoneyShort(P.residual.p90)}</> : 'Running 10,000 simulations'}</div>
        </Link>
        <Link to="/compliance" className="hb">
          <div className="hb-k">Compliance coverage</div>
          <div className="hb-v">{Math.round(avgCov * 100)}<small>%</small></div>
          <div className="hb-d">ISO 27001 · NIS2 · GDPR · DORA, from one control set</div>
        </Link>
        <Link to="/risks" className="hb">
          <div className="hb-k">Outside appetite</div>
          <div className="hb-v" style={{ color: breaches.length ? 'var(--crit-2)' : undefined }}>{breaches.length}<small>/{(d.risks ?? []).length}</small></div>
          <div className="hb-d">{breaches.length ? breaches.map((b: any) => b.code).join(' · ') : 'All risks within tolerance'}</div>
        </Link>
        <Link to="/audit?verify=1" className="hb">
          <div className="hb-k">Audit ledger</div>
          <div className="hb-v">{d.chain?.entries ?? 0}</div>
          <div className="hb-d">{d.chain?.last_at ? `hash-chained entries · last ${ago(d.chain.last_at)}` : 'hash-chained entries'}</div>
        </Link>
      </section>

      <section className="h-sec" id="needs">
        <div className="h-sh">
          <div><div className="sec-k">What needs you</div><h2 className="sec-h">Your decisions, deadlines and acknowledgements.</h2></div>
          <Link to="/workspace" className="btn">All my work <ArrowRight size={14} /></Link>
        </div>
        <div className="h-queue">
          {queue.length === 0 ? (
            <div className="empty"><ShieldCheck size={28} color="var(--pass)" /><div className="strong" style={{ color: 'var(--text-2)' }}>You're clear</div><div className="small">Decisions routed to your role appear here the moment they are created.</div></div>
          ) : queue.slice(0, 7).map(x => (
            <div key={x.key} className="hq" onClick={() => nav(x.to)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && nav(x.to)}>
              <div className={`q-ic ${x.tone}`}>{x.icon}</div>
              <div style={{ minWidth: 0 }}><div className="hq-t">{x.title}</div><div className="hq-s">{x.sub}</div></div>
              {x.tag}<ArrowUpRight size={15} className="hq-go" />
            </div>
          ))}
        </div>
      </section>

      <section className="h-sec">
        <div className="h-sh">
          <div><div className="sec-k">Risk appetite</div><h2 className="sec-h">Where we stand against the board's tolerance.</h2>
            <p className="sec-p">Each bar is the highest current score in the category; the mark is the limit the board set.</p></div>
          <CaseTag>Board statements</CaseTag>
        </div>
        <div className="h-app">
          {(d.appetite ?? []).map((a: any) => {
            const worst = a.risks.reduce((m: number, r: any) => Math.max(m, r.score ?? 0), 0);
            const over = worst > a.max_score;
            return (
              <div key={a.id} className={`ha ${over ? 'over' : ''}`}>
                <div className="row between"><b>{a.category}</b><span className={`ha-s ${over ? 'bad' : ''}`}>{over ? 'Outside' : 'Within'}</span></div>
                <div className="ha-st">{a.statement}</div>
                <div className="ha-bar"><i style={{ width: `${Math.min(100, (worst / 16) * 100)}%` }} /><span style={{ left: `${(a.max_score / 16) * 100}%` }} /></div>
                <div className="row between xs muted"><span>{a.risks.map((r: any) => `${r.code} ${r.score}`).join(' · ')}</span><span>limit {a.max_score} · {a.tolerance}</span></div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="h-sec">
        <div className="h-sh">
          <div><div className="sec-k">Compliance</div><h2 className="sec-h">One control set. Four frameworks.</h2>
            <p className="sec-p">A requirement counts as met when an implemented control operates effectively. Monitoring runs on live platform data.</p></div>
          <Link to="/compliance" className="btn">Open the crosswalk <ArrowRight size={14} /></Link>
        </div>
        <div className="h-fw">
          {fw.map((f: any) => (
            <Link key={f.id} to={`/compliance?f=${f.id}`} className="hf">
              <div className="hf-c">{f.code}</div>
              <div className="hf-v">{Math.round(covOf(f) * 100)}<small>%</small></div>
              <Meter parts={[{ value: f.met, color: 'var(--pass)', title: 'Met' }, { value: f.partial, color: 'var(--medium)', title: 'Partial' }, { value: f.gap, color: 'var(--crit)', title: 'Gap' }]} />
              <div className="xs muted" style={{ marginTop: 8 }}>{f.met} met · {f.partial} partial · {f.gap} gap of {f.total}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="h-sec">
        <div className="h-sh">
          <div><div className="sec-k">Early warning</div><h2 className="sec-h">Key risk indicators, read live.</h2></div>
          <Link to="/risks?tab=monitoring" className="btn">Monitoring <ArrowRight size={14} /></Link>
        </div>
        <div className="h-kri">
          {(d.kri ?? []).map((k: any) => {
            const lvl = k.level === 'critical' ? 'crit' : k.level === 'warning' ? 'warn' : 'ok';
            return (
              <div key={k.risk_id} className={`hk ${lvl}`}>
                <div className="row between"><span className="mono xs muted">{k.code}</span><span className="hk-l">{k.level === 'normal' ? 'Normal' : k.level === 'warning' ? 'Warning' : 'Critical'}</span></div>
                <div className="hk-v">{k.value}<small> {k.unit}</small></div>
                <div className="hk-t">{k.kri}</div>
                <div className="xs muted">warning {k.warning} · critical {k.critical}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="h-sec">
        <div className="h-sh"><div><div className="sec-k">Programme health</div><h2 className="sec-h">The rest of the risk programme, in one line each.</h2></div></div>
        <div className="h-health">
          <Health icon={<ShieldCheck size={18} />} title="Control monitoring" to="/controls" value={d.last_monitor_run ? `Ran ${ago(d.last_monitor_run)}` : 'Never run'} detail={`${(d.failing ?? []).filter((x: any) => x.last_test?.result === 'fail').length} failing · ${(d.failing ?? []).filter((x: any) => x.last_test?.result === 'warn').length} warnings`} />
          <Health icon={<Radar size={18} />} title="EBIOS RM study" to="/ebios" value={d.ebios ? `${d.ebios.measures_done} of ${d.ebios.measures} measures done` : 'Not started'} detail={d.ebios ? `${d.ebios.pending_acceptance} residual risks awaiting acceptance` : ''} />
          <Health icon={<Truck size={18} />} title="Third parties" to="/vendors" value={`${d.vendors?.review_overdue ?? 0} reviews overdue`} detail={`${d.vendors?.critical ?? 0} critical · ${d.vendors?.no_exit_plan_critical ?? 0} critical without exit plan`} bad={(d.vendors?.review_overdue ?? 0) > 0} />
          <Health icon={<LifeBuoy size={18} />} title="Continuity" to="/continuity" value={`${d.continuity?.rto_missed ?? 0} recovery target missed`} detail={`${d.continuity?.tier1 ?? 0} tier-1 processes · ${d.continuity?.untested ?? 0} never tested`} bad={(d.continuity?.rto_missed ?? 0) > 0} />
          <Health icon={<ScrollText size={18} />} title="Treatment actions" to="/actions" value={`${d.actions?.open ?? 0} open`} detail={`${d.actions?.overdue ?? 0} overdue · ${d.actions?.awaiting_approval ?? 0} awaiting approval`} />
          <Health icon={<Siren size={18} />} title="Incidents" to="/incidents" value={`${d.incidents?.open ?? 0} open`} detail={d.incidents?.exposure > 0 ? `${fmtMoney(d.incidents.exposure)} at stake` : 'No financial exposure open'} bad={(d.incidents?.open ?? 0) > 0} />
        </div>
        <p className="xs muted" style={{ marginTop: 18 }}>Register scores, appetite statements, control ratings, loss ranges and supplier data are NOVATECH case-study inputs. Monitoring results, decisions, acknowledgements and the ledger are live records.</p>
      </section>
    </div>
  );
}

function Health({ icon, title, value, detail, to, bad }: { icon: React.ReactNode; title: string; value: string; detail: string; to: string; bad?: boolean }) {
  return (
    <Link to={to} className="hh">
      <span className="hh-ic">{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div className="xs muted">{title}</div>
        <div className="hh-v" style={{ color: bad ? 'var(--high)' : undefined }}>{value}</div>
        <div className="xs muted">{detail}</div>
      </div>
      <ArrowUpRight size={15} className="hq-go" />
    </Link>
  );
}
