import { useState } from 'react';
import { PASS_LABEL, passwordScore } from '../utils/format';

/** Password field with Show/Hide (every password field in the original had one) and optional strength meter. */
export default function PasswordInput({ id, value, onChange, placeholder, autoComplete = 'current-password', meter = false, required = false }) {
  const [show, setShow] = useState(false);
  const s = passwordScore(value || '');
  return (
    <>
      <div className="pass-wrap">
        <input id={id} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} required={required} />
        <button type="button" className="pass-toggle" aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} onClick={() => setShow((v) => !v)}>{show ? 'Hide' : 'Show'}</button>
      </div>
      {meter && (
        <div className={`pass-meter ${value ? '' : 'hidden'}`} id={`${id}-meter`}><span style={{ width: `${(s / 4) * 100}%` }} /><em>{PASS_LABEL[s]}</em></div>
      )}
    </>
  );
}
