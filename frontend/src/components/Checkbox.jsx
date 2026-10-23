import { forwardRef, useId } from 'react';
import { Check } from 'lucide-react';
import { cn } from '../utils/cn.js';

/** Checkbox. Props: label (node), description, checked, onChange(event), disabled, className, plus native input props. */
const Checkbox = forwardRef(function Checkbox({ label, description, className, id, ...rest }, ref) {
  const uid = useId();
  const cid = id || `cb${uid.replace(/:/g, '')}`;
  return (
    <label className={cn('check', rest.disabled && 'is-disabled', className)} htmlFor={cid}>
      <input ref={ref} id={cid} type="checkbox" className="check__input" {...rest} />
      <span className="check__box" aria-hidden="true"><Check size={12} strokeWidth={3} /></span>
      {(label || description) && (
        <span className="check__text">
          {label && <span className="check__label">{label}</span>}
          {description && <span className="check__desc">{description}</span>}
        </span>
      )}
    </label>
  );
});

export default Checkbox;
