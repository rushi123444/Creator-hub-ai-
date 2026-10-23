import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, Bookmark, CalendarClock, Eye, Heart, Lightbulb, Plus, Sparkles, TrendingUp, Wand2, FileText, Hash, Flame } from 'lucide-react';
import {
  Badge, Button, ChartCard, EmptyState, ErrorState, FormField, Input, Modal, PageHeader, SampleBadge, SectionCard, Select,
  Skeleton, StatCard, AreaTrend, LineTrend, BarCompare, DonutChart, ChartLegend, StatusPill, PlatformIcon, useToast,
} from '../components';
import { useAuth } from '../context/AuthContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { useAction } from '../hooks/useAction.js';
import { useMeta } from '../hooks/useMeta.js';
import { useLabels } from '../hooks/useLabels.js';
import { useI18n } from '../i18n';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { dashboardService, contentService } from '../services';
import { formatCompact, formatPercent, formatDateTime, formatShortDate, dayPart, formatRelative } from '../utils';
import '../styles/pagesA.css';

function AddContentModal({ open, onClose, onDone }) {
  const { t } = useI18n();
  const toast = useToast();
  const { platforms } = useMeta();
  const [f, setF] = useState({ title: '', platform: 'instagram', status: 'idea' });
  const [err, setErr] = useState('');
  const create = useAction((body) => contentService.create(body));
  const submit = async (e) => {
    e.preventDefault();
    if (!f.title.trim()) { setErr(t('dash.titleReq', 'Give your content a title.')); return; }
    setErr('');
    const row = await create.run({ title: f.title.trim(), topic: f.title.trim(), platform: f.platform, status: f.status, content_type: 'reel' });
    if (row) { toast.success(t('toast.saved', 'Saved')); setF({ title: '', platform: f.platform, status: 'idea' }); onDone?.(); onClose(); }
  };
  return (
    <Modal open={open} onClose={onClose} title={t('dash.addContent', 'Add Content')} size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel', 'Cancel')}</Button><Button variant="primary" type="submit" form="add-content-form" loading={create.pending}>{t('common.save', 'Save')}</Button></>}>
      <form id="add-content-form" className="stack" onSubmit={submit} noValidate>
        {create.error && <div className="auth-alert" role="alert">{create.error}</div>}
        <FormField label={t('dash.contentTitle', 'Title')} error={err} required><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus /></FormField>
        <div className="form-grid">
          <FormField label={t('studio.platform', 'Platform')}><Select value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })} options={platforms.map((p) => ({ value: p.slug, label: p.name }))} /></FormField>
          <FormField label={t('dash.status', 'Status')}><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} options={[{ value: 'idea', label: t('status.idea', 'Idea') }, { value: 'draft', label: t('status.draft', 'Draft') }, { value: 'script', label: t('status.script', 'Script') }]} /></FormField>
        </div>
      </form>
    </Modal>
  );
}

