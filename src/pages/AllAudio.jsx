import { useEffect, useState } from 'react';
import { audioApi, usersApi } from '../services';
import { audioUrl } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useLive } from '../contexts/LiveContext';
import { useModal } from '../contexts/ModalContext';
import { useNav } from '../contexts/NavContext';
import { useToast } from '../contexts/ToastContext';
import { useHeader } from '../layouts/HeaderContext';
import { useResource } from '../hooks/useResource';
import { Page, Resource } from '../components/Page';
import { fmtDate, fmtDuration } from '../utils/format';

export default function AllAudioView() {
  const { user } = useAuth();
  const nav = useNav();
  const { open } = useModal();
  const toast = useToast();
  const { refresh } = useLive();
  useHeader('All Audio Files', 'Comprehensive catalogue of all audio files, playback preview, and assignment tracking');

  const tracksRes = useResource(() => audioApi.allTracks(), [user.id]);
  const employees = useResource(() => usersApi.assignable(), [user.id], { live: false });

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'assigned' | 'unassigned'
  const [filterProject, setFilterProject] = useState('all');
  const [realDurations, setRealDurations] = useState({});

  const handleAudioMetadata = (e, track) => {
    const dur = Math.round(e.target.duration);
    if (dur && Number.isFinite(dur) && dur > 0) {
      setRealDurations((prev) => (prev[track.id] === dur ? prev : { ...prev, [track.id]: dur }));
      if (Math.abs(dur - (track.duration || 0)) > 2) {
        audioApi.updateDuration(track.id, dur).catch(() => {});
      }
    }
  };

  // Eager audio prefetching disabled to prevent browser connection starvation

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const handleDelete = async (track) => {
    if (!window.confirm(`Delete "${track.originalName}"? This will also remove any assignments for this track.`)) return;
    try {
      await audioApi.deleteTrack(track.id);
      toast(`Deleted "${track.originalName}".`);
      tracksRes.reload();
      refresh();
    } catch (err) {
      toast(err.message || 'Could not delete audio file.');
    }
  };

  const openAssignModal = (track) => {
    open(({ close }) => (
      <AssignModal
        track={track}
        employees={employees.data || []}
        close={close}
        onSuccess={() => {
          tracksRes.reload();
          refresh();
        }}
      />
    ));
  };

  return (
    <Resource res={tracksRes}>{(allTracks) => {
      const projectsSet = new Set(allTracks.map((t) => t.projectName).filter(Boolean));
      const projectsList = Array.from(projectsSet).sort();

      const totalTracks = allTracks.length;
      const assignedTracks = allTracks.filter((t) => t.isAssigned).length;
      const unassignedTracks = totalTracks - assignedTracks;
      const totalSizeBytes = allTracks.reduce((acc, t) => acc + (t.size || 0), 0);

      // Filtering
      const filtered = allTracks.filter((t) => {
        if (filterStatus === 'assigned' && !t.isAssigned) return false;
        if (filterStatus === 'unassigned' && t.isAssigned) return false;
        if (filterProject !== 'all' && t.projectName !== filterProject) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchName = (t.originalName || '').toLowerCase().includes(q);
          const matchProj = (t.projectName || '').toLowerCase().includes(q);
          const matchAssignee = t.assignments?.some((a) => (a.assigneeName || '').toLowerCase().includes(q));
          if (!matchName && !matchProj && !matchAssignee) return false;
        }
        return true;
      });

      return (
        <Page>
          {/* Top Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 16 }}>
            <div className="panel" style={{ padding: '16px 20px', borderLeft: '4px solid #12c2d4' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Total Audio Files</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginTop: 4 }}>{totalTracks}</div>
              <div style={{ fontSize: 11, color: 'var(--soft)', marginTop: 2 }}>{formatFileSize(totalSizeBytes)} total storage</div>
            </div>

            <div className="panel" style={{ padding: '16px 20px', borderLeft: '4px solid #2ec27a' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Assigned</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#2ec27a', marginTop: 4 }}>{assignedTracks}</div>
              <div style={{ fontSize: 11, color: 'var(--soft)', marginTop: 2 }}>Distributed to crew</div>
            </div>

            <div className="panel" style={{ padding: '16px 20px', borderLeft: '4px solid #ff8a2b' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Unassigned</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#ff8a2b', marginTop: 4 }}>{unassignedTracks}</div>
              <div style={{ fontSize: 11, color: 'var(--soft)', marginTop: 2 }}>Ready for assignment</div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <section className="panel" style={{ padding: '12px 16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 240px', minWidth: 200 }}>
                <input
                  type="text"
                  placeholder="Search audio by name, project, or assignee…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--line)' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--line)' }}
                >
                  <option value="all">All Statuses ({totalTracks})</option>
                  <option value="assigned">Assigned ({assignedTracks})</option>
                  <option value="unassigned">Unassigned ({unassignedTracks})</option>
                </select>

                {projectsList.length > 0 && (
                  <select
                    value={filterProject}
                    onChange={(e) => setFilterProject(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--line)' }}
                  >
                    <option value="all">All Projects</option>
                    {projectsList.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                )}

                <button
                  type="button"
                  className="btn btn-lime btn-sm"
                  onClick={() => nav.go('upload-audio')}
                >
                  + Upload New Audio
                </button>
              </div>
            </div>
          </section>

          {/* Audio Catalog Table */}
          <section className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Audio Files Catalog</h3>
              <span className="badge pr-Medium">Showing {filtered.length} of {totalTracks}</span>
            </div>

            {!filtered.length ? (
              <div className="empty" style={{ padding: 40 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎧</div>
                <strong>No audio files match your filters</strong>
                <p className="hint" style={{ marginTop: 4 }}>
                  Upload MP3 files or adjust your search keywords.
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: 12 }}
                  onClick={() => nav.go('upload-audio')}
                >
                  Go to Upload Audio
                </button>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ minWidth: 220 }}>Audio Track</th>
                      <th>Project</th>
                      <th>Duration &amp; Size</th>
                      <th>Uploaded</th>
                      <th style={{ minWidth: 200 }}>Assignment Status</th>
                      <th style={{ minWidth: 240 }}>Playback Preview</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t) => {
                      const firstAsg = t.assignments?.[0];
                      return (
                        <tr key={t.id}>
                          <td>
                            <strong style={{ color: '#fff', wordBreak: 'break-word' }}>
                              🎵 {t.originalName}
                            </strong>
                          </td>
                          <td>
                            <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--soft)' }}>
                              {t.projectName}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#12c2d4' }}>
                              {fmtDuration(realDurations[t.id] ?? t.duration)}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                              {formatFileSize(t.size)}
                            </div>
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--soft)', whiteSpace: 'nowrap' }}>
                            {fmtDate(t.createdAt)}
                          </td>
                          <td>
                            {t.isAssigned ? (
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span className="badge st-Completed" style={{ fontSize: 11, padding: '2px 6px' }}>
                                    Assigned
                                  </span>
                                  <strong style={{ fontSize: 12, color: '#fff' }}>
                                    {firstAsg?.assigneeName}
                                  </strong>
                                </div>
                                {firstAsg?.deadline && (
                                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                                    Due: {fmtDate(firstAsg.deadline)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="badge st-On Hold" style={{ fontSize: 11, padding: '2px 8px' }}>
                                Unassigned
                              </span>
                            )}
                          </td>
                          <td>
                            <audio
                              controls
                              preload="none"
                              onLoadedMetadata={(e) => handleAudioMetadata(e, t)}
                              onDurationChange={(e) => handleAudioMetadata(e, t)}
                              onCanPlay={(e) => handleAudioMetadata(e, t)}
                              onPlay={(e) => handleAudioMetadata(e, t)}
                              src={audioUrl(t)}
                              style={{ width: '100%', height: 32, maxWidth: 260 }}
                            />
                          </td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: 11, padding: '4px 8px' }}
                                onClick={() => openAssignModal(t)}
                                title={t.isAssigned ? 'Reassign / assign to employee' : 'Assign to employee'}
                              >
                                {t.isAssigned ? 'Reassign' : 'Assign'}
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                style={{ fontSize: 11, padding: '4px 8px' }}
                                onClick={() => handleDelete(t)}
                                title="Delete audio file"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </Page>
      );
    }}</Resource>
  );
}

