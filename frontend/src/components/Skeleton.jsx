import { cn } from '../utils/cn.js';

/** Skeleton block. Props: width, height, radius, className, style. */
export function Skeleton({ width, height = 14, radius, className, style }) {
  return (
    <span
      className={cn('skeleton', className)}
      aria-hidden="true"
      style={{ width, height, borderRadius: radius, ...style }}
    />
  );
}

/** SkeletonText: `lines` text lines, the last one shorter. */
export function SkeletonText({ lines = 3, className }) {
  return (
    <div className={cn('stack stack--sm', className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={i === lines - 1 && lines > 1 ? '60%' : '100%'} />
      ))}
    </div>
  );
}

/** SkeletonCard: card-shaped placeholder with a title and a few lines. */
export function SkeletonCard({ lines = 3, height, className }) {
  return (
    <div className={cn('card skeleton-card', className)} style={{ minHeight: height }} role="status" aria-label="Loading">
      <Skeleton width="40%" height={16} />
      <SkeletonText lines={lines} />
    </div>
  );
}

/** SkeletonStat: placeholder for StatCard. */
export function SkeletonStat() {
  return (
    <div className="card stat-card" role="status" aria-label="Loading">
      <Skeleton width="50%" height={12} />
      <Skeleton width="40%" height={28} />
    </div>
  );
}

/** SkeletonRows: list/table placeholder. Props: rows (5). */
export function SkeletonRows({ rows = 5, className }) {
  return (
    <div className={cn('stack', className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div className="row" key={i}>
          <Skeleton width={36} height={36} radius="50%" />
          <div className="grow stack stack--sm">
            <Skeleton width="55%" />
            <Skeleton width="30%" height={10} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** SkeletonChart: chart-area placeholder. Props: height (240). */
export function SkeletonChart({ height = 240 }) {
  return <Skeleton width="100%" height={height} radius="var(--radius)" />;
}

/** PageSkeleton: Suspense fallback for lazy routes. */
export function PageSkeleton() {
  return (
    <div className="page stack stack--lg" role="status" aria-label="Loading">
      <div className="stack stack--sm">
        <Skeleton width={220} height={26} />
        <Skeleton width={340} height={14} />
      </div>
      <div className="grid grid--stats">
        <SkeletonStat />
        <SkeletonStat />
        <SkeletonStat />
        <SkeletonStat />
      </div>
      <SkeletonCard lines={5} height={220} />
    </div>
  );
}

export default Skeleton;
