import { useState } from 'react';
import { Gauge, Sparkles, Timer, FlaskConical } from 'lucide-react';
import { AreaTrend, BarCompare, ChartCard, DataTable, DonutChart, ErrorState, PageHeader, SectionCard, SegmentedControl, StatCard } from '../../components';
import { useAsync } from '../../hooks/useAsync.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { adminService } from '../../services';
import { formatNumber, formatPercent } from '../../utils';
import '../../styles/pagesB2.css';

const cap = (s = '') => s.charAt(0).toUpperCase() + s.slice(1).replace(/[_-]/g, ' ');

export default function AdminAIUsage() {
  useDocumentTitle('AI usage');
  const [days, setDays] = useState('30');
  const { data, loading, error, loaded, reload } = useAsync((signal) => adminService.aiUsage({ days: Number(days) }, { signal }), [days]);
  const first = !loaded && loading;
  const d = data || {};
  const feat = (d.by_feature || []).map((r) => ({ ...r, feature: cap(r.feature) }));
  const stat = (d.by_status || []).map((r) => ({ ...r, status: cap(r.status) }));
  const byDay = d.by_day || [];

  return (
    <div className="page">
      <PageHeader title="AI usage" description="How the AI tools are being used." actions={<SegmentedControl ariaLabel="Time range" value={days} onChange={setDays} options={[{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }]} />} />
      {error && !data ? <ErrorState message={error} onRetry={reload} /> : (
        <div className="b2-stack">
          <div className="b2-charts" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))' }}>
            <StatCard label="Total requests" value={formatNumber(d.total || 0)} icon={Sparkles} loading={first} />
            <StatCard label="Sample share" value={formatPercent((d.sample_share || 0) * 100, 0)} icon={FlaskConical} hint="Answered with sample content" loading={first} />
            <StatCard label="Average response time" value={`${formatNumber(d.avg_latency_ms || 0)} ms`} icon={Timer} loading={first} />
          </div>
          <ChartCard title="Requests by day" loading={first} empty={!first && !byDay.length} emptyText="No requests in this period." height={240}>
            <AreaTrend data={byDay} xKey="date" series={[{ key: 'count', name: 'Requests' }]} height={240} />
          </ChartCard>
          <div className="b2-charts">
            <ChartCard title="By feature" loading={first} empty={!first && !feat.length} emptyText="No requests in this period." height={240}>
              <BarCompare data={feat} xKey="feature" series={[{ key: 'count', name: 'Requests' }]} height={240} />
            </ChartCard>
            <ChartCard title="By outcome" loading={first} empty={!first && !stat.length} emptyText="No requests in this period." height={240}>
              <DonutChart data={stat} nameKey="status" valueKey="count" height={240} />
            </ChartCard>
          </div>
          <SectionCard title="Top users" padded={false}>
            <DataTable
              loading={first}
              rows={d.top_users || []}
              rowKey="user_id"
              emptyTitle="No usage yet"
              columns={[
                { key: 'full_name', header: 'Name', primary: true },
                { key: 'email', header: 'Email' },
                { key: 'count', header: 'Requests', align: 'right', render: (u) => formatNumber(u.count) },
              ]}
            />
          </SectionCard>
        </div>
      )}
    </div>
  );
}
