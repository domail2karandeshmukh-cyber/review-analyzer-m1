import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Siren } from 'lucide-react';
import { useRpc, useSession } from '../lib/session';
import { due, fmtMoney, statusOf } from '../lib/format';
import { Badge, Card, Empty, ErrorBox, Loading, PageHead, Progress, Status } from '../components/ui';
import { NewActionModal } from '../components/NewAction';

const GROUPS: Record<string, string[]> = {
  open: ['draft', 'submitted', 'under_review', 'awaiting_approval', 'escalated', 'approved', 'scheduled', 'in_progress', 'awaiting_verification', 'reopened', 'blocked', 'failed'],
  approval: ['submitted', 'under_review', 'awaiting_approval', 'escalated'],
  execution: ['approved', 'scheduled', 'in_progress'],
  verification: ['awaiting_verification'],
  closed: ['completed', 'rejected', 'cancelled'],
};

export default function Actions() {
  const { orgId, can } = useSession();
  const [archived, setArchived] = useState(false);
  const { data, error, loading } = useRpc<any[]>('grc_actions', { p_org: orgId, p_include_archived: archived }, { poll: 10000 });
  const [g, setG] = useState('open');
  const [q, setQ] = useState('');
  const [dom, setDom] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const nav = useNavigate();
  const rows = useMemo(() => (data ?? []).filter(a =>
    (g === 'all' || GROUPS[g]?.includes(a.status)) && (!dom || a.domain === dom) &&
    (!q || `${a.ref} ${a.title} ${a.type_name} ${a.accountable} ${a.risk_code ?? ''}`.toLowerCase().includes(q.toLowerCase()))), [data, g, q, dom]);
  const counts = useMemo(() => Object.fromEntries(Object.entries(GROUPS).map(([k, v]) => [k, (data ?? []).filter(a => v.includes(a.status)).length])), [data]);

  return (
    <>
      <PageHead eyebrow="Risk treatment" title="Action Plans"
        desc="Every treatment, containment or business action with its owner, approval route, executor, deadline and verification. Status changes only through authorised steps."
        actions={can('action.propose') && <button className="btn primary" onClick={() => setNewOpen(true)}><Plus size={16} />New action</button>} />
      <Card flush>
        <div className="toolbar">
          <div className="seg">
            {[['open', 'Open'], ['approval', 'In approval'], ['execution', 'In execution'], ['verification', 'To verify'], ['closed', 'Closed'], ['all', 'All']].map(([k, l]) =>
              <button key={k} className={g === k ? 'on' : ''} onClick={() => setG(k)}>{l}{k !== 'all' && <span className="muted"> {counts[k] ?? 0}</span>}</button>)}
          </div>
          <select className="select" value={dom} onChange={e => setDom(e.target.value)} aria-label="Domain">
            <option value="">All domains</option>{['cyber', 'it', 'finance', 'continuity', 'governance', 'banking'].map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <input className="input" placeholder="Filter…" value={q} onChange={e => setQ(e.target.value)} style={{ minWidth: 180 }} />
          <label className="row small muted" style={{ marginLeft: 'auto' }}><input type="checkbox" checked={archived} onChange={e => setArchived(e.target.checked)} /> Include archived scenario runs</label>
        </div>
        <ErrorBox error={error} />
        {loading && !data ? <Loading rows={6} /> : rows.length === 0 ? <Empty title="No actions match these filters" /> : (
          <div className="table-wrap">
            <table className="t responsive">
              <thead><tr><th>Action</th><th>Status</th><th>Next step</th><th>Accountable</th><th>Risk</th><th>Deadline</th><th style={{ width: 110 }}>Progress</th></tr></thead>
              <tbody>
                {rows.map(a => (
                  <tr key={a.id} className={`click ${a.archived ? 'dim' : ''}`} onClick={() => nav(`/actions/${a.id}`)}>
                    <td className="primary">
                      <div className="cell-title">{a.title}</div>
                      <div className="cell-sub"><span className="mono">{a.ref}</span> · {a.type_name}{a.amount != null && ` · ${fmtMoney(a.amount)}`} {a.emergency && <Badge tone="critical"><Siren size={11} />Emergency</Badge>}</div>
                    </td>
                    <td data-label="Status"><Status s={a.status} /></td>
                    <td data-label="Next"><div className="small">{a.next?.title}</div><div className="cell-sub">{a.next?.actor}</div></td>
                    <td data-label="Accountable" className="small">{a.accountable}</td>
                    <td data-label="Risk">{a.risk_code ? <Badge tone="neutral">{a.risk_code}</Badge> : '—'}</td>
                    <td data-label="Deadline" className="small nowrap" style={{ color: a.overdue ? 'var(--danger)' : undefined }}>{['completed', 'cancelled', 'rejected'].includes(a.status) ? statusOf(a.status).label : due(a.deadline)}</td>
                    <td data-label="Progress"><Progress value={a.progress} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {newOpen && <NewActionModal onClose={() => setNewOpen(false)} />}
    </>
  );
}
