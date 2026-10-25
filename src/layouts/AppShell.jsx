import { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLive } from '../contexts/LiveContext';
import { useNav } from '../contexts/NavContext';
import { roleLabel } from '../utils/format';
import { HeaderCtx } from './HeaderContext';

function NavIcon({ type }) {
  switch (type) {
    case 'dashboard':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
    case 'tasks':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      );
    case 'audio':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
          <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
        </svg>
      );
    case 'chat':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case 'calendar':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case 'upload':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      );
    case 'assign':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <line x1="20" y1="8" x2="20" y2="14" />
          <line x1="23" y1="11" x2="17" y2="11" />
        </svg>
      );
    case 'profile':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'withdraw':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
          <line x1="7" y1="15" x2="7.01" y2="15" />
          <line x1="11" y1="15" x2="13" y2="15" />
        </svg>
      );
    default:
      return <span className="nav-ico">◈</span>;
  }
}

export function navItems(u) {
  if (u.role === 'admin') {
    return [
      ['dashboard', 'dashboard', 'Dashboard'],
      ['tasks', 'tasks', 'My Tasks'],
      ['upload-audio', 'upload', 'Upload Audio'],
      ['all-audio', 'audio', 'All Audio Files'],
      ['assign-work', 'assign', 'Assign Work'],
      ['notebook', 'audio', 'Assigned Audio'],
      ['assignments', 'tasks', 'All Assignments'],
      ['packages', 'tasks', 'Packages'],
      ['withdrawals', 'withdraw', 'Withdrawals'],
      ['people', 'profile', 'Accounts'],
      ['profile', 'profile', 'Profile'],
    ];
  }
  return [
    ['dashboard', 'dashboard', 'Dashboard'],
    ['notebook', 'audio', 'Assigned Audio'],
    ['tasks', 'tasks', 'My Tasks'],
    ['withdraw', 'withdraw', 'Withdraw'],
    ['profile', 'profile', 'Profile'],
  ];
}

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const nav = useNav();
  const [header, setHeader] = useState({
    title: 'Assigned Audio',
    sub: 'Listen to your assigned audio files, transcribe and submit for review',
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(2);
  const items = useMemo(() => navItems(user), [user]);
  const [search, setSearch] = useState('');

  const onSearch = (v) => {
    setSearch(v);
    const q = v.trim().toLowerCase();
    if (q.length >= 2) nav.go('tasks', { query: q });
  };
  const goTo = (key) => {
    setSearch('');
    setMobileNavOpen(false);
    setNotifOpen(false);
    nav.go(key);
  };

  const handleLogout = async () => {
    setMobileNavOpen(false);
    setNotifOpen(false);
    await logout();
  };

  const userInitials = user.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'DE';

  return (
    <HeaderCtx.Provider value={setHeader}>
      <section id="app-screen" className="shell screen-enter">
        {/* Mobile Backdrop */}
        {mobileNavOpen && <div className="sidebar-backdrop" onClick={() => setMobileNavOpen(false)} />}

        {/* Sidebar */}
        <aside className={`sidebar ${mobileNavOpen ? 'mobile-open' : ''}`}>
          {/* Brand header matching Zentrix PULSE */}
          <div className="sidebar-brand">
            <svg width="38" height="38" viewBox="0 0 40 40" fill="none" style={{ filter: 'drop-shadow(0 4px 12px rgba(0, 210, 255, 0.4))' }}>
              <rect width="40" height="40" rx="10" fill="url(#brand-grad)" />
              <path d="M11 12H29L16 26H29" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
              <defs>
                <linearGradient id="brand-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#00d2ff" />
                  <stop offset="1" stopColor="#1d4ed8" />
                </linearGradient>
              </defs>
            </svg>
            <div className="brand-text">
              <div className="brand-name" style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: '#ffffff' }}>Zentrix</div>
              <div className="brand-sub" style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#00d2ff', fontWeight: 700 }}>Pulse</div>
            </div>
            <button
              type="button"
              className="mobile-sidebar-close"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close navigation"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="nav-label">WORKSPACE</div>
          <nav id="nav">
            {items.map(([key, icoType, label]) => (
              <button
                key={key}
                className={`nav-btn ${nav.name === key ? 'active' : ''}`}
                data-view={key}
                onClick={() => goTo(key)}
              >
                <span className="nav-ico">
                  <NavIcon type={icoType} />
                </span>
                <span>{label}</span>
              </button>
            ))}
          </nav>

          <div className="sidebar-foot">
            <div className="user-card">
              <div
                className="avatar"
                style={{
                  background: 'linear-gradient(135deg, #059669, #10b981)',
                  color: '#ffffff',
                }}
              >
                {userInitials}
              </div>
              <div className="user-meta">
                <strong id="sb-name">{user.name}</strong>
                <small id="sb-role">
                  {user.role === 'employee' ? 'Transcription Team' : roleLabel(user.role)}
                </small>
              </div>
            </div>

            <button
              type="button"
              className="btn-sidebar-signout"
              id="logout-btn"
              onClick={handleLogout}
              title="Sign out of Zentrix Pulse"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span className="signout-text">Sign out</span>
            </button>
          </div>
        </aside>

        {/* Main Section */}
        <div className="main">
          <header className="topbar">
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setMobileNavOpen((o) => !o)}
              title="Toggle navigation menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="top-title">
              <h2 id="page-title">{header.title}</h2>
              <p id="page-sub">{header.sub}</p>
            </div>
            <div className="top-actions">
              <div className="search-box" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" style={{ position: 'absolute', left: 12, pointerEvents: 'none' }}>
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  id="global-search"
                  placeholder="Search audio files, tasks..."
                  value={search}
                  style={{ paddingLeft: 36, width: 260 }}
                  onChange={(e) => onSearch(e.target.value)}
                />
              </div>

              {/* Notification Bell with interactive dropdown */}
              <div className="topbar-notif-wrap">
                <button
                  type="button"
                  className={`topbar-icon-btn ${notifOpen ? 'active' : ''}`}
                  title="Notifications"
                  aria-label="View notifications"
                  onClick={() => setNotifOpen((v) => !v)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  {unreadCount > 0 && <span className="notif-dot" />}
                </button>

                {notifOpen && (
                  <>
                    <div className="notif-backdrop" onClick={() => setNotifOpen(false)} />
                    <div className="notif-dropdown">
                      <div className="notif-header">
                        <div className="notif-title-row">
                          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>Notifications</h4>
                          {unreadCount > 0 && <span className="notif-badge">{unreadCount} new</span>}
                        </div>
                        {unreadCount > 0 && (
                          <button
                            type="button"
                            className="notif-mark-read"
                            onClick={() => setUnreadCount(0)}
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                      <div className="notif-list">
                        <div className="notif-item unread" onClick={() => { goTo('notebook'); setNotifOpen(false); }}>
                          <div className="notif-bubble audio">🎧</div>
                          <div className="notif-info">
                            <strong>Assigned Audio Ready</strong>
                            <p>Transcribe and review your assigned audio tracks.</p>
                            <small>Just now</small>
                          </div>
                        </div>
                        <div className="notif-item unread" onClick={() => { goTo('tasks'); setNotifOpen(false); }}>
                          <div className="notif-bubble task">📋</div>
                          <div className="notif-info">
                            <strong>Tasks Synchronized</strong>
                            <p>Task status and project queues updated in real time.</p>
                            <small>12m ago</small>
                          </div>
                        </div>
                      </div>
                      <div className="notif-footer">
                        <button type="button" className="notif-close-btn" onClick={() => setNotifOpen(false)}>
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* User Avatar Circle */}
              <div
                className="topbar-avatar"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #059669, #10b981)',
                  color: '#ffffff',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 700,
                  fontSize: 12.5,
                  cursor: 'pointer',
                }}
                onClick={() => goTo('profile')}
              >
                {userInitials}
              </div>
            </div>
          </header>

          <main className="content" id="view">{children}</main>
        </div>
      </section>
    </HeaderCtx.Provider>
  );
}
