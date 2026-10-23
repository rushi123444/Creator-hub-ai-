import { useState } from 'react';
import { Plus, Eye, Pencil, Copy, Trash2, CalendarClock, FileText } from 'lucide-react';
import { Button, ConfirmDialog, DataTable, FormField, IconButton, Input, LanguageSelect, Modal, PageHeader, PlatformIcon, Select, SearchInput, StatusPill, Tabs, Textarea, useToast } from '../components';
import { useI18n } from '../i18n';
import { useAsync } from '../hooks/useAsync.js';
import { useDebounce } from '../hooks/useDebounce.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useLabels } from '../hooks/useLabels.js';
import { useMeta } from '../hooks/useMeta.js';
import { useAction } from '../hooks/useAction.js';
import { ErrorState } from '../components';
import { contentService, getFriendlyError } from '../services';
import { STATUSES, CONTENT_TYPES, formatDate, formatDateTime, combineLocalToUtcIso, splitIsoToLocal, todayKey } from '../utils';
import '../styles/pagesB2.css';

const BLANK = { title: '', topic: '', platform: 'instagram', language: 'en', status: 'idea', content_type: 'reel', body: '', notes: '' };

export default function Content() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const L = useLabels();
  const meta = useMeta();
  useDocumentTitle(t('nav.content', 'Content'));
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const q = useDebounce(search, 350);
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(null); // {id?, ...fields}
  const [deleting, setDeleting] = useState(null);
  const [scheduling, setScheduling] = useState(null);
  const [busyId, setBusyId] = useState('');

  const { data, loading, loaded, error, reload } = useAsync((signal) => contentService.list({ status: tab === 'all' ? undefined : tab, q: q.trim() || undefined, limit: 100 }, { signal }), [tab, q]);
  const items = data?.items || [];
  const counts = data?.counts || {};

  const tabs = [{ value: 'all', label: t('common.all', 'All'), count: counts.all }, ...STATUSES.map((s) => ({ value: s.value, label: L.status(s.value), count: counts[s.value] }))];
  const tabsOrdered = ['all', 'idea', 'draft', 'script', 'recording', 'editing', 'scheduled', 'published'].map((v) => tabs.find((x) => x.value === v));

  const save = useAction((form) => (form.id ? contentService.update(form.id, strip(form)) : contentService.create(strip(form))));
  const del = useAction((id) => contentService.remove(id));
  const sched = useAction(({ id, at, platform }) => contentService.schedule(id, { scheduled_at: at, platform }));

  const onSave = async () => {
    if (!editing.title.trim()) return;
    const r = await save.run({ ...editing, title: editing.title.trim() });
    if (r) { toast.success(t('toast.saved', 'Saved')); setEditing(null); reload(); } else toast.error(save.error || getFriendlyError(null));
  };
  const onDelete = async () => {
    const r = await del.run(deleting.id);
    if (r !== undefined) { toast.success(t('toast.deleted', 'Deleted')); setDeleting(null); reload(); } else toast.error(del.error);
  };
  const onDup = async (row) => {
    setBusyId(row.id);
    try { await contentService.duplicate(row.id); toast.success(t('content.duplicated', 'Duplicated')); reload(); } catch (e) { toast.error(getFriendlyError(e)); }
    setBusyId('');
  };
  const onSchedule = async () => {
    if (!scheduling.date) return;
    const r = await sched.run({ id: scheduling.row.id, at: combineLocalToUtcIso(scheduling.date, scheduling.time), platform: scheduling.row.platform || undefined });
    if (r) { toast.success(t('content.scheduled', 'Scheduled')); setScheduling(null); reload(); } else toast.error(sched.error);
  };
  const openSchedule = (row) => {
    const s = row.scheduled_at ? splitIsoToLocal(row.scheduled_at) : { date: todayKey(), time: '09:00' };
    setScheduling({ row, ...s });
  };
  const openEdit = (row) => setEditing(row ? { id: row.id, title: row.title || '', topic: row.topic || '', platform: row.platform || 'instagram', language: row.language || 'en', status: row.status || 'idea', content_type: row.content_type || 'reel', body: row.body || '', notes: row.notes || '' } : { ...BLANK });

  const actions = (row) => (
    <div className="b2-actions" onClick={(e) => e.stopPropagation()}>
      <IconButton icon={Eye} label={t('content.open', 'Open')} size="sm" onClick={() => setViewing(row)} />
      <IconButton icon={Pencil} label={t('common.edit', 'Edit')} size="sm" onClick={() => openEdit(row)} />
      <IconButton icon={Copy} label={t('common.duplicate', 'Duplicate')} size="sm" disabled={busyId === row.id} onClick={() => onDup(row)} />
      <IconButton icon={CalendarClock} label={t('common.schedule', 'Schedule')} size="sm" onClick={() => openSchedule(row)} />
      <IconButton icon={Trash2} label={t('common.delete', 'Delete')} size="sm" variant="danger" onClick={() => setDeleting(row)} />
    </div>
  );

  const columns = [
    { key: 'title', header: t('content.title', 'Title'), primary: true, sortable: true, sortValue: (r) => (r.title || '').toLowerCase(), render: (r) => <strong>{r.title}</strong> },
    { key: 'topic', header: t('content.topic', 'Topic'), render: (r) => r.topic || '-' },
    { key: 'platform', header: t('content.platform', 'Platform'), render: (r) => <PlatformIcon platform={r.platform} size={14} withLabel /> },
    { key: 'language', header: t('content.language', 'Language'), render: (r) => L.language(r.language) },
    { key: 'status', header: t('content.status', 'Status'), render: (r) => <StatusPill status={r.status} /> },
    { key: 'created_at', header: t('content.created', 'Created'), sortable: true, sortValue: (r) => r.created_at, render: (r) => formatDate(r.created_at, { lang }) },
    { key: 'updated_at', header: t('content.updated', 'Updated'), sortable: true, sortValue: (r) => r.updated_at, render: (r) => formatDate(r.updated_at, { lang }) },
    { key: 'actions', header: t('common.actions', 'Actions'), align: 'right', render: actions },
  ];

  const field = (k) => (e) => setEditing((s) => ({ ...s, [k]: e.target.value }));

  return (
    <div className="page">
      <PageHeader title={t('nav.content', 'Content')} description={t('content.desc', 'Keep every idea, script and post in one place.')} actions={<Button icon={Plus} onClick={() => openEdit(null)}>{t('content.add', 'Add content')}</Button>} />
      <div className="b2-toolbar">
        <div className="b2-tabs"><Tabs tabs={tabsOrdered} value={tab} onChange={setTab} ariaLabel={t('content.statusTabs', 'Content status')} /></div>
        <SearchInput className="b2-search" value={search} onChange={setSearch} placeholder={t('content.search', 'Search content')} />
      </div>
      {error && !loaded ? <ErrorState message={error} onRetry={reload} /> : (
        <DataTable columns={columns} rows={items} loading={loading && !loaded} defaultSort={{ key: 'updated_at', dir: 'desc' }}
          emptyIcon={FileText} emptyTitle={q || tab !== 'all' ? t('content.noMatch', 'Nothing found') : t('content.empty', 'No content yet')}
          emptyDescription={q || tab !== 'all' ? t('content.noMatchDesc', 'Try another tab or search term.') : t('content.emptyDesc', 'Add your first idea to get started.')}
          emptyAction={<Button icon={Plus} onClick={() => openEdit(null)}>{t('content.add', 'Add content')}</Button>}
          onRowClick={setViewing} caption={t('nav.content', 'Content')} />
      )}

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.title} size="lg"
        footer={viewing && <><Button variant="ghost" onClick={() => setViewing(null)}>{t('common.close', 'Close')}</Button><Button icon={Pencil} onClick={() => { const r = viewing; setViewing(null); openEdit(r); }}>{t('common.edit', 'Edit')}</Button></>}>
        {viewing && (
          <div className="b2-viewer">
            <div className="b2-row"><StatusPill status={viewing.status} /><PlatformIcon platform={viewing.platform} size={14} withLabel /><span className="b2-muted">{L.language(viewing.language)}</span></div>
            {viewing.topic && <><h4>{t('content.topic', 'Topic')}</h4><p style={{ margin: 0 }}>{viewing.topic}</p></>}
            {viewing.scheduled_at && <><h4>{t('content.scheduledFor', 'Scheduled for')}</h4><p style={{ margin: 0 }}>{formatDateTime(viewing.scheduled_at, { lang })}</p></>}
            {viewing.body && <><h4>{t('content.body', 'Script / body')}</h4><pre>{viewing.body}</pre></>}
            {viewing.caption && <><h4>{t('content.caption', 'Caption')}</h4><pre>{viewing.caption}</pre></>}
            {!!viewing.hashtags?.length && <><h4>{t('content.hashtags', 'Hashtags')}</h4><p style={{ margin: 0 }}>{viewing.hashtags.map((h) => (String(h).startsWith('#') ? h : `#${h}`)).join(' ')}</p></>}
            {viewing.notes && <><h4>{t('content.notes', 'Notes')}</h4><pre>{viewing.notes}</pre></>}
            {!viewing.body && !viewing.caption && !viewing.notes && <p className="b2-muted">{t('content.nothingYet', 'No script or notes added yet.')}</p>}
          </div>
        )}
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? t('content.editTitle', 'Edit content') : t('content.add', 'Add content')} size="lg"
        footer={<><Button variant="ghost" onClick={() => setEditing(null)}>{t('common.cancel', 'Cancel')}</Button><Button loading={save.pending} disabled={!editing?.title?.trim()} onClick={onSave}>{t('common.save', 'Save')}</Button></>}>
        {editing && (
          <div className="b2-form">
            <FormField label={t('content.title', 'Title')} required className="b2-full" error={save.fieldErrors.title}><Input value={editing.title} onChange={field('title')} maxLength={200} /></FormField>
            <FormField label={t('content.topic', 'Topic')}><Input value={editing.topic} onChange={field('topic')} /></FormField>
            <FormField label={t('content.type', 'Type')}><Select value={editing.content_type} onChange={field('content_type')} options={CONTENT_TYPES.map((c) => ({ value: c.value, label: L.contentType(c.value) }))} /></FormField>
            <FormField label={t('content.platform', 'Platform')}><Select value={editing.platform} onChange={field('platform')} options={meta.platforms.map((p) => ({ value: p.slug, label: L.platform(p.slug) || p.name }))} /></FormField>
            <FormField label={t('content.language', 'Language')}><LanguageSelect variant="field" value={editing.language} onChange={(c) => setEditing((s) => ({ ...s, language: c }))} /></FormField>
            <FormField label={t('content.status', 'Status')}><Select value={editing.status} onChange={field('status')} options={STATUSES.map((s) => ({ value: s.value, label: L.status(s.value) }))} /></FormField>
            <FormField label={t('content.body', 'Script / body')} className="b2-full"><Textarea rows={6} value={editing.body} onChange={field('body')} /></FormField>
            <FormField label={t('content.notes', 'Notes')} className="b2-full"><Textarea rows={3} value={editing.notes} onChange={field('notes')} /></FormField>
          </div>
        )}
      </Modal>

      <Modal open={!!scheduling} onClose={() => setScheduling(null)} title={t('content.scheduleTitle', 'Schedule content')} description={scheduling?.row?.title} size="sm"
        footer={<><Button variant="ghost" onClick={() => setScheduling(null)}>{t('common.cancel', 'Cancel')}</Button><Button loading={sched.pending} disabled={!scheduling?.date} onClick={onSchedule}>{t('common.schedule', 'Schedule')}</Button></>}>
        {scheduling && (
          <div className="b2-stack">
            <FormField label={t('content.date', 'Date')}><Input type="date" value={scheduling.date} onChange={(e) => setScheduling((s) => ({ ...s, date: e.target.value }))} /></FormField>
            <FormField label={t('content.time', 'Time')}><Input type="time" value={scheduling.time} onChange={(e) => setScheduling((s) => ({ ...s, time: e.target.value }))} /></FormField>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={onDelete} danger loading={del.pending}
        title={t('content.deleteTitle', 'Delete this content?')} description={t('content.deleteDesc', '"{title}" will be removed permanently.', { title: deleting?.title || '' })} confirmLabel={t('common.delete', 'Delete')} />
    </div>
  );
}

function strip(f) {
  const { id, ...rest } = f;
  return rest;
}
