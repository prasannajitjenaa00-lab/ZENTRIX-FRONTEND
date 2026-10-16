import { useEffect, useState } from 'react';
import { authApi } from '../services';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import PasswordInput from '../components/PasswordInput';

const card = (cls) => `auth-card card-enter ${cls || ''}`;
const Err = ({ msg }) => <div className={`auth-error ${msg ? '' : 'hidden'}`} role="alert">{msg}</div>;

function Hero() {
  return (
    <div className="auth-brand">
      <div className="brand-row"><img src="/assets/logo-lockup.png" alt="Zentrix logo" className="brand-lockup" /></div>
      <div className="auth-hero">
        <h1>Orchestrate every month.<br /><em>Own every status.</em></h1>
        <p>A dedicated command center for Zentrix teams — assign work, track a living monthly calendar, and watch delivery health in real time.</p>
        <div className="hero-pills"><span>Role-based dashboards</span><span>Monthly task orbit</span><span>Live status rings</span><span>Admin account studio</span></div>
      </div>
      <div className="brand-sub">Confidential · Internal operations suite</div>
    </div>
  );
}

// Local-dev-only quick-fill for accounts seeded by scripts/create-user.js style helpers.
// Gated on import.meta.env.DEV: present under `vite dev`, absent from any `vite build` (prod or the e2e-mock bundle).
const DEV_ACCOUNTS = [
  ['Dummy admin', 'dummy.admin@local.test', '7790052789'],
  ['Dummy employee', 'dummy.employee@local.test', '7790052789'],
];

function LoginCard({ onMfa, onForgot, prefillEmail }) {
  const { signedIn } = useAuth(); const toast = useToast();
  const [email, setEmail] = useState(prefillEmail || ''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const out = await authApi.login(email, password);
      if (out.mfaRequired) { toast('Password accepted. Enter the inbox code to finish.'); onMfa({ email, challengeId: out.challengeId, devPreview: out.devPreview }); }
      else { signedIn(out.user); toast(`Welcome back, ${out.user.name.split(' ')[0]}.`); }
    } catch (ex) { setError(ex.message || 'Could not sign in.'); } finally { setBusy(false); }
  };
  return (
    <form className={card()} id="login-form" onSubmit={submit}>
      <h2>Welcome back</h2><p className="hint">Sign in to your Pulse workspace.</p>
      <Err msg={error} />
      <div className="field"><label htmlFor="login-email">Work email</label><input id="login-email" type="email" autoComplete="username" placeholder="nina.v@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div className="field"><label htmlFor="login-password">Password</label><PasswordInput id="login-password" value={password} onChange={setPassword} placeholder="••••••••" required /></div>
      <button className="btn btn-primary" type="submit" disabled={busy}>Enter workspace</button>
      <div className="auth-links"><button type="button" className="linkish" id="go-forgot" onClick={() => onForgot(email.trim())}>Forgot password?</button></div>
      {import.meta.env?.DEV && (
        <div className="hint-inline" id="dev-autofill" style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <span>Dev autofill:</span>
          {DEV_ACCOUNTS.map(([label, e, p]) => (
            <button key={e} type="button" className="btn btn-ghost btn-sm" style={{ width: 'auto' }} onClick={() => { setEmail(e); setPassword(p); }}>{label}</button>
          ))}
        </div>
      )}
    </form>
  );
}

