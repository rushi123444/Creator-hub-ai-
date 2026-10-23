import { useState } from 'react';
import { Search, Trash2, Info, ShieldCheck } from 'lucide-react';
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, FormField, IconButton, Input, PageHeader, SampleBadge, SectionCard, Select, Skeleton, Tag, TagList, useToast } from '../components';
import { useI18n } from '../i18n';
import { useAsync } from '../hooks/useAsync.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useLabels } from '../hooks/useLabels.js';
import { useMeta } from '../hooks/useMeta.js';
import { competitorsService, getFriendlyError } from '../services';
import { formatCompact, formatDate } from '../utils';
import '../styles/pagesB2.css';

const list = (a) => (Array.isArray(a) ? a : []);
const txt = (x) => (typeof x === 'string' ? x : x?.name || x?.title || x?.label || x?.text || JSON.stringify(x));

function Block({ title, items }) {
  const arr = list(items);
  return (
    <div>
      <div className="b2-muted">{title}</div>
      {arr.length ? <TagList>{arr.map((x, i) => <Tag key={i}>{txt(x)}</Tag>)}</TagList> : <div className="b2-muted">-</div>}
    </div>
  );
}

function Result({ a, t }) {
  const stat = (label, v) => <div className="b2-metric"><div className="b2-muted">{label}</div><strong>{v}</strong></div>;
  return (
    <SectionCard title={a.display_name || t('comp.result', 'Analysis')} action={a.is_sample ? <SampleBadge /> : null}>
      <div className="b2-stack">
        <div className="b2-metrics">
          {stat(t('comp.frequency', 'Posting frequency'), a.posting_frequency || '-')}
          {stat(t('comp.duration', 'Avg duration'), a.avg_duration_seconds != null ? `${Math.round(a.avg_duration_seconds)}s` : '-')}
          {stat(t('comp.views', 'Views'), formatCompact(a.views ?? 0))}
          {stat(t('comp.likes', 'Likes'), formatCompact(a.likes ?? 0))}
          {stat(t('comp.comments', 'Comments'), formatCompact(a.comments ?? 0))}
        </div>
        <Block title={t('comp.frequent', 'Frequent topics')} items={a.frequent_topics} />
        <Block title={t('comp.topics', 'Topics')} items={a.topics} />
        <Block title={t('comp.categories', 'Categories')} items={a.categories} />
        <Block title={t('comp.formats', 'Popular formats')} items={a.popular_formats} />
        <Block title={t('comp.patterns', 'Posting patterns')} items={a.posting_patterns} />
        <Block title={t('comp.gaps', 'Possible content gaps')} items={a.content_gaps} />
        <div>
          <div className="b2-muted">{t('comp.titles', 'Recent titles')}</div>
          {list(a.titles).length ? <ul>{list(a.titles).map((x, i) => <li key={i}>{txt(x)}</li>)}</ul> : <div className="b2-muted">-</div>}
        </div>
        {a.note && <div className="b2-muted">{a.note}</div>}
      </div>
    </SectionCard>
  );
}

export default function CompetitorAnalysis() {
  const { t } = useI18n();
  const toast = useToast();
  const L = useLabels();
  const meta = useMeta();
  useDocumentTitle(t('nav.competitors', 'Competitor Analysis'));
  const [platform, setPlatform] = useState('youtube');
  const [handle, setHandle] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState(null);
  const [del, setDel] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const saved = useAsync((signal) => competitorsService.list({ signal }), []);
  const items = Array.isArray(saved.data) ? saved.data : saved.data?.items || [];

  const run = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (!handle.trim()) return;
    setBusy(true);
    try {
      const r = await competitorsService.analyze({ platform, handle_or_url: handle.trim() });
      setCurrent(r);
      toast.success(t('comp.done', 'Analysis ready and saved'));
      saved.reload();
    } catch (err) { toast.error(getFriendlyError(err)); }
    setBusy(false);
  };

  const open = async (it) => {
    try { setCurrent(await competitorsService.get(it.id)); window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (err) { toast.error(getFriendlyError(err)); }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await competitorsService.remove(del.id);
      if (current?.id === del.id) setCurrent(null);
      toast.success(t('comp.deleted', 'Analysis deleted'));
      setDel(null); saved.reload();
    } catch (err) { toast.error(getFriendlyError(err)); }
    setDeleting(false);
  };

  return (
    <div className="page">
      <PageHeader title={t('nav.competitors', 'Competitor Analysis')} description={t('comp.desc', 'Study what a public channel posts and find gaps you can own.')} />
      <div className="b2-stack">
        <Card className="b2-note"><ShieldCheck size={16} /><span>{t('comp.privacy', 'Only public information is analysed. Private analytics of any channel are never accessed.')}</span></Card>
        <Card>
          <form className="b2-filters" onSubmit={run} noValidate>
            <FormField label={t('comp.platform', 'Platform')}><Select value={platform} onChange={(e) => setPlatform(e.target.value)} options={meta.platforms.map((p) => ({ value: p.slug, label: L.platform(p.slug) || p.name }))} /></FormField>
            <FormField className="b2-wide" label={t('comp.handle', 'Public channel handle or link')} error={touched && !handle.trim() ? t('comp.required', 'Enter a channel handle or link.') : ''} required>
              <Input icon={Search} value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@channel or https://..." />
            </FormField>
            <div style={{ alignSelf: 'end' }}><Button type="submit" loading={busy}>{t('comp.analyze', 'Analyze')}</Button></div>
          </form>
        </Card>

        {busy && <Card><Skeleton height={24} width="40%" /><Skeleton height={120} style={{ marginTop: 12 }} /></Card>}
        {!busy && current && <Result a={current} t={t} />}

        <SectionCard title={t('comp.saved', 'Saved analyses')}>
          {saved.error && !items.length ? <ErrorState compact message={saved.error} onRetry={saved.reload} />
            : !saved.loaded && saved.loading ? <><Skeleton height={44} /><Skeleton height={44} style={{ marginTop: 8 }} /></>
            : !items.length ? <EmptyState compact icon={Info} title={t('comp.emptyTitle', 'No saved analyses')} description={t('comp.emptyDesc', 'Analyze a public channel to see it here.')} />
            : (
              <div className="b2-list">
                {items.map((it) => (
                  <div key={it.id} className="b2-row b2-between">
                    <button type="button" className="b2-grow" style={{ textAlign: 'left', background: 'none', border: 0, color: 'inherit', cursor: 'pointer' }} onClick={() => open(it)}>
                      <strong>{it.display_name}</strong> {it.is_sample && <SampleBadge />}
                      <div className="b2-muted">{formatDate(it.created_at)}</div>
                    </button>
                    <IconButton icon={Trash2} label={t('common.delete', 'Delete')} variant="danger" onClick={() => setDel(it)} />
                  </div>
                ))}
              </div>
            )}
        </SectionCard>
      </div>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={confirmDelete} loading={deleting} danger title={t('comp.delTitle', 'Delete this analysis?')} description={t('comp.delDesc', 'It will be removed from your saved analyses.')} confirmLabel={t('common.delete', 'Delete')} />
    </div>
  );
}
