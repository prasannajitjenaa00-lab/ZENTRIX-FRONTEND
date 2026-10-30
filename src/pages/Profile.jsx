import { useEffect, useState } from 'react';
import { authApi, tasksApi, usersApi, walletApi } from '../services';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useHeader } from '../layouts/HeaderContext';
import { useResource } from '../hooks/useResource';
import PasswordInput from '../components/PasswordInput';
import StatusRing from '../components/StatusRing';
import { Page, Resource } from '../components/Page';
import { fmtDateTime, money, statusCounts } from '../utils/format';

export default function Profile() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  useHeader('Profile', 'Your Zentrix identity');

  const isEmployee = user.role === 'employee';
  const isAdmin = user.role === 'admin';

  const tasks = useResource(async () => (await tasksApi.list()).data, [user.id]);
  const bank = useResource(() => (isEmployee ? Promise.resolve(null) : usersApi.myBank()), [user.id], { live: false });
  const wallet = useResource(() => (isEmployee ? walletApi.me() : Promise.resolve(null)), [user.id], { live: false });

  const [acct, setAcct] = useState({ name: user.name, title: user.title, cur: '', np: '' });
  const [b, setB] = useState({ holder: '', name: '', account: '', ifsc: '' });

  useEffect(() => {
    const d = bank.data?.details;
    if (d) setB({ holder: d.holder || '', name: d.name || '', account: d.account || '', ifsc: d.ifsc || '' });
  }, [bank.data]);

  const locked = !!bank.data?.locked;
  const canEditBank = !locked || isAdmin;

  const saveProfile = async () => {
    if (acct.np && acct.np.length < 6) return toast('New password needs at least 6 characters.');
    if (acct.np && !acct.cur) return toast('Enter your current password to set a new one.');
    try {
      await usersApi.updateMe({ name: acct.name.trim() || user.name, title: acct.title.trim() || user.title });
      if (acct.np) {
        await authApi.changePassword(acct.cur, acct.np);
        setAcct((a) => ({ ...a, cur: '', np: '' }));
        toast('Password updated successfully.');
      } else {
        toast('Profile saved.');
      }
      await refresh();
    } catch (ex) {
      toast(ex.details ? Object.values(ex.details).join(' ') : ex.message);
    }
  };

  const saveBank = async () => {
    const holder = b.holder.trim();
    const name = b.name.trim();
    const account = b.account.trim();
    const ifsc = b.ifsc.trim().toUpperCase();
    if (!holder || !name || !account || !ifsc) return toast('All bank fields are required.');
    if (account.length < 6 || account.length > 20 || !/^\d+$/.test(account)) return toast('Account number looks invalid.');
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return toast('IFSC must be 11 characters (e.g. SBIN0001234).');
    try {
      await usersApi.saveMyBank({ holder, name, account, ifsc });
      toast('Bank details saved and locked.');
      bank.reload();
    } catch (ex) {
      toast(ex.message);
    }
  };

  const w = wallet.data?.package;

  return (
    <Resource res={tasks}>
      {(list) => (
        <Page>
          <div className="grid-2">
            {/* Account Details */}
            <section className="panel">
              <h3>Account</h3>
              <div className="field">
                <label htmlFor="p-name">Name</label>
                <input id="p-name" value={acct.name} onChange={(e) => setAcct({ ...acct, name: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="p-title">Title</label>
                <input id="p-title" value={acct.title} onChange={(e) => setAcct({ ...acct, title: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="p-dept">Department</label>
                <input id="p-dept" value={user.department || ''} disabled readOnly />
              </div>
              <div className="field">
                <label>Email</label>
                <input value={user.email} disabled readOnly />
              </div>
              {w && (
                <div className="field">
                  <label>Wallet package</label>
                  <input value={`${w.name} · ${w.currency}${w.ratePerHour || w.amount}/hr`} disabled readOnly />
                </div>
              )}
              <div className="field">
                <label htmlFor="p-cur">Current password</label>
                <PasswordInput id="p-cur" value={acct.cur} onChange={(v) => setAcct({ ...acct, cur: v })} placeholder="Only needed to change your password" autoComplete="current-password" />
              </div>
              <div className="field">
                <label htmlFor="p-pass">New password</label>
                <PasswordInput id="p-pass" value={acct.np} onChange={(v) => setAcct({ ...acct, np: v })} placeholder="Leave blank to keep" autoComplete="new-password" meter />
              </div>
              <button className="btn btn-primary" id="save-profile" style={{ width: 'auto' }} onClick={saveProfile}>
                Save profile
              </button>
            </section>

            {/* Bank details are hidden for employees (they manage and add bank details in the Withdraw section) */}
            {!isEmployee && (
              <section className="panel">
                <h3>Bank details</h3>
                {locked && !isAdmin ? (
                  <p className="hint" style={{ color: 'var(--coral)' }}>Bank details are locked after first save. Contact admin to request changes.</p>
                ) : (
                  <p className="hint">Add your salary account once. After saving, further changes require admin permission.</p>
                )}
                <div className="field">
                  <label htmlFor="p-bank-holder">Account holder name</label>
                  <input id="p-bank-holder" value={b.holder} disabled={!canEditBank} onChange={(e) => setB({ ...b, holder: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="p-bank-name">Bank name</label>
                  <input id="p-bank-name" value={b.name} disabled={!canEditBank} onChange={(e) => setB({ ...b, name: e.target.value })} />
                </div>
                <div className="row-2">
                  <div className="field">
                    <label htmlFor="p-bank-acc">Account number</label>
                    <input id="p-bank-acc" value={b.account} disabled={!canEditBank} onChange={(e) => setB({ ...b, account: e.target.value })} />
                  </div>
                  <div className="field">
                    <label htmlFor="p-bank-ifsc">IFSC code</label>
                    <input id="p-bank-ifsc" value={b.ifsc} placeholder="e.g. SBIN0001234" disabled={!canEditBank} onChange={(e) => setB({ ...b, ifsc: e.target.value })} />
                  </div>
                </div>
                {canEditBank && (
                  <button className="btn btn-primary" id="save-bank" style={{ width: 'auto', marginTop: 8 }} onClick={saveBank}>
                    Save bank details
                  </button>
                )}
                {bank.data?.updatedAt && (
                  <div className="hint" style={{ marginTop: 8 }}>Last updated {fmtDateTime(bank.data.updatedAt)}</div>
                )}
              </section>
            )}

            {/* Personal Status Ring */}
            <section className="panel">
              <h3>Personal ring</h3>
              <StatusRing tasks={list} counts={statusCounts(list)} nameOf={() => user.name} onNavigate={() => {}} />
            </section>
          </div>
        </Page>
      )}
    </Resource>
  );
}
