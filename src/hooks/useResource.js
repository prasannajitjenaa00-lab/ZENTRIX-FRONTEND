import { useCallback, useEffect, useRef, useState } from 'react';
import { useLive } from '../contexts/LiveContext';

// Global SWR Cache: key -> { data, timestamp }
const globalResourceCache = new Map();

export function getResourceCacheKey(fetcher, deps = [], customKey = null) {
  if (customKey) return `${customKey}::${JSON.stringify(deps)}`;
  const fnStr = fetcher.name || fetcher.toString().replace(/\s+/g, ' ').slice(0, 160);
  return `${fnStr}::${JSON.stringify(deps)}`;
}

export function invalidateResourceCache(match = null) {
  if (!match) {
    globalResourceCache.clear();
    return;
  }
  const needle = String(match).toLowerCase();
  for (const k of globalResourceCache.keys()) {
    if (k.toLowerCase().includes(needle)) {
      globalResourceCache.delete(k);
    }
  }
}

export function prefetchResource(fetcher, deps = [], options = {}) {
  const key = getResourceCacheKey(fetcher, deps, options.key);
  return Promise.resolve()
    .then(() => fetcher())
    .then((data) => {
      globalResourceCache.set(key, { data, timestamp: Date.now() });
      return data;
    })
    .catch(() => null);
}

/**
 * High-performance SWR resource hook:
 * 1. Checks memory cache first — if found, renders instantly in 0ms (no blank loading screen!).
 * 2. Fetches fresh data in background and silently updates state (stale-while-revalidate).
 * 3. Auto-revalidates on live events or reload().
 */
export function useResource(fetcher, deps = [], { live = true, key: customKey = null, cache = true } = {}) {
  const { version } = useLive();
  const cacheKey = cache ? getResourceCacheKey(fetcher, deps, customKey) : null;
  const cachedEntry = cacheKey ? globalResourceCache.get(cacheKey) : null;
  const initialData = cachedEntry ? cachedEntry.data : null;

  const [state, setState] = useState(() => ({
    data: initialData,
    loading: initialData === null,
    error: null,
  }));

  const seq = useRef(0);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;
  const [manual, setManual] = useState(0);

  // If cacheKey changes and we have cached data for the new key, sync immediately
  const prevKeyRef = useRef(cacheKey);
  if (cacheKey && prevKeyRef.current !== cacheKey) {
    prevKeyRef.current = cacheKey;
    const freshCache = globalResourceCache.get(cacheKey);
    if (freshCache && freshCache.data !== state.data) {
      setState({ data: freshCache.data, loading: false, error: null });
    }
  }

  useEffect(() => {
    const id = ++seq.current;
    const currentCached = cacheKey ? globalResourceCache.get(cacheKey) : null;

    // Only set loading: true if we do NOT have any data to show
    setState((s) => ({
      ...s,
      data: s.data !== null ? s.data : (currentCached ? currentCached.data : null),
      loading: s.data === null && (!currentCached || currentCached.data === null),
      error: null,
    }));

    Promise.resolve()
      .then(() => fetchRef.current())
      .then(
        (data) => {
          if (id === seq.current) {
            if (cacheKey) {
              globalResourceCache.set(cacheKey, { data, timestamp: Date.now() });
            }
            setState({ data, loading: false, error: null });
          }
        },
        (error) => {
          if (id === seq.current) {
            setState((s) => ({ data: s.data, loading: false, error }));
          }
        }
      );

    return () => {
      seq.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, manual, live ? version : 0]);

  const reload = useCallback(() => setManual((m) => m + 1), []);

  const setData = useCallback(
    (updater) => {
      setState((prev) => {
        const nextData = typeof updater === 'function' ? updater(prev.data) : updater;
        if (cacheKey) {
          globalResourceCache.set(cacheKey, { data: nextData, timestamp: Date.now() });
        }
        return { ...prev, data: nextData };
      });
    },
    [cacheKey]
  );

  return { ...state, reload, setData };
}
