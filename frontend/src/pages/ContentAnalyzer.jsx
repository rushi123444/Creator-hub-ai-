import { useState } from 'react';
import { BarChart3, Sparkles, Info } from 'lucide-react';
import { Badge, Button, Card, EmptyState, ErrorState, FormField, Input, LanguageSelect, PageHeader, SampleBadge, SectionCard, Select, Skeleton, Textarea, useToast } from '../components';
import { useI18n } from '../i18n';
import { useAction } from '../hooks/useAction.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useLabels } from '../hooks/useLabels.js';
import { useMeta } from '../hooks/useMeta.js';
import { analyticsService } from '../services';
import { todayKey } from '../utils';
import '../styles/pagesB2.css';

const EMPTY = { title: '', topic: '', description: '', duration: '', category: 'technology', language: 'en', views: '', likes: '', comments: '', shares: '', publication_date: todayKey(), reach: '' };
const NUMS = ['views', 'likes', 'comments', 'shares', 'reach', 'duration'];
const DISCLAIMER = 'This analysis is based on the numbers you entered and general patterns. It cannot predict or guarantee virality or future results.';

const List = ({ items }) => (items?.length ? <ul className="b2-list">{items.map((x, i) => <li key={i}>{typeof x === 'string' ? x : x?.text || JSON.stringify(x)}</li>)}</ul> : <p className="b2-muted">-</p>);

