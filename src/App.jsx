import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LiveProvider } from './contexts/LiveContext';
import { ModalProvider } from './contexts/ModalContext';
import { NavProvider, useNav } from './contexts/NavContext';
import { ToastProvider } from './contexts/ToastContext';
import AppShell from './layouts/AppShell';
import Landing from './pages/Landing';
import AuthScreen, { ForcePasswordChange } from './pages/AuthScreen';
import { AssignView, TasksView } from './pages/Tasks';
import { ChatView, PackagesView, PeopleView } from './pages/Admin';
import { BoardView, CrewView } from './pages/Crew';
import Calendar from './pages/Calendar';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Projects, { NotebookView } from './pages/Projects';
import Assignments from './pages/Assignments';
import UploadAudioView from './pages/UploadAudio';
import AllAudioView from './pages/AllAudio';
import AssignWorkView from './pages/AssignWork';
import WithdrawView, { AdminWithdrawalsView } from './pages/Withdraw';

/** View router (the original's renderView map) with the same role fallbacks. */
function View() {
  const { user } = useAuth(); const nav = useNav();
  const leadership = user.role === 'admin';
  switch (nav.name) {
    case 'tasks': return <TasksView />;
    case 'assign': case 'assign-work': return leadership ? <AssignWorkView /> : <Dashboard />;
    case 'people': return <PeopleView />;
    case 'packages': return <PackagesView />;
    case 'withdraw': return <WithdrawView />;
    case 'withdrawals': return leadership ? <AdminWithdrawalsView /> : <WithdrawView />;
    case 'profile': return <Profile />;
    case 'crew': return leadership ? <CrewView /> : <Dashboard />;
    case 'open': case 'completed': case 'overdue': return leadership ? <BoardView kind={nav.name} /> : <Dashboard />;
    case 'upload-audio': return leadership ? <UploadAudioView /> : <Dashboard />;
    case 'all-audio': return leadership ? <AllAudioView /> : <Dashboard />;
    case 'projects': return <Projects />;
    case 'assignments': return leadership ? <Assignments /> : <Dashboard />;
    case 'notebook': return <NotebookView />;
    default: return <Dashboard />;
  }
}

function Gate() {
  const { status, user } = useAuth(); const nav = useNav();
  const [showAuth, setShowAuth] = useState(false);
  useEffect(() => { if (status === 'anon') { nav.reset(); setShowAuth(false); } }, [status]);   // fresh dashboard on next sign-in
  if (status === 'loading') return <div className="app-bg-hold" />;
  if (status === 'anon') return showAuth ? <AuthScreen onBack={() => setShowAuth(false)} /> : <Landing onLogin={() => setShowAuth(true)} />;
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
