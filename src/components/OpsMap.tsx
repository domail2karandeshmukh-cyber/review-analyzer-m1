import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../styles/map.css';

/* Live operations map: real map tiles (CARTO dark, OpenStreetMap data) with NOVATECH's sites, suppliers and the threat source. */
type Node = { id: string; name: string; sub: string; lat: number; lon: number; kind: 'hq' | 'vendor' | 'asset' | 'threat' };
const NODES: Node[] = [
  { id: 'hq', name: 'NOVATECH Services', sub: 'Headquarters · Angers, France', lat: 47.4784, lon: -0.5632, kind: 'hq' },
  { id: 'lt07', name: 'FIN-LT-07', sub: 'Finance laptop · ransomware precursor detected', lat: 47.05, lon: -0.35, kind: 'asset' },
  { id: 'nimbus', name: 'Nimbus Cloud Hosting', sub: 'Critical supplier · Paris region · exit plan in place', lat: 48.8566, lon: 2.3522, kind: 'vendor' },
  { id: 'vault', name: 'VaultBox Backup Storage', sub: 'Critical supplier · Frankfurt · exit plan in place', lat: 50.1109, lon: 8.6821, kind: 'vendor' },
  { id: 'ledger', name: 'LedgerOne ERP (SaaS)', sub: 'Critical supplier · Dublin', lat: 53.3498, lon: -6.2603, kind: 'vendor' },
  { id: 'mail', name: 'SecureMail Gateway', sub: 'Medium supplier · Amsterdam', lat: 52.3676, lon: 4.9041, kind: 'vendor' },
  { id: 'threat', name: 'Ransomware staging host', sub: 'Unknown operator · outbound connection blocked', lat: 55.7558, lon: 37.6173, kind: 'threat' },
];
const DEPS = ['nimbus', 'vault', 'ledger', 'mail'];

function arc(a: L.LatLngTuple, b: L.LatLngTuple, bend = 0.18): L.LatLngTuple[] {
  const pts: L.LatLngTuple[] = []; const n = 48;
  const mx = (a[0] + b[0]) / 2 + Math.abs(b[1] - a[1]) * bend * 0.35, my = (a[1] + b[1]) / 2;
  for (let i = 0; i <= n; i++) { const t = i / n; const u = 1 - t; pts.push([u * u * a[0] + 2 * u * t * mx + t * t * b[0], u * u * a[1] + 2 * u * t * my + t * t * b[1]]); }
  return pts;
}
const icon = (kind: Node['kind']) => L.divIcon({ className: `om-pin om-${kind}`, html: kind === 'threat' ? '<i class="p"></i><i class="p d2"></i><b></b>' : kind === 'hq' ? '<i class="r"></i><b></b>' : '<b></b>', iconSize: [28, 28], iconAnchor: [14, 14] });

export default function OpsMap() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const map = L.map(ref.current, { zoomControl: false, scrollWheelZoom: false, dragging: false, doubleClickZoom: false, touchZoom: false, attributionControl: true, minZoom: 3, maxZoom: 12, zoomSnap: 0.25 });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>' }).addTo(map);
    const by = Object.fromEntries(NODES.map(n => [n.id, [n.lat, n.lon] as L.LatLngTuple]));
    DEPS.forEach(id => L.polyline(arc(by.hq, by[id]), { className: 'om-dep', color: '#0071e3', weight: 2.5, opacity: .55 }).addTo(map));
    L.polyline(arc(by.threat, by.lt07, 0.3), { color: '#ff3b30', weight: 8, opacity: .12 }).addTo(map);
    L.polyline(arc(by.threat, by.lt07, 0.3), { className: 'om-attack', color: '#ff3b30', weight: 2.5, opacity: .95, dashArray: '10 8' }).addTo(map);
    NODES.forEach(n => {
      const dir: L.Direction = n.id === 'threat' ? 'left' : n.id === 'ledger' ? 'left' : n.id === 'hq' ? 'top' : n.id === 'lt07' ? 'bottom' : n.id === 'nimbus' ? 'bottom' : n.id === 'mail' ? 'top' : 'right';
      const off: L.PointTuple = n.id === 'threat' ? [-18, 0] : n.id === 'hq' ? [0, -16] : n.id === 'lt07' ? [0, 16] : dir === 'left' ? [-14, 0] : dir === 'right' ? [14, 0] : dir === 'top' ? [0, -14] : [0, 14];
      L.marker([n.lat, n.lon], { icon: icon(n.kind), zIndexOffset: n.kind === 'hq' ? 500 : n.kind === 'threat' ? 400 : 0 }).addTo(map)
        .bindTooltip(`<b>${n.name}</b><span>${n.sub}</span>`, { direction: dir, offset: off, permanent: n.kind !== 'vendor', className: `om-tip om-tip-${n.kind}` });
    });
    map.setView([50.2, 14.5], 5);
    const ro = new ResizeObserver(() => map.invalidateSize()); ro.observe(ref.current);
    return () => { ro.disconnect(); map.remove(); };
  }, []);
  return (
    <div className="opsmap">
      <div ref={ref} className="om-canvas" role="img" aria-label="Operations map: headquarters, critical suppliers, affected asset and the threat source" />
      <div className="om-legend">
        <span><i className="k-hq" />Headquarters</span><span><i className="k-vendor" />Supplier</span><span><i className="k-asset" />Affected asset</span><span><i className="k-threat" />Threat source</span>
      </div>
    </div>
  );
}
