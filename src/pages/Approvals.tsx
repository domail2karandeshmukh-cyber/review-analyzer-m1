import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Siren, Stamp } from 'lucide-react';
import { useRpc, useSession } from '../lib/session';
import { fmtDateTime, fmtMoney } from '../lib/format';
import { Badge, Card, Empty, Field, Loading, PageHead, Severity, Status, Tabs } from '../components/ui';
import { PolicyPreview } from '../components/Policy';

export default function Approvals() {
  const { orgId, current } = useSession();
  const [sp] = useSearchParams();
  const [tab, setTab] = useState(sp.get('tab') ?? 'mine');
  const work = useRpc<any>('grc_my_work', { p_org: orgId }, { poll: 8000 });
  const all = useRpc<any[]>('grc_actions', { p_org: orgId }, { poll: 10000 });
  const audit = useRpc<any>('grc_audit', { p_org: orgId, p_limit: 60, p_stage: 'authorise' });
  const nav = useNavigate();
  const mine = (work.data?.tasks ?? []).filter((t: any) => ['approve', 'post_review', 'assess', 'respond_info'].includes(t.task));
  const pipeline = (all.data ?? []).filter(a => ['under_review', 'awaiting_approval', 'escalated', 'submitted'].includes(a.status));

  return (
    <>
      <PageHead title="Approval center"
        desc="Decisions are routed by configurable policy — by action type, severity, asset criticality, amount, emergency status and delegation. Nobody approves their own request." />
      <Tabs value={tab} onChange={setTab} tabs={[
        { key: 'mine', label: <>Awaiting my decision {mine.length > 0 && <Badge tone="warning">{mine.length}</Badge>}</> },
        { key: 'pipeline', label: `Organisation pipeline (${pipeline.length})` },
        { key: 'who', label: 'Who can approve this?' },
        { key: 'history', label: 'Decision history' },
      ]} />

      {tab === 'mine' && (
        <Card flush>
          {work.loading && !work.data ? <Loading /> : mine.length === 0 ? <Empty icon={<CheckCircle2 size={28} />} title="Nothing awaits your decision">Requests appear here only when policy designates your role{current?.delegated_roles?.length ? ' (or a role delegated to you)' : ''}.</Empty> :
            mine.map((a: any) => (
              <div key={a.id} className="list-row click" onClick={() => nav(`/actions/${a.id}`)}>
                <div className="grow">
                  <div className="row wrap"><span className="strong">{a.title}</span>{a.emergency && <Badge tone="critical"><Siren size={11} />Emergency</Badge>}</div>
                  <div className="small muted"><span className="mono">{a.ref}</span> · {a.type_name}{a.amount != null && ` · ${fmtMoney(a.amount)}`} · requested by {a.requested_by}</div>
                </div>
                <Severity s={a.severity} />
                <Badge tone={a.task === 'post_review' ? 'critical' : a.task === 'assess' ? 'info' : 'warning'}>{({ approve: 'Approve / reject', post_review: 'Post-emergency review', assess: 'Assess', respond_info: 'Answer question' } as any)[a.task]}</Badge>
              </div>
            ))}
        </Card>
      )}

      {tab === 'pipeline' && (
        <Card flush>
          {pipeline.length === 0 ? <Empty title="No pending decisions in the organisation" /> : (
            <div className="table-wrap"><table className="t responsive">
              <thead><tr><th>Request</th><th>Status</th><th>Waiting for</th><th>Requested by</th><th>Severity</th></tr></thead>
              <tbody>{pipeline.map(a => (
                <tr key={a.id} className="click" onClick={() => nav(`/actions/${a.id}`)}>
                  <td className="primary"><div className="cell-title">{a.title}</div><div className="cell-sub"><span className="mono">{a.ref}</span> · {a.type_name}{a.amount != null && ` · ${fmtMoney(a.amount)}`}</div></td>
                  <td data-label="Status"><Status s={a.status} /></td>
                  <td data-label="Waiting for"><div className="small">{a.next?.title}</div><div className="cell-sub">{a.next?.actor}</div></td>
                  <td data-label="Requester" className="small">{a.requested_by}</td>
                  <td data-label="Severity"><Severity s={a.severity} /></td>
                </tr>))}</tbody>
            </table></div>
          )}
        </Card>
      )}

      {tab === 'who' && <WhoCanApprove />}

      {tab === 'history' && (
        <Card flush>
          {!audit.data ? <Loading /> : audit.data.items.length === 0 ? <Empty title="No decisions recorded yet" /> :
            audit.data.items.map((e: any) => (
              <div key={e.id} className="list-row">
                <Stamp size={16} color="var(--warning)" />
                <div className="grow"><div className="small">{e.summary}</div><div className="xs muted">{e.actor} · {e.role} · {fmtDateTime(e.at)}</div></div>
                {e.outcome && <Badge tone={e.outcome === 'approved' || e.outcome === 'authorised' ? 'success' : e.outcome === 'rejected' ? 'danger' : e.outcome === 'emergency' ? 'critical' : 'neutral'}>{e.outcome}</Badge>}
              </div>
            ))}
        </Card>
      )}
    </>
  );
}

