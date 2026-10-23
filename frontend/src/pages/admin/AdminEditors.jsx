import { useState } from 'react';
import { BadgeCheck, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, ConfirmDialog, DataTable, ErrorState, FormField, IconButton, Input, Modal, PageHeader, SearchInput, Select, Switch, TagList, Textarea, useToast } from '../../components';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useLabels } from '../../hooks/useLabels.js';
import { adminService, getFriendlyError } from '../../services';
import { EDITOR_SPECIALIZATIONS } from '../../utils/constants.js';
import '../../styles/pagesB2.css';

const SPECS = EDITOR_SPECIALIZATIONS.map((s) => ({ value: s.value ?? s.slug ?? s.code, label: s.label }));
const LANGS = [{ value: 'en', label: 'English' }, { value: 'hi', label: 'Hindi' }, { value: 'mr', label: 'Marathi' }];
const STATUS = [{ value: 'active', label: 'Active' }, { value: 'flagged', label: 'Flagged' }, { value: 'suspended', label: 'Suspended' }];
const TONE = { active: 'success', flagged: 'warning', suspended: 'danger' };
const EMPTY = { display_name: '', headline: '', specialization: SPECS[0]?.value || 'reels', skills: '', languages: ['en'], experience_years: '0', portfolio_url: '', instagram_url: '', contact_email: '', bio: '', is_verified: false, status: 'active' };
const list = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);

