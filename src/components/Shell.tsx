import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Inbox, ShieldAlert, Building2, ListChecks, Stamp, Siren, Server, PlayCircle, ScrollText,
  FileBarChart2, Network, BookOpen, Bell, Search, Menu, LogOut, BellRing, ChevronDown, X,
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
  const loc = useLocation();
  useEffect(() => { setOpen(false); setMenu(false); }, [loc.pathname]);

  const work = useRpc<any>('grc_my_work', { p_org: orgId }, { poll: 15000 });
  const taskCount = (work.data?.tasks?.length ?? 0) + (work.data?.incidents?.length ?? 0);
  const approvals = (work.data?.tasks ?? []).filter((t: any) => t.task === 'approve' || t.task === 'post_review').length;

  const nav: { section: string; items: NavItem[] }[] = [
    { section: 'Operate', items: [
      { to: '/', label: 'Overview', icon: <LayoutDashboard size={17} /> },
      { to: '/workspace', label: 'My Workspace', icon: <Inbox size={17} />, count: taskCount, hot: taskCount > 0 },
      { to: '/approvals', label: 'Approval Center', icon: <Stamp size={17} />, count: approvals, hot: approvals > 0 },
      { to: '/incidents', label: 'Incidents', icon: <Siren size={17} /> },
      { to: '/actions', label: 'Action Plans', icon: <ListChecks size={17} /> },
    ]},
    { section: 'Risk', items: [
      { to: '/risks', label: 'Risk Portfolio', icon: <ShieldAlert size={17} /> },
      { to: '/departments', label: 'Departments', icon: <Building2 size={17} /> },
      { to: '/assets', label: 'Assets & Devices', icon: <Server size={17} /> },
    ]},
    { section: 'Assurance', items: [
      { to: '/scenarios', label: 'Scenario Center', icon: <PlayCircle size={17} /> },
      { to: '/audit', label: 'Audit Trail', icon: <ScrollText size={17} /> },
      { to: '/reports', label: 'Reports', icon: <FileBarChart2 size={17} /> },
    ]},
    { section: 'Configure', items: [
      { to: '/organisation', label: 'Organisation & Roles', icon: <Network size={17} /> },
      { to: '/guide', label: 'Guide & Settings', icon: <BookOpen size={17} /> },
    ]},
  ];
  const flat = nav.flatMap(n => n.items);
  const here = flat.find(i => i.to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(i.to));

  return (
    <div className="app">
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Main navigation">
        <div className="brand">
          <div className="brand-mark">NT</div>
          <div><div className="brand-name">NOVATECH</div><div className="brand-sub">Risk Governance Platform</div></div>
          <button className="iconbtn mobile-only" style={{ marginLeft: 'auto', color: '#fff' }} onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>
        {memberships.length > 1 && (
          <div className="org-switch">
            <select value={orgId} onChange={e => setOrg(e.target.value)} aria-label="Organisation">
              {memberships.map(m => <option key={m.org_id} value={m.org_id}>{m.org_name}</option>)}
            </select>
          </div>
        )}
        <nav className="nav">
          {nav.map(sec => (
            <div key={sec.section}>
              <div className="nav-section">{sec.section}</div>
              {sec.items.map(i => (
                <NavLink key={i.to} to={i.to} end={i.to === '/'}>
                  {i.icon}<span>{i.label}</span>
                  {!!i.count && <span className={`count ${i.hot ? 'hot' : ''}`}>{i.count}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          {current?.kind === 'template'
            ? <>Fictional banking template — same engine, different organisation and policy.</>
            : <>ESAIP · Risk Management · Group 1<br />Academic demonstration. Actions are simulated unless labelled “Executed on enrolled test device”.</>}
        </div>
      </aside>
      {open && <div className="overlay mobile-only" style={{ zIndex: 65 }} onClick={() => setOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="iconbtn mobile-only" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={19} /></button>
          <div className="crumbs desktop-only">{current?.org_name} / <b>{here?.label ?? 'Detail'}</b></div>
          <div className="spacer desktop-only" />
          <GlobalSearch />
          <button className="iconbtn" onClick={() => setNotifOpen(true)} aria-label="Notifications"><NotifBell /></button>
          <div style={{ position: 'relative' }}>
            <button className="user-chip" onClick={() => setMenu(m => !m)} aria-haspopup="menu">
              <Avatar name={current?.full_name} size="sm" />
              <span className="who desktop-only"><b>{current?.full_name}</b><span>{current?.role}</span></span>
              <ChevronDown size={14} className="desktop-only" />
            </button>
            {menu && (
              <div className="card" style={{ position: 'absolute', right: 0, top: 44, width: 280, zIndex: 60, boxShadow: 'var(--shadow-lg)' }} role="menu">
                <div style={{ padding: 14 }} className="stack tight">
                  <div className="strong">{current?.full_name}</div>
                  <div className="small muted">{current?.role} · {current?.department}</div>
                  {current?.is_student && <div><Badge tone="accent">Demonstration role</Badge></div>}
                  {current?.delegated_roles?.map((d, i) => <div key={i}><Badge tone="info">Acting for {d.from} ({d.role})</Badge></div>)}
                </div>
                <div className="divider" />
                <button className="btn ghost block" style={{ justifyContent: 'flex-start', borderRadius: 0, height: 40 }} onClick={signOut}><LogOut size={16} /> Sign out</button>
              </div>
            )}
          </div>
        </header>
        <main className="content">{children}</main>
      </div>

      <nav className="bottom-nav" aria-label="Quick navigation">
        <NavLink to="/" end><LayoutDashboard size={19} />Overview</NavLink>
        <NavLink to="/workspace"><Inbox size={19} />Tasks{taskCount > 0 && <span className="count">{taskCount}</span>}</NavLink>
        <NavLink to="/approvals"><Stamp size={19} />Approvals</NavLink>
        <NavLink to="/incidents"><Siren size={19} />Incidents</NavLink>
        <NavLink to="/actions"><ListChecks size={19} />Actions</NavLink>
      </nav>
      {notifOpen && <NotificationDrawer onClose={() => setNotifOpen(false)} />}
    </div>
  );
}

/* ---------------- Search ---------------- */
function GlobalSearch() {
  const { orgId } = useSession();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState<{ label: string; sub: string; to: string }[] | null>(null);
  const nav = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  async function ensure() {
    if (idx) return;
    const [a, i, r] = await Promise.all([rpc<any[]>('grc_actions', { p_org: orgId, p_include_archived: true }), rpc<any[]>('grc_incidents', { p_org: orgId, p_include_archived: true }), rpc<any[]>('grc_risks', { p_org: orgId })]);
    setIdx([
      ...r.map(x => ({ label: `${x.code} · ${x.title}`, sub: `Risk · score ${x.score}`, to: `/risks?r=${x.id}` })),
      ...i.map(x => ({ label: `${x.ref} · ${x.title}`, sub: `Incident · ${x.status}${x.archived ? ' · archived' : ''}`, to: `/incidents/${x.id}` })),
      ...a.map(x => ({ label: `${x.ref} · ${x.title}`, sub: `Action · ${x.type_name} · ${x.status}`, to: `/actions/${x.id}` })),
    ]);
  }
  useEffect(() => { setIdx(null); }, [orgId]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setQ(''); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);
  const res = useMemo(() => !q || !idx ? [] : idx.filter(x => (x.label + ' ' + x.sub).toLowerCase().includes(q.toLowerCase())).slice(0, 12), [q, idx]);
  return (
    <div className="search" ref={ref}>
      <Search size={15} />
      <input placeholder="Search risks, incidents, actions…" value={q} onFocus={ensure} onChange={e => setQ(e.target.value)} aria-label="Search" />
      {q && (
        <div className="search-results">
          {!idx ? <div style={{ padding: 12 }} className="small muted">Loading…</div> :
            res.length === 0 ? <div style={{ padding: 12 }} className="small muted">No match</div> :
            res.map(r => <a key={r.to} href={r.to} onClick={e => { e.preventDefault(); setQ(''); nav(r.to); }}><div>{r.label}</div><div className="xs muted">{r.sub}</div></a>)}
        </div>
      )}
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
    if (seen.current === null) { seen.current = ids; return; } // baseline: do not announce history
    const fresh = data.items.filter(i => !seen.current!.has(i.id) && !i.read_at);
    seen.current = ids;
    if (fresh.length === 0) return;
    bump();
    const shown: number[] = [];
    for (const n of fresh.slice(0, 3)) {
      toast('info', `${n.title}${n.body ? ' — ' + n.body : ''}`);
      try {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(n.title, { body: n.body ?? '', tag: `grc-${n.id}` });
          shown.push(n.id);
        }
      } catch { /* some mobile browsers only allow notifications from a service worker */ }
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
    else if (n.entity_type === 'delegation') nav('/workspace');
  }
  return (
    <>
      <div className="overlay" style={{ background: 'rgba(9,15,30,.25)' }} onClick={onClose} />
      <aside className="drawer" aria-label="Notifications">
        <div className="drawer-head">
          <div><b>Notifications</b><div className="xs muted">Routed to you by role, assignment and RACI</div></div>
          <div className="row">
            <button className="btn sm" onClick={async () => { await rpc('grc_notifications_mark', { p_ids: null, p_mode: 'read' }); reload(); }}>Mark all read</button>
            <button className="iconbtn" onClick={onClose} aria-label="Close"><X size={18} /></button>
          </div>
        </div>
        <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
          {perm === 'granted' ? <div className="small row"><BellRing size={15} color="var(--success)" /> Browser alerts enabled while this app is open.</div>
            : perm === 'unsupported' ? <div className="small muted">This browser does not support notifications; the in-app centre remains available.</div>
            : <div className="row between"><span className="small muted">Also show alerts as browser notifications?</span>
                <button className="btn sm" onClick={async () => setPerm(await Notification.requestPermission())}>Enable</button></div>}
        </div>
        <div className="drawer-body">
          {!data ? <div style={{ padding: 16 }} className="small muted">Loading…</div> :
            data.items.length === 0 ? <div className="empty">No notifications yet.</div> :
            data.items.map(n => (
              <div key={n.id} className={`notif ${n.read_at ? '' : 'unread'}`} onClick={() => open(n)} role="button" tabIndex={0}>
                <span className="nd" />
                <div className="grow">
                  <div className="strong small">{n.title}</div>
                  {n.body && <div className="small muted" style={{ marginTop: 2 }}>{n.body}</div>}
                  <div className="xs muted" style={{ marginTop: 4 }}>{ago(n.created_at)}{n.browser_shown_at && ' · shown as browser alert'}{n.org_id === 'BK' && ' · Bank template'}</div>
                </div>
              </div>
            ))}
        </div>
      </aside>
    </>
  );
}