function AssignModal({ track, employees, close, onSuccess }) {
  const toast = useToast();
  const [assigneeId, setAssigneeId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [busy, setBusy] = useState(false);

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!assigneeId) return toast('Please select an employee.');

    setBusy(true);
    try {
      const dl = deadline ? new Date(deadline).toISOString() : undefined;
      const res = await audioApi.assign([track.id], [assigneeId], dl);
      toast(res.added ? `Assigned "${track.originalName}".` : 'Track assigned successfully.');
      onSuccess?.();
      close();
    } catch (err) {
      toast(err.message || 'Could not assign track.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleAssign}>
      <h3>Assign Audio Track</h3>
      <p className="hint" style={{ margin: '-4px 0 16px' }}>
        Assign <strong>{track.originalName}</strong> to an employee for transcription.
      </p>

      <div className="field">
        <label htmlFor="assign-employee">Employee</label>
        <select
          id="assign-employee"
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          required
        >
          <option value="">Choose employee…</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.name} ({emp.email})
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="assign-deadline">Due Date &amp; Time (Optional)</label>
        <input
          id="assign-deadline"
          type="datetime-local"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
      </div>

      <div className="modal-actions" style={{ marginTop: 20 }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={close}>
          Cancel
        </button>
        <button type="submit" className="btn btn-lime btn-sm" disabled={busy || !assigneeId}>
          {busy ? 'Assigning…' : 'Assign Track'}
        </button>
      </div>
    </form>
  );
}
