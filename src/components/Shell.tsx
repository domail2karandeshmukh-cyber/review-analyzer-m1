import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Home, Inbox, ShieldAlert, Building2, ListChecks, Stamp, Siren, Server, PlayCircle, ScrollText, FileBarChart2, Network, BookOpen, Bell, Search, Menu,
  LogOut, BellRing, X, CornerDownLeft, MonitorPlay, Radar, Calculator, Scale, ShieldCheck, FileText, Truck, LifeBuoy, Presentation, ChevronDown,
  Sun, Moon, Waypoints, KeyRound, Compass,
} from 'lucide-react';
import { useRpc, useSession } from '../lib/session';
import { rpc } from '../lib/supabase';
import { ago } from '../lib/format';
import { Avatar, Badge, useToast } from './ui';
import { TourProvider, useTour } from './Tour';

type NavItem = { to: string; label: string; icon: ReactNode; desc?: string; count?: number; isNew?: boolean };
type Group = { label: string; key: string; blurb: string; items: NavItem[] };

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="logo" style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2.8 18.6 5.4v4.9c0 4-2.7 7.4-6.6 9.1-3.9-1.7-6.6-5.1-6.6-9.1V5.4Z" /><path d="m9 11.6 2.1 2.1 4-4.2" />
      </svg>
    </span>
  );
}

export function useTheme() {
  const [theme, setTheme] = useState<string>(() => document.documentElement.dataset.theme || 'light');
  useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem('grc-theme3', theme); } catch { /* ignore */ } }, [theme]);
  return [theme, () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))] as const;
}

export const LEVEL_LABEL: Record<string, string> = { owner: 'Lead', admin: 'Admin', member: 'Member' };

export function useNavGroups(): Group[] {
  const { orgId } = useSession();
  const work = useRpc<any>('grc_my_work', { p_org: orgId }, { poll: 15000 });
  const taskCount = (work.data?.tasks?.length ?? 0) + (work.data?.incidents?.length ?? 0);
  const approvals = (work.data?.tasks ?? []).filter((t: any) => ['approve', 'post_review', 'assess'].includes(t.task)).length;
  return [
    { label: 'Overview', key: 'overview', blurb: 'Where you stand and what needs you.', items: [
      { to: '/', label: 'Home', icon: <Home size={17} />, desc: 'Your priorities and the posture at a glance' },
      { to: '/workspace', label: 'My work', icon: <Inbox size={17} />, desc: 'Decisions and tasks routed to you', count: taskCount },
      { to: '/live', label: 'Live operations', icon: <Waypoints size={17} />, desc: 'Who holds each decision, right now' },
    ] },
    { label: 'Risk', key: 'risk', blurb: 'Identify, analyse and put a price on risk.', items: [
      { to: '/risks', label: 'Risk register', icon: <ShieldAlert size={17} />, desc: 'Scores, owners, KRIs and treatment' },
      { to: '/ebios', label: 'EBIOS RM study', icon: <Radar size={17} />, desc: 'The five ANSSI workshops, end to end', isNew: true },
      { to: '/quant', label: 'Quantification', icon: <Calculator size={17} />, desc: 'Monte Carlo loss in euros, value of controls', isNew: true },
    ] },
    { label: 'Compliance', key: 'compliance', blurb: 'One control set, every framework.', items: [
      { to: '/compliance', label: 'Frameworks', icon: <Scale size={17} />, desc: 'ISO 27001, NIS2, GDPR, DORA coverage', isNew: true },
      { to: '/controls', label: 'Controls', icon: <ShieldCheck size={17} />, desc: 'Library and continuous monitoring', isNew: true },
      { to: '/policies', label: 'Policies', icon: <FileText size={17} />, desc: 'Approved rules and acknowledgements', isNew: true },
    ] },
    { label: 'Operations', key: 'ops', blurb: 'From detection to verified response.', items: [
      { to: '/incidents', label: 'Incidents', icon: <Siren size={17} />, desc: 'Investigation and regulatory clocks' },
      { to: '/actions', label: 'Action plans', icon: <ListChecks size={17} />, desc: 'Treatment and response, owner to proof' },
      { to: '/approvals', label: 'Approvals', icon: <Stamp size={17} />, desc: 'Policy-routed decisions, dual control', count: approvals },
      { to: '/vendors', label: 'Third parties', icon: <Truck size={17} />, desc: 'Supplier tiers and the DORA register', isNew: true },
      { to: '/continuity', label: 'Continuity', icon: <LifeBuoy size={17} />, desc: 'BIA, recovery targets, dependencies', isNew: true },
    ] },
    { label: 'Assurance', key: 'assurance', blurb: 'Prove it to the board and the auditor.', items: [
      { to: '/board', label: 'Board pack', icon: <Presentation size={17} />, desc: 'Print-ready report from live data', isNew: true },
      { to: '/audit', label: 'Audit ledger', icon: <ScrollText size={17} />, desc: 'Hash-chained, tamper-evident history' },
      { to: '/reports', label: 'Reports', icon: <FileBarChart2 size={17} />, desc: 'Register and treatment reports' },
      { to: '/scenarios', label: 'Scenarios', icon: <PlayCircle size={17} />, desc: 'Run a live incident rehearsal' },
    ] },
    { label: 'Workspace', key: 'workspace', blurb: 'People, structure and access.', items: [
      { to: '/access', label: 'Team & access', icon: <KeyRound size={17} />, desc: 'Owner, admins and members' },
      { to: '/organisation', label: 'Organisation', icon: <Network size={17} />, desc: 'Roles, reporting lines, approval policy' },
      { to: '/assets', label: 'Assets', icon: <Server size={17} />, desc: 'Supporting systems and devices' },
      { to: '/departments', label: 'Departments', icon: <Building2 size={17} />, desc: 'Who owns which risks' },
      { to: '/guide', label: 'Guide', icon: <BookOpen size={17} />, desc: 'Presenter notes and answers' },
    ] },
  ];
}

