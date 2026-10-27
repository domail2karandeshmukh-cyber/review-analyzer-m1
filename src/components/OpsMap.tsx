import { useMemo, useState } from 'react';
import { LAND } from '../lib/landPath';
import '../styles/map.css';

/* Equirectangular projection onto a 1000×500 canvas (same as landPath.ts). */
const px = (lon: number, lat: number) => [((lon + 180) / 360) * 1000, ((90 - lat) / 180) * 500] as const;

type Node = { id: string; name: string; sub: string; lon: number; lat: number; kind: 'hq' | 'vendor' | 'threat' | 'asset'; tier?: string; dx?: number; dy?: number; anchor?: 'start' | 'end' };
const NODES: Node[] = [
  { id: 'hq', name: 'NOVATECH Services', sub: 'Headquarters · Angers', lon: -0.55, lat: 47.47, kind: 'hq', dx: -5, dy: -4, anchor: 'end' },
  { id: 'lt07', name: 'FIN-LT-07', sub: 'Finance laptop · Angers', lon: -0.3, lat: 46.9, kind: 'asset', dx: 3.5, dy: 5.5 },
  { id: 'nimbus', name: 'Nimbus Cloud Hosting', sub: 'Critical · Paris region', lon: 2.35, lat: 48.86, kind: 'vendor', tier: 'critical', dx: 1, dy: 6 },
  { id: 'vault', name: 'VaultBox Backup', sub: 'Critical · Frankfurt', lon: 8.68, lat: 50.11, kind: 'vendor', tier: 'critical', dx: 4, dy: -3.5 },
  { id: 'ledger', name: 'LedgerOne ERP', sub: 'Critical · Dublin', lon: -6.26, lat: 53.35, kind: 'vendor', tier: 'critical', dx: -4, dy: -3.5, anchor: 'end' },
  { id: 'mail', name: 'SecureMail Gateway', sub: 'Medium · Amsterdam', lon: 4.9, lat: 52.37, kind: 'vendor', tier: 'medium', dx: 4, dy: -3.5 },
  { id: 'threat', name: 'Ransomware staging host', sub: 'Unknown operator · blocked', lon: 37.6, lat: 55.75, kind: 'threat', dx: -7, dy: -5, anchor: 'end' },
];
const LINKS: [string, string, 'dep' | 'attack'][] = [
  ['hq', 'nimbus', 'dep'], ['hq', 'vault', 'dep'], ['hq', 'ledger', 'dep'], ['hq', 'mail', 'dep'], ['threat', 'lt07', 'attack'],
];

/* View window: Europe plus the east, so the threat host sits on the right edge. */
const VIEW = { x: 438, y: 78, w: 222, h: 92 };

export default function OpsMap({ live = true }: { live?: boolean }) {
  const [hover, setHover] = useState<string | null>(null);
  const pts = useMemo(() => Object.fromEntries(NODES.map(n => [n.id, px(n.lon, n.lat)])), []);
  const arc = (a: readonly [number, number], b: readonly [number, number]) => {
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 - Math.abs(b[0] - a[0]) * 0.18;
    return `M${a[0]} ${a[1]} Q${mx} ${my} ${b[0]} ${b[1]}`;
  };
  const h = NODES.find(n => n.id === hover);
  return (
    <div className={`opsmap ${live ? 'live' : ''}`}>
      <svg viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} role="img" aria-label="Operations map: headquarters, critical suppliers and the threat source">
        <defs>
          <radialGradient id="om-glow"><stop offset="0" stopColor="var(--accent)" stopOpacity=".35" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></radialGradient>
          <marker id="om-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--crit)" /></marker>
        </defs>
        <path d={LAND} className="om-land" />
        <g className="om-grid">{[-10, 0, 10, 20, 30, 40].map(lon => <line key={lon} x1={px(lon, 0)[0]} x2={px(lon, 0)[0]} y1={VIEW.y} y2={VIEW.y + VIEW.h} />)}
          {[40, 50, 60].map(lat => <line key={lat} y1={px(0, lat)[1]} y2={px(0, lat)[1]} x1={VIEW.x} x2={VIEW.x + VIEW.w} />)}</g>
        <circle cx={pts.hq[0]} cy={pts.hq[1]} r="22" fill="url(#om-glow)" />
        {LINKS.map(([a, b, k]) => <path key={a + b} d={arc(pts[a], pts[b])} className={`om-link ${k}`} markerEnd={k === 'attack' ? 'url(#om-arrow)' : undefined} />)}
        {NODES.map(n => {
          const [x, y] = pts[n.id];
          return (
            <g key={n.id} className={`om-node ${n.kind} ${n.tier ?? ''} ${hover === n.id ? 'hov' : ''}`} transform={`translate(${x} ${y})`} onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}>
              {n.kind === 'threat' && <><circle r="4" className="om-pulse" /><circle r="4" className="om-pulse d2" /></>}
              {n.kind === 'hq' && <circle r="5" className="om-ring" />}
              <circle r={n.kind === 'hq' ? 2.6 : n.kind === 'threat' ? 2.2 : 1.8} className="om-dot" />
              <text x={n.dx ?? 4} y={n.dy ?? -3.5} textAnchor={n.anchor ?? 'start'} className="om-label">{n.name}</text>
            </g>
          );
        })}
      </svg>
      <div className="om-legend">
        <span><i className="k-hq" />Headquarters</span><span><i className="k-vendor" />Critical supplier</span><span><i className="k-asset" />Affected asset</span><span><i className="k-threat" />Threat source</span>
      </div>
      <div className={`om-card ${h ? 'show' : ''}`}>{h && <><b>{h.name}</b><span>{h.sub}</span></>}</div>
    </div>
  );
}
