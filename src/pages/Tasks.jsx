import { useEffect, useState } from 'react';
import { audioApi, tasksApi, usersApi } from '../services';
import { useAuth } from '../contexts/AuthContext';
import { useLive } from '../contexts/LiveContext';
import { useNav } from '../contexts/NavContext';
import { useToast } from '../contexts/ToastContext';
import { useHeader } from '../layouts/HeaderContext';
import { useResource } from '../hooks/useResource';
import { useRoster } from '../hooks/useRoster';
import TaskTable from '../components/TaskTable';
import { Page, Resource } from '../components/Page';
import { useOpenTask } from '../modals/TaskModal';
import TaskForm, { blankTask, formToPayload } from '../modals/TaskForm';
import { STATUS, byDue, can } from '../utils/format';

export function TasksView() {
  const { user } = useAuth();
  const nav = useNav();
  const roster = useRoster();
  const openTask = useOpenTask();
  const admin = user.role === 'admin';
  useHeader(admin ? 'All assignments' : 'My tasks', 'Update status as work moves');

  const [localSearch, setLocalSearch] = useState('');
  const st = nav.taskStatus || 'all';
  const res = useResource(
    async () => (await tasksApi.list({ status: st === 'all' ? undefined : st, q: nav.query || undefined })).data,
    [st, nav.query, user.id]
  );
  const audioRes = useResource(() => (admin ? Promise.resolve([]) : audioApi.assigned()), [user.id], { live: false });
  const audioList = audioRes.data || [];

  const handleEditTask = (task) => {
    if (admin) {
      openTask(task);
      return;
    }
    // Employee: go to the particular audio where they can change/transcribe
    const titleLower = (task.title || '').toLowerCase();
    const descLower = (task.description || '').toLowerCase();
    const catLower = (task.category || '').toLowerCase();

    const matched = audioList.find((a) => {
      const trackName = (a.track?.originalName || '').toLowerCase();
      const projName = (a.projectName || '').toLowerCase();
      return (
        (trackName && (titleLower.includes(trackName) || descLower.includes(trackName))) ||
        (projName && (titleLower.includes(projName) || catLower.includes(projName))) ||
        (a.track?.id && (task.id === a.track.id || task.notes?.includes(a.track.id))) ||
        (a.assignmentId && (task.id === a.assignmentId || task.notes?.includes(a.assignmentId)))
      );
    }) || audioList[0];

    if (matched) {
      nav.go('notebook', {
        audioId: matched.track?.id || matched.assignmentId,
        trackId: matched.track?.id,
        assignmentId: matched.assignmentId,
        taskId: task.id,
        taskTitle: task.title,
      });
    } else {
      nav.go('notebook', { taskTitle: task.title, taskId: task.id });
    }
  };

  return (
    <Resource res={res}>
      {(tasks) => {
        let displayTasks = tasks;
        let allTasks = tasks;

        if (!admin) {
          // Map any regular tasks to reflect audio assignment state if linked
          const mappedRegular = tasks.map((t) => {
            const matched = audioList.find((a) => {
              const trName = (a.track?.originalName || '').toLowerCase();
              const pName = (a.projectName || '').toLowerCase();
              const tTitle = (t.title || '').toLowerCase();
              return (
                (trName && tTitle.includes(trName)) ||
                (pName && tTitle.includes(pName)) ||
                t.id === a.assignmentId ||
                t.notes?.includes(a.assignmentId) ||
                t.notes?.includes(a.track?.id)
              );
            });
            if (matched) {
              if (matched.status === 'approved' || matched.status === 'reviewed') {
                return { ...t, status: 'Approved', progress: 100 };
              }
              if (matched.status === 'pending' || matched.status === 'assigned') {
                return { ...t, status: 'Pending' };
              }
            }
            return t;
          });

          // If audio tracks exist that aren't yet represented in tasks, show them in My tasks
          const existingTitles = new Set(tasks.map((t) => (t.title || '').toLowerCase()));
          const existingIds = new Set(tasks.map((t) => t.id));
          const extraAudioTasks = audioList
            .filter((a) => !existingIds.has(a.assignmentId) && !existingTitles.has((a.track?.originalName || '').toLowerCase()))
            .map((a) => {
              const isApproved = a.status === 'approved' || a.status === 'reviewed';
              const isPending = a.status === 'assigned' || a.status === 'pending';
              const status = isApproved ? 'Approved' : isPending ? 'Pending' : a.status === 'submitted' ? 'Approved' : 'In Progress';
              return {
                id: a.assignmentId || a.track?.id,
                assignmentId: a.assignmentId,
                trackId: a.track?.id,
                title: a.track?.originalName || 'Audio Transcription Task',
                category: a.projectName || 'Transcription',
                start: a.assignedAt ? a.assignedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
                due: a.deadline ? a.deadline.slice(0, 10) : new Date().toISOString().slice(0, 10),
                progress: isApproved ? 100 : a.notes ? 50 : 0,
                status,
                isAudioTask: true,
              };
            });

          allTasks = [...mappedRegular, ...extraAudioTasks];
          displayTasks = st && st !== 'all' ? allTasks.filter((t) => t.status === st) : allTasks;
        }

        // Apply localSearch if user typed in task table filter
        if (localSearch.trim()) {
          const q = localSearch.toLowerCase();
          displayTasks = displayTasks.filter(
            (t) => (t.title || '').toLowerCase().includes(q) || (t.category || '').toLowerCase().includes(q)
          );
        }

        const totalCount = allTasks.length;
        const pendingCount = allTasks.filter((t) => t.status === 'Pending').length;
        const inProgressCount = allTasks.filter((t) => t.status === 'In Progress').length;
        const approvedCount = allTasks.filter((t) => t.status === 'Approved' || t.status === 'Completed').length;

        const filterOptions = [
          { label: 'All', value: 'all', count: totalCount },
          { label: 'Pending', value: 'Pending', count: pendingCount },
          { label: 'In Progress', value: 'In Progress', count: inProgressCount },
          { label: 'Approved', value: 'Approved', count: approvedCount },
        ];

        return (
          <Page>
            {/* Top Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
              {/* 1. Total Assignments */}
              <div
                className="panel"
                style={{
                  background: 'linear-gradient(135deg, rgba(18, 194, 212, 0.12), rgba(15, 23, 42, 0.4))',
                  border: '1px solid rgba(18, 194, 212, 0.25)',
                  padding: '16px 20px',
                  borderRadius: 14
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#38bdf8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Total Tasks
                  </span>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2">
                      <path d="M9 11l3 3L22 4" />
                      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                    </svg>
                  </div>
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', marginTop: 8 }}>{totalCount}</div>
                <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.65)', marginTop: 4 }}>
                  Assigned audio tracks
                </div>
              </div>

              {/* 2. Pending Tasks */}
              <div
                className="panel"
                style={{
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(15, 23, 42, 0.4))',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  padding: '16px 20px',
                  borderRadius: 14
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#fbbf24', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Pending
                  </span>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(251, 191, 36, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', marginTop: 8 }}>{pendingCount}</div>
                <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.65)', marginTop: 4 }}>
                  In transcription queue
                </div>
              </div>

              {/* 3. Approved & Completed */}
              <div
                className="panel"
                style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(15, 23, 42, 0.4))',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  padding: '16px 20px',
                  borderRadius: 14
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#34d399', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Approved
                  </span>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(52, 211, 153, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  </div>
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', marginTop: 8 }}>{approvedCount}</div>
                <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.65)', marginTop: 4 }}>
                  Verified & earnings credited
                </div>
              </div>

              {/* 4. Quick Studio Jump */}
              <div
                className="panel"
                style={{
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(15, 23, 42, 0.45))',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  padding: '16px 20px',
                  borderRadius: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <span style={{ fontSize: 12, color: '#a78bfa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Studio Workspace
                  </span>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
                    Listen & write transcription notes
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{
                    marginTop: 10,
                    width: '100%',
                    background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    borderRadius: 10,
                    padding: '8px 12px'
                  }}
                  onClick={() => nav.go('notebook')}
                >
                  🎧 Open Notebook Studio →
                </button>
              </div>
            </div>

            {/* Modern Control Bar: Filter Pills + Search + (New assignment button) */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                marginBottom: 16
              }}
            >
              {/* Status Filter Pills */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {filterOptions.map((opt) => {
                  const active = (st === opt.value) || (st === 'all' && opt.value === 'all');
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      className="btn btn-xs"
                      style={{
                        padding: '6px 14px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: active ? 700 : 500,
                        background: active ? 'linear-gradient(135deg, rgba(18, 194, 212, 0.25), rgba(59, 130, 246, 0.25))' : 'rgba(255, 255, 255, 0.05)',
                        border: active ? '1px solid rgba(18, 194, 212, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                        color: active ? '#7ee7f2' : 'var(--text)',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer'
                      }}
                      onClick={() => nav.patch({ taskStatus: opt.value })}
                    >
                      {opt.label} <span style={{ opacity: 0.65, marginLeft: 4 }}>({opt.count})</span>
                    </button>
                  );
                })}

                {/* Compatibility select element for e2e tests */}
                <select
                  id="st-filter"
                  value={st}
                  onChange={(e) => nav.patch({ taskStatus: e.target.value })}
                  style={{
                    background: 'rgba(10, 22, 40, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: 'var(--text)',
                    borderRadius: 10,
                    padding: '6px 12px',
                    fontSize: 12,
                    marginLeft: 6
                  }}
                >
                  <option value="all">All statuses ({totalCount})</option>
                  {STATUS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Right Side: Quick Search & Admin Button */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" style={{ position: 'absolute', left: 10, pointerEvents: 'none' }}>
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Filter list..."
                    value={localSearch}
                    onChange={(e) => setLocalSearch(e.target.value)}
                    style={{
                      background: 'rgba(15, 23, 42, 0.5)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: 10,
                      padding: '6px 10px 6px 30px',
                      fontSize: 12,
                      color: '#fff',
                      width: 170
                    }}
                  />
                </div>

                {can.assignWork(user) && (
                  <button className="btn btn-lime btn-sm" id="new-task" onClick={() => openTask()}>
                    + New assignment
                  </button>
                )}
              </div>
            </div>

            {/* Styled Task Table */}
            <TaskTable tasks={displayTasks.slice().sort(byDue)} showOwner={admin} ownerName={roster.name} onOpen={handleEditTask} />
          </Page>
        );
      }}
    </Resource>
  );
}

export function AssignView() {
  const { user } = useAuth(); const nav = useNav(); const toast = useToast(); const { refresh } = useLive(); const roster = useRoster();
  useHeader('Assign work', 'Create a task and drop it on someone’s month');
  const people = useResource(() => usersApi.assignable(), [user.id], { live: false });
  const [form, setForm] = useState(blankTask()); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if (!can.assignWork(user)) nav.go('dashboard'); }, [user, nav]);
  useEffect(() => { if (!form.assigneeId && people.data?.length) setForm((f) => ({ ...f, assigneeId: people.data[0].id })); }, [people.data, form.assigneeId]);
  const save = async () => {
    const p = formToPayload(form);
    if (!p.title || !p.assigneeId || !p.due) return toast('Title, owner and due date are required.');
    setBusy(true); setError('');
    try { const { progress, ...rest } = p; await tasksApi.create(rest); refresh(); toast('Assignment published.'); nav.go('tasks'); }
    catch (ex) { setError(ex.details ? Object.values(ex.details).join(' ') : ex.message); } finally { setBusy(false); }
  };
  return (
    <Page>
      <section className="panel" style={{ maxWidth: 720 }}>
        <h3>New assignment</h3>{error && <div className="auth-error" role="alert">{error}</div>}
        <TaskForm value={form} onChange={setForm} employees={people.data || []} roster={roster} />
        <div className="modal-actions"><button className="btn btn-primary" id="save-assign" style={{ width: 'auto', padding: '12px 20px' }} disabled={busy} onClick={save}>Publish assignment</button></div>
      </section>
    </Page>
  );
}
