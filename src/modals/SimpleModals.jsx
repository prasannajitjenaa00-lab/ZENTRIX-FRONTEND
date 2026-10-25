import { useState } from 'react';
import { audioApi, packagesApi, usersApi } from '../services';
import { audioUrl } from '../services/api';
import { useLive } from '../contexts/LiveContext';
import { useToast } from '../contexts/ToastContext';
import { useResource } from '../hooks/useResource';
import { fmtDateTime } from '../utils/format';

const RATE_PRESETS = [150, 200, 250, 300, 400, 500];

export function PackageModal({ pkg, close }) {
  const toast = useToast(); const { refresh } = useLive();
  const initialRate = pkg?.ratePerHour ?? pkg?.amount ?? 200;
  const [f, setF] = useState({
    name: pkg?.name || (pkg ? '' : '₹200/hr Package'),
    amount: initialRate,
    currency: pkg?.currency || '₹',
    note: pkg?.note || (pkg ? '' : '₹200 per hour income')
  });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const selectRate = (rate) => {
    setF((prev) => ({
      ...prev,
      amount: rate,
      name: !prev.name || prev.name.includes('/hr') ? `${prev.currency || '₹'}${rate}/hr Package` : prev.name,
      note: !prev.note || prev.note.includes('per hour') ? `${prev.currency || '₹'}${rate} per hour income` : prev.note
    }));
  };

  const save = async () => {
    if (!f.name.trim()) return toast('Package name is required.');
    const hourlyIncome = Number(f.amount) || 0;
    const body = {
      name: f.name.trim(),
      amount: hourlyIncome,
      ratePerHour: hourlyIncome,
      currency: f.currency.trim() || '₹',
      note: f.note.trim()
    };
    try {
      if (pkg) await packagesApi.update(pkg.id, body);
      else await packagesApi.create(body);
      refresh();
      close();
      toast(pkg ? 'Package updated.' : 'Package created.');
    } catch (ex) {
      setError(ex.details ? Object.values(ex.details).join(' ') : ex.message);
    }
  };

  const currentRate = Number(f.amount) || 0;

  return (
    <>
      <h3>{pkg ? 'Edit package' : 'Create package'}</h3>
      {error && <div className="auth-error" role="alert">{error}</div>}

      <div className="field">
        <label htmlFor="pkg-name">Package name</label>
        <input id="pkg-name" value={f.name} onChange={set('name')} placeholder="e.g. ₹200/hr Package, Silver, Gold" />
      </div>

      {/* Select Per Hour Income Section */}
      <div className="field" style={{ marginBottom: 8 }}>
        <label htmlFor="pkg-preset-select">
          Select per hour income
          <span style={{ color: '#10b981', fontWeight: 600, marginLeft: 8 }}>
            (Active: {f.currency || '₹'} {currentRate} / hour)
          </span>
        </label>
        <select
          id="pkg-preset-select"
          value={RATE_PRESETS.includes(currentRate) ? currentRate : 'custom'}
          onChange={(e) => {
            const v = e.target.value;
            if (v !== 'custom') selectRate(Number(v));
          }}
        >
          <option value="custom">-- Select hourly rate or enter below --</option>
          {RATE_PRESETS.map((r) => (
            <option key={r} value={r}>
              {f.currency || '₹'} {r} / hour {r === 200 ? '(Popular)' : r === 300 ? '(Recommended)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Quick Select Buttons */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {RATE_PRESETS.map((rate) => {
          const isSelected = currentRate === rate;
          return (
            <button
              key={rate}
              type="button"
              className={`btn btn-xs ${isSelected ? 'btn-lime' : 'btn-ghost'}`}
              style={{
                borderRadius: 16,
                padding: '4px 12px',
                fontSize: 12,
                fontWeight: isSelected ? 700 : 500,
                border: isSelected ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.12)',
                background: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.03)',
                color: isSelected ? '#10b981' : 'var(--text)'
              }}
              onClick={() => selectRate(rate)}
            >
              {f.currency || '₹'}{rate}/hr
            </button>
          );
        })}
      </div>

      <div className="row-2">
        <div className="field">
          <label htmlFor="pkg-amount">Per hour income ({f.currency || '₹'}/hr)</label>
          <input
            id="pkg-amount"
            type="number"
            min="0"
            step="10"
            value={f.amount}
            onChange={set('amount')}
            placeholder="e.g. 200, 300"
          />
        </div>
        <div className="field">
          <label htmlFor="pkg-currency">Currency symbol</label>
          <input id="pkg-currency" value={f.currency} onChange={set('currency')} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="pkg-note">Note</label>
        <input
          id="pkg-note"
          value={f.note}
          onChange={set('note')}
          placeholder="e.g. ₹200 per hour income for audio transcription"
        />
      </div>

      <div className="modal-actions">
        <button className="btn btn-ghost btn-sm" id="close-m" onClick={close}>Cancel</button>
        <button className="btn btn-lime btn-sm" id="save-pkg" onClick={save}>Save package</button>
      </div>
    </>
  );
}

export function ProjectModal({ close, onCreated }) {
  const toast = useToast(); const { refresh } = useLive();
  const [name, setName] = useState(''); const [desc, setDesc] = useState('');
  const save = async () => {
    if (!name.trim()) return toast('Name the project section.');
    try { const p = await audioApi.createProject({ name: name.trim(), description: desc.trim() }); refresh(); onCreated?.(p); close(); } catch (ex) { toast(ex.message); }
  };
  return (
    <>
      <h3>New project section</h3>
      <div className="field"><label htmlFor="pr-name">Project name</label><input id="pr-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="September listening set" /></div>
      <div className="field"><label htmlFor="pr-desc">Brief</label><textarea id="pr-desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What should employees transcribe?" /></div>
      <div className="modal-actions"><button className="btn btn-ghost btn-sm" id="close-m" onClick={close}>Cancel</button><button className="btn btn-lime btn-sm" id="save-m" onClick={save}>Create project</button></div>
    </>
  );
}

