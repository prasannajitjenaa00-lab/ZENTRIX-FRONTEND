import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useHeader } from '../layouts/HeaderContext';
import { useLive } from '../contexts/LiveContext';
import { useToast } from '../contexts/ToastContext';
import { useResource } from '../hooks/useResource';
import { withdrawApi, usersApi } from '../services';
import { Page, Resource } from '../components/Page';
import { fmtDateTime } from '../utils/format';

export default function WithdrawView() {
  const { user } = useAuth();
  const toast = useToast();
  const { refresh } = useLive();
  useHeader('Withdraw', 'Request payouts from your earnings to your verified bank account');

  const res = useResource(() => withdrawApi.me(), [user.id]);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Bank setup form state if not already set
  const [bankForm, setBankForm] = useState({ holder: '', name: '', account: '', ifsc: '' });
  const [savingBank, setSavingBank] = useState(false);

  const handleWithdraw = async (availableBalance, currency) => {
    const num = Number(amount);
    if (!num || num <= 0) return toast('Please enter a valid withdrawal amount.');
    if (num < 100) return toast('Minimum withdrawal amount is ₹100.');
    if (num > availableBalance) {
      return toast(`Amount cannot exceed available balance (${currency}${availableBalance}).`);
    }

    setSubmitting(true);
    try {
      await withdrawApi.request({ amount: num, note: note.trim() });
      toast('Withdrawal request submitted successfully!');
      setAmount('');
      setNote('');
      refresh();
      res.reload();
    } catch (ex) {
      toast(ex.message || 'Failed to submit withdrawal request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveBank = async () => {
    const { holder, name, account, ifsc } = bankForm;
    if (!holder.trim() || !name.trim() || !account.trim() || !ifsc.trim()) {
      return toast('Please fill in all bank details.');
    }
    if (account.trim().length < 6 || account.trim().length > 20 || !/^\d+$/.test(account.trim())) {
      return toast('Account number must be 6 to 20 digits.');
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.trim().toUpperCase())) {
      return toast('IFSC code must be 11 characters (e.g. SBIN0001234).');
    }

    setSavingBank(true);
    try {
      await usersApi.saveMyBank({
        holder: holder.trim(),
        name: name.trim(),
        account: account.trim(),
        ifsc: ifsc.trim().toUpperCase()
      });
      toast('Bank details saved and linked to your wallet.');
      refresh();
      res.reload();
    } catch (ex) {
      toast(ex.message || 'Failed to save bank details.');
    } finally {
      setSavingBank(false);
    }
  };

  return (
    <Resource res={res}>
      {(d) => {
        const currency = d.currency || '₹';
        const available = d.availableBalance || 0;
        const totalEarned = d.totalEarned || 0;
        const totalWithdrawn = d.totalWithdrawn || 0;
        const pendingAmount = d.pendingAmount || 0;
        const bank = d.bank?.details;
        const hasBank = !!(d.bank?.hasDetails && bank?.account);
        const history = d.withdrawals || [];

        return (
          <Page>
            {/* Top 4 KPI Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 20 }}>
              {/* 1. Available Balance */}
              <div
                className="panel"
                style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 78, 59, 0.25))',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  padding: '16px 20px',
                  borderRadius: 14,
                  position: 'relative'
                }}
              >
                <div style={{ fontSize: 12, color: '#34d399', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Available to Withdraw
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span>{currency}</span>
                  <span>{available.toLocaleString()}</span>
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.65)', marginTop: 4 }}>
                  Earnings from transcribe tasks · Instant IMPS
                </div>
              </div>

              {/* 2. Total Earned */}
              <div
                className="panel"
                style={{
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(30, 58, 138, 0.25))',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  padding: '16px 20px',
                  borderRadius: 14
                }}
              >
                <div style={{ fontSize: 12, color: '#60a5fa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Income
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginTop: 6 }}>
                  {currency} {totalEarned.toLocaleString()}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.65)', marginTop: 4 }}>
                  {d.totalDurationSec > 0
                    ? `Base ${currency}${(d.packageBaseAmount ?? d.package?.amount ?? 0).toLocaleString()} + ${currency}${(d.audioEarnings ?? 0).toLocaleString()} audio earnings (${Math.floor(d.totalDurationSec / 60)}m ${d.totalDurationSec % 60}s)`
                    : `Base ${currency}${(d.packageBaseAmount ?? d.package?.amount ?? 0).toLocaleString()} · Rate: ${currency}${d.ratePerHour || 200}/hr`}
                </div>
              </div>

              {/* 3. Pending Withdrawals */}
              <div
                className="panel"
                style={{
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(120, 53, 15, 0.25))',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  padding: '16px 20px',
                  borderRadius: 14
                }}
              >
                <div style={{ fontSize: 12, color: '#fbbf24', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Pending Payouts
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginTop: 6 }}>
                  {currency} {pendingAmount.toLocaleString()}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.65)', marginTop: 4 }}>
                  In verification queue
                </div>
              </div>

              {/* 4. Total Withdrawn */}
              <div
                className="panel"
                style={{
                  background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12), rgba(88, 28, 135, 0.25))',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  padding: '16px 20px',
                  borderRadius: 14
                }}
              >
                <div style={{ fontSize: 12, color: '#c084fc', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Withdrawn
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginTop: 6 }}>
                  {currency} {totalWithdrawn.toLocaleString()}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.65)', marginTop: 4 }}>
                  Successfully disbursed
                </div>
              </div>
            </div>

            {/* Main 2-Column Section: Request Form & Linked Bank Details */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 24 }}>
              {/* Left Column: Request Withdrawal Form */}
              <section className="panel" style={{ padding: '22px 24px', borderRadius: 14 }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 8px' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2">
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                  Request Payout
                </h3>
                <p className="hint" style={{ margin: '0 0 18px', fontSize: 13 }}>
                  Transfer your earnings directly to your bank account via instant IMPS or NEFT.
                </p>

                {/* Amount Input */}
                <div className="field">
                  <label htmlFor="w-amount" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Amount ({currency})</span>
                    <span style={{ color: '#10b981', fontWeight: 600 }}>Max: {currency}{available.toLocaleString()}</span>
                  </label>
                  <input
                    id="w-amount"
                    type="number"
                    min="100"
                    max={available}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 500, 1000, 2000"
                    style={{ fontSize: 16, fontWeight: 600 }}
                  />
                </div>

                {/* Quick Amount Selectors */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                  {[500, 1000, 2000, 5000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className="btn btn-xs btn-ghost"
                      style={{
                        borderRadius: 14,
                        padding: '4px 10px',
                        fontSize: 12,
                        background: Number(amount) === preset ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                        border: Number(amount) === preset ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                        color: Number(amount) === preset ? '#10b981' : 'var(--text)'
                      }}
                      onClick={() => setAmount(String(preset))}
                    >
                      {currency}{preset.toLocaleString()}
                    </button>
                  ))}
                  {available > 0 && (
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost"
                      style={{
                        borderRadius: 14,
                        padding: '4px 10px',
                        fontSize: 12,
                        borderColor: '#10b981',
                        color: '#10b981'
                      }}
                      onClick={() => setAmount(String(available))}
                    >
                      Withdraw All ({currency}{available.toLocaleString()})
                    </button>
                  )}
                </div>

                {/* Transfer Method Notice */}
                <div
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10,
                    padding: '10px 14px',
                    marginBottom: 16,
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10
                  }}
                >
                  <span style={{ fontSize: 18 }}>⚡</span>
                  <div>
                    <strong style={{ color: '#fff' }}>Direct IMPS Bank Transfer</strong>
                    <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                      {hasBank ? `Destination: ${bank.name} (${bank.account})` : 'Destination bank not configured yet'}
                    </div>
                  </div>
                </div>

                {/* Optional Note */}
                <div className="field">
                  <label htmlFor="w-note">Remarks / Note (optional)</label>
                  <input
                    id="w-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Weekly earnings payout"
                  />
                </div>

                {/* Submit Action */}
                <button
                  type="button"
                  className="btn btn-lime"
                  id="submit-withdraw"
                  disabled={submitting || available < 100 || !hasBank}
                  onClick={() => handleWithdraw(available, currency)}
                  style={{ width: '100%', padding: '10px 18px', fontSize: 14, fontWeight: 700 }}
                >
                  {submitting ? 'Submitting Request…' : `Withdraw ${amount ? `${currency}${Number(amount).toLocaleString()}` : ''}`}
                </button>

                {!hasBank && (
                  <p style={{ color: '#f59e0b', fontSize: 12, margin: '8px 0 0', textAlign: 'center' }}>
                    ⚠️ Please link your bank details on the right to enable withdrawal.
                  </p>
                )}
                {hasBank && available < 100 && (
                  <p style={{ color: 'var(--muted)', fontSize: 12, margin: '8px 0 0', textAlign: 'center' }}>
                    💡 Min withdrawal is {currency}100. Transcribe assigned audio to increase your withdrawable balance.
                  </p>
                )}
              </section>

              {/* Right Column: Linked Bank Details / Setup */}
              <section className="panel" style={{ padding: '22px 24px', borderRadius: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.2">
                      <rect x="2" y="5" width="20" height="14" rx="2" />
                      <line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                    Payout Bank Account
                  </h3>
                  {hasBank && (
                    <span
                      style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: 12,
                        padding: '2px 8px',
                        fontSize: 11,
                        fontWeight: 600
                      }}
                    >
                      ✓ Verified
                    </span>
                  )}
                </div>

                <p className="hint" style={{ margin: '0 0 16px', fontSize: 13 }}>
                  Your earnings will be credited to this registered account.
                </p>

                {hasBank ? (
                  <div>
                    {/* Modern Bank Card View */}
                    <div
                      style={{
                        background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 12,
                        padding: '18px 20px',
                        color: '#fff',
                        marginBottom: 16
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#38bdf8' }}>{bank.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>Savings / Salary</span>
                      </div>
                      <div style={{ fontSize: 18, fontFamily: 'monospace', letterSpacing: 2, marginBottom: 14, color: '#f8fafc' }}>
                        {bank.account}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <div>
                          <div style={{ color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase' }}>Account Holder</div>
                          <div style={{ fontWeight: 600 }}>{bank.holder}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase' }}>IFSC Code</div>
                          <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>{bank.ifsc}</div>
                        </div>
                      </div>
                    </div>

                    <p style={{ color: 'var(--muted)', fontSize: 12 }}>
                      🔒 Bank details are encrypted with AES-256-GCM. Contact admin if you need to update your registered account.
                    </p>
                  </div>
                ) : (
                  <div>
                    {/* Form to enter bank details */}
                    <div className="field">
                      <label htmlFor="b-holder">Account Holder Name</label>
                      <input
                        id="b-holder"
                        value={bankForm.holder}
                        onChange={(e) => setBankForm({ ...bankForm, holder: e.target.value })}
                        placeholder="As shown in bank passbook"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="b-name">Bank Name</label>
                      <input
                        id="b-name"
                        value={bankForm.name}
                        onChange={(e) => setBankForm({ ...bankForm, name: e.target.value })}
                        placeholder="e.g. State Bank of India, HDFC, ICICI"
                      />
                    </div>
                    <div className="row-2">
                      <div className="field">
                        <label htmlFor="b-acc">Account Number</label>
                        <input
                          id="b-acc"
                          value={bankForm.account}
                          onChange={(e) => setBankForm({ ...bankForm, account: e.target.value })}
                          placeholder="e.g. 123456789012"
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="b-ifsc">IFSC Code</label>
                        <input
                          id="b-ifsc"
                          value={bankForm.ifsc}
                          onChange={(e) => setBankForm({ ...bankForm, ifsc: e.target.value.toUpperCase() })}
                          placeholder="e.g. SBIN0001234"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      id="save-bank-btn"
                      disabled={savingBank}
                      onClick={handleSaveBank}
                      style={{ width: '100%', marginTop: 8 }}
                    >
                      {savingBank ? 'Saving Bank Details…' : 'Link & Lock Bank Account'}
                    </button>
                  </div>
                )}
              </section>
            </div>

            {/* Bottom Section: Withdrawal History */}
            <section className="panel" style={{ padding: '22px 24px', borderRadius: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  Payout & Withdrawal History
                </h3>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{history.length} transactions</span>
              </div>

              {history.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        <th style={{ padding: '10px 12px', fontSize: 12, color: 'var(--muted)' }}>Date & Time</th>
                        <th style={{ padding: '10px 12px', fontSize: 12, color: 'var(--muted)' }}>Amount</th>
                        <th style={{ padding: '10px 12px', fontSize: 12, color: 'var(--muted)' }}>Destination</th>
                        <th style={{ padding: '10px 12px', fontSize: 12, color: 'var(--muted)' }}>Status</th>
                        <th style={{ padding: '10px 12px', fontSize: 12, color: 'var(--muted)' }}>Details / UTR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((item) => {
                        const isPending = item.status === 'pending';
                        const isApproved = item.status === 'approved';
                        const isCompleted = item.status === 'completed';
                        const isRejected = item.status === 'rejected';

                        const badgeColor = isCompleted
                          ? '#10b981'
                          : isApproved
                          ? '#38bdf8'
                          : isPending
                          ? '#f59e0b'
                          : '#ef4444';

                        const badgeBg = isCompleted
                          ? 'rgba(16, 185, 129, 0.15)'
                          : isApproved
                          ? 'rgba(56, 189, 248, 0.15)'
                          : isPending
                          ? 'rgba(245, 158, 11, 0.15)'
                          : 'rgba(239, 68, 68, 0.15)';

                        return (
                          <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '12px', fontSize: 13 }}>
                              {fmtDateTime(item.requestedAt)}
                            </td>
                            <td style={{ padding: '12px', fontSize: 14, fontWeight: 700, color: '#fff' }}>
                              {item.currency}{item.amount.toLocaleString()}
                            </td>
                            <td style={{ padding: '12px', fontSize: 13 }}>
                              <div>{item.bankDetails.name || 'Bank Transfer'}</div>
                              <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>
                                {item.bankDetails.account}
                              </div>
                            </td>
                            <td style={{ padding: '12px' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '3px 10px',
                                  borderRadius: 12,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: badgeColor,
                                  background: badgeBg,
                                  border: `1px solid ${badgeColor}33`,
                                  textTransform: 'capitalize'
                                }}
                              >
                                {isPending ? '⏳ Pending' : isApproved ? '✓ Approved' : isCompleted ? '✓ Transferred' : '✕ Rejected'}
                              </span>
                            </td>
                            <td style={{ padding: '12px', fontSize: 12, color: 'var(--muted)' }}>
                              {item.utr ? (
                                <div>
                                  <span style={{ color: '#10b981', fontWeight: 600 }}>UTR: </span>
                                  <span style={{ fontFamily: 'monospace' }}>{item.utr}</span>
                                </div>
                              ) : item.adminNote ? (
                                <span>{item.adminNote}</span>
                              ) : (
                                <span>{item.note || 'Direct payout request'}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--muted)' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>💳</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>No withdrawal requests yet</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    Your withdrawal transactions and payout statuses will appear here.
                  </div>
                </div>
              )}
            </section>
          </Page>
        );
      }}
    </Resource>
  );
}

export function AdminWithdrawalsView() {
  const { user } = useAuth();
  const toast = useToast();
  const { refresh } = useLive();
  useHeader('Withdrawal Requests', 'Review employee payout requests, approve transfers, and mark UTR numbers');

  const [statusFilter, setStatusFilter] = useState('all');
  const res = useResource(() => withdrawApi.list(statusFilter !== 'all' ? { status: statusFilter } : {}), [user.id, statusFilter]);

  const [actingId, setActingId] = useState(null);

  const handleAction = async (id, status) => {
    let adminNote = '';
    let utr = '';
    if (status === 'rejected') {
      const reason = window.prompt('Reason for rejection:');
      if (reason === null) return;
      adminNote = reason.trim() || 'Rejected by administrator';
    } else if (status === 'completed') {
      const ref = window.prompt('Enter IMPS/NEFT UTR / Transaction Reference:');
      if (ref === null) return;
      utr = ref.trim() || `IMPS${Date.now()}`;
    }

    setActingId(id);
    try {
      const payload = { status };
      if (adminNote) payload.adminNote = adminNote;
      if (utr) payload.utr = utr;
      await withdrawApi.updateStatus(id, payload);
      toast(status === 'approved' ? 'Request approved.' : status === 'completed' ? 'Payout marked as transferred!' : 'Request rejected.');
      refresh();
      res.reload();
    } catch (ex) {
      toast(ex.message || 'Action failed.');
    } finally {
      setActingId(null);
    }
  };

  return (
    <Resource res={res}>
      {(list) => {
        const rows = list || [];
        const pendingCount = rows.filter((r) => r.status === 'pending').length;
        const totalAmount = rows.reduce((s, r) => s + (r.amount || 0), 0);

        return (
          <Page>
            {/* Top Toolbar with Filter Tabs */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { key: 'all', label: 'All Requests' },
                  { key: 'pending', label: `Pending (${pendingCount})` },
                  { key: 'approved', label: 'Approved' },
                  { key: 'completed', label: 'Transferred' },
                  { key: 'rejected', label: 'Rejected' },
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className={`btn btn-xs ${statusFilter === t.key ? 'btn-lime' : 'btn-ghost'}`}
                    style={{
                      borderRadius: 16,
                      padding: '4px 12px',
                      fontSize: 12,
                      fontWeight: statusFilter === t.key ? 700 : 500
                    }}
                    onClick={() => setStatusFilter(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                Total Payouts: <strong style={{ color: '#fff' }}>₹{totalAmount.toLocaleString()}</strong> ({rows.length} requests)
              </div>
            </div>

            {/* Withdrawals List Table */}
            <section className="panel" style={{ padding: '20px', borderRadius: 14 }}>
              {rows.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        <th style={{ padding: '10px 12px', fontSize: 12, color: 'var(--muted)' }}>Employee</th>
                        <th style={{ padding: '10px 12px', fontSize: 12, color: 'var(--muted)' }}>Amount</th>
                        <th style={{ padding: '10px 12px', fontSize: 12, color: 'var(--muted)' }}>Bank Account</th>
                        <th style={{ padding: '10px 12px', fontSize: 12, color: 'var(--muted)' }}>Date</th>
                        <th style={{ padding: '10px 12px', fontSize: 12, color: 'var(--muted)' }}>Status</th>
                        <th style={{ padding: '10px 12px', fontSize: 12, color: 'var(--muted)', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const isPending = row.status === 'pending';
                        const isApproved = row.status === 'approved';
                        const isCompleted = row.status === 'completed';
                        const isRejected = row.status === 'rejected';

                        const badgeColor = isCompleted
                          ? '#10b981'
                          : isApproved
                          ? '#38bdf8'
                          : isPending
                          ? '#f59e0b'
                          : '#ef4444';

                        const badgeBg = isCompleted
                          ? 'rgba(16, 185, 129, 0.15)'
                          : isApproved
                          ? 'rgba(56, 189, 248, 0.15)'
                          : isPending
                          ? 'rgba(245, 158, 11, 0.15)'
                          : 'rgba(239, 68, 68, 0.15)';

                        return (
                          <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '12px', fontSize: 13 }}>
                              <strong>{row.employeeName || row.user?.name || 'Employee'}</strong>
                              <div style={{ color: 'var(--muted)', fontSize: 11 }}>{row.employeeEmail || row.user?.email || ''}</div>
                            </td>
                            <td style={{ padding: '12px', fontSize: 14, fontWeight: 700, color: '#fff' }}>
                              {row.currency}{row.amount.toLocaleString()}
                            </td>
                            <td style={{ padding: '12px', fontSize: 13 }}>
                              <div style={{ fontWeight: 600 }}>{row.bankDetails?.name || 'Bank Transfer'}</div>
                              <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--muted)' }}>
                                {row.bankDetails?.account} · IFSC: {row.bankDetails?.ifsc}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Holder: {row.bankDetails?.holder}</div>
                            </td>
                            <td style={{ padding: '12px', fontSize: 12, color: 'var(--muted)' }}>
                              {fmtDateTime(row.requestedAt)}
                            </td>
                            <td style={{ padding: '12px' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '3px 10px',
                                  borderRadius: 12,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: badgeColor,
                                  background: badgeBg,
                                  border: `1px solid ${badgeColor}33`,
                                  textTransform: 'capitalize'
                                }}
                              >
                                {isPending ? '⏳ Pending' : isApproved ? '✓ Approved' : isCompleted ? '✓ Transferred' : '✕ Rejected'}
                              </span>
                              {row.utr && (
                                <div style={{ fontSize: 11, color: '#10b981', marginTop: 4, fontFamily: 'monospace' }}>
                                  UTR: {row.utr}
                                </div>
                              )}
                              {row.adminNote && (
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                                  {row.adminNote}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                {isPending && (
                                  <>
                                    <button
                                      type="button"
                                      className="btn btn-lime btn-xs"
                                      disabled={actingId === row.id}
                                      onClick={() => handleAction(row.id, 'approved')}
                                    >
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-danger btn-xs"
                                      disabled={actingId === row.id}
                                      onClick={() => handleAction(row.id, 'rejected')}
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                                {isApproved && (
                                  <button
                                    type="button"
                                    className="btn btn-lime btn-xs"
                                    disabled={actingId === row.id}
                                    onClick={() => handleAction(row.id, 'completed')}
                                  >
                                    Mark Transferred (UTR)
                                  </button>
                                )}
                                {isCompleted && (
                                  <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>
                                    ✓ Disbursed
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--muted)' }}>
                  No withdrawal requests in this view.
                </div>
              )}
            </section>
          </Page>
        );
      }}
    </Resource>
  );
}

