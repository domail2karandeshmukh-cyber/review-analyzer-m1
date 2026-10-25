import { Link } from 'react-router-dom';
import {
  ArrowRight, ShieldAlert, Radar, Calculator, Scale, ShieldCheck, Siren, Truck, LifeBuoy, Presentation, ScrollText, Lock, Fingerprint, Activity, BadgeCheck,
} from 'lucide-react';
import { Logo, useTheme } from '../components/Shell';
import '../styles/landing.css';

const STAGES = [
  ['Detect', 'Alerts and KRIs open an incident and route it to the analyst on duty.'],
  ['Assess', 'Security and Finance assess impact, each within its own authority.'],
  ['Authorise', 'The policy engine routes the decision to the right approvers, dual control above €100k.'],
  ['Execute', 'Only an authorised executor acts, and only after approval.'],
  ['Verify', 'Someone independent checks the result against recorded evidence.'],
];

const MODULES: [React.ReactNode, string, string][] = [
  [<ShieldAlert size={18} />, 'Risk register & appetite', 'Inherent, residual and target scores, owners, KRIs and board-approved tolerance per category.'],
  [<Radar size={18} />, 'EBIOS Risk Manager', 'The five ANSSI workshops, from feared events to the PACS, with an exposure × reliability matrix of your ecosystem.'],
  [<Calculator size={18} />, 'Risk quantification', 'FAIR-style Monte Carlo: expected annual loss, 1-in-10-year loss and the value of each control.'],
  [<Scale size={18} />, 'Compliance crosswalk', 'ISO 27001, NIS2, DORA and GDPR mapped to one control set. Test once, comply many times.'],
  [<ShieldCheck size={18} />, 'Continuous monitoring', 'Controls tested automatically from live platform data: segregation of duties, dual control, ledger integrity, KRIs.'],
  [<Siren size={18} />, 'Incidents & regulatory clocks', 'NIS2 24 h / 72 h / 1 month, GDPR 72 h and DORA deadlines counted from awareness.'],
  [<Truck size={18} />, 'Third parties', 'Tiering, questionnaires, residual scores and the DORA register of information.'],
  [<LifeBuoy size={18} />, 'Continuity & BIA', 'RTO, RPO and impact per process, exercises recorded, single points of failure exposed.'],
  [<Presentation size={18} />, 'Board pack', 'A print-ready executive report generated from live data in one click.'],
  [<ScrollText size={18} />, 'Tamper-evident ledger', 'Every decision hash-chained; the database refuses edits and deletions.'],
];

const TRUST: [React.ReactNode, string, string][] = [
  [<Lock size={18} />, 'Authority enforced by the database', 'Requesters cannot approve, approvers cannot execute, executors cannot verify. Not hidden buttons: refused writes.'],
  [<Fingerprint size={18} />, 'Proof you can recompute', 'Each ledger entry carries the fingerprint of the one before it. Anyone can re-verify the chain on demand.'],
  [<Activity size={18} />, 'Monitoring from real data', 'Control tests read approvals, payments, KRIs and the ledger itself. Nothing is marked as passed by hand.'],
  [<BadgeCheck size={18} />, 'Honest by design', 'Simulated detections and executions are labelled as such. Case-study inputs are marked. No invented evidence.'],
];

const TEAM = [
  ['Vijay Bhosale', 'RSSI / CISO', 'Admin'], ['Vandana Madem', 'Chief Executive Officer', 'Member'], ['Nandini Vadlamudi', 'Cybersecurity Analyst', 'Member'],
  ['Srija Poudapally', 'Finance Director (CFO / DAF)', 'Member'], ['Pavan Sanam', 'IT Operations Manager', 'Member'],
];