export default function AdminEditors() {
  useDocumentTitle('Editors');
  const toast = useToast();
  const L = useLabels();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [form, setForm] = useState(null);
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);
  const dq = useDebounce(q, 350);
  const { data, loading, error, loaded, reload } = useAsync((signal) => adminService.listEditors({ q: dq.trim() || undefined, status: status || undefined }, { signal }), [dq, status]);
  const items = data?.items || [];
  const set = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

  const open = (e) => setForm(e ? { ...EMPTY, ...Object.fromEntries(Object.entries(e).map(([k, v]) => [k, v ?? ''])), id: e.id, skills: (e.skills || []).join(', '), languages: e.languages || [], experience_years: String(e.experience_years ?? 0), is_verified: !!e.is_verified } : { ...EMPTY });
  const toggleLang = (c) => setForm((s) => ({ ...s, languages: s.languages.includes(c) ? s.languages.filter((x) => x !== c) : [...s.languages, c] }));

  const save = async () => {
    setBusy(true);
    const body = {
      display_name: form.display_name.trim(), headline: form.headline.trim() || null, specialization: form.specialization,
      skills: list(form.skills), languages: form.languages, experience_years: Number(form.experience_years) || 0,
      portfolio_url: form.portfolio_url.trim() || null, instagram_url: form.instagram_url.trim() || null,
      contact_email: form.contact_email.trim() || null, bio: form.bio.trim() || null, is_verified: form.is_verified, status: form.status,
    };
    try {
      if (form.id) await adminService.updateEditor(form.id, body); else await adminService.createEditor(body);
      toast.success(form.id ? 'Editor updated' : 'Editor added'); setForm(null); reload();
    } catch (e) { toast.error(getFriendlyError(e)); }
    setBusy(false);
  };
  const moderate = async (e, body, msg) => {
    try { await adminService.moderateEditor(e.id, body); toast.success(msg); reload(); } catch (err) { toast.error(getFriendlyError(err)); }
  };
  const remove = async () => {
    setBusy(true);
    try { await adminService.deleteEditor(del.id); toast.success('Editor deleted'); setDel(null); reload(); } catch (e) { toast.error(getFriendlyError(e)); }
    setBusy(false);
  };

  return (
    <div className="page">
      <PageHeader title="Editors" description="Manage the editor directory and keep it trustworthy." actions={<Button icon={Plus} onClick={() => open(null)}>Add editor</Button>} />
      <div className="b2-toolbar">
        <SearchInput className="b2-search" value={q} onChange={setQ} placeholder="Search editors" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" options={[{ value: '', label: 'All statuses' }, ...STATUS]} />
      </div>
      {error && !items.length ? <ErrorState message={error} onRetry={reload} /> : (
        <DataTable
          caption="Editors"
          loading={!loaded && loading}
          rows={items}
          emptyTitle="No editors found"
          emptyDescription="Add an editor or change your filters."
          emptyAction={<Button icon={Plus} onClick={() => open(null)}>Add editor</Button>}
          columns={[
            { key: 'display_name', header: 'Name', primary: true, render: (e) => <span>{e.display_name}{e.is_verified && <BadgeCheck size={14} style={{ marginLeft: 6, verticalAlign: -2, color: 'var(--accent-text)' }} aria-label="Verified" />}</span> },
            { key: 'specialization', header: 'Specialization', render: (e) => L.spec(e.specialization) || e.specialization },
            { key: 'skills', header: 'Skills', hideOnMobile: true, render: (e) => <TagList items={e.skills || []} max={3} /> },
            { key: 'languages', header: 'Languages', hideOnMobile: true, render: (e) => (e.languages || []).map((c) => L.language(c)).join(', ') },
            { key: 'status', header: 'Status', render: (e) => (
              <Select size="sm" aria-label={`Status for ${e.display_name}`} value={e.status} options={STATUS} onChange={(ev) => moderate(e, { status: ev.target.value }, 'Status updated')} />
            ) },
            { key: 'actions', header: '', align: 'right', render: (e) => (
              <span className="b2-row" style={{ justifyContent: 'flex-end' }}>
                <IconButton icon={BadgeCheck} label={e.is_verified ? 'Remove verification' : 'Verify'} active={e.is_verified} onClick={() => moderate(e, { status: e.status, is_verified: !e.is_verified }, e.is_verified ? 'Verification removed' : 'Editor verified')} />
                <IconButton icon={Pencil} label="Edit" onClick={() => open(e)} />
                <IconButton icon={Trash2} label="Delete" variant="danger" onClick={() => setDel(e)} />
              </span>
            ) },
          ]}
        />
      )}
      <Modal open={!!form} onClose={() => setForm(null)} size="lg" title={form?.id ? 'Edit editor' : 'Add editor'} footer={<><Button variant="secondary" onClick={() => setForm(null)}>Cancel</Button><Button loading={busy} disabled={!form?.display_name.trim() || !form?.languages.length} onClick={save}>Save</Button></>}>
        {form && (
          <div className="b2-form">
            <FormField label="Display name" required><Input value={form.display_name} maxLength={120} onChange={set('display_name')} /></FormField>
            <FormField label="Specialization"><Select value={form.specialization} onChange={set('specialization')} options={SPECS} /></FormField>
            <FormField label="Headline" optionalLabel="Optional" className="b2-full"><Input value={form.headline} maxLength={160} onChange={set('headline')} /></FormField>
            <FormField label="Skills" hint="Separate with commas" className="b2-full"><Input value={form.skills} onChange={set('skills')} placeholder="Color grading, Subtitles, Sound design" /></FormField>
            <FormField label="Languages" required className="b2-full">
              <div className="b2-row">{LANGS.map((l) => <Button key={l.value} size="sm" variant={form.languages.includes(l.value) ? 'primary' : 'secondary'} onClick={() => toggleLang(l.value)} aria-pressed={form.languages.includes(l.value)}>{l.label}</Button>)}</div>
            </FormField>
            <FormField label="Years of experience"><Input type="number" min={0} max={60} value={form.experience_years} onChange={set('experience_years')} /></FormField>
            <FormField label="Contact email" optionalLabel="Optional"><Input type="email" value={form.contact_email} onChange={set('contact_email')} /></FormField>
            <FormField label="Portfolio link" optionalLabel="Optional"><Input value={form.portfolio_url} onChange={set('portfolio_url')} placeholder="https://" /></FormField>
            <FormField label="Instagram link" optionalLabel="Optional"><Input value={form.instagram_url} onChange={set('instagram_url')} placeholder="https://" /></FormField>
            <FormField label="Bio" optionalLabel="Optional" className="b2-full"><Textarea rows={3} maxLength={2000} value={form.bio} onChange={set('bio')} /></FormField>
            <FormField label="Moderation status"><Select value={form.status} onChange={set('status')} options={STATUS} /></FormField>
            <Switch checked={form.is_verified} onChange={(v) => setForm((s) => ({ ...s, is_verified: v }))} label="Verified" />
          </div>
        )}
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={remove} loading={busy} danger title="Delete this editor?" description={`${del?.display_name}'s profile will be removed from the directory.`} confirmLabel="Delete" />
    </div>
  );
}
