import { useState } from 'react';
import { packagesApi, usersApi } from '../services';
import { useLive } from '../contexts/LiveContext';
import { useToast } from '../contexts/ToastContext';
import { useResource } from '../hooks/useResource';
import { money } from '../utils/format';
import PasswordInput from '../components/PasswordInput';

/** Create / edit account (admin). Bank fields + unlock mirror the original modal; saved via the dedicated bank endpoint on edit. */
export default function PersonModal({ person, close }) {
  const toast = useToast(); const { refresh } = useLive();
  const leaders = useResource(() => usersApi.leaders(), [], { live: false });
  const pkgs = useResource(() => packagesApi.list(), [], { live: false });
  const isFloor = person?.role === 'floor_manager';
  const isTL = person?.role === 'team_leader';   // Team Leader is no longer offered for new accounts, but an existing one keeps their role
  const bd = person?.bankDetails || {};
  const [f, setF] = useState({
    name: person?.name || '', email: person?.email || '', phone: person?.phone || '', role: person?.role || 'employee',
    leaderId: person?.leaderId || '', packageId: person?.packageId || '', password: '',
    holder: bd.holder || '', bankName: bd.name || '', account: bd.account || '', ifsc: bd.ifsc || '',
    unlock: person ? !person.bank?.locked : true, mfa: person ? person.mfaEnabled !== false : true,
  });
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [created, setCreated] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const teamLeaders = (leaders.data || []).filter((l) => l.role === 'team_leader');
  const defaultPkg = (pkgs.data || []).find((p) => p.key === 'standard')?.id || '';
  const isEmp = f.role === 'employee';

  const save = async () => {
    setError('');
    if (!f.name.trim() || !f.email.trim()) return toast('Name and email are required.');
    if (isEmp && !f.leaderId) return toast('Every employee must be assigned under a team leader.');
    const bank = { holder: f.holder.trim(), name: f.bankName.trim(), account: f.account.trim(), ifsc: f.ifsc.trim().toUpperCase() };
    const base = { name: f.name.trim(), email: f.email.trim().toLowerCase(), phone: f.phone.trim(), role: f.role, leaderId: isEmp ? f.leaderId : undefined, packageId: isEmp ? (f.packageId || defaultPkg || undefined) : undefined, mfaEnabled: f.mfa };
    setBusy(true);
    try {
      if (!person) {
        const out = await usersApi.create({ ...base, password: f.password.trim() || undefined, bank, bankUnlock: f.unlock });
        refresh();
        if (out.temporaryPassword) setCreated({ email: out.user.email, password: out.temporaryPassword }); else { close(); toast('Account live.'); }
      } else {
        await usersApi.update(person.id, { ...base, role: isFloor ? undefined : f.role, password: f.password.trim() || undefined });
        if (bank.holder || bank.name || bank.account || bank.ifsc || f.unlock !== !person.bank?.locked) await bankPatch(person.id, bank, f.unlock);
        refresh(); close(); toast(f.password.trim() ? 'Account saved. Previous password deleted.' : 'Account saved.');
      }
    } catch (ex) { setError(ex.details ? Object.values(ex.details).join(' ') : ex.message); } finally { setBusy(false); }
  };

  if (created) {
    return (
      <>
        <h3>Account live</h3>
        <p className="hint">Share this temporary password with {created.email} securely. It is shown only once, and they must change it at first sign-in.</p>
        <div className="inbox-panel"><code id="temp-password">{created.password}</code></div>
        <div className="modal-actions"><button className="btn btn-lime btn-sm" id="close-m" onClick={close}>Done</button></div>
      </>
    );
  }
  return (
    <>
      <h3>{person ? 'Edit account' : 'Create account'}</h3>
      <p className="hint" style={{ margin: '-6px 0 14px' }}>Create an employee or admin account. Employees must sit under a team leader. Choose a package to show as their wallet.</p>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <div className="field"><label htmlFor="pe-name">Full name</label><input id="pe-name" value={f.name} onChange={set('name')} /></div>
      <div className="field"><label htmlFor="pe-email">Work email</label><input id="pe-email" type="email" value={f.email} onChange={set('email')} /></div>
      <div className="row-2">
        <div className="field"><label htmlFor="pe-phone">Phone number</label><input id="pe-phone" type="tel" value={f.phone} onChange={set('phone')} placeholder="+91 …" /></div>
        <div className="field"><label htmlFor="pe-role">Role</label>
          <select id="pe-role" value={f.role} onChange={set('role')} disabled={isFloor || isTL}>
            {isFloor ? <option value="floor_manager">Floor Manager</option>
              : isTL ? <option value="team_leader">Team Leader</option>
                : <><option value="employee">Employee</option><option value="admin">Admin</option></>}
          </select></div>
      </div>
      {isEmp && (
        <>
          <div className="field" id="pe-leader-field"><label htmlFor="pe-leader">Team leader <em style={{ color: 'var(--coral)', fontStyle: 'normal' }}>required for employees</em></label>
            <select id="pe-leader" value={f.leaderId} onChange={set('leaderId')}>
              {teamLeaders.length ? <option value="">Select a team leader…</option> : <option value="">No team leader yet — create one first</option>}
              {teamLeaders.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select></div>
          <div className="field" id="pe-package-field"><label htmlFor="pe-package">Package <em style={{ color: 'var(--muted)', fontStyle: 'normal' }}>shown as wallet for the employee</em></label>
            <select id="pe-package" value={f.packageId || defaultPkg} onChange={set('packageId')}>
              {(pkgs.data || []).map((p) => <option key={p.id} value={p.id}>{p.name} · {money(p.currency, p.amount)}</option>)}
            </select></div>
        </>
      )}
      <div className="field"><label htmlFor="pe-pass">{person ? 'Reset password (optional)' : 'Password (optional — a temporary one is generated if blank)'}</label>
        <PasswordInput id="pe-pass" value={f.password} onChange={(v) => setF({ ...f, password: v })} placeholder={person ? 'Leave blank to keep' : 'Temporary password'} autoComplete="new-password" /></div>
      <div style={{ margin: '12px 0', padding: 12, border: '1px solid var(--line)', borderRadius: 12 }}>
        <strong style={{ fontSize: 13 }}>Bank details</strong>
        <div className="field"><label htmlFor="pe-bank-holder">Account holder</label><input id="pe-bank-holder" value={f.holder} onChange={set('holder')} /></div>
        <div className="field"><label htmlFor="pe-bank-name">Bank name</label><input id="pe-bank-name" value={f.bankName} onChange={set('bankName')} /></div>
        <div className="row-2">
          <div className="field"><label htmlFor="pe-bank-acc">Account number</label><input id="pe-bank-acc" value={f.account} onChange={set('account')} /></div>
          <div className="field"><label htmlFor="pe-bank-ifsc">IFSC</label><input id="pe-bank-ifsc" value={f.ifsc} onChange={set('ifsc')} /></div>
        </div>
        <label className="trust-row" style={{ margin: '6px 0 0' }}><input type="checkbox" id="pe-bank-unlock" checked={f.unlock} onChange={set('unlock')} /> Allow employee to edit bank details (unlock)</label>
      </div>
      <label className="trust-row" style={{ margin: '4px 0 12px' }}><input type="checkbox" id="pe-mfa" checked={f.mfa} onChange={set('mfa')} /> Require inbox MFA at sign-in</label>
      <div className="modal-actions"><button className="btn btn-ghost btn-sm" id="close-m" onClick={close}>Cancel</button><button className="btn btn-lime btn-sm" id="save-m" disabled={busy} onClick={save}>Save account</button></div>
    </>
  );
}
async function bankPatch(id, bank, unlock) {
  return usersApi.updateBank(id, { holder: bank.holder, name: bank.name, account: bank.account, ifsc: bank.ifsc, unlock });
}
