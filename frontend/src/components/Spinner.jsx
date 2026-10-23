import { cn } from '../utils/cn.js';

/** Spinner. Props: size (px, 16), label (screen-reader text, default 'Loading'), className. */
export default function Spinner({ size = 16, label = 'Loading', className }) {
  return (
    <span className={cn('spinner', className)} role="status" style={{ width: size, height: size }}>
      <span className="sr-only">{label}</span>
    </span>
  );
}
