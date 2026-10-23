import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, ConfirmDialog, DataTable, ErrorState, FormField, IconButton, Input, Modal, PageHeader, Switch, Textarea, useToast } from '../../components';
import { useAsync } from '../../hooks/useAsync.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { adminService, getFriendlyError } from '../../services';
import '../../styles/pagesB2.css';

const EMPTY = { name: '', description: '', is_active: true };

export default function AdminCategories() {
  useDocumentTitle('Categories');
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data, loading, error, loaded, reload } = useAsync((signal) => adminService.listCategories({ signal }), []);
  const items = data?.items || [];

  const save = async () => {
    setBusy(true);
    const body = { name: form.name.trim(), description: form.description.trim() || null, is_active: form.is_active };
    try {
      if (form.id) await adminService.updateCategory(form.id, body); else await adminService.createCategory(body);
      toast.success(form.id ? 'Category updated' : 'Category added'); setForm(null); reload();
    } catch (e) { toast.error(getFriendlyError(e)); }
    setBusy(false);
  };
  const remove = async () => {
    setBusy(true);
    try { await adminService.deleteCategory(del.id); toast.success('Category deleted'); setDel(null); reload(); } catch (e) { toast.error(getFriendlyError(e)); }
    setBusy(false);
  };

  return (
    <div className="page">
      <PageHeader title="Categories" description="Topics creators and trends are grouped by." actions={<Button icon={Plus} onClick={() => setForm({ ...EMPTY })}>Add category</Button>} />
      {error && !items.length ? <ErrorState message={error} onRetry={reload} /> : (
        <DataTable
          caption="Categories"
          loading={!loaded && loading}
          rows={items}
          emptyTitle="No categories yet"
          emptyDescription="Add the first one to get started."
          emptyAction={<Button icon={Plus} onClick={() => setForm({ ...EMPTY })}>Add category</Button>}
          columns={[
            { key: 'name', header: 'Name', primary: true },
            { key: 'description', header: 'Description', hideOnMobile: true, render: (c) => c.description || '-' },
            { key: 'is_active', header: 'Status', render: (c) => <Badge tone={c.is_active ? 'success' : 'neutral'} dot>{c.is_active ? 'Active' : 'Hidden'}</Badge> },
            { key: 'actions', header: '', align: 'right', render: (c) => (
              <span className="b2-row" style={{ justifyContent: 'flex-end' }}>
                <IconButton icon={Pencil} label="Edit" onClick={() => setForm({ id: c.id, name: c.name, description: c.description || '', is_active: c.is_active })} />
                <IconButton icon={Trash2} label="Delete" variant="danger" onClick={() => setDel(c)} />
              </span>
            ) },
          ]}
        />
      )}
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit category' : 'Add category'} footer={<><Button variant="secondary" onClick={() => setForm(null)}>Cancel</Button><Button loading={busy} disabled={(form?.name || '').trim().length < 2} onClick={save}>Save</Button></>}>
        {form && (
          <div className="b2-stack">
            <FormField label="Name" required><Input value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} /></FormField>
            <FormField label="Description" optionalLabel="Optional"><Textarea rows={3} maxLength={500} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></FormField>
            <Switch checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} label="Active" description="Inactive categories are hidden from creators." />
          </div>
        )}
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={remove} loading={busy} danger title="Delete this category?" description={`"${del?.name}" will be removed.`} confirmLabel="Delete" />
    </div>
  );
}
