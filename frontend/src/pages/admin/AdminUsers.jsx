import { useState } from 'react';
import { Pencil, Trash2, UserX, UserCheck } from 'lucide-react';
import { Badge, Button, ConfirmDialog, DataTable, ErrorState, FormField, IconButton, Input, Modal, PageHeader, SearchInput, Select, useToast } from '../../components';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { adminService, getFriendlyError } from '../../services';
import { formatDate } from '../../utils';
import '../../styles/pagesB2.css';

const cap = (s = '') => s.charAt(0).toUpperCase() + s.slice(1);

export default function AdminUsers() {
  useDocumentTitle('Users');
  const toast = useToast();
  const { user: me } = useAuth();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);
  const dq = useDebounce(q, 350);
  const { data, loading, error, loaded, reload } = useAsync((signal) => adminService.listUsers({ q: dq.trim() || undefined, role: role || undefined }, { signal }), [dq, role]);
  const items = data?.items || [];

  const patch = async (u, body, msg) => {
    try { await adminService.updateUser(u.id, body); toast.success(msg); reload(); } catch (e) { toast.error(getFriendlyError(e)); }
  };
  const save = async () => {
    setBusy(true);
    try {
      const body = { full_name: edit.full_name.trim() };
      if (edit.role !== edit.orig && edit.role !== 'admin') body.role = edit.role;
      await adminService.updateUser(edit.id, body);
      toast.success('User updated'); setEdit(null); reload();
    } catch (e) { toast.error(getFriendlyError(e)); }
    setBusy(false);
  };
  const remove = async () => {
    setBusy(true);
    try { await adminService.deleteUser(del.id); toast.success('User deleted'); setDel(null); reload(); } catch (e) { toast.error(getFriendlyError(e)); }
    setBusy(false);
  };

  return (
    <div className="page">
      <PageHeader title="Users" description="Manage accounts, roles and access." />
      <div className="b2-toolbar">
        <SearchInput className="b2-search" value={q} onChange={setQ} placeholder="Search by name or email" />
        <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role" options={[{ value: '', label: 'All roles' }, { value: 'creator', label: 'Creators' }, { value: 'editor', label: 'Editors' }, { value: 'admin', label: 'Admins' }]} />
      </div>
      {error && !items.length ? <ErrorState message={error} onRetry={reload} /> : (
        <DataTable
          caption="Users"
          loading={!loaded && loading}
          rows={items}
          emptyTitle="No users found"
          emptyDescription="Try a different search or role."
          columns={[
            { key: 'full_name', header: 'Name', primary: true },
            { key: 'email', header: 'Email' },
            { key: 'role', header: 'Role', render: (u) => <Badge tone={u.role === 'admin' ? 'accent' : 'neutral'}>{cap(u.role)}</Badge> },
            { key: 'is_active', header: 'Status', render: (u) => <Badge tone={u.is_active ? 'success' : 'danger'} dot>{u.is_active ? 'Active' : 'Inactive'}</Badge> },
            { key: 'created_at', header: 'Joined', hideOnMobile: true, render: (u) => formatDate(u.created_at) },
            { key: 'actions', header: '', align: 'right', render: (u) => {
              const self = u.id === me?.id;
              return (
                <span className="b2-row" style={{ justifyContent: 'flex-end' }}>
                  <IconButton icon={u.is_active ? UserX : UserCheck} label={u.is_active ? 'Deactivate' : 'Activate'} disabled={self || u.role === 'admin'} onClick={() => patch(u, { is_active: !u.is_active }, u.is_active ? 'User deactivated' : 'User activated')} />
                  <IconButton icon={Pencil} label="Edit" onClick={() => setEdit({ id: u.id, full_name: u.full_name, role: u.role, orig: u.role })} />
                  <IconButton icon={Trash2} label="Delete" variant="danger" disabled={self} onClick={() => setDel(u)} />
                </span>
              );
            } },
          ]}
        />
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title="Edit user" footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button loading={busy} disabled={!edit?.full_name.trim()} onClick={save}>Save</Button></>}>
        {edit && (
          <div className="b2-stack">
            <FormField label="Full name" required><Input value={edit.full_name} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} /></FormField>
            <FormField label="Role" hint={edit.orig === 'admin' ? 'Admin roles cannot be changed here.' : undefined}>
              <Select value={edit.role} disabled={edit.orig === 'admin'} onChange={(e) => setEdit({ ...edit, role: e.target.value })} options={edit.orig === 'admin' ? [{ value: 'admin', label: 'Admin' }] : [{ value: 'creator', label: 'Creator' }, { value: 'editor', label: 'Editor' }]} />
            </FormField>
          </div>
        )}
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={remove} loading={busy} danger title="Delete this user?" description={`${del?.full_name || 'This user'} and their data will be removed permanently.`} confirmLabel="Delete" />
    </div>
  );
}
