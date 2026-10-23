import { cn } from '../utils/cn.js';

/** PageHeader: h1 + description + right-aligned actions. Props: title, description, eyebrow, actions (node), badge (node next to title), className. */
export default function PageHeader({ title, description, eyebrow, actions, badge, className }) {
  return (
    <header className={cn('page-header', className)}>
      <div className="page-header__text">
        {eyebrow && <p className="page-header__eyebrow">{eyebrow}</p>}
        <h1 className="page-header__title">{title}{badge}</h1>
        {description && <p className="page-header__desc">{description}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}
