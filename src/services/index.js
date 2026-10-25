import { get, getPage, post, put, patch, del, qs } from './api';

export const authApi = {
  login: (email, password) => post('/api/auth/login', { email, password }),
  verifyMfa: (challengeId, code, trust) => post('/api/auth/mfa/verify', { challengeId, code, trust }),
  resendMfa: (challengeId) => post('/api/auth/mfa/resend', { challengeId }),
  forgot: (email) => post('/api/auth/forgot', { email }),
  resetVerify: (token) => post('/api/auth/reset/verify', { token }),
  reset: (token, password) => post('/api/auth/reset', { token, password }),
  me: () => get('/api/auth/me'),
  logout: () => post('/api/auth/logout'),
  changePassword: (currentPassword, newPassword) => post('/api/auth/password', { currentPassword, newPassword }),
};
export const usersApi = {
  list: (q) => getPage(`/api/users${qs({ limit: 500, includeBank: 1, ...q })}`),
  crew: () => get('/api/users/crew'),
  assignable: () => get('/api/users/assignable'),
  leaders: () => get('/api/users/leaders'),
  create: (b) => post('/api/users', b),
  update: (id, b) => patch(`/api/users/${id}`, b),
  setStatus: (id, status) => post(`/api/users/${id}/status`, { status }),
  updateMe: (b) => patch('/api/users/me', b),
  myBank: () => get('/api/users/me/bank'),
  saveMyBank: (b) => put('/api/users/me/bank', b),
  updateBank: (id, b) => patch(`/api/users/${id}/bank`, b),
};
export const walletApi = { me: () => get('/api/wallet/me') };
export const withdrawApi = {
  me: () => get('/api/withdrawals/me'),
  request: (b) => post('/api/withdrawals', b),
  list: (q) => get(`/api/withdrawals${qs(q)}`),
  updateStatus: (id, b) => patch(`/api/withdrawals/${id}`, b),
};
export const tasksApi = {
  list: (q) => getPage(`/api/tasks${qs({ limit: 500, ...q })}`),
  calendar: (month, assignee) => get(`/api/tasks/calendar${qs({ month, assignee })}`),
  create: (b) => post('/api/tasks', b),
  updateStatus: (id, b) => patch(`/api/tasks/${id}/status`, b),
  update: (id, b) => patch(`/api/tasks/${id}`, b),
  remove: (id) => del(`/api/tasks/${id}`),
};
export const dashApi = { overview: () => get('/api/dashboard'), mine: () => get('/api/dashboard/me') };
export const packagesApi = {
  list: () => get('/api/packages'), create: (b) => post('/api/packages', b), update: (id, b) => patch(`/api/packages/${id}`, b), remove: (id) => del(`/api/packages/${id}`),
};
export const chatApi = { list: () => get('/api/chat'), post: (text) => post('/api/chat', { text }) };
export const mfaApi = { recoveryCodes: () => post('/api/mfa/recovery-codes'), clearDevices: () => del('/api/devices') };
export const audioApi = {
  projects: () => get('/api/projects'), createProject: (b) => post('/api/projects', b), tracks: (id) => get(`/api/projects/${id}/tracks`),
  allTracks: () => get('/api/audio/all-tracks'),
  deleteTrack: (id) => del(`/api/audio/tracks/${id}`),
  assign: (trackIds, assigneeIds, deadline) => post('/api/audio/assign', { trackIds, assigneeIds, ...(deadline ? { deadline } : {}) }),
  assigned: () => get('/api/audio/assigned'),
  saveNote: (trackId, text, listenedSeconds) => put(`/api/notebooks/${trackId}`, { text, ...(listenedSeconds != null ? { listenedSeconds } : {}) }),
  getNote: (trackId) => get(`/api/notebooks/${trackId}`),
  assignments: (q) => getPage(`/api/audio/assignments${qs(q)}`),
  assignmentDetail: (id) => get(`/api/audio/assignments/${id}`),
  reassign: (id, assigneeId) => patch(`/api/audio/assignments/${id}/reassign`, { assigneeId }),
  removeAssignment: (id) => del(`/api/audio/assignments/${id}`),
  submit: (id) => post(`/api/audio/assignments/${id}/submit`),
  review: (id, decision, feedback) => post(`/api/audio/assignments/${id}/review`, { decision, feedback }),
};