/** Recovery codes are shown exactly once — the server stores only hashes. */
export function RecoveryCodesModal({ codes, close }) {
  return (
    <>
      <h3>Your recovery codes</h3>
      <p className="hint">Save these now. Each works once, and they will not be shown again.</p>
      <div id="p-recovery" className="inbox-panel">{codes.map((c) => <code key={c}>{c}</code>)}</div>
      <div className="modal-actions"><button className="btn btn-lime btn-sm" id="close-m" onClick={close}>I’ve saved them</button></div>
    </>
  );
}

/** Play an assigned track and write notes (employee). Playback is authorised server-side and streamed with Range support. */
export function Mp3NotebookModal({ item, close }) {
  const toast = useToast(); const { refresh } = useLive();
  const [text, setText] = useState(item.notes || '');
  const save = async () => { try { await audioApi.saveNote(item.track.id, text); refresh(); close(); toast('Notebook saved.'); } catch (ex) { toast(ex.message); } };
  return (
    <>
      <h3>{item.track.originalName}</h3>
      <p className="hint" style={{ margin: '-6px 0 12px' }}>{item.projectName} · play the audio and write your notes</p>
      <audio id="mp3-player" controls autoPlay preload="metadata" src={audioUrl(item.track)} style={{ width: '100%', marginBottom: 12 }} />
      <div className="field"><label htmlFor="mp3-note">Notebook</label><textarea id="mp3-note" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write everything as the audio plays…" /></div>
      <div className="modal-actions"><button className="btn btn-ghost btn-sm" id="close-m" onClick={close}>Close</button><button className="btn btn-lime btn-sm" id="save-mp3-note" onClick={save}>Save notes</button></div>
    </>
  );
}

/** Admin/leader: play the audio, read the (submitted) translation, approve or request a revision; reassign/remove pre-submission. */
export function AssignmentReviewModal({ row, close, onChanged }) {
  const toast = useToast(); const { refresh } = useLive();
  const [feedback, setFeedback] = useState(''); const [busy, setBusy] = useState(false);
  const [reassignTo, setReassignTo] = useState('');
  const people = useResource(() => usersApi.assignable(), [row.id], { live: false });
  const locked = ['submitted', 'reviewed'].includes(row.status);
  const canReview = row.status === 'submitted';

  const after = () => { refresh(); onChanged?.(); close(); };
  const review = async (decision) => {
    if (decision === 'revise' && !feedback.trim()) return toast('Explain what needs correcting.');
    setBusy(true);
    try { await audioApi.review(row.id, decision, feedback.trim()); toast(decision === 'approve' ? 'Translation approved.' : 'Revision requested.'); after(); }
    catch (ex) { toast(ex.message); } finally { setBusy(false); }
  };
  const reassign = async () => {
    if (!reassignTo) return toast('Choose an employee.');
    setBusy(true);
    try { await audioApi.reassign(row.id, reassignTo); toast('Reassigned.'); after(); }
    catch (ex) { toast(ex.message); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await audioApi.removeAssignment(row.id); toast('Assignment removed.'); after(); }
    catch (ex) { toast(ex.message); } finally { setBusy(false); }
  };

  return (
    <>
      <h3>{row.track?.originalName || 'Audio assignment'}</h3>
      <p className="hint" style={{ margin: '-6px 0 12px' }}>{row.employeeName} · <span className={`badge st-${row.displayStatus}`}>{row.displayStatus}</span></p>
      {row.track && <audio controls preload="metadata" src={audioUrl(row.track)} style={{ width: '100%', marginBottom: 12 }} />}
      <div className="field">
        <label>{locked ? 'Submitted translation' : 'Current draft'}</label>
        <textarea rows={8} readOnly value={(locked ? row.submittedText : row.text) || '(nothing written yet)'} />
      </div>
      {row.reviewFeedback && <p className="hint">Previous feedback: {row.reviewFeedback}</p>}

      {canReview && (
        <div className="field">
          <label htmlFor="review-feedback">Feedback (required to request a revision)</label>
          <textarea id="review-feedback" rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="What needs correcting?" />
        </div>
      )}
      <div className="modal-actions">
        <button className="btn btn-ghost btn-sm" onClick={close}>Close</button>
        {canReview && <button className="btn btn-ghost btn-sm" data-revise disabled={busy} onClick={() => review('revise')}>Request revision</button>}
        {canReview && <button className="btn btn-lime btn-sm" data-approve disabled={busy} onClick={() => review('approve')}>Approve</button>}
      </div>

      {!locked && (
        <>
          <h3 style={{ marginTop: 18 }}>Reassign</h3>
          <div className="field">
            <select value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
              <option value="">Choose an employee…</option>
              {people.data?.filter((e) => e.id !== row.employeeId).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost btn-sm" data-remove-assignment disabled={busy} onClick={remove}>Remove assignment</button>
            <button className="btn btn-primary btn-sm" data-reassign disabled={busy || !reassignTo} onClick={reassign}>Reassign</button>
          </div>
        </>
      )}
      {row.submittedAt && <p className="hint" style={{ marginTop: 10 }}>Submitted {fmtDateTime(row.submittedAt)}{row.reviewedAt ? ` · reviewed ${fmtDateTime(row.reviewedAt)}` : ''}</p>}
    </>
  );
}
