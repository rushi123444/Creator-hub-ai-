import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Badge, ConfirmDialog, DataTable, ErrorState, IconButton, PageHeader, Pagination, SearchInput, useToast } from '../../components';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useLabels } from '../../hooks/useLabels.js';
import { adminService, getFriendlyError } from '../../services';
import { formatDate } from '../../utils';
import '../../styles/pagesB2.css';

const SIZE = 20;
const cap = (s = '') => s.charAt(0).toUpperCase() + s.slice(1);

export default function AdminContent() {
  useDocumentTitle('Content');
  const toast = useToast();
  const L = useLabels();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);
  const dq = useDebounce(q, 350);
  const { data, loading, error, loaded, reload } = useAsync((signal) => adminService.listContent({ q: dq.trim() || undefined, limit: SIZE, offset: (page - 1) * SIZE }, { signal }), [dq, page]);
  const items = data?.items || [];

  const remove = async () => {
    setBusy(true);
    try { await adminService.deleteContent(del.id); toast.success('Content deleted'); setDel(null); reload(); } catch (e) { toast.error(getFriendlyError(e)); }
    setBusy(false);
  };

  return (
    <div className="page">
      <PageHeader title="Content" description="Review and remove content created on the platform." />
      <div className="b2-toolbar"><SearchInput className="b2-search" value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search by title or owner" /></div>
      {error && !items.length ? <ErrorState message={error} onRetry={reload} /> : (
        <>
          <DataTable
            caption="Content"
            loading={!loaded && loading}
            rows={items}
            emptyTitle="No content found"
            emptyDescription="Try a different search."
            columns={[
              { key: 'title', header: 'Title', primary: true },
              { key: 'owner', header: 'Owner', render: (c) => c.owner_name || c.owner_email },
              { key: 'status', header: 'Status', render: (c) => <Badge>{cap(c.status)}</Badge> },
              { key: 'platform', header: 'Platform', hideOnMobile: true, render: (c) => (c.platform ? (L.platform(c.platform) || c.platform) : '-') },
              { key: 'category', header: 'Category', hideOnMobile: true, render: (c) => c.category || '-' },
              { key: 'created_at', header: 'Created', hideOnMobile: true, render: (c) => formatDate(c.created_at) },
              { key: 'actions', header: '', align: 'right', render: (c) => <IconButton icon={Trash2} label="Delete" variant="danger" onClick={() => setDel(c)} /> },
            ]}
          />
          <Pagination page={page} pageSize={SIZE} total={data?.total || 0} onChange={setPage} />
        </>
      )}
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={remove} loading={busy} danger title="Delete this content?" description={`"${del?.title}" will be removed and its owner will be notified.`} confirmLabel="Delete" />
    </div>
  );
}
