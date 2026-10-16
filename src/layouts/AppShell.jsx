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
    case 'profile':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
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
      ['notebook', 'audio', 'Assigned Audio'],
      ['chat', 'chat', 'Studio Chat'],
      ['calendar', 'calendar', 'My Calendar'],
      ['projects', 'dashboard', 'Projects'],
      ['assignments', 'audio', 'Translation Jobs'],
      ['packages', 'tasks', 'Packages'],
      ['people', 'profile', 'Accounts'],
      ['profile', 'profile', 'Profile'],
    ];
  }
  return [
    ['dashboard', 'dashboard', 'Dashboard'],
    ['tasks', 'tasks', 'My Tasks'],
    ['notebook', 'audio', 'Assigned Audio'],
    ['chat', 'chat', 'Studio Chat'],
    ['calendar', 'calendar', 'My Calendar'],
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
  const items = useMemo(() => navItems(user), [user]);
  const [search, setSearch] = useState('');

  const onSearch = (v) => {
    setSearch(v);
    const q = v.trim().toLowerCase();
    if (q.length >= 2) nav.go('tasks', { query: q });
  };
  const goTo = (key) => {
    setSearch('');
    nav.go(key);
  };

  const userInitials = user.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'DE';

  return (
    <HeaderCtx.Provider value={setHeader}>
      <section id="app-screen" className="shell screen-enter">
        {/* Sidebar */}
        <aside className="sidebar">
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
              onClick={logout}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Sign out</span>
            </button>
          </div>
        </aside>

        {/* Main Section */}
        <div className="main">
          <header className="topbar">
            <div className="top-title">
              <h2 id="page-title">{header.title}</h2>
              <p id="page-sub">{header.sub}</p>
            </div>
            <div className="top-actions">
              <div className="search-box">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" style={{ position: 'absolute', left: 12, top: 12 }}>
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

              {/* Notification Bell */}
              <button type="button" className="topbar-icon-btn" title="Notifications">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <span className="notif-dot" />
              </button>

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
