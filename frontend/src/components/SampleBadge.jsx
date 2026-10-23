import { useI18n } from '../i18n/index.js';
import Badge from './Badge.jsx';

/** SampleBadge: subtle "Sample" label for sample data or sample AI output. Props: label (override text), className. */
export default function SampleBadge({ label, className }) {
  const { t } = useI18n();
  return (
    <Badge tone="neutral" className={className} title={t('common.sampleInsights', 'Showing available sample insights.')}>
      {label || t('common.sample', 'Sample')}
    </Badge>
  );
}
