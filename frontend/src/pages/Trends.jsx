import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Info, Wand2, TrendingUp, TrendingDown } from 'lucide-react';
import { Badge, BarCompare, Button, Card, ChartCard, EmptyState, ErrorState, FormField, Input, LineTrend, PageHeader, PlatformIcon, SampleBadge, Select, Skeleton, TagList, useToast } from '../components';
import { useI18n } from '../i18n';
import { useAsync } from '../hooks/useAsync.js';
import { useDebounce } from '../hooks/useDebounce.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useLabels } from '../hooks/useLabels.js';
import { useMeta } from '../hooks/useMeta.js';
import { trendsService, getFriendlyError } from '../services';
import { formatDate, formatNumber, formatPercent, formatCompact } from '../utils';
import '../styles/pagesB2.css';

const DAYS = [7, 14, 30, 90];
const DEFINITION = 'Trend Score is a project-defined analytical score (0-100) combining recency, growth, engagement and topic frequency. It is not an official platform metric.';

export default function Trends() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const L = useLabels();
  const meta = useMeta();
  useDocumentTitle(t('nav.trends', 'Trends'));
  const [f, setF] = useState({ platform: '', category: '', language: '', days: '30', q: '' });
  const [refreshing, setRefreshing] = useState(false);
  const q = useDebounce(f.q, 350);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const { data, loading, error, loaded, reload } = useAsync(
    (signal) => trendsService.list({ platform: f.platform || undefined, category: f.category || undefined, language: f.language || undefined, days: Number(f.days), q: q.trim() || undefined, sort: 'score', limit: 24 }, { signal }),
    [f.platform, f.category, f.language, f.days, q],
  );

  const items = data?.items || [];
  const charts = data?.charts || {};
  const isSample = data?.source === 'sample';
  const first = !loaded && loading;

  const topSeries = useMemo(() => {
    const rows = charts.growth || [];
    const keys = rows.length ? Object.keys(rows[0]).filter((k) => k !== 'date' && k !== 'score') : [];
    const series = keys.length ? keys.slice(0, 3).map((k) => ({ key: k, name: k })) : [{ key: 'score', name: t('trends.score', 'Trend Score') }];
    return series;
  }, [charts.growth, t]);

  const refresh = async () => {
    setRefreshing(true);
    try { await trendsService.refresh(); toast.success(t('trends.refreshed', 'Trends refreshed')); reload(); } catch (e) { toast.error(getFriendlyError(e)); }
    setRefreshing(false);
  };

  const generate = (tr) => {
    const p = new URLSearchParams({ topic: tr.topic || '', category: tr.category || '', platform: tr.platform || '', language: tr.language || '' });
    navigate(`/app/studio?${p.toString()}`);
  };

  return (
    <div className="page">
      <PageHeader
        title={t('nav.trends', 'Trends')}
        description={t('trends.desc', 'See what is gaining attention and turn it into your next piece of content.')}
        badge={isSample ? <SampleBadge /> : null}
        actions={<Button variant="secondary" icon={RefreshCw} loading={refreshing} onClick={refresh}>{t('common.refresh', 'Refresh')}</Button>}
      />
      <div className="b2-stack">
        <Card className="b2-note"><Info size={16} /><span><strong>{t('trends.howTitle', 'How to read the score.')}</strong> {data?.score_definition || t('trends.definition', DEFINITION)}{isSample && <> {t('common.sampleInsights', 'Showing available sample insights.')}</>}</span></Card>

        <Card>
          <div className="b2-filters">
            <FormField label={t('trends.platform', 'Platform')}><Select value={f.platform} onChange={set('platform')} options={[{ value: '', label: t('common.all', 'All') }, ...meta.platforms.map((p) => ({ value: p.slug, label: L.platform(p.slug) || p.name }))]} /></FormField>
            <FormField label={t('trends.category', 'Category')}><Select value={f.category} onChange={set('category')} options={[{ value: '', label: t('common.all', 'All') }, ...meta.categories.map((c) => ({ value: c.slug, label: L.category(c.slug) || c.name }))]} /></FormField>
            <FormField label={t('trends.language', 'Language')}><Select value={f.language} onChange={set('language')} options={[{ value: '', label: t('common.all', 'All') }, ...['en', 'hi', 'mr'].map((c) => ({ value: c, label: L.language(c) }))]} /></FormField>
            <FormField label={t('trends.range', 'Date range')}><Select value={f.days} onChange={set('days')} options={DAYS.map((d) => ({ value: String(d), label: t('trends.lastDays', 'Last {n} days', { n: d }) }))} /></FormField>
            <FormField label={t('trends.keyword', 'Keyword')} className="b2-wide"><Input value={f.q} onChange={set('q')} placeholder={t('trends.keywordPh', 'e.g. AI tools')} /></FormField>
          </div>
        </Card>

        {error && !items.length ? <ErrorState message={error} onRetry={reload} /> : (
          <>
            <div className="b2-charts">
              <ChartCard title={t('trends.growthChart', 'Trend growth')} description={t('trends.growthDesc', 'Trend Score over time')} loading={first} empty={!first && !(charts.growth || []).length} height={240}>
                <LineTrend data={charts.growth || []} xKey="date" series={topSeries} height={240} />
              </ChartCard>
              <ChartCard title={t('trends.freqChart', 'Topic frequency')} description={t('trends.freqDesc', 'How often keywords appear')} loading={first} empty={!first && !(charts.frequency || []).length} height={240}>
                <BarCompare data={(charts.frequency || []).slice(0, 8)} xKey="keyword" series={[{ key: 'frequency', name: t('trends.frequency', 'Frequency') }]} height={240} />
              </ChartCard>
              <ChartCard title={t('trends.catChart', 'Category trends')} description={t('trends.catDesc', 'Average Trend Score by category')} loading={first} empty={!first && !(charts.categories || []).length} height={240}>
                <BarCompare data={(charts.categories || []).map((c) => ({ ...c, category: L.category(c.category) || c.category }))} xKey="category" series={[{ key: 'avg_score', name: t('trends.avgScore', 'Avg. score') }]} height={240} />
              </ChartCard>
            </div>

            {first ? (
              <div className="b2-grid">{[0, 1, 2].map((i) => <Card key={i}><Skeleton height={20} width="60%" /><Skeleton height={60} style={{ marginTop: 12 }} /><Skeleton height={36} style={{ marginTop: 12 }} /></Card>)}</div>
            ) : !items.length ? (
              <EmptyState icon={TrendingUp} title={t('trends.empty', 'No trends match these filters')} description={t('trends.emptyDesc', 'Try a different platform, category or keyword.')} action={<Button variant="secondary" onClick={() => setF({ platform: '', category: '', language: '', days: '30', q: '' })}>{t('common.reset', 'Reset')}</Button>} />
            ) : (
              <div className="b2-grid" aria-busy={loading}>
                {items.map((tr) => {
                  const up = Number(tr.growth_pct) >= 0;
                  return (
                    <Card key={tr.id} className="b2-trend">
                      <div className="b2-between">
                        <div style={{ minWidth: 0 }}>
                          <h3>{tr.topic}</h3>
                          <div className="b2-row" style={{ marginTop: 6 }}>
                            <Badge tone="neutral">{L.category(tr.category) || tr.category}</Badge>
                            <PlatformIcon platform={tr.platform} size={14} withLabel />
                            {(tr.is_sample || isSample) && <SampleBadge />}
                          </div>
                        </div>
                        <div className="b2-score">{Math.round(tr.trend_score)}<small>{t('trends.score', 'Trend Score')}</small></div>
                      </div>
                      <div className="b2-metrics">
                        <div className="b2-metric"><span>{t('trends.growth', 'Growth')}</span><strong className={up ? 'b2-up' : 'b2-down'}>{up ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {formatPercent(tr.growth_pct, 0)}</strong></div>
                        <div className="b2-metric"><span>{t('trends.engagement', 'Engagement')}</span><strong>{formatPercent(tr.engagement_rate, 1)}</strong></div>
                        <div className="b2-metric"><span>{t('trends.contentCount', 'Content')}</span><strong>{formatCompact(tr.content_count)}</strong></div>
                      </div>
                      {!!tr.related_topics?.length && (
                        <div><div className="b2-muted" style={{ marginBottom: 4 }}>{t('trends.related', 'Related topics')}</div><TagList items={tr.related_topics} max={5} /></div>
                      )}
                      <div className="b2-grow" />
                      <div className="b2-muted">{t('trends.source', 'Source')}: {tr.source || '-'} · {t('trends.updated', 'Updated')} {formatDate(tr.last_updated, { lang })}</div>
                      <Button icon={Wand2} block onClick={() => generate(tr)}>{t('trends.generate', 'Generate Content From This Trend')}</Button>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
