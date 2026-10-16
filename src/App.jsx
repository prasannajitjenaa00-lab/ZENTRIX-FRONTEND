import { useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LiveProvider } from './contexts/LiveContext';
import { ModalProvider } from './contexts/ModalContext';
import { NavProvider, useNav } from './contexts/NavContext';
import { ToastProvider } from './contexts/ToastContext';
import AppShell from './layouts/AppShell';
import AuthScreen, { ForcePasswordChange } from './pages/AuthScreen';
import { AssignView, TasksView } from './pages/Tasks';
import { ChatView, PackagesView, PeopleView } from './pages/Admin';
import { BoardView, CrewView } from './pages/Crew';
import Calendar from './pages/Calendar';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Projects, { NotebookView } from './pages/Projects';
import Assignments from './pages/Assignments';

/** View router (the original's renderView map) with the same role fallbacks. */
function View() {
  const { user } = useAuth(); const nav = useNav();
  const leadership = ['admin', 'floor_manager', 'team_leader'].includes(user.role);
  switch (nav.name) {
    case 'calendar': return <Calendar />;
    case 'tasks': return <TasksView />;
    case 'assign': return leadership ? <AssignView /> : <Dashboard />;
    case 'people': return <PeopleView />;
    case 'packages': return <PackagesView />;
    case 'profile': return <Profile />;
    case 'crew': return leadership ? <CrewView /> : <Dashboard />;
    case 'open': case 'completed': case 'overdue': return leadership ? <BoardView kind={nav.name} /> : <Dashboard />;
    case 'chat': return <ChatView />;
    case 'projects': return <Projects />;
    case 'assignments': return leadership ? <Assignments /> : <Dashboard />;
    case 'notebook': return <NotebookView />;
    default: return <Dashboard />;
  }
}

function Gate() {
  const { status, user } = useAuth(); const nav = useNav();
  useEffect(() => { if (status === 'anon') nav.reset(); }, [status]);   // fresh dashboard on next sign-in
  if (status === 'loading') return <div className="app-bg-hold" />;
  if (status === 'anon') return <AuthScreen />;
  if (user.mustChangePassword) return <ForcePasswordChange />;
  return <AppShell><View /></AppShell>;
}

export default function App() {
  return (
    <div>
      <div className="app-bg"><span className="orb orb-a" /><span className="orb orb-b" /><span className="orb orb-c" /></div>
      <ToastProvider><AuthProvider><NavProvider><LiveProvider><ModalProvider><Gate /></ModalProvider></LiveProvider></NavProvider></AuthProvider></ToastProvider>
    </div>
  );
}
