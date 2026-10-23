import { useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import { useI18n } from '../i18n/index.js';
import { cn } from '../utils/cn.js';

/**
 * Drawer: side panel overlay with the same focus handling as Modal.
 * Props: open, onClose, title, side ('left'|'right', default 'right'), width (css, default 420px), footer, className,
 * hideHeader (for custom content, pass ariaLabel), ariaLabel.
 */
export default function Drawer({ open, onClose, title, side = 'right', width = '420px', footer, className, children, hideHeader, ariaLabel }) {
  const { t } = useI18n();
  const uid = useId();
  const titleId = `d${uid.replace(/:/g, '')}`;
  const ref = useFocusTrap(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="overlay overlay--drawer" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <aside
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title && !hideHeader ? titleId : undefined}
        aria-label={!title || hideHeader ? ariaLabel : undefined}
        tabIndex={-1}
        className={cn('drawer', `drawer--${side}`, className)}
        style={{ '--drawer-w': width }}
      >
        {!hideHeader && (
          <header className="drawer__head">
            <h2 id={titleId} className="drawer__title">{title}</h2>
            <button type="button" className="icon-btn icon-btn--ghost icon-btn--sm" onClick={onClose} aria-label={t('common.close', 'Close')}>
              <X size={16} aria-hidden="true" />
            </button>
          </header>
        )}
        <div className="drawer__body">{children}</div>
        {footer && <footer className="drawer__foot">{footer}</footer>}
      </aside>
    </div>,
    document.body,
  );
}
