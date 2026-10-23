import { forwardRef } from 'react';
import { Search, X } from 'lucide-react';
import { useI18n } from '../i18n/index.js';
import { cn } from '../utils/cn.js';

/**
 * SearchInput: controlled search box with clear button. Props: value, onChange(value: string), placeholder,
 * label (aria-label, default "Search"), size, className. Pair with useDebounce for API calls.
 */
const SearchInput = forwardRef(function SearchInput({ value = '', onChange, placeholder, label, size = 'md', className, ...rest }, ref) {
  const { t } = useI18n();
  return (
    <div className={cn('control control--search', `control--${size}`, className)}>
      <Search className="control__icon" size={16} aria-hidden="true" />
      <input
        ref={ref}
        type="search"
        className="control__input"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder ?? t('common.search', 'Search')}
        aria-label={label ?? t('common.search', 'Search')}
        {...rest}
      />
      {value ? (
        <button type="button" className="control__clear" onClick={() => onChange?.('')} aria-label={t('common.clear', 'Clear')}>
          <X size={14} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
});

export default SearchInput;
