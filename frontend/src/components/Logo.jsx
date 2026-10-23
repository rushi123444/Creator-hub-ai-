import { cn } from '../utils/cn.js';

/** Original spark/hub mark: a four-point spark with three satellite nodes. */
export function LogoMark({ size = 28, className }) {
  return (
    <svg
      className={cn('logo-mark', className)}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="chLogoGrad" x1="3" y1="3" x2="29" y2="29" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366f1" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#chLogoGrad)" />
      <path d="M16 6.5c.6 4.6 2.9 6.9 7.5 7.5-4.6.6-6.9 2.9-7.5 7.5-.6-4.6-2.9-6.9-7.5-7.5 4.6-.6 6.9-2.9 7.5-7.5Z" fill="#fff" />
      <circle cx="23.5" cy="23.5" r="2.1" fill="#fff" fillOpacity=".92" />
      <circle cx="9" cy="23" r="1.4" fill="#fff" fillOpacity=".6" />
      <circle cx="24" cy="8" r="1.2" fill="#fff" fillOpacity=".55" />
    </svg>
  );
}

/**
 * Logo: mark + wordmark.
 * Props: size (mark px, default 28), showText (default true), className.
 */
export default function Logo({ size = 28, showText = true, className }) {
  return (
    <span className={cn('logo', className)}>
      <LogoMark size={size} />
      {showText && (
        <span className="logo__text">
          CreatorHub <span className="logo__ai">AI</span>
        </span>
      )}
    </span>
  );
}
