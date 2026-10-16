import config from '../config';

export const STATUS = ['Pending', 'In Progress', 'On Hold', 'Completed'];
export const PRIORITY = ['Low', 'Medium', 'High'];
export const STATUS_COLOR = { Pending: '#12c2d4', 'In Progress': '#ff8a2b', 'On Hold': '#8b7cff', Completed: '#2ec27a' };
export const ROLE_LABEL = { admin: 'Admin', floor_manager: 'Floor Manager', team_leader: 'Team Leader', employee: 'Employee' };
export const MAX_PROJECT_UPLOAD = config.maxUploadFiles;


export const roleLabel = (r) => ROLE_LABEL[r] || r || 'Employee';
export const initials = (name) => (name || '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(String(iso).slice(0, 10) + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
export const fmtDateTime = (v) => (v ? new Date(v).toLocaleString('en-IN') : '');
export function fmtDuration(sec) {
  if (sec == null || !Number.isFinite(sec)) return '—';
  const m = Math.floor(sec / 60); const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
export const money = (cur, amount) => `${cur || '₹'}${Number(amount || 0).toLocaleString('en-IN')}`;
export const localISO = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const todayISO = () => localISO(new Date());
export function addDays(iso, n) { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return localISO(d); }
export const isOverdue = (t) => t.status !== 'Completed' && !!t.due && t.due < todayISO();
export const avgProgress = (tasks) => (tasks.length ? Math.round(tasks.reduce((a, t) => a + (Number(t.progress) || 0), 0) / tasks.length) : 0);
export function statusCounts(tasks) { const c = { Pending: 0, 'In Progress': 0, 'On Hold': 0, Completed: 0 }; tasks.forEach((t) => { if (c[t.status] != null) c[t.status] += 1; }); return c; }
export const byDue = (a, b) => (a.due || '').localeCompare(b.due || '');
export const ym = (y, m) => `${y}-${String(m + 1).padStart(2, '0')}`;

/** Password strength meter — same scoring as the original. */
export function passwordScore(v) {
  let s = 0;
  if (v.length >= 8) s++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
  if (/\d/.test(v)) s++;
  if (/[^A-Za-z0-9]/.test(v)) s++;
  return s;
}
export const PASS_LABEL = ['Too short', 'Weak', 'Okay', 'Strong', 'Solid'];
/** Role capabilities mirrored from the server (server remains the authority). */
export const can = {
  assignWork: (u) => !!u && ['admin', 'floor_manager', 'team_leader'].includes(u.role),
  manageAccounts: (u) => u?.role === 'admin',
  uploadProjects: (u) => u?.role === 'admin',
};
