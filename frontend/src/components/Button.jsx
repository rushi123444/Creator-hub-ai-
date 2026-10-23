import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../utils/cn.js';
import Spinner from './Spinner.jsx';

/**
 * Button. Props: variant ('primary'|'secondary'|'ghost'|'danger'), size ('sm'|'md'|'lg'),
 * loading, icon (lucide component, leading), iconRight, block (full width), to (renders a router Link),
 * href (renders <a>), type (default 'button'), plus any native button props.
 */
const Button = forwardRef(function Button(
  { variant = 'secondary', size = 'md', loading = false, icon: Icon, iconRight: IconRight, block, to, href, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  const cls = cn('btn', `btn--${variant}`, `btn--${size}`, block && 'btn--block', loading && 'is-loading', className);
  const content = (
    <>
      {loading ? <Spinner size={size === 'lg' ? 18 : 15} label="" /> : Icon ? <Icon size={size === 'sm' ? 15 : 17} aria-hidden="true" /> : null}
      {children != null && <span className="btn__label">{children}</span>}
      {!loading && IconRight ? <IconRight size={size === 'sm' ? 15 : 17} aria-hidden="true" /> : null}
    </>
  );
  if (to && !disabled) return <Link ref={ref} to={to} className={cls} {...rest}>{content}</Link>;
  if (href && !disabled) return <a ref={ref} href={href} className={cls} {...rest}>{content}</a>;
  return (
    <button ref={ref} type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {content}
    </button>
  );
});

export default Button;
