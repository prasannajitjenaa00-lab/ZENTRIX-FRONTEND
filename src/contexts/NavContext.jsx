import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const NavCtx = createContext(null);
export const useNav = () => useContext(NavCtx);

/** Same viewState the original kept: current view, calendar month (opens on Sept 2026 as before), filters, focus ids. */
export function NavProvider({ children }) {
  const [s, setS] = useState({ name: 'dashboard', year: 2026, month: 8, query: '', taskStatus: 'all', calUser: '', person: '', projectId: '' });
  const go = useCallback((name, extra = {}) => setS((p) => ({ ...p, name, query: extra.query || '', ...extra })), []);
  const patch = useCallback((extra) => setS((p) => ({ ...p, ...extra })), []);
  const reset = useCallback(() => setS((p) => ({ ...p, name: 'dashboard', query: '', person: '', projectId: '' })), []);
  const value = useMemo(() => ({ ...s, go, patch, reset }), [s, go, patch, reset]);
  return <NavCtx.Provider value={value}>{children}</NavCtx.Provider>;
}
