import { Users, UserCheck, Scissors, Film, Sparkles, Tags, Flag } from 'lucide-react';
import { Avatar, Badge, BarCompare, ChartCard, DataTable, ErrorState, PageHeader, SectionCard, StatCard, AreaTrend, DonutChart } from '../../components';
import { useAsync } from '../../hooks/useAsync.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { adminService } from '../../services';
import { formatDate, formatNumber } from '../../utils';
import '../../styles/pagesB2.css';

const cap = (s = '') => s.charAt(0).toUpperCase() + s.slice(1);

export default function AdminOverview() {
  useDocumentTitle('Admin overview');
  const { data, loading, error, loaded, reload } = useAsync((signal) => adminService.overview({ signal }), []);
  const first = !loaded && loading;
  const d = data || {};
  const stats = [
    ['Total Users', d.total_users, Users], ['Total Creators', d.total_creators, UserCheck], ['Total Editors', d.total_editors, Scissors],
    ['Total Content', d.total_content, Film], ['Total AI Requests', d.total_ai_requests, Sparkles], ['Total Categories', d.total_categories, Tags],
    ['Reported Profiles', d.reported_profiles, Flag],
  ];
  const roles = (d.users_by_role || []).map((r) => ({ ...r, role: cap(r.role) }));
  const days = d.ai_requests_by_day || [];

  return (
    <div className="page">
      <PageHeader title="Overview" description="A quick look at how the platform is doing." />
      {error && !data ? <ErrorState message={error} onRetry={reload} /> : (
        <div className="b2-stack">
          <div className="b2-charts" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))' }}>
            {stats.map(([label, v, icon]) => <StatCard key={label} label={label} value={formatNumber(v || 0)} icon={icon} loading={first} />)}
          </div>
          <div className="b2-charts">
            <ChartCard title="AI requests by day" description="Last 14 days" loading={first} empty={!first && !days.length} emptyText="No AI requests yet." height={240}>
              <AreaTrend data={days} xKey="date" series={[{ key: 'count', name: 'Requests' }]} height={240} />
            </ChartCard>
            <ChartCard title="Users by role" loading={first} empty={!first && !roles.length} emptyText="No users yet." height={240}>
              <DonutChart data={roles} nameKey="role" valueKey="count" height={240} />
            </ChartCard>
          </div>
          <SectionCard title="Recent signups" padded={false}>
            <DataTable
              loading={first}
              rows={d.recent_signups || []}
              emptyTitle="No signups yet"
              columns={[
                { key: 'full_name', header: 'Name', primary: true, render: (u) => <span className="b2-row"><Avatar name={u.full_name} size={28} />{u.full_name}</span> },
                { key: 'email', header: 'Email' },
                { key: 'role', header: 'Role', render: (u) => <Badge tone={u.role === 'admin' ? 'accent' : 'neutral'}>{cap(u.role)}</Badge> },
                { key: 'created_at', header: 'Joined', render: (u) => formatDate(u.created_at) },
              ]}
            />
          </SectionCard>
        </div>
      )}
    </div>
  );
}
