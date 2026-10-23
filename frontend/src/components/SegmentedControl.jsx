import { useRef } from 'react';
import { cn } from '../utils/cn.js';

/**
 * SegmentedControl: compact single-choice toggle (radiogroup, arrow keys).
 * Props: options ([{ value, label, icon? }]), value, onChange(value), ariaLabel, size ('md'|'sm'), block, className.
 */
export default function SegmentedControl({ options, value, onChange, ariaLabel, size = 'md', block, className }) {
  const refs = useRef({});
  const onKey = (e) => {
    const i = options.findIndex((o) => o.value === value);
    let n = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = options[(i + 1) % options.length];
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = options[(i - 1 + options.length) % options.length];
    if (n) {
      e.preventDefault();
      onChange?.(n.value);
      refs.current[n.value]?.focus();
    }
  };
  return (
    <div className={cn('segmented', `segmented--${size}`, block && 'segmented--block', className)} role="radiogroup" aria-label={ariaLabel} onKeyDown={onKey}>
      {options.map((o) => {
        const on = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            ref={(el) => { refs.current[o.value] = el; }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            className={cn('segmented__item', on && 'is-active')}
            onClick={() => onChange?.(o.value)}
          >
            {Icon && <Icon size={14} aria-hidden="true" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
