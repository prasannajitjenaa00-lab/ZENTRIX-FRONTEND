import { useEffect, useMemo, useRef, useState } from 'react';
import { helpApi } from '../services';
import { useAuth } from '../contexts/AuthContext';
import { useLive } from '../contexts/LiveContext';
import { useToast } from '../contexts/ToastContext';
import { useHeader } from '../layouts/HeaderContext';
import { useResource } from '../hooks/useResource';
import { Page, Resource } from '../components/Page';
import Avatar from '../components/Avatar';
import { fmtDateTime, roleLabel } from '../utils/format';

function useHelpMessages(user, subscribe) {
  const res = useResource(() => helpApi.list(), [user.id], { live: false });
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (res.data) setMessages(res.data);
  }, [res.data]);

  useEffect(() => {
    const unsubMsg = subscribe('help:message', (m) => {
      setMessages((prev) => {
        const idx = prev.findIndex((x) => x.id === m.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = m;
          return next;
        }
        return [...prev, m].slice(-250);
      });
    });

    const unsubResolved = subscribe('help:resolved', (m) => {
      setMessages((prev) => {
        const idx = prev.findIndex((x) => x.id === m.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = m;
          return next;
        }
        return prev;
      });
    });

    return () => {
      if (typeof unsubMsg === 'function') unsubMsg();
      if (typeof unsubResolved === 'function') unsubResolved();
    };
  }, [subscribe]);

  return { res, messages, setMessages };
}

