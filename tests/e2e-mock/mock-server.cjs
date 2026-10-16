/* Contract mock: implements server/docs/API.md in memory so the React client can be exercised end-to-end in a real browser.
   It reuses the REAL policy + dto modules from the backend for scoping/shape. It is NOT the real backend. */
const http = require('http'); const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const S = path.resolve(__dirname, '../../../server/src');
const H = require(`${S}/policy/hierarchy`); const { classifyMembers, avgProgress, statusCounts } = require(`${S}/policy/members`); const dto = require(`${S}/services/dto`);
const { looksLikeMp3 } = require(`${S}/utils/mp3`); const { parseRange } = require(`${S}/utils/range`);
const legacy = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../server/tests/fixtures/pulse-db.redacted.json'), 'utf8')).db;
const PORT = Number(process.env.PORT || 4010); const DIST = path.resolve(__dirname, 'dist'); const PUBLIC = path.resolve(__dirname, '../../public'); const CSS = path.resolve(__dirname, '../../src/styles/styles.css');
const PW = 'Passw0rd!';

const now = () => new Date().toISOString(); let seq = 100; const id = (p) => `${p}_${++seq}`;
const state = { users: [], tasks: [], packages: [], chat: [], activity: [], projects: [], tracks: [], assignments: [], notes: [], sessions: new Map(), challenges: new Map(), resets: new Map(), pw: new Map(), mustChange: new Set(), recovery: new Map() };
const MP3 = Buffer.concat([Buffer.from('ID3\x04\x00\x00\x00\x00\x00\x00'), Buffer.alloc(4000, 1)]);
function seed() {
  state.packages = [['none', 'No package', 0], ['starter', 'Starter', 5000], ['standard', 'Standard', 10000], ['premium', 'Premium', 20000]].map(([k, n, a]) => ({ _id: `pkg_${k}`, key: k, name: n, amount: a, currency: '₹', note: `${n} package` }));
  state.users = legacy.users.map((u) => ({ _id: u.id, name: u.name, email: u.email, role: u.role, status: u.status || 'Active', department: u.department, title: u.title, phone: '', joined: u.joined, leader: u.leaderId, floor: u.floorId, package: u.packageId ? `pkg_${u.packageId}` : undefined, lastLoginAt: u.lastLoginAt, mfa: { enabled: u.id === 'u_ananya' }, bank: { hasDetails: false, locked: false }, bankDetails: null }));
  state.users.forEach((u) => state.pw.set(u._id, PW));
  state.tasks = legacy.tasks.map((t) => ({ _id: t.id, title: t.title, description: t.description, assignee: t.assigneeId, assignedBy: t.assignedBy, start: t.start, due: t.due, status: t.status, priority: t.priority, category: t.category, progress: t.progress, notes: t.notes || '', createdAt: t.updatedAt, updatedAt: t.updatedAt }));
  state.chat = [{ _id: 'c1', user: 'u_admin', name: 'Aryan Mehta', text: 'Studio chat is live.', at: now() }];
  state.activity = [{ _id: 'a1', text: 'Pulse workspace initialized for Zentrix.', at: now(), involved: [] }];
  state.projects = []; state.tracks = []; state.assignments = []; state.notes = [];
}
seed();
const plain = () => state.users.map(dto.toPlain);
const log = (text, involved = []) => state.activity.unshift({ _id: id('act'), text, at: now(), involved, type: 'general' });
const pub = (t) => ({ ...t, assignee: t.assignee });
const taskDto = (t) => dto.task(t);

const send = (res, status, body, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json', ...headers }); res.end(JSON.stringify(body)); };
const ok = (res, data, meta, status = 200, headers) => send(res, status, { ok: true, data, ...(meta ? { meta } : {}) }, headers);
const fail = (res, status, code, message, details) => send(res, status, { ok: false, error: { code, message, ...(details ? { details } : {}) } });
const readBody = (req) => new Promise((r) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => r(Buffer.concat(c))); });
const today = () => new Date().toISOString().slice(0, 10);
const me = (req) => { const sid = /pulse_sid=([^;]+)/.exec(req.headers.cookie || '')?.[1]; const uid = sid && state.sessions.get(sid); return uid ? state.users.find((u) => u._id === uid) : null; };
const fullUser = (u) => { const leader = state.users.find((x) => x._id === u.leader); return { ...dto.userFull(u), leaderName: leader?.name || null, mustChangePassword: state.mustChange.has(u._id), recoveryCodesRemaining: (state.recovery.get(u._id) || []).length }; };
const login = (res, u) => { const sid = crypto.randomUUID(); state.sessions.set(sid, u._id); u.lastLoginAt = now(); return sid; };
const log401 = { count: 0 };

