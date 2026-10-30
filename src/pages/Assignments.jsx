import { useMemo, useState } from 'react';
import { audioApi } from '../services';
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

function EmployeeAssignmentsModal({ employee, close, onChanged }) {
  const { open } = useModal();
  const res = useResource(async () => {
    const out = await audioApi.assignments({ employee: employee.id, limit: 100 });
    return out.data || [];
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
            {employee.name} — Assigned Audios
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
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {!rows.length ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                No audio files assigned to this employee.
              </div>
            ) : (
              <div className="table-wrap">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--muted)', fontSize: 12, textTransform: 'uppercase' }}>
                      <th style={{ padding: '10px 12px' }}>Track</th>
                      <th style={{ padding: '10px 12px' }}>Duration</th>
                      <th style={{ padding: '10px 12px' }}>Status</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <td style={{ padding: '10px 12px', color: 'var(--white)', fontWeight: 500 }}>
                          🎵 {r.track?.originalName || 'Track'}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--soft)' }}>
                          {formatDuration(r.track?.duration || 0)}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span className={`badge st-${r.displayStatus}`}>{r.displayStatus}</span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-lime btn-sm"
                            style={{ padding: '4px 10px', fontSize: 11 }}
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

export default function Assignments() {
  const { user } = useAuth();
  const { open } = useModal();
  const { refresh } = useLive();
  useHeader('All Assignments', 'Track total audio assigned, completed audio counts, and durations per employee');

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
      <EmployeeAssignmentsModal
        employee={emp}
        close={close}
        onChanged={() => {
          refresh();
        }}
      />
    ));
  };

  return (
    <Page>
      <Resource res={res}>
        {(rows) => {
          // Live search filter across name and email (user ID)
          const q = search.trim().toLowerCase();
          const filtered = (rows || []).filter((r) => {
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
              case 'Total Audio Given':
                valA = Number(a.totalAudioGiven) || 0;
                valB = Number(b.totalAudioGiven) || 0;
                return sortAsc ? valA - valB : valB - valA;
              case 'Total Audio Done':
                valA = Number(a.totalAudioDone) || 0;
                valB = Number(b.totalAudioDone) || 0;
                return sortAsc ? valA - valB : valB - valA;
              case 'Total Duration Given':
                valA = Number(a.totalDurationGivenSec) || 0;
                valB = Number(b.totalDurationGivenSec) || 0;
                return sortAsc ? valA - valB : valB - valA;
              case 'Total Duration Done':
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
                  All Assignments
                </h2>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {totalEntries} employee{totalEntries === 1 ? '' : 's'} assigned
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
                  <label htmlFor="assign-search" style={{ fontWeight: 500, color: 'var(--soft)' }}>
                    Search:
                  </label>
                  <input
                    id="assign-search"
                    type="search"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search name, email ID..."
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
                        onClick={() => handleSort('Total Audio Given')}
                        style={{ padding: '12px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Total Audio Given <span style={{ opacity: 0.5 }}>⇅</span>
                      </th>
                      <th
                        onClick={() => handleSort('Total Audio Done')}
                        style={{ padding: '12px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Total Audio Done <span style={{ opacity: 0.5 }}>⇅</span>
                      </th>
                      <th
                        onClick={() => handleSort('Total Duration Given')}
                        style={{ padding: '12px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Total Duration Given <span style={{ opacity: 0.5 }}>⇅</span>
                      </th>
                      <th
                        onClick={() => handleSort('Total Duration Done')}
                        style={{ padding: '12px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Total Duration Done <span style={{ opacity: 0.5 }}>⇅</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          style={{
                            padding: '36px 14px',
                            textAlign: 'center',
                            color: 'var(--muted)',
                            fontSize: 14,
                          }}
                        >
                          No matching assignments found.
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map((emp, idx) => {
                        const rowNum = startIndex + idx + 1;
                        const userId = emp.email || emp.legacyId || '—';
                        const durGiven = formatDuration(emp.totalDurationGivenSec);
                        const durDone = formatDuration(emp.totalDurationDoneSec);

                        return (
                          <tr
                            key={emp.id}
                            onClick={() => openEmployeeModal(emp)}
                            title="Click to view assigned audios & review"
                            style={{
                              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                              transition: 'background 0.15s ease',
                              cursor: 'pointer',
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
                              {emp.totalAudioGiven}
                            </td>
                            <td style={{ padding: '13px 14px', color: emp.totalAudioDone > 0 ? 'var(--ok)' : 'var(--soft)', whiteSpace: 'nowrap', fontWeight: 600 }}>
                              {emp.totalAudioDone}
                            </td>
                            <td style={{ padding: '13px 14px', color: 'var(--soft)', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                              {durGiven}
                            </td>
                            <td style={{ padding: '13px 14px', color: emp.totalDurationDoneSec > 0 ? 'var(--ok)' : 'var(--soft)', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                              {durDone}
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
