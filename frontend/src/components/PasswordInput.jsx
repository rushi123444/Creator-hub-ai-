import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useI18n } from '../i18n/index.js';
import Input from './Input.jsx';

/** PasswordInput: Input with a show/hide toggle. Props: same as Input (value, onChange, autoComplete, ...). */
const PasswordInput = forwardRef(function PasswordInput(props, ref) {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  return (
    <Input
      ref={ref}
      {...props}
      type={show ? 'text' : 'password'}
      suffix={
        <button
          type="button"
          className="control__toggle"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? t('common.hidePassword', 'Hide password') : t('common.showPassword', 'Show password')}
          aria-pressed={show}
        >
          {show ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        </button>
      }
    />
  );
});

export default PasswordInput;