async function api(req, res, url) {
  const method = req.method; const p = url.pathname; const q = Object.fromEntries(url.searchParams);
  const raw = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) ? await readBody(req) : Buffer.alloc(0);
  if (method !== 'GET' && req.headers['x-pulse-client'] !== '1') return fail(res, 403, 'CSRF', 'Missing client header.');   // verifies the client always sends it
  const ctype = req.headers['content-type'] || ''; let b = {}; if (raw.length && ctype.includes('json')) { try { b = JSON.parse(raw); } catch { return fail(res, 400, 'BAD_JSON', 'Malformed JSON.'); } }

  /* ---- auth (no session needed) ---- */
  if (p === '/api/auth/login' && method === 'POST') {
    const u = state.users.find((x) => x.email === String(b.email).toLowerCase());
    if (!u || state.pw.get(u._id) !== b.password) return fail(res, 401, 'INVALID_CREDENTIALS', 'Those credentials do not match a Zentrix account.');
    if (u.status !== 'Active') return fail(res, 403, 'ACCOUNT_SUSPENDED', 'This account is suspended. Contact your admin.');
    if (u.mfa.enabled) { const cid = id('ch'); state.challenges.set(cid, { uid: u._id, code: '123456', tries: 0 }); return ok(res, { mfaRequired: true, challengeId: cid, devPreview: { subject: 'Your Zentrix Pulse sign-in code', code: '123456' } }); }
    const sid = login(res, u); return ok(res, { mfaRequired: false, user: fullUser(u) }, undefined, 200, { 'Set-Cookie': `pulse_sid=${sid}; HttpOnly; Path=/; SameSite=Lax` });
  }
  if (p === '/api/auth/mfa/verify' && method === 'POST') {
    const ch = state.challenges.get(b.challengeId); if (!ch) return fail(res, 400, 'MFA_EXPIRED', 'That code has expired. Request a new one.');
    ch.tries += 1; if (ch.tries > 5) return fail(res, 400, 'MFA_TOO_MANY_ATTEMPTS', 'Too many attempts. Start sign-in again.');
    const rec = (state.recovery.get(ch.uid) || []); const canon = String(b.code).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const recHit = rec.find((c) => c.replace(/[^A-Z0-9]/g, '') === canon);
    if (String(b.code).trim() !== ch.code && !recHit) return fail(res, 400, 'MFA_INVALID', 'That code does not match.');
    if (recHit) state.recovery.set(ch.uid, rec.filter((c) => c !== recHit));
    state.challenges.delete(b.challengeId); const u = state.users.find((x) => x._id === ch.uid); const sid = login(res, u);
    return ok(res, { user: fullUser(u), recoveryUsed: !!recHit, recoveryRemaining: recHit ? (state.recovery.get(ch.uid) || []).length : undefined }, undefined, 200, { 'Set-Cookie': `pulse_sid=${sid}; HttpOnly; Path=/; SameSite=Lax` });
  }
  if (p === '/api/auth/mfa/resend' && method === 'POST') { const cid = id('ch'); state.challenges.set(cid, { uid: state.challenges.get(b.challengeId)?.uid, code: '123456', tries: 0 }); return ok(res, { challengeId: cid, devPreview: { subject: 'Your Zentrix Pulse sign-in code', code: '123456' } }); }
  if (p === '/api/auth/forgot' && method === 'POST') {
    const u = state.users.find((x) => x.email === String(b.email).toLowerCase()); let devPreview;
    if (u) { const t = crypto.randomBytes(24).toString('hex'); state.resets.set(t, u._id); devPreview = { subject: 'Reset your Zentrix Pulse password', link: `http://localhost:${PORT}/#reset=${t}` }; }
    return ok(res, { message: 'If that inbox is on Pulse, a reset letter is on its way.', devPreview });
  }
  if (p === '/api/auth/reset/verify' && method === 'POST') { const uid = state.resets.get(b.token); if (!uid) return fail(res, 400, 'RESET_INVALID', 'This reset link is invalid or has expired.'); return ok(res, { email: state.users.find((x) => x._id === uid).email }); }
  if (p === '/api/auth/reset' && method === 'POST') {
    const uid = state.resets.get(b.token); if (!uid) return fail(res, 400, 'RESET_INVALID', 'This reset link is invalid or has expired.');
    if (String(b.password).length < 6) return fail(res, 400, 'VALIDATION_ERROR', 'Use at least 6 characters.'); state.pw.set(uid, b.password); state.resets.delete(b.token); return ok(res, { email: state.users.find((x) => x._id === uid).email });
  }

  const user = me(req);
  if (!user) { log401.count++; return fail(res, 401, 'UNAUTHENTICATED', 'Sign in required.'); }
  if (p === '/api/auth/me') return ok(res, { user: fullUser(user) });
  if (p === '/api/auth/logout') { const sid = /pulse_sid=([^;]+)/.exec(req.headers.cookie)[1]; state.sessions.delete(sid); return ok(res, { loggedOut: true }); }
  if (p === '/api/auth/password' && method === 'POST') {
    if (state.pw.get(user._id) !== b.currentPassword) return fail(res, 400, 'WRONG_PASSWORD', 'Current password is incorrect.');
    state.pw.set(user._id, b.newPassword); state.mustChange.delete(user._id); return ok(res, { changed: true });
  }
  if (state.mustChange.has(user._id)) return fail(res, 403, 'PASSWORD_CHANGE_REQUIRED', 'Set a new password to continue.');

  const roster = plain(); const meP = dto.toPlain(user); const admin = user.role === 'admin'; const leaders = ['admin', 'floor_manager', 'team_leader'].includes(user.role);
  const scope = H.visibleAssigneeIds(roster, meP); const visible = () => state.tasks.filter((t) => scope === H.ALL || scope.has(t.assignee));

  /* ---- users ---- */
  if (p === '/api/users' && method === 'GET') { if (!admin) return fail(res, 403, 'FORBIDDEN', 'You do not have access to that.'); return ok(res, state.users.map((u) => ({ ...dto.userFull(u), ...(q.includeBank === '1' && u.bankDetails ? { bankDetails: u.bankDetails } : {}) })), { page: 1, limit: 500, total: state.users.length, pages: 1 }); }
  if (p === '/api/users/crew') { if (!leaders) return fail(res, 403, 'FORBIDDEN', 'No.'); return ok(res, H.activeCrew(roster, meP).map(dto.userPublic)); }
  if (p === '/api/users/assignable') { if (!leaders) return fail(res, 403, 'FORBIDDEN', 'No.'); return ok(res, H.managedEmployees(roster, meP).map(dto.userPublic)); }
  if (p === '/api/users/leaders') { if (!admin) return fail(res, 403, 'FORBIDDEN', 'No.'); return ok(res, state.users.filter((u) => ['team_leader', 'floor_manager'].includes(u.role) && u.status === 'Active').map(dto.userPublic)); }
  if (p === '/api/users' && method === 'POST') {
    if (!admin) return fail(res, 403, 'FORBIDDEN', 'No.');
    if (state.users.some((u) => u.email === b.email)) return fail(res, 409, 'EMAIL_TAKEN', 'That email already holds a Pulse seat.');
    const leader = state.users.find((u) => u._id === b.leaderId); const u = { _id: id('u'), name: b.name, email: b.email, role: b.role, status: 'Active', department: b.role, title: b.role, phone: b.phone || '', joined: today(), leader: b.leaderId, floor: leader?.floor, package: b.packageId, mfa: { enabled: b.mfaEnabled !== false }, bank: { hasDetails: false, locked: false } };
    const temp = b.password || 'Tmp-Pass-123!'; state.users.push(u); state.pw.set(u._id, temp); state.mustChange.add(u._id); log(`${user.name} created ${b.role} account for ${u.name}.`);
    return ok(res, { user: dto.userFull(u), temporaryPassword: b.password ? undefined : temp }, undefined, 201);
  }
  if (p === '/api/users/me' && method === 'PATCH') { if (b.name) user.name = b.name; if (b.title) user.title = b.title; let codes; if (b.mfaEnabled !== undefined) { const was = user.mfa.enabled; user.mfa.enabled = b.mfaEnabled; if (b.mfaEnabled && !was) { codes = ['PULSE-AAAA-BBBB', 'PULSE-CCCC-DDDD']; state.recovery.set(user._id, codes); } } return ok(res, { user: fullUser(user), recoveryCodes: codes }); }
  if (p === '/api/users/me/bank' && method === 'GET') return ok(res, { details: user.bankDetails, locked: !!user.bank.locked, hasDetails: user.bank.hasDetails, updatedAt: user.bank.updatedAt || null });
  if (p === '/api/users/me/bank' && method === 'PUT') {
    if (user.bank.locked && !admin) return fail(res, 403, 'BANK_LOCKED', 'Bank details are locked. Contact admin.');
    user.bankDetails = { holder: b.holder, name: b.name, account: b.account, ifsc: b.ifsc }; user.bank = { hasDetails: true, locked: true, updatedAt: now() }; return ok(res, { locked: true, updatedAt: user.bank.updatedAt });
  }
  let m = /^\/api\/users\/([^/]+)\/(status|bank)$/.exec(p);
  if (m && method === 'POST' && m[2] === 'status') { if (!admin) return fail(res, 403, 'FORBIDDEN', 'No.'); const t = state.users.find((u) => u._id === m[1]); if (t.role === 'admin') return fail(res, 403, 'FORBIDDEN', 'Admin accounts cannot be suspended.'); t.status = b.status; log(`${user.name} set ${t.name} to ${b.status}.`); return ok(res, dto.userFull(t)); }
  if (m && method === 'PATCH' && m[2] === 'bank') { if (!admin) return fail(res, 403, 'FORBIDDEN', 'No.'); const t = state.users.find((u) => u._id === m[1]); if (b.account) { t.bankDetails = { holder: b.holder, name: b.name, account: b.account, ifsc: b.ifsc }; t.bank = { hasDetails: true, locked: !b.unlock, updatedAt: now() }; } else if (b.unlock) t.bank.locked = false; return ok(res, { locked: t.bank.locked }); }
  m = /^\/api\/users\/([^/]+)$/.exec(p);
  if (m && method === 'PATCH') { if (!admin) return fail(res, 403, 'FORBIDDEN', 'No.'); const t = state.users.find((u) => u._id === m[1]); Object.assign(t, { name: b.name ?? t.name, email: b.email ?? t.email, phone: b.phone ?? t.phone }); if (b.role && t.role !== 'floor_manager') t.role = b.role; if (b.leaderId) t.leader = b.leaderId; if (b.packageId) t.package = b.packageId; if (b.mfaEnabled !== undefined) t.mfa.enabled = b.mfaEnabled; if (b.password) { state.pw.set(t._id, b.password); state.mustChange.add(t._id); } log(`${user.name} updated ${t.name}'s account.`); return ok(res, { user: dto.userFull(t) }); }

  /* ---- tasks ---- */
  if (p === '/api/tasks/calendar') { const [y, mo] = q.month.split('-'); let list = state.tasks.filter((t) => t.due.startsWith(`${y}-${mo}`)); if (admin) { if (q.assignee && q.assignee !== 'all') list = list.filter((t) => t.assignee === q.assignee); } else list = list.filter((t) => t.assignee === user._id); return ok(res, list.map(taskDto)); }
  if (p === '/api/tasks' && method === 'GET') { let list = visible(); if (q.status) list = list.filter((t) => t.status === q.status); if (q.q && q.q.length >= 2) { const r = q.q.toLowerCase(); list = list.filter((t) => (t.title + t.description + t.category + (state.users.find((u) => u._id === t.assignee)?.name || '')).toLowerCase().includes(r)); } list.sort((a, b) => a.due.localeCompare(b.due)); return ok(res, list.map(taskDto), { page: 1, limit: 500, total: list.length, pages: 1 }); }
  if (p === '/api/tasks' && method === 'POST') {
    if (!leaders) return fail(res, 403, 'FORBIDDEN', 'Only a floor manager, team leader, or admin can assign work.');
    if (!H.managedEmployees(roster, meP).some((e) => e.id === b.assigneeId)) return fail(res, 403, 'FORBIDDEN', 'That teammate is not in your scope.');
    const t = { _id: id('task'), title: b.title, description: b.description || '', assignee: b.assigneeId, assignedBy: user._id, start: b.start || today(), due: b.due, status: b.status || 'Pending', priority: b.priority || 'Medium', category: b.category || 'General', progress: b.progress ?? 5, notes: b.notes || '', createdAt: now(), updatedAt: now() };
    state.tasks.unshift(t); log(`${user.name} assigned “${t.title}” to ${state.users.find((u) => u._id === t.assignee).name}.`, [t.assignee]); return ok(res, taskDto(t), undefined, 201);
  }
  m = /^\/api\/tasks\/([^/]+)(\/status)?$/.exec(p);
  if (m) {
    const t = state.tasks.find((x) => x._id === m[1]); if (!t || !(scope === H.ALL || scope.has(t.assignee))) return fail(res, 404, 'NOT_FOUND', 'Assignment not found.');
    if (method === 'GET') return ok(res, taskDto(t));
    if (m[2] && method === 'PATCH') { if (!(admin || t.assignee === user._id)) return fail(res, 403, 'FORBIDDEN', 'That assignment lives on another desk.'); ['status', 'progress', 'notes'].forEach((k) => { if (b[k] !== undefined) t[k] = b[k]; }); if (t.status === 'Completed') t.progress = 100; t.updatedAt = now(); log(`${user.name} updated “${t.title}” to ${t.status} at ${t.progress}%.`, [t.assignee]); return ok(res, taskDto(t)); }
    if (method === 'PATCH') { if (!admin) return fail(res, 403, 'FORBIDDEN', 'No.'); const mp = { assigneeId: 'assignee' }; Object.entries(b).forEach(([k, v]) => { t[mp[k] || k] = v; }); if (t.status === 'Completed') t.progress = 100; t.updatedAt = now(); log(`${user.name} revised “${t.title}” (${t.progress}% · ${t.status}).`, [t.assignee]); return ok(res, taskDto(t)); }
    if (method === 'DELETE') { if (!admin) return fail(res, 403, 'FORBIDDEN', 'No.'); state.tasks = state.tasks.filter((x) => x !== t); log(`${user.name} removed “${t.title}”.`); return ok(res, { deleted: true }); }
  }

  /* ---- dashboards ---- */
  if (p === '/api/dashboard') {
    if (!leaders) return fail(res, 403, 'FORBIDDEN', 'No.');
    const tasks = visible().map(taskDto); const counts = statusCounts(tasks); const crew = H.activeCrew(roster, meP); const late = tasks.filter((t) => t.status !== 'Completed' && t.due < today());
    const { active, inactive } = classifyMembers(H.memberScope(roster, meP), tasks.map((t) => ({ assigneeId: t.assigneeId, updatedAt: t.updatedAt })));
    const load = (pp) => { const mine = tasks.filter((t) => t.assigneeId === pp.id); return { pct: avgProgress(mine), open: mine.filter((t) => t.status !== 'Completed').length }; };
    const out = { today: today(), kpis: { activeCrew: crew.length, accounts: admin ? roster.length : crew.length, openWork: tasks.filter((t) => t.status !== 'Completed').length, totalTasks: tasks.length, avgProgress: avgProgress(tasks), completed: counts.Completed, completionRate: tasks.length ? Math.round((counts.Completed / tasks.length) * 100) : 0, overdue: late.length }, statusCounts: counts,
      activeMembers: active.map((pp) => ({ ...dto.userPublic(pp), email: pp.email, phone: pp.phone, lastLoginAt: pp.lastLoginAt, ...load(pp) })), inactiveMembers: inactive.map(({ user: pp, reason }) => ({ ...dto.userPublic(pp), email: pp.email, lastLoginAt: pp.lastLoginAt, reason })),
      upcoming: tasks.filter((t) => t.status !== 'Completed').sort((a, b) => a.due.localeCompare(b.due)).slice(0, 6).map((t) => ({ ...t, assigneeName: state.users.find((u) => u._id === t.assigneeId)?.name })),
      activity: state.activity.filter((a) => admin || (a.involved || []).some((i) => scope.has?.(i))).slice(0, 7).map(dto.activity) };
    if (admin) out.security = state.users.map((u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, mfaEnabled: u.mfa.enabled, mfaLastAt: null, passwordChangedAt: null, passwordChangedBy: null }));
    return ok(res, out);
  }
  if (p === '/api/dashboard/me') {
    const tasks = state.tasks.filter((t) => t.assignee === user._id).map(taskDto); const counts = statusCounts(tasks); const pk = state.packages.find((x) => x._id === user.package);
    const mine = state.assignments.filter((a) => a.assignee === user._id).map((a) => state.tracks.find((t) => t._id === a.track)).filter(Boolean);
    return ok(res, { today: today(), kpis: { assigned: tasks.length, inMotion: counts['In Progress'], cleared: counts.Completed, completionRate: tasks.length ? Math.round((counts.Completed / tasks.length) * 100) : 0 }, statusCounts: counts, dueSoon: tasks.filter((t) => t.status !== 'Completed' && t.due <= '2099-01-01').slice(0, 3), tasks: tasks.sort((a, b) => a.due.localeCompare(b.due)), wallet: dto.pkg(pk) || { name: 'No package', amount: 0, currency: '₹', note: '' },
      assignedTracks: mine.map((t) => ({ ...dto.track(t), projectName: state.projects.find((pr) => pr._id === t.project)?.name, notesWritten: !!state.notes.find((n) => n.user === user._id && n.track === t._id && n.text) })) });
  }
  if (p === '/api/activity') return ok(res, state.activity.slice(0, 40).map(dto.activity));

  /* ---- packages / wallet ---- */
  if (p.startsWith('/api/packages')) {
    if (!admin) return fail(res, 403, 'FORBIDDEN', 'No.'); const mm = /^\/api\/packages\/([^/]+)$/.exec(p);
    if (!mm && method === 'GET') return ok(res, state.packages.map(dto.pkg));
    if (!mm && method === 'POST') { if (Number(b.amount) < 0) return fail(res, 400, 'VALIDATION_ERROR', 'Some fields need attention.', { amount: 'Must be a number between 0 and 1000000000.' }); const pk = { _id: id('pkg'), name: b.name, amount: b.amount, currency: b.currency || '₹', note: b.note || '' }; state.packages.push(pk); return ok(res, dto.pkg(pk), undefined, 201); }
    if (mm && method === 'PATCH') { const pk = state.packages.find((x) => x._id === mm[1]); Object.assign(pk, b); return ok(res, dto.pkg(pk)); }
    if (mm && method === 'DELETE') { state.packages = state.packages.filter((x) => x._id !== mm[1]); state.users.forEach((u) => { if (u.package === mm[1]) u.package = 'pkg_standard'; }); return ok(res, { reassigned: 0 }); }
  }
  if (p === '/api/wallet/me') return ok(res, { package: dto.pkg(state.packages.find((x) => x._id === user.package)) || { name: 'No package', amount: 0, currency: '₹', note: '' } });

  /* ---- chat ---- */
  if (p === '/api/chat' && method === 'GET') return ok(res, state.chat.map(dto.chat));
  if (p === '/api/chat' && method === 'POST') { if (!admin) return fail(res, 403, 'FORBIDDEN', 'No.'); const c = { _id: id('chat'), user: user._id, name: user.name, text: b.text, at: now() }; state.chat.push(c); return ok(res, dto.chat(c), undefined, 201); }

  /* ---- mfa / devices ---- */
  if (p === '/api/mfa/recovery-codes') { const codes = Array.from({ length: 6 }, (_, i) => `PULSE-TEST-${String.fromCharCode(65 + i)}${i}${i}${i}`); state.recovery.set(user._id, codes); return ok(res, { recoveryCodes: codes }); }
  if (p === '/api/devices' && method === 'DELETE') return ok(res, { cleared: true });

  /* ---- projects / audio ---- */
  if (p === '/api/projects' && method === 'GET') { if (!leaders) return fail(res, 403, 'FORBIDDEN', 'No.'); return ok(res, state.projects.map((pr) => ({ ...dto.project(pr), trackCount: state.tracks.filter((t) => t.project === pr._id).length }))); }
  if (p === '/api/projects' && method === 'POST') { if (!admin) return fail(res, 403, 'FORBIDDEN', 'No.'); const pr = { _id: id('proj'), name: b.name, description: b.description || '', createdBy: user._id, createdAt: now() }; state.projects.unshift(pr); return ok(res, dto.project(pr), undefined, 201); }
  m = /^\/api\/projects\/([^/]+)\/tracks$/.exec(p);
  if (m && method === 'GET') return ok(res, state.tracks.filter((t) => t.project === m[1]).map((t) => ({ ...dto.track(t), assignedCount: state.assignments.filter((a) => a.track === t._id).length })));
  if (m && method === 'POST') {
    if (!admin) return fail(res, 403, 'FORBIDDEN', 'No.'); const boundary = /boundary=(.+)$/.exec(ctype)?.[1]; const parts = raw.toString('latin1').split(`--${boundary}`).filter((s) => s.includes('filename='));
    const tracks = []; const rejected = [];
    for (const part of parts) { const name = /filename="([^"]*)"/.exec(part)[1]; const body = Buffer.from(part.slice(part.indexOf('\r\n\r\n') + 4, part.lastIndexOf('\r\n')), 'latin1'); if (!looksLikeMp3(body)) { rejected.push({ name, reason: 'Not a valid MP3 file.' }); continue; } const t = { _id: id('trk'), project: m[1], originalName: name, size: body.length, mime: 'audio/mpeg', createdAt: now() }; state.tracks.push(t); tracks.push(dto.track(t)); }
    if (!tracks.length) return send(res, 400, { ok: false, error: { code: 'NO_VALID_FILES', message: 'Only MP3 files can be uploaded to a project.', details: { rejected } } });
    return ok(res, { tracks, rejected, project: {} }, undefined, 201);
  }
  if (p === '/api/audio/assign' && method === 'POST') { if (!leaders) return fail(res, 403, 'FORBIDDEN', 'No.'); let added = 0; for (const t of b.trackIds) for (const a of b.assigneeIds) { if (!state.assignments.some((x) => x.track === t && x.assignee === a)) { state.assignments.push({ _id: id('asg'), track: t, assignee: a, assignedBy: user._id, project: state.tracks.find((x) => x._id === t).project, status: 'assigned', assignedAt: now(), deadline: b.deadline || null, reviewFeedback: '' }); added++; } } return ok(res, { added, alreadyAssigned: b.trackIds.length * b.assigneeIds.length - added }); }
  const noteFor = (uid, trackId) => state.notes.find((x) => x.user === uid && x.track === trackId);
  const assignedRow = (a) => {
    const t = state.tracks.find((x) => x._id === a.track); const n = noteFor(a.assignee, a.track);
    return {
      assignmentId: a._id, assignedAt: a.assignedAt, deadline: a.deadline || null, status: a.status,
      displayStatus: dto.displayStatusOf(a), overdue: dto.overdueOf(a), reviewFeedback: a.reviewFeedback || '',
      track: dto.track(t), projectName: state.projects.find((pr) => pr._id === t.project)?.name,
      notes: n?.text || '', notesUpdatedAt: n?.updatedAt || null, version: n?.version || 0, history: n?.history || [],
    };
  };
  if (p === '/api/audio/assigned') return ok(res, state.assignments.filter((a) => a.assignee === user._id).map(assignedRow));
  m = /^\/api\/audio\/([^/]+)\/stream$/.exec(p);
  if (m) { const t = state.tracks.find((x) => x._id === m[1]); const okAccess = leaders || state.assignments.some((a) => a.track === m[1] && a.assignee === user._id); if (!t || !okAccess) return fail(res, 404, 'NOT_FOUND', 'Not found.'); const r = parseRange(req.headers.range, MP3.length); res.setHeader('Accept-Ranges', 'bytes'); res.setHeader('Content-Type', 'audio/mpeg'); if (r && r !== 'invalid') { res.writeHead(206, { 'Content-Range': `bytes ${r.start}-${r.end}/${MP3.length}` }); return res.end(MP3.subarray(r.start, r.end + 1)); } res.writeHead(200); return res.end(MP3); }

  /* ---- audio assignments: tracking dashboard + review ---- */
  const LOCKED = new Set(['submitted', 'reviewed']);
  if (p === '/api/audio/assignments' && method === 'GET') {
    if (!leaders) return fail(res, 403, 'FORBIDDEN', 'No.');
    let list = state.assignments.filter((a) => scope === H.ALL || scope.has(a.assignee));
    if (q.employee) list = list.filter((a) => a.assignee === q.employee);
    if (q.status === 'overdue') list = list.filter((a) => dto.overdueOf(a));
    else if (q.status) list = list.filter((a) => a.status === q.status);
    if (q.from) list = list.filter((a) => a.assignedAt >= q.from);
    if (q.to) list = list.filter((a) => a.assignedAt <= q.to);
    const rows = list.map((a) => { const t = state.tracks.find((x) => x._id === a.track); const n = noteFor(a.assignee, a.track); const e = state.users.find((x) => x._id === a.assignee); return { id: a._id, trackId: a.track, employeeId: a.assignee, employeeName: e?.name || 'Former employee', assignedAt: a.assignedAt, deadline: a.deadline || null, status: a.status, displayStatus: dto.displayStatusOf(a), overdue: dto.overdueOf(a), reviewFeedback: a.reviewFeedback || '', submittedAt: a.submittedAt || null, reviewedAt: a.reviewedAt || null, track: dto.track(t), text: n?.text || '', submittedText: n?.submittedText || '', version: n?.version || 0 }; });
    return ok(res, rows, { page: 1, limit: 200, total: rows.length, pages: 1 });
  }
  m = /^\/api\/audio\/assignments\/([^/]+)$/.exec(p);
  if (m && method === 'GET') {
    const a = state.assignments.find((x) => x._id === m[1]); if (!a) return fail(res, 404, 'NOT_FOUND', 'Not found.');
    const owner = a.assignee === user._id; if (!owner && !(leaders && (scope === H.ALL || scope.has(a.assignee)))) return fail(res, 403, 'FORBIDDEN', 'No.');
    const t = state.tracks.find((x) => x._id === a.track); const n = noteFor(a.assignee, a.track); const e = state.users.find((x) => x._id === a.assignee);
    return ok(res, { id: a._id, trackId: a.track, employeeId: a.assignee, employeeName: e?.name, assignedAt: a.assignedAt, deadline: a.deadline || null, status: a.status, displayStatus: dto.displayStatusOf(a), overdue: dto.overdueOf(a), reviewFeedback: a.reviewFeedback || '', submittedAt: a.submittedAt || null, reviewedAt: a.reviewedAt || null, track: dto.track(t), text: n?.text || '', submittedText: n?.submittedText || '', version: n?.version || 0, history: n?.history || [] });
  }
  if (m && method === 'DELETE') {
    const a = state.assignments.find((x) => x._id === m[1]); if (!a) return fail(res, 404, 'NOT_FOUND', 'Not found.'); if (!leaders) return fail(res, 403, 'FORBIDDEN', 'No.');
    if (LOCKED.has(a.status)) return fail(res, 409, 'ASSIGNMENT_LOCKED', 'This translation has already been submitted and cannot be removed.');
    state.assignments = state.assignments.filter((x) => x !== a); return ok(res, { deleted: true });
  }
  m = /^\/api\/audio\/assignments\/([^/]+)\/reassign$/.exec(p);
  if (m && method === 'PATCH') {
    const a = state.assignments.find((x) => x._id === m[1]); if (!a) return fail(res, 404, 'NOT_FOUND', 'Not found.'); if (!leaders) return fail(res, 403, 'FORBIDDEN', 'No.');
    if (LOCKED.has(a.status)) return fail(res, 409, 'ASSIGNMENT_LOCKED', 'This translation has already been submitted and cannot be reassigned.');
    if (state.assignments.some((x) => x !== a && x.track === a.track && x.assignee === b.assigneeId)) return fail(res, 409, 'DUPLICATE_ASSIGNMENT', 'That employee already has this MP3 assigned.');
    a.assignee = b.assigneeId; a.status = 'assigned'; a.submittedAt = null; a.reviewedAt = null; a.reviewFeedback = '';
    return ok(res, { id: a._id, employeeId: a.assignee, status: a.status, displayStatus: dto.displayStatusOf(a) });
  }
  m = /^\/api\/audio\/assignments\/([^/]+)\/submit$/.exec(p);
  if (m && method === 'POST') {
    const a = state.assignments.find((x) => x._id === m[1] && x.assignee === user._id); if (!a) return fail(res, 404, 'NOT_FOUND', 'Not found.');
    if (LOCKED.has(a.status)) return fail(res, 409, 'TRANSLATION_LOCKED', 'This translation has already been submitted.');
    const n = noteFor(user._id, a.track); const text = (n?.text || '').trim(); if (!text) return fail(res, 400, 'VALIDATION_ERROR', 'Write your translation before submitting.');
    n.version = (n.version || 0) + 1; n.submittedAt = now(); n.submittedText = text; n.history = [...(n.history || []), { text, version: n.version, submittedAt: n.submittedAt }].slice(-5);
    a.status = 'submitted'; a.submittedAt = n.submittedAt; a.reviewFeedback = '';
    return ok(res, { id: a._id, status: a.status, displayStatus: dto.displayStatusOf(a), version: n.version });
  }
  m = /^\/api\/audio\/assignments\/([^/]+)\/review$/.exec(p);
  if (m && method === 'POST') {
    const a = state.assignments.find((x) => x._id === m[1]); if (!a) return fail(res, 404, 'NOT_FOUND', 'Not found.'); if (!leaders) return fail(res, 403, 'FORBIDDEN', 'No.');
    if (a.status !== 'submitted') return fail(res, 409, 'NOT_SUBMITTED', 'Only a submitted translation can be reviewed.');
    if (b.decision === 'revise' && !String(b.feedback || '').trim()) return fail(res, 400, 'VALIDATION_ERROR', 'Explain what needs correcting before requesting a revision.');
    a.status = b.decision === 'approve' ? 'reviewed' : 'revision_requested'; a.reviewedAt = now(); a.reviewFeedback = b.decision === 'revise' ? b.feedback.trim() : '';
    return ok(res, { id: a._id, status: a.status, displayStatus: dto.displayStatusOf(a), reviewFeedback: a.reviewFeedback });
  }

  m = /^\/api\/notebooks\/([^/]+)$/.exec(p);
  if (m && method === 'GET') { const a = state.assignments.find((x) => x.track === m[1] && x.assignee === user._id); if (!a) return fail(res, 404, 'NOT_FOUND', 'That MP3 is no longer available.'); const n = noteFor(user._id, m[1]); return ok(res, { trackId: m[1], text: n?.text || '', status: a.status, locked: LOCKED.has(a.status), reviewFeedback: a.reviewFeedback || '', version: n?.version || 0, history: n?.history || [] }); }
  if (m && method === 'PUT') {
    const asg = state.assignments.find((a) => a.track === m[1] && a.assignee === user._id); if (!asg) return fail(res, 404, 'NOT_FOUND', 'That MP3 is no longer available.');
    if (LOCKED.has(asg.status)) return fail(res, 409, 'TRANSLATION_LOCKED', 'This translation has already been submitted and cannot be edited.');
    let n = noteFor(user._id, m[1]); if (!n) { n = { user: user._id, track: m[1], version: 0, history: [] }; state.notes.push(n); }
    n.text = String(b.text || '').trim(); n.updatedAt = now();
    if (asg.status === 'assigned' && n.text) asg.status = 'in_progress';
    return ok(res, { trackId: m[1], text: n.text, status: asg.status });
  }
  return fail(res, 404, 'NOT_FOUND', 'Route not found.');
}

