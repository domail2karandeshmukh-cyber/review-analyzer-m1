import { useNavigate } from 'react-router-dom';

const bg = (s: number) => s >= 12 ? 'var(--heat-crit)' : s >= 8 ? 'var(--heat-high)' : s >= 4 ? 'var(--heat-mod)' : 'var(--heat-low)';

/** 4×4 likelihood × impact matrix on the teacher scale. */
export function HeatMap({ items }: { items: { id: string; code: string; l: number; i: number; title: string }[] }) {
  const nav = useNavigate();
  return (
    <div>
      <div className="heat" role="img" aria-label="Risk heat map, likelihood by impact">
        {[4, 3, 2, 1].map(l => (
          <FragmentRow key={l} l={l}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="cell" style={{ background: bg(l * i) }}>
                {items.filter(r => r.l === l && r.i === i).map(r => <span key={r.id} className="chip" title={r.title} onClick={() => nav(`/risks?r=${r.id}`)}>{r.code}</span>)}
                <span className="sc">{l * i}</span>
              </div>
            ))}
          </FragmentRow>
        ))}
        <div />
        {[1, 2, 3, 4].map(i => <div key={i} className="ax">{i}</div>)}
      </div>
      <div className="xs muted" style={{ marginTop: 6 }}>Rows: likelihood 1–4. Columns: impact 1–4.</div>
      <div className="row wrap xs muted" style={{ marginTop: 4 }}>
        <span className="row wrap" style={{ gap: 10 }}>
          <Leg c="var(--heat-low)" l="1–3 Low" /><Leg c="var(--heat-mod)" l="4–7 Moderate" /><Leg c="var(--heat-high)" l="8–11 High" /><Leg c="var(--heat-crit)" l="12–16 Critical" />
        </span>
      </div>
    </div>
  );
}
function FragmentRow({ l, children }: { l: number; children: React.ReactNode }) {
  return <><div className="ax">{l}</div>{children}</>;
}
function Leg({ c, l }: { c: string; l: string }) {
  return <span className="row" style={{ gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: c, display: 'inline-block' }} />{l}</span>;
}

export function KriPill({ s }: { s: any }) {
  if (!s || s.value == null) return <span className="muted small">No reading</span>;
  const tone = s.level === 'critical' ? 'critical' : s.level === 'warning' ? 'warning' : 'success';
  return <span className={`badge t-${tone}`}><span className="bdot" />{s.value} {s.unit}</span>;
}
