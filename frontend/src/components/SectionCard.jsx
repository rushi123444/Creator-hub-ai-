import { cn } from '../utils/cn.js';

/**
 * SectionCard: Card with a header row (title, optional description, optional action) and a body.
 * Props: title, description, action (node shown top-right), footer (node), padded (body padding, default true),
 * as, className, bodyClassName, id.
 */
export default function SectionCard({ title, description, action, footer, padded = true, className, bodyClassName, children, id, as: Tag = 'section' }) {
  const headingId = id && title ? `${id}-title` : undefined;
  return (
    <Tag id={id} className={cn('card section-card', className)} aria-labelledby={headingId}>
      {(title || action) && (
        <header className="section-card__head">
          <div className="grow">
            {title && <h3 id={headingId} className="section-card__title">{title}</h3>}
            {description && <p className="section-card__desc">{description}</p>}
          </div>
          {action && <div className="section-card__action">{action}</div>}
        </header>
      )}
      <div className={cn('section-card__body', padded && 'is-padded', bodyClassName)}>{children}</div>
      {footer && <footer className="section-card__foot">{footer}</footer>}
    </Tag>
  );
}
