import config from '../config';

// Thin fetch wrapper for the Pulse API contract (see server/docs/API.md).
const BASE = config.apiUrl;


export class ApiError extends Error {
  constructor(status, code, message, details) { super(message); this.status = status; this.code = code; this.details = details; }
}

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

async function request(method, path, body, { raw = false } = {}) {
  const headers = { 'X-Pulse-Client': '1' };            // CSRF header required on every state-changing call
  let payload;
  if (body !== undefined && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(BASE + path, { method, headers, body: payload ?? body, credentials: 'include' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    const e = json.error || {};
    const err = new ApiError(res.status, e.code || 'ERROR', e.message || 'Request failed', e.details);
    if (res.status === 401 && e.code === 'UNAUTHENTICATED' && !path.startsWith('/api/auth/login')) onUnauthorized(err);
    throw err;
  }
  return raw ? json : json.data;
}
export const get = (p) => request('GET', p);
export const getPage = (p) => request('GET', p, undefined, { raw: true });      // { data, meta }
export const post = (p, b) => request('POST', p, b ?? {});
export const put = (p, b) => request('PUT', p, b ?? {});
export const patch = (p, b) => request('PATCH', p, b ?? {});
export const del = (p) => request('DELETE', p);
export const qs = (o) => { const p = new URLSearchParams(); Object.entries(o || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, v); }); const s = p.toString(); return s ? `?${s}` : ''; };

/** Upload one file with byte progress (XHR gives upload progress events; fetch does not). */
export function uploadTracks(projectId, files, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    files.forEach((f) => form.append('files', f, f.name));
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}/api/projects/${projectId}/tracks`);
    xhr.withCredentials = true;
    xhr.setRequestHeader('X-Pulse-Client', '1');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
    xhr.onload = () => {
      let json = {}; try { json = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300 && json.ok !== false) resolve(json.data);
      else { const e = json.error || {}; reject(new ApiError(xhr.status, e.code || 'UPLOAD_ERROR', e.message || 'Upload failed', e.details)); }
    };
    xhr.onerror = () => reject(new ApiError(0, 'NETWORK', 'Network error during upload.'));
    xhr.send(form);
  });
}
export const audioUrl = (track) => BASE + (track.streamUrl || `/api/audio/${track.id}/stream`);