export function Shell({ children }: { children: ReactNode }) {
  return <TourProvider><ShellInner>{children}</ShellInner></TourProvider>;
}

function ShellInner({ children }: { children: ReactNode }) {
  const { current, memberships, setOrg, signOut, orgId } = useSession();
  const [mobile, setMobile] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [mega, setMega] = useState<string | null>(null);
  const [cmd, setCmd] = useState(false);
  const [theme, toggleTheme] = useTheme();
  const tour = useTour();
  const loc = useLocation();
  const groups = useNavGroups();
  const closeT = useRef<number | null>(null);
  useEffect(() => { setMobile(false); setMenu(false); setMega(null); window.scrollTo(0, 0); }, [loc.pathname]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmd(c => !c); }
      if (e.key === 'Escape') { setMega(null); setMenu(false); }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
  const chain = useRpc<any>('grc_verify_audit_chain', {}, { poll: 120000 });
  const isBleed = loc.pathname === '/live';
  const flat = groups.flatMap(g => g.items.map(i => ({ ...i, group: g.label, gkey: g.key })));
  const here = flat.filter(i => (i.to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(i.to))).sort((a, b) => b.to.length - a.to.length)[0];
  const tasks = groups[0].items[1].count ?? 0;
  const section = groups.find(g => g.key === here?.gkey);
  const openMega = (k: string) => { if (closeT.current) window.clearTimeout(closeT.current); setMega(k); };
  const leaveMega = () => { if (closeT.current) window.clearTimeout(closeT.current); closeT.current = window.setTimeout(() => setMega(null), 160); };
  const mg = groups.find(g => g.key === mega);

  return (
    <div className="app2">
      <header className="nav" onMouseLeave={leaveMega}>
        <div className="nav-in">
          <button className="iconbtn mobile-only" onClick={() => setMobile(true)} aria-label="Open menu"><Menu size={18} /></button>
          <Link to="/" className="nav-brand" aria-label="NOVATECH IRM home"><Logo /><span>NOVATECH<em>IRM</em></span></Link>
          <nav className="nav-links desktop-only" aria-label="Main">
            {groups.map(g => (
              <button key={g.key} className={`nav-l ${section?.key === g.key ? 'on' : ''} ${mega === g.key ? 'open' : ''}`}
                onMouseEnter={() => openMega(g.key)} onFocus={() => openMega(g.key)} onClick={() => setMega(m => (m === g.key ? null : g.key))} aria-expanded={mega === g.key}>
                {g.label}<ChevronDown size={13} />
                {g.items.some(i => i.count) && <span className="nav-dot" />}
              </button>
            ))}
          </nav>
          <div className="nav-sp" />
          <button className="nav-search" onClick={() => setCmd(true)}><Search size={14} /><span className="desktop-only">Search</span><kbd className="desktop-only">Ctrl K</kbd></button>
          <Link to="/present" className="iconbtn desktop-only" title="Present mode"><MonitorPlay size={16} /></Link>
          <button className="iconbtn" onClick={() => setNotifOpen(true)} aria-label="Notifications"><NotifBell /></button>
          <div style={{ position: 'relative' }}>
            <button className="nav-me" onClick={() => setMenu(m => !m)} aria-haspopup="menu" title={current?.full_name}>
              <Avatar name={current?.full_name} size="sm" />
            </button>
            {menu && (
              <div className="menu-pop" role="menu">
                <div className="mp-head">
                  <Avatar name={current?.full_name} size="lg" />
                  <div style={{ minWidth: 0 }}>
                    <div className="strong" style={{ fontSize: 14 }}>{current?.full_name}</div>
                    <div className="xs muted">{current?.role}</div>
                    {!!current?.delegated_roles?.length && <div className="row" style={{ gap: 6, marginTop: 6 }}>
                      {current.delegated_roles.map((x, i) => <Badge key={i} tone="info">Acting for {x.from}</Badge>)}
                    </div>}
                  </div>
                </div>
                {memberships.length > 1 && (
                  <div style={{ padding: '0 12px 10px' }}>
                    <div className="xs muted" style={{ marginBottom: 4 }}>Organisation</div>
                    <select className="select" value={orgId} onChange={e => setOrg(e.target.value)} aria-label="Organisation">
                      {memberships.map(m => <option key={m.org_id} value={m.org_id}>{m.org_id === 'NT' ? 'NOVATECH Services' : 'Banque Atlantique (fictional)'}</option>)}
                    </select>
                  </div>
                )}
                <div className="mp-list">
                  <Link to="/access" className="mp-i"><KeyRound size={15} />Team & access</Link>
                  <button className="mp-i" onClick={() => { setMenu(false); tour.start(); }}><Compass size={15} />Guided tour</button>
                  <button className="mp-i" onClick={toggleTheme}>{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}{theme === 'dark' ? 'Light theme' : 'Dark theme'}</button>
                  <Link to="/guide" className="mp-i"><BookOpen size={15} />Guide</Link>
                  <button className="mp-i" onClick={signOut}><LogOut size={15} />Sign out</button>
                </div>
              </div>
            )}
          </div>
        </div>
        {mg && (
          <div className="mega desktop-only" onMouseEnter={() => openMega(mg.key)}>
            <div className="mega-in">
              <div className="mega-side">
                <div className="mega-k">{mg.label}</div>
                <div className="mega-b">{mg.blurb}</div>
                {chain.data && <Link to="/audit?verify=1" className={`pill-stat ${chain.data.ok ? '' : 'bad'}`} style={{ marginTop: 14 }}><i />{chain.data.ok ? `Ledger intact · ${chain.data.checked} entries` : 'Ledger broken'}</Link>}
              </div>
              <div className="mega-grid">
                {mg.items.map(i => (
                  <NavLink key={i.to} to={i.to} end={i.to === '/'} className="mega-i">
                    <span className="mi-ic">{i.icon}</span>
                    <span className="mi-t">{i.label}{!!i.count && <span className="count">{i.count}</span>}{i.isNew && <span className="mi-new">New</span>}</span>
                    <span className="mi-d">{i.desc}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          </div>
        )}
        {section && section.items.length > 1 && !isBleed && (
          <div className="subnav">
            <div className="subnav-in" data-title={section.label}>
              {section.items.map(i => (
                <NavLink key={i.to} to={i.to} end={i.to === '/'} className="sn">{i.label}{!!i.count && <span className="count">{i.count}</span>}</NavLink>
              ))}
            </div>
          </div>
        )}
      </header>
      {mega && <div className="mega-scrim desktop-only" onMouseEnter={leaveMega} onClick={() => setMega(null)} />}
      <main className={`page ${isBleed ? 'bleed' : ''}`}>
        {!isBleed && <div className="page-glow" aria-hidden />}
        <div className={isBleed ? '' : 'content'}>{children}</div>
        {!isBleed && (
          <footer className="app-foot">
            <div className="row" style={{ gap: 8 }}><Logo size={20} /><span><b>NOVATECH IRM</b> · ESAIP Group 1</span></div>
            <span>NOVATECH Services is the fictional ESAIP case company · simulated feeds and executions are labelled</span>
          </footer>
        )}
      </main>

      {mobile && (
        <div className="m-menu">
          <div className="row between" style={{ marginBottom: 14 }}>
            <Link to="/" className="nav-brand"><Logo /><span>NOVATECH<em>IRM</em></span></Link>
            <button className="iconbtn" onClick={() => setMobile(false)} aria-label="Close"><X size={20} /></button>
          </div>
          {groups.map(g => (
            <div key={g.key} className="m-g">
              <div className="m-gl">{g.label}</div>
              {g.items.map(i => <NavLink key={i.to} to={i.to} end={i.to === '/'} className="m-i">{i.icon}{i.label}{!!i.count && <span className="count">{i.count}</span>}</NavLink>)}
            </div>
          ))}
        </div>
      )}
      <nav className="bottom-nav" aria-label="Quick navigation">
        <NavLink to="/" end><Home size={19} />Home</NavLink>
        <NavLink to="/workspace"><Inbox size={19} />My work{tasks > 0 && <span className="count">{tasks}</span>}</NavLink>
        <NavLink to="/risks"><ShieldAlert size={19} />Risks</NavLink>
        <NavLink to="/incidents"><Siren size={19} />Incidents</NavLink>
        <a href="#" onClick={e => { e.preventDefault(); setMobile(true); }}><Menu size={19} />More</a>
      </nav>
      {notifOpen && <NotificationDrawer onClose={() => setNotifOpen(false)} />}
      {cmd && <CommandPalette onClose={() => setCmd(false)} items={flat} />}
    </div>
  );
}

/* ---------------- Command palette ---------------- */
type Cmd = { group: string; label: string; sub?: string; run: () => void };
function CommandPalette({ onClose, items }: { onClose: () => void; items: NavItem[] }) {
  const { orgId, can, bump, memberships, setOrg } = useSession();
  const nav = useNavigate();
  const toast = useToast();
  const tour = useTour();
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const [idx, setIdx] = useState<Cmd[]>([]);
  const inp = useRef<HTMLInputElement>(null);
  useEffect(() => { inp.current?.focus(); }, []);
  useEffect(() => {
    let live = true;
    Promise.all([
      rpc<any[]>('grc_actions', { p_org: orgId, p_include_archived: false }), rpc<any[]>('grc_incidents', { p_org: orgId, p_include_archived: false }),
      rpc<any[]>('grc_risks', { p_org: orgId }), rpc<any[]>('grc_controls', { p_org: orgId }).catch(() => []), rpc<any>('grc_vendors', { p_org: orgId }).catch(() => ({ vendors: [] })),
      rpc<any[]>('grc_policies', { p_org: orgId }).catch(() => []),
    ]).then(([a, inc, r, c, v, p]) => live && setIdx([
      ...inc.map(x => ({ group: 'Incidents', label: `${x.ref} ${x.title}`, sub: x.status, run: () => nav(`/incidents/${x.id}`) })),
      ...a.map(x => ({ group: 'Actions', label: `${x.ref} ${x.title}`, sub: x.next?.title, run: () => nav(`/actions/${x.id}`) })),
      ...r.map(x => ({ group: 'Risks', label: `${x.code} ${x.title}`, sub: `score ${x.score}`, run: () => nav(`/risks?r=${x.id}`) })),
      ...c.map((x: any) => ({ group: 'Controls', label: `${x.code} ${x.title}`, sub: x.operating_eff, run: () => nav(`/controls?c=${x.id}`) })),
      ...(v.vendors ?? []).map((x: any) => ({ group: 'Third parties', label: x.name, sub: `${x.tier} tier`, run: () => nav(`/vendors?v=${x.id}`) })),
      ...p.map((x: any) => ({ group: 'Policies', label: `${x.code} ${x.title}`, sub: `v${x.version}`, run: () => nav(`/policies?p=${x.id}`) })),
    ])).catch(() => {});
    return () => { live = false; };
  }, [orgId, nav]);
  const base: Cmd[] = [
    ...items.map(n => ({ group: 'Go to', label: n.label, run: () => nav(n.to) })),
    { group: 'Do', label: 'Start the guided tour', sub: '13 steps · presenter notes', run: () => tour.start() },
    { group: 'Do', label: 'Generate the board pack', sub: 'PDF-ready report', run: () => nav('/board') },
    { group: 'Do', label: 'Run control monitoring', sub: 'Tests from live data', run: () => nav('/controls?run=1') },
    { group: 'Do', label: 'Verify audit integrity', sub: 'Hash chain', run: () => nav('/audit?verify=1') },
    { group: 'Do', label: 'Who can approve this?', sub: 'Policy engine', run: () => nav('/approvals?tab=who') },
    { group: 'Do', label: 'Open present mode', sub: 'Projector view', run: () => nav('/present') },
    ...memberships.filter(m => m.org_id !== orgId).map(m => ({ group: 'Switch', label: `Switch to ${m.org_name}`, sub: m.role, run: () => setOrg(m.org_id) })),
    ...(can('scenario.run') ? (orgId === 'NT' ? ['A', 'B'] : ['C']).map(c => ({ group: 'Do', label: `Start scenario ${c}`, sub: 'Creates a live incident', run: async () => { try { await rpc('grc_scenario_start', { p_code: c }); toast('ok', `Scenario ${c} started`); bump(); nav('/scenarios'); } catch (e: any) { toast('err', e.message); } } })) : []),
  ];
  const list = useMemo(() => {
    const all = [...base, ...idx];
    if (!q) return base;
    const w = q.toLowerCase().split(/\s+/);
    return all.filter(c => w.every(t => (c.label + ' ' + (c.sub ?? '') + ' ' + c.group).toLowerCase().includes(t))).slice(0, 50);
  }, [q, idx, base.length]); // eslint-disable-line
  useEffect(() => setI(0), [q]);
  const go = (c?: Cmd) => { if (!c) return; onClose(); c.run(); };
  let lastGroup = '';
  return (
    <div className="cmdk" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cmdk-box" role="dialog" aria-label="Command bar">
        <input ref={inp} value={q} onChange={e => setQ(e.target.value)} placeholder="Search risks, controls, suppliers, incidents… or type a command"
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
              <span>{c.label}</span>{c.sub && <span className="sub">{c.sub}</span>}{n === i && <CornerDownLeft size={13} />}</div></div>;
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
  return <><Bell size={16} />{!!data?.unread && <span className="dot">{data.unread > 99 ? '99+' : data.unread}</span>}</>;
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
      <div className="overlay" style={{ background: 'transparent', backdropFilter: 'none' }} onClick={onClose} />
      <aside className="drawer" aria-label="Notifications">
        <div className="drawer-head">
          <div><b>Notifications</b><div className="xs muted">Routed to you by role, assignment or RACI</div></div>
          <div className="row">
            <button className="btn sm" onClick={async () => { await rpc('grc_notifications_mark', { p_ids: null, p_mode: 'read' }); reload(); }}>Mark all read</button>
            <button className="iconbtn" onClick={onClose} aria-label="Close"><X size={17} /></button>
          </div>
        </div>
        <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)' }}>
          {perm === 'granted' ? <div className="small row"><BellRing size={14} color="var(--pass)" />Browser alerts are on while this app is open.</div>
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
                  <div className="xs muted" style={{ marginTop: 4 }}>{ago(n.created_at)}{n.browser_shown_at && ' · shown as a browser alert'}{n.org_id === 'BK' && ' · bank template'}</div>
                </div>
              </div>
            ))}
        </div>
      </aside>
    </>
  );
}
