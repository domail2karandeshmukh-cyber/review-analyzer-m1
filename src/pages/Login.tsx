import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Notice } from '../components/ui';
import { ShieldCheck } from 'lucide-react';

const DIRECTORY = [
  { email: 'vandana@novatech.example', name: 'Vandana Madem', role: 'CEO' },
  { email: 'vijay@novatech.example', name: 'Vijay Bhosale', role: 'RSSI / CISO' },
  { email: 'srija@novatech.example', name: 'Srija Poudapally', role: 'Finance Director (CFO)' },
  { email: 'karan@novatech.example', name: 'Karan Deshmukh', role: 'Risk Coordinator' },
  { email: 'pavan@novatech.example', name: 'Pavan Sanam', role: 'IT Operations Manager' },
  { email: 'nandini@novatech.example', name: 'Nandini Vadlamudi', role: 'Cybersecurity Analyst' },
  { email: 'lea.moreau@novatech.example', name: 'Léa Moreau', role: 'Accounts Payable (demo staff)' },
  { email: 'thomas.bernard@novatech.example', name: 'Thomas Bernard', role: 'Sysadmin (demo staff)' },
  { email: 'auditor@novatech.example', name: 'Internal Auditor', role: 'Read-only · professor access' },
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
    if (error) setErr(error.message === 'Invalid login credentials' ? 'Email or password is incorrect.' : error.message);
  }

  return (
    <div className="auth">
      <div className="auth-side">
        <div className="row"><div className="brand-mark">NT</div><div><div className="brand-name">NOVATECH SERVICES</div><div className="brand-sub">Risk Governance Platform</div></div></div>
        <h1>Who decides, who is allowed to act, and how we prove it worked.</h1>
        <p>Every person signs in with their own account. The platform knows their role, routes each decision to the authority defined by company policy, and records every step in a tamper-evident audit trail.</p>
        <div className="auth-steps">
          {['Detect', 'Assess', 'Authorise', 'Execute', 'Verify'].map((s, i) => <div key={s}><b>{s}</b>Stage {i + 1}</div>)}
        </div>
        <div style={{ marginTop: 'auto', paddingTop: 32 }} className="xs" >
          <span style={{ color: '#8592ad' }}>ESAIP · MSc Risk Management · Group 1 — academic demonstration. Business scenarios are simulated; no production system is controlled.</span>
        </div>
      </div>
      <div className="auth-main">
        <form className="auth-card stack loose" onSubmit={submit}>
          <div>
            <div className="eyebrow">Secure sign-in</div>
            <h2 style={{ fontSize: 22 }}>Sign in to your workspace</h2>
            <p className="muted small" style={{ margin: '6px 0 0' }}>Individual accounts replace the old shared demo passcode. Permissions are enforced by the database, not by hiding buttons.</p>
          </div>
          <div className="field"><label htmlFor="em">Work email</label><input id="em" className="input" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></div>
          <div className="field"><label htmlFor="pw">Password</label><input id="pw" className="input" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
          {err && <Notice kind="danger">{err}</Notice>}
          <button className="btn primary lg block" disabled={busy}><ShieldCheck size={17} />{busy ? 'Signing in…' : 'Sign in'}</button>
          <div>
            <div className="section-title">Demonstration directory</div>
            <div className="dir">
              {DIRECTORY.map(d => (
                <button type="button" key={d.email} className={email === d.email ? 'on' : ''} onClick={() => { setEmail(d.email); setPassword(''); document.getElementById('pw')?.focus(); }}>
                  <b>{d.name}</b><span>{d.role}</span>
                </button>
              ))}
            </div>
            <p className="xs muted" style={{ marginTop: 8 }}>Selecting a person only fills the email. Each account has its own password, issued to that person.</p>
          </div>
        </form>
      </div>
    </div>
  );
}
