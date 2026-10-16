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
  ['', 'All statuses'], ['assigned', 'Pending'], ['in_progress', 'In Progress'], ['submitted', 'Submitted'],
  ['reviewed', 'Reviewed'], ['revision_requested', 'Revision requested'], ['overdue', 'Overdue'],
];

export default function Assignments() {
  const { user } = useAuth(); const { open } = useModal(); const toast = useToast(); const { refresh } = useLive();
  useHeader('Translation jobs', 'Track audio assignments and review submitted translations');
  const [employee, setEmployee] = useState(''); const [status, setStatus] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const people = useResource(() => usersApi.assignable(), [user.id], { live: false });
  const res = useResource(async () => (await audioApi.assignments({ employee: employee || undefined, status: status || undefined, from: from || undefined, to: to || undefined })).data, [user.id, employee, status, from, to]);

  const openReview = (row) => open(({ close }) => <AssignmentReviewModal row={row} close={close} onChanged={refresh} />);
  const remove = async (row) => {
    try { await audioApi.removeAssignment(row.id); toast('Assignment removed.'); refresh(); } catch (ex) { toast(ex.message); }
  };

  return (
    <Page>
      <section className="panel">
        <div className="toolbar">
          <select value={employee} onChange={(e) => setEmployee(e.target.value)}>
            <option value="">All employees</option>
            {people.data?.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="Assigned from" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} title="Assigned to" />
        </div>
        <Resource res={res}>{(rows) => (
          rows.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Track</th><th>Employee</th><th>Assigned</th><th>Deadline</th><th>Submitted</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id} className="kpi-link" onClick={() => openReview(a)}>
                      <td>{a.track?.originalName || '—'}</td>
                      <td>{a.employeeName}</td>
                      <td>{fmtDate((a.assignedAt || '').slice(0, 10))}</td>
                      <td>{a.deadline ? fmtDateTime(a.deadline) : '—'}</td>
                      <td>{a.submittedAt ? fmtDateTime(a.submittedAt) : '—'}</td>
                      <td><span className={`badge st-${a.displayStatus}`}>{a.displayStatus}</span></td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {!['submitted', 'reviewed'].includes(a.status) && (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(a)}>Remove</button>
                        )}
                      </td>
                    </tr>))}
                </tbody>
              </table>
            </div>
          ) : <div className="empty">No audio assignments match these filters.</div>
        )}</Resource>
      </section>
    </Page>
  );
}
