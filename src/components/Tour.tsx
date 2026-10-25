import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, X, Compass } from 'lucide-react';

type Step = { to: string; title: string; say: string; look: string };

/** The 12-minute guided walkthrough: each step opens a page and gives the presenter what to show and say. */
export const TOUR: Step[] = [
  { to: '/', title: 'Home: what needs attention', look: 'Priorities, risk appetite bars, compliance coverage, KRIs.', say: 'Every role lands on its own priorities. Four risks sit outside the appetite the board approved; the bars show score against tolerance.' },
  { to: '/risks', title: 'Risk register', look: 'Scores R1–R8 on the 4×4 scale, owners, KRIs, treatment.', say: 'R1–R6 come from our original analysis, read live; R7 and R8 extend the register for Finance. Each risk has one accountable owner.' },
  { to: '/ebios', title: 'EBIOS Risk Manager study', look: 'Workshop 3 threat map, then workshop 5 before/after risk map.', say: 'We applied the ANSSI method end to end: feared events, risk sources, the ecosystem threat map, attack scenarios and the PACS treatment plan.' },
  { to: '/quant', title: 'Risk quantification', look: 'Loss exceedance curve, inherent versus residual.', say: 'Scores become euros: a FAIR-style Monte Carlo gives expected annual loss and the 1-in-10-year loss, and shows what each control is worth.' },
  { to: '/compliance', title: 'Compliance crosswalk', look: 'Coverage per framework and the control × framework matrix.', say: 'One set of 25 controls covers ISO 27001, NIS2, GDPR and DORA. Test once, comply many times.' },
  { to: '/controls', title: 'Continuous control monitoring', look: 'Run monitoring, then open a control drawer.', say: 'Tests run on live platform data: segregation of duties, dual control on payments, ledger integrity and KRIs. Nothing is marked as passed by hand.' },
  { to: '/live', title: 'Live operations', look: 'The authority graph: who holds the next decision.', say: 'This is the chain of custody in motion. Blue is sealed, the dashed line is the decision waiting, here the CEO for the €184,500 hold.' },
  { to: '/approvals', title: 'Approvals and the policy engine', look: '"Who can approve this?" tab.', say: 'Approval routes are data. Above €100,000 the CFO cannot decide alone; the CEO is added automatically. Requesters can never approve.' },
  { to: '/incidents', title: 'Incidents and regulatory clocks', look: 'Open an incident, classify NIS2 / GDPR.', say: 'Once classified, the NIS2 24-hour and 72-hour clocks and the GDPR 72-hour clock start from the moment of awareness.' },
  { to: '/vendors', title: 'Third parties and DORA', look: 'Tiering, overdue reviews, the DORA register tab.', say: 'Critical suppliers, review status and exit plans. Our subcontracted developers sit in the EBIOS danger zone.' },
  { to: '/continuity', title: 'Continuity and BIA', look: 'RTO targets versus tested results, dependency map.', say: 'In the case data the July restore test took 6 hours against a 4-hour objective; the platform flags the miss instead of hiding it.' },
  { to: '/board', title: 'Board pack', look: 'Print or save as PDF.', say: 'One click turns live data into the board paper: profile, exposure in euros, compliance, incidents and the decisions we need from the board.' },
  { to: '/audit', title: 'Tamper-evident ledger', look: 'Verify integrity.', say: 'Every decision is hash-chained. The server recomputes the chain on demand; editing or deleting a record is refused by the database.' },
];

const Ctx = createContext<{ start: () => void; active: boolean }>({ start: () => {}, active: false });
export const useTour = () => useContext(Ctx);

function load(): number { try { const v = sessionStorage.getItem('grc-tour'); return v === null ? -1 : +v; } catch { return -1; } }
function save(n: number) { try { n < 0 ? sessionStorage.removeItem('grc-tour') : sessionStorage.setItem('grc-tour', String(n)); } catch { /* ignore */ } }

export function TourProvider({ children }: { children: ReactNode }) {
  const [i, setI] = useState<number>(load);
  const nav = useNavigate();
  const loc = useLocation();
  const go = useCallback((n: number) => { setI(n); save(n); if (n >= 0 && TOUR[n]) nav(TOUR[n].to); }, [nav]);
  const start = useCallback(() => go(0), [go]);
  const end = () => { setI(-1); save(-1); };
  useEffect(() => {
    if (i < 0) return;
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowRight' && e.altKey) go(Math.min(i + 1, TOUR.length - 1));
      if (e.key === 'ArrowLeft' && e.altKey) go(Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [i, go]);
  const s = i >= 0 ? TOUR[i] : null;
  const off = s && !(s.to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(s.to));
  return (
    <Ctx.Provider value={{ start, active: i >= 0 }}>
      {children}
      {s && (
        <div className="tour no-print" role="dialog" aria-label="Guided tour">
          <div className="tour-top">
            <span className="row" style={{ gap: 6 }}><Compass size={14} />Guided tour · {i + 1} of {TOUR.length}</span>
            <button className="iconbtn" style={{ width: 26, height: 26 }} onClick={end} aria-label="End tour"><X size={15} /></button>
          </div>
          <div className="tour-bar"><i style={{ width: `${((i + 1) / TOUR.length) * 100}%` }} /></div>
          <div className="tour-t">{s.title}</div>
          <div className="tour-l"><b>Show</b> {s.look}</div>
          <div className="tour-s">“{s.say}”</div>
          <div className="row between" style={{ marginTop: 12 }}>
            <button className="btn sm" disabled={i === 0} onClick={() => go(i - 1)}><ArrowLeft size={13} />Back</button>
            {off && <button className="btn sm ghost" onClick={() => nav(s.to)}>Return to this step</button>}
            {i < TOUR.length - 1 ? <button className="btn sm primary" onClick={() => go(i + 1)}>Next<ArrowRight size={13} /></button>
              : <button className="btn sm primary" onClick={end}>Finish</button>}
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
