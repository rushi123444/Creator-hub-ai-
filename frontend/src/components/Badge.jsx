import { cn } from '../utils/cn.js';

/**
 * Badge: small status label. Props: tone ('neutral'|'accent'|'success'|'warning'|'danger'|'info'),
 * icon (lucide component), dot (leading colour dot), className.
 */
export default function Badge({ tone = 'neutral', icon: Icon, dot, className, children, ...rest }) {
  return (
    <span className={cn('badge', `badge--${tone}`, className)} {...rest}>
      {dot && <span className="badge__dot" aria-hidden="true" />}
      {Icon && <Icon size={12} aria-hidden="true" />}
      {children}
    </span>
  );
}
