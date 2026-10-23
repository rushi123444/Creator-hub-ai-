import { useMemo, useState } from 'react';
import { BarChart3, Eye, Heart, MessageCircle, Share2, Bookmark, Users, Clock, UserPlus, Percent, Plus, Pencil, Trash2, Info, Lightbulb, X } from 'lucide-react';
import { AreaTrend, BarCompare, Button, Card, ChartCard, ConfirmDialog, DataTable, DonutChart, EmptyState, ErrorState, FormField, IconButton, Input, Modal, PageHeader, SampleBadge, SectionCard, Select, StatCard, Skeleton, Tag, useToast } from '../components';
import { useI18n } from '../i18n';
import { useAsync } from '../hooks/useAsync.js';
import { useAction } from '../hooks/useAction.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useLabels } from '../hooks/useLabels.js';
import { useMeta } from '../hooks/useMeta.js';
import { analyticsService, recommendationsService } from '../services';
import { formatCompact, formatDate, formatMinutes, formatNumber, formatPercent, todayKey, addDays, toDateKey } from '../utils';
import '../styles/pagesB2.css';
import '../styles/pagesB3.css';

const RANGES = [7, 30, 90];
const EMPTY = { entry_date: '', platform: '', category: '', language: 'en', title: '', views: '', likes: '', comments: '', shares: '', saves: '', reach: '', watch_time_minutes: '', followers_gained: '' };
const NUMS = ['views', 'likes', 'comments', 'shares', 'saves', 'reach', 'watch_time_minutes', 'followers_gained'];

