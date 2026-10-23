import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

let lockCount = 0;
function lockScroll() {
  if (lockCount++ === 0) document.body.style.overflow = 'hidden';
}
function unlockScroll() {
  if (--lockCount <= 0) {
    lockCount = 0;
    document.body.style.overflow = '';
  }
}

/**
 * Modal behaviour for dialogs and drawers: moves focus inside on open, traps Tab, closes on Escape,
 * locks page scroll, and restores focus to the previously focused element on close.
 * Usage: const ref = useFocusTrap(open, onClose); <div ref={ref} role="dialog" aria-modal tabIndex={-1}>
 */
export function useFocusTrap(active, onClose, { initialFocus } = {}) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!active) return undefined;
    const node = ref.current;
    const previous = document.activeElement;
    lockScroll();
    const items = () => (node ? Array.from(node.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement) : []);
    const target = (initialFocus && node?.querySelector(initialFocus)) || items().find((el) => el.hasAttribute('data-autofocus')) || items()[0] || node;
    target?.focus?.({ preventScroll: true });

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current?.();
        return;
      }
      if (e.key !== 'Tab' || !node) return;
      const list = items();
      if (!list.length) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      unlockScroll();
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) previous.focus({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return ref;
}

export default useFocusTrap;
