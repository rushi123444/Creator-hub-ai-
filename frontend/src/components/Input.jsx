import { forwardRef } from 'react';
import { cn } from '../utils/cn.js';
import { useFieldContext } from './FormField.jsx';

/**
 * Input. Props: icon (lucide, leading), suffix (node at end), invalid, size ('md'|'sm'), className (wrapper),
 * inputClassName, plus native input props. Inside FormField it is labelled automatically.
 */
const Input = forwardRef(function Input({ icon: Icon, suffix, invalid, size = 'md', className, inputClassName, id, type = 'text', ...rest }, ref) {
  const f = useFieldContext();
  const isInvalid = invalid ?? f?.invalid;
  return (
    <div className={cn('control', `control--${size}`, isInvalid && 'is-invalid', rest.disabled && 'is-disabled', className)}>
      {Icon && <Icon className="control__icon" size={16} aria-hidden="true" />}
      <input
        ref={ref}
        id={id ?? f?.id}
        type={type}
        aria-invalid={isInvalid || undefined}
        aria-describedby={rest['aria-describedby'] ?? f?.describedBy}
        required={rest.required ?? undefined}
        className={cn('control__input', inputClassName)}
        {...rest}
      />
      {suffix && <span className="control__suffix">{suffix}</span>}
    </div>
  );
});

export default Input;
