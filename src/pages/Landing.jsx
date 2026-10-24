import { useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, CalendarRange, CheckCircle2, ChevronDown, ChevronLeft,
  ChevronRight, FileText, LayoutDashboard, Lock, Menu, MessageCircle, MoreHorizontal, Play,
  Settings, Shield, Sparkles, Target, TrendingUp, Users, X, Zap,
} from 'lucide-react';

const NAV_LINKS = [
  ['#home', 'Home'],
  ['#how', 'How It Works'],
  ['#features', 'Features'],
  ['#why', 'Why Us'],
];

const CHECKLIST = ['Role-Based Dashboards', 'Secure & Confidential', 'Monthly Task Orbit', 'Live Status Rings'];

const SUMMARY = [
  [Users, 'blue', 'Role-Based', 'Tailored dashboards for every team member.'],
  [Activity, 'teal', 'Live Status Rings', 'Real-time delivery health at a glance.'],
  [Zap, 'orange', 'Fast', 'Efficient workflow for higher productivity.'],
  [Shield, 'green', 'Secure', 'Private workspace with appropriate access controls.'],
];

const STEPS = [
  ['01', FileText, 'blue', 'Create & Assign', 'Plan monthly tasks and assign them to the right team members.'],
  ['02', Activity, 'green', 'Track Progress', 'Monitor task statuses and updates in one place.'],
  ['03', TrendingUp, 'orange', 'Achieve Results', 'Stay on schedule and deliver with confidence.'],
];

const FEATURES = [
  [LayoutDashboard, 'Role-Based Dashboards', 'Admins, floor managers, team leads and crew each see exactly what they need.'],
  [CalendarRange, 'Monthly Task Orbit', 'A living calendar view that keeps every assignment in its place.'],
  [Activity, 'Live Status Rings', 'Watch open, completed and overdue work shift in real time.'],
  [Settings, 'Admin Account Studio', 'Provision people, packages and permissions from one console.'],
  [MessageCircle, 'Built-In Chat', 'Keep delivery conversations next to the work itself.'],
  [Lock, 'Secure & Confidential', 'An internal operations suite, built for Zentrix teams only.'],
];

const WHY = [
  [Target, 'For Leads', 'Assign work, watch delivery health, and step in before status slips.'],
  [CheckCircle2, 'For Crew', 'A clear, focused view of exactly what’s due and when.'],
  [Settings, 'For Admins', 'One console to manage people, packages and permissions.'],
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function statusForDay(day) {
  const r = day % 5;
  if (r === 0) return 'overdue';
  if (r === 2) return 'done';
  if (r === 4) return 'idle';
  return 'open';
}

function buildGrid(viewDate) {
  const year = viewDate.getFullYear(); const month = viewDate.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = firstDow - 1; i >= 0; i--) cells.push({ day: prevDays - i, muted: true });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, muted: false });
  let n = 1;
  while (cells.length % 7 !== 0) cells.push({ day: n++, muted: true });
  return cells;
}

function DashboardPreview() {
  const today = useMemo(() => new Date(), []);
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(today.getDate());

  const cells = useMemo(() => buildGrid(viewDate), [viewDate]);
  const isCurrentMonth = viewDate.getFullYear() === today.getFullYear() && viewDate.getMonth() === today.getMonth();
  const counts = useMemo(() => cells.filter((c) => !c.muted).reduce((acc, c) => {
    const s = statusForDay(c.day); acc[s] = (acc[s] || 0) + 1; return acc;
  }, {}), [cells]);

  const shiftMonth = (delta) => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  const monthLabel = viewDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="dash-wrap">
      <div className="dash-card">
        <div className="dash-head">
          <h3>{monthLabel}</h3>
          <div className="dash-controls">
            <button type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)}><ChevronLeft size={16} /></button>
            <button type="button" aria-label="Next month" onClick={() => shiftMonth(1)}><ChevronRight size={16} /></button>
            <button type="button" className="dash-team">All Teams <ChevronDown size={14} /></button>
            <button type="button" aria-label="More options" className="dash-more"><MoreHorizontal size={16} /></button>
          </div>
        </div>
        <div className="dash-weekdays">{WEEKDAYS.map((w) => <span key={w}>{w}</span>)}</div>
        <div className="dash-grid">
          {cells.map((cell, i) => {
            const status = cell.muted ? 'idle' : statusForDay(cell.day);
            const selected = isCurrentMonth && !cell.muted && cell.day === selectedDay;
            return (
              <button
                type="button"
                key={`${cell.day}-${i}`}
                className={`dash-day s-${status} ${cell.muted ? 'muted' : ''} ${selected ? 'selected' : ''}`}
                disabled={cell.muted}
                onClick={() => setSelectedDay(cell.day)}
              >
                {cell.day}
              </button>
            );
          })}
        </div>
        <div className="dash-fast">
          <span className="dash-fast-icon"><Zap size={16} /></span>
          <div><b>Fast</b><span>Accurate · Reliable · Real-time</span></div>
        </div>
      </div>
      <div className="dash-side">
        <div className="dash-stat">
          <span className="dsi s-open"><CheckCircle2 size={16} /></span>
          <div><b>Open</b><span>{counts.open || 0} tasks</span></div>
        </div>
        <div className="dash-stat">
          <span className="dsi s-done"><CheckCircle2 size={16} /></span>
          <div><b>Completed</b><span>{counts.done || 0} tasks</span></div>
        </div>
        <div className="dash-stat">
          <span className="dsi s-overdue"><AlertTriangle size={16} /></span>
          <div><b>Overdue</b><span>{counts.overdue || 0} tasks</span></div>
        </div>
        <div className="dash-stat">
          <span className="dsi s-sync"><Lock size={16} /></span>
          <div><b>Secure Sync</b><span>Auto backup</span></div>
        </div>
      </div>
    </div>
  );
}