const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.html': 'text/html' };
const INDEX = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Zentrix Pulse · Zentrix</title><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>`;
http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname === '/__reset') { seed(); state.sessions.clear(); state.mustChange.clear(); state.recovery.clear(); state.challenges.clear(); return send(res, 200, { ok: true }); }
    if (url.pathname === '/__state') return send(res, 200, { users: state.users.length, tasks: state.tasks.length, packages: state.packages.length, chat: state.chat.length, tracks: state.tracks.length, assignments: state.assignments.length, mustChange: [...state.mustChange], pw: Object.fromEntries(state.pw) });
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (url.pathname === '/app.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(fs.readFileSync(`${DIST}/app.js`)); }
    if (url.pathname === '/styles.css') { res.writeHead(200, { 'Content-Type': 'text/css' }); return res.end(fs.readFileSync(CSS)); }
    if (url.pathname.startsWith('/assets/')) { const f = path.join(PUBLIC, url.pathname); if (fs.existsSync(f)) { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(fs.readFileSync(f)); } }
    res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(INDEX);
  } catch (e) { console.error('MOCK ERROR', e); send(res, 500, { ok: false, error: { code: 'INTERNAL', message: String(e.message) } }); }
}).listen(PORT, '127.0.0.1', () => console.log('mock on', PORT));
