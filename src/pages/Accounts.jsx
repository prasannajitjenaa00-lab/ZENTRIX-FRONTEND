import { useEffect, useState } from 'react';
import { packagesApi, usersApi } from '../services';
import { useAuth } from '../contexts/AuthContext';
import { useLive } from '../contexts/LiveContext';
import { useModal } from '../contexts/ModalContext';
import { useNav } from '../contexts/NavContext';
import { useToast } from '../contexts/ToastContext';
import { useHeader } from '../layouts/HeaderContext';
import { useResource } from '../hooks/useResource';
import { Page, Resource } from '../components/Page';
import PersonModal from '../modals/PersonModal';
import { fmtDate } from '../utils/format';

function PasswordCell({ userId }) {
  const [pwd, setPwd] = useState(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const toggle = async (e) => {
    e.stopPropagation();
    if (pwd !== null) {
      setPwd(null);
      return;
    }
    setLoading(true);
    try {
      const res = await usersApi.password(userId);
      setPwd(res.password || '—');
    } catch (err) {
      toast(err.message || 'Could not fetch password.');
      setPwd('••••••');
    } finally {
      setLoading(false);
    }
  };

  const copy = async (e) => {
    e.stopPropagation();
    if (!pwd || pwd === '—') return;
    try {
      await navigator.clipboard.writeText(pwd);
      toast('Password copied.');
    } catch {
      toast('Failed to copy.');
    }
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: '100%', overflow: 'hidden' }}>
      <span
        style={{
          fontFamily: 'monospace',
          fontSize: 11.5,
          color: pwd != null ? '#12c2d4' : 'var(--muted)',
          letterSpacing: pwd != null ? '0' : '1px',
          fontWeight: 600,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={pwd != null ? pwd : 'Click eye to view password'}
      >
        {pwd != null ? pwd : '••••••'}
      </span>
      <button
        type="button"
        onClick={toggle}
        title={pwd != null ? 'Hide password' : 'Show password'}
        disabled={loading}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '1px 3px',
          fontSize: 11,
          color: 'var(--soft)',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        {loading ? '…' : pwd != null ? '🙈' : '👁️'}
      </button>
      {pwd && pwd !== '—' && (
        <button
          type="button"
          onClick={copy}
          title="Copy password"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '1px 3px',
            fontSize: 11,
            color: 'var(--teal)',
            flexShrink: 0,
          }}
        >
          📋
        </button>
      )}
    </div>
  );
}

