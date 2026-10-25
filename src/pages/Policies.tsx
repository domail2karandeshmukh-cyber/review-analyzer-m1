import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, FileSignature, Clock } from 'lucide-react';
import { rpc } from '../lib/supabase';
import { useRpc, useSession } from '../lib/session';
import { ago, fmtDate, due } from '../lib/format';
import { Avatar, Badge, Card, Drawer, Empty, ErrorBox, Loading, Meter, Notice, PageHead, Stat, useToast } from '../components/ui';
import '../styles/ops.css';

const STATUS: Record<string, { label: string; tone: any }> = {
  approved: { label: 'Approved', tone: 'success' }, in_review: { label: 'In review', tone: 'warning' }, draft: { label: 'Draft', tone: 'muted' }, retired: { label: 'Retired', tone: 'muted' },
};
const AUD: Record<string, string> = { all: 'All staff', finance: 'Finance team', managers: 'Managers', it: 'IT and security' };

/** Minimal, safe markdown: headings, bullet/numbered lists, paragraphs, **bold**. Builds React elements; never injects HTML. */
function inline(t: string): ReactNode[] {
  return t.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>));
}
export function Markdown({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];
  const flushPara = () => { if (para.length) { out.push(<p key={out.length}>{inline(para.join(' '))}</p>); para = []; } };
  const flushList = () => {
    if (list) { const Tag = list.ordered ? 'ol' : 'ul'; out.push(<Tag key={out.length}>{list.items.map((it, i) => <li key={i}>{inline(it)}</li>)}</Tag>); list = null; }
  };
  for (const raw of (text ?? '').split('\n')) {
    const line = raw.trimEnd();
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (h) { flushPara(); flushList(); const lvl = h[1].length; out.push(lvl === 1 ? <h1 key={out.length}>{inline(h[2])}</h1> : lvl === 2 ? <h2 key={out.length}>{inline(h[2])}</h2> : <h3 key={out.length}>{inline(h[2])}</h3>); }
    else if (ul || ol) { flushPara(); const ordered = !!ol; if (!list || list.ordered !== ordered) { flushList(); list = { ordered, items: [] }; } list.items.push((ul ?? ol)![1]); }
    else if (!line.trim()) { flushPara(); flushList(); }
    else { flushList(); para.push(line.trim()); }
  }
  flushPara(); flushList();
  return <div className="md">{out}</div>;
}

