import { useId } from 'react';
import { cn } from '../utils/cn.js';

/** Switch (role=switch). Props: checked, onChange(checked: boolean), label, description, disabled, className. */
export default function Switch({ checked = false, onChange, label, description, disabled, className, id }) {
  const uid = useId();
  const sid = id || `sw${uid.replace(/:/g, '')}`;
  return (
    <div className={cn('switch', disabled && 'is-disabled', className)}>
      <button
        id={sid}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={cn('switch__track', checked && 'is-on')}
        onClick={() => onChange?.(!checked)}
        aria-labelledby={label ? `${sid}-l` : undefined}
      >
        <span className="switch__thumb" />
      </button>
      {(label || description) && (
        <span className="switch__text">
          {label && <label id={`${sid}-l`} htmlFor={sid} className="switch__label">{label}</label>}
          {description && <span className="switch__desc">{description}</span>}
        </span>
      )}
    </div>
  );
}
