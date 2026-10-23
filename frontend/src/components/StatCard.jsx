import { cn } from '../utils/cn.js';
import { SkeletonStat } from './Skeleton.jsx';

/**
 * StatCard: KPI tile. Props: label, value (already formatted), icon (lucide), delta (number, % change; shows up/down colour),
 * deltaLabel (e.g. "vs last 30 days"), hint (small text under the value), loading (skeleton), className.
 */
export default function StatCard({ label, value, icon: Icon, delta, deltaLabel, hint, loading, className }) {
  if (loading) return <SkeletonStat />;
  const has = typeof delta === 'number' && Number.isFinite(delta);
  const tone = !has ? '' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  return (
    <div className={cn('card stat-card', className)}>
      <div className="stat-card__label">{Icon && <Icon size={15} aria-hidden="true" />}<span>{label}</span></div>
      <div className="stat-card__value">{value ?? '–'}</div>
      <div className="stat-card__foot">
        {has && <span className={`delta delta--${tone}`}>{delta > 0 ? '+' : ''}{delta.toFixed(1)}%</span>}
        {(deltaLabel && has) ? <span>{deltaLabel}</span> : hint ? <span>{hint}</span> : null}
      </div>
    </div>
  );
}
