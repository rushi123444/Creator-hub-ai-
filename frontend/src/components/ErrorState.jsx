import { AlertTriangle, RotateCw } from 'lucide-react';
import { useI18n } from '../i18n/index.js';
import { cn } from '../utils/cn.js';
import Button from './Button.jsx';

/**
 * ErrorState: friendly error with Retry. Pass the SAFE string from useAsync().error / getFriendlyError(err).
 * Props: message (shown as the description), title, onRetry (shows the Retry button), compact, className.
 */
export default function ErrorState({ message, title, onRetry, compact, className }) {
  const { t } = useI18n();
  return (
    <div className={cn('state state--error', compact && 'state--compact', className)} role="alert">
      <span className="state__icon"><AlertTriangle size={24} aria-hidden="true" /></span>
      <h3 className="state__title">{title ?? t('state.errorTitle', "We couldn't load this")}</h3>
      <p className="state__desc">{message || t('state.errorDesc', 'Something went wrong. Please try again.')}</p>
      {onRetry && (
        <div className="state__action">
          <Button icon={RotateCw} onClick={onRetry}>{t('common.retry', 'Retry')}</Button>
        </div>
      )}
    </div>
  );
}
