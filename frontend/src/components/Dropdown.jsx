import { cloneElement, useCallback, useEffect, useId, useRef, useState } from 'react';
import { useClickOutside } from '../hooks/useClickOutside.js';
import { cn } from '../utils/cn.js';

/**
 * Dropdown / menu with keyboard support (Arrow keys, Home/End, Escape, Enter).
 * Props:
 *  - trigger: a single element (e.g. <Button/>); it receives onClick + aria props.
 *  - items: [{ label, icon?, onSelect?, danger?, disabled?, active? }, { type: 'separator' }, { type: 'label', label }]
 *  - align: 'start' | 'end' (default 'end'), width (css), className
 *  - children: custom panel content instead of `items` (use render form (close) => node to close it yourself)
 *  - open / onOpenChange: optional controlled mode.
 */
export default function Dropdown({ trigger, items, children, align = 'end', width, className, open: controlled, onOpenChange, panelClassName, role: panelRole = 'menu' }) {
  const [inner, setInner] = useState(false);
  const open = controlled ?? inner;
  const setOpen = useCallback((v) => { if (controlled === undefined) setInner(v); onOpenChange?.(v); }, [controlled, onOpenChange]);
  const wrap = useRef(null);
  const panel = useRef(null);
  const triggerRef = useRef(null);
  const uid = useId().replace(/:/g, '');
  const close = useCallback((restore = true) => { setOpen(false); if (restore) triggerRef.current?.focus?.(); }, [setOpen]);
  useClickOutside([wrap], () => close(false), open);

  useEffect(() => {
    if (open && items) panel.current?.querySelector('[role=menuitem]:not([disabled])')?.focus();
  }, [open, items]);

  const onKey = (e) => {
    if (!items) return;
    const els = Array.from(panel.current?.querySelectorAll('[role=menuitem]:not([disabled])') || []);
    const i = els.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); els[(i + 1) % els.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); els[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); els[els.length - 1]?.focus(); }
    else if (e.key === 'Tab') close(false);
    else if (e.key === 'Escape') { e.stopPropagation(); close(); }
  };

  const trig = cloneElement(trigger, {
    ref: triggerRef,
    'aria-haspopup': panelRole === 'menu' ? 'menu' : 'dialog',
    'aria-expanded': open,
    'aria-controls': open ? `${uid}-panel` : undefined,
    onClick: (e) => { trigger.props.onClick?.(e); setOpen(!open); },
  });

  return (
    <div className={cn('dropdown', className)} ref={wrap}>
      {trig}
      {open && (
        <div
          id={`${uid}-panel`}
          ref={panel}
          role={panelRole}
          className={cn('dropdown__panel', `dropdown__panel--${align}`, panelClassName)}
          style={width ? { width } : undefined}
          onKeyDown={onKey}
        >
          {items
            ? items.map((it, i) => {
                if (it.type === 'separator') return <hr key={i} className="dropdown__sep" role="separator" />;
                if (it.type === 'label') return <div key={i} className="dropdown__label">{it.label}</div>;
                const Icon = it.icon;
                const cls = cn('dropdown__item', it.danger && 'is-danger', it.active && 'is-active');
                const run = () => { close(false); it.onSelect?.(); };
                return (
                  <button key={i} type="button" role="menuitem" disabled={it.disabled} className={cls} onClick={run}>
                    {Icon && <Icon size={16} aria-hidden="true" />}
                    <span className="grow truncate">{it.label}</span>
                    {it.active && <span className="dropdown__dot" aria-hidden="true" />}
                  </button>
                );
              })
            : typeof children === 'function' ? children(close) : children}
        </div>
      )}
    </div>
  );
}
