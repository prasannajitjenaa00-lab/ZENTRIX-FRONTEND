import { fmtDate, isOverdue } from '../utils/format';

export default function TaskTable({ tasks, showOwner = true, ownerName, onOpen }) {
  if (!tasks.length) return <div className="empty">No assignments match this filter.</div>;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Task</th>{showOwner && <th>Owner</th>}<th>Window</th><th>Progress</th><th>Status</th><th /></tr></thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id}>
              <td><strong>{t.title}</strong><div style={{ color: 'var(--muted)', fontSize: 12 }}>{t.category}{isOverdue(t) ? ' · overdue' : ''}</div></td>
              {showOwner && <td>{ownerName?.(t.assigneeId) || '—'}</td>}
              <td>{fmtDate(t.start)} → {fmtDate(t.due)}</td>
              <td style={{ minWidth: 110 }}><div className="pct-cell">{t.progress || 0}%</div><div className="progress-bar"><span style={{ width: `${t.progress || 0}%` }} /></div></td>
              <td><span className={`badge st-${t.status}`}>{t.status}</span></td>
              <td><button className="btn btn-ghost btn-sm" onClick={() => onOpen?.(t)}>Edit</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
