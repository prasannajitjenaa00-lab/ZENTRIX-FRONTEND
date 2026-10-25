import { fmtDate, isOverdue } from '../utils/format';

export default function TaskTable({ tasks, showOwner = true, ownerName, onOpen }) {
  if (!tasks.length) {
    return (
      <div
        className="panel"
        style={{
          padding: '48px 24px',
          textAlign: 'center',
          borderRadius: 16,
          background: 'rgba(15, 23, 42, 0.4)',
          border: '1px dashed rgba(255, 255, 255, 0.12)'
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 12 }}>🎧</div>
        <h4 style={{ margin: '0 0 6px', color: '#f8fafc', fontSize: 16 }}>No assignments found</h4>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>
          No tasks match the selected filter. Try selecting "All statuses" or search a different keyword.
        </p>
      </div>
    );
  }

  return (
    <div
      className="panel"
      style={{
        padding: 0,
        borderRadius: 16,
        overflow: 'hidden',
        background: 'rgba(10, 22, 40, 0.45)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)'
      }}
    >
      <div className="table-wrap">
        <table style={{ margin: 0 }}>
          <thead>
            <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <th style={{ padding: '16px 20px', letterSpacing: '0.06em' }}>Task / Audio</th>
              {showOwner && <th style={{ padding: '16px 20px', letterSpacing: '0.06em' }}>Assigned To</th>}
              <th style={{ padding: '16px 20px', letterSpacing: '0.06em' }}>Schedule Window</th>
              <th style={{ padding: '16px 20px', letterSpacing: '0.06em' }}>Status</th>
              <th style={{ padding: '16px 20px', textAlign: 'right', letterSpacing: '0.06em' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => {
              const overdue = isOverdue(t);
              const isApproved = t.status === 'Approved' || t.status === 'Completed';
              const isPending = t.status === 'Pending';
              const isInProgress = t.status === 'In Progress';

              return (
                <tr
                  key={t.id}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    transition: 'background 0.2s ease',
                    cursor: 'pointer'
                  }}
                  onClick={() => onOpen?.(t)}
                >
                  {/* Task details */}
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          background: isApproved
                            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.1))'
                            : 'linear-gradient(135deg, rgba(18, 194, 212, 0.2), rgba(30, 58, 138, 0.2))',
                          border: isApproved ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(18, 194, 212, 0.35)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isApproved ? '#34d399' : '#38bdf8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 18V5l12-2v13" />
                          <circle cx="6" cy="18" r="3" />
                          <circle cx="18" cy="16" r="3" />
                        </svg>
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>{t.title}</span>
                          {t.isAudioTask && (
                            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: 'rgba(18, 194, 212, 0.15)', color: '#38bdf8', border: '1px solid rgba(18, 194, 212, 0.25)', fontWeight: 600 }}>
                              MP3
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                          {t.category && (
                            <span
                              style={{
                                fontSize: 11,
                                padding: '2px 8px',
                                borderRadius: 6,
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: 'rgba(255, 255, 255, 0.7)',
                                border: '1px solid rgba(255, 255, 255, 0.08)'
                              }}
                            >
                              📁 {t.category}
                            </span>
                          )}
                          {overdue && (
                            <span style={{ fontSize: 11, color: '#f87171', fontWeight: 600 }}>
                              ⚠️ Overdue
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Owner */}
                  {showOwner && (
                    <td style={{ padding: '14px 20px', color: '#e2e8f0', fontSize: 13 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                          {(ownerName?.(t.assigneeId) || 'U')[0]}
                        </div>
                        <span>{ownerName?.(t.assigneeId) || '—'}</span>
                      </div>
                    </td>
                  )}

                  {/* Date window */}
                  <td style={{ padding: '14px 20px', color: 'rgba(255, 255, 255, 0.75)', fontSize: 13 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.6 }}>
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      <span>{fmtDate(t.start)} → {fmtDate(t.due)}</span>
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td style={{ padding: '14px 20px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '5px 12px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600,
                        background: isApproved
                          ? 'rgba(16, 185, 129, 0.15)'
                          : isPending
                          ? 'rgba(245, 158, 11, 0.15)'
                          : isInProgress
                          ? 'rgba(59, 130, 246, 0.15)'
                          : 'rgba(255, 255, 255, 0.1)',
                        color: isApproved
                          ? '#34d399'
                          : isPending
                          ? '#fbbf24'
                          : isInProgress
                          ? '#60a5fa'
                          : '#e2e8f0',
                        border: isApproved
                          ? '1px solid rgba(16, 185, 129, 0.3)'
                          : isPending
                          ? '1px solid rgba(245, 158, 11, 0.3)'
                          : isInProgress
                          ? '1px solid rgba(59, 130, 246, 0.3)'
                          : '1px solid rgba(255, 255, 255, 0.15)'
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: isApproved ? '#34d399' : isPending ? '#fbbf24' : '#60a5fa'
                        }}
                      />
                      {t.status}
                    </span>
                  </td>

                  {/* Action */}
                  <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{
                        borderRadius: 10,
                        padding: '6px 14px',
                        fontSize: 12,
                        fontWeight: 700,
                        background: 'linear-gradient(135deg, rgba(18, 194, 212, 0.18), rgba(59, 130, 246, 0.22))',
                        border: '1px solid rgba(18, 194, 212, 0.4)',
                        color: '#7ee7f2',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen?.(t);
                      }}
                    >
                      <span>Transcribe</span>
                      <span style={{ fontSize: 13 }}>→</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
