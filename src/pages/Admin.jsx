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

export function PackagesView() {
  const { user } = useAuth(); const nav = useNav(); const { open } = useModal(); const toast = useToast(); const { refresh } = useLive();
  useHeader('Packages', 'Create packages that appear as wallets for employees');
  useEffect(() => { if (user.role !== 'admin') nav.go('dashboard'); }, [user, nav]);
  const res = useResource(() => packagesApi.list(), [user.id]);
  const del = async (p) => { if (!window.confirm('Delete this package?')) return; try { await packagesApi.remove(p.id); refresh(); toast('Package deleted.'); } catch (ex) { toast(ex.message); } };
  return (
    <Resource res={res}>{(pkgs) => (
      <Page>
        <div className="toolbar"><button className="btn btn-lime btn-sm" id="new-package" onClick={() => open(({ close }) => <PackageModal close={close} />)}>Create package</button></div>
        {pkgs.length ? pkgs.map((p) => (
          <section className="panel" style={{ marginBottom: 10 }} key={p.id}>
            <div className="list-item" style={{ border: 0, padding: 0 }}>
              <div><strong>{p.name}</strong><div style={{ color: 'var(--muted)', fontSize: 12 }}>{money(p.currency, p.amount)} · {p.note}</div></div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => open(({ close }) => <PackageModal pkg={p} close={close} />)}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => del(p)}>Delete</button>
              </div>
            </div>
          </section>)) : <div className="empty">No packages yet. Create one.</div>}
      </Page>)}
    </Resource>
  );
}

export function PeopleView() {
  const { user } = useAuth(); const nav = useNav(); const { open } = useModal(); const toast = useToast(); const { refresh } = useLive();
  useHeader('Accounts studio', 'Floor managers sit above team leaders. Every employee must report to a team leader.');
  useEffect(() => { if (user.role !== 'admin') nav.go('dashboard'); }, [user, nav]);
  const users = useResource(async () => (await usersApi.list()).data, [user.id]);
  const pkgs = useResource(() => packagesApi.list(), [user.id]);
  const tasks = useResource(async () => (await tasksApi.list()).data, [user.id]);
  const toggle = async (p) => { try { await usersApi.setStatus(p.id, p.status === 'Active' ? 'Suspended' : 'Active'); refresh(); } catch (ex) { toast(ex.message); } };
  return (
    <Resource res={users}>{(list) => {
      const byId = new Map(list.map((p) => [p.id, p])); const pkgName = (id) => (pkgs.data || []).find((p) => p.id === id)?.name || 'No package';
      const all = tasks.data || [];
      const orgLine = (p) => {
        if (p.role === 'employee') return `Reporting: ${byId.get(p.leaderId)?.name || 'Direct (Admin)'} · Package: ${pkgName(p.packageId)}`;
        if (p.role === 'team_leader') return `Floor manager: ${byId.get(p.floorId)?.name || '—'} · ${list.filter((u) => u.role === 'employee' && u.leaderId === p.id && u.status === 'Active').length} employees`;
        if (p.role === 'floor_manager') return `${list.filter((u) => u.role === 'team_leader' && u.floorId === p.id && u.status === 'Active').length} team leaders · ${list.filter((u) => u.role === 'employee' && u.floorId === p.id && u.status === 'Active').length} employees`;
        const mine = all.filter((t) => t.assigneeId === p.id); return `${mine.length} tasks · ${mine.filter((t) => t.status !== 'Completed').length} open`;
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
