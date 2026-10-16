import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const seq = useRef(0);
  const toast = useCallback((msg) => {
    const id = ++seq.current;
    setItems((l) => [...l, { id, msg }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 2800);
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div id="toast-root">{items.map((t) => <div key={t.id} className="toast">{t.msg}</div>)}</div>
    </ToastCtx.Provider>
  );
}
