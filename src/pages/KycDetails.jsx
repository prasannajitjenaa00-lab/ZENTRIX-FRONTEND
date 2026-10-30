import { useMemo, useState } from 'react';
import { usersApi } from '../services';
import { useAuth } from '../contexts/AuthContext';
import { useLive } from '../contexts/LiveContext';
import { useModal } from '../contexts/ModalContext';
import { useToast } from '../contexts/ToastContext';
import { useHeader } from '../layouts/HeaderContext';
import { useResource } from '../hooks/useResource';
import { Page, Resource } from '../components/Page';

function formatUserId(user) {
  return user?.email || user?.legacyId || user?.id || '';
}

function EditKycModal({ user, close, onSaved }) {
  const toast = useToast();
  const bd = user.bankDetails || {};
  const [f, setF] = useState({
    name: user.name || '',
    email: user.email || '',
    account: bd.account || '',
    ifsc: bd.ifsc || '',
    bankName: bd.name || '',
    holder: bd.holder || user.name || '',
    upi: bd.upi || '',
    unlock: !user.bank?.locked,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async (e) => {
    e?.preventDefault();
    setError('');
    setSaving(true);
    try {
      await usersApi.updateBank(user.id, {
        account: f.account.trim(),
        ifsc: f.ifsc.trim().toUpperCase(),
        name: f.bankName.trim(),
        holder: f.holder.trim(),
        upi: f.upi.trim(),
        userName: f.name.trim(),
        unlock: f.unlock,
      });
      toast('KYC details updated successfully.');
      onSaved?.();
      close();
    } catch (err) {
      setError(err.message || 'Failed to update KYC details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 18, color: 'var(--white)' }}>
          Edit KYC Details
        </h3>
        <button
          type="button"
          onClick={close}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: 22,
            cursor: 'pointer',
            color: 'var(--muted)',
            lineHeight: 1,
            padding: 0,
          }}
        >
          ×
        </button>
      </div>

      <p className="hint" style={{ margin: '-6px 0 16px', color: 'var(--muted)', fontSize: 13 }}>
        Update banking credentials and KYC information for this employee.
      </p>

      {error && <div className="auth-error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}

      <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="row-2">
          <div className="field">
            <label>Employee Name</label>
            <input
              type="text"
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              required
            />
          </div>

          <div className="field">
            <label>User Id (Email)</label>
            <input
              type="email"
              value={f.email}
              disabled
              title="Employee ID is the user email address"
              style={{ opacity: 0.7, cursor: 'not-allowed' }}
            />
          </div>
        </div>

        <div style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 12, background: 'rgba(10, 22, 40, 0.35)' }}>
          <strong style={{ fontSize: 13, color: 'var(--teal)', display: 'block', marginBottom: 10 }}>
            Bank & Payment Information
          </strong>

          <div className="row-2">
            <div className="field">
              <label>Bank Name</label>
              <input
                type="text"
                value={f.bankName}
                onChange={(e) => setF({ ...f, bankName: e.target.value })}
                placeholder="e.g. State Bank of India"
              />
            </div>

            <div className="field">
              <label>Account Holder Name</label>
              <input
                type="text"
                value={f.holder}
                onChange={(e) => setF({ ...f, holder: e.target.value })}
                placeholder="Holder name"
              />
            </div>
          </div>

          <div className="row-2" style={{ marginTop: 8 }}>
            <div className="field">
              <label>Account Number</label>
              <input
                type="text"
                value={f.account}
                onChange={(e) => setF({ ...f, account: e.target.value })}
                placeholder="Account number"
              />
            </div>

            <div className="field">
              <label>IFSC Code</label>
              <input
                type="text"
                value={f.ifsc}
                onChange={(e) => setF({ ...f, ifsc: e.target.value.toUpperCase() })}
                placeholder="e.g. SBIN0001234"
              />
            </div>
          </div>

          <div className="field" style={{ marginTop: 8 }}>
            <label>UPI ID</label>
            <input
              type="text"
              value={f.upi}
              onChange={(e) => setF({ ...f, upi: e.target.value })}
              placeholder="e.g. username@ybl or NA"
            />
          </div>

          <label className="trust-row" style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--soft)' }}>
            <input
              type="checkbox"
              checked={f.unlock}
              onChange={(e) => setF({ ...f, unlock: e.target.checked })}
            />
            Allow employee to update bank/KYC details (Unlocked)
          </label>
        </div>

        <div className="modal-actions" style={{ marginTop: 8 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={close} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-lime btn-sm" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </>
  );
}

export default function KycDetails() {
  const { user } = useAuth();
  const { open } = useModal();
  const { refresh } = useLive();
  useHeader('Kyc Details', 'Manage employee KYC details and bank credentials');

  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState('#');
  const [sortAsc, setSortAsc] = useState(true);

  // Fetch all accounts with bank and KYC decrypted
  const res = useResource(async () => {
    const out = await usersApi.list({ limit: 500, includeBank: 1 });
    return out.data || [];
  }, [user.id]);

  const handleEdit = (emp) => {
    open(({ close }) => (
      <EditKycModal
        user={emp}
        close={close}
        onSaved={() => {
          refresh();
        }}
      />
    ));
  };

  return (
    <Page>
      <Resource res={res}>
        {(allUsers) => {
          // Filter to employees (or all if empty)
          const employees = allUsers.filter((u) => u.role === 'employee');
          const sourceList = employees.length > 0 ? employees : allUsers;

          // Search filtering across all fields
          const q = search.trim().toLowerCase();
          const filtered = sourceList.filter((emp) => {
            if (!q) return true;
            const emailId = (emp.email || '').toLowerCase();
            const name = (emp.name || '').toLowerCase();
            const acc = (emp.bankDetails?.account || '').toLowerCase();
            const ifsc = (emp.bankDetails?.ifsc || '').toLowerCase();
            const bank = (emp.bankDetails?.name || '').toLowerCase();
            const upi = (emp.bankDetails?.upi || '').toLowerCase();
            return (
              emailId.includes(q) ||
              name.includes(q) ||
              acc.includes(q) ||
              ifsc.includes(q) ||
              bank.includes(q) ||
              upi.includes(q)
            );
          });

          // Sorting
          const sorted = [...filtered].sort((a, b) => {
            let valA = '';
            let valB = '';
            switch (sortField) {
              case 'Name':
                valA = a.name || '';
                valB = b.name || '';
                break;
              case 'User Id':
                valA = a.email || '';
                valB = b.email || '';
                break;
              case 'Acc No':
                valA = a.bankDetails?.account || '';
                valB = b.bankDetails?.account || '';
                break;
              case 'IFSC Code':
                valA = a.bankDetails?.ifsc || '';
                valB = b.bankDetails?.ifsc || '';
                break;
              case 'Bank Name':
                valA = a.bankDetails?.name || '';
                valB = b.bankDetails?.name || '';
                break;
              case 'UPI ID':
                valA = a.bankDetails?.upi || '';
                valB = b.bankDetails?.upi || '';
                break;
              default:
                return 0;
            }
            const cmp = valA.localeCompare(valB, undefined, { numeric: true });
            return sortAsc ? cmp : -cmp;
          });

          // Pagination
          const totalEntries = sorted.length;
          const totalPages = Math.ceil(totalEntries / pageSize) || 1;
          const page = Math.min(Math.max(1, currentPage), totalPages);
          const startIndex = (page - 1) * pageSize;
          const paginatedRows = sorted.slice(startIndex, startIndex + pageSize);
          const endIndex = Math.min(startIndex + pageSize, totalEntries);

          const handleSort = (field) => {
            if (sortField === field) {
              setSortAsc(!sortAsc);
            } else {
              setSortField(field);
              setSortAsc(true);
            }
          };

          return (
            <section
              className="panel"
              style={{
                borderRadius: 'var(--radius)',
                border: 'var(--glass-border)',
                background: 'var(--glass-bg)',
                boxShadow: 'var(--glass-shadow)',
                backdropFilter: 'var(--blur)',
                WebkitBackdropFilter: 'var(--blur)',
                padding: '24px 28px',
                color: 'var(--text)',
                maxWidth: 1400,
                margin: '0 auto',
              }}
            >
              {/* Top Title */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                <h2
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: 'var(--white)',
                    letterSpacing: '-0.02em',
                    margin: 0,
                  }}
                >
                  Kyc Details
                </h2>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {totalEntries} employee account{totalEntries === 1 ? '' : 's'}
                </div>
              </div>

              {/* Controls Bar: Show entries & Search */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 16,
                  marginBottom: 18,
                  fontSize: 13,
                  color: 'var(--muted)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>Show</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    style={{
                      background: 'rgba(15, 23, 42, 0.65)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: 8,
                      padding: '5px 12px',
                      fontSize: 13,
                      color: 'var(--text)',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span>entries</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label htmlFor="kyc-search" style={{ fontWeight: 500, color: 'var(--soft)' }}>
                    Search:
                  </label>
                  <input
                    id="kyc-search"
                    type="search"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search name, email, acc, ifsc..."
                    style={{
                      background: 'rgba(15, 23, 42, 0.65)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: 8,
                      padding: '6px 14px',
                      fontSize: 13,
                      color: 'var(--text)',
                      outline: 'none',
                      minWidth: 240,
                    }}
                  />
                </div>
              </div>

              {/* Data Table */}
              <div className="table-wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    textAlign: 'left',
                    fontSize: 13,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
                        color: 'var(--muted)',
                        fontWeight: 600,
                        fontSize: 12,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      <th
                        onClick={() => handleSort('#')}
                        style={{ padding: '12px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        # <span style={{ opacity: 0.5 }}>⇅</span>
                      </th>
                      <th
                        onClick={() => handleSort('Name')}
                        style={{ padding: '12px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Name <span style={{ opacity: 0.5 }}>⇅</span>
                      </th>
                      <th
                        onClick={() => handleSort('User Id')}
                        style={{ padding: '12px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        User Id <span style={{ opacity: 0.5 }}>⇅</span>
                      </th>
                      <th
                        onClick={() => handleSort('Acc No')}
                        style={{ padding: '12px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Acc No <span style={{ opacity: 0.5 }}>⇅</span>
                      </th>
                      <th
                        onClick={() => handleSort('IFSC Code')}
                        style={{ padding: '12px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        IFSC Code <span style={{ opacity: 0.5 }}>⇅</span>
                      </th>
                      <th
                        onClick={() => handleSort('Bank Name')}
                        style={{ padding: '12px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Bank Name <span style={{ opacity: 0.5 }}>⇅</span>
                      </th>
                      <th
                        onClick={() => handleSort('UPI ID')}
                        style={{ padding: '12px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        UPI ID <span style={{ opacity: 0.5 }}>⇅</span>
                      </th>
                      <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        Action <span style={{ opacity: 0.5 }}>⇅</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          style={{
                            padding: '36px 14px',
                            textAlign: 'center',
                            color: 'var(--muted)',
                            fontSize: 14,
                          }}
                        >
                          No matching KYC records found.
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map((emp, idx) => {
                        const rowNum = startIndex + idx + 1;
                        const userId = emp.email || formatUserId(emp);
                        const bd = emp.bankDetails || {};
                        const accNo = bd.account || '';
                        const ifsc = bd.ifsc || '';
                        const bankName = bd.name || '';
                        const upiId = bd.upi || (accNo ? 'NA' : '');

                        return (
                          <tr
                            key={emp.id}
                            style={{
                              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                              transition: 'background 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <td style={{ padding: '13px 14px', color: 'var(--muted)' }}>{rowNum}</td>
                            <td
                              style={{
                                padding: '13px 14px',
                                fontWeight: 600,
                                color: 'var(--white)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {emp.name}
                            </td>
                            <td style={{ padding: '13px 14px', color: 'var(--teal)', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 12.5 }}>
                              {userId}
                            </td>
                            <td style={{ padding: '13px 14px', color: 'var(--soft)', whiteSpace: 'nowrap' }}>
                              {accNo || <span style={{ color: 'var(--muted)', opacity: 0.5 }}>—</span>}
                            </td>
                            <td style={{ padding: '13px 14px', color: 'var(--soft)', whiteSpace: 'nowrap' }}>
                              {ifsc || <span style={{ color: 'var(--muted)', opacity: 0.5 }}>—</span>}
                            </td>
                            <td style={{ padding: '13px 14px', color: 'var(--soft)', whiteSpace: 'nowrap' }}>
                              {bankName || <span style={{ color: 'var(--muted)', opacity: 0.5 }}>—</span>}
                            </td>
                            <td style={{ padding: '13px 14px', color: 'var(--soft)', whiteSpace: 'nowrap' }}>
                              {upiId || <span style={{ color: 'var(--muted)', opacity: 0.5 }}>—</span>}
                            </td>
                            <td style={{ padding: '13px 14px', whiteSpace: 'nowrap' }}>
                              <button
                                type="button"
                                onClick={() => handleEdit(emp)}
                                title="Edit KYC Details"
                                style={{
                                  background: 'rgba(46, 194, 122, 0.12)',
                                  border: '1px solid rgba(46, 194, 122, 0.3)',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  padding: '5px 8px',
                                  color: 'var(--ok)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.2s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(46, 194, 122, 0.25)';
                                  e.currentTarget.style.borderColor = 'var(--ok)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'rgba(46, 194, 122, 0.12)';
                                  e.currentTarget.style.borderColor = 'rgba(46, 194, 122, 0.3)';
                                }}
                              >
                                <svg
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Bottom Pagination Bar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 16,
                  marginTop: 20,
                  fontSize: 12.5,
                  color: 'var(--muted)',
                }}
              >
                <div>
                  Showing {totalEntries > 0 ? startIndex + 1 : 0} to {endIndex} of{' '}
                  {totalEntries.toLocaleString()} entries
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="btn btn-ghost btn-sm"
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      opacity: page <= 1 ? 0.4 : 1,
                      cursor: page <= 1 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Previous
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                    .map((p, i, arr) => {
                      const prev = arr[i - 1];
                      const showEllipsis = prev && p - prev > 1;
                      return (
                        <span key={p} style={{ display: 'inline-flex', alignItems: 'center' }}>
                          {showEllipsis && <span style={{ padding: '0 6px', color: 'var(--muted)' }}>...</span>}
                          <button
                            type="button"
                            onClick={() => setCurrentPage(p)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 6,
                              border: p === page ? '1px solid var(--teal)' : '1px solid var(--line)',
                              background: p === page ? 'var(--teal)' : 'rgba(255, 255, 255, 0.05)',
                              color: p === page ? 'var(--ink)' : 'var(--text)',
                              fontWeight: p === page ? 700 : 400,
                              cursor: 'pointer',
                              fontSize: 12,
                              minWidth: 30,
                              boxShadow: p === page ? '0 0 10px rgba(18, 194, 212, 0.4)' : 'none',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {p}
                          </button>
                        </span>
                      );
                    })}

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="btn btn-ghost btn-sm"
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      opacity: page >= totalPages ? 0.4 : 1,
                      cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            </section>
          );
        }}
      </Resource>
    </Page>
  );
}
