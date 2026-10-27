import { Fragment, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { rpc } from '../lib/supabase';
import { useRpc, useSession } from '../lib/session';
import { fmtDateTime, STAGE_LABEL, statusOf } from '../lib/format';
import { Badge, Card, Empty, Loading, Notice, PageHead } from '../components/ui';

const TONE: Record<string, string> = { detect: 'info', assess: 'info', authorise: 'warning', execute: 'accent', verify: 'success', scenario: 'muted', admin: 'muted', governance: 'neutral' };

export default function Audit() {
  const { orgId } = useSession();
  const [sp] = useSearchParams();
  const [stage, setStage] = useState('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const { data, loading } = useRpc<any>('grc_audit', { p_org: orgId, p_limit: 300, p_stage: stage || null, p_search: query || null }, { poll: 12000 });
  const [chain, setChain] = useState<any>(null);
  const [scan, setScan] = useState<number>(-1);
  const [open, setOpen] = useState<number | null>(null);
  const timer = useRef<number | null>(null);

  async function verify() {
    setChain(null);
    const items = data?.items ?? [];
    const res = rpc('grc_verify_audit_chain');
    // the scan walks the visible chain while the server recomputes every hash
    let k = 0; setScan(0);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    await new Promise<void>(done => {
      if (reduce || items.length === 0) return done();
      timer.current = window.setInterval(() => { k += Math.max(1, Math.ceil(items.length / 40)); setScan(k); if (k >= items.length) { window.clearInterval(timer.current!); done(); } }, 30);
    });
    setChain(await res); setScan(items.length + 1);
  }
  useEffect(() => { if (sp.get('verify') && data && !chain && scan < 0) verify(); }, [data]); // eslint-disable-line
  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current); }, []);

  return (
    <>
      <PageHead title="Audit trail"
        desc="An append-only chain. Each entry stores the fingerprint of the one before it, so changing or deleting anything breaks the chain. The database itself refuses edits and deletions."
        actions={<button className="btn primary" onClick={verify} disabled={scan >= 0 && !chain}><ShieldCheck size={15} />Verify integrity</button>} />
      {chain && (chain.ok
        ? <div className="seal-banner" role="status">
            <div className="seal-ring"><ShieldCheck size={30} /></div>
            <div className="seal-body">
              <div className="seal-h">Chain intact</div>
              <div className="seal-p"><b>{chain.checked}</b> entries recomputed by the server, every fingerprint matches. Nothing was edited or deleted.</div>
              <div className="seal-meta"><span>Head <span className="mono">{chain.head}</span></span><span>Checked {fmtDateTime(chain.verified_at)}</span></div>
            </div>
          </div>
        : <Notice kind="danger"><ShieldAlert size={14} /> Chain broken at entry #{chain.first_broken_id}. Records from that point cannot be trusted.</Notice>)}
      <Card flush className="no-print">
        <div className="toolbar">
          <div className="seg">{['', 'detect', 'assess', 'authorise', 'execute', 'verify', 'governance', 'admin', 'scenario'].map(s => <button key={s} className={stage === s ? 'on' : ''} onClick={() => setStage(s)}>{s ? STAGE_LABEL[s] : 'All'}</button>)}</div>
          <form onSubmit={e => { e.preventDefault(); setQuery(q); }} className="row"><input className="input" placeholder="Person, reference or text" value={q} onChange={e => setQ(e.target.value)} /><button className="btn sm">Search</button></form>
          <span className="small muted" style={{ marginLeft: 'auto' }}>{data?.total ?? 0} entries in this organisation</span>
        </div>
        {loading && !data ? <Loading rows={8} /> : data.items.length === 0 ? <Empty title="No entries match" /> : (
          <div className="ledger">
            {data.items.map((e: any, n: number) => (
              <Fragment key={e.id}>
                <div className={`ledger-row ${scan > n || (chain?.ok) ? 'ok' : scan === n ? 'scan' : ''}`} onClick={() => setOpen(open === e.id ? null : e.id)} role="button" tabIndex={0}>
                  <div className="knot" />
                  <div className="lt small muted" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtDateTime(e.at)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="row wrap" style={{ gap: 6 }}><Badge tone={TONE[e.stage] as any}>{STAGE_LABEL[e.stage]}</Badge>{e.entity_ref && <span className="mono xs muted">{e.entity_ref}</span>}{e.prev_status || e.new_status ? <span className="xs muted">{statusOf(e.prev_status).label} to {statusOf(e.new_status).label}</span> : null}</div>
                    <div className="small" style={{ marginTop: 3 }}>{e.summary}</div>
                    <div className="xs muted">{e.actor}, {e.role}</div>
                  </div>
                  <div className="lh">#{e.id}<br /><b>{e.hash?.slice(0, 16)}</b><br />prev {e.prev_hash ? e.prev_hash.slice(0, 16) : 'genesis'}</div>
                </div>
                {open === e.id && (
                  <div style={{ padding: '12px 18px 14px 54px', background: 'var(--sheet-2)', borderBottom: '1px solid var(--line)' }}>
                    <div className="grid g2 small">
                      <div><div className="section-title">Recorded details</div><pre className="mono xs" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify(e.details, null, 2)}</pre></div>
                      <div className="stack tight"><div className="section-title">Fingerprints</div>
                        <div className="mono xs" style={{ wordBreak: 'break-all' }}>this {e.hash}</div><div className="mono xs" style={{ wordBreak: 'break-all' }}>prev {e.prev_hash ?? 'genesis'}</div>
                        {e.risk_id && <div>Risk {e.risk_id}</div>}{e.asset_id && <div>Asset {e.asset_id}</div>}</div>
                    </div>
                  </div>
                )}
              </Fragment>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