export default function Analytics() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const L = useLabels();
  const meta = useMeta();
  useDocumentTitle(t('nav.analytics', 'Analytics'));
  const [f, setF] = useState({ days: '30', platform: '', category: '', language: '' });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const params = useMemo(() => ({ start: toDateKey(addDays(todayKey(), -Number(f.days))), end: todayKey(), platform: f.platform || undefined, category: f.category || undefined, language: f.language || undefined }), [f]);
  const sum = useAsync((s) => analyticsService.summary(params, { signal: s }), [params]);
  const entries = useAsync((s) => analyticsService.listEntries({ limit: 100 }, { signal: s }), []);
  const recos = useAsync((s) => recommendationsService.list({ signal: s }), []);
  const [modal, setModal] = useState(null);
  const [del, setDel] = useState(null);
  const [delBusy, setDelBusy] = useState(false);
  const [genBusy, setGenBusy] = useState(false);

  const d = sum.data;
  const first = !sum.loaded && sum.loading;
  const tot = d?.totals || {};
  const eng = d?.engagement || {};
  const viewsBased = eng.basis === 'views';
  const hasData = d?.has_data;
  const rows = Array.isArray(entries.data) ? entries.data : entries.data?.items || [];
  const recoList = (Array.isArray(recos.data) ? recos.data : recos.data?.items || []).filter((r) => !r.dismissed);
  const sample = d?.is_sample || rows.some((r) => r.is_sample);
  const reload = () => { sum.reload(); entries.reload(); };

  const example = useMemo(() => {
    const num = (tot.likes || 0) + (tot.comments || 0) + (tot.shares || 0) + (tot.saves || 0);
    const den = viewsBased ? tot.views : tot.reach;
    if (!den) return '';
    return `(${formatNumber(tot.likes || 0)} + ${formatNumber(tot.comments || 0)} + ${formatNumber(tot.shares || 0)} + ${formatNumber(tot.saves || 0)}) / ${formatNumber(den)} × 100 = ${formatPercent((num / den) * 100, 2)}`;
  }, [tot, viewsBased]);

  const nameOf = (list, fn) => (list || []).map((x) => ({ ...x, name: fn(x.name ?? x.platform ?? x.category ?? x.language) }));
  const plat = nameOf(d?.by_platform, (v) => L.platform(v) || v);
  const cat = nameOf(d?.by_category, (v) => L.category(v) || v);
  const lng = nameOf(d?.by_language, (v) => L.language(v) || v);
  const content = (d?.by_content || []).slice(0, 8).map((x) => ({ ...x, name: String(x.title || x.name || '').slice(0, 22) }));
  const valKey = (x) => (x && x.length ? (x[0].views !== undefined ? 'views' : 'value') : 'views');

  const generate = async () => {
    setGenBusy(true);
    try { await recommendationsService.generate(); toast.success(t('an.generated', 'Recommendations updated')); recos.reload(); } catch (e) { toast.fromError(e); }
    setGenBusy(false);
  };
  const dismiss = async (r) => {
    try { await recommendationsService.dismiss(r.id); recos.setData((x) => (Array.isArray(x) ? x.filter((i) => i.id !== r.id) : { ...x, items: (x?.items || []).filter((i) => i.id !== r.id) })); toast.info(t('an.dismissed', 'Recommendation dismissed')); } catch (e) { toast.fromError(e); }
  };
  const remove = async () => {
    setDelBusy(true);
    try { await analyticsService.removeEntry(del.id); toast.success(t('an.deleted', 'Entry deleted')); setDel(null); reload(); } catch (e) { toast.fromError(e); }
    setDelBusy(false);
  };

  const tiles = [
    [t('an.views', 'Views'), formatCompact(tot.views || 0), Eye],
    [t('an.likes', 'Likes'), formatCompact(tot.likes || 0), Heart],
    [t('an.comments', 'Comments'), formatCompact(tot.comments || 0), MessageCircle],
    [t('an.shares', 'Shares'), formatCompact(tot.shares || 0), Share2],
    [t('an.saves', 'Saves'), formatCompact(tot.saves || 0), Bookmark],
    [t('an.reach', 'Reach'), formatCompact(tot.reach || 0), Users],
    [t('an.watch', 'Watch Time'), formatMinutes(tot.watch_time_minutes || 0), Clock],
    [t('an.followers', 'Followers / Subscribers Gained'), formatCompact(tot.followers_gained || 0), UserPlus],
    [viewsBased ? t('an.engViews', 'Engagement rate (views-based)') : t('an.eng', 'Engagement Rate'), formatPercent(eng.rate || 0, 2), Percent],
  ];
  const opts = (list, fn) => [{ value: '', label: t('common.all', 'All') }, ...list.map(fn)];

  const columns = [
    { key: 'entry_date', header: t('an.date', 'Date'), render: (r) => formatDate(r.entry_date || r.date, { lang }), sortValue: (r) => r.entry_date || r.date, sortable: true },
    { key: 'title', header: t('an.entryTitle', 'Title'), primary: true, render: (r) => <>{r.title || '-'} {r.is_sample && <SampleBadge />}</> },
    { key: 'platform', header: t('an.platform', 'Platform'), render: (r) => L.platform(r.platform) || r.platform || '-', hideOnMobile: true },
    { key: 'views', header: t('an.views', 'Views'), align: 'right', render: (r) => formatNumber(r.views || 0) },
    { key: 'likes', header: t('an.likes', 'Likes'), align: 'right', render: (r) => formatNumber(r.likes || 0), hideOnMobile: true },
    { key: 'actions', header: '', align: 'right', render: (r) => (
      <span className="b2-row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
        <IconButton icon={Pencil} label={t('common.edit', 'Edit')} size="sm" onClick={() => setModal(r)} />
        <IconButton icon={Trash2} label={t('common.delete', 'Delete')} size="sm" variant="danger" onClick={() => setDel(r)} />
      </span>) },
  ];

  return (
    <div className="page">
      <PageHeader title={t('nav.analytics', 'Analytics')} description={t('an.desc', 'Understand how your content performs and what to try next.')} badge={sample ? <SampleBadge /> : null}
        actions={<Button icon={Plus} onClick={() => setModal({})}>{t('an.add', 'Add analytics entry')}</Button>} />
      <div className="b2-stack">
        <Card>
          <div className="b2-filters">
            <FormField label={t('an.range', 'Date range')}><Select value={f.days} onChange={set('days')} options={RANGES.map((n) => ({ value: String(n), label: t('trends.lastDays', 'Last {n} days', { n }) }))} /></FormField>
            <FormField label={t('an.platform', 'Platform')}><Select value={f.platform} onChange={set('platform')} options={opts(meta.platforms, (p) => ({ value: p.slug, label: L.platform(p.slug) || p.name }))} /></FormField>
            <FormField label={t('an.category', 'Category')}><Select value={f.category} onChange={set('category')} options={opts(meta.categories, (c) => ({ value: c.slug, label: L.category(c.slug) || c.name }))} /></FormField>
            <FormField label={t('an.language', 'Language')}><Select value={f.language} onChange={set('language')} options={opts(['en', 'hi', 'mr'], (c) => ({ value: c, label: L.language(c) }))} /></FormField>
          </div>
        </Card>

        {sum.error && !d ? <ErrorState message={sum.error} onRetry={reload} /> : !first && !hasData ? (
          <EmptyState icon={BarChart3} title={t('an.empty', 'No analytics yet')} description={t('an.emptyDesc', 'Add an entry for a published post to see your performance here.')} action={<Button icon={Plus} onClick={() => setModal({})}>{t('an.add', 'Add analytics entry')}</Button>} />
        ) : (
          <>
            <div className="b3-tiles" aria-busy={sum.loading}>
              {tiles.map(([label, value, icon]) => <StatCard key={label} label={label} value={value} icon={icon} loading={first} />)}
            </div>
            <Card className="b2-note"><Info size={16} /><div className="b3-formula">
              <strong>{t('an.formulaTitle', 'How engagement is calculated.')}</strong>{' '}
              <code>(Likes + Comments + Shares + Saves) / Reach × 100</code>
              {viewsBased && <div>{t('an.viewsBasis', 'Reach is not available for this selection, so Engagement rate (views-based) divides by views instead.')}</div>}
              {example && <div>{t('an.example', 'Example from your data')}: <code>{example}</code></div>}
            </div></Card>
            <div className="b2-charts">
              <ChartCard title={t('an.viewsTime', 'Views over time')} loading={first} empty={!first && !(d?.series?.views || []).length} height={240}><AreaTrend data={d?.series?.views || []} xKey="date" series={[{ key: 'value', name: t('an.views', 'Views') }]} height={240} format={formatCompact} /></ChartCard>
              <ChartCard title={t('an.engTime', 'Engagement over time')} loading={first} empty={!first && !(d?.series?.engagement || []).length} height={240}><AreaTrend data={d?.series?.engagement || []} xKey="date" series={[{ key: 'value', name: t('an.eng', 'Engagement Rate') }]} height={240} format={(v) => formatPercent(v, 1)} /></ChartCard>
              <ChartCard title={t('an.byPlatform', 'By platform')} loading={first} empty={!first && !plat.length} height={240}><DonutChart data={plat} nameKey="name" valueKey={valKey(plat)} height={240} format={formatCompact} /></ChartCard>
              <ChartCard title={t('an.byCategory', 'By category')} loading={first} empty={!first && !cat.length} height={240}><BarCompare data={cat} xKey="name" series={[{ key: valKey(cat), name: t('an.views', 'Views') }]} height={240} format={formatCompact} /></ChartCard>
              <ChartCard title={t('an.byLanguage', 'By language')} loading={first} empty={!first && !lng.length} height={240}><DonutChart data={lng} nameKey="name" valueKey={valKey(lng)} height={240} format={formatCompact} /></ChartCard>
              <ChartCard title={t('an.byContent', 'Content performance')} loading={first} empty={!first && !content.length} height={240}><BarCompare data={content} xKey="name" series={[{ key: valKey(content), name: t('an.views', 'Views') }]} height={240} format={formatCompact} /></ChartCard>
            </div>
          </>
        )}

        <SectionCard title={t('an.entries', 'Analytics entries')}>
          {entries.error && !rows.length ? <ErrorState compact message={entries.error} onRetry={entries.reload} /> : (
            <DataTable columns={columns} rows={rows} loading={!entries.loaded && entries.loading} defaultSort={{ key: 'entry_date', dir: 'desc' }} caption={t('an.entries', 'Analytics entries')}
              emptyTitle={t('an.noEntries', 'No entries yet')} emptyDescription={t('an.noEntriesDesc', 'Add your first entry to start tracking.')} />
          )}
        </SectionCard>

        <SectionCard title={t('an.recos', 'Recommendations')} description={t('an.recoNote', 'Suggestions are based on patterns in your data and are not guarantees of results.')}
          action={<Button size="sm" variant="secondary" icon={Lightbulb} loading={genBusy} onClick={generate}>{t('an.generate', 'Generate')}</Button>}>
          {!recos.loaded && recos.loading ? <Skeleton height={60} /> : recos.error && !recoList.length ? <ErrorState compact message={recos.error} onRetry={recos.reload} /> : !recoList.length ? (
            <EmptyState compact icon={Lightbulb} title={t('an.noRecos', 'No recommendations yet')} description={t('an.noRecosDesc', 'Generate a few ideas based on your recent performance.')} />
          ) : recoList.map((r) => (
            <div key={r.id} className="b3-reco">
              <div style={{ minWidth: 0 }}>
                <p><strong>{r.title || r.type || t('an.reco', 'Recommendation')}</strong> {r.is_sample && <SampleBadge />}</p>
                <p className="b2-muted">{r.body || r.message || r.text || r.description}</p>
              </div>
              <IconButton icon={X} label={t('an.dismiss', 'Dismiss')} size="sm" onClick={() => dismiss(r)} />
            </div>
          ))}
        </SectionCard>
      </div>

      {modal && <EntryModal entry={modal} meta={meta} L={L} t={t} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); }} />}
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={remove} loading={delBusy} danger title={t('an.delTitle', 'Delete this entry?')} description={t('an.delDesc', 'It will no longer count towards your analytics.')} confirmLabel={t('common.delete', 'Delete')} />
    </div>
  );
}

