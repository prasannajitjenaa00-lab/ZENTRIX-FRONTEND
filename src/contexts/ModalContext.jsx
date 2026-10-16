import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ModalCtx = createContext({ open: () => {}, close: () => {} });
export const useModal = () => useContext(ModalCtx);

/** open(render) — render receives { close }. Backdrop click closes, same markup/classes as the original. */
export function ModalProvider({ children }) {
  const [state, setState] = useState(null);       // { render, out }
  const timer = useRef(null);
  const close = useCallback(() => {
    setState((s) => (s ? { ...s, out: true } : s));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState(null), 180);
  }, []);
  const open = useCallback((render) => { clearTimeout(timer.current); setState({ render, out: false }); }, []);
  return (
    <ModalCtx.Provider value={{ open, close }}>
      {children}
      <div id="modal-root">
        {state && (
          <div className={`modal-back ${state.out ? 'modal-out' : ''}`} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
            <div className="modal" role="dialog" aria-modal="true">{state.render({ close })}</div>
          </div>
        )}
      </div>
    </ModalCtx.Provider>
  );
}
