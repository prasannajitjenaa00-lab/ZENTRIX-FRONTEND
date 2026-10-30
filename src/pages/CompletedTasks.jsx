import { useMemo, useState } from 'react';
import { audioApi } from '../services';
import { audioUrl } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useLive } from '../contexts/LiveContext';
import { useModal } from '../contexts/ModalContext';
import { useHeader } from '../layouts/HeaderContext';
import { useResource } from '../hooks/useResource';
import { Page, Resource } from '../components/Page';
import { AssignmentReviewModal } from '../modals/SimpleModals';

function formatDuration(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function EmployeeCompletedModal({ employee, close, onChanged }) {
  const { open } = useModal();
  const res = useResource(async () => {
    const out = await audioApi.assignments({ employee: employee.id, limit: 100 });
    const all = out.data || [];
    // Only show completed/submitted/reviewed/approved tasks
    return all.filter((r) => ['submitted', 'reviewed', 'approved'].includes(r.status));
  }, [employee.id]);

  const openReview = (row) => {
    open(({ close: closeRev }) => (
      <AssignmentReviewModal
        row={row}
        close={closeRev}
        onChanged={() => {
          onChanged?.();
          closeRev();
        }}
      />
    ));
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, color: 'var(--white)' }}>
            {employee.name} — Completed Tasks
          </h3>
          <div style={{ fontSize: 12, color: 'var(--teal)', fontFamily: 'monospace', marginTop: 2 }}>
            {employee.email || employee.legacyId || ''}
          </div>
        </div>
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

      <Resource res={res}>
        {(rows) => (
          <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
            {!rows.length ? (
              <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                No completed tasks found for this employee yet.
              </div>
            ) : (
              <div className="table-wrap">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--muted)', fontSize: 12, textTransform: 'uppercase' }}>
                      <th style={{ padding: '10px 12px' }}>Track</th>
                      <th style={{ padding: '10px 12px' }}>Duration</th>
                      <th style={{ padding: '10px 12px' }}>Status</th>
                      <th style={{ padding: '10px 12px', minWidth: 200 }}>Audio Preview</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <td style={{ padding: '10px 12px', color: 'var(--white)', fontWeight: 500 }}>
                          🎵 {r.track?.originalName || 'Track'}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--teal)', fontWeight: 600 }}>
                          {formatDuration(r.track?.duration || 0)}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span className={`badge st-${r.displayStatus}`}>{r.displayStatus}</span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {r.track ? (
                            <audio
                              controls
                              preload="none"
                              src={audioUrl(r.track)}
                              style={{ width: '100%', height: 28, maxWidth: 220 }}
                            />
                          ) : (
                            <span style={{ color: 'var(--muted)', fontSize: 11 }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{
                              background: '#0e9384',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 6,
                              padding: '5px 12px',
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                            onClick={() => openReview(r)}
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Resource>

      <div className="modal-actions" style={{ marginTop: 14 }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={close}>
          Close
        </button>
      </div>
    </>
  );
}

export default function CompletedTasks() {
  const { user } = useAuth();
  const { open } = useModal();
  const { refresh } = useLive();
  useHeader('All Users Task', 'Dynamic overview of completed audio tasks and durations per employee');

  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState('#');
  const [sortAsc, setSortAsc] = useState(true);

  // Dynamic summary per employee
  const res = useResource(async () => {
    return await audioApi.assignmentsSummary();
  }, [user.id]);

  const openEmployeeModal = (emp) => {
    open(({ close }) => (
      <EmployeeCompletedModal
        employee={emp}
        close={close}
        onChanged={() => {
          res.reload();
          refresh();
        }}
      />
    ));
  };

  return (
    <Page>
      <Resource res={res}>
        {(rows) => {
          // Filter ONLY employees with completed tasks (totalAudioDone > 0)
          const completedOnly = (rows || []).filter((r) => Number(r.totalAudioDone) > 0);

          // Live search filter across name and email (User Id)
          const q = search.trim().toLowerCase();
          const filtered = completedOnly.filter((r) => {
            if (!q) return true;
            const name = (r.name || '').toLowerCase();
            const email = (r.email || '').toLowerCase();
            const legacyId = (r.legacyId || '').toLowerCase();
            return name.includes(q) || email.includes(q) || legacyId.includes(q);
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
                valA = a.email || a.legacyId || '';
                valB = b.email || b.legacyId || '';
                break;
              case 'Total Audio':
                valA = Number(a.totalAudioDone) || 0;
                valB = Number(b.totalAudioDone) || 0;
                return sortAsc ? valA - valB : valB - valA;
              case 'Total Duration':
                valA = Number(a.totalDurationDoneSec) || 0;
                valB = Number(b.totalDurationDoneSec) || 0;
                return sortAsc ? valA - valB : valB - valA;
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
              {/* Header Title */}
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
                  All Users Task
                </h2>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {totalEntries} user{totalEntries === 1 ? '' : 's'} with completed tasks
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
                  <label htmlFor="completed-search" style={{ fontWeight: 500, color: 'var(--soft)' }}>
                    Search:
                  </label>
                  <input
                    id="completed-search"
                    type="search"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search name, user ID..."
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

              {/* Data Table matching reference layout */}
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
                        style={{ padding: '12px 14px', cursor: 'pointer', whiteSpace: 'nowrap', width: 60 }}
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
                        onClick={() => handleSort('Total Audio')}
                        style={{ padding: '12px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Total Audio <span style={{ opacity: 0.5 }}>⇅</span>
                      </th>
                      <th
                        onClick={() => handleSort('Total Duration')}
                        style={{ padding: '12px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Total Duration <span style={{ opacity: 0.5 }}>⇅</span>
                      </th>
                      <th style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap', width: 90 }}>
                        View
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          style={{
                            padding: '36px 14px',
                            textAlign: 'center',
                            color: 'var(--muted)',
                            fontSize: 14,
                          }}
                        >
                          No completed tasks found.
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map((emp, idx) => {
                        const rowNum = startIndex + idx + 1;
                        const userId = emp.email || emp.legacyId || '—';
                        const durDone = formatDuration(emp.totalDurationDoneSec);

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
                            <td style={{ padding: '14px', color: 'var(--muted)' }}>{rowNum}</td>
                            <td
                              style={{
                                padding: '14px',
                                fontWeight: 600,
                                color: 'var(--white)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {emp.name}
                            </td>
                            <td style={{ padding: '14px', color: 'var(--teal)', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 12.5 }}>
                              {userId}
                            </td>
                            <td style={{ padding: '14px', color: 'var(--soft)', whiteSpace: 'nowrap' }}>
                              {emp.totalAudioDone}
                            </td>
                            <td
                              style={{
                                padding: '14px',
                                color: '#12c2d4',
                                fontWeight: 600,
                                fontFamily: 'monospace',
                                fontSize: 12.5,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {durDone}
                            </td>
                            <td style={{ padding: '14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <button
                                type="button"
                                className="btn btn-sm"
                                onClick={() => openEmployeeModal(emp)}
                                style={{
                                  background: '#0e9384',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: 6,
                                  padding: '6px 16px',
                                  fontWeight: 600,
                                  fontSize: 12,
                                  cursor: 'pointer',
                                  boxShadow: '0 2px 6px rgba(14, 147, 132, 0.35)',
                                  transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.filter = 'brightness(1.15)';
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.filter = 'none';
                                  e.currentTarget.style.transform = 'none';
                                }}
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 16,
                  marginTop: 22,
                  fontSize: 13,
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: page <= 1 ? 'var(--muted)' : 'var(--text)',
                        padding: '5px 12px',
                        borderRadius: 6,
                        fontSize: 12,
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
                            padding: '5px 11px',
                            borderRadius: 6,
                            fontSize: 12,
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
                        <span style={{ color: 'var(--muted)', padding: '0 4px' }}>…</span>
                        <button
                          type="button"
                          onClick={() => setCurrentPage(totalPages)}
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: 'var(--text)',
                            padding: '5px 11px',
                            borderRadius: 6,
                            fontSize: 12,
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
                        padding: '5px 12px',
                        borderRadius: 6,
                        fontSize: 12,
                        cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </section>
          );
        }}
      </Resource>
    </Page>
  );
}

