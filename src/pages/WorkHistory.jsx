import { useState } from 'react';
import { audioApi } from '../services';
import { audioUrl } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useLive } from '../contexts/LiveContext';
import { useModal } from '../contexts/ModalContext';
import { useHeader } from '../layouts/HeaderContext';
import { useToast } from '../contexts/ToastContext';
import { useResource } from '../hooks/useResource';
import { Page, Resource } from '../components/Page';

function formatHMS(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function EditWorkModal({ item, close, onUpdated }) {
  const toast = useToast();
  const { refresh } = useLive();
  const [text, setText] = useState(item.text || '');
  const [saving, setSaving] = useState(false);

  const handleSaveAndSubmit = async () => {
    if (!text.trim()) {
      return toast('Transcription text cannot be empty.');
    }
    setSaving(true);
    try {
      // 1. Save updated note draft
      await audioApi.saveNote(item.trackId, text.trim());
      // 2. Submit translation
      await audioApi.submit(item.assignmentId);
      toast('Work updated and submitted successfully!');
      refresh();
      onUpdated?.();
      close();
    } catch (err) {
      toast(err.message || 'Failed to update work.');
    } finally {
      setSaving(false);
    }
  };

  const streamSrc = item.track ? audioUrl(item.track) : (item.trackId ? `/api/audio/${item.trackId}/stream` : '');

  return (
    <div style={{ maxWidth: 640, width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, color: '#fff' }}>
            Edit Submitted Audio Task
          </h3>
          <div style={{ fontSize: 12, color: 'var(--teal)', marginTop: 2 }}>
            {item.trackName} {item.projectName ? `· ${item.projectName}` : ''}
          </div>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '3px 10px',
            borderRadius: 12,
            color: item.status === 'Approved' ? '#10b981' : '#f59e0b',
            background: item.status === 'Approved' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            border: `1px solid ${item.status === 'Approved' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
          }}
        >
          {item.status}
        </span>
      </div>

      {streamSrc && (
        <div style={{ marginBottom: 14 }}>
          <audio
            controls
            preload="none"
            src={streamSrc}
            style={{ width: '100%', height: 36, borderRadius: 8 }}
          />
        </div>
      )}

      {item.reviewFeedback && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#f87171',
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          <strong>Admin Feedback:</strong> {item.reviewFeedback}
        </div>
      )}

      <div className="field">
        <label htmlFor="edit-transcription-text" style={{ fontSize: 12, fontWeight: 600, color: 'var(--soft)', marginBottom: 6, display: 'block' }}>
          Transcription Text
        </label>
        <textarea
          id="edit-transcription-text"
          rows={7}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Listen carefully and write your transcription here…"
          style={{
            width: '100%',
            fontFamily: 'inherit',
            fontSize: 13,
            lineHeight: 1.5,
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid rgba(255, 255, 255, 0.15)',
            background: 'rgba(0, 0, 0, 0.3)',
            color: '#fff',
            resize: 'vertical',
          }}
        />
      </div>

      <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={close} disabled={saving}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          style={{ background: '#0e9384', borderColor: '#0e9384' }}
          onClick={handleSaveAndSubmit}
          disabled={saving}
        >
          {saving ? 'Updating…' : 'Save & Update'}
        </button>
      </div>
    </div>
  );
}

export default function WorkHistory() {
  const { user } = useAuth();
  const { open } = useModal();
  useHeader('Work History', 'Track all your submitted audio tasks, completion durations, and review statuses');

  const res = useResource(() => audioApi.workHistory(), [user.id]);

  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState('date');
  const [sortAsc, setSortAsc] = useState(false);

  const openEditModal = (item) => {
    open(({ close }) => (
      <EditWorkModal
        item={item}
        close={close}
        onUpdated={() => {
          res.reload();
        }}
      />
    ));
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
    setCurrentPage(1);
  };

  return (
    <Resource res={res}>
      {(rawHistory) => {
        const history = Array.isArray(rawHistory) ? rawHistory : [];

        // Search Filter
        const q = search.trim().toLowerCase();
        const filtered = history.filter((r) => {
          if (!q) return true;
          const matchText = (r.text || '').toLowerCase().includes(q);
          const matchTrack = (r.trackName || '').toLowerCase().includes(q);
          const matchStatus = (r.status || '').toLowerCase().includes(q);
          return matchText || matchTrack || matchStatus;
        });

        // Sorting
        const sorted = [...filtered].sort((a, b) => {
          let valA = a[sortField];
          let valB = b[sortField];

          if (sortField === 'date') {
            valA = new Date(a.date || 0).getTime();
            valB = new Date(b.date || 0).getTime();
          } else if (sortField === 'duration') {
            valA = a.durationSec || 0;
            valB = b.durationSec || 0;
          } else if (sortField === 'text') {
            valA = (a.text || '').toLowerCase();
            valB = (b.text || '').toLowerCase();
          } else if (sortField === 'status') {
            valA = (a.status || '').toLowerCase();
            valB = (b.status || '').toLowerCase();
          }

          if (valA < valB) return sortAsc ? -1 : 1;
          if (valA > valB) return sortAsc ? 1 : -1;
          return 0;
        });

        // Pagination
        const totalEntries = sorted.length;
        const totalPages = Math.ceil(totalEntries / pageSize) || 1;
        const validPage = Math.max(1, Math.min(currentPage, totalPages));
        const startIndex = (validPage - 1) * pageSize;
        const pagedRows = sorted.slice(startIndex, startIndex + pageSize);

        return (
          <Page>
            <div
              className="panel"
              style={{
                background: 'var(--glass-bg, rgba(15, 23, 42, 0.75))',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 14,
                backdropFilter: 'blur(16px)',
                padding: '24px',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
              }}
            >
              {/* Header: Title */}
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--white, #f8fafc)' }}>
                  Work History
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted, #94a3b8)' }}>
                  Review your submitted audio transcriptions, review statuses, and durations
                </p>
              </div>

              {/* Filter controls matching screenshot: Show X entries + Search */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 14,
                  marginBottom: 18,
                }}
              >
                {/* Show entries dropdown */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--soft, #cbd5e1)' }}>
                  <span>Show</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    style={{
                      background: 'rgba(0, 0, 0, 0.35)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: 6,
                      color: '#fff',
                      padding: '5px 10px',
                      fontSize: 13,
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

                {/* Search bar matching screenshot */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--soft, #cbd5e1)' }}>
                  <label htmlFor="wh-search" style={{ fontWeight: 500 }}>
                    Search:
                  </label>
                  <input
                    id="wh-search"
                    type="search"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search text, audio or status…"
                    style={{
                      background: 'rgba(0, 0, 0, 0.35)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: 6,
                      color: '#fff',
                      padding: '6px 12px',
                      fontSize: 13,
                      width: 220,
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Data Table */}
              <div style={{ width: '100%', overflowX: 'auto', borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 680 }}>
                  <thead>
                    <tr
                      style={{
                        background: 'rgba(255, 255, 255, 0.04)',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                        color: 'var(--soft, #94a3b8)',
                        fontSize: 12,
                        fontWeight: 600,
                        userSelect: 'none',
                      }}
                    >
                      <th
                        onClick={() => handleSort('#')}
                        style={{ padding: '12px 14px', width: 60, cursor: 'pointer', textAlign: 'center' }}
                      >
                        # <span style={{ opacity: 0.5, fontSize: 11 }}>↕</span>
                      </th>
                      <th
                        onClick={() => handleSort('text')}
                        style={{ padding: '12px 16px', cursor: 'pointer', minWidth: 200 }}
                      >
                        Text <span style={{ opacity: 0.5, fontSize: 11 }}>↕</span>
                      </th>
                      <th
                        onClick={() => handleSort('duration')}
                        style={{ padding: '12px 16px', width: 130, cursor: 'pointer' }}
                      >
                        Duration <span style={{ opacity: 0.5, fontSize: 11 }}>↕</span>
                      </th>
                      <th
                        onClick={() => handleSort('status')}
                        style={{ padding: '12px 16px', width: 120, cursor: 'pointer' }}
                      >
                        Status <span style={{ opacity: 0.5, fontSize: 11 }}>↕</span>
                      </th>
                      <th style={{ padding: '12px 16px', width: 100, textAlign: 'center' }}>
                        Action <span style={{ opacity: 0.5, fontSize: 11 }}>↕</span>
                      </th>
                      <th
                        onClick={() => handleSort('date')}
                        style={{ padding: '12px 16px', width: 140, cursor: 'pointer' }}
                      >
                        Date <span style={{ opacity: 0.5, fontSize: 11 }}>↕</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {!pagedRows.length ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted, #94a3b8)' }}>
                          <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>No work history found</div>
                          <div style={{ fontSize: 12, marginTop: 4 }}>
                            {search ? 'Try adjusting your search query' : 'When you submit audio transcriptions, they will appear dynamically here.'}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      pagedRows.map((r, idx) => {
                        const globalIndex = startIndex + idx + 1;
                        const isApproved = r.status === 'Approved';
                        const isPending = r.status === 'Pending';

                        return (
                          <tr
                            key={r.id || idx}
                            style={{
                              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                              transition: 'background 0.15s ease',
                              background: idx % 2 === 1 ? 'rgba(255, 255, 255, 0.015)' : 'transparent',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)')}
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.background = idx % 2 === 1 ? 'rgba(255, 255, 255, 0.015)' : 'transparent')
                            }
                          >
                            {/* # Index Column */}
                            <td
                              style={{
                                padding: '12px 14px',
                                textAlign: 'center',
                                fontSize: 13,
                                color: 'var(--muted, #94a3b8)',
                                background: 'rgba(255, 255, 255, 0.02)',
                              }}
                            >
                              {globalIndex}
                            </td>

                            {/* Text Transcription Column */}
                            <td style={{ padding: '12px 16px' }}>
                              <div
                                style={{
                                  fontSize: 13,
                                  color: 'var(--white, #f8fafc)',
                                  fontWeight: 500,
                                  maxWidth: 280,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={r.text || 'No text submitted'}
                              >
                                {r.text || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>(Empty)</span>}
                              </div>
                            </td>

                            {/* Duration formatted as HH:MM:SS */}
                            <td
                              style={{
                                padding: '12px 16px',
                                fontSize: 13,
                                fontFamily: 'monospace',
                                color: 'var(--soft, #cbd5e1)',
                              }}
                            >
                              {formatHMS(r.durationSec)}
                            </td>

                            {/* Status Column */}
                            <td style={{ padding: '12px 16px' }}>
                              <span
                                style={{
                                  fontSize: 13,
                                  fontWeight: 600,
                                  color: isApproved ? '#10b981' : isPending ? '#f59e0b' : '#ef4444',
                                }}
                              >
                                {r.status}
                              </span>
                            </td>

                            {/* Action Button: Edit */}
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => openEditModal(r)}
                                style={{
                                  border: '1px solid rgba(14, 147, 132, 0.8)',
                                  color: '#14b8a6',
                                  background: 'rgba(14, 147, 132, 0.1)',
                                  borderRadius: 6,
                                  padding: '4px 14px',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = '#0e9384';
                                  e.currentTarget.style.color = '#fff';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'rgba(14, 147, 132, 0.1)';
                                  e.currentTarget.style.color = '#14b8a6';
                                }}
                              >
                                Edit
                              </button>
                            </td>

                            {/* Date Column */}
                            <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--soft, #94a3b8)', whiteSpace: 'nowrap' }}>
                              {formatDate(r.date)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Bottom Pagination Controls */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginTop: 18,
                  fontSize: 13,
                  color: 'var(--muted, #94a3b8)',
                }}
              >
                <div>
                  Showing {totalEntries > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + pageSize, totalEntries)} of {totalEntries} entries
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    disabled={validPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: 6,
                      color: validPage <= 1 ? 'var(--muted)' : '#fff',
                      padding: '5px 12px',
                      fontSize: 12,
                      cursor: validPage <= 1 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Previous
                  </button>

                  <span
                    style={{
                      background: '#0e9384',
                      color: '#fff',
                      fontWeight: 600,
                      borderRadius: 6,
                      padding: '5px 12px',
                      fontSize: 12,
                    }}
                  >
                    {validPage}
                  </span>

                  <button
                    type="button"
                    disabled={validPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: 6,
                      color: validPage >= totalPages ? 'var(--muted)' : '#fff',
                      padding: '5px 12px',
                      fontSize: 12,
                      cursor: validPage >= totalPages ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </Page>
        );
      }}
    </Resource>
  );
}
