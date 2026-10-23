import { Inbox } from 'lucide-react';
import { useI18n } from '../i18n/index.js';
import { cn } from '../utils/cn.js';

/**
 * EmptyState. Props: icon (lucide component, default Inbox), title, description, action (node, e.g. <Button/>),
 * compact (less padding, for use inside cards), className. Defaults come from the shared "state.*" strings.
 */
export default function EmptyState({ icon: Icon = Inbox, title, description, action, compact, className }) {
  const { t } = useI18n();
  return (
    <div className={cn('state', compact && 'state--compact', className)}>
      <span className="state__icon"><Icon size={24} aria-hidden="true" /></span>
      <h3 className="state__title">{title ?? t('state.emptyTitle', 'Nothing here yet')}</h3>
      {(description ?? true) && <p className="state__desc">{description ?? t('state.emptyDesc', 'Items you add will show up here.')}</p>}
      {action && <div className="state__action">{action}</div>}
    </div>
  );
}
