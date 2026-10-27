import { useEffect, useState } from 'react';
import { Radar, ShieldCheck, Stamp, Wrench, ClipboardCheck, Link2, Lock } from 'lucide-react';
import '../styles/chain.css';

/**
 * Animated chain of custody for the landing hero.
 * Purely visual: five stages light up in sequence and each ledger link seals.
 * Driven by a small step counter so the loop is deterministic and pausable.
 */
const STAGES = [
  { k: 'Detect', who: 'Nandini', role: 'Security Analyst', icon: <Radar size={22} />, line: 'Alert confirmed' },
  { k: 'Assess', who: 'Vijay · Srija', role: 'RSSI · CFO', icon: <ShieldCheck size={22} />, line: 'Severity 4' },
  { k: 'Authorise', who: 'Vijay · Vandana', role: 'RSSI · CEO', icon: <Stamp size={22} />, line: 'Dual control' },
  { k: 'Execute', who: 'Pavan', role: 'IT Operations', icon: <Wrench size={22} />, line: 'Authorised role only' },
  { k: 'Verify', who: 'Vijay', role: 'Independent', icon: <ClipboardCheck size={22} />, line: 'Not the executor' },
];
const HASHES = ['7c1e94b2', 'd0a35f88', '3b9ce4a1', 'f26d8b07', 'a91c5e3d'];
const TICK = 1500;      // ms per step
const TOTAL = STAGES.length * 2 + 3; // node, seal … then badge, hold, reset

export default function ChainHero() {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setStep(TOTAL - 2); return; }
    const t = setInterval(() => setStep(s => (s + 1) % TOTAL), TICK);
    return () => clearInterval(t);
  }, [paused]);

  const lit = (i: number) => step >= i * 2 + 1;
  const sealed = (i: number) => step >= i * 2 + 2;
  const complete = step >= STAGES.length * 2 + 1;
  const resetting = step === TOTAL - 1;

  return (
    <div className={`chain ${complete ? 'complete' : ''} ${resetting ? 'reset' : ''}`} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} aria-label="Chain of custody: detect, assess, authorise, execute, verify">
      <div className="chain-head">
        <span className="chain-k"><i className={step > 0 && !complete ? 'live' : ''} />{complete ? 'Sealed' : step === 0 ? 'Ready' : 'Live'} · Scenario D</span>
        <span className="chain-k right">{Math.min(STAGES.length, Math.floor((step + 1) / 2))}/{STAGES.length} steps</span>
      </div>
      <div className="chain-row">
        {STAGES.map((s, i) => (
          <div key={s.k} className="chain-cell">
            <div className={`chain-node ${lit(i) ? 'on' : ''} ${sealed(i) ? 'sealed' : ''}`} style={{ ['--i' as any]: i }}>
              <span className="chain-ic">{s.icon}</span>
              <b>{s.k}</b>
              <span className="chain-who">{s.who}</span>
              <span className="chain-role">{s.role}</span>
              <span className="chain-line">{s.line}</span>
              <span className="chain-seal"><Lock size={11} />#{HASHES[i]}</span>
            </div>
            {i < STAGES.length - 1 && (
              <div className={`chain-link ${sealed(i) ? 'on' : ''}`}>
                <i /><span><Link2 size={12} /></span>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className={`chain-badge ${complete ? 'show' : ''}`}>
        <ShieldCheck size={16} />
        <span>Chain intact · 5 entries sealed · nobody approved their own request · nobody verified their own work</span>
      </div>
    </div>
  );
}
