import { useEffect, useState } from 'react';
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
import { Page, Resource } from '../components/Page';
import { Mp3NotebookModal } from '../modals/SimpleModals';
import { fmtDate, fmtDateTime, roleLabel } from '../utils/format';

const small = { color: 'var(--muted)', fontSize: 12 };

function formatHMS(totalSeconds) {
  const sec = Math.max(0, Math.floor(Number(totalSeconds || 0)));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function WatermarkChart() {
  return (
    <svg className="emp-kpi-watermark" width="56" height="42" viewBox="0 0 56 42" fill="currentColor">
      <rect x="4" y="24" width="8" height="18" rx="2" />
      <rect x="18" y="16" width="8" height="26" rx="2" />
      <rect x="32" y="8" width="8" height="34" rx="2" />
      <rect x="46" y="0" width="8" height="42" rx="2" />
    </svg>
  );
}

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
  const { user } = useAuth();
  const nav = useNav();
  const { open } = useModal();
  const toast = useToast();
  useHeader('Dashboard', "Welcome back! Here's your workspace overview.");

  const [currentTime, setCurrentTime] = useState(() => {
    return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  });

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }));
    };
    const timer = setInterval(updateTime, 15000);
    return () => clearInterval(timer);
  }, []);

  const res = useResource(() => dashApi.mine(), [user.id]);

  const openTrack = async (id) => {
    try {
      const list = await audioApi.assigned();
      const item = list.find((x) => x.track.id === id);
      if (!item) return toast('That MP3 is no longer available.');
      open(({ close }) => <Mp3NotebookModal item={item} close={close} />);
    } catch (ex) {
      toast(ex.message);
    }
  };

  return (
    <Resource res={res}>
      {(d) => {
        const packageBaseAmount = d.wallet?.amount ?? 0;
        const ratePerHour = d.wallet?.ratePerHour || (packageBaseAmount <= 2000 ? packageBaseAmount : 200);
        const packageName = d.wallet?.name && d.wallet.name !== 'No package' ? d.wallet.name : `₹${packageBaseAmount} Package`;
        const completedTracks = (d.assignedTracks || []).filter((t) => (t.listenedSeconds && t.listenedSeconds > 0) || t.notesWritten);
        const audioGeneratedCount = completedTracks.length;
        // Total duration strictly from actual seconds listened (not full audio duration)
        const totalDurationSec = (d.assignedTracks || []).reduce((acc, t) => {
          const localListened = typeof window !== 'undefined' ? (Number(localStorage.getItem('listened_' + t.id)) || 0) : 0;
          const serverListened = t.listenedSeconds || 0;
          const listened = Math.max(localListened, serverListened);
          const maxDur = t.duration || Infinity;
          return acc + Math.min(listened, maxDur);
        }, 0);
        const totalDurationFormatted = formatHMS(totalDurationSec);
        // Total Income = Package Base Amount (e.g. ₹3,500) + Audio Earnings
        const audioEarned = Math.round((totalDurationSec / 3600) * ratePerHour);
        const walletAmount = packageBaseAmount + audioEarned;

        return (
          <Page>
            <div className="emp-dashboard-container">
              {/* Top Hero Banner */}
              <section className="emp-hero-banner">
                <div className="emp-hero-content">
                  <h2 className="emp-hero-greeting">
                    Hello, <span className="emp-hero-name">{user.name}</span> 👋
                  </h2>
                  <p className="emp-hero-sub">Welcome back! Let's transcribe, organize and grow together.</p>

                  <div className="emp-hero-badges-row">
                    <span className="emp-badge-pill">⏳ Earn from Your Skills</span>
                    <span className="emp-badge-pill">📊 Work at Your Own Time</span>
                    <span className="emp-badge-pill">🎯 Accurate Work = Higher Earnings</span>
                  </div>

                  <div>
                    <button className="emp-start-task-btn" onClick={() => nav.go('notebook')}>
                      Start Task Now <span>→</span>
                    </button>
                  </div>
                </div>

                <div className="emp-hero-clock-pill">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>{currentTime}</span>
                </div>
              </section>

              {/* 4 KPI Cards */}
              <div className="emp-kpi-grid">
                {/* 1. Total Income */}
                <div className="emp-kpi-card teal">
                  <div className="emp-kpi-header">
                    <span className="emp-kpi-label">Total Income</span>
                    <div className="emp-kpi-icon-box">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="4" width="20" height="16" rx="2" />
                        <line x1="2" y1="10" x2="22" y2="10" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <div className="emp-kpi-value">₹ {walletAmount.toLocaleString()}</div>
                    <p className="emp-kpi-sub">
                      {totalDurationSec > 0
                        ? `Base ₹${packageBaseAmount.toLocaleString()} + ₹${audioEarned.toLocaleString()} earned (${totalDurationFormatted})`
                        : `Base ₹${packageBaseAmount.toLocaleString()} · ${packageName}`}
                    </p>
                  </div>
                  <WatermarkChart />
                </div>

                {/* 2. Current Pack */}
                <div className="emp-kpi-card blue">
                  <div className="emp-kpi-header">
                    <span className="emp-kpi-label">Current Pack ({packageName})</span>
                    <div className="emp-kpi-icon-box">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                        <line x1="12" y1="22.08" x2="12" y2="12" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <div className="emp-kpi-value">Per Hour: ₹ {ratePerHour}</div>
                    <p className="emp-kpi-sub">Package Amount: ₹ {packageBaseAmount.toLocaleString()}</p>
                  </div>
                  <WatermarkChart />
                </div>

                {/* 3. Total Audio Generated */}
                <div className="emp-kpi-card purple">
                  <div className="emp-kpi-header">
                    <span className="emp-kpi-label">Total Audio Generated</span>
                    <div className="emp-kpi-icon-box">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18V5l12-2v13" />
                        <circle cx="6" cy="18" r="3" />
                        <circle cx="18" cy="16" r="3" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <div className="emp-kpi-value">{audioGeneratedCount}</div>
                    <p className="emp-kpi-sub">Audio files completed</p>
                  </div>
                  <WatermarkChart />
                </div>

                {/* 4. Total Duration */}
                <div className="emp-kpi-card amber">
                  <div className="emp-kpi-header">
                    <span className="emp-kpi-label">Total Duration</span>
                    <div className="emp-kpi-icon-box">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <div className="emp-kpi-value">{totalDurationFormatted}</div>
                    <p className="emp-kpi-sub">Total transcription time</p>
                  </div>
                  <WatermarkChart />
                </div>
              </div>

              {/* Bottom 2-Column Split: Your Progress + Terms & Conditions */}
              <div className="emp-bottom-grid">
                {/* Left: Your Progress */}
                <section className="emp-panel-card">
                  <div className="emp-panel-header">
                    <div className="emp-panel-icon green">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="20" x2="18" y2="10" />
                        <line x1="12" y1="20" x2="12" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="14" />
                      </svg>
                    </div>
                    <div className="emp-panel-title-block">
                      <h3>Your Progress</h3>
                      <p>Keep working and track your growth here.</p>
                    </div>
                  </div>

                  <div className="emp-steps-flow">
                    {/* Step 1 */}
                    <div className="emp-step-item">
                      <div className="emp-step-circle c1">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                          <polyline points="10 9 9 9 8 9" />
                        </svg>
                      </div>
                      <div className="emp-step-text">
                        <strong>Start Task</strong>
                        <span>Pick an audio task</span>
                      </div>
                    </div>

                    <div className="emp-step-arrow">→</div>

                    {/* Step 2 */}
                    <div className="emp-step-item">
                      <div className="emp-step-circle c2">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="4" width="20" height="16" rx="2" />
                          <line x1="6" y1="8" x2="6" y2="8" />
                          <line x1="10" y1="8" x2="10" y2="8" />
                          <line x1="14" y1="8" x2="14" y2="8" />
                          <line x1="18" y1="8" x2="18" y2="8" />
                          <line x1="6" y1="12" x2="6" y2="12" />
                          <line x1="10" y1="12" x2="10" y2="12" />
                          <line x1="14" y1="12" x2="14" y2="12" />
                          <line x1="18" y1="12" x2="18" y2="12" />
                          <line x1="7" y1="16" x2="17" y2="16" />
                        </svg>
                      </div>
                      <div className="emp-step-text">
                        <strong>Transcribe</strong>
                        <span>Type accurately</span>
                      </div>
                    </div>

                    <div className="emp-step-arrow">→</div>

                    {/* Step 3 */}
                    <div className="emp-step-item">
                      <div className="emp-step-circle c3">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                      </div>
                      <div className="emp-step-text">
                        <strong>Submit</strong>
                        <span>Submit for review</span>
                      </div>
                    </div>

                    <div className="emp-step-arrow">→</div>

                    {/* Step 4 */}
                    <div className="emp-step-item">
                      <div className="emp-step-circle c4">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="8" r="7" />
                          <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
                        </svg>
                      </div>
                      <div className="emp-step-text">
                        <strong>Earn</strong>
                        <span>Get paid</span>
                      </div>
                    </div>
                  </div>

                  <div className="emp-progress-quote">
                    ⭐ "Consistent and accurate work helps you earn more and grow faster!"
                  </div>
                </section>

                {/* Right: Terms & Conditions */}
                <section className="emp-panel-card">
                  <div className="emp-panel-header">
                    <div className="emp-panel-icon mint">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                        <path d="M9 12h6" />
                        <path d="M9 16h6" />
                      </svg>
                    </div>
                    <div className="emp-panel-title-block">
                      <h3>Terms &amp; Conditions</h3>
                      <p>Please follow these important guidelines while doing work.</p>
                    </div>
                  </div>

                  <ol className="emp-terms-list">
                    <li className="emp-terms-item">
                      1. Every <span className="emp-hl-yellow">Word's First Letter Must Be In Capital Letter</span>.
                    </li>
                    <li className="emp-terms-item">
                      There should be space between two words. (<span className="emp-space-demo">A<span className="emp-space-bar"></span>B</span>)
                    </li>
                    <li className="emp-terms-item">
                      All numbers or some symbols should be written in words. (e.g., <span className="emp-hl-yellow">1 = One, , = Comma</span>)
                    </li>
                    <li className="emp-terms-item">
                      All mathematical symbols will be written in symbol form only. (e.g., <span className="emp-hl-green">+ , - , * , / , %</span>)
                    </li>
                    <li className="emp-terms-item">
                      There should be no spelling mistake.
                    </li>
                    <li className="emp-terms-item">
                      @ = At The Rate, # = Hassh
                    </li>
                  </ol>
                </section>
              </div>

              {/* Quick Assigned MP3 Audio Notebook shortcuts if employee has files */}
              {d.assignedTracks && d.assignedTracks.length > 0 && (
                <section className="panel" style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 16 }}>Assigned Audio Files <small className="hint-inline">Click to launch notebook &amp; transcribe</small></h3>
                    <button className="btn btn-ghost btn-sm" onClick={() => nav.go('notebook')}>Go to Notebook →</button>
                  </div>
                  {d.assignedTracks.map((t) => (
                    <div className="list-item kpi-link" key={t.id} data-mp3={t.id} style={{ cursor: 'pointer' }} onClick={() => openTrack(t.id)}>
                      <div style={{ flex: 1 }}>
                        <strong>{t.originalName}</strong>
                        <div style={small}>{t.projectName} · {t.notesWritten ? 'Transcription completed' : 'Pending transcription'}</div>
                      </div>
                      <span className={`badge ${t.notesWritten ? 'st-Completed' : 'st-Pending'}`}>
                        {t.notesWritten ? 'Completed' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </section>
              )}
            </div>
          </Page>
        );
      }}
    </Resource>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  return user.role === 'employee' ? <EmployeeDashboard /> : <OverviewDashboard />;
}
export { EmployeeDashboard };

