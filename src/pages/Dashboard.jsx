import { audioApi, dashApi, tasksApi } from '../services';
import { useAuth } from '../contexts/AuthContext';
import { useModal } from '../contexts/ModalContext';
import { useNav } from '../contexts/NavContext';
import { useToast } from '../contexts/ToastContext';
import { useHeader } from '../layouts/HeaderContext';
import { useResource } from '../hooks/useResource';
import { useRoster } from '../hooks/useRoster';
import KpiCard from '../components/KpiCard';
import StatusRing from '../components/StatusRing';
import TaskTable from '../components/TaskTable';
import { Page, Resource } from '../components/Page';
import { useOpenTask } from '../modals/TaskModal';
import { Mp3NotebookModal } from '../modals/SimpleModals';
import { fmtDate, fmtDateTime, money, roleLabel } from '../utils/format';

const small = { color: 'var(--muted)', fontSize: 12 };

function OverviewDashboard() {
  const { user } = useAuth(); const nav = useNav(); const roster = useRoster();
  useHeader('Command center', 'Live pulse across Zentrix — hover the ring for who owns each slice');
  const dash = useResource(() => dashApi.overview(), [user.id]);
  const tasks = useResource(async () => (await tasksApi.list()).data, [user.id]);
  const d = dash.data; const k = d?.kpis;
  return (
    <Resource res={dash}>{() => (
      <Page>
        <div className="kpi-grid">
          <KpiCard label="Active crew" value={k.activeCrew} sub={`${k.accounts} accounts in studio`} accent="#12c2d4" onClick={() => nav.go('crew')} />
          <KpiCard label="Open work" value={k.openWork} sub={`${k.totalTasks} total · ${k.avgProgress}% avg progress`} accent="#ff8a2b" onClick={() => nav.go('open')} />
          <KpiCard label="Completion" value={`${k.completionRate}%`} sub={`${k.completed} closed · live employee %`} accent="#2ec27a" />
          <KpiCard label="Overdue" value={k.overdue} sub="Need a status nudge" accent="#ff5a32" />
        </div>
        <div className="grid-2">
          <section className="panel">
            <h3>Work status ring <small className="hint-inline">Hover a slice or the center</small></h3>
            <StatusRing tasks={tasks.data || []} counts={d.statusCounts} nameOf={roster.name} onNavigate={nav.go} />
          </section>
          <section className="panel">
            <h3>Active team members <small className="hint-inline">Work progress</small></h3>
            {d.activeMembers.length ? d.activeMembers.map((p) => (
              <div className="list-item" key={p.id}>
                <div style={{ flex: 1 }}><strong>{p.name}</strong><div style={small}>{roleLabel(p.role)} · {p.open} open</div><div className="progress-bar"><span style={{ width: `${p.pct}%` }} /></div></div>
                <span className="badge st-Completed">{p.pct}%</span>
              </div>)) : <div className="empty">No active team members.</div>}
          </section>
        </div>
        <div className="grid-2" style={{ marginTop: 14 }}>
          <section className="panel"><h3>Upcoming due dates</h3>
            {d.upcoming.map((t) => (
              <div className="list-item" key={t.id}><div><strong>{t.title}</strong><div style={small}>{t.assigneeName} · due {fmtDate(t.due)}</div></div><span className={`badge st-${t.status}`}>{t.status}</span></div>))}
          </section>
          <section className="panel"><h3>Studio activity</h3>
            {d.activity.map((a) => (<div className="list-item" key={a.id}><div style={{ fontSize: 13 }}>{a.text}<div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4 }}>{fmtDateTime(a.at)}</div></div></div>))}
          </section>
        </div>
        <div className="grid-2" style={{ marginTop: 14 }}>
          <section className="panel"><h3>Active members <small className="hint-inline">{d.activeMembers.length}</small></h3>
            {d.activeMembers.length ? d.activeMembers.map((p) => (
              <div className="list-item" key={p.id}><div><strong>{p.name}</strong><div style={small}>{roleLabel(p.role)} · {p.email}{p.phone ? ` · ${p.phone}` : ''}</div>
                <div style={{ color: 'var(--soft)', fontSize: 11, marginTop: 2 }}>Last login: {p.lastLoginAt ? fmtDateTime(p.lastLoginAt) : 'Never'}</div></div><span className="badge st-Completed">Active</span></div>)) : <div className="empty">No active members.</div>}
          </section>
          <section className="panel"><h3>Inactive members <small className="hint-inline">{d.inactiveMembers.length}</small></h3>
            {d.inactiveMembers.length ? d.inactiveMembers.map((p) => (
              <div className="list-item" key={p.id}><div><strong>{p.name}</strong><div style={small}>{roleLabel(p.role)} · {p.email}</div>
                <div style={{ color: 'var(--soft)', fontSize: 11, marginTop: 2 }}>{p.reason} · Last login: {p.lastLoginAt ? fmtDateTime(p.lastLoginAt) : 'Never'}</div></div><span className="badge st-On Hold">Inactive</span></div>)) : <div className="empty">No inactive members.</div>}
          </section>
        </div>
        {d.security && (
          <section className="panel cred-panel" style={{ marginTop: 14 }}>
            <h3>Security credentials <small className="hint-inline">Password history · passwords are stored hashed and can never be shown</small></h3>
            <div className="table-wrap"><table>
              <thead><tr><th>Person</th><th>Email</th><th>Role</th><th>Password last changed</th></tr></thead>
              <tbody>{d.security.map((p) => (
                <tr key={p.id}><td><strong>{p.name}</strong></td><td>{p.email}</td><td>{p.role}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>{p.passwordChangedAt ? fmtDateTime(p.passwordChangedAt) : 'Never'}{p.passwordChangedBy && <div>{p.passwordChangedBy}</div>}</td></tr>))}</tbody>
            </table></div>
          </section>)}
      </Page>)}
    </Resource>
  );
}