export default function Policies() {
  const { orgId } = useSession();
  const { data, error, loading, reload } = useRpc<any[]>('grc_policies', { p_org: orgId });
  const [sp, setSp] = useSearchParams();
  const [filter, setFilter] = useState('');
  const sel = sp.get('p');
  const open = (id: string | null) => { const n = new URLSearchParams(sp); if (id) n.set('p', id); else n.delete('p'); setSp(n, { replace: true }); };
  const ps = data ?? [];
  const approved = ps.filter(p => p.status === 'approved');
  const audience = approved.reduce((s, p) => s + p.audience_size, 0);
  const attested = approved.reduce((s, p) => s + p.attested, 0);
  const coverage = audience ? attested / audience : 0;
  const mine = approved.filter(p => p.in_audience && !p.my_attestation);
  const rows = useMemo(() => ps.filter(p => !filter || p.status === filter || (filter === 'mine' && p.in_audience && !p.my_attestation && p.status === 'approved')), [ps, filter]);

  return (
    <>
      <PageHead title="Policies" desc="The approved rule book. Each policy has an owner and an approver, a review date, the framework clauses it satisfies, and a record of who has read and accepted the current version." />
      <ErrorBox error={error} />
      {loading && !data ? <Card><Loading rows={6} /></Card> : ps.length === 0 ? <Card><Empty title="No policies yet" /></Card> : (
        <div className="stack loose">
          <div className="stats">
            <Stat k="Approved policies" v={approved.length} d={`of ${ps.length} in the library`} />
            <Stat k="In review" v={ps.filter(p => p.status === 'in_review').length} d="Awaiting approver sign-off" />
            <Stat k="Attestation coverage" v={<>{Math.round(coverage * 100)}<small>%</small></>} d={`${attested} of ${audience} required acknowledgements`} bar={coverage * 100} />
            <Stat k="Reviews overdue" v={ps.filter(p => p.review_overdue).length} d={ps.some(p => p.review_overdue) ? 'Past their review date' : 'Every policy within its review date'} tone={ps.some(p => p.review_overdue) ? 'down' : 'up'} />
          </div>

          {mine.length > 0 && (
            <Card title={<span className="row"><FileSignature size={15} color="var(--accent-2)" />Awaiting your acknowledgement</span>} sub={`${mine.length} approved polic${mine.length === 1 ? 'y applies' : 'ies apply'} to you and ${mine.length === 1 ? 'has' : 'have'} not been accepted yet`} flush>
              <div className="awaiting">
                {mine.map(p => <button key={p.id} onClick={() => open(p.id)}><span>{p.code} · v{p.version}</span><b>{p.title}</b></button>)}
              </div>
            </Card>
          )}

          <Card flush>
            <div className="toolbar">
              <div className="seg">
                {[['', 'All'], ['approved', 'Approved'], ['in_review', 'In review'], ['mine', 'Needs my acknowledgement']].map(([k, l]) => <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>)}
              </div>
            </div>
            <div className="table-wrap"><table className="t responsive">
              <thead><tr><th>Policy</th><th>Version</th><th>Status</th><th>Owner → approver</th><th>Applies to</th><th>Next review</th><th style={{ width: 210 }}>Acknowledged</th></tr></thead>
              <tbody>{rows.map(p => {
                const r = p.audience_size ? p.attested / p.audience_size : 0;
                return (
                  <tr key={p.id} className={`click ${sel === p.id ? 'on' : ''}`} onClick={() => open(p.id)}>
                    <td className="primary"><div className="cell-title">{p.title}</div><div className="cell-sub"><span className="mono">{p.code}</span> · {p.summary}</div></td>
                    <td data-label="Version" className="mono small">v{p.version}</td>
                    <td data-label="Status"><Badge tone={STATUS[p.status]?.tone} dot>{STATUS[p.status]?.label ?? p.status}</Badge></td>
                    <td data-label="Owner" className="small">{p.owner_role.replace(/ \(.*\)$/, '')}<div className="cell-sub">approved by {p.approver_role.replace(/ \(.*\)$/, '').replace('Chief Executive Officer', 'CEO')}</div></td>
                    <td data-label="Applies to" className="small">{AUD[p.audience] ?? p.audience}{p.in_audience && <div className="cell-sub">{p.my_attestation ? <span className="flag ok"><CheckCircle2 size={11} /> You accepted</span> : p.status === 'approved' ? <span className="flag warn"><Clock size={11} /> You: pending</span> : 'Includes you'}</div>}</td>
                    <td data-label="Next review" className="small nowrap">{fmtDate(p.review_date)}<div className={`flag ${p.review_overdue ? 'bad' : 'mute'}`}>{due(p.review_date)}</div></td>
                    <td data-label="Acknowledged">{p.status === 'approved'
                      ? <Meter parts={[{ value: p.attested, color: 'var(--pass)', title: 'Accepted' }, { value: Math.max(0, p.audience_size - p.attested), color: 'transparent' }]} label={`${p.attested}/${p.audience_size}`} />
                      : <span className="xs muted">Opens after approval</span>}{p.status === 'approved' && <div className="xs muted" style={{ marginTop: 2 }}>{Math.round(r * 100)}% of audience</div>}</td>
                  </tr>);
              })}</tbody>
            </table></div>
            {rows.length === 0 && <Empty title="No policy in this view" />}
          </Card>
        </div>
      )}
      {sel && <PolicyDrawer id={sel} onClose={() => open(null)} onSaved={reload} />}
    </>
  );
}