function EntryModal({ entry, meta, L, t, onClose, onSaved }) {
  const toast = useToast();
  const editing = !!entry.id;
  const [v, setV] = useState(() => ({ ...EMPTY, entry_date: todayKey(), ...Object.fromEntries(Object.entries(entry).filter(([, x]) => x != null).map(([k, x]) => [k, k === 'entry_date' ? toDateKey(x) : x])) }));
  const [errs, setErrs] = useState({});
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));
  const save = useAction((body) => (editing ? analyticsService.updateEntry(entry.id, body) : analyticsService.createEntry(body)));
  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (!v.entry_date) er.entry_date = t('an.errDate', 'Choose a date.');
    if (!v.platform) er.platform = t('an.errPlatform', 'Choose a platform.');
    NUMS.forEach((k) => { if (v[k] !== '' && (isNaN(Number(v[k])) || Number(v[k]) < 0)) er[k] = t('an.errNum', 'Enter a number of 0 or more.'); });
    setErrs(er);
    if (Object.keys(er).length) return;
    const body = { entry_date: v.entry_date, platform: v.platform, category: v.category || undefined, language: v.language, title: v.title || undefined };
    NUMS.forEach((k) => { body[k] = v[k] === '' ? 0 : Number(v[k]); });
    const res = await save.run(body);
    if (res !== undefined) { toast.success(editing ? t('an.updated', 'Entry updated') : t('an.saved', 'Entry added')); onSaved(); }
  };
  const lbl = { views: 'Views', likes: 'Likes', comments: 'Comments', shares: 'Shares', saves: 'Saves', reach: 'Reach', watch_time_minutes: 'Watch time (minutes)', followers_gained: 'Followers gained' };
  return (
    <Modal open onClose={onClose} size="lg" title={editing ? t('an.edit', 'Edit analytics entry') : t('an.add', 'Add analytics entry')}
      footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel', 'Cancel')}</Button><Button type="submit" form="an-form" loading={save.pending}>{t('common.save', 'Save')}</Button></>}>
      <form id="an-form" onSubmit={submit} noValidate className="b2-stack">
        {save.error && <ErrorState compact message={save.error} />}
        <div className="b3-two">
          <FormField label={t('an.date', 'Date')} required error={errs.entry_date}><Input type="date" value={v.entry_date} onChange={set('entry_date')} /></FormField>
          <FormField label={t('an.platform', 'Platform')} required error={errs.platform}><Select value={v.platform} onChange={set('platform')} placeholder={t('an.choose', 'Choose')} options={meta.platforms.map((p) => ({ value: p.slug, label: L.platform(p.slug) || p.name }))} /></FormField>
          <FormField label={t('an.category', 'Category')} optionalLabel={t('common.optional', 'Optional')}><Select value={v.category} onChange={set('category')} placeholder={t('an.choose', 'Choose')} options={meta.categories.map((c) => ({ value: c.slug, label: L.category(c.slug) || c.name }))} /></FormField>
          <FormField label={t('an.language', 'Language')}><Select value={v.language} onChange={set('language')} options={['en', 'hi', 'mr'].map((c) => ({ value: c, label: L.language(c) }))} /></FormField>
        </div>
        <FormField label={t('an.entryTitle', 'Title')} optionalLabel={t('common.optional', 'Optional')}><Input value={v.title} onChange={set('title')} maxLength={200} /></FormField>
        <div className="b3-two">
          {NUMS.map((k) => <FormField key={k} label={t(`an.f.${k}`, lbl[k])} error={errs[k]}><Input type="number" min="0" inputMode="numeric" value={v[k]} onChange={set(k)} /></FormField>)}
        </div>
      </form>
    </Modal>
  );
}