export default function Landing({ onLogin }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="landing" id="landing-top">
      <nav className="landing-nav">
        <div className="landing-brand">
          <img src="/assets/logo.png" alt="Zentrix logo" />
          <span>ZENTRIX <em>PULSE</em></span>
        </div>
        <div className="landing-nav-links">
          {NAV_LINKS.map(([href, label]) => (
            <a key={href} href={href} className={label === 'Home' ? 'active' : ''}>{label}</a>
          ))}
        </div>
        <div className="landing-nav-cta">
          <button className="landing-btn landing-btn-ghost landing-btn-sm" onClick={onLogin}>Login</button>
          <button className="landing-btn landing-btn-primary landing-btn-sm" onClick={onLogin}>Get Started <ArrowRight size={14} /></button>
        </div>
        <button type="button" className="landing-menu-btn" aria-label="Toggle menu" onClick={() => setMenuOpen((v) => !v)}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        {menuOpen && (
          <div className="landing-mobile-menu">
            {NAV_LINKS.map(([href, label]) => <a key={href} href={href} onClick={closeMenu}>{label}</a>)}
            <div className="landing-mobile-cta">
              <button className="landing-btn landing-btn-ghost" onClick={() => { closeMenu(); onLogin(); }}>Login</button>
              <button className="landing-btn landing-btn-primary" onClick={() => { closeMenu(); onLogin(); }}>Get Started <ArrowRight size={14} /></button>
            </div>
          </div>
        )}
      </nav>

      <section className="landing-hero" id="home">
        <div className="landing-hero-copy">
          <span className="landing-badge"><Sparkles size={13} /> TEAM OPERATIONS PLATFORM</span>
          <h1>Orchestrate Every Month,<br /><em>Own Every Status.</em></h1>
          <p>A dedicated command center for Zentrix teams — assign work, track a living monthly calendar, and watch delivery health in real time. Work smarter with <strong>ZENTRIX PULSE</strong>.</p>
          <ul className="landing-checklist">
            {CHECKLIST.map((item) => <li key={item}><span className="lc-check"><CheckCircle2 size={16} /></span>{item}</li>)}
          </ul>
          <div className="landing-cta-row">
            <button className="landing-btn landing-btn-primary" onClick={onLogin}>Login to Your Account <ArrowRight size={16} /></button>
            <a className="landing-btn landing-btn-ghost" href="#how"><Play size={14} /> See How It Works</a>
          </div>
        </div>
        <div className="landing-hero-visual">
          <DashboardPreview />
        </div>
      </section>

      <section className="landing-summary">
        {SUMMARY.map(([Icon, tone, label, desc]) => (
          <div className="landing-summary-card" key={label}>
            <span className={`ls-icon tone-${tone}`}><Icon size={20} /></span>
            <div><b>{label}</b><span>{desc}</span></div>
          </div>
        ))}
      </section>

      <section className="landing-how" id="how">
        <div className="landing-section-head">
          <span className="section-eyebrow">SIMPLE &middot; TRANSPARENT &middot; POWERFUL</span>
          <h2>How Zentrix Pulse Works</h2>
          <p>From assignment to delivery, every step stays visible.</p>
        </div>
        <div className="landing-steps">
          {STEPS.map(([n, Icon, tone, title, desc]) => (
            <div className={`landing-step tone-${tone}`} key={n}>
              <span className="step-num">{n}</span>
              <span className={`step-icon tone-${tone}`}><Icon size={18} /></span>
              <div className="step-text"><h3>{title}</h3><p>{desc}</p></div>
              <ChevronRight className="step-chevron" size={18} />
            </div>
          ))}
        </div>
      </section>

      <section className="landing-features" id="features">
        <div className="landing-section-head">
          <span className="section-eyebrow">WHAT YOU GET</span>
          <h2>Everything Your Team Needs</h2>
          <p>Built around the way Zentrix teams actually work.</p>
        </div>
        <div className="landing-feature-grid">
          {FEATURES.map(([Icon, title, desc]) => (
            <div className="landing-feature-card" key={title}>
              <span className="lf-icon"><Icon size={18} /></span>
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-why" id="why">
        <div className="landing-section-head">
          <span className="section-eyebrow">BUILT FOR YOUR TEAM</span>
          <h2>Built for Every Role</h2>
          <p>One workspace, tuned to how each role on the team works.</p>
        </div>
        <div className="landing-why-grid">
          {WHY.map(([Icon, title, desc]) => (
            <div className="landing-why-card" key={title}>
              <span className="lw-icon"><Icon size={18} /></span>
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>
        <div className="landing-cta-banner">
          <div>
            <h3>Ready to orchestrate your month?</h3>
            <p>Sign in to your Zentrix Pulse workspace and pick up right where the team left off.</p>
          </div>
          <button className="landing-btn landing-btn-primary" onClick={onLogin}>Login to Your Account <ArrowRight size={16} /></button>
        </div>
      </section>

      <footer className="landing-footer">© {new Date().getFullYear()} ZENTRIX. All rights reserved.</footer>
    </div>
  );
}
