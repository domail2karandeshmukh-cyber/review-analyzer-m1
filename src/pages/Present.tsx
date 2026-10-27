import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Maximize2, Play, ShieldCheck, X, Users, Stamp, Timer, Fingerprint } from 'lucide-react';
import { rpc } from '../lib/supabase';
import { useRpc, useSession } from '../lib/session';
import { fmtMoney, fmtTime, initials, statusOf } from '../lib/format';
import { useToast } from '../components/ui';

const STAGE_OF: Record<string, string> = {
  started: 'Detect', investigating: 'Detect', security_assessed: 'Assess', financial_assessed: 'Assess', actions_submitted: 'Assess',
  authorised: 'Authorise', executed: 'Execute', verified: 'Verify', post_review: 'Verify', closed: 'Close',
};

function useClock(from?: string | null, to?: string | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (!from) return null;
  const end = to ? new Date(to).getTime() : now;
  const s = Math.max(0, Math.floor((end - new Date(from).getTime()) / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return `${h ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export default function Present() {
  const { memberships, current, setOrg } = useSession();
  const [sp, setSp] = useSearchParams();
  const org = sp.get('org') ?? 'NT';
  const has = memberships.some(m => m.org_id === org);
  const sc = useRpc<any[]>(has ? 'grc_scenarios' : null, { p_org: org }, { poll: 3000 });
  const audit = useRpc<any>(has ? 'grc_audit' : null, { p_org: org, p_limit: 80, p_stage: null, p_search: null }, { poll: 4000 });
  const chain = useRpc<any>('grc_verify_audit_chain', {}, { poll: 30000 });
  const toast = useToast();
  const list = sc.data ?? [];
  const s = list.find(x => x.code === sp.get('s')) ?? list[0];
  const run = s?.run && s.run.status !== 'reset' ? s.run : null;
  const clock = useClock(run?.started_at, run?.status === 'completed' ? run?.ended_at : null);
  const steps: any[] = s?.steps ?? [];
  const doneAll = run && steps.length > 0 && steps.every(x => x.done);
  const cur = run ? steps.find(x => !x.done) : null;
  const curIdx = cur ? steps.indexOf(cur) : doneAll ? steps.length : -1;

  // Stamp overlay: shown for a few seconds whenever a step is newly completed
  const [stamp, setStamp] = useState<{ title: string; who: string; n: number } | null>(null);
  const lastIdx = useRef<number>(-2);
  useEffect(() => {
    if (!run) { lastIdx.current = -2; return; }
    if (lastIdx.current >= 0 && curIdx > lastIdx.current) {
      const done = steps[curIdx - 1];
      if (done) { setStamp({ title: done.title, who: done.people?.join(', ') || done.who, n: done.n }); const t = setTimeout(() => setStamp(null), 3200); lastIdx.current = curIdx; return () => clearTimeout(t); }
    }
    lastIdx.current = curIdx;
  }, [curIdx, run?.id]); // eslint-disable-line

  const ROSTER = ['Karan Deshmukh', 'Nandini Vadlamudi', 'Vijay Bhosale', 'Srija Poudapally', 'Vandana Madem', 'Pavan Sanam'];
  const activeNames = new Set<string>();

  useEffect(() => { if (current && current.org_id !== org && has) setOrg(org); }, [org, has]); // eslint-disable-line
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'f' || e.key === 'F') { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);

  const refs = useMemo(() => new Set([s?.incident?.ref, ...(s?.actions ?? []).map((a: any) => a.ref)].filter(Boolean)), [s]);
  const feed = useMemo(() => (audit.data?.items ?? []).filter((e: any) => run && new Date(e.at) >= new Date(run.started_at) && (refs.has(e.entity_ref) || e.stage === 'scenario')).slice(0, 7), [audit.data, refs, run]);

  // Track newly arrived ledger entries for the arrival animation
  const seen = useRef<Set<number>>(new Set());
  const fresh = new Set<number>();
  feed.forEach((e: any) => { if (seen.current.size && !seen.current.has(e.id)) fresh.add(e.id); });
  useEffect(() => { feed.forEach((e: any) => seen.current.add(e.id)); }, [feed]);

  const ACTION_STEPS = ['actions_submitted', 'authorised', 'executed', 'verified', 'post_review'];
  const waiting: { name: string; what: string }[] = [];
  if (cur && ACTION_STEPS.includes(cur.check)) {
    for (const a of s.actions ?? []) {
      const nx = a.next; if (!nx?.actor || nx.stage === 'done') continue;
      const names = String(nx.actor).split(', ');
      names.slice(0, 2).forEach((n: string) => waiting.push({ name: n, what: `${a.ref} · ${nx.title}` }));
      if (names.length > 2) waiting.push({ name: `+${names.length - 2} more`, what: 'Any of them may act' });
    }
  }
  if (cur && waiting.length === 0) (cur.people.length ? cur.people : [cur.who]).forEach((n: string) => waiting.push({ name: n, what: cur.who }));

  waiting.forEach(w => activeNames.add(w.name));
  const actedNames = new Set<string>(feed.map((e: any) => e.actor));
  const money = (s?.actions ?? []).filter((a: any) => a.amount).sort((a: any, b: any) => b.amount - a.amount)[0];
  const moneyState = !money ? null
    : ['completed', 'awaiting_verification'].includes(money.status) ? { t: 'Payment held — not released', c: 'seal' }
    : ['rejected', 'cancelled'].includes(money.status) ? { t: 'Hold not applied', c: 'critical' }
    : { t: 'Exposed until the hold is executed', c: 'critical' };

  async function start() {
    try { await rpc('grc_scenario_start', { p_code: s.code }); toast('ok', `${s.title} started`); sc.reload(); }
    catch (e: any) { toast('err', e.message); }
  }

  if (!has) return <div className="present"><div className="pr-empty"><h1>No access to this organisation.</h1><Link className="btn" to="/">Back</Link></div></div>;
  if (!s) return <div className="present"><div className="pr-empty"><div className="spinner" /></div></div>;

  return (
    <div className="present">
      <div className="pr-glow" aria-hidden />
      <header className="pr-top">
        <div className="row" style={{ gap: 14 }}>
          <div className="brand-mark">N</div>
          <div><div className="pr-k">NOVATECH · GOVERNANCE COMMAND</div><div className="pr-scn">{s.title}</div></div>
        </div>
        <div className="row" style={{ gap: 22 }}>
          {list.length > 1 && <div className="seg">{list.map(x => <button key={x.code} className={x.code === s.code ? 'on' : ''} onClick={() => setSp({ org, s: x.code })}>{x.title.split(' — ')[0]}</button>)}</div>}
          {run && <div className={`pr-live ${doneAll ? 'done' : ''}`}><i />{doneAll ? 'CLOSED' : run.status === 'paused' ? 'PAUSED' : 'LIVE'}<b>{clock}</b></div>}
          {chain.data && <div className={`pr-chain ${chain.data.ok ? '' : 'bad'}`}><ShieldCheck size={15} />{chain.data.ok ? `Chain intact · ${chain.data.checked} sealed` : 'Chain broken'}</div>}
          <button className="icon-btn" title="Full screen (F)" onClick={() => document.documentElement.requestFullscreen?.()}><Maximize2 size={17} /></button>
          <Link className="icon-btn" to="/scenarios" title="Exit"><X size={18} /></Link>
        </div>
      </header>

      <main className="pr-main">
        <section className="pr-stage">
          {!run ? (
            <>
              <div className="pr-eyebrow">READY · {steps.length} STEPS · SECURITY AND FINANCE</div>
              <h1 className="pr-h">Ready when <em>you</em> are.</h1>
              <p className="pr-p">{s.summary}</p>
              <p className="pr-note">The alert comes from a simulated detection feed. Everything after it is real: each person signs in on their own device, and the database decides what they may do.</p>
              {s.can_run ? <button className="btn primary lg pr-go" onClick={start}><Play size={18} />Start the scenario</button>
                : <p className="pr-note">Waiting for the Risk Coordinator to start the scenario.</p>}
            </>
          ) : doneAll ? (
            <>
              <div className="pr-eyebrow seal">ALL {steps.length} STEPS SEALED · {clock}</div>
              <h1 className="pr-h">Incident <em>closed</em>.</h1>
              <p className="pr-p">Every decision was taken by the person company policy names, inside their authority, and is sealed in the ledger. Nobody approved their own request; nobody verified their own work.</p>
              <div className="pr-sum">
                <div><Timer size={16} /><b>{clock}</b><span>detect to close</span></div>
                <div><Users size={16} /><b>{new Set((audit.data?.items ?? []).filter((e: any) => run && new Date(e.at) >= new Date(run.started_at) && e.actor && e.actor !== 'System').map((e: any) => e.actor)).size}</b><span>people, each in their own authority</span></div>
                <div><Stamp size={16} /><b>{(audit.data?.items ?? []).filter((e: any) => run && new Date(e.at) >= new Date(run.started_at) && e.event === 'approval_granted').length}</b><span>approvals, none by the requester</span></div>
                {chain.data?.ok && <div><Fingerprint size={16} /><b className="mono">{chain.data.head?.slice(0, 10)}</b><span>chain head, verified live</span></div>}
              </div>
              {s.incident && <Link className="btn lg" to={`/incidents/${s.incident.id}`}>Open the incident file</Link>}
            </>
          ) : (
            <>
              <div className="pr-eyebrow">STEP {cur.n} OF {steps.length} · {(STAGE_OF[cur.check] ?? '').toUpperCase()}</div>
              <h1 className="pr-h" key={cur.n}>{cur.title}</h1>
              <p className="pr-p">{cur.description}</p>
              <div className="pr-wait">
                <div className="pr-k">{cur.check === 'started' ? 'IN PROGRESS' : 'WAITING FOR'}</div>
                <div className="row wrap" style={{ gap: 14 }}>
                  {waiting.map((w, i) => (
                    <div key={i} className="pr-person"><span className="pr-av">{initials(w.name)}</span><span><b>{w.name}</b><small>{w.what}</small></span></div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="pr-roster" aria-label="Team">
            {ROSTER.map(n => {
              const first = n.split(' ')[0];
              const on = activeNames.has(n) || activeNames.has(first);
              const did = actedNames.has(n);
              return <div key={n} className={`pr-ro ${on ? 'on' : ''} ${did ? 'did' : ''}`}><span className="pr-roav">{initials(n)}</span><span>{first}</span></div>;
            })}
          </div>
          <ol className="pr-track" aria-label="Scenario steps" style={{ ['--n' as any]: steps.length }}>
            {steps.map((x, i) => (
              <li key={x.n} className={x.done ? 'done' : i === curIdx ? 'now' : ''}>
                <span className="pr-dot">{x.done ? '✓' : x.n}</span>
                <span className="pr-tl">{x.title}</span>
                <span className="pr-tw">{x.who}</span>
              </li>
            ))}
          </ol>
        </section>

        <aside className="pr-side">
          {money && (
            <div className={`pr-money ${moneyState?.c}`}>
              <div className="pr-k">AT STAKE · {money.ref}</div>
              <div className="pr-amt">{fmtMoney(money.amount)}</div>
              <div className="pr-ms"><i />{moneyState?.t}</div>
            </div>
          )}
          {run && (s.actions ?? []).length > 0 && (
            <div className="pr-block">
              <div className="pr-k">DECISIONS IN THIS RUN</div>
              {s.actions.map((a: any) => (
                <Link key={a.id} to={`/actions/${a.id}`} className="pr-act">
                  <span className="mono">{a.ref}</span><span className="grow">{a.title}</span>
                  <span className={`pr-st t-${statusOf(a.status).tone}`}>{statusOf(a.status).label}</span>
                </Link>
              ))}
            </div>
          )}
          <div className="pr-block grow">
            <div className="pr-k">SEALED LEDGER · LIVE</div>
            {!run ? <p className="pr-note" style={{ margin: 0 }}>Entries appear here the moment each person acts.</p>
              : feed.length === 0 ? <p className="pr-note" style={{ margin: 0 }}>Waiting for the first entry…</p>
              : feed.map((e: any) => (
                <div key={e.id} className={`pr-led ${fresh.has(e.id) ? 'fresh' : ''}`}>
                  <div className="pr-lm"><span>{fmtTime(e.at)}</span><span className="mono">#{e.id} · {e.hash?.slice(0, 10)}</span></div>
                  <div className="pr-ls">{e.summary}</div>
                  <div className="pr-la">{e.actor}{e.role ? ` · ${e.role}` : ''}</div>
                </div>
              ))}
          </div>
        </aside>
      </main>
      {stamp && (
        <div className="pr-stamp" key={stamp.n} role="status">
          <div className="pr-stamp-in">
            <span className="pr-stamp-k"><ShieldCheck size={18} />Step {stamp.n} sealed</span>
            <b>{stamp.title}</b>
            <span className="pr-stamp-who">{stamp.who}</span>
          </div>
        </div>
      )}
      <footer className="pr-foot">Detection events come from a simulated feed · approvals, permissions, evidence and audit are real database records · press F for full screen</footer>
    </div>
  );
}
