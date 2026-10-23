import { forwardRef } from 'react';
import { cn } from '../utils/cn.js';
import { useFieldContext } from './FormField.jsx';

/** Textarea. Props: rows (4), invalid, mono (monospace), plus native textarea props. */
const Textarea = forwardRef(function Textarea({ rows = 4, invalid, mono, className, id, ...rest }, ref) {
  const f = useFieldContext();
  const isInvalid = invalid ?? f?.invalid;
  return (
    <textarea
      ref={ref}
      id={id ?? f?.id}
      rows={rows}
      aria-invalid={isInvalid || undefined}
      aria-describedby={rest['aria-describedby'] ?? f?.describedBy}
      className={cn('textarea', isInvalid && 'is-invalid', mono && 'textarea--mono', className)}
      {...rest}
    />
  );
});

export default Textarea;
