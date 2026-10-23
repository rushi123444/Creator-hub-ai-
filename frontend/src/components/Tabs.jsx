import { useId, useRef } from 'react';
import { cn } from '../utils/cn.js';

/**
 * Tabs (WAI-ARIA tablist with arrow-key navigation). Controlled.
 * Props: tabs ([{ value, label, count?, icon?, disabled? }]), value, onChange(value), ariaLabel, className.
 * Render panels yourself: <div role="tabpanel" id={panelId(value)} aria-labelledby={tabId(value)}> using the exported helpers
 * or just conditionally render content below <Tabs/> (panel wiring optional).
 */
export default function Tabs({ tabs, value, onChange, ariaLabel, className }) {
  const uid = useId().replace(/:/g, '');
  const refs = useRef({});
  const enabled = tabs.filter((t) => !t.disabled);
  const onKey = (e) => {
    const i = enabled.findIndex((t) => t.value === value);
    let next = null;
    if (e.key === 'ArrowRight') next = enabled[(i + 1) % enabled.length];
    else if (e.key === 'ArrowLeft') next = enabled[(i - 1 + enabled.length) % enabled.length];
    else if (e.key === 'Home') next = enabled[0];
    else if (e.key === 'End') next = enabled[enabled.length - 1];
    if (next) {
      e.preventDefault();
      onChange?.(next.value);
      refs.current[next.value]?.focus();
    }
  };
  return (
    <div className={cn('tabs', className)} role="tablist" aria-label={ariaLabel} onKeyDown={onKey}>
      {tabs.map((t) => {
        const selected = t.value === value;
        const Icon = t.icon;
        return (
          <button
            key={t.value}
            ref={(el) => { refs.current[t.value] = el; }}
            id={`${uid}-tab-${t.value}`}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={t.disabled}
            className={cn('tabs__tab', selected && 'is-active')}
            onClick={() => onChange?.(t.value)}
          >
            {Icon && <Icon size={15} aria-hidden="true" />}
            <span>{t.label}</span>
            {t.count != null && <span className="tabs__count">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
