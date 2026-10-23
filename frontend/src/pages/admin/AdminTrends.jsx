import { useState } from 'react';
import { Info, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Card, ConfirmDialog, DataTable, ErrorState, FormField, IconButton, Input, Modal, PageHeader, PlatformIcon, SearchInput, Select, Switch, TagList, useToast } from '../../components';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useLabels } from '../../hooks/useLabels.js';
import { useMeta } from '../../hooks/useMeta.js';
import { adminService, getFriendlyError } from '../../services';
import { formatNumber, formatPercent } from '../../utils';
import '../../styles/pagesB2.css';

const EMPTY = { topic: '', category: '', platform: '', language: 'en', growth_pct: '0', engagement_rate: '0', content_count: '0', topic_frequency: '0', related_topics: '', is_active: true };
const list = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);

export default function AdminTrends() {
  useDocumentTitle('Trends');
  const toast = useToast();
  const L = useLabels();
  const meta = useMeta();
  const [q, setQ] = useState('');
  const [form, setForm] = useState(null);
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);
  const dq = useDebounce(q, 350);
  const { data, loading, error, loaded, reload } = useAsync((signal) => adminService.listTrends({ q: dq.trim() || undefined }, { signal }), [dq]);
  const items = data?.items || [];
  const set = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

  const open = (t) => setForm(t ? { id: t.id, topic: t.topic, category: meta.categories.find((c) => c.name === t.category || c.slug === t.category)?.slug || '', platform: t.platform || '', language: t.language || 'en', growth_pct: String(t.growth_pct ?? 0), engagement_rate: String(t.engagement_rate ?? 0), content_count: String(t.content_count ?? 0), topic_frequency: String(t.topic_frequency ?? 0), related_topics: (t.related_topics || []).join(', '), is_active: t.is_active !== false } : { ...EMPTY });

  const save = async () => {
    setBusy(true);
    const body = {
      topic: form.topic.trim(), category: form.category || null, platform: form.platform || null, language: form.language,
      growth_pct: Number(form.growth_pct) || 0, engagement_rate: Number(form.engagement_rate) || 0,
      content_count: Math.max(0, parseInt(form.content_count, 10) || 0), topic_frequency: Math.max(0, parseInt(form.topic_frequency, 10) || 0),
      related_topics: list(form.related_topics), is_active: form.is_active,
    };
    try {
      if (form.id) await adminService.updateTrend(form.id, body); else await adminService.createTrend(body);
      toast.success(form.id ? 'Trend updated' : 'Trend added'); setForm(null); reload();
    } catch (e) { toast.error(getFriendlyError(e)); }
    setBusy(false);
  };
  const remove = async () => {
    setBusy(true);
    try { await adminService.deleteTrend(del.id); toast.success('Trend deleted'); setDel(null); reload(); } catch (e) { toast.error(getFriendlyError(e)); }
    setBusy(false);
  };

  return (
    <div className="page">
      <PageHeader title="Trends" description="Add and maintain the trends creators see." actions={<Button icon={Plus} onClick={() => open(null)}>Add trend</Button>} />
      <div className="b2-stack">
        <Card className="b2-note"><Info size={16} /><span>The Trend Score is calculated automatically from the numbers you enter, using the project-defined formula (recency, growth, engagement and topic frequency). It is not an official platform metric.</span></Card>
        <div className="b2-toolbar" style={{ marginBottom: 0 }}><SearchInput className="b2-search" value={q} onChange={setQ} placeholder="Search trends" /></div>
        {error && !items.length ? <ErrorState message={error} onRetry={reload} /> : (
          <DataTable
            caption="Trends"
            loading={!loaded && loading}
            rows={items}
            emptyTitle="No trends found"
            emptyDescription="Add a trend or change your search."
            emptyAction={<Button icon={Plus} onClick={() => open(null)}>Add trend</Button>}
            columns={[
              { key: 'topic', header: 'Topic', primary: true },
              { key: 'category', header: 'Category', hideOnMobile: true, render: (t) => t.category || '-' },
              { key: 'platform', header: 'Platform', render: (t) => (t.platform ? <PlatformIcon platform={t.platform} size={14} withLabel /> : '-') },
              { key: 'trend_score', header: 'Score', align: 'right', render: (t) => Math.round(t.trend_score) },
              { key: 'growth_pct', header: 'Growth', hideOnMobile: true, align: 'right', render: (t) => formatPercent(t.growth_pct, 0) },
              { key: 'engagement_rate', header: 'Engagement', hideOnMobile: true, align: 'right', render: (t) => formatPercent(t.engagement_rate, 1) },
              { key: 'content_count', header: 'Content', hideOnMobile: true, align: 'right', render: (t) => formatNumber(t.content_count) },
              { key: 'is_active', header: 'Status', render: (t) => <Badge tone={t.is_active ? 'success' : 'neutral'} dot>{t.is_active ? 'Shown' : 'Hidden'}</Badge> },
              { key: 'actions', header: '', align: 'right', render: (t) => (
                <span className="b2-row" style={{ justifyContent: 'flex-end' }}>
                  <IconButton icon={Pencil} label="Edit" onClick={() => open(t)} />
                  <IconButton icon={Trash2} label="Delete" variant="danger" onClick={() => setDel(t)} />
                </span>
              ) },
            ]}
          />
        )}
      </div>
      <Modal open={!!form} onClose={() => setForm(null)} size="lg" title={form?.id ? 'Edit trend' : 'Add trend'} description="The score updates automatically when you save." footer={<><Button variant="secondary" onClick={() => setForm(null)}>Cancel</Button><Button loading={busy} disabled={(form?.topic || '').trim().length < 2} onClick={save}>Save</Button></>}>
        {form && (
          <div className="b2-form">
            <FormField label="Topic" required className="b2-full"><Input value={form.topic} maxLength={200} onChange={set('topic')} /></FormField>
            <FormField label="Category"><Select value={form.category} onChange={set('category')} options={[{ value: '', label: 'None' }, ...meta.categories.map((c) => ({ value: c.slug, label: c.name }))]} /></FormField>
            <FormField label="Platform"><Select value={form.platform} onChange={set('platform')} options={[{ value: '', label: 'None' }, ...meta.platforms.map((p) => ({ value: p.slug, label: L.platform(p.slug) || p.name }))]} /></FormField>
            <FormField label="Language"><Select value={form.language} onChange={set('language')} options={[{ value: 'en', label: 'English' }, { value: 'hi', label: 'Hindi' }, { value: 'mr', label: 'Marathi' }]} /></FormField>
            <FormField label="Growth (%)"><Input type="number" value={form.growth_pct} onChange={set('growth_pct')} /></FormField>
            <FormField label="Engagement rate (%)"><Input type="number" min={0} max={100} step="0.1" value={form.engagement_rate} onChange={set('engagement_rate')} /></FormField>
            <FormField label="Content count"><Input type="number" min={0} value={form.content_count} onChange={set('content_count')} /></FormField>
            <FormField label="Topic frequency"><Input type="number" min={0} value={form.topic_frequency} onChange={set('topic_frequency')} /></FormField>
            <FormField label="Related topics" hint="Separate with commas" className="b2-full"><Input value={form.related_topics} onChange={set('related_topics')} /></FormField>
            <Switch checked={form.is_active} onChange={(v) => setForm((s) => ({ ...s, is_active: v }))} label="Show to creators" />
          </div>
        )}
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={remove} loading={busy} danger title="Delete this trend?" description={`"${del?.topic}" will be removed.`} confirmLabel="Delete" />
    </div>
  );
}
