import { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../utils/cn.js';
import { useFieldContext } from './FormField.jsx';

/**
 * Native select (best accessibility on mobile).
 * Props: options ([{ value, label }] or string[]), placeholder (adds a disabled-looking empty first option),
 * invalid, size ('md'|'sm'), value, onChange, plus native select props. Children <option> also work.
 */
const Select = forwardRef(function Select({ options, placeholder, invalid, size = 'md', className, id, children, ...rest }, ref) {
  const f = useFieldContext();
  const isInvalid = invalid ?? f?.invalid;
  return (
    <div className={cn('control control--select', `control--${size}`, isInvalid && 'is-invalid', rest.disabled && 'is-disabled', className)}>
      <select
        ref={ref}
        id={id ?? f?.id}
        aria-invalid={isInvalid || undefined}
        aria-describedby={rest['aria-describedby'] ?? f?.describedBy}
        className="control__input"
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options?.map((o) => {
          const opt = typeof o === 'string' ? { value: o, label: o } : o;
          return <option key={opt.value} value={opt.value}>{opt.label}</option>;
        })}
        {children}
      </select>
      <ChevronDown className="control__chevron" size={16} aria-hidden="true" />
    </div>
  );
});

export default Select;