function EmployeeDashboard() {
  const { user } = useAuth(); const { open } = useModal(); const toast = useToast(); const openTask = useOpenTask();
  useHeader(`${user.name.split(' ')[0]}'s dashboard`, `${user.title} · ${user.department}`);
  const res = useResource(() => dashApi.mine(), [user.id]);
  const openTrack = async (id) => {
    try { const list = await audioApi.assigned(); const item = list.find((x) => x.track.id === id); if (!item) return toast('That MP3 is no longer available.'); open(({ close }) => <Mp3NotebookModal item={item} close={close} />); }
    catch (ex) { toast(ex.message); }
  };
  return (
    <Resource res={res}>{(d) => (
      <Page>
        <div className="kpi-grid">
          <KpiCard label="Assigned" value={d.kpis.assigned} sub="On your Pulse board" accent="#12c2d4" />
          <KpiCard label="In motion" value={d.kpis.inMotion} sub="Actively shipping" accent="#ff8a2b" />
          <KpiCard label="Cleared" value={d.kpis.cleared} sub={`${d.kpis.completionRate}% complete`} accent="#2ec27a" />
          <KpiCard label="Wallet" value={money(d.wallet.currency, d.wallet.amount)} sub={d.wallet.name} accent="#2ec27a" />
        </div>
        <section className="panel" style={{ marginBottom: 14 }}>
          <h3>Your wallet</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div><div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.03em' }}>{money(d.wallet.currency, d.wallet.amount)}</div><div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>{d.wallet.name} package</div></div>
            <div style={{ color: 'var(--soft)', fontSize: 13, maxWidth: 420 }}>{d.wallet.note}</div>
          </div>
        </section>
        <div className="grid-2">
          <section className="panel"><h3>Your status ring</h3><StatusRing tasks={d.tasks} counts={d.statusCounts} nameOf={() => user.name} onNavigate={() => {}} /></section>
          <section className="panel"><h3>Next seven days</h3>
            {d.dueSoon.length ? d.dueSoon.map((t) => (
              <div className="list-item" key={t.id}><div><strong>{t.title}</strong><div style={small}>{t.category} · due {fmtDate(t.due)}</div><div className="progress-bar"><span style={{ width: `${t.progress}%` }} /></div></div>
                <button className="btn btn-ghost btn-sm" onClick={() => openTask(t)}>Update</button></div>)) : <div className="empty">Nothing due in the next week. Nice orbit.</div>}
          </section>
        </div>
        <section className="panel" style={{ marginTop: 14 }}>
          <h3>Assigned MP3s <small className="hint-inline">Click a track to open the notebook</small></h3>
          {d.assignedTracks.length ? d.assignedTracks.map((t) => (
            <div className="list-item kpi-link" key={t.id} data-mp3={t.id} style={{ cursor: 'pointer' }} onClick={() => openTrack(t.id)}>
              <div style={{ flex: 1 }}><strong>{t.originalName}</strong><div style={small}>{t.projectName} · {t.notesWritten ? 'Notes written' : 'Click to listen & write'}</div></div>
              <span className={`badge ${t.notesWritten ? 'st-Completed' : 'st-Pending'}`}>{t.notesWritten ? 'Written' : 'Open'}</span></div>)) : <div className="empty">No MP3 files assigned yet.</div>}
        </section>
        <section className="panel" style={{ marginTop: 14 }}><h3>Live assignments</h3><TaskTable tasks={d.tasks} showOwner={false} onOpen={openTask} /></section>
      </Page>)}
    </Resource>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  return user.role === 'employee' ? <EmployeeDashboard /> : <OverviewDashboard />;
}
export { EmployeeDashboard };