function MfaCard({ ctx, onBack }) {
  const { signedIn } = useAuth(); const toast = useToast();
  const [challenge, setChallenge] = useState(ctx); const [code, setCode] = useState(''); const [trust, setTrust] = useState(false); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const out = await authApi.verifyMfa(challenge.challengeId, code, trust);
      if (out.recoveryUsed) toast(`Recovery code used. ${out.recoveryRemaining ?? 0} left.`);
      signedIn(out.user);
    } catch (ex) { setError(ex.message || 'Could not verify that code.'); } finally { setBusy(false); }
  };
  const resend = async () => {
    setError('');
    try { const out = await authApi.resendMfa(challenge.challengeId); setChallenge({ ...challenge, challengeId: out.challengeId, devPreview: out.devPreview }); setCode(''); toast('A new code is in the inbox.'); }
    catch (ex) { setError(ex.message || 'Start sign-in again.'); }
  };
  return (
    <form className={card()} id="mfa-form" onSubmit={submit}>
      <h2>Verify it’s you</h2>
      <p className="hint" id="mfa-hint">We sent a 6-digit code to {challenge.email}. It expires in 5 minutes. Recovery codes also work.</p>
      <Err msg={error} />
      <div className="field"><label htmlFor="mfa-code">Authentication code</label>
        <input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={20} placeholder="000000" required autoFocus value={code} onChange={(e) => setCode(e.target.value)} /></div>
      <label className="trust-row"><input type="checkbox" id="mfa-trust" checked={trust} onChange={(e) => setTrust(e.target.checked)} /> Trust this device for 30 days</label>
      <button className="btn btn-primary" type="submit" id="mfa-submit" disabled={busy}>Confirm and enter</button>
      <div className="auth-links"><button type="button" className="linkish" id="mfa-resend" onClick={resend}>Resend code</button>{' '}<button type="button" className="linkish" id="go-login-from-mfa" onClick={onBack}>Back to sign in</button></div>
      {challenge.devPreview && (   // present only when the server runs with DEV_MAIL_PREVIEW=true (never in production)
        <div className="inbox-panel" id="mfa-inbox"><strong>Development mail preview</strong><div>{challenge.devPreview.subject}</div>
          <div className="letter">Your one-time code is <b id="mfa-preview-code">{challenge.devPreview.code}</b>.</div></div>)}
    </form>
  );
}

function ForgotCard({ initialEmail, onBack, onOpenReset }) {
  const [email, setEmail] = useState(initialEmail || ''); const [error, setError] = useState(''); const [ok, setOk] = useState(''); const [preview, setPreview] = useState(null); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setError(''); setOk(''); setPreview(null); setBusy(true);
    try { const out = await authApi.forgot(email.trim().toLowerCase()); setOk(out.message); if (out.devPreview) setPreview(out.devPreview); }
    catch (ex) { setError(ex.message || 'Could not send the reset letter.'); } finally { setBusy(false); }
  };
  return (
    <form className={card()} id="forgot-form" onSubmit={submit}>
      <h2>Reset password</h2><p className="hint">We’ll send a one-time reset link to your work inbox.</p>
      <Err msg={error} />{ok && <div className="auth-ok" id="forgot-ok">{ok}</div>}
      <div className="field"><label htmlFor="forgot-email">Work email</label><input id="forgot-email" type="email" autoComplete="username" placeholder="nina.v@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <button className="btn btn-primary" type="submit" id="forgot-submit" disabled={busy}>Send reset link</button>
      <div className="auth-links"><button type="button" className="linkish" id="go-login-from-forgot" onClick={onBack}>Back to sign in</button></div>
      {preview && (
        <div className="inbox-panel" id="inbox-panel"><strong>Development mail preview</strong><div>{preview.subject}</div>
          <p style={{ marginTop: 10 }}><a href={preview.link} id="open-reset-link" onClick={(e) => { e.preventDefault(); onOpenReset(preview.link.split('#reset=')[1]); }}>Open reset link</a></p></div>)}
    </form>
  );
}

