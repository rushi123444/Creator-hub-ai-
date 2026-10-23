import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scissors, Wand2, Save, Info } from 'lucide-react';
import { Button, Card, CopyButton, EmptyState, ErrorState, FormField, LanguageSelect, PageHeader, SampleBadge, Select, Skeleton, Textarea, Tag, useToast } from '../components';
import { useI18n } from '../i18n';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useLabels } from '../hooks/useLabels.js';
import { useMeta } from '../hooks/useMeta.js';
import { aiService, contentService, getFriendlyError } from '../services';
import '../styles/pagesB2.css';

const MIN = 80;
const DURATIONS = [15, 30, 45, 60, 90];

export default function LongToShort() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const L = useLabels();
  const meta = useMeta();
  useDocumentTitle(t('nav.longToShort', 'Long to Short'));
  const [text, setText] = useState('');
  const [platform, setPlatform] = useState('instagram');
  const [language, setLanguage] = useState(['en', 'hi', 'mr'].includes(lang) ? lang : 'en');
  const [duration, setDuration] = useState('30');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [res, setRes] = useState(null);
  const [saved, setSaved] = useState({});
  const tooShort = text.trim().length < MIN;

  const run = async (e) => {
    e?.preventDefault();
    setTouched(true);
    if (tooShort) return;
    setBusy(true); setError('');
    try {
      const r = await aiService.longToShort({ source_text: text.trim(), target_platform: platform, language, target_duration_seconds: Number(duration) });
      setRes(r); setSaved({});
      toast.success(t('l2s.done', 'Your short ideas are ready'));
    } catch (err) { setError(getFriendlyError(err)); toast.error(getFriendlyError(err)); }
    setBusy(false);
  };

  const full = (s) => [s.short_idea, '', `${t('l2s.hook', 'Hook')}: ${s.hook}`, `${t('l2s.keySection', 'Key Section')}: ${s.key_section}`, '', s.short_script, '', `${t('l2s.cta', 'CTA')}: ${s.cta}`].join('\n');

  const save = async (s, i) => {
    try {
      await contentService.create({ title: s.short_idea, topic: s.short_idea, content_type: 'short', platform, language, status: 'script', body: full(s) });
      setSaved((m) => ({ ...m, [i]: true }));
      toast.success(t('l2s.saved', 'Saved to Content'));
    } catch (err) { toast.error(getFriendlyError(err)); }
  };

  const studio = (s) => {
    const p = new URLSearchParams({ topic: s.short_idea || '', platform, language });
    navigate(`/app/studio?${p.toString()}`);
  };

  return (
    <div className="page">
      <PageHeader title={t('nav.longToShort', 'Long to Short')} description={t('l2s.desc', 'Paste a transcript, notes or a long script and get three short-form ideas to film.')} badge={res?.is_sample ? <SampleBadge /> : null} />
      <div className="b2-stack">
        <Card className="b2-note"><Info size={16} /><span>{t('l2s.note', 'This tool suggests short ideas and scripts from your text. It is not a video editor and does not cut or export video.')}</span></Card>
        <Card>
          <form className="b2-form" onSubmit={run} noValidate>
            <FormField label={t('l2s.source', 'Transcript, notes or long script')} hint={t('l2s.count', '{n} characters (minimum {min})', { n: text.trim().length, min: MIN })} error={touched && tooShort ? t('l2s.tooShort', 'Add at least {min} characters so we have enough to work with.', { min: MIN }) : ''} required>
              <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('l2s.ph', 'Paste your long-form content here...')} />
            </FormField>
            <div className="b2-filters">
              <FormField label={t('l2s.platform', 'Target platform')}><Select value={platform} onChange={(e) => setPlatform(e.target.value)} options={meta.platforms.map((p) => ({ value: p.slug, label: L.platform(p.slug) || p.name }))} /></FormField>
              <FormField label={t('l2s.language', 'Language')}><LanguageSelect variant="field" value={language} onChange={setLanguage} /></FormField>
              <FormField label={t('l2s.duration', 'Target duration')}><Select value={duration} onChange={(e) => setDuration(e.target.value)} options={DURATIONS.map((d) => ({ value: String(d), label: `${d}s` }))} /></FormField>
            </div>
            <div><Button type="submit" icon={Scissors} loading={busy}>{t('l2s.generate', 'Create short ideas')}</Button></div>
          </form>
        </Card>

        {busy && <div className="b2-grid">{[0, 1, 2].map((i) => <Card key={i}><Skeleton height={20} width="60%" /><Skeleton height={80} style={{ marginTop: 12 }} /><Skeleton height={60} style={{ marginTop: 12 }} /></Card>)}</div>}
        {!busy && error && <ErrorState message={error} onRetry={run} />}
        {!busy && !error && !res && <EmptyState icon={Scissors} title={t('l2s.emptyTitle', 'No short ideas yet')} description={t('l2s.emptyDesc', 'Paste your content above and create three short ideas.')} />}
        {!busy && res && (res.shorts || []).length === 0 && <EmptyState icon={Scissors} title={t('l2s.noneTitle', 'No ideas this time')} description={t('l2s.noneDesc', 'Try adding more detail and run it again.')} />}
        {!busy && res && (res.shorts || []).length > 0 && (
          <div className="b2-grid">
            {res.shorts.map((s, i) => (
              <Card key={i}>
                <div className="b2-stack">
                  <div className="b2-between"><Tag tone="accent">{t('l2s.short', 'Short {n}', { n: i + 1 })}</Tag><Tag>{s.suggested_duration_seconds}s</Tag></div>
                  <div><div className="b2-muted">{t('l2s.idea', 'Short Idea')}</div><strong>{s.short_idea}</strong></div>
                  <div><div className="b2-muted">{t('l2s.hook', 'Hook')}</div>{s.hook}</div>
                  <div><div className="b2-muted">{t('l2s.suggested', 'Suggested Duration')}</div>{s.suggested_duration_seconds}s</div>
                  <div><div className="b2-muted">{t('l2s.keySection', 'Key Section')}</div>{s.key_section}</div>
                  <div><div className="b2-muted">{t('l2s.script', 'Short Script')}</div><div style={{ whiteSpace: 'pre-wrap' }}>{s.short_script}</div></div>
                  <div><div className="b2-muted">{t('l2s.cta', 'CTA')}</div>{s.cta}</div>
                  <div className="b2-actions">
                    <CopyButton text={() => full(s)} label={t('common.copy', 'Copy')} variant="secondary" size="sm" />
                    <Button size="sm" variant="secondary" icon={Wand2} onClick={() => studio(s)}>{t('l2s.studio', 'Open in AI Studio')}</Button>
                    <Button size="sm" icon={Save} disabled={saved[i]} onClick={() => save(s, i)}>{saved[i] ? t('l2s.savedBtn', 'Saved') : t('l2s.save', 'Save to Content')}</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
