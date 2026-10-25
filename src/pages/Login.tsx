import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Notice } from '../components/ui';
import { initials } from '../lib/format';

const DIRECTORY = [
  { email: 'vandana@novatech.example', name: 'Vandana Madem', role: 'CEO' },
  { email: 'vijay@novatech.example', name: 'Vijay Bhosale', role: 'RSSI / CISO' },
  { email: 'srija@novatech.example', name: 'Srija Poudapally', role: 'Finance Director' },
  { email: 'karan@novatech.example', name: 'Karan Deshmukh', role: 'Risk Coordinator' },
  { email: 'pavan@novatech.example', name: 'Pavan Sanam', role: 'IT Operations' },
  { email: 'nandini@novatech.example', name: 'Nandini Vadlamudi', role: 'Security Analyst' },
  { email: 'lea.moreau@novatech.example', name: 'Léa Moreau', role: 'Accounts Payable' },
  { email: 'thomas.bernard@novatech.example', name: 'Thomas Bernard', role: 'Sysadmin' },
  { email: 'auditor@novatech.example', name: 'Internal Auditor', role: 'Read-only reviewer' },
];

const NODES: [number, number][] = [[640, 110], [760, 280], [660, 450], [820, 610], [700, 800], [200, 260], [440, 180], [700, 120], [900, 260], [1120, 160], [1260, 380], [1180, 700], [860, 780], [520, 820], [60, 420], [1360, 600]];
// eslint-disable-next-line
export const CHAIN_UNUSED = [
  ['NV', 'Nandini detects', 'A rule flags a suspicious €184,500 payment'],
  ['VB', 'Vijay assesses', 'Security impact, within RSSI authority only'],
  ['SP', 'Srija and Vandana approve', 'Finance authority, CEO dual control above €100k'],
  ['LM', 'Léa executes', 'Only an authorised executor, only after approval'],
  ['VB', 'Vijay verifies', 'Checked against data, never by the person who did it'],
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setErr(error.message === 'Invalid login credentials' ? 'That email and password do not match. Check the password issued to this person.' : error.message);
  }

  return (
    <div className="auth">
      <svg className="auth-bg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <radialGradient id="ag" cx="30%" cy="40%" r="70%"><stop offset="0" stopColor="#14223f" stopOpacity=".9" /><stop offset="1" stopColor="#05080f" stopOpacity="0" /></radialGradient>
        </defs>
        <rect width="1440" height="900" fill="url(#ag)" />
        {NODES.map(([x, y], i) => NODES.slice(i + 1).filter(([x2, y2]) => Math.hypot(x2 - x, y2 - y) < 330).map(([x2, y2], j) => (
          <line key={`${i}-${j}`} x1={x} y1={y} x2={x2} y2={y2} stroke="#4c86ff" strokeOpacity=".09" />
        )))}
        <path d={`M${NODES.slice(0, 5).map(n => n.join(' ')).join(' L')}`} fill="none" stroke="#d4bc86" strokeWidth="1.4" strokeDasharray="5 9" className="auth-path" />
        {NODES.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i < 5 ? 4 : 2.2} fill={i < 5 ? '#e9d6a6' : '#4c86ff'} opacity={i < 5 ? .9 : .45} />)}
      </svg>
      <div className="auth-side">
        <div className="row"><div className="brand-mark">NT</div><div><div className="brand-name">NOVATECH</div><div className="brand-sub">Enterprise risk governance</div></div></div>
        <h1>Every decision has an <em>owner</em>, an <em>authority</em> and a <em>proof</em>.</h1>
        <p>Detection to verification in one chain of custody. Each person signs only what their role allows; the database enforces it and seals every step.</p>
        <div className="auth-stages" aria-label="Lifecycle">
          {['DETECT', 'ASSESS', 'AUTHORISE', 'EXECUTE', 'VERIFY'].map(s => <span key={s}>{s}</span>)}
        </div>
        <div style={{ marginTop: 'auto', paddingTop: 28 }} className="xs"><span style={{ color: 'var(--ink-4)' }}>ESAIP MSc Risk Management · Group 1. Detection feeds and executions are simulated; no production system is controlled.</span></div>
      </div>
      <div className="auth-main">
        <form className="auth-card stack loose" onSubmit={submit}>
          <div>
            <div className="eyebrow">Secure access</div><h2 className="serif" style={{ fontSize: 40, fontWeight: 400, lineHeight: 1 }}>Sign in</h2>
            <p className="muted" style={{ marginTop: 6 }}>Personal accounts replace the shared demo passcode. What you may do is enforced by the database, not by hiding buttons.</p>
          </div>
          <div className="field"><label htmlFor="em">Work email</label><input id="em" className="input" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></div>
          <div className="field"><label htmlFor="pw">Password</label><input id="pw" className="input" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
          {err && <Notice kind="danger">{err}</Notice>}
          <button className="btn primary lg block" disabled={busy}>{busy ? 'Signing in' : 'Sign in'}</button>
          <div>
            <div className="section-title">Who is signing in?</div>
            <div className="dir">
              {DIRECTORY.map(d => (
                <button type="button" key={d.email} className={email === d.email ? 'on' : ''} onClick={() => { setEmail(d.email); setPassword(''); document.getElementById('pw')?.focus(); }}>
                  <span className="avatar sm">{initials(d.name)}</span>
                  <span><b>{d.name}</b><span>{d.role}</span></span>
                </button>
              ))}
            </div>
            <p className="xs muted" style={{ marginTop: 8 }}>Choosing a person fills in the email only. Each person has their own password.</p>
          </div>
        </form>
      </div>
    </div>
  );
}
