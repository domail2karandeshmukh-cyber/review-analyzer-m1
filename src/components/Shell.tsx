import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Inbox, ShieldAlert, Building2, ListChecks, Stamp, Siren, Server, PlayCircle, ScrollText,
  FileBarChart2, Network, BookOpen, Bell, Search, Menu, LogOut, BellRing, ChevronDown, X, CornerDownLeft,
} from 'lucide-react';
import { useRpc, useSession } from '../lib/session';
import { rpc } from '../lib/supabase';
import { ago } from '../lib/format';
import { Avatar, Badge, useToast } from './ui';

type NavItem = { to: string; label: string; icon: ReactNode; count?: number; hot?: boolean };

export function Shell({ children }: { children: ReactNode }) {
  const { current, memberships, setOrg, signOut, orgId } = useSession();
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [more, setMore] = useState(false);
  const [cmd, setCmd] = useState(false);
  const loc = useLocation();
  useEffect(() => { setOpen(false); setMenu(false); setMore(false); }, [loc.pathname]);
  useEffect(() => { document.documentElement.dataset.theme = 'dark'; }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmd(c => !c); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);

  const work = useRpc<any>('grc_my_work', { p_org: orgId }, { poll: 15000 });
  const ov = useRpc<any>('grc_overview', { p_org: orgId }, { poll: 30000 });
  const chain = useRpc<any>('grc_verify_audit_chain', {}, { poll: 120000 });
  const taskCount = (work.data?.tasks?.length ?? 0) + (work.data?.incidents?.length ?? 0);
  const approvals = (work.data?.tasks ?? []).filter((t: any) => ['approve', 'post_review', 'assess'].includes(t.task)).length;
  const isHome = loc.pathname === '/';

  const primary: NavItem[] = [
    { to: '/', label: 'Situation', icon: <LayoutDashboard size={15} /> },
    { to: '/workspace', label: 'My desk', icon: <Inbox size={15} />, count: taskCount },
    { to: '/approvals', label: 'Decisions', icon: <Stamp size={15} />, count: approvals },
    { to: '/incidents', label: 'Incidents', icon: <Siren size={15} /> },
    { to: '/actions', label: 'Actions', icon: <ListChecks size={15} /> },
    { to: '/risks', label: 'Risk', icon: <ShieldAlert size={15} /> },
    { to: '/scenarios', label: 'Scenarios', icon: <PlayCircle size={15} /> },
    { to: '/audit', label: 'Ledger', icon: <ScrollText size={15} /> },
  ];
  const secondary: NavItem[] = [
    { to: '/departments', label: 'Departments', icon: <Building2 size={15} /> },
    { to: '/assets', label: 'Assets and devices', icon: <Server size={15} /> },
    { to: '/reports', label: 'Reports', icon: <FileBarChart2 size={15} /> },
    { to: '/organisation', label: 'Organisation and roles', icon: <Network size={15} /> },
    { to: '/guide', label: 'Guide', icon: <BookOpen size={15} /> },
  ];
  const d = ov.data;

  return (
    <div className="app">
      <header className="topbar">
        <button className="iconbtn mobile-only" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={19} /></button>
        <div className="brand">
          <div className="brand-mark">N</div>
          <div className="desktop-only"><div className="brand-name">NOVATECH</div><div className="brand-sub">{current?.kind === 'template' ? 'Banque Atlantique · fictional' : 'Governance command'}</div></div>
        </div>
        <nav className="topnav" aria-label="Main">
          {primary.map(i => (
            <NavLink key={i.to} to={i.to} end={i.to === '/'}>{i.icon}<span className="lbl">{i.label}</span>{!!i.count && <span className="count">{i.count}</span>}</NavLink>
          ))}
          <div style={{ position: 'relative' }}>
            <a href="#" onClick={e => { e.preventDefault(); setMore(m => !m); }} className={secondary.some(s => loc.pathname.startsWith(s.to)) ? 'active' : ''}><span className="lbl">More</span><ChevronDown size={14} /></a>
            {more && <div className="card" style={{ position: 'absolute', top: 44, left: 0, width: 240, padding: 6, background: '#0b111d', boxShadow: 'var(--float)', zIndex: 60 }}>
              {secondary.map(i => <NavLink key={i.to} to={i.to} style={{ display: 'flex', gap: 10, padding: '9px 10px', borderRadius: 8 }}>{i.icon}{i.label}</NavLink>)}
            </div>}
          </div>
        </nav>
        <div className="spacer" />
        {d && (
          <div className="ticker" aria-label="Live posture">
            <span>EXPOSURE <b>{d.register.case_total ?? d.matrix.reduce((s: number, r: any) => s + r.score, 0)}</b></span>
            {d.register.case_top5 != null && <span>TOP-5 <b>{d.register.case_top5}</b></span>}
            <span>AT STAKE <b className={d.incidents.exposure > 0 ? 'hot' : ''}>{d.incidents.exposure > 0 ? new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(d.incidents.exposure) : '€0'}</b></span>
            <span>CHAIN <b className={chain.data ? (chain.data.ok ? 'ok' : 'bad') : ''}>{chain.data ? (chain.data.ok ? 'INTACT' : 'BROKEN') : '…'}</b></span>
          </div>
        )}
        {memberships.length > 1 && (
          <select className="org-pill desktop-only" value={orgId} onChange={e => setOrg(e.target.value)} aria-label="Organisation">
            {memberships.map(m => <option key={m.org_id} value={m.org_id}>{m.org_id === 'NT' ? 'NOVATECH' : 'Bank (fictional)'}</option>)}
          </select>
        )}
        <button className="cmd-trigger" onClick={() => setCmd(true)} aria-label="Search and commands"><Search size={15} /><kbd className="desktop-only">Ctrl K</kbd></button>
        <button className="iconbtn" onClick={() => setNotifOpen(true)} aria-label="Notifications"><NotifBell /></button>
        <div style={{ position: 'relative' }}>
          <button className="user-chip" onClick={() => setMenu(m => !m)} aria-haspopup="menu">
            <Avatar name={current?.full_name} size="sm" />
            <span className="who desktop-only"><b>{current?.full_name}</b><span>{current?.role}</span></span>
          </button>
          {menu && (
            <div className="card" style={{ position: 'absolute', right: 0, top: 46, width: 300, zIndex: 60, background: '#0b111d', boxShadow: 'var(--float)' }} role="menu">
              <div style={{ padding: 18 }} className="stack tight">
                <div className="row"><Avatar name={current?.full_name} size="lg" /><div><div className="serif" style={{ fontSize: 22 }}>{current?.full_name}</div><div className="small muted">{current?.role}</div></div></div>
                <div className="xs muted">{current?.department}{current?.is_student ? ' · demonstration role (Group 1)' : ''}</div>
                {current?.delegated_roles?.map((x, i) => <Badge key={i} tone="info">Acting for {x.from}</Badge>)}
              </div>
              <div className="divider" style={{ margin: 0 }} />
              <button className="btn ghost block" style={{ justifyContent: 'flex-start', borderRadius: 0, height: 44 }} onClick={signOut}><LogOut size={16} />Sign out</button>
            </div>
          )}
        </div>
      </header>
      <main className={`content ${isHome ? 'bleed' : ''}`}>{children}</main>

      {open && (
        <div className="mobile-drawer">
          <div className="row between" style={{ marginBottom: 12 }}><div className="brand"><div className="brand-mark">N</div><div><div className="brand-name">NOVATECH</div></div></div><button className="iconbtn" onClick={() => setOpen(false)} aria-label="Close"><X size={20} /></button></div>
          {memberships.length > 1 && <select className="select" value={orgId} onChange={e => setOrg(e.target.value)}>{memberships.map(m => <option key={m.org_id} value={m.org_id}>{m.org_name}</option>)}</select>}
          {[...primary, ...secondary].map(i => <NavLink key={i.to} to={i.to} end={i.to === '/'}>{i.label}{!!i.count && <span className="count" style={{ marginLeft: 8 }}>{i.count}</span>}</NavLink>)}
        </div>
      )}
      <nav className="bottom-nav" aria-label="Quick navigation">
        <NavLink to="/" end><LayoutDashboard size={19} />Situation</NavLink>
        <NavLink to="/workspace"><Inbox size={19} />My desk{taskCount > 0 && <span className="count">{taskCount}</span>}</NavLink>
        <NavLink to="/approvals"><Stamp size={19} />Decisions</NavLink>
        <NavLink to="/incidents"><Siren size={19} />Incidents</NavLink>
        <NavLink to="/audit"><ScrollText size={19} />Ledger</NavLink>
      </nav>
      {notifOpen && <NotificationDrawer onClose={() => setNotifOpen(false)} />}
      {cmd && <CommandPalette onClose={() => setCmd(false)} items={[...primary, ...secondary]} />}
    </div>
  );
}

