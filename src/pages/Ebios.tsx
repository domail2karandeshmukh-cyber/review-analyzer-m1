import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Pencil, BookOpen, CheckCircle2, ShieldAlert } from 'lucide-react';
import { rpc } from '../lib/supabase';
import { useRpc, useSession } from '../lib/session';
import { fmtDate } from '../lib/format';
import { Badge, Card, CaseTag, Drawer, ErrorBox, Field, Loading, Modal, Notice, PageHead, Stat, useToast } from '../components/ui';
import '../styles/ebios.css';

/* ------------------------------------------------------------------ types */
type Item = { id: string; workshop: number; kind: string; ref: string | null; title: string; data: any; sort: number };
type Data = { study: any; items: Item[]; risks: { id: string; code: string; title: string; score: number }[]; controls: { id: string; code: string; title: string; operating_eff: string }[]; can_manage: boolean };

/* ------------------------------------------------------------------ method reference (ANSSI EBIOS RM guide) */
const WORKSHOPS = [
  { n: 1, fr: 'Cadrage et socle de sécurité', en: 'Scope and security baseline', q: 'What do we protect, what would hurt, and which rules already apply?',
    intro: 'Missions, business values (valeurs métier) and their supporting assets (biens supports); feared events rated on the gravity scale; conformity to the security baseline.' },
  { n: 2, fr: 'Sources de risque', en: 'Risk sources', q: 'Who could attack us, and what do they want?',
    intro: 'Risk source / target objective pairs (SR/OV) assessed on motivation, resources and activity. Only the most relevant pairs are carried into workshop 3.' },
  { n: 3, fr: 'Scénarios stratégiques', en: 'Strategic scenarios', q: 'Through which stakeholders of our ecosystem would they come?',
    intro: 'Digital threat map of the ecosystem: each stakeholder rated on exposure and cyber reliability. Critical stakeholders (PPC) feed the strategic scenarios, from risk source to feared event.' },
  { n: 4, fr: 'Scénarios opérationnels', en: 'Operational scenarios', q: 'Concretely, how would the attack unfold on our supporting assets?',
    intro: 'Each strategic scenario is broken into an attack sequence (Know, Enter, Find, Exploit) on supporting assets and rated on the likelihood scale V1–V4.' },
  { n: 5, fr: 'Traitement du risque', en: 'Risk treatment', q: 'What do we do about it, and what risk do we knowingly accept?',
    intro: 'Initial and residual risk mapping, the security improvement plan (PACS) with owners and deadlines, and the decision on each residual risk.' },
];
const GRAVITY = [
  { n: 1, fr: 'Mineure', en: 'Minor', d: 'No significant impact; the organisation copes without effort.' },
  { n: 2, fr: 'Significative', en: 'Significant', d: 'Degraded operation; overcome with limited effort.' },
  { n: 3, fr: 'Grave', en: 'Serious', d: 'Strongly degraded mode; consequences overcome with serious difficulty.' },
  { n: 4, fr: 'Critique', en: 'Critical', d: 'Unable to provide the service; the organisation may not survive.' },
];
const LIKELIHOOD = [
  { n: 1, fr: 'Peu vraisemblable', en: 'Unlikely' }, { n: 2, fr: 'Vraisemblable', en: 'Likely' },
  { n: 3, fr: 'Très vraisemblable', en: 'Very likely' }, { n: 4, fr: 'Quasi certain', en: 'Almost certain' },
];
const PHASES = [
  { k: 'Know', fr: 'Connaître', d: 'Reconnaissance' }, { k: 'Enter', fr: 'Rentrer', d: 'Initial access' },
  { k: 'Find', fr: 'Trouver', d: 'Discovery, movement' }, { k: 'Exploit', fr: 'Exploiter', d: 'Action on objective' },
];
const MEASURE_STATUS: Record<string, { l: string; t: any }> = { done: { l: 'Done', t: 'success' }, in_progress: { l: 'In progress', t: 'info' }, planned: { l: 'Planned', t: 'neutral' } };
const RESIDUAL_STATUS: Record<string, { l: string; t: any }> = {
  pending_acceptance: { l: 'Pending acceptance', t: 'warning' }, treatment_in_progress: { l: 'Treatment in progress', t: 'info' },
  accepted: { l: 'Accepted', t: 'success' }, refused: { l: 'Not accepted — treat further', t: 'critical' },
};

/** Threat level of a stakeholder: (dependence × penetration) / (maturity × trust) — ANSSI "cartographie de la menace numérique". */
const threatOf = (d: any) => (Number(d.dependence) * Number(d.penetration)) / Math.max(1, Number(d.maturity) * Number(d.trust));
const ZONE_DANGER = 2.5, ZONE_CONTROL = 1;
const zoneOf = (t: number) => (t >= ZONE_DANGER ? 'd' : t >= ZONE_CONTROL ? 'c' : 'w');
const ZONE_LABEL: Record<string, string> = { d: 'Danger', c: 'Control', w: 'Watch' };
/** Risk level on the gravity × likelihood grid used for the treatment decision. */
const riskZone = (g: number, v: number) => (g * v >= 9 || (g === 4 && v >= 3) ? 3 : g * v >= 4 ? 2 : 1);
const RISK_ZONE = { 1: 'Acceptable', 2: 'Tolerable under control', 3: 'Unacceptable' } as Record<number, string>;

/* ------------------------------------------------------------------ small atoms */
const Ref = ({ r }: { r?: string | null }) => {
  if (!r) return null;
  const c = r.startsWith('SR') ? 'sr' : r.startsWith('PP') ? 'pp' : r.startsWith('VM') ? 'vm' : r.startsWith('ER') ? 'er' : r.startsWith('BS') ? 'bs' : '';
  return <span className={`eb-ref ${c}`}>{r}</span>;
};
const G = ({ g, label = true }: { g: number; label?: boolean }) => <span className={`eb-g l${g}`} title={`Gravity G${g} · ${GRAVITY[g - 1]?.fr}`}><b>G{g}</b>{label && GRAVITY[g - 1]?.en}</span>;
const V = ({ v, label = true }: { v: number; label?: boolean }) => <span className={`eb-g l${v}`} title={`Likelihood V${v} · ${LIKELIHOOD[v - 1]?.fr}`}><b>V{v}</b>{label && LIKELIHOOD[v - 1]?.en}</span>;
const Pips = ({ n, max = 3, cls = '' }: { n: number; max?: number; cls?: string }) => (
  <span className={`eb-pips ${cls}`} aria-label={`${n} of ${max}`}>{Array.from({ length: max }).map((_, i) => <i key={i} className={i < n ? 'on' : ''} />)}</span>
);

