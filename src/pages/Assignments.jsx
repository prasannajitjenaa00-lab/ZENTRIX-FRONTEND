import { useState } from 'react';
import { audioApi, usersApi } from '../services';
import { useAuth } from '../contexts/AuthContext';
import { useLive } from '../contexts/LiveContext';
import { useModal } from '../contexts/ModalContext';
import { useToast } from '../contexts/ToastContext';
import { useHeader } from '../layouts/HeaderContext';
import { useResource } from '../hooks/useResource';
import { Page, Resource } from '../components/Page';
import { AssignmentReviewModal } from '../modals/SimpleModals';
import { fmtDate, fmtDateTime } from '../utils/format';

const STATUS_OPTIONS = [
  ['', 'All statuses'],
  ['assigned', 'Pending'],
  ['in_progress', 'In Progress'],
  ['submitted', 'Submitted'],
  ['reviewed', 'Reviewed'],
  ['revision_requested', 'Revision requested'],
  ['overdue', 'Overdue'],
];

export default function Assignments() {
  const { user } = useAuth();
  const { open } = useModal();
  const toast = useToast();
  const { refresh } = useLive();
  useHeader('All Assignments', 'Track audio assignments and review submitted transcriptions');

  const [employee, setEmployee] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const people = useResource(() => usersApi.assignable(), [user.id], { live: false });
  const res = useResource(
    async () =>
      (
        await audioApi.assignments({
          employee: employee || undefined,
          status: status || undefined,
          from: from || undefined,
          to: to || undefined,
        })
      ).data,
    [user.id, employee, status, from, to]
  );

  const openReview = (row) =>
    open(({ close }) => <AssignmentReviewModal row={row} close={close} onChanged={refresh} />);

  const remove = async (row) => {
    try {
      await audioApi.removeAssignment(row.id);
      toast('Assignment removed.');
      refresh();
    } catch (ex) {
      toast(ex.message);
    }
  };

  const hasFilter = !!(employee || status || from || to);
  const resetFilters = () => {
    setEmployee('');
    setStatus('');
    setFrom('');
    setTo('');
  };

  return (
    <Page>
      <Resource res={res}>
        {(rows) => {
          const totalCount = rows.length;
          const submittedCount = rows.filter((r) => r.status === 'submitted').length;
          const reviewedCount = rows.filter((r) => r.status === 'reviewed' || r.status === 'approved').length;
          const pendingCount = rows.filter((r) => ['assigned', 'pending', 'in_progress'].includes(r.status)).length;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Responsive KPI Metrics Bar */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: 10,
                }}
              >
                <div
                  className="panel"
                  style={{
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: 'rgba(18, 194, 212, 0.1)',
                    border: '1px solid rgba(18, 194, 212, 0.25)',
                  }}
                >
                  <div style={{ fontSize: 11, color: '#38bdf8', fontWeight: 600, textTransform: 'uppercase' }}>
                    Total
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginTop: 4 }}>{totalCount}</div>
                </div>

                <div
                  className="panel"
                  style={{
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                  }}
                >
                  <div style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600, textTransform: 'uppercase' }}>
                    Pending
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginTop: 4 }}>{pendingCount}</div>
                </div>

                <div
                  className="panel"
                  style={{
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                  }}
                >
                  <div style={{ fontSize: 11, color: '#60a5fa', fontWeight: 600, textTransform: 'uppercase' }}>
                    Submitted
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginTop: 4 }}>{submittedCount}</div>
                </div>

                <div
                  className="panel"
                  style={{
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                  }}
                >
                  <div style={{ fontSize: 11, color: '#34d399', fontWeight: 600, textTransform: 'uppercase' }}>
                    Reviewed
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginTop: 4 }}>{reviewedCount}</div>
                </div>
              </div>

              {/* Main Container */}
              <section
                className="panel"
                style={{
                  borderRadius: 16,
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(10, 22, 40, 0.45)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  padding: '18px 20px',
                }}
              >
                {/* Responsive Filter Toolbar */}
                <div className="assignments-toolbar">
                  <select
                    value={employee}
                    onChange={(e) => setEmployee(e.target.value)}
                    style={{
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: 'var(--text)',
                      borderRadius: 10,
                      padding: '8px 12px',
                      fontSize: 13,
                      width: '100%',
                    }}
                  >
                    <option value="">All employees</option>
                    {people.data?.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    style={{
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: 'var(--text)',
                      borderRadius: 10,
                      padding: '8px 12px',
                      fontSize: 13,
                      width: '100%',
                    }}
                  >
                    {STATUS_OPTIONS.map(([v, label]) => (
                      <option key={v} value={v}>
                        {label}
                      </option>
                    ))}
                  </select>

                  <div style={{ position: 'relative', width: '100%' }}>
                    <input
                      type="date"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                      title="Assigned from date"
                      placeholder="From date"
                      style={{
                        background: 'rgba(15, 23, 42, 0.6)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: 'var(--text)',
                        borderRadius: 10,
                        padding: '8px 12px',
                        fontSize: 13,
                        width: '100%',
                      }}
                    />
                  </div>

                  <div style={{ position: 'relative', width: '100%' }}>
                    <input
                      type="date"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      title="Assigned to date"
                      placeholder="To date"
                      style={{
                        background: 'rgba(15, 23, 42, 0.6)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: 'var(--text)',
                        borderRadius: 10,
                        padding: '8px 12px',
                        fontSize: 13,
                        width: '100%',
                      }}
                    />
                  </div>

                  {hasFilter && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={resetFilters}
                      style={{
                        borderRadius: 10,
                        padding: '8px 14px',
                        fontSize: 12,
                        width: '100%',
                        gridColumn: 'span 1',
                      }}
                    >
                      ✕ Reset filters
                    </button>
                  )}
                </div>

                {!rows.length ? (
                  <div className="empty" style={{ padding: '36px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                    <div style={{ color: '#f8fafc', fontWeight: 600 }}>No audio assignments found</div>
                    <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
                      Try adjusting or clearing your filters above.
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Desktop Table View */}
                    <div className="assignments-desktop-table table-wrap">
                      <table style={{ minWidth: 720 }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                            <th style={{ padding: '14px 16px', letterSpacing: '0.06em' }}>Track</th>
                            <th style={{ padding: '14px 16px', letterSpacing: '0.06em' }}>Employee</th>
                            <th style={{ padding: '14px 16px', letterSpacing: '0.06em' }}>Assigned</th>
                            <th style={{ padding: '14px 16px', letterSpacing: '0.06em' }}>Deadline</th>
                            <th style={{ padding: '14px 16px', letterSpacing: '0.06em' }}>Submitted</th>
                            <th style={{ padding: '14px 16px', letterSpacing: '0.06em' }}>Status</th>
                            <th style={{ padding: '14px 16px', textAlign: 'right', letterSpacing: '0.06em' }}>
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((a) => (
                            <tr
                              key={a.id}
                              className="kpi-link"
                              onClick={() => openReview(a)}
                              style={{
                                cursor: 'pointer',
                                transition: 'background 0.2s ease',
                                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                              }}
                            >
                              <td style={{ padding: '12px 16px', fontWeight: 600, color: '#f8fafc' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <span style={{ fontSize: 16 }}>🎵</span>
                                  <span>{a.track?.originalName || '—'}</span>
                                </div>
                              </td>
                              <td style={{ padding: '12px 16px', color: '#e2e8f0' }}>{a.employeeName}</td>
                              <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.7)' }}>
                                {fmtDate((a.assignedAt || '').slice(0, 10))}
                              </td>
                              <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.7)' }}>
                                {a.deadline ? fmtDateTime(a.deadline) : '—'}
                              </td>
                              <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.7)' }}>
                                {a.submittedAt ? fmtDateTime(a.submittedAt) : '—'}
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                <span className={`badge st-${a.displayStatus}`}>{a.displayStatus}</span>
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                                  <button
                                    type="button"
                                    className="btn btn-lime btn-sm"
                                    style={{ padding: '5px 12px', fontSize: 12, fontWeight: 700 }}
                                    onClick={() => openReview(a)}
                                  >
                                    Review
                                  </button>
                                  {!['submitted', 'reviewed'].includes(a.status) && (
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-sm"
                                      style={{ padding: '5px 10px', fontSize: 12 }}
                                      onClick={() => remove(a)}
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card List (Screen width <= 768px) */}
                    <div className="assignments-mobile-cards">
                      {rows.map((a) => (
                        <div
                          key={a.id}
                          className="panel"
                          style={{
                            padding: '14px 16px',
                            borderRadius: 14,
                            background: 'rgba(15, 23, 42, 0.55)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span>🎵</span>
                              <span>{a.track?.originalName || '—'}</span>
                            </div>
                            <span className={`badge st-${a.displayStatus}`} style={{ flexShrink: 0 }}>
                              {a.displayStatus}
                            </span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: 12 }}>
                            <div>
                              <span style={{ color: 'var(--muted)' }}>Assigned to: </span>
                              <strong style={{ color: '#e2e8f0' }}>{a.employeeName}</strong>
                            </div>
                            <div>
                              <span style={{ color: 'var(--muted)' }}>Assigned: </span>
                              <span style={{ color: 'rgba(255,255,255,0.8)' }}>
                                {fmtDate((a.assignedAt || '').slice(0, 10))}
                              </span>
                            </div>
                            <div>
                              <span style={{ color: 'var(--muted)' }}>Deadline: </span>
                              <span style={{ color: 'rgba(255,255,255,0.8)' }}>
                                {a.deadline ? fmtDate(a.deadline) : '—'}
                              </span>
                            </div>
                            <div>
                              <span style={{ color: 'var(--muted)' }}>Submitted: </span>
                              <span style={{ color: 'rgba(255,255,255,0.8)' }}>
                                {a.submittedAt ? fmtDate(a.submittedAt) : '—'}
                              </span>
                            </div>
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'flex-end',
                              gap: 8,
                              marginTop: 4,
                              paddingTop: 8,
                              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                            }}
                          >
                            <button
                              type="button"
                              className="btn btn-lime btn-sm"
                              style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700, flex: 1 }}
                              onClick={() => openReview(a)}
                            >
                              Review Assignment
                            </button>
                            {!['submitted', 'reviewed'].includes(a.status) && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '6px 12px', fontSize: 12 }}
                                onClick={() => remove(a)}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>
            </div>
          );
        }}
      </Resource>
    </Page>
  );
}
