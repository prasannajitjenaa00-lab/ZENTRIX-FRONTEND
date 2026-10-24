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
  const { user } = useAuth(); const nav = useNav(); const roster = useRoster(); const openTask = useOpenTask();
  const admin = user.role === 'admin';
  useHeader(admin ? 'All assignments' : 'My tasks', 'Update status as work moves');
  const st = nav.taskStatus || 'all';
  const res = useResource(async () => (await tasksApi.list({ status: st === 'all' ? undefined : st, q: nav.query || undefined })).data, [st, nav.query, user.id]);
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
    <Resource res={res}>{(tasks) => {
      let displayTasks = tasks;
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

        const combined = [...mappedRegular, ...extraAudioTasks];
        displayTasks = st && st !== 'all' ? combined.filter((t) => t.status === st) : combined;
      }

      return (
        <Page>
          <div className="toolbar">
            <select id="st-filter" value={st} onChange={(e) => nav.patch({ taskStatus: e.target.value })}>
              <option value="all">All statuses</option>
              {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {can.assignWork(user) && <button className="btn btn-lime btn-sm" id="new-task" onClick={() => openTask()}>New assignment</button>}
          </div>
          <TaskTable tasks={displayTasks.slice().sort(byDue)} showOwner={admin} ownerName={roster.name} onOpen={handleEditTask} />
        </Page>
      );
    }}</Resource>
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
