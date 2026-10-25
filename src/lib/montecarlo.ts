/**
 * FAIR-style Monte Carlo for annual loss.
 *  - Loss Event Frequency (LEF) = Threat Event Frequency (TEF) × Vulnerability
 *  - Events per year ~ Poisson(LEF); each event's loss ~ Beta-PERT(min, most likely, max)
 *  - Inputs are Beta-PERT ranges (λ = 4); a fixed seed per risk keeps results stable between renders.
 *  - Residual = vulnerability × Π(1 − reduction × effectiveness) over mapped controls
 *    (effective 1, partial 0.5, not assessed 0.25, ineffective 0).
 */
export type QuantInput = {
  tef_min: number; tef_ml: number; tef_max: number;
  vuln_min: number; vuln_ml: number; vuln_max: number;
  lm_min: number; lm_ml: number; lm_max: number;
};
export type QControl = { id?: string; code: string; title: string; reduction: number; operating_eff: string };
export type QRisk = { id: string; code: string; title: string; appetite_id?: string | null; quant?: QuantInput | null; controls?: QControl[] };

export type Dist = { losses: Float64Array; sorted: Float64Array; mean: number; p10: number; p50: number; p90: number; p95: number; p99: number; pAny: number; lef: number };
export type RiskSim = { risk: QRisk; inherent: Dist; residual: Dist; factor: number };
export type SimResult = { iterations: number; risks: RiskSim[]; portfolio: { inherent: Dist; residual: Dist }; byAppetite: Record<string, { inherent: Dist; residual: Dist }> };

export const ITERATIONS = 10000;
export const EFF_FACTOR: Record<string, number> = { effective: 1, partial: 0.5, not_assessed: 0.25, ineffective: 0 };

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function normal(rnd: () => number) {
  let u = 0; while (u === 0) u = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
}
/** Marsaglia–Tsang gamma sampler (shape ≥ 0.01, scale 1). */
function gamma(k: number, rnd: () => number): number {
  if (k < 1) return gamma(k + 1, rnd) * Math.pow(rnd() || 1e-12, 1 / k);
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number, v: number;
    do { x = normal(rnd); v = 1 + c * x; } while (v <= 0);
    v = v * v * v;
    const u = rnd();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}
export function pert(min: number, ml: number, max: number, rnd: () => number, lambda = 4) {
  if (!(max > min)) return min;
  const a = 1 + lambda * (ml - min) / (max - min);
  const b = 1 + lambda * (max - ml) / (max - min);
  const x = gamma(a, rnd), y = gamma(b, rnd);
  return min + (x / (x + y)) * (max - min);
}
export const pertMean = (min: number, ml: number, max: number, lambda = 4) => (min + lambda * ml + max) / (lambda + 2);

function poisson(lambda: number, rnd: () => number) {
  if (lambda <= 0) return 0;
  if (lambda > 30) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * normal(rnd)));
  const L = Math.exp(-lambda); let k = 0, p = 1;
  do { k++; p *= rnd(); } while (p > L);
  return k - 1;
}

export function controlFactor(controls: QControl[] = [], skip?: string) {
  return controls.reduce((f, c) => (c.code === skip ? f : f * (1 - (c.reduction / 100) * (EFF_FACTOR[c.operating_eff] ?? 0))), 1);
}

function quantile(sorted: Float64Array, q: number) {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))));
  return sorted[i];
}
export function makeDist(losses: Float64Array, lefSum = 0): Dist {
  const sorted = Float64Array.from(losses).sort();
  let s = 0, any = 0;
  for (let i = 0; i < losses.length; i++) { s += losses[i]; if (losses[i] > 0) any++; }
  return { losses, sorted, mean: s / losses.length, p10: quantile(sorted, .1), p50: quantile(sorted, .5), p90: quantile(sorted, .9), p95: quantile(sorted, .95), p99: quantile(sorted, .99), pAny: any / losses.length, lef: lefSum / losses.length };
}
/** Probability that annual loss exceeds x. */
export function exceed(d: Dist, x: number) {
  const a = d.sorted; let lo = 0, hi = a.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] <= x) lo = m + 1; else hi = m; }
  return (a.length - lo) / a.length;
}