function WhoCanApprove() {
  const { orgId } = useSession();
  const org = useRpc<any>('grc_org', { p_org: orgId });
  const [t, setT] = useState('');
  const [sev, setSev] = useState(3);
  const [asset, setAsset] = useState('');
  const [amount, setAmount] = useState('');
  const type = useMemo(() => org.data?.action_types?.find((x: any) => x.code === t), [org.data, t]);
  const money = type && ['finance', 'banking', 'governance'].includes(type.domain);
  return (
    <div className="grid g-main">
      <Card title="Ask the policy engine" sub="Change any parameter — the route recalculates from the live approval rules">
        <div className="stack">
          <div className="grid g2">
            <Field label="Proposed action">
              <select className="select" value={t} onChange={e => setT(e.target.value)}><option value="">Select…</option>{(org.data?.action_types ?? []).map((x: any) => <option key={x.code} value={x.code}>{x.name}</option>)}</select>
            </Field>
            <Field label="Target asset">
              <select className="select" value={asset} onChange={e => setAsset(e.target.value)}><option value="">— none —</option>{(org.data?.assets ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name} (criticality {s.criticality})</option>)}</select>
            </Field>
          </div>
          <div className="grid g2">
            <Field label="Severity"><div className="seg">{[1, 2, 3, 4].map(n => <button key={n} className={sev === n ? 'on' : ''} onClick={() => setSev(n)}>{n}</button>)}</div></Field>
            {money && <Field label={type.domain === 'governance' ? 'Budget (€)' : 'Amount (€)'}><input className="input" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 184500" /></Field>}
          </div>
          <div className="divider" />
          {t ? <PolicyPreview org={orgId} actionType={t} severity={sev} asset={asset || null} amount={amount ? +amount : null} /> : <div className="small muted">Choose an action to see who assesses, who approves, who executes and whether an emergency bypass exists.</div>}
        </div>
      </Card>
      <Card title="Try these professor questions">
        <div className="stack small">
          {[
            ['Firewall change', 'firewall_change', 3, 'NT-AST-FW', ''],
            ['Shut down a critical server', 'server_shutdown', 4, 'NT-AST-APP01', ''],
            ['Lock a laptop (low severity)', 'lock_device', 2, 'NT-AST-LT07', ''],
            ['Hold a €184,500 payment', 'payment_hold', 3, 'NT-AST-ERP', '184500'],
            ['Hold a €20,000 payment', 'payment_hold', 3, 'NT-AST-ERP', '20000'],
            ['Activate the BCP', 'activate_bcp', 4, '', ''],
          ].filter(() => orgId === 'NT').map(([l, c, s, a, m]) => (
            <button key={l as string} className="btn block" style={{ justifyContent: 'flex-start' }} onClick={() => { setT(c as string); setSev(s as number); setAsset(a as string); setAmount(m as string); }}>{l}</button>
          ))}
          {orgId === 'BK' && [['Hold a €78,400 transfer', 'transaction_hold', 3, 'BK-AST-PAY', '78400'], ['Hold a €1.2M transfer', 'transaction_hold', 3, 'BK-AST-PAY', '1200000'], ['Block a card (routine)', 'card_block', 2, 'BK-AST-CARD', '']].map(([l, c, s, a, m]) => (
            <button key={l as string} className="btn block" style={{ justifyContent: 'flex-start' }} onClick={() => { setT(c as string); setSev(s as number); setAsset(a as string); setAmount(m as string); }}>{l}</button>
          ))}
          <div className="xs muted">Rules are edited under Organisation & Roles → Approval policy. A change applies immediately to new submissions and is recorded in the audit trail.</div>
        </div>
      </Card>
    </div>
  );
}