function ResetCard({ token, onDone }) {
  const toast = useToast();
  const [hint, setHint] = useState('Choose a new password for your Pulse account.'); const [a, setA] = useState(''); const [b, setB] = useState(''); const [error, setError] = useState(''); const [email, setEmail] = useState('');
  useEffect(() => { authApi.resetVerify(token).then((d) => { setEmail(d.email); setHint(`Choose a new password for ${d.email}.`); }).catch((ex) => setError(ex.message)); }, [token]);
  const submit = async (e) => {
    e.preventDefault(); setError('');
    if (a.length < 6) return setError('Use at least 6 characters.');
    if (a !== b) return setError('Those two passwords do not match.');
    try { const out = await authApi.reset(token, a); toast('Password updated. Sign in with the new one.'); onDone(out.email || email); }
    catch (ex) { setError(ex.message || 'Could not save the new password.'); }
  };
  return (
    <form className={card()} id="reset-form" onSubmit={submit}>
      <h2>Create a new password</h2><p className="hint" id="reset-hint">{hint}</p><Err msg={error} />
      <div className="field"><label htmlFor="reset-password">New password</label><PasswordInput id="reset-password" value={a} onChange={setA} placeholder="At least 6 characters" autoComplete="new-password" meter required /></div>
      <div className="field"><label htmlFor="reset-password-2">Confirm password</label><PasswordInput id="reset-password-2" value={b} onChange={setB} placeholder="Type it again" autoComplete="new-password" required /></div>
      <button className="btn btn-primary" type="submit">Save new password</button>
      <div className="auth-links"><button type="button" className="linkish" id="go-login-from-reset" onClick={() => onDone('')}>Back to sign in</button></div>
    </form>
  );
}

/** Auth flow: login → (MFA) → app. Also handles #reset=<token> deep links. */
export default function AuthScreen() {
  const [step, setStep] = useState({ name: 'login' });
  const fromHash = () => { const m = (window.location.hash || '').match(/^#reset=([a-f0-9]+)/i); return m ? m[1] : null; };
  useEffect(() => { const t = fromHash(); if (t) setStep({ name: 'reset', token: t }); const h = () => { const x = fromHash(); if (x) setStep({ name: 'reset', token: x }); }; window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h); }, []);
  const clearHash = () => window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return (
    <section id="auth-screen" className="auth-wrap screen-enter">
      <Hero />
      <div className="auth-panel">
        {step.name === 'login' && <LoginCard prefillEmail={step.email} onMfa={(ctx) => setStep({ name: 'mfa', ctx })} onForgot={(email) => setStep({ name: 'forgot', email })} />}
        {step.name === 'mfa' && <MfaCard ctx={step.ctx} onBack={() => setStep({ name: 'login' })} />}
        {step.name === 'forgot' && <ForgotCard initialEmail={step.email} onBack={() => setStep({ name: 'login' })} onOpenReset={(t) => { window.location.hash = `reset=${t}`; setStep({ name: 'reset', token: t }); }} />}
        {step.name === 'reset' && <ResetCard token={step.token} onDone={(email) => { clearHash(); setStep({ name: 'login', email }); }} />}
      </div>
    </section>
  );
}

/** Shown when an admin issued/reset the password: nothing else is usable until the user picks their own. */
export function ForcePasswordChange() {
  const { user, refresh, logout } = useAuth(); const toast = useToast();
  const [cur, setCur] = useState(''); const [a, setA] = useState(''); const [b, setB] = useState(''); const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setError('');
    if (a.length < 6) return setError('Use at least 6 characters.');
    if (a !== b) return setError('Those two passwords do not match.');
    try { await authApi.changePassword(cur, a); toast('Password updated.'); await refresh(); } catch (ex) { setError(ex.message || 'Could not change the password.'); }
  };
  return (
    <section id="auth-screen" className="auth-wrap screen-enter">
      <Hero />
      <div className="auth-panel">
        <form className={card()} id="force-form" onSubmit={submit}>
          <h2>Choose your own password</h2><p className="hint">Hi {user.name.split(' ')[0]}, your password was set by an administrator. Pick a new one to continue.</p><Err msg={error} />
          <div className="field"><label htmlFor="force-current">Current (temporary) password</label><PasswordInput id="force-current" value={cur} onChange={setCur} required /></div>
          <div className="field"><label htmlFor="force-new">New password</label><PasswordInput id="force-new" value={a} onChange={setA} autoComplete="new-password" meter required /></div>
          <div className="field"><label htmlFor="force-new2">Confirm password</label><PasswordInput id="force-new2" value={b} onChange={setB} autoComplete="new-password" required /></div>
          <button className="btn btn-primary" type="submit">Save and continue</button>
          <div className="auth-links"><button type="button" className="linkish" onClick={logout}>Sign out</button></div>
        </form>
      </div>
    </section>
  );
}