function simulateRisk(r: QRisk, n: number): RiskSim {
  const q = r.quant!;
  const factor = controlFactor(r.controls);
  const inh = new Float64Array(n), res = new Float64Array(n);
  let lefI = 0, lefR = 0;
  const rnd = mulberry32(hashSeed(r.code || r.id));
  for (let i = 0; i < n; i++) {
    const tef = pert(q.tef_min, q.tef_ml, q.tef_max, rnd);
    const v = pert(q.vuln_min, q.vuln_ml, q.vuln_max, rnd);
    const kI = poisson(tef * v, rnd);
    let lossI = 0, lossR = 0;
    for (let e = 0; e < kI; e++) {
      const lm = pert(q.lm_min, q.lm_ml, q.lm_max, rnd);
      lossI += lm;
      // Residual events are a thinned subset of the same inherent events (common random numbers):
      // each event gets past the controls with probability `factor`, i.e. Poisson(TEF × V × factor).
      if (rnd() < factor) lossR += lm;
    }
    inh[i] = lossI; res[i] = lossR; lefI += tef * v; lefR += tef * v * factor;
  }
  return { risk: r, factor, inherent: makeDist(inh, lefI), residual: makeDist(res, lefR) };
}

function sumDists(list: Dist[], n: number) {
  const out = new Float64Array(n); let lef = 0;
  for (const d of list) { for (let i = 0; i < n; i++) out[i] += d.losses[i]; lef += d.lef * n; }
  return makeDist(out, lef);
}

const cache = new Map<string, SimResult>();
/** Runs the simulation risk by risk, yielding to the browser between risks so the UI never freezes. */
export function simulate(risks: QRisk[], n = ITERATIONS): Promise<SimResult> {
  const valid = risks.filter(r => r.quant);
  const key = JSON.stringify(valid.map(r => [r.code, r.quant, (r.controls ?? []).map(c => [c.code, c.reduction, c.operating_eff])])) + n;
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  return new Promise(resolve => {
    const sims: RiskSim[] = [];
    let i = 0;
    const step = () => {
      if (i < valid.length) { sims.push(simulateRisk(valid[i++], n)); setTimeout(step, 0); return; }
      const byAppetite: SimResult['byAppetite'] = {};
      const groups = new Map<string, RiskSim[]>();
      sims.forEach(s => { const k = s.risk.appetite_id ?? '—'; groups.set(k, [...(groups.get(k) ?? []), s]); });
      groups.forEach((g, k) => { byAppetite[k] = { inherent: sumDists(g.map(x => x.inherent), n), residual: sumDists(g.map(x => x.residual), n) }; });
      const res: SimResult = { iterations: n, risks: sims, portfolio: { inherent: sumDists(sims.map(s => s.inherent), n), residual: sumDists(sims.map(s => s.residual), n) }, byAppetite };
      cache.set(key, res);
      resolve(res);
    };
    setTimeout(step, 0);
  });
}

/** Analytical expected annual loss (mean of PERT inputs) and each control's marginal contribution. */
export function expectedLoss(r: QRisk, factor = 1) {
  const q = r.quant; if (!q) return 0;
  return pertMean(q.tef_min, q.tef_ml, q.tef_max) * pertMean(q.vuln_min, q.vuln_ml, q.vuln_max) * factor * pertMean(q.lm_min, q.lm_ml, q.lm_max);
}
export type ControlValue = { code: string; title: string; operating_eff: string; avoided: number; risks: string[]; potential: number };
/** Loss avoided per control = residual ALE without the control − residual ALE with it (summed over the risks it covers).
 *  `potential` = extra loss that would be avoided if the control were fully effective. */
export function controlValues(risks: QRisk[]): ControlValue[] {
  const m = new Map<string, ControlValue>();
  for (const r of risks) {
    if (!r.quant) continue;
    const withAll = expectedLoss(r, controlFactor(r.controls));
    for (const c of r.controls ?? []) {
      const without = expectedLoss(r, controlFactor(r.controls, c.code));
      const full = expectedLoss(r, controlFactor((r.controls ?? []).map(x => (x.code === c.code ? { ...x, operating_eff: 'effective' } : x))));
      const v = m.get(c.code) ?? { code: c.code, title: c.title, operating_eff: c.operating_eff, avoided: 0, risks: [], potential: 0 };
      v.avoided += without - withAll; v.potential += withAll - full; v.risks.push(r.code);
      m.set(c.code, v);
    }
  }
  return [...m.values()].sort((a, b) => b.avoided - a.avoided);
}

/** Log-spaced x grid for exceedance curves. */
export function logGrid(min: number, max: number, n = 120) {
  const a = Math.log10(Math.max(1, min)), b = Math.log10(Math.max(min * 1.01, max));
  return Array.from({ length: n }, (_, i) => Math.pow(10, a + (b - a) * (i / (n - 1))));
}
