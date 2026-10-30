import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import config from '../config';


const LiveCtx = createContext({ version: 0, online: [], connection: 'connecting', subscribe: () => () => {}, refresh: () => {} });
export const useLive = () => useContext(LiveCtx);

const REFETCH_EVENTS = [
  'task:created', 'task:updated', 'task:deleted',
  'activity:new', 'user:created', 'user:updated',
  'track:assigned', 'package:created', 'package:updated', 'package:deleted'
];

/**
 * Socket.IO is a *hint* channel: events tell pages to refetch REST data (REST is the source of truth).
 * The server authorises rooms, so the client only listens. Events carry eventId; duplicates are dropped.
 */
export function LiveProvider({ children }) {
  const { status } = useAuth();
  const [version, setVersion] = useState(0);
  const [online, setOnline] = useState([]);
  const [connection, setConnection] = useState('connecting');
  const subs = useRef(new Map());
  const seen = useRef(new Set());
  const timer = useRef(null);

  const bump = useCallback(() => { clearTimeout(timer.current); timer.current = setTimeout(() => setVersion((v) => v + 1), 120); }, []);
  const subscribe = useCallback((event, fn) => {
    if (!subs.current.has(event)) subs.current.set(event, new Set());
    subs.current.get(event).add(fn);
    return () => subs.current.get(event)?.delete(fn);
  }, []);

  useEffect(() => {
    if (status !== 'authed') { setConnection('connecting'); setOnline([]); return undefined; }
    const url = config.socketUrl;
    const socket = io(url, { withCredentials: true, transports: ['websocket', 'polling'], reconnectionDelayMax: 8000 });
    const fresh = (p) => {                               // duplicate-event prevention
      if (!p?.eventId) return true;
      if (seen.current.has(p.eventId)) return false;
      seen.current.add(p.eventId); if (seen.current.size > 500) seen.current = new Set([...seen.current].slice(-250));
      return true;
    };
    socket.on('connect', () => { setConnection('live'); bump(); });          // refetch after (re)connect: events missed while offline
    socket.on('disconnect', () => setConnection('offline'));
    socket.on('connect_error', () => setConnection('offline'));
    socket.on('hello', (p) => setOnline(p.online || []));
    socket.on('presence:update', (p) => setOnline(p.online || []));
    REFETCH_EVENTS.forEach((ev) => socket.on(ev, (p) => { if (fresh(p)) bump(); }));
    socket.on('chat:message', (p) => { if (fresh(p)) subs.current.get('chat:message')?.forEach((fn) => fn(p.message)); });
    socket.on('help:message', (p) => { if (fresh(p)) subs.current.get('help:message')?.forEach((fn) => fn(p.message)); });
    socket.on('help:resolved', (p) => { if (fresh(p)) subs.current.get('help:resolved')?.forEach((fn) => fn(p.message)); });
    return () => { socket.off(); socket.close(); clearTimeout(timer.current); };
  }, [status, bump]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);     // after a local mutation: refetch every open view now
  const value = useMemo(() => ({ version, online, connection, subscribe, refresh }), [version, online, connection, subscribe, refresh]);
  return <LiveCtx.Provider value={value}>{children}</LiveCtx.Provider>;
}