export default function Dashboard() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const L = useLabels();
  const [adding, setAdding] = useState(false);
  useDocumentTitle(t('nav.dashboard', 'Dashboard'));
  const { data, loading, error, reload, loaded } = useAsync((signal) => dashboardService.get({ signal }), []);

  const part = dayPart();
  const name = data?.greeting_name || user?.full_name?.split(' ')[0] || t('dash.creator', 'Creator');
  const greet = t(`dash.greet.${part}`, `Good ${part}, {name} 👋`, { name });
  const stats = data?.stats || {};
  const charts = data?.charts || {};
  const sampleBar = data?.is_sample_data;

  const platformData = useMemo(() => (charts.platform || []).map((p) => ({ name: L.platform(p.platform) || p.platform, views: p.views })), [charts.platform, lang]); // eslint-disable-line
  const catData = useMemo(() => (charts.category || []).map((c) => ({ name: L.category(String(c.category).toLowerCase()) || c.category, views: c.views })), [charts.category, lang]); // eslint-disable-line
  const dateFmt = (d) => formatShortDate(d, lang);

  const actions = [
    [Wand2, t('dash.qa.hook', 'Generate Hook'), () => nav('/app/studio?mode=hooks')],
    [FileText, t('dash.qa.script', 'Write Script'), () => nav('/app/studio?mode=script')],
    [Hash, t('dash.qa.caption', 'Create Caption'), () => nav('/app/studio?mode=caption')],
    [TrendingUp, t('dash.qa.trends', 'Find Trends'), () => nav('/app/trends')],
    [Plus, t('dash.qa.add', 'Add Content'), () => setAdding(true)],
  ];

  const header = (
    <PageHeader title={greet} description={t('dash.sub', "Here's what's happening with your content.")}
      actions={<><Button icon={Sparkles} variant="primary" to="/app/studio">{t('nav.studio', 'AI Studio')}</Button></>} />
  );

  if (error && !data) return <div className="page">{header}<ErrorState message={error} onRetry={reload} /></div>;
  const isLoading = loading && !loaded;

  return (
    <div className="page stack stack--lg">
      {header}
      {sampleBar && !isLoading && <div><SampleBadge label={t('common.sampleInsights', 'Showing available sample insights.')} /></div>}

      <div className="grid grid--stats">
        <StatCard loading={isLoading} icon={Eye} label={t('dash.stat.views', 'Total views')} value={formatCompact(stats.total_views)} />
        <StatCard loading={isLoading} icon={Heart} label={t('dash.stat.eng', 'Engagement rate')} value={formatPercent(stats.engagement_rate, 1)} />
        <StatCard loading={isLoading} icon={Bookmark} label={t('dash.stat.ideas', 'Saved ideas')} value={stats.saved_ideas ?? 0} />
        <StatCard loading={isLoading} icon={CalendarClock} label={t('dash.stat.sched', 'Scheduled posts')} value={stats.scheduled_posts ?? 0} />
        <StatCard loading={isLoading} icon={Sparkles} label={t('dash.stat.ai', 'AI generations')} value={stats.ai_generations ?? 0} />
      </div>

      <div className="qa-grid" role="group" aria-label={t('dash.quick', 'Quick actions')}>
        {actions.map(([Icon, label, fn]) => <button key={label} type="button" className="qa" onClick={fn}><Icon size={18} />{label}</button>)}
      </div>

      <div className="dash-grid">
        <ChartCard className="span-8" title={t('dash.perf', 'Performance overview')} description={t('dash.perfDesc', 'Views over time')} loading={isLoading} empty={!isLoading && !(charts.views || []).length} emptyText={t('dash.noViews', 'Log your results to see performance here.')} height={260}>
          <AreaTrend data={charts.views || []} xKey="date" series={[{ key: 'value', name: t('dash.stat.views', 'Total views') }]} format={(v) => formatCompact(v)} xFormat={dateFmt} />
        </ChartCard>
        <ChartCard className="span-4" title={t('dash.chart.eng', 'Engagement rate')} description="%" loading={isLoading} empty={!isLoading && !(charts.engagement || []).length} height={260}>
          <LineTrend data={charts.engagement || []} xKey="date" series={[{ key: 'value', name: t('dash.stat.eng', 'Engagement rate') }]} format={(v) => `${Number(v).toFixed(1)}%`} xFormat={dateFmt} />
        </ChartCard>
        <ChartCard className="span-5" title={t('dash.chart.platform', 'Views by platform')} loading={isLoading} empty={!isLoading && !platformData.length} height={220}
          footer={<ChartLegend items={platformData.map((p) => ({ name: p.name }))} />}>
          <DonutChart data={platformData} nameKey="name" valueKey="views" format={(v) => formatCompact(v)} />
        </ChartCard>
        <ChartCard className="span-7" title={t('dash.chart.category', 'Views by category')} loading={isLoading} empty={!isLoading && !catData.length} height={220}>
          <BarCompare data={catData} xKey="name" series={[{ key: 'views', name: t('dash.stat.views', 'Total views') }]} format={(v) => formatCompact(v)} />
        </ChartCard>

        <SectionCard className="span-6" title={t('dash.trending', 'Trending topics')} action={<Button size="sm" variant="ghost" to="/app/trends">{t('common.viewAll', 'View all')}</Button>}>
          {isLoading ? <div className="stack"><Skeleton height={36} /><Skeleton height={36} /><Skeleton height={36} /></div>
            : !(data?.trending || []).length ? <EmptyState compact icon={Flame} title={t('dash.noTrends', 'No trends yet')} action={<Button size="sm" to="/app/trends">{t('dash.qa.trends', 'Find Trends')}</Button>} />
            : <div className="list-rows">{data.trending.slice(0, 5).map((tr) => (
              <div className="list-row" key={tr.id}>
                <div className="list-row__main"><b className="truncate">{tr.topic}</b><small>{tr.category} · +{Math.round(tr.growth_pct)}%</small></div>
                <div className="row row--sm">
                  <Badge tone="accent">{Math.round(tr.trend_score)}</Badge>
                  <Button size="sm" variant="ghost" icon={Sparkles} aria-label={t('dash.useTrend', 'Create from this trend')} title={t('dash.useTrend', 'Create from this trend')}
                    to={`/app/studio?${new URLSearchParams({ topic: tr.topic, category: tr.category || '', platform: tr.platform || '', language: tr.language || '' })}`} />
                </div>
              </div>))}</div>}
        </SectionCard>

        <SectionCard className="span-6" title={t('dash.recent', 'Recent content')} action={<Button size="sm" variant="ghost" to="/app/content">{t('common.viewAll', 'View all')}</Button>}>
          {isLoading ? <div className="stack"><Skeleton height={36} /><Skeleton height={36} /><Skeleton height={36} /></div>
            : !(data?.recent_content || []).length ? <EmptyState compact icon={FileText} title={t('dash.noContent', 'No content yet')} action={<Button size="sm" icon={Plus} onClick={() => setAdding(true)}>{t('dash.qa.add', 'Add Content')}</Button>} />
            : <div className="list-rows">{data.recent_content.slice(0, 5).map((c) => (
              <div className="list-row" key={c.id}>
                <div className="list-row__main"><b className="truncate">{c.title}</b><small>{c.platform ? <PlatformIcon platform={c.platform} size={12} withLabel /> : null} · {formatRelative(c.updated_at, { lang })}</small></div>
                <StatusPill status={c.status} />
              </div>))}</div>}
        </SectionCard>

        <SectionCard className="span-6" title={t('dash.upcoming', 'Upcoming content')} action={<Button size="sm" variant="ghost" to="/app/calendar">{t('nav.calendar', 'Calendar')}</Button>}>
          {isLoading ? <div className="stack"><Skeleton height={36} /><Skeleton height={36} /></div>
            : !(data?.upcoming || []).length ? <EmptyState compact icon={CalendarClock} title={t('dash.noUpcoming', 'Nothing scheduled')} action={<Button size="sm" to="/app/calendar">{t('nav.calendar', 'Calendar')}</Button>} />
            : <div className="list-rows">{data.upcoming.slice(0, 5).map((c) => (
              <div className="list-row" key={c.id}>
                <div className="list-row__main"><b className="truncate">{c.title}</b><small>{formatDateTime(c.scheduled_at, { lang })}</small></div>
                <StatusPill status={c.status} />
              </div>))}</div>}
        </SectionCard>

        <SectionCard className="span-6" title={t('dash.reco', 'AI recommendations')} action={<Link to="/app/analytics" className="text-sm" style={{ color: 'var(--accent-text)' }}><BarChart3 size={14} style={{ verticalAlign: '-2px' }} /> {t('nav.analytics', 'Analytics')}</Link>}>
          {isLoading ? <div className="stack"><Skeleton height={60} /><Skeleton height={60} /></div>
            : !(data?.recommendations || []).length ? <EmptyState compact icon={Lightbulb} title={t('dash.noReco', 'No recommendations yet')} description={t('dash.noRecoDesc', 'Add performance results to unlock personalised suggestions.')} />
            : <div className="stack stack--sm">{data.recommendations.slice(0, 3).map((r) => (
              <div className="reco" key={r.id}><Lightbulb size={17} /><div><b className="text-sm">{r.title}</b><p>{r.description}</p></div></div>))}</div>}
        </SectionCard>
      </div>
      <AddContentModal open={adding} onClose={() => setAdding(false)} onDone={reload} />
    </div>
  );
}
