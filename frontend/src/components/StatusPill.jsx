import { useI18n } from '../i18n/index.js';
import { statusLabel } from '../utils/constants.js';
import { cn } from '../utils/cn.js';

/** StatusPill for content status (idea|draft|script|recording|editing|scheduled|published). Props: status, className. */
export default function StatusPill({ status, className }) {
  const { t } = useI18n();
  const s = String(status || 'idea').toLowerCase();
  return (
    <span className={cn('status-pill', `status-pill--${s}`, className)} style={{ '--pill': `var(--st-${s}, var(--st-idea))` }}>
      <span className="status-pill__dot" aria-hidden="true" />
      {t(`status.${s}`, statusLabel(s))}
    </span>
  );
}
