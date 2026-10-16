import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../services';
import { setUnauthorizedHandler } from '../services/api';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', user: null });   // loading | anon | authed

  const refresh = useCallback(async () => {
    try { const { user } = await authApi.me(); setState({ status: 'authed', user }); return user; }
    catch (e) {
      // PASSWORD_CHANGE_REQUIRED: signed in but must pick a new password first. /me is allowed in that state.
      setState({ status: 'anon', user: null }); return null;
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { setUnauthorizedHandler(() => setState({ status: 'anon', user: null })); }, []);

  const signedIn = useCallback((user) => setState({ status: 'authed', user }), []);
  const logout = useCallback(async () => { try { await authApi.logout(); } catch { /* already gone */ } setState({ status: 'anon', user: null }); }, []);
  const value = useMemo(() => ({ ...state, refresh, signedIn, logout, setUser: (user) => setState({ status: 'authed', user }) }), [state, refresh, signedIn, logout]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
