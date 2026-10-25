import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowUpRight, Siren } from 'lucide-react';
import { useRpc, useSession } from '../lib/session';
import { ago, fmtMoney, fmtTime, initials, statusOf } from '../lib/format';
import { Badge, Status } from '../components/ui';
import { HeatMap } from '../components/Heat';

type Hop = { name: string; label: string; state: 'done' | 'now' | 'next' | 'rejected'; verify?: boolean };

const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function holderOf(org: any, roleName?: string | null) {
  if (!roleName) return null;
  return org.roles.find((r: any) => r.name === roleName)?.holders?.[0] ?? null;
}

function pathOf(a: any, org: any): Hop[] {
  const st = a.status as string;
  const hops: Hop[] = [];
  hops.push({ name: a.people.requested_by?.name, label: 'requested', state: ['draft', 'reopened'].includes(st) ? 'now' : 'done' });
  if (a.type.assessor) {
    const n = a.assessed_by?.name ?? holderOf(org, a.type.assessor);
    hops.push({ name: n, label: 'assesses', state: a.assessed_by ? 'done' : st === 'under_review' ? 'now' : 'next' });
  }
  for (const p of a.approvals.filter((x: any) => x.kind === 'pre')) {
    hops.push({ name: p.decided_by?.name ?? p.eligible?.[0], label: `approves · step ${p.step}`,
      state: p.status === 'approved' ? 'done' : p.status === 'rejected' ? 'rejected' : (p.status === 'pending' || p.status === 'info_requested') && ['awaiting_approval', 'escalated', 'submitted'].includes(st) ? 'now' : 'next' });
  }
  const exName = a.people.executor?.name ?? org.roles.find((r: any) => a.type.executors.includes(r.name) && r.holders.length)?.holders?.[0];
  const executed = a.evidence.some((e: any) => e.kind === 'execution_record' || e.kind === 'device_report');
  hops.push({ name: exName, label: 'executes', state: executed ? 'done' : ['approved', 'scheduled', 'in_progress'].includes(st) ? 'now' : 'next' });
  const verEv = a.timeline.find((t: any) => t.event === 'verification_passed');
  const verName = verEv?.actor ?? (a.assessed_by && a.assessed_by.name !== exName ? a.assessed_by.name : a.people.accountable?.name);
  hops.push({ name: verName, label: 'verifies', state: st === 'completed' ? 'done' : st === 'awaiting_verification' ? 'now' : 'next', verify: true });
  for (const p of a.approvals.filter((x: any) => x.kind === 'post_review')) {
    hops.push({ name: p.decided_by?.name ?? p.eligible?.[0], label: 'reviews emergency', state: p.status === 'approved' ? 'done' : 'now' });
  }
  if (['rejected', 'cancelled'].includes(st)) hops.forEach(h => { if (h.state === 'now') h.state = 'next'; });
  return hops.filter(h => h.name);
}

function layout(org: any, W: number, H: number) {
  const roles: any[] = org.roles;
  const byId: Record<string, any> = Object.fromEntries(roles.map(r => [r.id, r]));
  const depth = (r: any): number => (r.reports_to && byId[r.reports_to] ? 1 + depth(byId[r.reports_to]) : 0);
  const people = org.employees.filter((e: any) => e.active && (e.has_login || e.is_student) && !/auditor/i.test(e.role_id));
  const rows: Record<number, any[]> = {};
  people.forEach((e: any) => { const d = depth(byId[e.role_id] ?? {}); (rows[d] ??= []).push({ ...e, d, parent: byId[e.role_id]?.reports_to }); });
  const pos: Record<string, { x: number; y: number; e: any }> = {};
  const yTop = H * 0.36, yBot = H * 0.84;
  const depths = Object.keys(rows).map(Number).sort();
  depths.forEach((d, di) => {
    const y = depths.length === 1 ? (yTop + yBot) / 2 : yTop + (yBot - yTop) * (di / (depths.length - 1));
    const list = rows[d].sort((a: any, b: any) => {
      const pa = Object.values(pos).find(p => p.e.role_id === a.parent)?.x ?? 0;
      const pb = Object.values(pos).find(p => p.e.role_id === b.parent)?.x ?? 0;
      return pa - pb || a.name.localeCompare(b.name);
    });
    const n = list.length; const span = Math.min(W * 0.9, 150 * (n - 1));
    list.forEach((e: any, i: number) => { pos[e.name] = { x: W / 2 - span / 2 + (n === 1 ? span / 2 : (span * i) / (n - 1)), y, e }; });
  });
  const edges = Object.values(pos).flatMap(p => {
    const parent = Object.values(pos).find(q => q.e.role_id === p.e.parent);
    return parent ? [[parent, p]] : [];
  });
  return { pos, edges };
}