export default function ContentAnalyzer() {
  const { t } = useI18n();
  const toast = useToast();
  const L = useLabels();
  const meta = useMeta();
  useDocumentTitle(t('nav.analyzer', 'Content Analyzer'));
  const [v, setV] = useState(EMPTY);
  const [errs, setErrs] = useState({});
  const [result, setResult] = useState(null);
  const analyze = useAction((body) => analyticsService.analyze(body));
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!v.title.trim()) e.title = t('an.errTitle', 'Please enter a title.');
    if (!v.topic.trim()) e.topic = t('an.errTopic', 'Please enter a topic.');
    NUMS.forEach((k) => { if (v[k] !== '' && (Number(v[k]) < 0 || !Number.isFinite(Number(v[k])))) e[k] = t('an.errNum', 'Enter a number of 0 or more.'); });
    ['views', 'likes', 'comments', 'shares'].forEach((k) => { if (v[k] === '' && !e[k]) e[k] = t('an.errReq', 'Required'); });
    if (!v.publication_date) e.publication_date = t('an.errDate', 'Choose a date.');
    return e;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    const e = validate();
    setErrs(e);
    if (Object.keys(e).length) return;
    const n = (k) => Number(v[k] || 0);
    const body = { title: v.title.trim(), topic: v.topic.trim(), description: v.description.trim(), duration_seconds: n('duration'), category: v.category, language: v.language, views: n('views'), likes: n('likes'), comments: n('comments'), shares: n('shares'), publication_date: v.publication_date };
    if (v.reach !== '') body.reach = n('reach');
    const r = await analyze.run(body);
    if (r) { setResult(r); toast.success(t('an.done', 'Analysis ready')); }
    else toast.error(analyze.error || t('state.errorDesc', 'Something went wrong. Please try again.'));
  };

  const num = (k, label, props = {}) => (
    <FormField label={label} error={errs[k] || analyze.fieldErrors[k]} optionalLabel={props.optional ? t('common.optional', 'Optional') : undefined}>
      <Input type="number" inputMode="numeric" min="0" value={v[k]} onChange={set(k)} />
    </FormField>
  );
  const r = result;
  const eng = r?.engagement;

  return (
    <div className="page">
      <PageHeader title={t('nav.analyzer', 'Content Analyzer')} description={t('an.desc', 'Enter the numbers for a post to see how it performed and what to try next.')} />
      <div className="b2-stack">
        <Card>
          <form className="b2-form" onSubmit={submit} noValidate>
            <FormField label={t('an.title', 'Title')} required error={errs.title}><Input value={v.title} onChange={set('title')} maxLength={200} /></FormField>
            <FormField label={t('an.topic', 'Topic')} required error={errs.topic}><Input value={v.topic} onChange={set('topic')} maxLength={200} /></FormField>
            <FormField label={t('an.description', 'Description')} className="b2-full" optionalLabel={t('common.optional', 'Optional')}><Textarea rows={3} value={v.description} onChange={set('description')} /></FormField>
            {num('duration', t('an.duration', 'Duration (seconds)'), { optional: true })}
            <FormField label={t('an.category', 'Category')}><Select value={v.category} onChange={set('category')} options={meta.categories.map((c) => ({ value: c.slug, label: L.category(c.slug) || c.name }))} /></FormField>
            <FormField label={t('an.language', 'Language')}><LanguageSelect variant="field" value={v.language} onChange={(c) => setV((s) => ({ ...s, language: c }))} /></FormField>
            <FormField label={t('an.date', 'Publication date')} error={errs.publication_date}><Input type="date" max={todayKey()} value={v.publication_date} onChange={set('publication_date')} /></FormField>
            {num('views', t('an.views', 'Views'))}
            {num('likes', t('an.likes', 'Likes'))}
            {num('comments', t('an.comments', 'Comments'))}
            {num('shares', t('an.shares', 'Shares'))}
            {num('reach', t('an.reach', 'Reach'), { optional: true })}
            <div className="b2-full b2-row">
              <Button type="submit" icon={Sparkles} loading={analyze.pending}>{t('an.analyze', 'Analyze')}</Button>
              <Button variant="ghost" onClick={() => { setV({ ...EMPTY, publication_date: todayKey() }); setErrs({}); setResult(null); analyze.reset(); }}>{t('common.reset', 'Reset')}</Button>
            </div>
          </form>
        </Card>

        {analyze.pending ? (
          <div className="b2-result">{[0, 1, 2, 3].map((i) => <Card key={i}><Skeleton height={18} width="40%" /><Skeleton height={60} style={{ marginTop: 12 }} /></Card>)}</div>
        ) : analyze.error && !r ? (
          <ErrorState message={analyze.error} />
        ) : !r ? (
          <EmptyState icon={BarChart3} title={t('an.empty', 'Your analysis will appear here')} description={t('an.emptyDesc', 'Fill in the details above and choose Analyze.')} />
        ) : (
          <>
            <div className="b2-result">
              <SectionCard title={t('an.performance', 'Performance')}>
                <div className="b2-row"><span className="b2-big">{r.performance?.label}</span>{r.is_sample && <SampleBadge />}</div>
                <p>{r.performance?.summary}</p>
              </SectionCard>
              <SectionCard title={t('an.engagement', 'Engagement')}>
                <div className="b2-big">{eng?.rate != null ? `${Number(eng.rate).toFixed(2)}%` : '-'}</div>
                <p className="b2-muted">{t('an.basis', 'Basis')}: {eng?.basis === 'reach' ? t('an.basisReach', 'Reach') : t('an.basisViews', 'Views (reach not provided)')}</p>
                {eng?.formula && <code className="b2-code">{eng.formula}</code>}
              </SectionCard>
              <SectionCard title={t('an.pattern', 'Content Pattern')}><p>{r.content_pattern || '-'}</p></SectionCard>
              <SectionCard title={t('an.strengths', 'Potential Strengths')}><List items={r.potential_strengths} /></SectionCard>
              <SectionCard title={t('an.observations', 'Observations')}><List items={r.observations} /></SectionCard>
              <SectionCard title={t('an.experiments', 'Future Experiment Suggestions')}><List items={r.experiment_suggestions} /></SectionCard>
            </div>
            <Card className="b2-note"><Info size={16} /><span>{r.disclaimer || t('an.disclaimer', DISCLAIMER)}</span></Card>
          </>
        )}
      </div>
    </div>
  );
}
