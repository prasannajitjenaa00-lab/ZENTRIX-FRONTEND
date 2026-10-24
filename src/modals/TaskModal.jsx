import { useEffect, useState } from 'react';
import { tasksApi, usersApi } from '../services';
import { useAuth } from '../contexts/AuthContext';
import { useLive } from '../contexts/LiveContext';
import { useModal } from '../contexts/ModalContext';
import { useToast } from '../contexts/ToastContext';
import { useResource } from '../hooks/useResource';
import { useRoster } from '../hooks/useRoster';
import { STATUS, fmtDate } from '../utils/format';
import TaskForm, { blankTask, formToPayload, taskToForm } from './TaskForm';

function EditorBody({ task, close, presetOwner }) {
  const { user } = useAuth(); const toast = useToast(); const { refresh } = useLive(); const roster = useRoster();
  const admin = user.role === 'admin';
  const { data: employees } = useResource(() => usersApi.assignable(), [], { live: false });
  const [form, setForm] = useState(task ? taskToForm(task) : blankTask({ assigneeId: presetOwner || '' }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // original <select> pre-selected its first option: do the same for a new assignment once the owner list arrives
  useEffect(() => { if (!task && !form.assigneeId && employees?.length) setForm((f) => ({ ...f, assigneeId: employees[0].id })); }, [task, employees, form.assigneeId]);
  const run = async (fn, ok) => { setBusy(true); setError(''); try { await fn(); refresh(); close(); toast(ok); } catch (ex) { setError(ex.details ? Object.values(ex.details).join(' ') : ex.message); } finally { setBusy(false); } };

  const save = () => {
    if (!task) {
      const p = formToPayload(form);
      if (!p.title || !p.assigneeId || !p.due) return toast('Title, owner and due date are required.');
      return run(() => tasksApi.create(p), 'Pulse updated.');
    }
    if (admin) return run(() => tasksApi.update(task.id, formToPayload(form)), 'Pulse updated.');
    return run(() => tasksApi.updateStatus(task.id, {
      title: form.title?.trim(),
      description: form.description?.trim(),
      status: form.status,
      progress: Math.max(0, Math.min(100, Number(form.progress || 0))),
      notes: form.notes.trim(),
    }), 'Pulse updated.');
  };
  const remove = () => run(() => tasksApi.remove(task.id), 'Assignment removed.');
  const ownerPerson = task ? roster.map.get(task.assigneeId) : null;

  return (
    <>
      <h3>{task ? (admin ? task.title : 'Edit Task') : 'New assignment'}</h3>
      {error && <div className="auth-error" role="alert">{error}</div>}
      {!task || admin ? (
        <TaskForm value={form} onChange={setForm} employees={employees || []} roster={roster} extraOwner={task && ownerPerson ? ownerPerson : undefined} />
      ) : (
        <>
          <div className="field">
            <label htmlFor="f-title">Title</label>
            <input id="f-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Task title" />
          </div>
          <div className="field">
            <label htmlFor="f-desc">Brief</label>
            <textarea id="f-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Context, links, definition of done" />
          </div>
          <div className="row-2">
            <div className="field"><label htmlFor="f-st">Status</label><select id="f-st" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUS.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div className="field"><label htmlFor="f-prog">Progress (%)</label><input id="f-prog" type="number" min="0" max="100" value={form.progress} onChange={(e) => setForm({ ...form, progress: e.target.value })} /></div>
          </div>
          <div className="field"><label htmlFor="f-notes">Notes</label><textarea id="f-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Add progress notes or remarks" /></div>
          <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 8 }}>Due {fmtDate(task.due)} · {task.category}</div>
        </>
      )}
      <div className="modal-actions">
        {admin && task && <button className="btn btn-danger btn-sm" id="del-task" disabled={busy} onClick={remove}>Remove</button>}
        <button className="btn btn-ghost btn-sm" id="close-m" onClick={close}>{task ? 'Close' : 'Cancel'}</button>
        <button className="btn btn-lime btn-sm" id="save-m" disabled={busy} onClick={save}>{task ? 'Save task' : 'Create'}</button>
      </div>
    </>
  );
}

/** openTask(task?) — original openTaskModal. Only admin or the assignee may open an existing task. */
export function useOpenTask() {
  const { open } = useModal(); const { user } = useAuth(); const toast = useToast();
  return (task) => {
    if (task && user.role !== 'admin' && task.assigneeId !== user.id) return toast('That assignment lives on another desk.');
    open(({ close }) => <EditorBody task={task} close={close} />);
  };
}
export function useOpenAssignTo() {
  const { open } = useModal(); const { user } = useAuth(); const toast = useToast();
  return (person) => {
    if (!['admin', 'floor_manager', 'team_leader'].includes(user.role)) return toast('Only a floor manager, team leader, or admin can assign work.');
    open(({ close }) => <AssignToBody person={person} close={close} />);
  };
}
function AssignToBody({ person, close }) {
  const toast = useToast(); const { refresh } = useLive(); const roster = useRoster();
  const [form, setForm] = useState(blankTask({ assigneeId: person.id })); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const save = async () => {
    const p = formToPayload(form);
    if (!p.title || !p.due) return toast('Title and due date are required.');
    setBusy(true); setError('');
    try { await tasksApi.create({ ...p, assigneeId: person.id, progress: p.progress || undefined }); refresh(); close(); toast(`Assigned to ${person.name.split(' ')[0]}.`); }
    catch (ex) { setError(ex.details ? Object.values(ex.details).join(' ') : ex.message); } finally { setBusy(false); }
  };
  return (
    <>
      <h3>Assign work to {person.name}</h3>
      <p className="hint" style={{ margin: '-6px 0 16px' }}>{person.role === 'employee' ? 'Employee' : person.role === 'team_leader' ? 'Team Leader' : person.role} · {person.title || ''}{person.leaderId && roster.name(person.leaderId) ? ` · reports to ${roster.name(person.leaderId)}` : ' · Direct to Admin'}</p>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <TaskForm value={form} onChange={setForm} employees={[person]} roster={roster} lockOwner />
      <div className="modal-actions"><button className="btn btn-ghost btn-sm" id="close-m" onClick={close}>Cancel</button><button className="btn btn-lime btn-sm" id="save-m" disabled={busy} onClick={save}>Assign task</button></div>
    </>
  );
}
