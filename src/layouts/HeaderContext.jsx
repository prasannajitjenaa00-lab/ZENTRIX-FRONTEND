import { createContext, useContext, useEffect } from 'react';
export const HeaderCtx = createContext(() => {});
/** Pages declare their title/subtitle (original setHeader). */
export function useHeader(title, sub) {
  const set = useContext(HeaderCtx);
  useEffect(() => { set({ title, sub }); }, [set, title, sub]);
}
