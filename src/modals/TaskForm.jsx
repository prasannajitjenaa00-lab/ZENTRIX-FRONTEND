import { PRIORITY, STATUS, roleLabel, todayISO } from '../utils/format';

export const blankTask = (over = {}) => ({ title: '', description: '', assigneeId: '', category: 'General', start: todayISO(), due: todayISO(), priority: 'Medium', status: 'Pending', progress: 0, notes: '', ...over });
export const taskToForm = (t) => ({ title: t.title, description: t.description || '', assigneeId: t.assigneeId, category: t.category, start: t.start || todayISO(), due: t.due, priority: t.priority, status: t.status, progress: t.progress ?? 0, notes: t.notes || '' });
export const formToPayload = (f) => ({ title: f.title.trim(), description: f.description.trim(), assigneeId: f.assigneeId, category: f.category.trim() || 'General', start: f.start, due: f.due, priority: f.priority, status: f.status, progress: Math.max(0, Math.min(100, Number(f.progress || 0))), notes: f.notes.trim() });

/** Controlled task form (title, brief, owner, category, dates, priority, status, progress, notes) — ids/labels as in the original. */
export default function TaskForm({ value, onChange, employees, roster, lockOwner = false, extraOwner }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  const owners = [...employees];
  if (extraOwner && !owners.some((o) => o.id === extraOwner.id)) owners.unshift(extraOwner);   // keep a legacy owner (e.g. a team leader) selectable
  return (
    <>
      <div className="field"><label htmlFor="f-title">Title</label><input id="f-title" value={value.title} onChange={set('title')} placeholder="What needs to ship?" /></div>
      <div className="field"><label htmlFor="f-desc">Brief</label><textarea id="f-desc" value={value.description} onChange={set('description')} placeholder="Context, links, definition of done" /></div>
      <div className="row-2">
        <div className="field"><label htmlFor="f-assignee">Owner</label>
          <select id="f-assignee" value={value.assigneeId} onChange={set('assigneeId')} disabled={lockOwner}>
            {!value.assigneeId && <option value="">Select an owner…</option>}
            {owners.map((e) => <option key={e.id} value={e.id}>{e.name} · {roleLabel(e.role)}{e.leaderId && roster?.name(e.leaderId) ? ` · TL ${roster.name(e.leaderId)}` : ' · Direct'}</option>)}
          </select></div>
        <div className="field"><label htmlFor="f-cat">Category</label><input id="f-cat" value={value.category} onChange={set('category')} /></div>
      </div>
      <div className="row-2">
        <div className="field"><label htmlFor="f-start">Start</label><input id="f-start" type="date" value={value.start} onChange={set('start')} /></div>
        <div className="field"><label htmlFor="f-due">Due</label><input id="f-due" type="date" value={value.due} onChange={set('due')} /></div>
      </div>
      <div className="row-2">
        <div className="field"><label htmlFor="f-pri">Priority</label><select id="f-pri" value={value.priority} onChange={set('priority')}>{PRIORITY.map((p) => <option key={p}>{p}</option>)}</select></div>
        <div className="field"><label htmlFor="f-st">Status</label><select id="f-st" value={value.status} onChange={set('status')}>{STATUS.map((s) => <option key={s}>{s}</option>)}</select></div>
      </div>
      <div className="field"><label htmlFor="f-prog">Progress (%)</label><input id="f-prog" type="number" min="0" max="100" value={value.progress} onChange={set('progress')} /></div>
      <div className="field"><label htmlFor="f-notes">Notes</label><textarea id="f-notes" value={value.notes} onChange={set('notes')} /></div>
    </>
  );
}
