import { useCallback, useEffect, useRef, useState } from 'react';
import { useLive } from '../contexts/LiveContext';

/** Load data, ignore stale responses, refetch on live events (live=true) or reload(). */
export function useResource(fetcher, deps = [], { live = true } = {}) {
  const { version } = useLive();
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const seq = useRef(0);
  const fetchRef = useRef(fetcher); fetchRef.current = fetcher;
  const [manual, setManual] = useState(0);

  useEffect(() => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: s.data == null, error: null }));
    Promise.resolve().then(() => fetchRef.current()).then(
      (data) => { if (id === seq.current) setState({ data, loading: false, error: null }); },
      (error) => { if (id === seq.current) setState((s) => ({ data: s.data, loading: false, error })); });
    return () => { seq.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, manual, live ? version : 0]);

  const reload = useCallback(() => setManual((m) => m + 1), []);
  return { ...state, reload, setData: (data) => setState((s) => ({ ...s, data })) };
}
