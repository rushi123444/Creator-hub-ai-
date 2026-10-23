import { useCallback, useEffect, useRef, useState } from 'react';

function read(key, initial) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw == null ? initial : JSON.parse(raw);
  } catch {
    return initial;
  }
}

/**
 * useState that persists to localStorage as JSON. Never throws (private mode, quota, bad JSON).
 *   const [collapsed, setCollapsed] = useLocalStorage('ch_sidebar_collapsed', false);
 * Pass `null` as the key to disable persistence (e.g. while the user id is unknown).
 */
export function useLocalStorage(key, initial) {
  const initialRef = useRef(initial);
  const [value, setValue] = useState(() => (key ? read(key, initial) : initial));

  // Re-read when the key changes (e.g. per-user keys).
  useEffect(() => {
    setValue(key ? read(key, initialRef.current) : initialRef.current);
  }, [key]);

  const set = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        if (key) {
          try {
            window.localStorage.setItem(key, JSON.stringify(resolved));
          } catch {
            /* storage unavailable: keep in memory */
          }
        }
        return resolved;
      });
    },
    [key],
  );

  const remove = useCallback(() => {
    if (key) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    }
    setValue(initialRef.current);
  }, [key]);

  return [value, set, remove];
}

export default useLocalStorage;
