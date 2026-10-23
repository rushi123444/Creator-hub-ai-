import { useState } from 'react';
import { Badge, DataTable, ErrorState, PageHeader, SearchInput } from '../../components';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useLabels } from '../../hooks/useLabels.js';
import { adminService } from '../../services';
import { formatDate } from '../../utils';
import '../../styles/pagesB2.css';

export default function AdminCreators() {
  useDocumentTitle('Creators');
  const L = useLabels();
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 350);
  const { data, loading, error, loaded, reload } = useAsync((signal) => adminService.listCreators({ q: dq.trim() || undefined }, { signal }), [dq]);
  const items = data?.items || [];
  return (
    <div className="page">
      <PageHeader title="Creators" description="Everyone creating on the platform." />
      <div className="b2-toolbar"><SearchInput className="b2-search" value={q} onChange={setQ} placeholder="Search by name or email" /></div>
      {error && !items.length ? <ErrorState message={error} onRetry={reload} /> : (
        <DataTable
          caption="Creators"
          loading={!loaded && loading}
          rows={items}
          emptyTitle="No creators found"
          emptyDescription="Try a different search."
          columns={[
            { key: 'full_name', header: 'Name', primary: true },
            { key: 'email', header: 'Email' },
            { key: 'category', header: 'Category', render: (c) => c.category || '-' },
            { key: 'platform', header: 'Platform', hideOnMobile: true, render: (c) => (c.platform ? (L.platform(c.platform) || c.platform) : '-') },
            { key: 'preferred_language', header: 'Language', hideOnMobile: true, render: (c) => L.language(c.preferred_language) || c.preferred_language },
            { key: 'content_count', header: 'Content', align: 'right' },
            { key: 'profile_completed', header: 'Profile', render: (c) => <Badge tone={c.profile_completed ? 'success' : 'warning'}>{c.profile_completed ? 'Complete' : 'Incomplete'}</Badge> },
            { key: 'is_active', header: 'Status', render: (c) => <Badge tone={c.is_active ? 'success' : 'danger'} dot>{c.is_active ? 'Active' : 'Inactive'}</Badge> },
            { key: 'created_at', header: 'Joined', hideOnMobile: true, render: (c) => formatDate(c.created_at) },
          ]}
        />
      )}
    </div>
  );
}