/* ================================================================== page */
export default function Ebios() {
  const { orgId } = useSession();
  const { data, error, loading, reload } = useRpc<Data>('grc_ebios', { p_org: orgId });
  const [sp, setSp] = useSearchParams();
  const w = Math.min(5, Math.max(1, Number(sp.get('w')) || 1));
  const [edit, setEdit] = useState<{ item: Item | null; kind: string; workshop: number } | null>(null);

  const by = useMemo(() => {
    const m: Record<string, Item[]> = {};
    (data?.items ?? []).forEach(i => { (m[i.kind] ??= []).push(i); });
    Object.values(m).forEach(l => l.sort((a, b) => a.sort - b.sort));
    return m;
  }, [data]);
  const L = (k: string) => by[k] ?? [];

  if (loading && !data) return <><PageHead eyebrow="Risk · EBIOS Risk Manager" title="EBIOS RM study" /><Card><Loading rows={8} /></Card></>;
  if (error) return <><PageHead title="EBIOS RM study" /><ErrorBox error={error} /></>;
  if (!data?.study) return <><PageHead title="EBIOS RM study" desc="No EBIOS Risk Manager study has been started for this organisation." /><Card><div className="empty">No study yet.</div></Card></>;

  const s = data.study;
  const can = data.can_manage;
  const open = (kind: string, workshop: number, item: Item | null = null) => setEdit({ kind, workshop, item });

  const stakeholders = L('stakeholder').map(p => ({ ...p, t: threatOf(p.data) }));
  const ppc = new Set([...stakeholders.filter(p => p.t >= ZONE_DANGER).map(p => p.ref), ...L('strategic_scenario').flatMap(x => x.data.via ?? [])]);
  const measures = L('measure');
  const measuresDone = measures.filter(m => m.data.status === 'done').length;
  const residuals = L('residual');
  const pendingAcc = residuals.filter(r => r.data.status === 'pending_acceptance').length;
  const retained = L('risk_source').filter(x => x.data.retained);
  const maxG = Math.max(0, ...L('feared_event').map(e => Number(e.data.gravity) || 0));

  const counts = [
    { done: L('feared_event').length > 0 && L('supporting_asset').length > 0, d: `${L('business_value').length} values · ${L('feared_event').length} feared events` },
    { done: retained.length > 0, d: `${retained.length} of ${L('risk_source').length} SR/OV retained` },
    { done: L('strategic_scenario').length > 0, d: `${stakeholders.length} stakeholders · ${L('strategic_scenario').length} scenarios` },
    { done: L('operational_scenario').length > 0, d: `${L('operational_scenario').length} operational scenarios` },
    { done: measures.length > 0 && measuresDone === measures.length && pendingAcc === 0, d: `PACS ${measuresDone}/${measures.length} done · ${pendingAcc} to accept` },
  ];

  return (
    <>
      <PageHead eyebrow="Risk · EBIOS Risk Manager (ANSSI)" title={s.title}
        desc={s.scope}
        actions={<a className="btn" href="https://cyber.gouv.fr/la-methode-ebios-risk-manager" target="_blank" rel="noreferrer"><BookOpen size={14} />Method guide</a>} />
      <div className="eb-meta" style={{ marginTop: -12, marginBottom: 4 }}>
        <span>Owner <b>{s.owner_role}</b></span><span className="sep" />
        <span>Started <b>{fmtDate(s.started_on)}</b></span><span className="sep" />
        <span>Strategic cycle <b>{s.strategic_cycle_months} months</b> · operational cycle <b>{s.operational_cycle_months} months</b></span><span className="sep" />
        <span>Method <b>EBIOS RM guide v1.5 (ANSSI, 2024)</b></span>
        <Badge tone={s.status === 'in_progress' ? 'info' : 'success'} dot>{s.status === 'in_progress' ? 'Study in progress' : 'Completed'}</Badge>
        <CaseTag>Case-study study</CaseTag>
      </div>

      <div className="stats" style={{ marginTop: 18 }}>
        <Stat k="Highest feared-event gravity" v={maxG ? `G${maxG}` : '—'} d={maxG ? GRAVITY[maxG - 1].en : ''} />
        <Stat k="Retained SR/OV pairs" v={<>{retained.length}<small>/{L('risk_source').length}</small></>} d="Carried into workshop 3" />
        <Stat k="Critical stakeholders" v={ppc.size} d={[...ppc].join(' · ') || 'None in danger zone'} />
        <Stat k="Operational scenarios" v={L('operational_scenario').length} d={`Max likelihood V${Math.max(0, ...L('operational_scenario').map(o => Number(o.data.likelihood) || 0))}`} />
        <Stat k="PACS measures done" v={<>{measuresDone}<small>/{measures.length}</small></>} bar={measures.length ? (measuresDone / measures.length) * 100 : 0} />
        <Stat k="Residual risks to accept" v={pendingAcc} d={`${residuals.length} residual risks in total`} />
      </div>

      <nav className="eb-steps" aria-label="EBIOS RM workshops">
        {WORKSHOPS.map((x, i) => (
          <button key={x.n} className={`eb-step ${w === x.n ? 'on' : ''} ${counts[i].done ? 'done' : ''}`} onClick={() => setSp({ w: String(x.n) })} aria-current={w === x.n ? 'step' : undefined}>
            <span className="n">{counts[i].done && w !== x.n ? '✓' : x.n}</span>
            <span className="fr">{x.fr}</span>
            <span className="en">Workshop {x.n} · {x.en}</span>
            <span className="dl"><i className={counts[i].done ? '' : 'prog'} />{counts[i].d}</span>
          </button>
        ))}
      </nav>

      <div className="eb-intro">
        <div>
          <h2>Workshop {w} — {WORKSHOPS[w - 1].fr}</h2>
          <p>{WORKSHOPS[w - 1].intro}</p>
          <div className="eb-q">{WORKSHOPS[w - 1].q}</div>
        </div>
      </div>

      {w === 1 && <W1 L={L} can={can} open={open} />}
      {w === 2 && <W2 L={L} can={can} open={open} />}
      {w === 3 && <W3 L={L} can={can} open={open} stakeholders={stakeholders} ppc={ppc} />}
      {w === 4 && <W4 L={L} can={can} open={open} risks={data.risks} />}
      {w === 5 && <W5 L={L} can={can} open={open} controls={data.controls} onSaved={reload} />}

      {edit && <ItemEditor data={data} by={by} {...edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
    </>
  );
}

type WProps = { L: (k: string) => Item[]; can: boolean; open: (kind: string, workshop: number, item?: Item | null) => void };
const EditBtn = ({ on }: { on: () => void }) => <button className="iconbtn eb-edit" style={{ width: 26, height: 26 }} onClick={e => { e.stopPropagation(); on(); }} aria-label="Edit"><Pencil size={13} /></button>;
const AddBtn = ({ on, children }: { on: () => void; children: ReactNode }) => <button className="btn sm" onClick={on}><Plus size={13} />{children}</button>;

/* ================================================================== W1 */
function W1({ L, can, open }: WProps) {
  const vms = L('business_value');
  return (
    <div className="stack loose">
      <div className="eb-grid-main">
        <Card title="Missions and business values" sub="Valeurs métier: the processes and information that carry each mission"
          actions={can && <><AddBtn on={() => open('mission', 1)}>Mission</AddBtn><AddBtn on={() => open('business_value', 1)}>Value</AddBtn></>}>
          <div className="eb-missions">
            {L('mission').map(m => (
              <div key={m.id} className="eb-mission">
                <div className="mt"><Ref r={m.ref} /><span className="grow">{m.title}</span>{can && <EditBtn on={() => open('mission', 1, m)} />}</div>
                <div className="eb-vms">
                  {vms.filter(v => v.data.mission === m.ref).map(v => (
                    <div key={v.id} className="eb-vm" onClick={() => can && open('business_value', 1, v)} style={{ cursor: can ? 'pointer' : 'default' }}>
                      <div className="row" style={{ gap: 6 }}><Ref r={v.ref} /><b style={{ fontWeight: 550 }}>{v.title}</b></div>
                      <div className="c">{v.data.nature} · {v.data.criterion} · {v.data.owner}</div>
                    </div>
                  ))}
                  {vms.filter(v => v.data.mission === m.ref).length === 0 && <span className="xs muted">No business value linked yet.</span>}
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Gravity scale" sub="Échelle de gravité used to rate feared events">
          <div className="eb-scale">
            {GRAVITY.map(g => <div key={g.n} className={`s${g.n}`}><b>G{g.n} · {g.fr}</b>{g.d}</div>)}
          </div>
        </Card>
      </div>

      <Card title="Supporting assets" sub="Biens supports: which assets carry which business values" flush
        actions={can && <AddBtn on={() => open('supporting_asset', 1)}>Supporting asset</AddBtn>}>
        <div className="table-wrap">
          <table className="t eb-matrix">
            <thead><tr><th>Supporting asset</th><th>Type</th>{vms.map(v => <th key={v.id} className="dotc" title={v.title}><Ref r={v.ref} /></th>)}<th style={{ width: 40 }} /></tr></thead>
            <tbody>{L('supporting_asset').map(b => (
              <tr key={b.id}>
                <td><div className="row" style={{ gap: 8 }}><Ref r={b.ref} /><span className="cell-title">{b.title}</span></div>{b.data.asset_id && <div className="cell-sub mono">{b.data.asset_id}</div>}</td>
                <td className="small muted">{b.data.type}</td>
                {vms.map(v => <td key={v.id} className="dotc"><span className={`eb-dot ${(b.data.values ?? []).includes(v.ref) ? '' : 'off'}`} /></td>)}
                <td>{can && <EditBtn on={() => open('supporting_asset', 1, b)} />}</td>
              </tr>))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Feared events" sub="Événements redoutés, rated on the gravity scale" flush
        actions={can && <AddBtn on={() => open('feared_event', 1)}>Feared event</AddBtn>}>
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th style={{ width: 60 }}>Ref</th><th>Feared event</th><th>Business value</th><th>Impacts</th><th>Gravity</th><th style={{ width: 40 }} /></tr></thead>
            <tbody>{[...L('feared_event')].sort((a, b) => b.data.gravity - a.data.gravity || a.sort - b.sort).map(e => {
              const v = vms.find(x => x.ref === e.data.value);
              return (
                <tr key={e.id}>
                  <td><Ref r={e.ref} /></td>
                  <td className="cell-title">{e.title}</td>
                  <td className="small"><div className="row" style={{ gap: 6 }}><Ref r={e.data.value} /><span className="muted">{v?.title}</span></div></td>
                  <td><div className="eb-impacts">{(e.data.impacts ?? []).map((x: string) => <span key={x}>{x}</span>)}</div></td>
                  <td><G g={Number(e.data.gravity)} /></td>
                  <td>{can && <EditBtn on={() => open('feared_event', 1, e)} />}</td>
                </tr>);
            })}</tbody>
          </table>
        </div>
      </Card>

      <Card title="Security baseline" sub="Socle de sécurité: conformity of the scope to the applicable frameworks"
        actions={can && <AddBtn on={() => open('baseline', 1)}>Framework</AddBtn>}>
        <div className="eb-base">
          {L('baseline').map(b => (
            <div key={b.id} className="b">
              <div className="h"><b>{b.ref}</b><span className="row" style={{ gap: 4 }}>
                <Badge tone={b.data.status === 'Applied' ? 'success' : b.data.status === 'Partial' ? 'warning' : 'critical'} dot>{b.data.status}</Badge>
                {can && <EditBtn on={() => open('baseline', 1, b)} />}</span></div>
              <div className="t">{b.title}</div>
              {(b.data.gaps ?? []).length > 0
                ? <ul>{b.data.gaps.map((g: string) => <li key={g}>{g}</li>)}</ul>
                : <div className="xs" style={{ color: 'var(--pass-2)', marginTop: 8 }}>No gap identified</div>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ================================================================== W2 */
function W2({ L, can, open }: WProps) {
  const rows = [...L('risk_source')].sort((a, b) => Number(b.data.retained) - Number(a.data.retained) || b.data.relevance - a.data.relevance);
  return (
    <div className="stack loose">
      <Card title="Risk source / target objective pairs" sub="Couples SR/OV — motivation, resources and activity rated 1 (low) to 3 (high)" flush
        actions={can && <AddBtn on={() => open('risk_source', 2)}>SR/OV pair</AddBtn>}>
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th style={{ width: 56 }}>SR</th><th>Risk source</th><th>Target objective (OV)</th><th>Motivation</th><th>Resources</th><th>Activity</th><th>Relevance</th><th>Decision</th><th style={{ width: 40 }} /></tr></thead>
            <tbody>{rows.map(r => (
              <tr key={r.id} className={r.data.retained ? '' : 'eb-out'}>
                <td><Ref r={r.ref} /></td>
                <td><span className="cell-title">{r.title}</span></td>
                <td className="small" style={{ maxWidth: 320 }}>{r.data.objective}</td>
                <td><Pips n={r.data.motivation} cls="hot" /></td>
                <td><Pips n={r.data.resources} cls="warm" /></td>
                <td><Pips n={r.data.activity} cls="cool" /></td>
                <td><span className="eb-rel"><span className="track"><i style={{ width: `${(r.data.relevance / 3) * 100}%` }} /></span><b>{r.data.relevance}/3</b></span></td>
                <td>{r.data.retained
                  ? <Badge tone="critical" dot>Retained</Badge>
                  : <span title={`Relevance ${r.data.relevance}/3: motivation ${r.data.motivation}/3 and activity ${r.data.activity}/3 are too low to justify a strategic scenario. Kept under watch.`}><Badge tone="muted">Not retained</Badge></span>}</td>
                <td>{can && <EditBtn on={() => open('risk_source', 2, r)} />}</td>
              </tr>))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="eb-grid2">
        <Card title="Why these pairs are retained">
          <div className="stack tight small">
            {L('risk_source').filter(r => r.data.retained).map(r => (
              <div key={r.id} className="row top" style={{ gap: 8 }}><Ref r={r.ref} /><div><b style={{ fontWeight: 550 }}>{r.title}</b> — relevance {r.data.relevance}/3. {r.data.objective}.</div></div>
            ))}
          </div>
        </Card>
        <Card title="Why the others are not">
          <div className="stack tight small">
            {L('risk_source').filter(r => !r.data.retained).map(r => (
              <div key={r.id} className="row top" style={{ gap: 8 }}><Ref r={r.ref} /><div><b style={{ fontWeight: 550 }}>{r.title}</b> — relevance {r.data.relevance}/3: motivation {r.data.motivation}/3 and activity {r.data.activity}/3 do not justify a strategic scenario at this cycle. Re-examined at the next strategic cycle.</div></div>
            ))}
            {L('risk_source').every(r => r.data.retained) && <span className="muted">All identified pairs are retained.</span>}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ================================================================== W3 */
function Radar({ list, ppc, sel, onSel }: { list: (Item & { t: number })[]; ppc: Set<string>; sel: string | null; onSel: (r: string) => void }) {
  const W = 620, H = 560, cx = W / 2, cy = H / 2 + 6, R = 236;
  const cats = [...new Set(list.map(p => p.data.category as string))];
  const rOf = (t: number) => R * Math.max(0.1, 1 - Math.min(t, 4) / 4);
  const rD = rOf(ZONE_DANGER), rC = rOf(ZONE_CONTROL);
  const sectorAngle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(1, cats.length);
  // place nodes within their category sector, spreading siblings
  const nodes = list.map(p => {
    const ci = cats.indexOf(p.data.category);
    const sibs = list.filter(x => x.data.category === p.data.category);
    const k = sibs.indexOf(p);
    const span = (2 * Math.PI) / Math.max(1, cats.length);
    const a = sectorAngle(ci) + span * (0.5 + (k - (sibs.length - 1) / 2) * 0.3);
    const r = rOf(p.t);
    const exposure = Number(p.data.dependence) * Number(p.data.penetration);
    return { p, x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), size: 9 + exposure * 0.9, z: zoneOf(p.t) };
  });
  return (
    <svg className="eb-radar" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Digital threat map of the ecosystem">
      <circle cx={cx} cy={cy} r={R} className="zone-w" />
      <circle cx={cx} cy={cy} r={rC} className="zone-c" />
      <circle cx={cx} cy={cy} r={rD} className="zone-d" />
      {[0.25, 0.5, 0.75].map(f => <circle key={f} cx={cx} cy={cy} r={R * f} className="ring" />)}
      {cats.map((c, i) => {
        const a = sectorAngle(i);
        const lx = cx + (R + 22) * Math.cos(a + Math.PI / cats.length), ly = cy + (R + 22) * Math.sin(a + Math.PI / cats.length);
        return (
          <g key={c}>
            <line x1={cx} y1={cy} x2={cx + R * Math.cos(a)} y2={cy + R * Math.sin(a)} className="axis" />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="sector">{c}</text>
          </g>
        );
      })}
      <text x={cx} y={cy - R + 14} textAnchor="middle" className="zl w">WATCH</text>
      <text x={cx} y={cy - rC + 14} textAnchor="middle" className="zl c">CONTROL</text>
      <text x={cx} y={cy - rD + 14} textAnchor="middle" className="zl d">DANGER</text>
      <text x={cx} y={cy + 4} textAnchor="middle" className="center">NT</text>
      {nodes.map(({ p, x, y, size, z }) => {
        const isPpc = ppc.has(p.ref ?? '');
        const right = x >= cx;
        return (
          <g key={p.id} className={`pp ${z}`} onClick={() => onSel(p.ref ?? '')} opacity={sel && sel !== p.ref ? 0.45 : 1}>
            {isPpc && <circle cx={x} cy={y} r={size + 6} className="ppc" />}
            <circle cx={x} cy={y} r={size} className="b" />
            <text x={x} y={y + 3.5} textAnchor="middle" className="ref">{p.ref}</text>
            <text x={right ? x + size + 9 : x - size - 9} y={y - 2} textAnchor={right ? 'start' : 'end'}>{p.title}</text>
            <text x={right ? x + size + 9 : x - size - 9} y={y + 12} textAnchor={right ? 'start' : 'end'} className="sub">threat {p.t.toFixed(2)}{isPpc ? ' · PPC' : ''}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Chain({ ss, L }: { ss: Item; L: (k: string) => Item[] }) {
  const sr = L('risk_source').find(x => x.ref === ss.data.source);
  const via = (ss.data.via ?? []).map((r: string) => L('stakeholder').find(x => x.ref === r)).filter(Boolean) as Item[];
  const bsRefs: string[] = [...new Set<string>(String(ss.data.path ?? '').match(/BS\d+/g) ?? [])];
  const bs = bsRefs.map(r => L('supporting_asset').find(x => x.ref === r)).filter(Boolean) as Item[];
  const ers = (ss.data.feared ?? []).map((r: string) => L('feared_event').find(x => x.ref === r)).filter(Boolean) as Item[];
  const Node = ({ cls, k, r, v }: { cls: string; k: string; r?: string | null; v: ReactNode }) => (
    <div className={`eb-node ${cls}`}><div className="k row" style={{ gap: 5 }}>{k}<Ref r={r} /></div><div className="v">{v}</div></div>
  );
  return (
    <div className="eb-path">
      <Node cls="sr" k="Risk source" r={sr?.ref} v={sr?.title ?? ss.data.source} />
      <span className="eb-arrow hot" />
      {via.length > 0 && <>{via.map(p => <div key={p.id} className="eb-stack"><Node cls="pp" k="Via stakeholder" r={p.ref} v={p.title} /></div>)}<span className="eb-arrow hot" /></>}
      {bs.length > 0 && <><div className="eb-stack">{bs.map(b => <Node key={b.id} cls="bs" k="Supporting asset" r={b.ref} v={b.title} />)}</div><span className="eb-arrow hot" /></>}
      <div className="eb-stack">{ers.map(e => <Node key={e.id} cls="er" k={`Feared event · G${e.data.gravity}`} r={e.ref} v={e.title} />)}</div>
    </div>
  );
}

function W3({ L, can, open, stakeholders, ppc }: WProps & { stakeholders: (Item & { t: number })[]; ppc: Set<string> }) {
  const [sel, setSel] = useState<string | null>(null);
  const sorted = [...stakeholders].sort((a, b) => b.t - a.t);
  return (
    <div className="stack loose">
      <Card title="Digital threat map of the ecosystem" sub="Cartographie de la menace numérique — the closer to the centre, the more dangerous the stakeholder" flush
        actions={can && <AddBtn on={() => open('stakeholder', 3)}>Stakeholder</AddBtn>}>
        <div className="eb-radar-wrap">
          <div style={{ padding: '6px 10px' }}><Radar list={stakeholders} ppc={ppc} sel={sel} onSel={r => setSel(sel === r ? null : r)} /></div>
          <div className="eb-side">
            <div className="eb-formula">Threat = <code>(dependence × penetration) ÷ (maturity × trust)</code><br />Danger ≥ {ZONE_DANGER} · Control ≥ {ZONE_CONTROL} · Watch below. Dashed ring = critical stakeholder (PPC).</div>
            {sorted.map(p => (
              <div key={p.id} className={`row-pp ${sel === p.ref ? 'on' : ''}`} onClick={() => setSel(sel === p.ref ? null : p.ref)}>
                <span className="nm"><Ref r={p.ref} />{p.title}{ppc.has(p.ref ?? '') && <Badge tone="critical">PPC</Badge>}</span>
                <span className="tv" style={{ color: p.t >= ZONE_DANGER ? 'var(--crit-2)' : p.t >= ZONE_CONTROL ? 'var(--high)' : 'var(--pass-2)' }}>{p.t.toFixed(2)}</span>
                <span className="sub">{p.data.category} · {ZONE_LABEL[zoneOf(p.t)]} zone · D{p.data.dependence} P{p.data.penetration} M{p.data.maturity} T{p.data.trust}
                  {can && <> · <a href="#" onClick={e => { e.preventDefault(); e.stopPropagation(); open('stakeholder', 3, p); }}>edit</a></>}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card title="Strategic scenarios" sub="From the risk source, through the ecosystem, to the feared event" flush
        actions={can && <AddBtn on={() => open('strategic_scenario', 3)}>Strategic scenario</AddBtn>}>
        {L('strategic_scenario').map(ss => (
          <div key={ss.id} className="eb-ss">
            <div className="hd"><Ref r={ss.ref} /><span className="tt">{ss.title}</span><G g={Number(ss.data.gravity)} />{can && <EditBtn on={() => open('strategic_scenario', 3, ss)} />}</div>
            <Chain ss={ss} L={L} />
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ================================================================== W4 */
function W4({ L, can, open, risks }: WProps & { risks: Data['risks'] }) {
  return (
    <div className="stack loose">
      <Card title="Operational scenarios" sub="Attack sequences on supporting assets, rated on the likelihood scale" flush
        actions={can && <AddBtn on={() => open('operational_scenario', 4)}>Operational scenario</AddBtn>}>
        <div className="eb-kc-head"><span>Scenario</span>{PHASES.map(p => <span key={p.k}>{p.k} · {p.fr}<small>{p.d}</small></span>)}</div>
        {L('operational_scenario').map(o => {
          const ss = L('strategic_scenario').find(x => x.ref === o.data.strategic);
          const steps: any[] = o.data.steps ?? [];
          return (
            <div key={o.id} className="eb-kc">
              <div className="sc">
                <div className="row" style={{ gap: 6 }}><Ref r={o.ref} /><span className="xs muted">from</span><Ref r={o.data.strategic} />{can && <EditBtn on={() => open('operational_scenario', 4, o)} />}</div>
                <div className="tt">{o.title}</div>
                <div className="row wrap" style={{ gap: 6 }}><V v={Number(o.data.likelihood)} />{ss && <G g={Number(ss.data.gravity)} label={false} />}</div>
                <div className="eb-chips" style={{ marginTop: 8 }}>
                  {(o.data.risks ?? []).map((rid: string) => { const r = risks.find(x => x.id === rid); return r ? <Link key={rid} to={`/risks?r=${rid}`} title={r.title}><Badge tone="neutral">{r.code} · {r.score}</Badge></Link> : null; })}
                </div>
              </div>
              {PHASES.map((p, i) => {
                const st = steps.find(x => x.phase === p.k);
                return <div key={p.k} className={`step p${i + 1}`}><span className="num">{i + 1}</span><div className="ph">{p.k} · {p.fr}</div>{st?.text ?? <span className="muted">—</span>}</div>;
              })}
            </div>
          );
        })}
      </Card>
      <Card title="Likelihood scale" sub="Échelle de vraisemblance">
        <div className="eb-scale">{LIKELIHOOD.map(v => <div key={v.n} className={`s${v.n}`}><b>V{v.n} · {v.fr}</b>{v.en}</div>)}</div>
      </Card>
    </div>
  );
}

/* ================================================================== W5 */
function RiskMap({ residuals }: { residuals: Item[] }) {
  const pad = 46, cell = 92, W = pad + cell * 4 + 18, H = 24 + cell * 4 + 46;
  const X = (v: number) => pad + (v - 1) * cell, Y = (g: number) => 24 + (4 - g) * cell;
  const groups: Record<string, number> = {};
  const off = (k: string) => { const n = groups[k] ?? 0; groups[k] = n + 1; return n; };
  return (
    <svg className="eb-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Risk map, gravity by likelihood, before and after treatment">
      <defs><marker id="ebArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="var(--text-3)" /></marker></defs>
      {[1, 2, 3, 4].map(g => [1, 2, 3, 4].map(v => <rect key={`${g}${v}`} x={X(v)} y={Y(g)} width={cell} height={cell} rx={8} className={`cell z${riskZone(g, v)}`} />))}
      {[1, 2, 3, 4].map(g => <text key={g} x={pad - 10} y={Y(g) + cell / 2 + 4} textAnchor="end" className="ax">G{g}</text>)}
      {[1, 2, 3, 4].map(v => <text key={v} x={X(v) + cell / 2} y={24 + cell * 4 + 16} textAnchor="middle" className="ax">V{v}</text>)}
      <text x={pad + cell * 2} y={H - 6} textAnchor="middle" className="axt">Likelihood (vraisemblance) →</text>
      <text x={12} y={24 + cell * 2} textAnchor="middle" className="axt" transform={`rotate(-90 12 ${24 + cell * 2})`}>Gravity →</text>
      {residuals.map(r => {
        const d = r.data;
        const ob = off(`${d.gravity_before}-${d.likelihood_before}`), oa = off(`${d.gravity_after}-${d.likelihood_after}`);
        const bx = X(d.likelihood_before) + 24 + ob * 30, by = Y(d.gravity_before) + 26 + (ob % 2) * 36;
        const ax = X(d.likelihood_after) + 24 + oa * 30, ay = Y(d.gravity_after) + 66 - (oa % 2) * 36;
        const dx = ax - bx, dy = ay - by, len = Math.hypot(dx, dy) || 1;
        return (
          <g key={r.id}>
            <path d={`M${bx + (dx / len) * 15} ${by + (dy / len) * 15} L${ax - (dx / len) * 16} ${ay - (dy / len) * 16}`} className="arrow" />
            <circle cx={bx} cy={by} r={13} className="before" /><text x={bx} y={by + 3.5} textAnchor="middle" className="ptxt b">{d.scenario}</text>
            <circle cx={ax} cy={ay} r={13} className="after" /><text x={ax} y={ay + 3.5} textAnchor="middle" className="ptxt a">{d.scenario}</text>
          </g>
        );
      })}
    </svg>
  );
}

function W5({ L, can, open, controls, onSaved }: WProps & { controls: Data['controls']; onSaved: () => void }) {
  const { orgId } = useSession();
  const toast = useToast();
  const [decide, setDecide] = useState<Item | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const residuals = L('residual');
  const today = new Date().toISOString().slice(0, 10);

  async function record(status: 'accepted' | 'refused') {
    if (!decide) return;
    if (!note.trim()) { toast('err', 'Write the justification for this decision.'); return; }
    setBusy(true);
    try {
      await rpc('grc_ebios_item_save', { p_org: orgId, p_id: decide.id, p: { title: decide.title, ref: decide.ref, data: { ...decide.data, status, decision: note.trim() } } });
      toast('ok', status === 'accepted' ? 'Residual risk acceptance recorded in the audit ledger' : 'Decision recorded: treat further');
      setDecide(null); setNote(''); onSaved();
    } catch (e: any) { toast('err', e.message); } finally { setBusy(false); }
  }

  return (
    <div className="stack loose">
      <div className="eb-grid-main">
        <Card title="Risk map — initial and residual" sub="Each strategic scenario before treatment (outline) and after the PACS (filled)" flush>
          <div style={{ padding: '14px 16px 6px' }}><RiskMap residuals={residuals} /></div>
          <div className="eb-legend">
            <span><i style={{ background: 'var(--crit-wash)', border: '1px solid var(--crit-line)' }} />{RISK_ZONE[3]}</span>
            <span><i style={{ background: 'var(--medium-wash)', border: '1px solid var(--medium-line)' }} />{RISK_ZONE[2]}</span>
            <span><i style={{ background: 'var(--pass-wash)', border: '1px solid var(--pass-line)' }} />{RISK_ZONE[1]}</span>
            <span><i style={{ borderRadius: '50%', border: '2px solid var(--crit-2)' }} />Initial</span>
            <span><i style={{ borderRadius: '50%', background: 'var(--pass)' }} />Residual</span>
          </div>
        </Card>
        <Card title="Residual risks" sub="Decision on each scenario after treatment" flush
          actions={can && <AddBtn on={() => open('residual', 5)}>Residual risk</AddBtn>}>
          {residuals.map(r => {
            const d = r.data; const st = RESIDUAL_STATUS[d.status] ?? { l: d.status, t: 'neutral' };
            const z0 = riskZone(d.gravity_before, d.likelihood_before), z1 = riskZone(d.gravity_after, d.likelihood_after);
            return (
              <div key={r.id} className="eb-res">
                <div>
                  <div className="row" style={{ gap: 6 }}><Ref r={r.ref} /><span className="tt">{r.title}</span>{can && <EditBtn on={() => open('residual', 5, r)} />}</div>
                  <div className="mv" style={{ marginTop: 5 }}>
                    <span className="row nowrap" style={{ gap: 5 }}><G g={d.gravity_before} label={false} /><V v={d.likelihood_before} label={false} /><span className="xs">{RISK_ZONE[z0]}</span></span>
                    <span>→</span>
                    <span className="row nowrap" style={{ gap: 5 }}><G g={d.gravity_after} label={false} /><V v={d.likelihood_after} label={false} /><span className="xs" style={{ color: z1 === 1 ? 'var(--pass-2)' : z1 === 2 ? 'var(--medium)' : 'var(--crit-2)' }}>{RISK_ZONE[z1]}</span></span>
                  </div>
                </div>
                <div className="stack tight" style={{ alignItems: 'flex-end' }}>
                  <Badge tone={st.t} dot>{st.l}</Badge>
                  {can && d.status === 'pending_acceptance' && <button className="btn sm" onClick={() => { setDecide(r); setNote(d.decision ?? ''); }}><CheckCircle2 size={13} />Record decision</button>}
                </div>
                <div className="dec">{d.decision}</div>
              </div>
            );
          })}
          <div className="eb-formula" style={{ borderBottom: 0, borderTop: '1px solid var(--border)' }}>
            Acceptance criteria used in this study: <b>acceptable</b> when gravity × likelihood ≤ 3; <b>tolerable under control</b> from 4 to 8; <b>unacceptable</b> at 9 or more, or G4 with likelihood V3+. Residual risk must be explicitly accepted by the accountable owner.
          </div>
        </Card>
      </div>

      <Card title="Security improvement plan (PACS)" sub="Plan d'amélioration continue de la sécurité — measures, owners, deadlines" flush
        actions={can && <AddBtn on={() => open('measure', 5)}>Measure</AddBtn>}>
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th style={{ width: 56 }}>Ref</th><th>Measure</th><th>Owner</th><th>Controls</th><th>Scenarios</th><th>Cost</th><th>Complexity</th><th>Deadline</th><th>Status</th><th style={{ width: 40 }} /></tr></thead>
            <tbody>{L('measure').map(m => {
              const d = m.data; const st = MEASURE_STATUS[d.status] ?? { l: d.status, t: 'neutral' };
              const late = d.status !== 'done' && d.deadline && d.deadline < today;
              return (
                <tr key={m.id}>
                  <td><span className="eb-ref">{m.ref}</span></td>
                  <td className="cell-title" style={{ minWidth: 220 }}>{m.title}</td>
                  <td className="small">{d.owner}</td>
                  <td><div className="eb-chips">{(d.controls ?? []).map((cid: string) => { const c = controls.find(x => x.id === cid); return <Link key={cid} to={`/controls?c=${cid}`} title={c?.title}><Badge tone={c?.operating_eff === 'effective' ? 'success' : c?.operating_eff === 'partial' ? 'warning' : 'neutral'}>{c?.code ?? cid}</Badge></Link>; })}</div></td>
                  <td><div className="eb-chips">{(d.scenarios ?? []).map((x: string) => <span key={x} className="eb-ref">{x}</span>)}</div></td>
                  <td><span className="eb-cost" title={`Cost ${d.cost}/3`}>{'€'.repeat(d.cost)}<span>{'€'.repeat(3 - d.cost)}</span></span></td>
                  <td><Pips n={d.complexity} /></td>
                  <td className={`small nowrap ${late ? 'eb-od' : ''}`}>{fmtDate(d.deadline)}{late && ' · overdue'}</td>
                  <td><Badge tone={st.t} dot>{st.l}</Badge></td>
                  <td>{can && <EditBtn on={() => open('measure', 5, m)} />}</td>
                </tr>);
            })}</tbody>
          </table>
        </div>
      </Card>

      {decide && (
        <Modal title={`Decision on residual risk ${decide.ref}`} sub={decide.title} onClose={() => setDecide(null)}
          footer={<>
            <button className="btn" onClick={() => setDecide(null)}>Cancel</button>
            <button className="btn danger-ghost" disabled={busy} onClick={() => record('refused')}>Do not accept — treat further</button>
            <button className="btn primary" disabled={busy} onClick={() => record('accepted')}><CheckCircle2 size={14} />Accept residual risk</button>
          </>}>
          <div className="stack">
            <Notice kind="info">Your decision is written to the hash-chained audit ledger under your name and role. In EBIOS RM, formal acceptance of residual risk belongs to the accountable executive (homologation); record here who decided and on what basis.</Notice>
            <div className="row wrap" style={{ gap: 8 }}>
              <span className="small muted">Residual position</span><G g={decide.data.gravity_after} /><V v={decide.data.likelihood_after} />
              <Badge tone={riskZone(decide.data.gravity_after, decide.data.likelihood_after) === 3 ? 'critical' : riskZone(decide.data.gravity_after, decide.data.likelihood_after) === 2 ? 'warning' : 'success'}>{RISK_ZONE[riskZone(decide.data.gravity_after, decide.data.likelihood_after)]}</Badge>
            </div>
            <Field label="Justification" help="Which measures this relies on, who decided, and when it will be reviewed.">
              <textarea className="textarea" value={note} onChange={e => setNote(e.target.value)} />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ================================================================== generic item editor */
type FieldDef = { k: string; label: string; type: 'text' | 'textarea' | 'select' | 'scale' | 'bool' | 'multi' | 'lines' | 'date' | 'steps'; max?: number; options?: () => { v: string; l: string }[]; help?: string };

function ItemEditor({ data, by, item, kind, workshop, onClose, onSaved }: { data: Data; by: Record<string, Item[]>; item: Item | null; kind: string; workshop: number; onClose: () => void; onSaved: () => void }) {
  const { orgId } = useSession();
  const toast = useToast();
  const refsOf = (k: string) => () => (by[k] ?? []).map(x => ({ v: x.ref ?? x.id, l: `${x.ref} · ${x.title}` }));
  const SCHEMA: Record<string, { label: string; prefix: string; fields: FieldDef[] }> = {
    mission: { label: 'Mission', prefix: 'M', fields: [] },
    business_value: { label: 'Business value', prefix: 'VM', fields: [
      { k: 'mission', label: 'Mission', type: 'select', options: refsOf('mission') },
      { k: 'nature', label: 'Nature', type: 'select', options: () => ['Process', 'Information'].map(v => ({ v, l: v })) },
      { k: 'criterion', label: 'Security criterion', type: 'select', options: () => ['Availability', 'Integrity', 'Confidentiality', 'Integrity / traceability'].map(v => ({ v, l: v })) },
      { k: 'owner', label: 'Owner', type: 'text' }] },
    supporting_asset: { label: 'Supporting asset', prefix: 'BS', fields: [
      { k: 'type', label: 'Type', type: 'text' }, { k: 'asset_id', label: 'Asset inventory ID', type: 'text', help: 'Optional, e.g. NT-AST-ERP' },
      { k: 'values', label: 'Business values carried', type: 'multi', options: refsOf('business_value') }] },
    feared_event: { label: 'Feared event', prefix: 'ER', fields: [
      { k: 'value', label: 'Business value affected', type: 'select', options: refsOf('business_value') },
      { k: 'gravity', label: 'Gravity', type: 'scale', max: 4, help: 'G1 Minor · G2 Significant · G3 Serious · G4 Critical' },
      { k: 'impacts', label: 'Impacts', type: 'lines', help: 'One impact per line' }] },
    baseline: { label: 'Baseline framework', prefix: '', fields: [
      { k: 'status', label: 'Status', type: 'select', options: () => ['Applied', 'Partial', 'Not applied'].map(v => ({ v, l: v })) },
      { k: 'gaps', label: 'Gaps', type: 'lines', help: 'One gap per line' }] },
    risk_source: { label: 'SR/OV pair', prefix: 'SR', fields: [
      { k: 'objective', label: 'Target objective (OV)', type: 'textarea' },
      { k: 'motivation', label: 'Motivation', type: 'scale', max: 3 }, { k: 'resources', label: 'Resources', type: 'scale', max: 3 },
      { k: 'activity', label: 'Activity', type: 'scale', max: 3 }, { k: 'relevance', label: 'Relevance', type: 'scale', max: 3 },
      { k: 'retained', label: 'Retained for workshop 3', type: 'bool' }] },
    stakeholder: { label: 'Stakeholder', prefix: 'PP', fields: [
      { k: 'category', label: 'Category', type: 'select', options: () => ['Supplier', 'Partner', 'Client', 'Financial partner'].map(v => ({ v, l: v })) },
      { k: 'dependence', label: 'Dependence', type: 'scale', max: 4 }, { k: 'penetration', label: 'Penetration', type: 'scale', max: 4 },
      { k: 'maturity', label: 'Cyber maturity', type: 'scale', max: 4 }, { k: 'trust', label: 'Trust', type: 'scale', max: 4 }] },
    strategic_scenario: { label: 'Strategic scenario', prefix: 'SS', fields: [
      { k: 'source', label: 'Risk source', type: 'select', options: () => (by.risk_source ?? []).filter(x => x.data.retained).map(x => ({ v: x.ref ?? '', l: `${x.ref} · ${x.title}` })) },
      { k: 'via', label: 'Through stakeholders', type: 'multi', options: refsOf('stakeholder') },
      { k: 'feared', label: 'Feared events', type: 'multi', options: refsOf('feared_event') },
      { k: 'gravity', label: 'Gravity', type: 'scale', max: 4 },
      { k: 'path', label: 'Attack path', type: 'textarea', help: 'Mention supporting assets by reference (BS1, BS2…) to draw the chain.' }] },
    operational_scenario: { label: 'Operational scenario', prefix: 'SO', fields: [
      { k: 'strategic', label: 'Strategic scenario', type: 'select', options: refsOf('strategic_scenario') },
      { k: 'likelihood', label: 'Likelihood', type: 'scale', max: 4, help: 'V1 Unlikely · V2 Likely · V3 Very likely · V4 Almost certain' },
      { k: 'risks', label: 'Linked register risks', type: 'multi', options: () => data.risks.map(r => ({ v: r.id, l: `${r.code} · ${r.title}` })) },
      { k: 'steps', label: 'Attack sequence', type: 'steps' }] },
    measure: { label: 'PACS measure', prefix: 'PM', fields: [
      { k: 'owner', label: 'Owner', type: 'text' },
      { k: 'controls', label: 'Controls', type: 'multi', options: () => data.controls.map(c => ({ v: c.id, l: c.code })) },
      { k: 'scenarios', label: 'Scenarios treated', type: 'multi', options: refsOf('strategic_scenario') },
      { k: 'cost', label: 'Cost', type: 'scale', max: 3 }, { k: 'complexity', label: 'Complexity', type: 'scale', max: 3 },
      { k: 'deadline', label: 'Deadline', type: 'date' },
      { k: 'status', label: 'Status', type: 'select', options: () => Object.entries(MEASURE_STATUS).map(([v, x]) => ({ v, l: x.l })) }] },
    residual: { label: 'Residual risk', prefix: 'RR', fields: [
      { k: 'scenario', label: 'Strategic scenario', type: 'select', options: refsOf('strategic_scenario') },
      { k: 'gravity_before', label: 'Gravity before', type: 'scale', max: 4 }, { k: 'likelihood_before', label: 'Likelihood before', type: 'scale', max: 4 },
      { k: 'gravity_after', label: 'Gravity after', type: 'scale', max: 4 }, { k: 'likelihood_after', label: 'Likelihood after', type: 'scale', max: 4 },
      { k: 'decision', label: 'Decision / rationale', type: 'textarea' },
      { k: 'status', label: 'Status', type: 'select', options: () => Object.entries(RESIDUAL_STATUS).map(([v, x]) => ({ v, l: x.l })) }] },
  };
  const sch = SCHEMA[kind];
  const nextRef = () => {
    if (!sch.prefix) return '';
    const n = Math.max(0, ...(by[kind] ?? []).map(x => Number(String(x.ref ?? '').replace(/\D/g, '')) || 0)) + 1;
    return `${sch.prefix}${n}`;
  };
  const [title, setTitle] = useState(item?.title ?? '');
  const [ref, setRef] = useState(item?.ref ?? nextRef());
  const [d, setD] = useState<any>(() => {
    const base = { ...(item?.data ?? {}) };
    sch.fields.forEach(f => {
      if (base[f.k] !== undefined) return;
      base[f.k] = f.type === 'scale' ? 1 : f.type === 'bool' ? false : f.type === 'multi' || f.type === 'lines' ? [] : f.type === 'steps' ? PHASES.map(p => ({ phase: p.k, text: '' })) : f.type === 'select' ? (f.options?.()[0]?.v ?? '') : '';
    });
    return base;
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setD((x: any) => ({ ...x, [k]: v }));

  async function save() {
    setErr(null);
    if (!title.trim()) return setErr('A title is required.');
    for (const f of sch.fields) {
      if (f.type === 'scale' && !(Number(d[f.k]) >= 1 && Number(d[f.k]) <= (f.max ?? 4))) return setErr(`${f.label} must be between 1 and ${f.max}.`);
      if (f.type === 'select' && !d[f.k]) return setErr(`Choose a value for ${f.label.toLowerCase()}.`);
    }
    if (kind === 'strategic_scenario' && (d.feared ?? []).length === 0) return setErr('Link at least one feared event.');
    if (kind === 'operational_scenario' && (d.steps ?? []).every((s: any) => !s.text?.trim())) return setErr('Describe at least one step of the attack sequence.');
    if (kind === 'residual' && (d.gravity_after > d.gravity_before || d.likelihood_after > d.likelihood_before)) return setErr('Residual gravity and likelihood cannot exceed the initial values.');
    setBusy(true);
    try {
      const clean = { ...d };
      sch.fields.forEach(f => { if (f.type === 'scale') clean[f.k] = Number(clean[f.k]); if (f.type === 'lines') clean[f.k] = (clean[f.k] ?? []).map((s: string) => s.trim()).filter(Boolean); });
      if (kind === 'operational_scenario') clean.steps = (clean.steps ?? []).filter((s: any) => s.text?.trim());
      await rpc('grc_ebios_item_save', { p_org: orgId, p_id: item?.id ?? null, p: { workshop, kind, ref: ref || null, title: title.trim(), data: clean } });
      toast('ok', `${sch.label} ${item ? 'updated' : 'added'} — recorded in the audit ledger`);
      onSaved();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  const input = (f: FieldDef) => {
    const v = d[f.k];
    switch (f.type) {
      case 'text': return <input className="input" value={v ?? ''} onChange={e => set(f.k, e.target.value)} />;
      case 'date': return <input className="input" type="date" value={v ?? ''} onChange={e => set(f.k, e.target.value)} />;
      case 'textarea': return <textarea className="textarea" value={v ?? ''} onChange={e => set(f.k, e.target.value)} />;
      case 'lines': return <textarea className="textarea" value={(v ?? []).join('\n')} onChange={e => set(f.k, e.target.value.split('\n'))} />;
      case 'select': return <select className="select" value={v ?? ''} onChange={e => set(f.k, e.target.value)}>{(f.options?.() ?? []).map(o => <option key={o.v} value={o.v}>{o.l}</option>)}</select>;
      case 'bool': return <label className="check"><input type="checkbox" checked={!!v} onChange={e => set(f.k, e.target.checked)} /><span className="small">{v ? 'Yes' : 'No'}</span></label>;
      case 'scale': return <div className="eb-scalepick">{Array.from({ length: f.max ?? 4 }).map((_, i) => <button type="button" key={i} className={Number(v) === i + 1 ? 'on' : ''} onClick={() => set(f.k, i + 1)}>{i + 1}</button>)}</div>;
      case 'multi': return <div className="eb-multi">{(f.options?.() ?? []).map(o => { const on = (v ?? []).includes(o.v); return <button type="button" key={o.v} className={on ? 'on' : ''} title={o.l} onClick={() => set(f.k, on ? v.filter((x: string) => x !== o.v) : [...(v ?? []), o.v])}>{o.l.length > 34 ? o.l.split(' · ')[0] : o.l}</button>; })}</div>;
      case 'steps': return <div className="stack tight">{PHASES.map(p => {
        const cur = (v ?? []).find((s: any) => s.phase === p.k)?.text ?? '';
        return <div key={p.k}><div className="xs muted" style={{ marginBottom: 3 }}>{p.k} · {p.fr} — {p.d}</div>
          <input className="input" value={cur} onChange={e => set(f.k, [...PHASES.map(q => ({ phase: q.k, text: q.k === p.k ? e.target.value : ((v ?? []).find((s: any) => s.phase === q.k)?.text ?? '') }))])} /></div>;
      })}</div>;
    }
  };
  const scales = sch.fields.filter(f => f.type === 'scale');
  const others = sch.fields.filter(f => f.type !== 'scale');
  return (
    <Drawer title={`${item ? 'Edit' : 'Add'} ${sch.label.toLowerCase()}`} sub={`Workshop ${workshop} · ${WORKSHOPS[workshop - 1].fr}`} onClose={onClose}>
      <div className="eb-form">
        <div className="two" style={{ gridTemplateColumns: '110px 1fr' }}>
          <Field label="Reference"><input className="input mono" value={ref ?? ''} onChange={e => setRef(e.target.value)} /></Field>
          <Field label="Title"><input className="input" value={title} onChange={e => setTitle(e.target.value)} autoFocus /></Field>
        </div>
        {others.map(f => <Field key={f.k} label={f.label} help={f.help}>{input(f)}</Field>)}
        {scales.length > 0 && <div className="two">{scales.map(f => <Field key={f.k} label={f.label} help={f.help}>{input(f)}</Field>)}</div>}
        {kind === 'stakeholder' && (
          <Notice kind="info">Threat level {threatOf(d).toFixed(2)} → {ZONE_LABEL[zoneOf(threatOf(d))]} zone.</Notice>
        )}
        {err && <Notice kind="danger"><ShieldAlert size={14} /> {err}</Notice>}
      </div>
      <div className="eb-form-foot">
        <span className="xs muted">Saved changes are written to the audit ledger.</span>
        <div className="row"><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Saving' : 'Save'}</button></div>
      </div>
    </Drawer>
  );
}
