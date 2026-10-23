import { useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import { useI18n } from '../i18n/index.js';
import { cn } from '../utils/cn.js';

/**
 * Modal dialog (glass backdrop, focus trap, Escape, scroll lock, focus restore).
 * Props: open, onClose, title, description, size ('sm'|'md'|'lg'|'xl'), footer (node, e.g. buttons),
 * dismissable (default true: backdrop click + close button), className, children, initialFocus (css selector),
 * hideHeader (render your own content; pass `ariaLabel`), ariaLabel.
 */
export default function Modal({ open, onClose, title, description, size = 'md', footer, dismissable = true, className, children, initialFocus, hideHeader, ariaLabel }) {
  const { t } = useI18n();
  const uid = useId();
  const titleId = `m${uid.replace(/:/g, '')}`;
  const ref = useFocusTrap(open, dismissable ? onClose : undefined, { initialFocus });
  if (!open) return null;
  return createPortal(
    <div className="overlay" onMouseDown={(e) => { if (dismissable && e.target === e.currentTarget) onClose?.(); }}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title && !hideHeader ? titleId : undefined}
        aria-label={!title || hideHeader ? ariaLabel : undefined}
        tabIndex={-1}
        className={cn('modal', `modal--${size}`, className)}
      >
        {!hideHeader && (
          <header className="modal__head">
            <div className="grow">
              {title && <h2 id={titleId} className="modal__title">{title}</h2>}
              {description && <p className="modal__desc">{description}</p>}
            </div>
            {dismissable && (
              <button type="button" className="icon-btn icon-btn--ghost icon-btn--sm" onClick={onClose} aria-label={t('common.close', 'Close')}>
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </header>
        )}
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
