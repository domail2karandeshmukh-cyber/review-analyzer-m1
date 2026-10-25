import { useMemo } from 'react';
import { Printer, FileCheck2 } from 'lucide-react';
import { useRpc, useSession } from '../lib/session';
import { fmtDate, fmtDateTime, fmtMoney, fmtMoneyShort } from '../lib/format';
import { CaseTag, ErrorBox, Loading, PageHead } from '../components/ui';
import { Logo } from '../components/Shell';
import { LecChart, useSimulation } from './Quant';
import { ITERATIONS } from '../lib/montecarlo';
import type { QRisk } from '../lib/montecarlo';
import '../styles/quant.css';

const lvl = (s: number) => (s >= 12 ? { t: 'Critical', c: 'red' } : s >= 8 ? { t: 'High', c: 'amber' } : s >= 4 ? { t: 'Moderate', c: 'grey' } : { t: 'Low', c: 'green' });
const heatBg = (s: number) => (s >= 12 ? '#f6c9cb' : s >= 8 ? '#fbdcc4' : s >= 4 ? '#fbedc3' : '#d6eedf');
const coverage = (f: any) => (f.total ? (f.met + 0.5 * f.partial) / f.total : 0);
const quarter = (d: Date) => `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
const pc = (v: number) => `${Math.round(v * 100)}%`;
const list = (a: string[]) => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);

export default function Board() {
  const { orgId } = useSession();
  const { data: b, error, loading } = useRpc<any>('grc_board', { p_org: orgId });
  const qrisks: QRisk[] | null = useMemo(() => (b?.quant ? b.quant.risks : null), [b]);
  const sim = useSimulation(qrisks);

  if (error) return <ErrorBox error={error} />;
  if (loading && !b) return <Loading rows={10} />;
  if (!b) return null;

  const gen = new Date(b.generated_at);
  const risks: any[] = b.risks ?? [];
  const critical = risks.filter(r => r.score >= 12);
  const appetite: any[] = b.appetite ?? [];
  const breached = appetite.filter(a => a.risks.some((r: any) => r.breach));
  const tolerance = appetite.reduce((s, a) => s + Number(a.max_annual_loss || 0), 0);
  const fws: any[] = b.frameworks ?? [];
  const P = sim?.portfolio;
  const avoided = P ? P.inherent.mean - P.residual.mean : 0;
  const quantOver = sim ? appetite.filter(a => sim.byAppetite[a.id] && sim.byAppetite[a.id].residual.p90 > Number(a.max_annual_loss)) : [];
  const ctl = b.controls ?? {};
  const effPct = ctl.total ? ctl.effective / ctl.total : 0;
  const residualsPending = (b.residuals ?? []).filter((r: any) => r.status === 'pending_acceptance');
  const critNoExit = (b.vendor_list ?? []).filter((v: any) => v.tier === 'critical' && !v.exit_plan);
  const vendorOverdue = (b.vendor_list ?? []).filter((v: any) => v.review_overdue);
  const rtoMissed = (b.processes ?? []).filter((p: any) => p.last_test?.rto != null && p.last_test.rto > p.rto);
  const untested = b.continuity?.untested ?? 0;
  const chainOk = b.chain_state?.ok;

  // Decisions requested, derived from the data
  const decisions: { d: string; basis: string }[] = [
    ...residualsPending.map((r: any) => ({ d: `Accept residual risk ${r.ref} (${r.title})`, basis: `EBIOS RM workshop 5: severity ${r.gravity_before}→${r.gravity_after}, likelihood ${r.likelihood_before}→${r.likelihood_after}. ${r.decision}.` })),
    ...breached.map(a => ({ d: `Confirm treatment or restate appetite for ${a.category.toLowerCase()}`, basis: `${a.risks.filter((r: any) => r.breach).map((r: any) => `${r.code} scores ${r.score}`).join(', ')} against a limit of ${a.max_score}.` })),
    ...critNoExit.map((v: any) => ({ d: `Mandate a tested exit plan for ${v.name}`, basis: `Critical-tier supplier with no exit plan (DORA Art. 28 expectation for ICT providers to financial clients).` })),
    ...(rtoMissed.length ? [{ d: `Fund recovery improvements for ${list(rtoMissed.map((p: any) => p.name.toLowerCase()))}`, basis: rtoMissed.map((p: any) => `Last test restored in ${p.last_test.rto} h against a ${p.rto} h objective.`).join(' ') }] : []),
    ...(untested ? [{ d: `Approve the continuity exercise programme`, basis: `${untested} business processes have never been tested against their recovery objectives.` }] : []),
    ...(vendorOverdue.length ? [{ d: `Note overdue supplier reviews`, basis: `${list(vendorOverdue.map((v: any) => v.name))}: review date passed.` }] : []),
  ];

  const summary = [
    `NOVATECH's register holds ${risks.length} assessed risks; ${critical.length} are critical (score 12 or more), led by ${list(critical.slice(0, 3).map(r => `${r.code} ${r.title.toLowerCase()} (${r.score})`))}.`,
    breached.length ? `${breached.length} of ${appetite.length} appetite categories are breached on the scoring scale: ${list(breached.map(a => a.category.toLowerCase()))}.` : `All appetite categories are within their scoring limits.`,
    P ? `In euros, residual expected annual loss is ${fmtMoneyShort(P.residual.mean)} with a 1-in-10-year loss of ${fmtMoneyShort(P.residual.p90)}, against a combined appetite of ${fmtMoneyShort(tolerance)}; controls avoid an estimated ${fmtMoneyShort(avoided)} a year (${pc(avoided / P.inherent.mean)} of inherent loss).` : `Loss quantification is being simulated.`,
    `Compliance coverage stands at ${list(fws.map(f => `${f.code} ${pc(coverage(f))}`))}; ${ctl.effective} of ${ctl.total} controls operate effectively.`,
    `${b.incidents?.open ? `${b.incidents.open} incident(s) are open with ${fmtMoney(b.incidents.exposure)} at stake.` : 'There is no open incident.'} The audit ledger was recomputed at generation: ${b.chain_state?.checked} entries, ${chainOk ? 'chain intact' : 'chain BROKEN'}.`,
  ];

  // mini heat map cells
  const cell = (l: number, i: number) => risks.filter(r => r.likelihood === l && r.impact === i);

  let page = 0;
  const Head = ({ t }: { t: string }) => <div className="bp-head"><span><b>NOVATECH Services</b> · Board risk report · {quarter(gen)}</span><span>{t}</span></div>;
  const Foot = () => { page += 1; return <div className="pfoot"><span>Confidential · prepared for the Board · generated from live platform data</span><span>{page}</span></div>; };

  return (
    <>
      <div className="bp-tools no-print">
        <PageHead title="Board pack" desc="An executive risk report assembled from live data at the moment you open it. Print it or save it as PDF for the board." />
        <div className="row"><CaseTag>Fictional case data</CaseTag><button className="btn primary" onClick={() => window.print()}><Printer size={15} />Print / Save as PDF</button></div>
      </div>

      <div className="bp">
        {/* ---------------- Cover ---------------- */}
        <div className="bp-sheet cover">
          <div className="brand"><Logo size={26} />NOVATECH IRM</div>
          <div>
            <div className="rule" />
            <h1>Board risk report</h1>
            <div className="sub">{b.org?.name ?? 'NOVATECH SERVICES'} · {quarter(gen)}</div>
            <p className="lead" style={{ marginTop: '10mm', maxWidth: '140mm' }}>Risk profile, quantified exposure, compliance posture, control assurance and the decisions requested from the Board.</p>
          </div>
          <div>
            <dl className="meta">
              <dt>Organisation</dt><dd>{b.org?.description}</dd>
              <dt>Prepared by</dt><dd>{b.generated_by}, {b.generated_role}</dd>
              <dt>Generated</dt><dd>{fmtDateTime(b.generated_at)} from the live governance platform</dd>
              <dt>Assurance</dt><dd>Audit ledger recomputed at generation: {b.chain_state?.checked} hash-chained entries, {chainOk ? 'intact' : 'broken'}</dd>
              <dt>Provenance</dt><dd>NOVATECH is the fictional ESAIP case company. Register scores, controls and loss ranges are case-study inputs; workflow, approvals and the audit trail are real platform records.</dd>
            </dl>
            <Foot />
          </div>
        </div>

        {/* ---------------- 1–2 ---------------- */}
        <div className="bp-sheet">
          <Head t="Summary and risk profile" />
          <section>
            <h2><span className="no">1</span>Executive summary</h2>
            <div className="cols3" style={{ margin: '4mm 0 6mm' }}>
              <div className="kfig"><div className="v">{critical.length}<span style={{ fontSize: '11pt', color: 'var(--text-3)' }}> / {risks.length}</span></div><div className="k">critical risks in the register</div></div>
              <div className="kfig"><div className="v">{P ? fmtMoneyShort(P.residual.p90) : '…'}</div><div className="k">1-in-10-year loss after controls (P90)</div></div>
              <div className="kfig"><div className="v">{breached.length}<span style={{ fontSize: '11pt', color: 'var(--text-3)' }}> / {appetite.length}</span></div><div className="k">appetite categories breached</div></div>
            </div>
            {summary.map((s, i) => <p key={i} className={i === 0 ? 'lead' : ''} style={{ marginBottom: '2.5mm' }}>{s}</p>)}
            {decisions.length > 0 && <div className="callout" style={{ marginTop: '4mm' }}><b>{decisions.length} decisions are requested</b> from the Board (section 9).</div>}
          </section>
          <section>
            <h2><span className="no">2</span>Risk profile</h2>
            <div className="cols" style={{ gridTemplateColumns: '1.45fr 1fr' }}>
              <table className="bt">
                <thead><tr><th>Risk</th><th className="n">L×I</th><th className="n">Score</th><th>Level</th><th className="n">Target</th></tr></thead>
                <tbody>{risks.map(r => { const l = lvl(r.score); return (
                  <tr key={r.id}><td><b>{r.code}</b> {r.title}</td><td className="n">{r.likelihood}×{r.impact}</td><td className="n"><b>{r.score}</b></td><td><span className={`tag ${l.c}`}>{l.t}</span></td><td className="n">{r.residual_target ?? '—'}</td></tr>); })}</tbody>
              </table>
              <div>
                <div className="mheat" aria-label="Heat map">
                  {[4, 3, 2, 1].map(l => [<div key={`a${l}`} className="ax">{l}</div>, ...[1, 2, 3, 4].map(i => <div key={`${l}${i}`} className="c" style={{ background: heatBg(l * i) }}>{cell(l, i).map(r => <b key={r.id}>{r.code}</b>)}</div>)])}
                  <div />{[1, 2, 3, 4].map(i => <div key={`x${i}`} className="ax">{i}</div>)}
                </div>
                <p className="note" style={{ marginTop: '2mm' }}>Rows: likelihood 1–4. Columns: impact 1–4. Score = L × I (1–3 low, 4–7 moderate, 8–11 high, 12–16 critical).</p>
              </div>
            </div>
            <h3>Risk appetite</h3>
            <table className="bt">
              <thead><tr><th style={{ width: '24%' }}>Category</th><th>Statement</th><th className="n">Score limit</th><th>Status</th></tr></thead>
              <tbody>{appetite.map(a => { const br = a.risks.filter((r: any) => r.breach); return (
                <tr key={a.id}><td><b>{a.category}</b><div className="note">{a.tolerance} tolerance</div></td><td style={{ fontSize: '8.5pt', color: 'var(--text-2)' }}>{a.statement}</td><td className="n">{a.max_score}</td>
                  <td>{br.length ? <span className="tag red">Breached · {br.map((r: any) => r.code).join(', ')}</span> : <span className="tag green">Within</span>}</td></tr>); })}</tbody>
            </table>
          </section>
          <Foot />
        </div>

        {/* ---------------- 3–5 ---------------- */}
        <div className="bp-sheet">
          <Head t="Exposure, compliance and controls" />
          <section>
            <h2><span className="no">3</span>Quantified exposure</h2>
            <p>Each risk's frequency and loss ranges were simulated {ITERATIONS.toLocaleString('en')} times (FAIR-style, Beta-PERT). The curve shows the probability that total annual loss exceeds each amount.</p>
            {!sim ? <Loading rows={5} /> : <>
              <div className="cols3" style={{ margin: '4mm 0' }}>
                <div className="kfig"><div className="v">{fmtMoneyShort(P!.residual.mean)}</div><div className="k">expected annual loss after controls (inherent {fmtMoneyShort(P!.inherent.mean)})</div></div>
                <div className="kfig"><div className="v">{fmtMoneyShort(P!.residual.p90)}</div><div className="k">1-in-10-year loss (inherent {fmtMoneyShort(P!.inherent.p90)})</div></div>
                <div className="kfig"><div className="v">{fmtMoneyShort(avoided)}</div><div className="k">loss avoided by controls each year</div></div>
              </div>
              <div className="cols" style={{ gridTemplateColumns: '1.25fr 1fr', alignItems: 'start' }}>
                <div>
                  <LecChart printSafe height={210} series={[{ dist: P!.inherent, kind: 'inh', label: 'Inherent' }, { dist: P!.residual, kind: 'res', label: 'Residual' }]} tolerance={tolerance} toleranceLabel="Appetite" />
                  <p className="note">Solid: residual. Dashed: inherent. Red: combined appetite {fmtMoneyShort(tolerance)}.</p>
                </div>
                <table className="bt">
                  <thead><tr><th>Risk</th><th className="n">Expected</th><th className="n">P90</th></tr></thead>
                  <tbody>{[...sim.risks].sort((x, y) => y.residual.mean - x.residual.mean).map(s => (
                    <tr key={s.risk.id}><td><b>{s.risk.code}</b></td><td className="n">{fmtMoneyShort(s.residual.mean)}</td><td className="n">{fmtMoneyShort(s.residual.p90)}</td></tr>))}
                    <tr className="total"><td>Portfolio</td><td className="n">{fmtMoneyShort(P!.residual.mean)}</td><td className="n">{fmtMoneyShort(P!.residual.p90)}</td></tr></tbody>
                </table>
              </div>
              {quantOver.length > 0 && <p style={{ marginTop: '2mm' }}><b>Over tolerance in euros:</b> {list(quantOver.map(a => `${a.category.toLowerCase()} (P90 ${fmtMoneyShort(sim.byAppetite[a.id].residual.p90)} vs ${fmtMoneyShort(a.max_annual_loss)})`))}.</p>}
            </>}
          </section>
          <section>
            <h2><span className="no">4</span>Compliance posture</h2>
            <table className="bt">
              <thead><tr><th>Framework</th><th className="n">Met</th><th className="n">Partial</th><th className="n">Gap</th><th style={{ width: '32%' }}>Coverage</th><th className="n">%</th></tr></thead>
              <tbody>{fws.map(f => (
                <tr key={f.id}><td><b>{f.code}</b> <span className="note">{f.name}</span></td><td className="n">{f.met}</td><td className="n">{f.partial}</td><td className="n">{f.gap}</td>
                  <td><div className="hbar"><i style={{ width: `${(f.met / f.total) * 100}%`, background: 'var(--pass)' }} /><i style={{ width: `${(f.partial / f.total) * 100}%`, background: 'var(--medium-line)' }} /><i style={{ width: `${(f.gap / f.total) * 100}%`, background: 'var(--crit-line)' }} /></div></td>
                  <td className="n"><b>{pc(coverage(f))}</b></td></tr>))}</tbody>
            </table>
            <p className="note" style={{ marginTop: '1.5mm' }}>Coverage = (met + ½ partial) ÷ requirements in scope. A requirement is met when a mapped control is implemented and operating effectively.</p>
          </section>
          <section>
            <h2><span className="no">5</span>Controls and monitoring</h2>
            <div className="cols" style={{ gridTemplateColumns: '1fr 1.6fr' }}>
              <div>
                <div className="kfig"><div className="v">{pc(effPct)}</div><div className="k">{ctl.effective} of {ctl.total} controls operating effectively · {ctl.partial} partial · {ctl.not_assessed} not assessed</div></div>
                <p className="note" style={{ marginTop: '3mm' }}>{ctl.monitored} controls are tested automatically from live platform data; last run {fmtDateTime(b.last_monitor_run)}.</p>
              </div>
              <table className="bt">
                <thead><tr><th>Latest exceptions</th><th>Result</th></tr></thead>
                <tbody>{(b.failing ?? []).length ? b.failing.map((c: any) => (
                  <tr key={c.id}><td><b>{c.code}</b> {c.title}<div className="note">{c.last_test?.detail}</div></td><td><span className={`tag ${c.last_test?.result === 'fail' ? 'red' : 'amber'}`}>{c.last_test?.result === 'fail' ? 'Fail' : 'Warning'}</span></td></tr>))
                  : <tr><td colSpan={2}>No failing or warning test.</td></tr>}</tbody>
              </table>
            </div>
          </section>
          <Foot />
        </div>

        {/* ---------------- 6–8 ---------------- */}
        <div className="bp-sheet">
          <Head t="Incidents, third parties, continuity, EBIOS RM" />
          <section>
            <h2><span className="no">6</span>Incidents and regulatory deadlines</h2>
            {(b.incident_list ?? []).length === 0 ? <p>No incident was recorded in the last 90 days.</p> : (
              <table className="bt"><thead><tr><th>Incident</th><th>Severity</th><th>Status</th><th>Detected</th><th className="n">Exposure</th></tr></thead>
                <tbody>{b.incident_list.map((i: any) => <tr key={i.ref}><td><b>{i.ref}</b> {i.title}</td><td>{i.severity}</td><td>{i.status}</td><td>{fmtDate(i.detected_at)}</td><td className="n">{i.exposure ? fmtMoney(i.exposure) : '—'}</td></tr>)}</tbody></table>
            )}
            {(b.reg_due ?? []).length > 0 ? (
              <table className="bt" style={{ marginTop: '3mm' }}><thead><tr><th>Notification due</th><th>Regime</th><th>Deadline</th></tr></thead>
                <tbody>{b.reg_due.map((n: any) => <tr key={n.id}><td><b>{n.ref}</b> {n.stage}</td><td>{n.regime}</td><td>{fmtDateTime(n.due_at)}</td></tr>)}</tbody></table>
            ) : <p className="note">No regulatory notification is pending (NIS2 24 h / 72 h / 1 month, GDPR 72 h, DORA 4 h / 24 h clocks are tracked per incident).</p>}
          </section>
          <section>
            <h2><span className="no">7</span>Third parties and continuity</h2>
            <div className="cols">
              <div>
                <h3 style={{ marginTop: 0 }}>Critical and high-tier suppliers</h3>
                <table className="bt"><thead><tr><th>Supplier</th><th>Tier</th><th className="n">Risk</th><th>Exit plan</th></tr></thead>
                  <tbody>{(b.vendor_list ?? []).map((v: any) => (
                    <tr key={v.name}><td>{v.name}{v.review_overdue && <div><span className="tag red">Review overdue</span></div>}</td><td style={{ textTransform: 'capitalize' }}>{v.tier}</td><td className="n">{v.residual}</td><td>{v.exit_plan ? <span className="tag green">Yes</span> : <span className="tag red">No</span>}</td></tr>))}</tbody></table>
                <p className="note" style={{ marginTop: '1.5mm' }}>{b.vendors?.total} suppliers in the register; {b.vendors?.contract_expired} contracts past their end date. Risk = residual score 0–100.</p>
              </div>
              <div>
                <h3 style={{ marginTop: 0 }}>Recovery objectives (tier 1–2)</h3>
                <table className="bt"><thead><tr><th>Process</th><th className="n">RTO</th><th>Last test</th></tr></thead>
                  <tbody>{(b.processes ?? []).map((p: any) => (
                    <tr key={p.name}><td>{p.name}<div className="note">Tier {p.tier} · RPO {p.rpo} h</div></td><td className="n">{p.rto} h</td>
                      <td>{p.last_test ? <><span className={`tag ${p.last_test.result === 'pass' ? 'green' : p.last_test.result === 'fail' ? 'red' : 'amber'}`}>{p.last_test.result}</span><div className="note">{fmtDate(p.last_test.on)}{p.last_test.rto != null && ` · restored in ${p.last_test.rto} h`}</div></> : <span className="tag grey">Never tested</span>}</td></tr>))}</tbody></table>
              </div>
            </div>
          </section>
          <section>
            <h2><span className="no">8</span>EBIOS RM: residual risks</h2>
            <p>Study “{b.ebios?.title}”: {b.ebios?.measures_done} of {b.ebios?.measures} security measures (PACS) completed; {b.ebios?.pending_acceptance} residual risks await formal acceptance.</p>
            <table className="bt"><thead><tr><th>Residual risk</th><th className="n">Before (G×V)</th><th className="n">After (G×V)</th><th>Proposed decision</th><th>Status</th></tr></thead>
              <tbody>{(b.residuals ?? []).map((r: any) => (
                <tr key={r.ref}><td><b>{r.ref}</b> {r.title}</td><td className="n">{r.gravity_before}×{r.likelihood_before}</td><td className="n">{r.gravity_after}×{r.likelihood_after}</td><td>{r.decision}</td>
                  <td><span className={`tag ${r.status === 'pending_acceptance' ? 'amber' : r.status === 'accepted' ? 'green' : 'grey'}`}>{r.status.replace(/_/g, ' ')}</span></td></tr>))}</tbody></table>
            <p className="note" style={{ marginTop: '1.5mm' }}>G = gravité (severity 1–4), V = vraisemblance (likelihood 1–4), per ANSSI EBIOS Risk Manager workshop 5.</p>
          </section>
          <Foot />
        </div>

        {/* ---------------- 9 + appendix ---------------- */}
        <div className="bp-sheet">
          <Head t="Decisions and assurance" />
          <section>
            <h2><span className="no">9</span>Decisions requested from the Board</h2>
            <table className="bt">
              <thead><tr><th style={{ width: 22 }}>#</th><th>Decision requested</th><th>Basis</th><th>Resolution</th></tr></thead>
              <tbody>{decisions.map((d, i) => (
                <tr key={i}><td><b>{i + 1}</b></td><td style={{ fontWeight: 600 }}>{d.d}</td><td style={{ fontSize: '8.5pt', color: 'var(--text-2)' }}>{d.basis}</td><td><div className="resolve" /><div className="note">Approve · Reject · Defer</div></td></tr>))}</tbody>
            </table>
          </section>
          <section>
            <h2><span className="no">A</span>Assurance statement and method</h2>
            <div className="callout" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <FileCheck2 size={18} style={{ flex: 'none', color: chainOk ? 'var(--pass)' : 'var(--crit)' }} />
              <div>The governance audit trail was recomputed by the database when this report was generated: <b>{b.chain_state?.checked} hash-chained entries, {chainOk ? 'every fingerprint matches' : `chain broken at entry #${b.chain_state?.first_broken_id}`}</b>. Entries cannot be edited or deleted. Approvals in this platform are enforced by role, with segregation of duties: no one approves their own request or verifies their own work.</div>
            </div>
            <ul style={{ paddingLeft: '5mm', marginTop: '4mm' }}>
              <li><b>Risk scores</b> follow the course scale (likelihood × impact, 1–16) and ISO 31000 treatment options.</li>
              <li><b>Quantification</b>: FAIR-style; loss event frequency = threat events × vulnerability, Poisson-distributed per year; loss per event Beta-PERT; {ITERATIONS.toLocaleString('en')} iterations, fixed seed. Residual vulnerability = inherent × Π(1 − control reduction × effectiveness), with effective 1, partial 0.5, not assessed 0.25.</li>
              <li><b>Compliance</b>: ISO/IEC 27001:2022 Annex A (scoped subset), NIS2 Art. 20, 21 and 23, GDPR, and DORA articles flowed down by financial-sector clients.</li>
              <li><b>Control monitoring</b> results are computed from live platform data (approval records, audit chain, KRI readings); nothing is entered by hand.</li>
              <li><b>Limits</b>: NOVATECH is a fictional company. Loss ranges and control ratings are case-study inputs for teaching, not historical data.</li>
            </ul>
          </section>
          <Foot />
        </div>
      </div>
    </>
  );
}