function PolicyDrawer({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: () => void }) {
  const { orgId, bump } = useSession();
  const toast = useToast();
  const { data: p, error, loading, reload } = useRpc<any>('grc_policy', { p_org: orgId, p_id: id });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function attest() {
    setBusy(true); setErr(null);
    try { await rpc('grc_policy_attest', { p_org: orgId, p_policy: id }); toast('ok', `${p.code} v${p.version} accepted and recorded in the audit ledger`); reload(); onSaved(); bump(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  return (
    <Drawer wide onClose={onClose} title={p ? p.title : 'Policy'} sub={p ? `${p.code} · version ${p.version} · effective ${fmtDate(p.effective_date)}` : undefined}>
      {error && <div style={{ padding: 16 }}><ErrorBox error={error} /></div>}
      {loading && !p ? <Loading rows={8} /> : p && <>
        <div className="ops-sec">
          <div className="row wrap" style={{ marginBottom: 10 }}>
            <Badge tone={STATUS[p.status]?.tone} dot>{STATUS[p.status]?.label}</Badge>
            <Badge tone="neutral">{AUD[p.audience] ?? p.audience}</Badge>
            {p.review_overdue && <Badge tone="critical">Review overdue</Badge>}
          </div>
          {p.status === 'approved' && p.in_audience && (p.my_attestation
            ? <Notice kind="success">You accepted version {p.version} {ago(p.my_attestation)}.</Notice>
            : <div className="ack">
                <FileSignature size={20} color="var(--accent-2)" />
                <div className="grow"><b>This policy applies to you</b><span>Read it below, then confirm. Your acceptance is recorded with a timestamp in the audit ledger.</span></div>
                <button className="btn primary" disabled={busy} onClick={attest}>{busy ? 'Recording' : `I have read and accept v${p.version}`}</button>
              </div>)}
          {p.status !== 'approved' && <Notice kind="warn">Draft under review by the {p.approver_role}. Acknowledgement opens once it is approved.</Notice>}
          {err && <div style={{ marginTop: 8 }}><Notice kind="danger">{err}</Notice></div>}
        </div>
        <div className="ops-sec"><h4>Governance</h4>
          <dl className="ops-kv">
            <dt>Owner</dt><dd>{p.owner_role}</dd>
            <dt>Approved by</dt><dd>{p.approver_role}</dd>
            <dt>Next review</dt><dd>{fmtDate(p.review_date)} <span className="muted small">({due(p.review_date)})</span></dd>
            <dt>Satisfies</dt><dd><div className="chips">{(p.refs ?? []).map((r: string) => <span key={r} className="chip mono">{r}</span>)}</div></dd>
          </dl>
        </div>
        <div className="ops-sec"><h4>Policy text</h4><p className="small muted" style={{ marginBottom: 10 }}>{p.summary}</p><Markdown text={p.body ?? ''} /></div>
        <div className="ops-sec"><h4>Acknowledgements · {p.attested} of {p.audience_size}</h4>
          <Meter parts={[{ value: p.attested, color: 'var(--pass)' }, { value: Math.max(0, p.audience_size - p.attested), color: 'transparent' }]} label={`${p.audience_size ? Math.round((p.attested / p.audience_size) * 100) : 0}%`} />
          <div className="stack tight" style={{ marginTop: 12 }}>
            {(p.attestations ?? []).map((a: any, i: number) => (
              <div key={i} className="row"><Avatar name={a.name} size="sm" /><div className="grow small"><b>{a.name}</b> <span className="muted">· {a.role}</span></div><span className="flag ok"><CheckCircle2 size={12} />{ago(a.attested_at)}</span></div>
            ))}
            {(p.pending ?? []).map((a: any, i: number) => (
              <div key={`p${i}`} className="row"><Avatar name={a.name} size="sm" /><div className="grow small"><b>{a.name}</b> <span className="muted">· {a.role}</span></div><span className="flag mute"><Clock size={12} />Pending</span></div>
            ))}
            {(p.attestations ?? []).length + (p.pending ?? []).length === 0 && <span className="small muted">No signed-in staff in this audience yet.</span>}
          </div>
        </div>
      </>}
    </Drawer>
  );
}
