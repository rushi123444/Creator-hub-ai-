import { useCallback, useEffect, useRef, useState } from 'react';
import { getFriendlyError, isAborted } from '../services/api.js';

/**
 * Data-loading hook. Race-safe: a slow earlier response can never overwrite a newer one,
 * in-flight requests are aborted on dependency change / unmount.
 *
 *   const { data, loading, error, reload, setData } = useAsync(
 *     (signal) => trendsService.list({ q, platform }, { signal }),
 *     [q, platform],
 *   );
 *
 *  - `fetcher(signal)` returns a promise. Pass `{ signal }` as the 2nd arg of list/get services.
 *  - `deps` re-run the fetch when they change (like useEffect).
 *  - options: `enabled` (default true), `initialData`, `keepPrevious` (default true: keep showing the
 *    previous data, with loading=true, while a refetch runs, so lists don't flash empty).
 *  - `loading` is true for the first load AND any refetch; use `loaded` to tell "never loaded yet".
 *  - `error` is a SAFE message string ('' when none). `reload()` re-runs with the latest fetcher.
 *  - `setData(next | fn)` for optimistic updates (e.g. remove a row after delete).
 */
export function useAsync(fetcher, deps = [], { enabled = true, initialData = null, keepPrevious = true } = {}) {
  const [state, setState] = useState({ data: initialData, error: '', errorCode: '', loading: enabled, loaded: false });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const idRef = useRef(0);
  const ctrlRef = useRef(null);
  const keepRef = useRef(keepPrevious);
  keepRef.current = keepPrevious;
  const initialRef = useRef(initialData);

  const run = useCallback(async () => {
    const id = ++idRef.current;
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setState((s) => ({
      ...s,
      loading: true,
      error: '',
      errorCode: '',
      data: keepRef.current ? s.data : initialRef.current,
    }));
    try {
      const data = await fetcherRef.current(ctrl.signal);
      if (id !== idRef.current) return undefined;
      setState({ data, error: '', errorCode: '', loading: false, loaded: true });
      return data;
    } catch (e) {
      if (id !== idRef.current || isAborted(e)) return undefined;
      setState((s) => ({ ...s, error: getFriendlyError(e), errorCode: e?.code || '', loading: false, loaded: true }));
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setState((s) => (s.loading ? { ...s, loading: false } : s));
      return undefined;
    }
    run();
    return () => {
      idRef.current += 1;
      ctrlRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, run, ...deps]);

  const setData = useCallback((next) => {
    setState((s) => ({ ...s, data: typeof next === 'function' ? next(s.data) : next }));
  }, []);

  return {
    data: state.data,
    error: state.error,
    errorCode: state.errorCode,
    loading: state.loading,
    loaded: state.loaded,
    reload: run,
    setData,
  };
}

export const useQuery = useAsync;
export default useAsync;
