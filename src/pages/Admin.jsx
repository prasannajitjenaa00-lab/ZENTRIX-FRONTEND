import { useEffect, useRef, useState } from 'react';
import { chatApi, packagesApi, tasksApi, usersApi } from '../services';
import { useAuth } from '../contexts/AuthContext';
import { useLive } from '../contexts/LiveContext';
import { useModal } from '../contexts/ModalContext';
import { useNav } from '../contexts/NavContext';
import { useToast } from '../contexts/ToastContext';
import { useHeader } from '../layouts/HeaderContext';
import { useResource } from '../hooks/useResource';
import Avatar from '../components/Avatar';
import { Page, Resource } from '../components/Page';
import PersonModal from '../modals/PersonModal';
import { PackageModal } from '../modals/SimpleModals';
import { fmtDate, fmtDateTime, initials, money, roleLabel } from '../utils/format';

export { PackagesView } from './Packages';

export function PeopleView() {
  const { user } = useAuth(); const nav = useNav(); const { open } = useModal(); const toast = useToast(); const { refresh } = useLive();
  useHeader('Accounts studio', 'Manage Admin and Employee accounts and credentials.');
  // accessible
  const users = useResource(async () => (await usersApi.list()).data, [user.id]);
  const pkgs = useResource(() => packagesApi.list(), [user.id]);
  const toggle = async (p) => { try { await usersApi.setStatus(p.id, p.status === 'Active' ? 'Suspended' : 'Active'); refresh(); } catch (ex) { toast(ex.message); } };
  return (
    <Resource res={users}>{(list) => {
      const pkgName = (id) => (pkgs.data || []).find((p) => p.id === id)?.name || 'No package';
      const orgLine = (p) => {
        if (p.role === 'employee') return `Package: ${pkgName(p.packageId)}`;
        return 'System Administrator';
      };
      return (
        <Page>
          <div className="toolbar"><button className="btn btn-lime btn-sm" id="new-person" onClick={() => open(({ close }) => <PersonModal close={close} />)}>Create account</button></div>
          {list.map((p) => {
            const b = p.bankDetails;
            return (
              <section className="panel" style={{ marginBottom: 10 }} key={p.id}>
                <div className="list-item" style={{ border: 0, padding: 0 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <Avatar name={p.name} admin={p.role === 'admin'} />
                    <div>
                      <strong>{p.name}</strong><div style={{ color: 'var(--muted)', fontSize: 12 }}>{roleLabel(p.role)} · {p.email}</div>
                      <div style={{ color: 'var(--soft)', fontSize: 12, marginTop: 4 }}>{orgLine(p)} · joined {fmtDate(p.joined)}</div>
                      <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>{b?.account ? `Bank: ${b.name || '—'} · ${b.holder || ''} · A/c ${b.account} · IFSC ${b.ifsc || ''}${p.bank?.locked ? ' · locked' : ''}` : 'No bank details on file'}</div>
                      <PasswordDisplay userId={p.id} userEmail={p.email} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className={`badge ${p.status === 'Active' ? 'st-Completed' : 'st-On Hold'}`}>{p.status}</span><span className="badge pr-Medium">{roleLabel(p.role)}</span>
                    <button className="btn btn-ghost btn-sm" data-edit={p.id} onClick={() => open(({ close }) => <PersonModal person={p} close={close} />)}>Edit</button>
                    {p.role !== 'admin' && <button className="btn btn-danger btn-sm" data-toggle={p.id} onClick={() => toggle(p)}>{p.status === 'Active' ? 'Suspend' : 'Restore'}</button>}
                  </div>
                </div>
              </section>);
          })}
        </Page>);
    }}</Resource>
  );
}

export function ChatView() {
  const { user } = useAuth(); const { online, subscribe } = useLive(); const toast = useToast();
  useHeader('Studio chat', 'Open thread for the whole Zentrix crew');
  const res = useResource(() => chatApi.list(), [user.id], { live: false });
  const [messages, setMessages] = useState([]); const [text, setText] = useState(''); const stream = useRef(null);
  useEffect(() => { if (res.data) setMessages(res.data); }, [res.data]);
  useEffect(() => subscribe('chat:message', (m) => setMessages((l) => (l.some((x) => x.id === m.id) ? l : [...l, m].slice(-200)))), [subscribe]);
  useEffect(() => { if (stream.current) stream.current.scrollTop = stream.current.scrollHeight; }, [messages]);
  const liveIds = online.map((p) => p.userId); const roleOf = (id) => online.find((p) => p.userId === id)?.role;
  const send = async (e) => {
    e.preventDefault(); const t = text.trim(); if (!t) return;
    try { const m = await chatApi.post(t); setMessages((l) => (l.some((x) => x.id === m.id) ? l : [...l, m])); setText(''); } catch (ex) { toast(ex.message); }
  };
  return (
    <Resource res={res}>{() => (
      <Page>
        <section className="panel chat-panel">
          <div className="chat-meta"><span>{messages.length} messages</span><span>{online.length || 1} on this hub</span></div>
          <div className="chat-stream" id="chat-stream" ref={stream}>
            {messages.length ? messages.map((m) => (
              <article className={`chat-bubble ${m.userId === user.id ? 'mine' : ''}`} key={m.id}>
                <div className="chat-who"><span className={`avatar ${roleOf(m.userId) === 'admin' ? 'admin' : ''}`}>{initials(m.name)}</span><strong>{m.name}</strong>{liveIds.includes(m.userId) && <em className="chat-live">live</em>}<time>{fmtDateTime(m.at)}</time></div>
                <p>{m.text}</p>
              </article>)) : <div className="empty">No messages yet. Start the thread.</div>}
          </div>
          {user.role === 'admin' ? (
            <form className="chat-compose" id="chat-form" onSubmit={send}>
              <input id="chat-input" maxLength={500} placeholder="Write to the studio…" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} />
              <button className="btn btn-primary" type="submit" style={{ width: 'auto', padding: '12px 18px' }}>Send</button>
            </form>) : <div className="hint" style={{ padding: 12, textAlign: 'center' }}>Only admin can send messages in studio chat.</div>}
        </section>
      </Page>)}
    </Resource>
  );
}

/** Admin-only reveal: the current plaintext password is never bulk-loaded with the account list — it's fetched
 *  (and audit-logged server-side) only when admin explicitly clicks Show, and dropped from state on Hide. */
function PasswordDisplay({ userId, userEmail }) {
  const [password, setPassword] = useState(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const { version } = useLive();
  const prevVersion = useRef(version);

  // When a live update arrives (e.g. employee changed password), auto-refresh if revealed
  useEffect(() => {
    if (prevVersion.current === version) return;
    prevVersion.current = version;
    if (password == null) return;
    let cancelled = false;
    (async () => {
      try {
        const { password: pw } = await usersApi.password(userId);
        if (!cancelled) setPassword(pw || '');
      } catch { if (!cancelled) setPassword(null); }
    })();
    return () => { cancelled = true; };
  }, [version, userId, password]);

  const reveal = async () => {
    if (password) { setPassword(null); return; }
    setLoading(true);
    try {
      const { password: pw } = await usersApi.password(userId);
      setPassword(pw || '');
    } catch (ex) { toast(ex.message); } finally { setLoading(false); }
  };
  const copy = async (e) => {
    e.stopPropagation();
    try { await navigator.clipboard.writeText(password); toast(`Password copied for ${userEmail || 'user'}`); }
    catch { toast('Could not copy to clipboard.'); }
  };
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 6, background: 'rgba(255, 255, 255, 0.04)', padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
      <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Password:</span>
      <code style={{ fontSize: 12, fontFamily: 'monospace', letterSpacing: password ? '0' : '2px', color: password ? '#12c2d4' : 'var(--text)' }}>
        {password != null ? (password || '[none set]') : '••••••••'}
      </code>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        style={{ padding: '2px 6px', fontSize: 11, height: 'auto', minHeight: 0 }}
        onClick={(e) => { e.stopPropagation(); reveal(); }}
        disabled={loading}
      >
        {loading ? '…' : password != null ? 'Hide' : 'Show'}
      </button>
      {password ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ padding: '2px 6px', fontSize: 11, height: 'auto', minHeight: 0 }}
          onClick={copy}
          title="Copy real password"
        >
          Copy
        </button>
      ) : null}
    </div>
  );
}

