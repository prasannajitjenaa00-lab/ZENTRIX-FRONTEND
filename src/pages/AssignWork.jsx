import { useState } from 'react';
import { audioApi, usersApi } from '../services';
import { audioUrl } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useLive } from '../contexts/LiveContext';
import { useNav } from '../contexts/NavContext';
import { useToast } from '../contexts/ToastContext';
import { useHeader } from '../layouts/HeaderContext';
import { useResource } from '../hooks/useResource';
import { Page, Resource } from '../components/Page';
import Avatar from '../components/Avatar';
import { fmtDate, fmtDuration } from '../utils/format';

export default function AssignWorkView() {
  const { user } = useAuth();
  const nav = useNav();
  const toast = useToast();
  const { refresh } = useLive();
  useHeader('Assign Work', 'Select audio tracks, choose single or multiple employees, and distribute assignments');

  const tracksRes = useResource(() => audioApi.allTracks(), [user.id]);
  const employeesRes = useResource(() => usersApi.assignable(), [user.id], { live: false });

  const [selectedTracks, setSelectedTracks] = useState(new Set());
  const [selectedEmployees, setSelectedEmployees] = useState(new Set());
  const [deadline, setDeadline] = useState('');
  const [searchTrack, setSearchTrack] = useState('');
  const [searchEmp, setSearchEmp] = useState('');
  const [busy, setBusy] = useState(false);

  const toggleTrack = (id) => {
    const next = new Set(selectedTracks);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedTracks(next);
  };

  const toggleEmployee = (id) => {
    const next = new Set(selectedEmployees);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedEmployees(next);
  };

  const selectAllTracks = (tracksList) => {
    if (selectedTracks.size === tracksList.length) {
      setSelectedTracks(new Set());
    } else {
      setSelectedTracks(new Set(tracksList.map((t) => t.id)));
    }
  };

  const selectAllEmployees = (empList) => {
    if (selectedEmployees.size === empList.length) {
      setSelectedEmployees(new Set());
    } else {
      setSelectedEmployees(new Set(empList.map((e) => e.id)));
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const handleAssign = async () => {
    if (!selectedTracks.size) return toast('Please select at least one audio file.');
    if (!selectedEmployees.size) return toast('Please select at least one employee.');

    setBusy(true);
    try {
      const trackIds = Array.from(selectedTracks);
      const assigneeIds = Array.from(selectedEmployees);
      const dl = deadline ? new Date(deadline).toISOString() : undefined;

      const res = await audioApi.assign(trackIds, assigneeIds, dl);
      const count = res.added || (trackIds.length * assigneeIds.length);

      toast(`Successfully assigned ${trackIds.length} audio file${trackIds.length === 1 ? '' : 's'} to ${assigneeIds.length} employee${assigneeIds.length === 1 ? '' : 's'} (${count} tasks created)!`);
      
      setSelectedTracks(new Set());
      setSelectedEmployees(new Set());
      setDeadline('');
      refresh();
      tracksRes.reload();
    } catch (err) {
      toast(err.message || 'Could not assign audio files.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Resource res={tracksRes}>{(allTracks) => {
      const allEmployees = employeesRes.data || [];

      // Filtered lists based on search
      const filteredTracks = allTracks.filter((t) => {
        if (!searchTrack.trim()) return true;
        const q = searchTrack.toLowerCase();
        return (t.originalName || '').toLowerCase().includes(q) || (t.projectName || '').toLowerCase().includes(q);
      });

      const filteredEmployees = allEmployees.filter((e) => {
        if (!searchEmp.trim()) return true;
        const q = searchEmp.toLowerCase();
        return (e.name || '').toLowerCase().includes(q) || (e.email || '').toLowerCase().includes(q);
      });

      const totalAssignmentsExpected = selectedTracks.size * selectedEmployees.size;

      return (
        <Page>
          {/* Top Instruction Banner */}
          <section className="panel" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
              <div>
                <strong style={{ fontSize: 15, color: '#fff' }}>Distribute Audio Assignments</strong>
                <p className="hint" style={{ margin: '2px 0 0', fontSize: 13 }}>
                  1. Choose one or multiple MP3s &nbsp;→&nbsp; 2. Select one or multiple employees &nbsp;→&nbsp; 3. Click Assign.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label htmlFor="assign-deadline" style={{ fontSize: 12, fontWeight: 600, color: 'var(--soft)', margin: 0 }}>
                    Deadline:
                  </label>
                  <input
                    id="assign-deadline"
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6, background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--line)' }}
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-lime"
                  disabled={busy || !selectedTracks.size || !selectedEmployees.size}
                  onClick={handleAssign}
                  style={{ padding: '8px 20px', fontWeight: 600, fontSize: 13 }}
                >
                  {busy ? 'Assigning…' : `Assign to ${selectedEmployees.size} Employee${selectedEmployees.size === 1 ? '' : 's'}`}
                </button>
              </div>
            </div>

            {/* Selection Summary Pill */}
            {(selectedTracks.size > 0 || selectedEmployees.size > 0) && (
              <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(18, 194, 212, 0.1)', border: '1px solid rgba(18, 194, 212, 0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                <span>
                  Selected: <strong style={{ color: '#12c2d4' }}>{selectedTracks.size} Audio File{selectedTracks.size === 1 ? '' : 's'}</strong> and <strong style={{ color: '#2ec27a' }}>{selectedEmployees.size} Employee{selectedEmployees.size === 1 ? '' : 's'}</strong>
                  {totalAssignmentsExpected > 0 && ` (${totalAssignmentsExpected} assignment${totalAssignmentsExpected === 1 ? '' : 's'} will be created)`}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 11, padding: '2px 8px', height: 'auto' }}
                  onClick={() => { setSelectedTracks(new Set()); setSelectedEmployees(new Set()); }}
                >
                  Reset selection
                </button>
              </div>
            )}
          </section>

          {/* 2-Column Split: Step 1 (Audio Files) & Step 2 (Employees) */}
          <div className="grid-2">
            {/* Left Column: All Audio Files */}
            <section className="panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0 }}>Step 1: Choose Audio File(s)</h3>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    {selectedTracks.size} of {allTracks.length} audio file{allTracks.length === 1 ? '' : 's'} selected
                  </div>
                </div>

                {allTracks.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11, padding: '4px 8px' }}
                    onClick={() => selectAllTracks(allTracks)}
                  >
                    {selectedTracks.size === allTracks.length ? 'Deselect all' : 'Select all'}
                  </button>
                )}
              </div>

              {/* Track Search */}
              <div style={{ marginBottom: 12 }}>
                <input
                  type="text"
                  placeholder="Filter audio files by title…"
                  value={searchTrack}
                  onChange={(e) => setSearchTrack(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 6, background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--line)' }}
                />
              </div>

              {/* Tracks List */}
              {!allTracks.length ? (
                <div className="empty" style={{ padding: 24 }}>
                  <p>No audio files uploaded yet.</p>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => nav.go('upload-audio')}>
                    Upload Audio First
                  </button>
                </div>
              ) : !filteredTracks.length ? (
                <div className="empty" style={{ padding: 20 }}>No tracks match your filter.</div>
              ) : (
                <div style={{ maxHeight: 520, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
                  {filteredTracks.map((t) => {
                    const isChecked = selectedTracks.has(t.id);
                    return (
                      <div
                        key={t.id}
                        onClick={() => toggleTrack(t.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 12px',
                          borderRadius: 10,
                          cursor: 'pointer',
                          background: isChecked ? 'rgba(18, 194, 212, 0.14)' : 'rgba(255, 255, 255, 0.03)',
                          border: isChecked ? '1px solid #12c2d4' : '1px solid var(--line)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // Handled by parent div
                          style={{ cursor: 'pointer', width: 16, height: 16 }}
                        />

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: 13, color: isChecked ? '#fff' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              🎵 {t.originalName}
                            </strong>
                            <span style={{ fontSize: 11, color: '#12c2d4', fontWeight: 600, marginLeft: 8, whiteSpace: 'nowrap' }}>
                              {fmtDuration(t.duration)}
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, fontSize: 11, color: 'var(--muted)' }}>
                            <span>Project: {t.projectName} · {formatFileSize(t.size)}</span>
                            <span>{t.assignedCount ? `Assigned to ${t.assignedCount}` : 'Unassigned'}</span>
                          </div>

                          {/* Quick audio player preview */}
                          <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 6 }}>
                            <audio
                              controls
                              preload="none"
                              src={audioUrl(t)}
                              style={{ width: '100%', height: 26 }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Right Column: All Employees */}
            <section className="panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0 }}>Step 2: Choose Employee(s)</h3>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    {selectedEmployees.size} of {allEmployees.length} employee{allEmployees.length === 1 ? '' : 's'} selected
                  </div>
                </div>

                {allEmployees.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11, padding: '4px 8px' }}
                    onClick={() => selectAllEmployees(allEmployees)}
                  >
                    {selectedEmployees.size === allEmployees.length ? 'Deselect all' : 'Select all'}
                  </button>
                )}
              </div>

              {/* Employee Search */}
              <div style={{ marginBottom: 12 }}>
                <input
                  type="text"
                  placeholder="Filter employees by name or email…"
                  value={searchEmp}
                  onChange={(e) => setSearchEmp(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 6, background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--line)' }}
                />
              </div>

              {/* Employee List */}
              {!allEmployees.length ? (
                <div className="empty" style={{ padding: 24 }}>
                  <p>No active employees found.</p>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => nav.go('people')}>
                    Create Employee in Accounts
                  </button>
                </div>
              ) : !filteredEmployees.length ? (
                <div className="empty" style={{ padding: 20 }}>No employees match your filter.</div>
              ) : (
                <div style={{ maxHeight: 520, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
                  {filteredEmployees.map((emp) => {
                    const isChecked = selectedEmployees.has(emp.id);
                    return (
                      <div
                        key={emp.id}
                        onClick={() => toggleEmployee(emp.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 12px',
                          borderRadius: 10,
                          cursor: 'pointer',
                          background: isChecked ? 'rgba(46, 194, 122, 0.14)' : 'rgba(255, 255, 255, 0.03)',
                          border: isChecked ? '1px solid #2ec27a' : '1px solid var(--line)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // Handled by parent div
                          style={{ cursor: 'pointer', width: 16, height: 16 }}
                        />

                        <Avatar name={emp.name} admin={emp.role === 'admin'} />

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: 13, color: isChecked ? '#fff' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {emp.name}
                            </strong>
                            <span className="badge" style={{ fontSize: 10, background: 'rgba(255,255,255,0.06)' }}>
                              Employee
                            </span>
                          </div>

                          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {emp.email}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </Page>
      );
    }}</Resource>
  );
}
