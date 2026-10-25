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

const CHAIN = [
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
      <div className="auth-side">
        <div className="row"><div className="brand-mark">NT</div><div><div className="brand-name">NOVATECH SERVICES</div><div className="brand-sub">Risk governance platform</div></div></div>
        <h1>Every decision has an owner, an authority and a proof.</h1>
        <p>Sign in as yourself. The platform knows your role, sends each decision to the person company policy names, and seals every step in a tamper-evident chain.</p>
        <div className="auth-chain" aria-hidden>
          {CHAIN.map(([i, t, s], n) => (
            <div key={n} className="auth-link" style={{ animationDelay: `${n * 120}ms` }}>
              <div className="seal-mark">{i}</div>
              <div><b>{t}</b><span>{s}</span></div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 'auto', paddingTop: 28 }} className="xs"><span style={{ color: '#7f8ca5' }}>ESAIP MSc Risk Management, Group 1. Detection feeds and executions are simulated; no production system is controlled.</span></div>
      </div>
      <div className="auth-main">
        <form className="auth-card stack loose" onSubmit={submit}>
          <div>
            <h2 style={{ fontSize: 24, letterSpacing: '-0.02em' }}>Sign in</h2>
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