/* ---------------- Command palette ---------------- */
type Cmd = { group: string; label: string; sub?: string; run: () => void };
function CommandPalette({ onClose, items }: { onClose: () => void; items: NavItem[] }) {
  const { orgId, can, bump, memberships, setOrg } = useSession();
  const nav = useNavigate();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const [idx, setIdx] = useState<Cmd[]>([]);
  const inp = useRef<HTMLInputElement>(null);
  useEffect(() => { inp.current?.focus(); }, []);
  useEffect(() => {
    let live = true;
    Promise.all([rpc<any[]>('grc_actions', { p_org: orgId, p_include_archived: false }), rpc<any[]>('grc_incidents', { p_org: orgId, p_include_archived: false }), rpc<any[]>('grc_risks', { p_org: orgId })])
      .then(([a, inc, r]) => live && setIdx([
        ...inc.map(x => ({ group: 'Incidents', label: `${x.ref} ${x.title}`, sub: x.status, run: () => nav(`/incidents/${x.id}`) })),
        ...a.map(x => ({ group: 'Actions', label: `${x.ref} ${x.title}`, sub: x.next?.title, run: () => nav(`/actions/${x.id}`) })),
        ...r.map(x => ({ group: 'Risks', label: `${x.code} ${x.title}`, sub: `score ${x.score}`, run: () => nav(`/risks?r=${x.id}`) })),
      ])).catch(() => {});
    return () => { live = false; };
  }, [orgId, nav]);
  const base: Cmd[] = [
    ...items.map(n => ({ group: 'Go to', label: n.label, run: () => nav(n.to) })),
    { group: 'Ask', label: 'Who can approve this?', sub: 'Policy engine', run: () => nav('/approvals?tab=who') },
    { group: 'Ask', label: 'Verify audit integrity', sub: 'Hash chain', run: () => nav('/audit?verify=1') },
    ...memberships.filter(m => m.org_id !== orgId).map(m => ({ group: 'Switch', label: `Switch to ${m.org_name}`, sub: m.role, run: () => setOrg(m.org_id) })),
    ...(can('scenario.run') ? (orgId === 'NT' ? ['A', 'B'] : ['C']).map(c => ({ group: 'Do', label: `Start scenario ${c}`, sub: 'Creates a live incident', run: async () => { try { await rpc('grc_scenario_start', { p_code: c }); toast('ok', `Scenario ${c} started`); bump(); nav('/scenarios'); } catch (e: any) { toast('err', e.message); } } })) : []),
  ];
  const list = useMemo(() => {
    const all = [...base, ...idx];
    if (!q) return base;
    const w = q.toLowerCase().split(/\s+/);
    return all.filter(c => w.every(t => (c.label + ' ' + (c.sub ?? '') + ' ' + c.group).toLowerCase().includes(t))).slice(0, 40);
  }, [q, idx, base.length]); // eslint-disable-line
  useEffect(() => setI(0), [q]);
  const go = (c?: Cmd) => { if (!c) return; onClose(); c.run(); };
  let lastGroup = '';
  return (
    <div className="cmdk" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cmdk-box" role="dialog" aria-label="Command bar">
        <input ref={inp} value={q} onChange={e => setQ(e.target.value)} placeholder="Search incidents, actions, risks, or type a command"
          onKeyDown={e => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowDown') { e.preventDefault(); setI(x => Math.min(x + 1, list.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setI(x => Math.max(x - 1, 0)); }
            if (e.key === 'Enter') go(list[i]);
          }} />
        <div className="cmdk-list">
          {list.length === 0 && <div className="empty small">Nothing matches “{q}”.</div>}
          {list.map((c, n) => {
            const head = c.group !== lastGroup ? <div className="cmdk-group">{c.group}</div> : null;
            lastGroup = c.group;
            return <div key={n}>{head}<div className={`cmdk-item ${n === i ? 'on' : ''}`} onMouseEnter={() => setI(n)} onClick={() => go(c)}>
              <span>{c.label}</span>{c.sub && <span className="sub">{c.sub}</span>}{n === i && <CornerDownLeft size={14} />}</div></div>;
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Notifications ---------------- */
type Notif = { id: number; org_id: string; kind: string; title: string; body: string; entity_type: string; entity_id: string; created_at: string; read_at: string | null; browser_shown_at: string | null };

function useNotifications() {
  const { data, reload } = useRpc<{ unread: number; items: Notif[] }>('grc_my_notifications', { p_limit: 60 }, { poll: 8000 });
  return { data, reload };
}

function NotifBell() {
  const { data } = useNotifications();
  const toast = useToast();
  const { bump } = useSession();
  const seen = useRef<Set<number> | null>(null);
  useEffect(() => {
    if (!data) return;
    const ids = new Set(data.items.map(i => i.id));
    if (seen.current === null) { seen.current = ids; return; }
    const fresh = data.items.filter(i => !seen.current!.has(i.id) && !i.read_at);
    seen.current = ids;
    if (fresh.length === 0) return;
    bump();
    const shown: number[] = [];
    for (const n of fresh.slice(0, 3)) {
      toast('info', `${n.title}${n.body ? ': ' + n.body : ''}`);
      try {
        if ('Notification' in window && Notification.permission === 'granted') { new Notification(n.title, { body: n.body ?? '', tag: `grc-${n.id}` }); shown.push(n.id); }
      } catch { /* mobile browsers may require a service worker */ }
    }
    if (shown.length) rpc('grc_notifications_mark', { p_ids: shown, p_mode: 'shown' }).catch(() => {});
  }, [data, toast, bump]);
  return <><Bell size={18} />{!!data?.unread && <span className="dot">{data.unread > 99 ? '99+' : data.unread}</span>}</>;
}

function NotificationDrawer({ onClose }: { onClose: () => void }) {
  const { data, reload } = useNotifications();
  const nav = useNavigate();
  const { setOrg, orgId } = useSession();
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  async function open(n: Notif) {
    await rpc('grc_notifications_mark', { p_ids: [n.id], p_mode: 'read' }).catch(() => {});
    if (n.org_id !== orgId) setOrg(n.org_id);
    onClose();
    if (n.entity_type === 'action') nav(`/actions/${n.entity_id}`);
    else if (n.entity_type === 'incident') nav(`/incidents/${n.entity_id}`);
    else if (n.entity_type === 'risk') nav(`/risks?r=${n.entity_id}`);
    else nav('/workspace');
  }
  return (
    <>
      <div className="overlay" style={{ background: 'rgba(10,18,36,.25)' }} onClick={onClose} />
      <aside className="drawer" aria-label="Notifications">
        <div className="drawer-head">
          <div><b>Notifications</b><div className="xs muted">Sent to you because of your role, an assignment or the RACI</div></div>
          <div className="row">
            <button className="btn sm" onClick={async () => { await rpc('grc_notifications_mark', { p_ids: null, p_mode: 'read' }); reload(); }}>Mark all read</button>
            <button className="iconbtn" onClick={onClose} aria-label="Close"><X size={18} /></button>
          </div>
        </div>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--line)' }}>
          {perm === 'granted' ? <div className="small row"><BellRing size={15} color="var(--seal)" />Browser alerts are on while this app is open.</div>
            : perm === 'unsupported' ? <div className="small muted">This browser has no notification support. This list stays available.</div>
            : <div className="row between"><span className="small muted">Also show alerts as browser notifications?</span><button className="btn sm" onClick={async () => setPerm(await Notification.requestPermission())}>Turn on</button></div>}
        </div>
        <div className="drawer-body">
          {!data ? <div style={{ padding: 18 }} className="small muted">Loading notifications</div> :
            data.items.length === 0 ? <div className="empty">No notifications yet.</div> :
            data.items.map(n => (
              <div key={n.id} className={`notif ${n.read_at ? '' : 'unread'}`} onClick={() => open(n)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && open(n)}>
                <span className="nd" />
                <div className="grow">
                  <div className="strong small">{n.title}</div>
                  {n.body && <div className="small muted" style={{ marginTop: 2 }}>{n.body}</div>}
                  <div className="xs muted" style={{ marginTop: 4 }}>{ago(n.created_at)}{n.browser_shown_at && ', shown as a browser alert'}{n.org_id === 'BK' && ', bank template'}</div>
                </div>
              </div>
            ))}
        </div>
      </aside>
    </>
  );
}
