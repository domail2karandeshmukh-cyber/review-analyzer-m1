import { Fragment, useState } from 'react';
import { ShieldCheck, ShieldAlert, ChevronDown, ChevronRight } from 'lucide-react';
import { rpc } from '../lib/supabase';
import { useRpc, useSession } from '../lib/session';
import { fmtDateTime, STAGE_LABEL } from '../lib/format';
import { Badge, Card, Empty, Loading, Notice, PageHead } from '../components/ui';

const TONE: Record<string, string> = { detect: 'info', assess: 'info', authorise: 'warning', execute: 'accent', verify: 'success', scenario: 'muted', admin: 'muted', governance: 'neutral' };

export default function Audit() {
  const { orgId } = useSession();
  const [stage, setStage] = useState('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const { data, loading } = useRpc<any>('grc_audit', { p_org: orgId, p_limit: 300, p_stage: stage || null, p_search: query || null }, { poll: 10000 });
  const [chain, setChain] = useState<any>(null);
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <PageHead eyebrow="Assurance" title="Audit Trail"
        desc="Append-only and hash-chained: every event stores the hash of the previous one, so any modification or deletion is detectable. Updates and deletes are blocked in the database itself."
        actions={<button className="btn" onClick={async () => setChain(await rpc('grc_verify_audit_chain'))}><ShieldCheck size={15} />Verify integrity</button>} />
      {chain && (chain.ok ? <Notice kind="success">Integrity verified: {chain.checked} events recomputed, chain intact. Head hash <span className="mono">{chain.head}…</span> · {fmtDateTime(chain.verified_at)}</Notice>
        : <Notice kind="danger"><ShieldAlert size={14} /> Chain broken at event #{chain.first_broken_id}.</Notice>)}
      <Card flush className="no-print" >
        <div className="toolbar">
          <div className="seg">{['', 'detect', 'assess', 'authorise', 'execute', 'verify', 'governance', 'admin', 'scenario'].map(s => <button key={s} className={stage === s ? 'on' : ''} onClick={() => setStage(s)}>{s ? STAGE_LABEL[s] : 'All'}</button>)}</div>
          <form onSubmit={e => { e.preventDefault(); setQuery(q); }} className="row"><input className="input" placeholder="Search actor, reference, text…" value={q} onChange={e => setQ(e.target.value)} /><button className="btn sm">Search</button></form>
          <span className="small muted" style={{ marginLeft: 'auto' }}>{data?.total ?? 0} events in this organisation</span>
        </div>
        {loading && !data ? <Loading rows={8} /> : data.items.length === 0 ? <Empty title="No events" /> : (
          <div className="table-wrap"><table className="t">
            <thead><tr><th style={{ width: 24 }} /><th>#</th><th>Time</th><th>Stage</th><th>Event</th><th>Actor</th><th>Transition</th><th>Hash</th></tr></thead>
            <tbody>{data.items.map((e: any) => (
              <Fragment key={e.id}>
                <tr className="click" onClick={() => setOpen(open === e.id ? null : e.id)}>
                  <td>{open === e.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                  <td className="mono xs">{e.id}</td>
                  <td className="small nowrap">{fmtDateTime(e.at)}</td>
                  <td><Badge tone={TONE[e.stage] as any}>{STAGE_LABEL[e.stage]}</Badge></td>
                  <td><div className="small">{e.summary}</div>{e.entity_ref && <div className="cell-sub mono">{e.entity_ref}</div>}</td>
                  <td className="small">{e.actor}<div className="cell-sub">{e.role}</div></td>
                  <td className="small nowrap">{e.prev_status || e.new_status ? <>{e.prev_status ?? '∅'} → {e.new_status ?? '∅'}</> : '—'}{e.outcome && <div className="cell-sub">{e.outcome}</div>}</td>
                  <td className="mono xs">{e.hash?.slice(0, 10)}</td>
                </tr>
                {open === e.id && (
                  <tr><td colSpan={8} style={{ background: 'var(--surface-2)' }}>
                    <div className="grid g2 small">
                      <div><div className="section-title">Details</div><pre className="mono xs" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify(e.details, null, 2)}</pre></div>
                      <div className="stack tight"><div className="section-title">Chain</div>
                        <div className="mono xs">prev  {e.prev_hash ?? 'GENESIS'}</div><div className="mono xs">hash  {e.hash}</div>
                        {e.risk_id && <div>Risk: {e.risk_id}</div>}{e.asset_id && <div>Asset: {e.asset_id}</div>}{e.scenario_run_id && <div className="xs muted">Scenario run {e.scenario_run_id}</div>}</div>
                    </div>
                  </td></tr>
                )}
              </Fragment>))}</tbody>
          </table></div>
        )}
      </Card>
    </>
  );
}
