import { cn } from '../utils/cn.js';
import EmptyState from './EmptyState.jsx';
import ErrorState from './ErrorState.jsx';
import SectionCard from './SectionCard.jsx';
import { SkeletonChart } from './Skeleton.jsx';

/**
 * ChartCard: SectionCard wrapper for a chart with loading / error / empty states.
 * Props: title, description, action (header node, e.g. SegmentedControl), loading, error (safe string), onRetry,
 * empty (boolean, shows EmptyState), emptyText, height (chart area min-height, default 260), footer, className.
 * Children: the chart, e.g. <AreaTrend .../>.
 */
export default function ChartCard({ title, description, action, loading, error, onRetry, empty, emptyText, height = 260, footer, className, children }) {
  let body = children;
  if (loading) body = <SkeletonChart height={height} />;
  else if (error) body = <ErrorState compact message={error} onRetry={onRetry} />;
  else if (empty) body = <EmptyState compact title={emptyText} description={null} />;
  return (
    <SectionCard title={title} description={description} action={action} footer={footer} className={cn('chart-card', className)}>
      <div className="chart-card__chart" style={{ minHeight: loading || error || empty ? undefined : height }}>{body}</div>
    </SectionCard>
  );
}
