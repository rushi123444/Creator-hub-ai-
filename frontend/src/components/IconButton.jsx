import { forwardRef } from 'react';
import { cn } from '../utils/cn.js';

/**
 * Icon-only button. `label` is REQUIRED (aria-label + native tooltip).
 * Props: icon (lucide component), label, size ('sm'|'md'|'lg'), variant ('ghost'|'secondary'|'danger'), active, plus native button props.
 */
const IconButton = forwardRef(function IconButton(
  { icon: Icon, label, size = 'md', variant = 'ghost', active, className, type = 'button', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn('icon-btn', `icon-btn--${size}`, `icon-btn--${variant}`, active && 'is-active', className)}
      {...rest}
    >
      {Icon ? <Icon size={size === 'sm' ? 16 : 18} aria-hidden="true" /> : null}
      {children}
    </button>
  );
});

export default IconButton;