export default function Situation() {
  const { orgId, current } = useSession();
  const nav = useNavigate();
  const org = useRpc<any>('grc_org', { p_org: orgId });
  const acts = useRpc<any[]>('grc_actions', { p_org: orgId }, { poll: 8000 });
  const ov = useRpc<any>('grc_overview', { p_org: orgId }, { poll: 12000 });
  const work = useRpc<any>('grc_my_work', { p_org: orgId }, { poll: 8000 });
  const mine = useMemo(() => new Set((work.data?.tasks ?? []).map((t: any) => t.id)), [work.data]);
  const flights = useMemo(() => {
    const open = (acts.data ?? []).filter(a => !['completed', 'cancelled', 'rejected', 'draft'].includes(a.status));
    const done = (acts.data ?? []).filter(a => a.status === 'completed').slice(0, 2);
    const drafts = (acts.data ?? []).filter(a => a.status === 'draft');
    return [...open.sort((x, y) => Number(mine.has(y.id)) - Number(mine.has(x.id)) || (y.emergency ? 1 : 0) - (x.emergency ? 1 : 0)), ...done, ...drafts];
  }, [acts.data, mine]);
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => { if (!sel && flights.length) setSel(flights[0].id); }, [flights, sel]);
  useEffect(() => { setSel(null); }, [orgId]);
  const detail = useRpc<any>(sel ? 'grc_action' : null, { p_id: sel }, { poll: 6000 });
  const a = detail.data && detail.data.id === sel ? detail.data : null;

  const W = 820, H = 820;
  const g = useMemo(() => (org.data ? layout(org.data, W, H) : null), [org.data]);
  const hops = useMemo(() => (a && org.data ? pathOf(a, org.data) : []), [a, org.data]);
  const holder = hops.find(h => h.state === 'now');
  const nodeState: Record<string, string> = {};
  hops.forEach(h => {
    const prev = nodeState[h.name];
    const s = h.state === 'now' ? 'holder' : h.state === 'done' ? (h.verify ? 'verified' : 'sealed') : h.state === 'rejected' ? 'rejected' : 'involved';
    if (prev !== 'holder') nodeState[h.name] = prev === 'sealed' && s === 'involved' ? prev : s;
  });
  const segs = hops.slice(1).map((h, i) => ({ from: hops[i].name, to: h.name, state: h.state })).filter(s => s.from !== s.to && g?.pos[s.from] && g?.pos[s.to]);
  const curve = (p: any, q: any) => { const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2 - 60; return `M${p.x} ${p.y} Q${mx} ${my} ${q.x} ${q.y}`; };
  const d = ov.data;
  const firstName = holder?.name?.split(' ')[0];
  const isMe = holder?.name === current?.full_name;

  return (
    <div className="situation">
      <aside className="sit-col" aria-label="Decisions in flight">
        <div className="section-title">DECISIONS IN FLIGHT</div>
        {flights.length === 0 && <div className="small muted">No decision is moving. Start a scenario or propose an action.</div>}
        {flights.map(f => (
          <div key={f.id} className={`flight ${sel === f.id ? 'on' : ''}`} onClick={() => setSel(f.id)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setSel(f.id)}>
            <div className="row between top"><div className="t">{f.title}</div>{f.emergency && <Siren size={14} color="var(--critical)" />}</div>
            <div className="s">{f.ref} · {f.type_name}{f.amount != null ? ` · ${fmtMoney(f.amount)}` : ''}</div>
            <div className="who">
              <Status s={f.status} />
              {mine.has(f.id) && <Badge tone="accent">Your move</Badge>}
            </div>
            {f.next?.actor && f.status !== 'completed' && <div className="xs muted" style={{ marginTop: 6 }}>{f.next.title} · {f.next.actor}</div>}
          </div>
        ))}
      </aside>

      <section className="sit-center">
        <div className="sit-title">
          <div className="k">AUTHORITY GRAPH · LIVE · {org.data?.org?.name?.toUpperCase()}</div>
          {a ? (
            holder ? <h1>{isMe ? <>The next decision is <em>yours</em>.</> : <><em>{firstName}</em> holds the next decision.</>}</h1>
              : a.status === 'completed' ? <h1>Sealed, executed and <em>verified</em>.</h1>
              : <h1>{statusOf(a.status).label}.</h1>
          ) : <h1>Every decision has an <em>owner</em>.</h1>}
          {a && <p>{a.ref} · {a.title}{a.amount != null ? ` · ${fmtMoney(a.amount)}` : ''}. {holder ? `${holder.name} ${holder.label}.` : ''}</p>}
        </div>
        {g && (
          <svg className="graph-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Organisation graph with the current decision path">
            <defs>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              <radialGradient id="gFlow" cx="35%" cy="30%"><stop offset="0" stopColor="#4f7ee8" /><stop offset="1" stopColor="#1a2b55" /></radialGradient>
              <radialGradient id="gGold" cx="35%" cy="30%"><stop offset="0" stopColor="#6b5a32" /><stop offset="1" stopColor="#1d180d" /></radialGradient>
              <radialGradient id="gSeal" cx="35%" cy="30%"><stop offset="0" stopColor="#2a8d6a" /><stop offset="1" stopColor="#0e3326" /></radialGradient>
            </defs>
            {g.edges.map(([p, q]: any, i: number) => <line key={i} className="g-edge" x1={p.x} y1={p.y} x2={q.x} y2={q.y} />)}
            {segs.map((s, i) => {
              const path = curve(g.pos[s.from], g.pos[s.to]);
              return (
                <g key={i}>
                  <path d={path} className={s.state === 'done' ? 'g-flow-done' : s.state === 'now' ? 'g-flow-now' : 'g-flow-next'} />
                  {s.state === 'now' && !reduceMotion && <circle r="4" className="g-particle"><animateMotion dur="1.8s" repeatCount="indefinite" path={path} /></circle>}
                </g>
              );
            })}
            {Object.entries(g.pos).map(([name, p]: any) => {
              const st = nodeState[name];
              const r = st === 'holder' ? 34 : st ? 27 : 22;
              const hop = hops.find(h => h.name === name && h.state === 'now') ?? [...hops].reverse().find(h => h.name === name && h.state === 'done') ?? hops.find(h => h.name === name);
              return (
                <g key={name} className={`g-node ${st ?? ''}`} transform={`translate(${p.x} ${p.y})`} style={{ opacity: a && !st ? 0.45 : 1 }}>
                  {st === 'holder' && <circle r={r} className="halo" />}
                  <circle r={r} className="base" />
                  <text className="ini" textAnchor="middle" dy="4">{initials(name)}</text>
                  <text className="nm" textAnchor="middle" y={r + 18}>{name.split(' ')[0]}</text>
                  <text className="rl" textAnchor="middle" y={r + 32}>{shortRole(p.e.role)}</text>
                  {hop && st && <text className="st" textAnchor="middle" y={r + 47}>{hop.state === 'now' ? `▸ ${hop.label}` : hop.state === 'done' ? `✓ ${hop.label}` : hop.label}</text>}
                </g>
              );
            })}
          </svg>
        )}
        <div className="graph-legend"><span style={{ color: 'var(--flow-2)' }}>━ sealed</span><span style={{ color: 'var(--gold-2)' }}>┅ in motion</span><span>┈ next in line</span></div>
        {a && (
          <div className="graph-card card" style={{ background: 'rgba(11,17,29,.86)' }}>
            <div className="card-body stack tight">
              <div className="row between"><span className="mono xs muted">{a.ref}</span><Status s={a.status} /></div>
              <div className="serif" style={{ fontSize: 16, lineHeight: 1.3 }}>{a.title}</div>
              <div className="xs muted">{a.type.name}{a.asset ? ` · ${a.asset.name}` : ''}</div>
              <div className="row" style={{ marginTop: 6 }}>
                <button className={`btn ${isMe ? 'primary' : ''} sm`} onClick={() => nav(`/actions/${a.id}`)}>{isMe ? 'Open and sign' : 'Open decision dossier'}<ArrowUpRight size={14} /></button>
              </div>
            </div>
          </div>
        )}
      </section>

      <aside className="sit-col" aria-label="Posture and ledger">
        <div className="section-title">POSTURE</div>
        {d && (
          <div className="posture" style={{ marginBottom: 22 }}>
            <div><b style={{ color: 'var(--critical)' }}>{d.register.critical}</b><span>critical risks</span></div>
            <div><b>{d.incidents.open}</b><span>open incidents</span></div>
            <div><b style={{ color: d.actions.awaiting_approval ? 'var(--gold-2)' : undefined }}>{d.actions.awaiting_approval}</b><span>awaiting approval</span></div>
            <div><b style={{ color: d.actions.emergency_open_reviews ? 'var(--critical)' : d.actions.overdue ? 'var(--danger)' : 'var(--seal)' }}>{d.actions.emergency_open_reviews || d.actions.overdue}</b><span>{d.actions.emergency_open_reviews ? 'emergency reviews' : 'overdue'}</span></div>
          </div>
        )}
        {d && <div style={{ marginBottom: 22 }}><div className="section-title">RISK LANDSCAPE</div><HeatMap items={d.matrix.map((r: any) => ({ id: r.id, code: r.code, l: r.l, i: r.i, title: r.title }))} /></div>}
        <div className="row between"><div className="section-title">SEALED LEDGER</div><Link to="/audit" className="xs">All entries</Link></div>
        <div className="feed">
          {(d?.recent ?? []).map((e: any) => (
            <div key={e.id} className={`feed-item ${e.stage}`}><i />
              <div className="small">{e.summary}</div>
              <div className="w">{fmtTime(e.at)} · {e.actor} · #{e.id} · {ago(e.at)}</div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function shortRole(r: string) {
  return r.replace('Chief Executive Officer (CEO)', 'CEO').replace('Finance Director (CFO / DAF)', 'CFO · DAF').replace('Project Manager / Risk Coordinator', 'Risk coordinator')
    .replace('Cybersecurity Analyst', 'Security analyst').replace('IT Operations Manager', 'IT operations').replace('Accounts Payable Officer', 'Accounts payable')
    .replace('Systems Administrator', 'Sysadmin').replace('Service Delivery Manager', 'Service delivery').replace('Chief Risk Officer (CRO)', 'CRO')
    .replace('Chief Information Security Officer', 'CISO').replace('Head of Financial Crime', 'Financial crime').replace('Head of Payment Operations', 'Payment ops');
}
