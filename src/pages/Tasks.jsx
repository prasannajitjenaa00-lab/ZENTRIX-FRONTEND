import { useEffect, useState } from 'react';
import { tasksApi, usersApi } from '../services';
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
  return (
    <Resource res={res}>{(tasks) => (
      <Page>
        <div className="toolbar">
          <select id="st-filter" value={st} onChange={(e) => nav.patch({ taskStatus: e.target.value })}><option value="all">All statuses</option>{STATUS.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          {can.assignWork(user) && <button className="btn btn-lime btn-sm" id="new-task" onClick={() => openTask()}>New assignment</button>}
        </div>
        <TaskTable tasks={tasks.slice().sort(byDue)} showOwner={admin} ownerName={roster.name} onOpen={openTask} />
      </Page>)}
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
    try { const { progress, ...rest } = p; await tasksApi.create(rest); refresh(); toast('Assignment published.'); nav.go('calendar'); }   // original: new work starts at 5%
    catch (ex) { setError(ex.details ? Object.values(ex.details).join(' ') : ex.message); } finally { setBusy(false); }
  };
  return (
    <Page>
      <section className="panel" style={{ maxWidth: 720 }}>
        <h3>New assignment</h3>{error && <div className="auth-error" role="alert">{error}</div>}
        <TaskForm value={form} onChange={setForm} employees={people.data || []} roster={roster} />
        <div className="modal-actions"><button className="btn btn-primary" id="save-assign" style={{ width: 'auto', padding: '12px 20px' }} disabled={busy} onClick={save}>Publish to calendar</button></div>
      </section>
    </Page>
  );
}
