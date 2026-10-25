import { useState } from 'react';
import { Crown, ShieldCheck, Users, KeyRound } from 'lucide-react';
import { rpc } from '../lib/supabase';
import { useRpc } from '../lib/session';
import { ago, fmtDate } from '../lib/format';
import { Avatar, Card, ErrorBox, Loading, Notice, PageHead, useToast } from '../components/ui';
import { LEVEL_LABEL } from '../components/Shell';

const TIERS = [
  { k: 'owner', icon: <Crown size={18} />, t: 'Owner', d: 'Created the platform. Grants and removes administrator access. There is exactly one owner and the level cannot be changed from the app.' },
  { k: 'admin', icon: <ShieldCheck size={18} />, t: 'Admin', d: 'Helps run the platform: manages member access and configuration. Cannot create other administrators.' },
  { k: 'member', icon: <Users size={18} />, t: 'Member', d: 'Works within their business role: assessments, approvals and executions follow the authority of that role.' },
];

export default function Access() {
  const { data, error, reload } = useRpc<any>('grc_platform_access', {});
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Card><Loading rows={8} /></Card>;
  const me = data.me as string;
  const owner = data.users.find((u: any) => u.level === 'owner');
  const set = async (u: any, level: string) => {
    setBusy(u.user_id);
    try { await rpc('grc_platform_set_level', { p_user: u.user_id, p_level: level }); toast('ok', `${u.name} is now ${LEVEL_LABEL[level]}`); reload(); }
    catch (e: any) { toast('err', e.message); } finally { setBusy(null); }
  };
  const team = data.users.filter((u: any) => u.is_student);
  const others = data.users.filter((u: any) => !u.is_student);

  return (
    <>
      <PageHead title="Team & access" desc="Two separate things decide what someone can do. Platform access (owner, admin, member) decides who runs the platform. The business role (CEO, CFO, RSSI…) decides what they may assess, approve or execute." />

      {owner && (
        <div className="ac-owner">
          <div className="ac-glow" aria-hidden />
          <Avatar name={owner.name} size="lg" />
          <div style={{ minWidth: 0 }}>
            <div className="row" style={{ gap: 8 }}><span className="lvl owner"><Crown size={11} />Owner</span><span className="xs muted">{owner.note}</span></div>
            <div className="ac-name">{owner.name}</div>
            <div className="small muted">Designed and built NOVATECH IRM · business role {owner.business_role}</div>
          </div>
        </div>
      )}

      <div className="grid g3" style={{ marginTop: 16 }}>
        {TIERS.map(t => (
          <div key={t.k} className="card" style={{ padding: 18 }}>
            <div className="row" style={{ gap: 10 }}><span className="hh-ic" style={{ width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center' }}>{t.icon}</span><b style={{ fontSize: 15 }}>{t.t}</b>
              <span className="xs muted" style={{ marginLeft: 'auto' }}>{data.users.filter((u: any) => u.level === t.k).length}</span></div>
            <p className="small muted" style={{ marginTop: 10, lineHeight: 1.5 }}>{t.d}</p>
          </div>
        ))}
      </div>

      {me === 'member' && <div style={{ marginTop: 16 }}><Notice>You can see who has which access. Only the owner and administrators can change it.</Notice></div>}

      <Section title="Group 1 team" sub="The six people presenting the platform" users={team} me={me} busy={busy} set={set} />
      <Section title="Case-study staff" sub="Supporting NOVATECH roles used in the scenarios (for example Accounts Payable for the payment hold)" users={others} me={me} busy={busy} set={set} />
      <p className="xs muted" style={{ marginTop: 14 }}><KeyRound size={11} style={{ verticalAlign: -1 }} /> Every change of access is recorded in the hash-chained audit ledger. Nobody can change their own level.</p>
    </>
  );
}

function Section({ title, sub, users, me, busy, set }: { title: string; sub: string; users: any[]; me: string; busy: string | null; set: (u: any, l: string) => void }) {
  return (
    <div style={{ marginTop: 24 }}><Card title={title} sub={sub} flush>
      <div className="table-wrap"><table className="t responsive">
        <thead><tr><th>Person</th><th>Business role</th><th>Platform access</th><th>Granted</th><th>Last sign-in</th></tr></thead>
        <tbody>{users.map(u => {
          const canEdit = u.level !== 'owner' && (me === 'owner' || (me === 'admin' && u.level === 'member'));
          return (
            <tr key={u.user_id}>
              <td className="primary"><span className="person"><Avatar name={u.name} size="sm" /><span><div className="pn">{u.name}</div><div className="pr">{u.email}</div></span></span></td>
              <td data-label="Business role" className="small">{u.business_role ?? '—'}</td>
              <td data-label="Access">
                {canEdit && me === 'owner' ? (
                  <select className="select" style={{ width: 140, height: 30, padding: '2px 8px' }} value={u.level} disabled={busy === u.user_id} onChange={e => set(u, e.target.value)}>
                    <option value="admin">Admin</option><option value="member">Member</option>
                  </select>
                ) : <span className={`lvl ${u.level}`}>{u.level === 'owner' && <Crown size={11} />}{LEVEL_LABEL[u.level]}</span>}
              </td>
              <td data-label="Granted" className="small muted">{u.granted_by ? `${u.granted_by} · ${fmtDate(u.granted_at)}` : u.level === 'owner' ? 'Platform creator' : 'Initial setup'}</td>
              <td data-label="Last sign-in" className="small muted">{u.last_sign_in ? ago(u.last_sign_in) : 'Never'}</td>
            </tr>
          );
        })}</tbody>
      </table></div>
    </Card></div>
  );
}
