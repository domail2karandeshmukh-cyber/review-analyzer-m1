import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Inbox, ShieldAlert, Building2, ListChecks, Stamp, Siren, Server, PlayCircle, ScrollText,
  FileBarChart2, Network, BookOpen, Bell, Search, Menu, LogOut, BellRing, ChevronDown, X, Moon, Sun, CornerDownLeft,
} from 'lucide-react';
import { useRpc, useSession } from '../lib/session';
import { rpc } from '../lib/supabase';
import { ago } from '../lib/format';
import { Avatar, Badge, useToast } from './ui';

type NavItem = { to: string; label: string; icon: ReactNode; count?: number; hot?: boolean };

function useTheme() {
  const [t, setT] = useState<string>(() => { try { return localStorage.getItem('grc-theme') ?? 'light'; } catch { return 'light'; } });
  useEffect(() => { document.documentElement.dataset.theme = t; try { localStorage.setItem('grc-theme', t); } catch { /* ignore */ } }, [t]);
  return [t, setT] as const;
}

export function Shell({ children }: { children: ReactNode }) {
  const { current, memberships, setOrg, signOut, orgId } = useSession();
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [cmd, setCmd] = useState(false);
  const [theme, setTheme] = useTheme();
  const loc = useLocation();
  useEffect(() => { setOpen(false); setMenu(false); }, [loc.pathname]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmd(c => !c); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);

  const work = useRpc<any>('grc_my_work', { p_org: orgId }, { poll: 15000 });
  const taskCount = (work.data?.tasks?.length ?? 0) + (work.data?.incidents?.length ?? 0);
  const approvals = (work.data?.tasks ?? []).filter((t: any) => ['approve', 'post_review', 'assess'].includes(t.task)).length;

  const nav: { section: string; items: NavItem[] }[] = [
    { section: 'Act', items: [
      { to: '/', label: 'Briefing', icon: <LayoutDashboard size={17} /> },
      { to: '/workspace', label: 'My workspace', icon: <Inbox size={17} />, count: taskCount, hot: taskCount > 0 },
      { to: '/approvals', label: 'Approval center', icon: <Stamp size={17} />, count: approvals, hot: approvals > 0 },
      { to: '/incidents', label: 'Incidents', icon: <Siren size={17} /> },
      { to: '/actions', label: 'Action plans', icon: <ListChecks size={17} /> },
    ]},
    { section: 'Understand risk', items: [
      { to: '/risks', label: 'Risk portfolio', icon: <ShieldAlert size={17} /> },
      { to: '/departments', label: 'Departments', icon: <Building2 size={17} /> },
      { to: '/assets', label: 'Assets and devices', icon: <Server size={17} /> },
    ]},
    { section: 'Prove', items: [
      { to: '/scenarios', label: 'Scenario center', icon: <PlayCircle size={17} /> },
      { to: '/audit', label: 'Audit trail', icon: <ScrollText size={17} /> },
      { to: '/reports', label: 'Reports', icon: <FileBarChart2 size={17} /> },
    ]},
    { section: 'Configure', items: [
      { to: '/organisation', label: 'Organisation and roles', icon: <Network size={17} /> },
      { to: '/guide', label: 'Guide', icon: <BookOpen size={17} /> },
    ]},
  ];

  return (
    <div className="app">
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Main navigation">
        <div className="brand">
          <div className="brand-mark">NT</div>
          <div><div className="brand-name">NOVATECH</div><div className="brand-sub">Risk governance</div></div>
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
            ? 'Fictional banking template: same engine, different organisation and policy.'
            : 'ESAIP Risk Management, Group 1. Executions are simulated unless a device reports them.'}
        </div>
      </aside>
      {open && <div className="overlay mobile-only" style={{ zIndex: 90 }} onClick={() => setOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="iconbtn mobile-only" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={19} /></button>
          <div className="acting desktop-only">
            <span>Acting as <b>{current?.role}</b></span>
            {current?.kind === 'template' && <Badge tone="warning">Fictional bank</Badge>}
            {current?.delegated_roles?.map((d, i) => <Badge key={i} tone="info">Also acting for {d.from}</Badge>)}
          </div>
          <div className="spacer desktop-only" />
          <button className="cmd-trigger" onClick={() => setCmd(true)} aria-label="Search and commands"><Search size={15} /><span>Find or do anything</span><kbd className="desktop-only">Ctrl K</kbd></button>
          <button className="iconbtn" onClick={() => setNotifOpen(true)} aria-label="Notifications"><NotifBell /></button>
          <div style={{ position: 'relative' }}>
            <button className="user-chip" onClick={() => setMenu(m => !m)} aria-haspopup="menu">
              <Avatar name={current?.full_name} size="sm" />
              <span className="who desktop-only"><b>{current?.full_name}</b><span>{current?.department}</span></span>
              <ChevronDown size={14} className="desktop-only" />
            </button>
            {menu && (
              <div className="card" style={{ position: 'absolute', right: 0, top: 44, width: 290, zIndex: 60, boxShadow: 'var(--float)' }} role="menu">
                <div style={{ padding: 16 }} className="stack tight">
                  <div className="row"><Avatar name={current?.full_name} size="lg" /><div><div className="strong">{current?.full_name}</div><div className="small muted">{current?.role}</div></div></div>
                  {current?.is_student && <div className="xs muted">Demonstration role assigned to a Group 1 member.</div>}
                </div>
                <div className="divider" style={{ margin: 0 }} />
                <button className="btn ghost block" style={{ justifyContent: 'flex-start', borderRadius: 0, height: 42 }} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}{theme === 'dark' ? 'Light mode' : 'Control-room dark mode'}</button>
                <button className="btn ghost block" style={{ justifyContent: 'flex-start', borderRadius: 0, height: 42 }} onClick={signOut}><LogOut size={16} />Sign out</button>
              </div>
            )}
          </div>
        </header>
        <main className="content">{children}</main>
      </div>

      <nav className="bottom-nav" aria-label="Quick navigation">
        <NavLink to="/" end><LayoutDashboard size={19} />Briefing</NavLink>
        <NavLink to="/workspace"><Inbox size={19} />My tasks{taskCount > 0 && <span className="count">{taskCount}</span>}</NavLink>
        <NavLink to="/approvals"><Stamp size={19} />Approvals</NavLink>
        <NavLink to="/incidents"><Siren size={19} />Incidents</NavLink>
        <NavLink to="/actions"><ListChecks size={19} />Actions</NavLink>
      </nav>
      {notifOpen && <NotificationDrawer onClose={() => setNotifOpen(false)} />}
      {cmd && <CommandPalette onClose={() => setCmd(false)} items={nav.flatMap(n => n.items)} />}
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