export default function Landing() {
  const [theme, toggle] = useTheme();
  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-wrap row between">
          <div className="row" style={{ gap: 10 }}><Logo /><b>NOVATECH IRM</b></div>
          <nav className="row lp-links">
            <a href="#platform">Platform</a><a href="#method">Method</a><a href="#trust">Trust</a><a href="#team">Team</a>
            <button className="btn ghost sm" onClick={toggle} aria-label="Toggle theme">{theme === 'dark' ? 'Light' : 'Dark'}</button>
            <Link to="/login" className="btn primary sm">Sign in</Link>
          </nav>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-grid-bg" aria-hidden />
        <div className="lp-wrap">
          <div className="lp-pill"><span>New</span>EBIOS RM, quantification and NIS2 / DORA clocks</div>
          <h1>Every risk decision.<br /><span>Owned, authorised and proven.</span></h1>
          <p className="lp-sub">One platform from detection to verification for NOVATECH Services: the risk register, EBIOS RM, ISO 27001 · NIS2 · DORA · GDPR compliance, quantified exposure and a tamper-evident ledger, with segregation of duties enforced by the database.</p>
          <div className="row wrap" style={{ gap: 10, marginTop: 26 }}>
            <Link to="/login" className="btn primary lg">Sign in to the platform <ArrowRight size={16} /></Link>
            <a href="#platform" className="btn lg">See what's inside</a>
          </div>
          <div className="lp-shot">
            <div className="lp-shot-bar"><i /><i /><i /><span>novatech-grc.vercel.app</span></div>
            <img src="/product-home.png" alt="NOVATECH IRM home: priorities, risk appetite, compliance coverage and KRIs" />
          </div>
        </div>
      </section>

      <section className="lp-sec" id="method">
        <div className="lp-wrap">
          <div className="lp-kicker">One chain of custody</div>
          <h2>Five stages. One owner at every step.</h2>
          <div className="lp-stages">
            {STAGES.map(([t, d], i) => (
              <div key={t} className="lp-stage"><div className="n">0{i + 1}</div><div className="t">{t}</div><div className="d">{d}</div></div>
            ))}
          </div>
          <div className="lp-std">
            {['ISO 31000', 'ISO/IEC 27005:2022', 'EBIOS RM · ANSSI', 'ISO/IEC 27001:2022', 'NIS2 (EU) 2022/2555', 'DORA (EU) 2022/2554', 'GDPR', 'FAIR'].map(s => <span key={s}>{s}</span>)}
          </div>
        </div>
      </section>

      <section className="lp-sec" id="platform">
        <div className="lp-wrap">
          <div className="lp-kicker">The platform</div>
          <h2>Everything a risk function runs on, connected.</h2>
          <p className="lp-lead">A risk links to its controls, the controls to framework requirements, the requirements to evidence, and every decision to the person who was allowed to take it.</p>
          <div className="lp-mods">
            {MODULES.map(([ic, t, d]) => <div key={t} className="lp-mod"><div className="ic">{ic}</div><div className="t">{t}</div><div className="d">{d}</div></div>)}
          </div>
        </div>
      </section>

      <section className="lp-sec" id="trust">
        <div className="lp-wrap">
          <div className="lp-kicker">Why you can trust the record</div>
          <h2>Governance you can prove, not just display.</h2>
          <div className="lp-trust">
            {TRUST.map(([ic, t, d]) => <div key={t} className="lp-tr"><div className="ic">{ic}</div><div><div className="t">{t}</div><div className="d">{d}</div></div></div>)}
          </div>
        </div>
      </section>

      <section className="lp-sec" id="team">
        <div className="lp-wrap">
          <div className="lp-kicker">ESAIP · MSc Risk Management · Group 1</div>
          <h2>Designed and built by Karan Deshmukh.</h2>
          <div className="lp-creator">
            <span className="avatar lg">KD</span>
            <div><b>Karan Deshmukh</b><span>Creator and platform owner · Project Manager / Risk Coordinator in the NOVATECH case</span></div>
            <span className="lvl owner">Owner</span>
          </div>
          <p className="lp-lead">The Group 1 team plays the NOVATECH roles in the live scenarios. Their business role decides what each person may assess, approve or execute.</p>
          <div className="lp-team">
            {TEAM.map(([n, r, l]) => <div key={n} className="lp-person"><span className="avatar lg">{n.split(' ').map(x => x[0]).join('')}</span><div><b>{n}</b><span>{r}</span></div>{l === 'Admin' && <span className="lvl admin" style={{ marginLeft: 'auto' }}>Admin</span>}</div>)}
          </div>
          <div className="lp-cta">
            <div><h3>Ready to see it live?</h3><p>Sign in with your personal account. Your role decides what you may do.</p></div>
            <Link to="/login" className="btn primary lg">Sign in <ArrowRight size={16} /></Link>
          </div>
        </div>
      </section>

      <footer className="lp-foot">
        <div className="lp-wrap row between wrap" style={{ gap: 10 }}>
          <span>NOVATECH Services is a fictional company used for the ESAIP case study. Detection feeds and device executions are simulated and labelled as such.</span>
          <span>Created by Karan Deshmukh · © 2026</span>
        </div>
      </footer>
    </div>
  );
}