export default function Accounts() {
  const { user } = useAuth();
  const nav = useNav();
  const { open } = useModal();
  const toast = useToast();
  const { refresh } = useLive();
  useHeader('All Users', 'Manage registered users and account access');

  // accessible to authorized users

  const usersRes = useResource(async () => (await usersApi.list()).data, [user.id]);
  const pkgsRes = useResource(() => packagesApi.list(), [user.id]);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState('#');
  const [sortAsc, setSortAsc] = useState(true);

  const toggleStatus = async (person) => {
    const nextStatus = person.status === 'Active' ? 'Suspended' : 'Active';
    try {
      await usersApi.setStatus(person.id, nextStatus);
      toast(`User ${person.name} is now ${nextStatus}.`);
      usersRes.reload();
      refresh();
    } catch (ex) {
      toast(ex.message || 'Could not update user status.');
    }
  };

  const deleteAccount = async (person) => {
    if (person.role === 'admin') {
      return toast('Cannot delete an admin account.');
    }
    if (!window.confirm(`Delete user "${person.name}" (${person.email})?`)) {
      return;
    }
    try {
      await usersApi.remove(person.id);
      toast(`Account "${person.name}" deleted.`);
      usersRes.reload();
      refresh();
    } catch (ex) {
      toast(ex.message || 'Could not delete user.');
    }
  };

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    setSearch(searchInput.trim());
    setCurrentPage(1);
  };

  return (
    <Resource res={usersRes}>
      {(list) => {
        const pkgs = pkgsRes.data || [];
        const pkgMap = new Map(pkgs.map((p) => [String(p.id), p.name]));

        const getPkgLabel = (p) => {
          if (!p.packageId) return 'No Package';
          const name = pkgMap.get(String(p.packageId));
          if (name) return name.toLowerCase().includes('package') ? name : `${name} Package`;
          return '3400 Package';
        };

        // Live search filter across name, user ID, email, phone, referral
        const q = search.toLowerCase();
        const filtered = (list || []).filter((p) => {
          if (!q) return true;
          const name = (p.name || '').toLowerCase();
          const email = (p.email || '').toLowerCase();
          const userId = (p.legacyId || p.userId || '').toLowerCase();
          const phone = (p.phone || '').toLowerCase();
          const referral = (p.referralId || 'na').toLowerCase();
          return name.includes(q) || email.includes(q) || userId.includes(q) || phone.includes(q) || referral.includes(q);
        });

        // Sorting
        const sorted = [...filtered].sort((a, b) => {
          let valA, valB;
          switch (sortField) {
            case 'Name':
              valA = a.name || '';
              valB = b.name || '';
              break;
            case 'User Id':
              valA = a.legacyId || a.userId || a.email || '';
              valB = b.legacyId || b.userId || b.email || '';
              break;
            case 'Email':
              valA = a.email || '';
              valB = b.email || '';
              break;
            case 'Registration Date':
              valA = a.joined || a.createdAt || '';
              valB = b.joined || b.createdAt || '';
              break;
            case 'Status':
              valA = a.status || '';
              valB = b.status || '';
              break;
            default:
              return 0;
          }
          const cmp = String(valA).localeCompare(String(valB), undefined, { numeric: true });
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

        const thStyle = {
          color: '#ffffff',
          fontWeight: 700,
          fontSize: 12,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          padding: '12px 6px',
          verticalAlign: 'middle',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          borderBottom: 'none',
          textShadow: '0 1px 2px rgba(0, 0, 0, 0.45)',
        };

        return (
          <Page>
            <section
              className="panel"
              style={{
                borderRadius: 'var(--radius)',
                border: 'var(--glass-border)',
                background: 'var(--glass-bg)',
                boxShadow: 'var(--glass-shadow)',
                backdropFilter: 'var(--blur)',
                WebkitBackdropFilter: 'var(--blur)',
                padding: '20px 22px',
                color: 'var(--text)',
                width: '100%',
                maxWidth: '100%',
                margin: 0,
                boxSizing: 'border-box',
              }}
            >
              {/* Header: Title and Search Controls */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <div>
                  <h2
                    style={{
                      fontSize: 19,
                      fontWeight: 700,
                      color: 'var(--white)',
                      letterSpacing: '-0.02em',
                      margin: '0 0 3px',
                    }}
                  >
                    All Users
                  </h2>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Manage registered users and account access
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <form
                    onSubmit={handleSearchSubmit}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: 'rgba(15, 23, 42, 0.75)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: 7,
                      overflow: 'hidden',
                      padding: '2px',
                    }}
                  >
                    <div style={{ padding: '0 8px', color: 'var(--muted)', display: 'flex', alignItems: 'center' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                    </div>
                    <input
                      type="search"
                      value={searchInput}
                      onChange={(e) => {
                        setSearchInput(e.target.value);
                        if (!e.target.value.trim()) setSearch('');
                      }}
                      placeholder="Search name, user ID, referral, email or phone"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        color: 'var(--text)',
                        fontSize: 12.5,
                        padding: '5px 6px',
                        minWidth: 220,
                      }}
                    />
                    <button
                      type="submit"
                      style={{
                        background: '#0e9384',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 5,
                        padding: '5px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        margin: 1,
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                      Search
                    </button>
                  </form>

                  <button
                    type="button"
                    className="btn btn-lime btn-sm"
                    onClick={() => open(({ close }) => <PersonModal close={close} />)}
                    style={{ padding: '6px 14px', fontWeight: 600, fontSize: 12 }}
                  >
                    + Create account
                  </button>
                </div>
              </div>

              {/* Show entries selector */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 14,
                  fontSize: 12.5,
                  color: 'var(--muted)',
                }}
              >
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
                    borderRadius: 6,
                    padding: '3px 8px',
                    fontSize: 12,
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

              {/* Table Container - Strictly 100% width, NO horizontal scroll */}
              <div style={{ width: '100%', overflowX: 'hidden', borderRadius: 8 }}>
                <table
                  style={{
                    width: '100%',
                    tableLayout: 'fixed',
                    borderCollapse: 'collapse',
                    textAlign: 'left',
                    fontSize: 12,
                  }}
                >
                  <colgroup>
                    <col style={{ width: '3.5%' }} />
                    <col style={{ width: '4.5%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '6.5%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '9.5%' }} />
                    <col style={{ width: '9.5%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '6.5%' }} />
                  </colgroup>
                  <thead>
                    <tr
                      style={{
                        background: '#0e9384',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                      }}
                    >
                      <th style={{ ...thStyle, textAlign: 'center', width: '3.5%' }}>#</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>PHOTO</th>
                      <th
                        onClick={() => handleSort('Name')}
                        style={{ ...thStyle, cursor: 'pointer' }}
                      >
                        NAME <span style={{ opacity: 0.9, color: '#a7f3d0' }}>⇅</span>
                      </th>
                      <th
                        onClick={() => handleSort('User Id')}
                        style={{ ...thStyle, cursor: 'pointer' }}
                      >
                        USER ID <span style={{ opacity: 0.9, color: '#a7f3d0' }}>⇅</span>
                      </th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>REF ID</th>
                      <th
                        onClick={() => handleSort('Email')}
                        style={{ ...thStyle, cursor: 'pointer' }}
                      >
                        EMAIL <span style={{ opacity: 0.9, color: '#a7f3d0' }}>⇅</span>
                      </th>
                      <th style={{ ...thStyle }}>PHONE NO.</th>
                      <th style={{ ...thStyle }}>PASSWORD</th>
                      <th style={{ ...thStyle }}>PACKAGE</th>
                      <th
                        onClick={() => handleSort('Status')}
                        style={{ ...thStyle, cursor: 'pointer', textAlign: 'center' }}
                      >
                        STATUS <span style={{ opacity: 0.9, color: '#a7f3d0' }}>⇅</span>
                      </th>
                      <th
                        onClick={() => handleSort('Registration Date')}
                        style={{ ...thStyle, cursor: 'pointer' }}
                      >
                        DATE <span style={{ opacity: 0.9, color: '#a7f3d0' }}>⇅</span>
                      </th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={12}
                          style={{
                            padding: '30px 14px',
                            textAlign: 'center',
                            color: 'var(--muted)',
                            fontSize: 13,
                          }}
                        >
                          No users found matching your search.
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map((p, idx) => {
                        const rowNum = startIndex + idx + 1;
                        const userId = p.legacyId || p.userId || p.email.split('@')[0];
                        const fullUserId = p.legacyId || p.userId || p.email;
                        const referralId = p.referralId || 'NA';
                        const regDate = fmtDate(p.joined || p.createdAt);
                        const initialLetter = (p.name || '?')[0].toUpperCase();

                        return (
                          <tr
                            key={p.id}
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
                            {/* # */}
                            <td style={{ padding: '10px 4px', textAlign: 'center', color: 'var(--muted)', fontSize: 11.5 }}>
                              {rowNum}
                            </td>

                            {/* PHOTO */}
                            <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                              <div
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 6,
                                  background: 'rgba(14, 147, 132, 0.15)',
                                  border: '1px solid rgba(14, 147, 132, 0.35)',
                                  color: '#12c2d4',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700,
                                  fontSize: 12,
                                }}
                              >
                                {initialLetter}
                              </div>
                            </td>

                            {/* NAME */}
                            <td
                              style={{
                                padding: '10px 6px',
                                fontWeight: 600,
                                color: 'var(--white)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={p.name}
                            >
                              {p.name}
                            </td>

                            {/* USER ID */}
                            <td
                              style={{
                                padding: '10px 6px',
                                color: '#12c2d4',
                                fontWeight: 700,
                                fontFamily: 'monospace',
                                fontSize: 11.5,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={fullUserId}
                            >
                              {userId}
                            </td>

                            {/* REFERRAL ID */}
                            <td style={{ padding: '10px 4px', textAlign: 'center', color: 'var(--muted)', fontSize: 11 }}>
                              {referralId}
                            </td>

                            {/* EMAIL */}
                            <td
                              style={{
                                padding: '10px 6px',
                                color: 'var(--soft)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                fontSize: 11.5,
                              }}
                              title={p.email}
                            >
                              {p.email}
                            </td>

                            {/* PHONE NO. */}
                            <td
                              style={{
                                padding: '10px 6px',
                                color: 'var(--soft)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                fontFamily: 'monospace',
                                fontSize: 11.5,
                              }}
                              title={p.phone || '—'}
                            >
                              {p.phone || '—'}
                            </td>

                            {/* PASSWORD */}
                            <td style={{ padding: '10px 6px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              <PasswordCell userId={p.id} />
                            </td>

                            {/* PACKAGE */}
                            <td style={{ padding: '10px 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <span
                                style={{
                                  background: 'rgba(245, 158, 11, 0.12)',
                                  color: '#f59e0b',
                                  border: '1px solid rgba(245, 158, 11, 0.3)',
                                  borderRadius: 10,
                                  padding: '2px 7px',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  display: 'inline-block',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  maxWidth: '100%',
                                }}
                                title={getPkgLabel(p)}
                              >
                                {getPkgLabel(p)}
                              </span>
                            </td>

                            {/* STATUS */}
                            <td style={{ padding: '10px 4px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  background: p.status === 'Active' ? 'rgba(46, 194, 122, 0.12)' : 'rgba(244, 63, 94, 0.12)',
                                  color: p.status === 'Active' ? '#2ec27a' : '#f43f5e',
                                  border: `1px solid ${p.status === 'Active' ? 'rgba(46, 194, 122, 0.25)' : 'rgba(244, 63, 94, 0.25)'}`,
                                  borderRadius: 10,
                                  padding: '2px 7px',
                                  fontSize: 10.5,
                                  fontWeight: 600,
                                }}
                              >
                                <span style={{ fontSize: 8 }}>●</span> {p.status}
                              </span>
                            </td>

                            {/* REGISTRATION DATE */}
                            <td style={{ padding: '10px 6px', color: 'var(--soft)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {regDate}
                            </td>

                            {/* ACTION: 3 compact buttons */}
                            <td style={{ padding: '10px 4px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                {/* Edit */}
                                <button
                                  type="button"
                                  onClick={() => open(({ close }) => <PersonModal person={p} close={close} />)}
                                  title="Edit user details"
                                  style={{
                                    background: 'rgba(14, 147, 132, 0.12)',
                                    border: '1px solid rgba(14, 147, 132, 0.4)',
                                    color: '#12c2d4',
                                    borderRadius: 5,
                                    width: 24,
                                    height: 24,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    padding: 0,
                                  }}
                                >
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                  </svg>
                                </button>

                                {/* Suspend / Toggle */}
                                <button
                                  type="button"
                                  onClick={() => toggleStatus(p)}
                                  title={p.status === 'Active' ? 'Suspend user' : 'Restore user'}
                                  style={{
                                    background: 'rgba(245, 158, 11, 0.12)',
                                    border: '1px solid rgba(245, 158, 11, 0.4)',
                                    color: '#f59e0b',
                                    borderRadius: 5,
                                    width: 24,
                                    height: 24,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    padding: 0,
                                  }}
                                >
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                  </svg>
                                </button>

                                {/* Delete */}
                                <button
                                  type="button"
                                  onClick={() => deleteAccount(p)}
                                  title="Delete user"
                                  disabled={p.role === 'admin'}
                                  style={{
                                    background: p.role === 'admin' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(244, 63, 94, 0.12)',
                                    border: `1px solid ${p.role === 'admin' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(244, 63, 94, 0.4)'}`,
                                    color: p.role === 'admin' ? 'var(--muted)' : '#f43f5e',
                                    borderRadius: 5,
                                    width: 24,
                                    height: 24,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: p.role === 'admin' ? 'not-allowed' : 'pointer',
                                    padding: 0,
                                  }}
                                >
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination footer */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginTop: 18,
                  fontSize: 12,
                  color: 'var(--muted)',
                }}
              >
                <div>
                  {totalEntries > 0 ? (
                    <>
                      Showing {startIndex + 1} to {endIndex} of {totalEntries.toLocaleString()} entries
                    </>
                  ) : (
                    'Showing 0 to 0 of 0 entries'
                  )}
                </div>

                {totalEntries > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: page <= 1 ? 'var(--muted)' : 'var(--text)',
                        padding: '4px 10px',
                        borderRadius: 5,
                        fontSize: 11.5,
                        cursor: page <= 1 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Previous
                    </button>

                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (page <= 3) {
                        pageNum = i + 1;
                      } else if (page >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = page - 2 + i;
                      }

                      const isActive = page === pageNum;
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setCurrentPage(pageNum)}
                          style={{
                            background: isActive ? '#0e9384' : 'rgba(255, 255, 255, 0.05)',
                            border: `1px solid ${isActive ? '#0e9384' : 'rgba(255, 255, 255, 0.1)'}`,
                            color: isActive ? '#ffffff' : 'var(--text)',
                            padding: '4px 9px',
                            borderRadius: 5,
                            fontSize: 11.5,
                            fontWeight: isActive ? 600 : 400,
                            cursor: 'pointer',
                          }}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    {totalPages > 5 && page < totalPages - 2 && (
                      <>
                        <span style={{ color: 'var(--muted)', padding: '0 2px' }}>…</span>
                        <button
                          type="button"
                          onClick={() => setCurrentPage(totalPages)}
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: 'var(--text)',
                            padding: '4px 9px',
                            borderRadius: 5,
                            fontSize: 11.5,
                            cursor: 'pointer',
                          }}
                        >
                          {totalPages}
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: page >= totalPages ? 'var(--muted)' : 'var(--text)',
                        padding: '4px 10px',
                        borderRadius: 5,
                        fontSize: 11.5,
                        cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </section>
          </Page>
        );
      }}
    </Resource>
  );
}
