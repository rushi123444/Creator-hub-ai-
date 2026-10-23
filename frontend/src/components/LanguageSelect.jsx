import { Check, Languages } from 'lucide-react';
import { useI18n } from '../i18n/index.js';
import { LANGUAGES } from '../utils/constants.js';
import Dropdown from './Dropdown.jsx';
import Select from './Select.jsx';

const NATIVE = { en: 'English', hi: 'हिन्दी', mr: 'मराठी' };

/**
 * LanguageSelect. Two modes:
 *  - variant 'menu' (default): globe button + dropdown that changes the INTERFACE language (useI18n().setLang).
 *  - variant 'field': native <select> bound to `value`/`onChange(code)`, for choosing the language of AI output or content.
 * Props: variant, value, onChange, size, className, id.
 */
export default function LanguageSelect({ variant = 'menu', value, onChange, size = 'md', className, id }) {
  const { lang, setLang, t } = useI18n();
  if (variant === 'field') {
    return (
      <Select
        id={id}
        size={size}
        className={className}
        value={value ?? lang}
        onChange={(e) => onChange?.(e.target.value)}
        options={LANGUAGES.map((l) => ({ value: l.code, label: NATIVE[l.code] ? `${NATIVE[l.code]}${l.code !== 'en' ? ` (${l.label})` : ''}` : l.label }))}
      />
    );
  }
  return (
    <Dropdown
      className={className}
      trigger={
        <button type="button" className="btn btn--ghost btn--sm" aria-label={`${t('topbar.language', 'Language')}: ${NATIVE[lang]}`}>
          <Languages size={17} aria-hidden="true" />
          <span className="btn__label hide-mobile">{NATIVE[lang]}</span>
        </button>
      }
      items={[
        { type: 'label', label: t('topbar.language', 'Language') },
        ...LANGUAGES.map((l) => ({ label: NATIVE[l.code] || l.label, icon: l.code === lang ? Check : undefined, active: l.code === lang, onSelect: () => setLang(l.code) })),
      ]}
    />
  );
}
