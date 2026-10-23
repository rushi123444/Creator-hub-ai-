import { createContext, useContext, useId } from 'react';
import { cn } from '../utils/cn.js';

const FieldContext = createContext(null);
export const useFieldContext = () => useContext(FieldContext);

/**
 * FormField: label + control + hint + error. Input, Textarea, Select, PasswordInput and SearchInput placed
 * inside pick up the id, aria-describedby and invalid state automatically.
 * Props: label, hint, error (string), required, optionalLabel (text shown for optional fields), className.
 * For custom controls, use the render form: children as (fieldProps) => node, fieldProps = { id, 'aria-describedby', 'aria-invalid' }.
 */
export default function FormField({ label, hint, error, required, optionalLabel, className, children }) {
  const uid = useId();
  const id = `f${uid.replace(/:/g, '')}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;
  const ctx = { id, describedBy, invalid: !!error, required };
  const fieldProps = { id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined };
  return (
    <FieldContext.Provider value={ctx}>
      <div className={cn('field', error && 'has-error', className)}>
        {label && (
          <label className="field__label" htmlFor={id}>
            {label}
            {required && <span className="field__req" aria-hidden="true"> *</span>}
            {!required && optionalLabel && <span className="field__opt"> {optionalLabel}</span>}
          </label>
        )}
        {typeof children === 'function' ? children(fieldProps) : children}
        {hint && !error && <p className="field__hint" id={hintId}>{hint}</p>}
        {error && <p className="field__error" id={errId} role="alert">{error}</p>}
      </div>
    </FieldContext.Provider>
  );
}
