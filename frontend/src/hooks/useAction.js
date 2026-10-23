import { useCallback, useEffect, useRef, useState } from 'react';
import { getFieldErrors, getFriendlyError, isAborted } from '../services/api.js';

/**
 * Wraps a user-triggered async action (save, delete, generate) with pending/error state.
 *
 *   const save = useAction((values) => profilesService.updateMe(values));
 *   const result = await save.run(values);   // result is undefined when it failed
 *   save.pending, save.error (safe string), save.fieldErrors ({ email: '...' })
 *
 * `run` never throws; check the return value (or `save.error`). Ignores results after unmount.
 */
export function useAction(action) {
  const [state, setState] = useState({ pending: false, error: '', fieldErrors: {} });
  const actionRef = useRef(action);
  actionRef.current = action;
  const mounted = useRef(true);
  const counter = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (...args) => {
    const id = ++counter.current;
    setState({ pending: true, error: '', fieldErrors: {} });
    try {
      const result = await actionRef.current(...args);
      if (mounted.current && id === counter.current) setState({ pending: false, error: '', fieldErrors: {} });
      return result === undefined ? null : result;
    } catch (e) {
      if (mounted.current && id === counter.current && !isAborted(e)) {
        setState({ pending: false, error: getFriendlyError(e), fieldErrors: getFieldErrors(e) });
      }
      return undefined;
    }
  }, []);

  const reset = useCallback(() => setState({ pending: false, error: '', fieldErrors: {} }), []);

  return { run, pending: state.pending, error: state.error, fieldErrors: state.fieldErrors, reset };
}

export default useAction;
