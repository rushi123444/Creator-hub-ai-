import { useEffect, useRef } from 'react';

/**
 * Calls `handler` when a pointer press happens outside every ref in `refs`, or Escape is pressed.
 * Used by Dropdown, popovers and the command palette.
 */
export function useClickOutside(refs, handler, active = true) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    if (!active) return undefined;
    const list = Array.isArray(refs) ? refs : [refs];
    const onPointer = (e) => {
      if (list.some((r) => r.current && r.current.contains(e.target))) return;
      handlerRef.current(e);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') handlerRef.current(e);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}

export default useClickOutside;
