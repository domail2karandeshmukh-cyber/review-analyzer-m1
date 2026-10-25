import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calculator, Sigma, ShieldCheck, Target, TrendingDown, Pencil } from 'lucide-react';
import { rpc } from '../lib/supabase';
import { useRpc, useSession } from '../lib/session';
import { EFF, fmtDate, fmtMoney, fmtMoneyShort } from '../lib/format';
import { Badge, Card, CaseTag, Drawer, ErrorBox, Loading, Notice, PageHead, Stat, useToast } from '../components/ui';
import { controlValues, exceed, ITERATIONS, logGrid, simulate } from '../lib/montecarlo';
import type { Dist, QRisk, RiskSim, SimResult } from '../lib/montecarlo';
import '../styles/quant.css';

/* ------------------------------------------------------------------ */
/* Simulation hook                                                     */
/* ------------------------------------------------------------------ */
export function useSimulation(risks?: QRisk[] | null) {
  const [sim, setSim] = useState<SimResult | null>(null);
  useEffect(() => {
    let live = true;
    if (!risks) return;
    simulate(risks).then(s => live && setSim(s));
    return () => { live = false; };
  }, [risks]);
  return sim;
}

/* ------------------------------------------------------------------ */
/* Loss exceedance curve (hand-rolled SVG, log-scaled money axis)      */
/* ------------------------------------------------------------------ */
function niceLogTicks(min: number, max: number) {
  const out: number[] = [];
  for (let e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e++) {
    for (const m of [1, 2, 5]) { const v = m * 10 ** e; if (v >= min * 0.999 && v <= max * 1.001) out.push(v); }
  }
  return out;
}
type Series = { dist: Dist; kind: 'res' | 'inh'; label: string };
export function LecChart({ series, tolerance, toleranceLabel = 'Tolerance', marker = true, height = 320, compact = false, printSafe = false }:
  { series: Series[]; tolerance?: number | null; toleranceLabel?: string; marker?: boolean; height?: number; compact?: boolean; printSafe?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(printSafe ? 640 : 760);
  const [hover, setHover] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver(() => setW(Math.max(260, el.clientWidth)));
    ro.observe(el); setW(Math.max(260, el.clientWidth));
    return () => ro.disconnect();
  }, []);
  const pad = compact ? { l: 34, r: 10, t: 10, b: 22 } : { l: 48, r: 18, t: 18, b: 44 };
  const allMax = Math.max(...series.map(s => s.dist.p99 || s.dist.p95), tolerance ?? 0, 1);
  const positives = series.flatMap(s => [s.dist.p10 || Infinity, s.dist.p50 || Infinity]).filter(v => v > 0 && Number.isFinite(v));
  const xmin = Math.max(1000, 10 ** Math.floor(Math.log10(Math.min(...positives, allMax / 50))));
  const xmax = 10 ** (Math.ceil(Math.log10(allMax * 1.05) * 4) / 4);
  const ymax = Math.min(1, Math.ceil(Math.max(...series.map(s => exceed(s.dist, xmin))) * 10 + 0.0001) / 10) || 1;
  const iw = w - pad.l - pad.r, ih = height - pad.t - pad.b;
  const X = (v: number) => pad.l + ((Math.log10(Math.max(v, xmin)) - Math.log10(xmin)) / (Math.log10(xmax) - Math.log10(xmin))) * iw;
  const Y = (p: number) => pad.t + (1 - p / ymax) * ih;
  const grid = useMemo(() => logGrid(xmin, xmax, compact ? 60 : 160), [xmin, xmax, compact]);
  const path = (d: Dist) => grid.map((x, i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y(exceed(d, x)).toFixed(1)}`).join('');
  const res = series.find(s => s.kind === 'res');
  const xt = niceLogTicks(xmin, xmax).filter((_, i, a) => !compact || a.length < 7 || i % 2 === 0);
  const yt = Array.from({ length: Math.round(ymax * 10) + 1 }, (_, i) => i / 10).filter((_, i, a) => !compact || i % 2 === 0 || i === a.length - 1);
  const hx = hover !== null ? 10 ** (Math.log10(xmin) + ((hover - pad.l) / iw) * (Math.log10(xmax) - Math.log10(xmin))) : null;
  return (
    <div className="lec" ref={ref}>
      <svg width={w} height={height} role="img" aria-label="Loss exceedance curve: probability that annual loss exceeds each amount"
        onMouseMove={e => { if (compact) return; const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); const x = e.clientX - r.left; setHover(x >= pad.l && x <= w - pad.r ? x : null); }}
        onMouseLeave={() => setHover(null)}>
        {yt.map(p => <g key={p}><line className="grid-l" x1={pad.l} x2={w - pad.r} y1={Y(p)} y2={Y(p)} /><text className="axis-t" x={pad.l - 6} y={Y(p) + 3.5} textAnchor="end">{Math.round(p * 100)}%</text></g>)}
        {xt.map(v => <g key={v}><line className="grid-l" x1={X(v)} x2={X(v)} y1={pad.t} y2={pad.t + ih} opacity={0.6} /><text className="axis-t" x={X(v)} y={pad.t + ih + 15} textAnchor="middle">{fmtMoneyShort(v)}</text></g>)}
        {!compact && <>
          <text className="axis-title" x={pad.l + iw / 2} y={height - 6} textAnchor="middle">Annual loss (log scale)</text>
          <text className="axis-title" transform={`translate(12 ${pad.t + ih / 2}) rotate(-90)`} textAnchor="middle">Probability loss is exceeded</text>
        </>}
        {res && <path className="area-res" d={`${path(res.dist)}L${X(xmax)},${Y(0)}L${X(xmin)},${Y(0)}Z`} />}
        {series.filter(s => s.kind === 'inh').map((s, i) => <path key={i} className="curve-inh" d={path(s.dist)} />)}
        {series.filter(s => s.kind === 'res').map((s, i) => <path key={i} className="curve-res" d={path(s.dist)} />)}
        {tolerance ? <g>
          <line className="tol" x1={X(tolerance)} x2={X(tolerance)} y1={pad.t} y2={pad.t + ih} />
          {!compact && <text className="tol-t" x={X(tolerance) + (X(tolerance) > w - 170 ? -6 : 6)} y={pad.t + 12} textAnchor={X(tolerance) > w - 170 ? 'end' : 'start'}>{toleranceLabel} {fmtMoneyShort(tolerance)}</text>}
        </g> : null}
        {marker && res && res.dist.p90 > 0 && (() => {
          const x = X(res.dist.p90), y = Y(0.1);
          const right = x < w - 200;
          return <g>
            <line className="mark" x1={x} x2={x} y1={y} y2={pad.t + ih} />
            <line className="mark" x1={pad.l} x2={x} y1={y} y2={y} />
            <circle className="mark-dot" cx={x} cy={y} r={4.5} />
            {!compact && <><text className="mark-t" x={x + (right ? 10 : -10)} y={y - 14} textAnchor={right ? 'start' : 'end'}>1-in-10-year loss {fmtMoneyShort(res.dist.p90)}</text>
              <text className="mark-s" x={x + (right ? 10 : -10)} y={y - 1} textAnchor={right ? 'start' : 'end'}>10% chance of exceeding (P90)</text></>}
          </g>;
        })()}
        {hover !== null && <line className="hair" x1={hover} x2={hover} y1={pad.t} y2={pad.t + ih} />}
      </svg>
      {hover !== null && hx !== null && (
        <div className="lec-tip" style={{ left: Math.min(hover + 12, w - 210), top: pad.t + 8 }}>
          <div className="muted xs">Annual loss above</div><div className="strong">{fmtMoney(hx)}</div>
          {series.map((s, i) => <div key={i} className="row between" style={{ gap: 14 }}><span className="muted">{s.label}</span><b>{(exceed(s.dist, hx) * 100).toFixed(1)}%</b></div>)}
        </div>
      )}
    </div>
  );
}

/** Control with the largest marginal effect on this risk's expected loss. */
function strongest(r: QRisk) {
  const all = controlValues([r]);
  return all[0];
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function Quant() {
  const { orgId } = useSession();
  const { data, error, loading, reload } = useRpc<any>('grc_quant', { p_org: orgId });
  const risks: QRisk[] | null = useMemo(() => (data ? data.risks : null), [data]);
  const sim = useSimulation(risks);
  const [sp, setSp] = useSearchParams();
  const open = sp.get('r');
  const appetite: any[] = data?.appetite ?? [];
  const apById = useMemo(() => Object.fromEntries(appetite.map(a => [a.id, a])), [appetite]);
  const tolerance = appetite.reduce((s, a) => s + Number(a.max_annual_loss || 0), 0);
  const values = useMemo(() => (risks ? controlValues(risks) : []), [risks]);

  if (error) return <ErrorBox error={error} />;
  const P = sim?.portfolio;
  const outside = sim ? appetite.filter(a => sim.byAppetite[a.id] && sim.byAppetite[a.id].residual.p90 > Number(a.max_annual_loss)) : [];
  const avoided = P ? P.inherent.mean - P.residual.mean : 0;
  const rows = sim ? [...sim.risks].sort((a, b) => b.residual.mean - a.residual.mean) : [];
  const sel = sim?.risks.find(r => r.risk.id === open);

  return (
    <>
      <PageHead title="Risk quantification"
        desc="What the risk register means in euros. Each risk's frequency and loss ranges are simulated 10,000 times to show expected annual loss, the 1-in-10-year loss and the value each control delivers."
        actions={<CaseTag>Case-study estimates</CaseTag>} />
      <div className="q-method" style={{ marginTop: -10, marginBottom: 16 }}>
        <Sigma size={13} /><span><b>Method:</b> FAIR-style. Loss event frequency (threat events × vulnerability) × loss magnitude, Beta-PERT ranges, {ITERATIONS.toLocaleString('en')} Monte Carlo iterations, fixed seed.</span>
        <span>Inputs are calibrated expert ranges for the fictional NOVATECH case, not historical loss data.</span>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <Stat icon={<Calculator size={13} />} k="Expected annual loss" v={P ? fmtMoneyShort(P.residual.mean) : '…'} d={P ? `Inherent ${fmtMoneyShort(P.inherent.mean)} before controls` : 'Simulating'} />
        <Stat icon={<Target size={13} />} k="1-in-10-year loss (P90)" v={P ? fmtMoneyShort(P.residual.p90) : '…'} d={P ? `Inherent ${fmtMoneyShort(P.inherent.p90)} · P99 ${fmtMoneyShort(P.residual.p99)}` : ''} />
        <Stat icon={<TrendingDown size={13} />} k="Loss avoided by controls" v={P ? `${fmtMoneyShort(avoided)}` : '…'} d={P ? `${Math.round((avoided / P.inherent.mean) * 100)}% of inherent expected loss, per year` : ''} tone="up" />
        <Stat icon={<ShieldCheck size={13} />} k="Appetite categories over tolerance" v={sim ? <>{outside.length}<small>/ {appetite.length}</small></> : '…'} d={sim ? (outside.length ? outside.map(a => a.category).join(', ') : 'All within their 1-in-10-year limit') : ''} tone={outside.length ? 'down' : undefined} />
      </div>

      <div className="q-grid" style={{ marginBottom: 16 }}>
        <Card title="Loss exceedance curve · portfolio" sub="Probability that total annual loss exceeds each amount. Read it left to right: the further right the curve stays high, the fatter the tail."
          actions={<div className="lec-legend"><span><i />Residual (with controls)</span><span><i className="inh" />Inherent</span><span><i className="tol" />Tolerance</span></div>}>
          {!sim ? <Loading rows={8} /> : <LecChart series={[{ dist: sim.portfolio.inherent, kind: 'inh', label: 'Inherent' }, { dist: sim.portfolio.residual, kind: 'res', label: 'Residual' }]}
            tolerance={tolerance} toleranceLabel="Combined appetite" />}
        </Card>
        <Card title="Appetite by category" sub="Residual 1-in-10-year loss against each category's annual loss limit">
          {!sim ? <Loading rows={6} /> : appetite.map(a => {
            const d = sim.byAppetite[a.id]?.residual; if (!d) return null;
            const lim = Number(a.max_annual_loss); const over = d.p90 > lim; const scale = Math.max(lim, d.p90) * 1.18;
            return (
              <div key={a.id} className="q-cat" title={a.statement}>
                <div className="nm">{a.category} {over ? <Badge tone="critical">Outside</Badge> : <Badge tone="success">Within</Badge>}</div>
                <div className="vals">{fmtMoneyShort(d.p90)} <span className="muted">/ {fmtMoneyShort(lim)}</span></div>
                <div className="track"><i className={over ? 'over' : ''} style={{ width: `${(d.p90 / scale) * 100}%` }} /><b style={{ left: `${(lim / scale) * 100}%` }} title="Limit" /></div>
              </div>
            );
          })}
        </Card>
      </div>

      <Card title="Risks in euros" sub="Sorted by residual expected annual loss. Select a row to see and edit the FAIR inputs." flush>
        {loading && !data ? <Loading rows={8} /> : !sim ? <Loading rows={8} /> : (
          <div className="table-wrap"><table className="t responsive">
            <thead><tr><th>Risk</th><th className="num">Loss events / yr</th><th className="num">Expected annual loss</th><th className="num">Reduction</th><th className="num">1-in-10-year</th><th>Appetite</th><th>Strongest control</th></tr></thead>
            <tbody>{rows.map(s => {
              const ap = apById[s.risk.appetite_id ?? ''];
              const catOver = ap && sim.byAppetite[ap.id]?.residual.p90 > Number(ap.max_annual_loss);
              const top = strongest(s.risk);
              const red = 1 - s.residual.mean / (s.inherent.mean || 1);
              return (
                <tr key={s.risk.id} className={`click ${open === s.risk.id ? 'on' : ''}`} onClick={() => setSp({ r: s.risk.id })}>
                  <td className="primary"><div className="cell-title"><span className="mono muted" style={{ marginRight: 8 }}>{s.risk.code}</span>{s.risk.title}</div><div className="cell-sub">Register score {(s.risk as any).score} · {(s.risk as any).category}</div></td>
                  <td className="num" data-label="Loss events / yr">{s.residual.lef.toFixed(2)}</td>
                  <td className="num" data-label="Expected annual loss"><div className="ale-cell"><s>{fmtMoneyShort(s.inherent.mean)}</s><span className="arrow">→</span><b>{fmtMoneyShort(s.residual.mean)}</b></div></td>
                  <td className="num" data-label="Reduction"><span className="redu">−{Math.round(red * 100)}%</span></td>
                  <td className="num" data-label="1-in-10-year">{fmtMoneyShort(s.residual.p90)}</td>
                  <td data-label="Appetite">{ap ? <span className="row" style={{ gap: 6 }}><span className="small">{ap.category}</span>{catOver ? <Badge tone="critical">Outside</Badge> : <Badge tone="success">Within</Badge>}</span> : '—'}</td>
                  <td data-label="Strongest control" className="small">{top ? <><span className="mono muted">{top.code}</span> {top.title}</> : '—'}</td>
                </tr>
              );
            })}
              <tr style={{ background: 'var(--raised)' }}>
                <td className="primary"><b>Portfolio</b> <span className="xs muted">simulated jointly, not a sum of P90s</span></td>
                <td className="num" data-label="Loss events / yr"><b>{P!.residual.lef.toFixed(2)}</b></td>
                <td className="num" data-label="Expected annual loss"><div className="ale-cell"><s>{fmtMoneyShort(P!.inherent.mean)}</s><span className="arrow">→</span><b>{fmtMoneyShort(P!.residual.mean)}</b></div></td>
                <td className="num" data-label="Reduction"><span className="redu">−{Math.round((avoided / P!.inherent.mean) * 100)}%</span></td>
                <td className="num" data-label="1-in-10-year"><b>{fmtMoneyShort(P!.residual.p90)}</b></td>
                <td data-label="Appetite" className="small muted">Combined limit {fmtMoneyShort(tolerance)}</td><td />
              </tr>
            </tbody>
          </table></div>
        )}
      </Card>

      <div style={{ height: 16 }} />
      <Card title="What each control is worth" sub="Expected annual loss avoided by the control as it operates today (green), and the extra it would avoid if fully effective (hatched)." flush>
        {!values.length ? <Loading rows={6} /> : (() => {
          const max = Math.max(...values.map(v => v.avoided + v.potential), 1);
          return values.slice(0, 12).map(v => (
            <div key={v.code} className="cv-row">
              <span className="mono muted">{v.code}</span>
              <div style={{ minWidth: 0 }}><div className="small strong" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.title}</div>
                <div className="xs muted row" style={{ gap: 6 }}><Badge tone={EFF[v.operating_eff]?.tone}>{EFF[v.operating_eff]?.label}</Badge>Covers {v.risks.join(', ')}</div></div>
              <div className="cv-bar" title={`Avoided ${fmtMoney(v.avoided)} · potential ${fmtMoney(v.potential)}`}><i style={{ width: `${(v.avoided / max) * 100}%` }} /><u style={{ width: `${(v.potential / max) * 100}%` }} /></div>
              <div className="num"><b>{fmtMoneyShort(v.avoided)}</b><div className="xs muted">{v.potential > 500 ? `+${fmtMoneyShort(v.potential)} possible` : 'at full value'}</div></div>
            </div>
          ));
        })()}
      </Card>

      {sel && <RiskDrawer s={sel} ap={apById[sel.risk.appetite_id ?? '']} canManage={!!data?.can_manage} onClose={() => setSp({})} onSaved={reload} />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Risk drawer: FAIR inputs, per-risk curve, controls, edit            */
/* ------------------------------------------------------------------ */
const ROWS: [string, string, (v: number) => string][] = [
  ['tef', 'Threat events / year', v => v.toLocaleString('en', { maximumFractionDigits: 2 })],
  ['vuln', 'Vulnerability (share that succeed)', v => `${Math.round(v * 100)}%`],
  ['lm', 'Loss per event', v => fmtMoney(v)],
];
function RiskDrawer({ s, ap, canManage, onClose, onSaved }: { s: RiskSim; ap?: any; canManage: boolean; onClose: () => void; onSaved: () => void }) {
  const { orgId } = useSession();
  const toast = useToast();
  const q: any = s.risk.quant;
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const o: Record<string, string> = {};
    for (const [k] of ROWS) for (const p of ['min', 'ml', 'max']) o[`${k}_${p}`] = String(k === 'vuln' ? Math.round(q[`${k}_${p}`] * 1000) / 10 : q[`${k}_${p}`]);
    o.rationale = q.rationale ?? '';
    setF(o); setEdit(false);
  }, [s.risk.id]); // eslint-disable-line
  const num = (k: string) => Number(f[k]);
  const bad = (k: string) => { const a = num(`${k}_min`), b = num(`${k}_ml`), c = num(`${k}_max`); return !(a <= b && b <= c) || [a, b, c].some(x => Number.isNaN(x) || x < 0) || (k === 'vuln' && c > 100); };
  const invalid = ROWS.some(([k]) => bad(k));
  async function save() {
    setSaving(true);
    try {
      const p: any = { rationale: f.rationale };
      for (const [k] of ROWS) for (const x of ['min', 'ml', 'max']) p[`${k}_${x}`] = k === 'vuln' ? num(`${k}_${x}`) / 100 : num(`${k}_${x}`);
      await rpc('grc_quant_save', { p_org: orgId, p_risk: s.risk.id, p });
      toast('ok', `Loss estimate for ${s.risk.code} saved and recorded in the ledger`);
      setEdit(false); onSaved();
    } catch (e: any) { toast('err', e.message); } finally { setSaving(false); }
  }
  const red = 1 - s.residual.mean / (s.inherent.mean || 1);
  return (
    <Drawer wide title={<><span className="mono muted" style={{ marginRight: 8 }}>{s.risk.code}</span>{s.risk.title}</>} sub={`${(s.risk as any).category} · register score ${(s.risk as any).score}`} onClose={onClose}
      actions={canManage && !edit ? <button className="btn sm" onClick={() => setEdit(true)}><Pencil size={13} />Edit inputs</button> : null}>
      <div className="stack" style={{ padding: 18 }}>
        <div className="mini-kpis">
          <div><span>Expected annual loss</span><b>{fmtMoneyShort(s.residual.mean)}</b><div className="xs muted">inherent {fmtMoneyShort(s.inherent.mean)} · −{Math.round(red * 100)}%</div></div>
          <div><span>1-in-10-year (P90)</span><b>{fmtMoneyShort(s.residual.p90)}</b><div className="xs muted">inherent {fmtMoneyShort(s.inherent.p90)}</div></div>
          <div><span>Chance of any loss this year</span><b>{Math.round(s.residual.pAny * 100)}%</b><div className="xs muted">{s.residual.lef.toFixed(2)} loss events / yr</div></div>
        </div>
        <div>
          <div className="section-title">Loss exceedance · this risk</div>
          <LecChart compact height={170} series={[{ dist: s.inherent, kind: 'inh', label: 'Inherent' }, { dist: s.residual, kind: 'res', label: 'Residual' }]} tolerance={ap ? Number(ap.max_annual_loss) : null} />
          {ap && <div className="xs muted" style={{ marginTop: 4 }}>Red line: {ap.category} limit {fmtMoney(ap.max_annual_loss)} a year (shared by every risk in that category). “{ap.statement}”</div>}
        </div>
        <div>
          <div className="row between" style={{ marginBottom: 8 }}><div className="section-title" style={{ margin: 0 }}>FAIR inputs (Beta-PERT ranges)</div><CaseTag /></div>
          {!edit ? (
            <div className="fair-grid">
              <div className="h">Factor</div><div className="h num">Minimum</div><div className="h num">Most likely</div><div className="h num">Maximum</div>
              {ROWS.map(([k, l, fmt]) => <FairRow key={k} l={l} a={fmt(q[`${k}_min`])} b={fmt(q[`${k}_ml`])} c={fmt(q[`${k}_max`])} />)}
            </div>
          ) : (
            <div className="stack">
              <div className="fair-edit">
                <span /><span className="h">Minimum</span><span className="h">Most likely</span><span className="h">Maximum</span>
                {ROWS.map(([k, l]) => (
                  <FairEditRow key={k} label={k === 'vuln' ? 'Vulnerability (%)' : k === 'lm' ? 'Loss per event (€)' : l} k={k} f={f} setF={setF} bad={bad(k)} />
                ))}
              </div>
              {invalid && <Notice kind="warn">Each row must satisfy minimum ≤ most likely ≤ maximum; vulnerability is a percentage up to 100.</Notice>}
              <div className="field"><label>Rationale</label><textarea className="textarea" value={f.rationale} onChange={e => setF({ ...f, rationale: e.target.value })} /></div>
              <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={() => setEdit(false)}>Cancel</button><button className="btn primary" disabled={invalid || saving} onClick={save}>{saving ? 'Saving' : 'Save estimate'}</button></div>
            </div>
          )}
          {!edit && <p className="small muted" style={{ marginTop: 8 }}>{q.rationale}</p>}
          {q.updated_by_name && <p className="xs muted">Last edited by {q.updated_by_name} on {fmtDate(q.updated_at)}.</p>}
        </div>
        <div>
          <div className="section-title">Controls that reduce this risk</div>
          <div className="card" style={{ overflow: 'hidden' }}>
            {(s.risk.controls ?? []).map(c => {
              const eff = { effective: 1, partial: .5, not_assessed: .25 }[c.operating_eff] ?? 0;
              return (
                <div key={c.code} className="list-row" style={{ padding: '9px 12px' }}>
                  <span className="mono muted" style={{ width: 40 }}>{c.code}</span>
                  <div className="grow"><div className="small strong">{c.title}</div><div className="xs muted">Design reduction {c.reduction}% × {EFF[c.operating_eff]?.label.toLowerCase()} = {Math.round(c.reduction * eff)}% applied</div></div>
                  <Badge tone={EFF[c.operating_eff]?.tone}>{EFF[c.operating_eff]?.label}</Badge>
                </div>
              );
            })}
          </div>
          <p className="xs muted" style={{ marginTop: 6 }}>Combined: vulnerability × {s.factor.toFixed(3)} (each control removes its share of what the others let through).</p>
        </div>
      </div>
    </Drawer>
  );
}
function FairRow({ l, a, b, c }: { l: string; a: string; b: string; c: string }) {
  return <><div className="l">{l}</div><div className="num">{a}</div><div className="num ml">{b}</div><div className="num">{c}</div></>;
}
function FairEditRow({ label, k, f, setF, bad }: { label: string; k: string; f: Record<string, string>; setF: (v: Record<string, string>) => void; bad: boolean }) {
  return <>
    <span className="small strong">{label}</span>
    {['min', 'ml', 'max'].map(p => <input key={p} className={`input ${bad ? 'bad' : ''}`} inputMode="decimal" value={f[`${k}_${p}`] ?? ''} onChange={e => setF({ ...f, [`${k}_${p}`]: e.target.value })} aria-label={`${label} ${p}`} />)}
  </>;
}
