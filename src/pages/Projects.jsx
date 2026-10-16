import { useRef, useState } from 'react';
import { audioApi, usersApi } from '../services';
import { audioUrl, uploadTracks } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useLive } from '../contexts/LiveContext';
import { useModal } from '../contexts/ModalContext';
import { useNav } from '../contexts/NavContext';
import { useToast } from '../contexts/ToastContext';
import { useHeader } from '../layouts/HeaderContext';
import { useResource } from '../hooks/useResource';
import { useRoster } from '../hooks/useRoster';
import { Page, Resource } from '../components/Page';
import { ProjectModal } from '../modals/SimpleModals';
import { MAX_PROJECT_UPLOAD, fmtDate, fmtDateTime, fmtDuration, can } from '../utils/format';

const LOCKED_STATUSES = new Set(['submitted', 'reviewed']);

import AssignedAudio from './AssignedAudio';

export const NotebookView = AssignedAudio;

export function ProjectsView() {
  const { user } = useAuth(); const nav = useNav(); const { open } = useModal(); const toast = useToast(); const { refresh } = useLive(); const roster = useRoster();
  const isAdmin = can.uploadProjects(user);
  useHeader('Projects', isAdmin ? 'Upload up to 100 MP3 files into a project, then assign them to employees' : 'Audio assigned across your floor or team');
  const projects = useResource(() => audioApi.projects(), [user.id]);
  const focus = nav.projectId || projects.data?.[0]?.id || '';
  const tracks = useResource(() => (focus ? audioApi.tracks(focus) : Promise.resolve([])), [focus]);
  const people = useResource(() => usersApi.assignable(), [user.id], { live: false });
  const fileRef = useRef(null); const [status, setStatus] = useState(''); const [busy, setBusy] = useState(false);
  const [pickedTracks, setPickedTracks] = useState(new Set()); const [pickedEmps, setPickedEmps] = useState(new Set()); const [deadline, setDeadline] = useState('');
  const toggle = (set, setter, id) => { const n = new Set(set); n.has(id) ? n.delete(id) : n.add(id); setter(n); };

  const upload = async () => {
    const files = [...(fileRef.current?.files || [])];
    if (!files.length) return toast('Choose MP3 files first.');
    if (files.length > MAX_PROJECT_UPLOAD) return toast(`Maximum ${MAX_PROJECT_UPLOAD} MP3 files at a time.`);
    if (files.some((f) => !/\.mp3$/i.test(f.name) && !/audio\/(mpeg|mp3)/i.test(f.type || ''))) return toast('Choose MP3 files.');
    setBusy(true); setStatus(`Uploading ${files.length} file${files.length === 1 ? '' : 's'}…`);
    // The whole selection goes up as one request: the 100-file cap is enforced on this single batch, not per-request.
    try {
      const out = await uploadTracks(focus, files, (p) => setStatus(`Uploading ${files.length} file${files.length === 1 ? '' : 's'} (${Math.round(p * 100)}%)`));
      const ok = out.tracks.length; const rejected = out.rejected || [];
      setStatus(rejected.length ? `${ok} uploaded · ${rejected.length} rejected: ${rejected.map((r) => `${r.name} (${r.reason})`).join('; ')}` : '');
      if (ok) toast(`Uploaded ${ok} file${ok === 1 ? '' : 's'}.`); else toast('No files were uploaded.');
    } catch (ex) { setStatus(ex.details?.rejected?.length ? `Rejected: ${ex.details.rejected.map((r) => `${r.name} (${r.reason})`).join('; ')}` : ''); toast(ex.message); }
    setBusy(false); if (fileRef.current) fileRef.current.value = '';
    refresh();
  };
  const assign = async () => {
    if (!pickedTracks.size) return toast('Select at least one MP3.');
    if (!pickedEmps.size) return toast('Select at least one employee.');
    try { const out = await audioApi.assign([...pickedTracks], [...pickedEmps], deadline ? new Date(deadline).toISOString() : undefined); toast(out.added ? `Assigned ${out.added} listening jobs.` : 'Those tracks were already assigned.'); refresh(); }   // selection is kept after assigning, as in the original
    catch (ex) { toast(ex.message); }
  };

  return (
    <Resource res={projects}>{(plist) => {
      const project = plist.find((p) => p.id === focus) || null;
      return (
        <Page>
          <div className="toolbar">
            {isAdmin && <button className="btn btn-lime btn-sm" id="new-project" onClick={() => open(({ close }) => <ProjectModal close={close} onCreated={(p) => nav.patch({ projectId: p.id })} />)}>New project</button>}
            <span className="hint-inline">{plist.length} project{plist.length === 1 ? '' : 's'} · {plist.reduce((n, p) => n + (p.trackCount || 0), 0)} tracks</span>
          </div>
          <div className="grid-2">
            <section className="panel">
              <h3>Project sections</h3>
              {plist.length ? plist.map((p) => (
                <div key={p.id} className={`list-item kpi-link ${focus === p.id ? 'on-project' : ''}`} data-project={p.id} onClick={() => nav.patch({ projectId: p.id })}>
                  <div><strong>{p.name}</strong><div style={{ color: 'var(--muted)', fontSize: 12 }}>{p.trackCount} MP3 · {p.description || 'Audio listening project'}</div></div><span className="badge st-In Progress">{p.trackCount}</span></div>))
                : <div className="empty">No projects yet. Admin creates a section first.</div>}
            </section>
            <section className="panel">
              <h3>{project ? project.name : 'Select a project'}</h3>
              {project && isAdmin && (
                <div className="upload-drop" id="mp3-drop">
                  <input id="mp3-files" ref={fileRef} type="file" accept=".mp3,audio/mpeg" multiple />
                  <strong>Drop or choose up to {MAX_PROJECT_UPLOAD} MP3 files</strong>
                  <div className="muted">Files land in this project section, then you assign them to employees.</div>
                  <button type="button" className="btn btn-primary btn-sm" id="mp3-upload" style={{ width: 'auto', marginTop: 10 }} disabled={busy} onClick={upload}>Upload selected</button>
                  <div className="hint-inline" id="mp3-status">{status}</div>
                </div>)}
              {project ? (
                <>
                  <div className="track-list" id="track-list">
                    {tracks.data?.length ? tracks.data.map((t) => (
                      <article className="track-row" key={t.id}>
                        <label className="track-check"><input type="checkbox" data-track={t.id} checked={pickedTracks.has(t.id)} onChange={() => toggle(pickedTracks, setPickedTracks, t.id)} /> {t.originalName}</label>
                        <audio controls preload="none" src={audioUrl(t)} />
                        <div className="muted">{t.assignedCount} assigned · {fmtDuration(t.duration)} · {Math.round((t.size || 0) / 1024)} KB</div>
                      </article>)) : <div className="empty">No MP3 files in this project yet.</div>}
                  </div>
                  <div className="assign-box">
                    <h4>Assign selected MP3s to employees</h4>
                    <div className="chip-list" id="emp-chips">
                      {people.data?.length ? people.data.map((e) => (
                        <label className="emp-chip" key={e.id}><input type="checkbox" data-emp={e.id} checked={pickedEmps.has(e.id)} onChange={() => toggle(pickedEmps, setPickedEmps, e.id)} /> {e.name} <small>TL {roster.name(e.leaderId) || '—'}</small></label>))
                        : <div className="empty">No employees in your scope.</div>}
                    </div>
                    <div className="field" style={{ marginTop: 10, maxWidth: 260 }}>
                      <label htmlFor="assign-deadline">Deadline (optional)</label>
                      <input id="assign-deadline" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                    </div>
                    <button type="button" className="btn btn-lime btn-sm" id="assign-tracks" style={{ width: 'auto', marginTop: 10 }} onClick={assign}>Assign to selected employees</button>
                  </div>
                </>) : <div className="empty">Create or select a project to manage audio.</div>}
            </section>
          </div>
        </Page>);
    }}</Resource>
  );
}

export default function Projects() { const { user } = useAuth(); return user.role === 'employee' ? <NotebookView /> : <ProjectsView />; }
