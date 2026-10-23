import { useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { Badge, Button, DataTable, ErrorState, FormField, Modal, PageHeader, SegmentedControl, Select, Textarea, useToast } from '../../components';
import { useAsync } from '../../hooks/useAsync.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { adminService, getFriendlyError } from '../../services';
import { formatDateTime } from '../../utils';
import '../../styles/pagesB2.css';

const STATUSES = [{ value: 'open', label: 'Open' }, { value: 'reviewing', label: 'Reviewing' }, { value: 'resolved', label: 'Resolved' }, { value: 'dismissed', label: 'Dismissed' }];
const TONE = { open: 'warning', reviewing: 'info', resolved: 'success', dismissed: 'neutral' };
const cap = (s = '') => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');

export default function AdminReports() {
  useDocumentTitle('Reports');
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [sel, setSel] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data, loading, error, loaded, reload } = useAsync((signal) => adminService.listReports({ status: status || undefined }, { signal }), [status]);
  const items = data?.items || [];

  const save = async () => {
    setBusy(true);
    try {
      await adminService.updateReport(sel.id, { status: sel.status, resolution_note: sel.note.trim() || undefined });
      toast.success('Report updated'); setSel(null); reload();
    } catch (e) { toast.error(getFriendlyError(e)); }
    setBusy(false);
  };

  return (
    <div className="page">
      <PageHeader title="Reports" description="Review reports sent in by users." />
      <div className="b2-toolbar">
        <SegmentedControl ariaLabel="Filter by status" value={status} onChange={setStatus} options={[{ value: '', label: 'All' }, ...STATUSES]} />
      </div>
      {error && !items.length ? <ErrorState message={error} onRetry={reload} /> : (
        <DataTable
          caption="Reports"
          loading={!loaded && loading}
          rows={items}
          emptyIcon={ClipboardCheck}
          emptyTitle="No reports"
          emptyDescription={status ? 'Nothing with this status.' : 'Nothing to review right now.'}
          columns={[
            { key: 'reason', header: 'Reason', primary: true, render: (r) => cap(r.reason) },
            { key: 'target_type', header: 'About', render: (r) => cap(r.target_type) },
            { key: 'reporter_email', header: 'Reported by', hideOnMobile: true, render: (r) => r.reporter_email || '-' },
            { key: 'status', header: 'Status', render: (r) => <Badge tone={TONE[r.status] || 'neutral'} dot>{cap(r.status)}</Badge> },
            { key: 'created_at', header: 'Received', hideOnMobile: true, render: (r) => formatDateTime(r.created_at) },
            { key: 'actions', header: '', align: 'right', render: (r) => <Button size="sm" variant="secondary" onClick={() => setSel({ ...r, note: r.resolution_note || '' })}>Review</Button> },
          ]}
        />
      )}
      <Modal open={!!sel} onClose={() => setSel(null)} title="Review report" footer={<><Button variant="secondary" onClick={() => setSel(null)}>Cancel</Button><Button loading={busy} onClick={save}>Save</Button></>}>
        {sel && (
          <div className="b2-stack">
            <div>
              <strong>{cap(sel.reason)}</strong>
              <div className="b2-muted">{cap(sel.target_type)} · from {sel.reporter_email || 'a user'} · {formatDateTime(sel.created_at)}</div>
            </div>
            {sel.details && <div className="b2-code" style={{ fontFamily: 'inherit', whiteSpace: 'pre-wrap' }}>{sel.details}</div>}
            <FormField label="Status"><Select value={sel.status} onChange={(e) => setSel({ ...sel, status: e.target.value })} options={STATUSES} /></FormField>
            <FormField label="Resolution note" optionalLabel="Optional"><Textarea rows={3} maxLength={1000} value={sel.note} onChange={(e) => setSel({ ...sel, note: e.target.value })} /></FormField>
          </div>
        )}
      </Modal>
    </div>
  );
}