/** Admin: Queries Management Panel with Filter, Search & "Mark as Resolved" */
function AdminQueriesView() {
  const { user } = useAuth();
  const { subscribe } = useLive();
  const toast = useToast();
  useHeader('User Queries', 'Manage and resolve user queries submitted by employees');

  const { res, messages, setMessages } = useHelpMessages(user, subscribe);
  const [filter, setFilter] = useState('all'); // 'all' | 'pending' | 'resolved'
  const [search, setSearch] = useState('');
  const [resolvingId, setResolvingId] = useState(null);

  const stats = useMemo(() => {
    const total = messages.length;
    const pending = messages.filter((m) => (m.status || 'pending') === 'pending').length;
    const resolved = messages.filter((m) => m.status === 'resolved').length;
    return { total, pending, resolved };
  }, [messages]);

  const filtered = useMemo(() => {
    const list = [...messages].reverse();
    return list.filter((m) => {
      const status = m.status || 'pending';
      if (filter === 'pending' && status !== 'pending') return false;
      if (filter === 'resolved' && status !== 'resolved') return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const name = (m.name || '').toLowerCase();
        const email = (m.userEmail || '').toLowerCase();
        const text = (m.text || '').toLowerCase();
        return name.includes(q) || email.includes(q) || text.includes(q);
      }
      return true;
    });
  }, [messages, filter, search]);

  const handleMarkResolved = async (id) => {
    try {
      setResolvingId(id);
      const updated = await helpApi.resolve(id);
      setMessages((prev) => prev.map((x) => (x.id === id ? { ...x, ...updated, status: 'resolved' } : x)));
      toast('Query marked as resolved!', 'success');
    } catch (err) {
      toast(err.message || 'Failed to resolve query');
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <Resource res={res}>{() => (
      <Page>
        {/* Top Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div className="panel" style={{ padding: '18px 20px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 500 }}>Total Queries</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', marginTop: 6 }}>{stats.total}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>All incoming messages</div>
          </div>
          <div className="panel" style={{ padding: '18px 20px', borderRadius: 14, background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
            <div style={{ color: '#f59e0b', fontSize: 13, fontWeight: 600 }}>Pending Queries</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b', marginTop: 6 }}>{stats.pending}</div>
            <div style={{ fontSize: 12, color: 'rgba(245, 158, 11, 0.8)', marginTop: 4 }}>Needs admin review</div>
          </div>
          <div className="panel" style={{ padding: '18px 20px', borderRadius: 14, background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <div style={{ color: '#10b981', fontSize: 13, fontWeight: 600 }}>Resolved Queries</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#10b981', marginTop: 6 }}>{stats.resolved}</div>
            <div style={{ fontSize: 12, color: 'rgba(16, 185, 129, 0.8)', marginTop: 4 }}>Marked as completed</div>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 8, background: 'rgba(255,255,255,0.04)', padding: 4, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              type="button"
              onClick={() => setFilter('all')}
              style={{
                background: filter === 'all' ? 'var(--primary, #0e9384)' : 'transparent',
                color: filter === 'all' ? '#fff' : 'var(--muted)',
                border: 0, padding: '6px 14px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease'
              }}
            >
              All ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setFilter('pending')}
              style={{
                background: filter === 'pending' ? '#d97706' : 'transparent',
                color: filter === 'pending' ? '#fff' : 'var(--muted)',
                border: 0, padding: '6px 14px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease'
              }}
            >
              ⏳ Pending ({stats.pending})
            </button>
            <button
              type="button"
              onClick={() => setFilter('resolved')}
              style={{
                background: filter === 'resolved' ? '#059669' : 'transparent',
                color: filter === 'resolved' ? '#fff' : 'var(--muted)',
                border: 0, padding: '6px 14px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease'
              }}
            >
              ✓ Resolved ({stats.resolved})
            </button>
          </div>

          <div style={{ position: 'relative', minWidth: 260 }}>
            <input
              type="text"
              placeholder="Search user, email or query..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 14px 9px 34px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                color: 'var(--text)',
                fontSize: 13,
                outline: 'none',
              }}
            />
            <svg style={{ position: 'absolute', left: 10, top: 11, color: 'var(--muted)' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
        </div>

        {/* Queries List */}
        {filtered.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filtered.map((m) => {
              const isResolved = m.status === 'resolved';
              return (
                <div
                  key={m.id}
                  className="panel"
                  style={{
                    padding: '18px 20px',
                    borderRadius: 14,
                    background: isResolved ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
                    border: isResolved ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(245, 158, 11, 0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    boxShadow: isResolved ? 'none' : '0 2px 12px rgba(245, 158, 11, 0.05)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <Avatar name={m.name} admin={m.role === 'admin'} />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: 15, color: 'var(--text)' }}>{m.name}</strong>
                          {m.userEmail && (
                            <span style={{ fontSize: 12, color: 'var(--muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 4 }}>
                              {m.userEmail}
                            </span>
                          )}
                          {m.userCode && (
                            <span style={{ fontSize: 12, color: 'var(--muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 4 }}>
                              ID: {m.userCode}
                            </span>
                          )}
                        </div>
                        <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 3 }}>
                          {roleLabel(m.role)} · Submitted on {fmtDateTime(m.at)}
                        </div>
                      </div>
                    </div>

                    {/* Status & Action */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {isResolved ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '5px 12px',
                              borderRadius: 20,
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#10b981',
                              fontSize: 12.5,
                              fontWeight: 600,
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                            }}
                          >
                            ✓ Resolved
                          </span>
                          {m.resolvedAt && (
                            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                              ({fmtDateTime(m.resolvedAt)})
                            </span>
                          )}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '5px 12px',
                              borderRadius: 20,
                              background: 'rgba(245, 158, 11, 0.15)',
                              color: '#f59e0b',
                              fontSize: 12.5,
                              fontWeight: 600,
                              border: '1px solid rgba(245, 158, 11, 0.3)',
                            }}
                          >
                            ⏳ Pending
                          </span>
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={resolvingId === m.id}
                            onClick={() => handleMarkResolved(m.id)}
                            style={{
                              padding: '6px 14px',
                              fontSize: 12.5,
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              background: 'linear-gradient(135deg, #0e9384 0%, #10b981 100%)',
                              border: 'none',
                              borderRadius: 8,
                              color: '#fff',
                              cursor: resolvingId === m.id ? 'not-allowed' : 'pointer',
                              opacity: resolvingId === m.id ? 0.7 : 1,
                              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                            }}
                          >
                            {resolvingId === m.id ? (
                              'Updating...'
                            ) : (
                              <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                                Mark as Resolved
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Query Text Box */}
                  <div
                    style={{
                      background: 'rgba(0,0,0,0.25)',
                      padding: '12px 16px',
                      borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.05)',
                      fontSize: 14,
                      lineHeight: 1.6,
                      color: 'var(--text)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {m.text}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="panel" style={{ padding: 40, textAlign: 'center', borderRadius: 14, color: 'var(--muted)' }}>
            No queries found matching the selected filter.
          </div>
        )}
      </Page>
    )}
    </Resource>
  );
}

/** Employee: Ask a question/query and track resolution status in real time */
function EmployeeHelpThread() {
  const { user } = useAuth();
  const { subscribe } = useLive();
  const toast = useToast();
  useHeader('Help & Queries', 'Submit your queries to admin and track live resolution status');

  const { res, messages, setMessages } = useHelpMessages(user, subscribe);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const stream = useRef(null);

  useEffect(() => {
    if (stream.current) stream.current.scrollTop = stream.current.scrollHeight;
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    try {
      setSubmitting(true);
      const m = await helpApi.post(t);
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      setText('');
      toast('Query submitted to admin successfully!', 'success');
    } catch (ex) {
      toast(ex.message || 'Failed to submit query');
    } finally {
      setSubmitting(false);
    }
  };

  const pendingCount = messages.filter((m) => (m.status || 'pending') === 'pending').length;
  const resolvedCount = messages.filter((m) => m.status === 'resolved').length;

  return (
    <Resource res={res}>{() => (
      <Page>
        {/* Status Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
          <div className="panel" style={{ padding: '16px 20px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>My Submitted Queries</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{messages.length}</div>
          </div>
          <div className="panel" style={{ padding: '16px 20px', borderRadius: 12, background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
            <div style={{ color: '#f59e0b', fontSize: 12.5, fontWeight: 600 }}>Under Review (Pending)</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b', marginTop: 4 }}>{pendingCount}</div>
          </div>
          <div className="panel" style={{ padding: '16px 20px', borderRadius: 12, background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <div style={{ color: '#10b981', fontSize: 12.5, fontWeight: 600 }}>Resolved by Admin</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981', marginTop: 4 }}>{resolvedCount}</div>
          </div>
        </div>

        {/* Query Submission Box */}
        <section className="panel" style={{ padding: '20px 22px', borderRadius: 14, marginBottom: 24, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
            Ask a Question or Submit a Query
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 14px' }}>
            Have a question about your work, payout, or task? Send a query and the admin team will review and resolve it.
          </p>
          <form onSubmit={send}>
            <textarea
              rows={3}
              maxLength={500}
              placeholder="Describe your query or issue in detail..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 10,
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'var(--text)',
                fontSize: 14,
                lineHeight: 1.5,
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                {500 - text.length} characters remaining
              </span>
              <button
                type="submit"
                disabled={!text.trim() || submitting}
                className="btn btn-primary"
                style={{
                  padding: '9px 22px',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13.5,
                  background: 'linear-gradient(135deg, #0e9384 0%, #10b981 100%)',
                  border: 'none',
                  color: '#fff',
                  cursor: !text.trim() || submitting ? 'not-allowed' : 'pointer',
                  opacity: !text.trim() || submitting ? 0.6 : 1,
                }}
              >
                {submitting ? 'Submitting...' : 'Submit Query'}
              </button>
            </div>
          </form>
        </section>

        {/* Queries History with Live Dynamic Status */}
        <section className="panel" style={{ padding: '20px 22px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
              My Query History & Resolution Status
            </div>
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
              {messages.length} quer{messages.length === 1 ? 'y' : 'ies'}
            </span>
          </div>

          <div
            className="chat-stream"
            ref={stream}
            style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 460, overflowY: 'auto' }}
          >
            {messages.length ? (
              [...messages].reverse().map((m) => {
                const isResolved = m.status === 'resolved';
                return (
                  <div
                    key={m.id}
                    style={{
                      padding: '16px 18px',
                      borderRadius: 12,
                      background: isResolved ? 'rgba(16, 185, 129, 0.04)' : 'rgba(245, 158, 11, 0.04)',
                      border: isResolved ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(245, 158, 11, 0.25)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                          Submitted: {fmtDateTime(m.at)}
                        </span>
                      </div>

                      {/* Live Dynamic Status Badge */}
                      {isResolved ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '4px 12px',
                              borderRadius: 20,
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#10b981',
                              fontSize: 12,
                              fontWeight: 600,
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                            }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            Resolved
                          </span>
                          {m.resolvedAt && (
                            <span style={{ fontSize: 11.5, color: '#10b981' }}>
                              on {fmtDateTime(m.resolvedAt)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '4px 12px',
                            borderRadius: 20,
                            background: 'rgba(245, 158, 11, 0.15)',
                            color: '#f59e0b',
                            fontSize: 12,
                            fontWeight: 600,
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                          }}
                        >
                          ⏳ Pending Admin Review
                        </span>
                      )}
                    </div>

                    {/* Query Message */}
                    <div
                      style={{
                        fontSize: 14,
                        lineHeight: 1.5,
                        color: 'var(--text)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {m.text}
                    </div>

                    {/* Admin Reply or Resolution Notice */}
                    {isResolved && (
                      <div
                        style={{
                          marginTop: 4,
                          padding: '8px 12px',
                          borderRadius: 8,
                          background: 'rgba(16, 185, 129, 0.08)',
                          border: '1px solid rgba(16, 185, 129, 0.15)',
                          fontSize: 12.5,
                          color: '#6ee7b7',
                        }}
                      >
                        ✓ This query has been reviewed and marked as resolved by Admin.
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--muted)', fontSize: 13 }}>
                You have not submitted any queries yet. Use the form above if you need assistance!
              </div>
            )}
          </div>
        </section>
      </Page>
    )}
    </Resource>
  );
}

export function HelpView() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.email?.includes('prasannajit');
  return isAdmin ? <AdminQueriesView /> : <EmployeeHelpThread />;
}

export default HelpView;
