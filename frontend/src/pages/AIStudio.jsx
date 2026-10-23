import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Sparkles, Wand2, FileText, Hash, Lightbulb, Layers, Bookmark, RotateCw, Type, Zap } from 'lucide-react';
import {
  AIOutputCard, Button, CopyButton, FormField, Input, LanguageSelect, PageHeader, SectionCard, Select, Skeleton, Tabs, Tag, Textarea, ErrorState, useToast,
} from '../components';
import { useAuth } from '../context/AuthContext.jsx';
import { useMeta } from '../hooks/useMeta.js';
import { useLabels } from '../hooks/useLabels.js';
import { useI18n } from '../i18n';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { aiService, hooksService, scriptsService, captionsService, hashtagsService, ideasService, contentService } from '../services';
import { ApiError, getFriendlyError } from '../services/api.js';
import { CONTENT_TYPES, TONES, HOOK_TYPES } from '../utils';
import '../styles/pagesA.css';

const UNAVAILABLE = 'AI generation is temporarily unavailable. Please try again.';
const MODES = ['all', 'hooks', 'script', 'caption', 'hashtags', 'ideas'];
const MODE_ICON = { all: Sparkles, hooks: Wand2, script: FileText, caption: Type, hashtags: Hash, ideas: Lightbulb };
const joinTags = (h) => [...(h?.broad || []), ...(h?.medium || []), ...(h?.niche || [])].join(' ');
const asText = (v) => (typeof v === 'string' ? v : v?.text || v?.value || '');

export default function AIStudio() {
  const { t } = useI18n();
  const toast = useToast();
  const { user } = useAuth();
  const L = useLabels();
  const meta = useMeta();
  const [qs] = useSearchParams();
  useDocumentTitle(t('nav.studio', 'AI Studio'));
  const cp = user?.creator_profile;

  const [form, setForm] = useState(() => ({
    content_type: 'reel', platform: '', language: 'en', category: '', topic: '', audience: '', duration_seconds: 45, tone: 'educational', instructions: '',
  }));
  const [mode, setMode] = useState(MODES.includes(qs.get('mode')) ? qs.get('mode') : 'all');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState('');
  const [regen, setRegen] = useState({});
  const [saving, setSaving] = useState({});
  const [saved, setSaved] = useState({});
  const [error, setError] = useState('');
  const [topicErr, setTopicErr] = useState('');
  const outRef = useRef(null);
  const topicRef = useRef(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Defaults from the profile, then query params win.
  useEffect(() => {
    const platSlug = cp?.platform_id ? meta.platformSlug(cp.platform_id) : '';
    const catSlug = cp?.category_id ? meta.categorySlug(cp.category_id) : '';
    setForm((f) => ({
      ...f,
      platform: qs.get('platform') ? (meta.platformSlug(qs.get('platform')) || f.platform) : f.platform || platSlug || 'instagram',
      category: qs.get('category') ? (meta.categorySlug(qs.get('category')) || f.category) : f.category || catSlug || 'technology',
      language: ['en', 'hi', 'mr'].includes(qs.get('language')) ? qs.get('language') : (f.language !== 'en' ? f.language : (user?.profile?.preferred_language || 'en')),
      tone: qs.get('tone') || f.tone || cp?.default_tone || 'educational',
      topic: qs.get('topic') || f.topic,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cp?.platform_id, cp?.category_id, meta.loading]);

  const params = () => {
    const p = { ...form, duration_seconds: Number(form.duration_seconds) || undefined };
    Object.keys(p).forEach((k) => { if (p[k] === '' || p[k] == null) delete p[k]; });
    return p;
  };

  const fail = (e) => {
    const code = e instanceof ApiError ? e.code : '';
    setError(code === 'RATE_LIMITED' || code === 'VALIDATION_ERROR' ? getFriendlyError(e) : UNAVAILABLE);
  };

  const clearSaved = (keys) => setSaved((s) => { const n = { ...s }; keys.forEach((k) => delete n[k]); return n; });

  const generate = async (kind = mode) => {
    if (kind !== 'ideas' && !form.topic.trim()) { setTopicErr(t('studio.topicReq', 'Enter a topic to get started.')); topicRef.current?.focus(); return; }
    setTopicErr(''); setError(''); setBusy(kind);
    try {
      const p = params();
      let next;
      if (kind === 'all') next = await aiService.generateAll(p);
      else if (kind === 'hooks') { const r = await aiService.hooks(p); next = { hooks: r.hooks, is_sample: r.is_sample }; }
      else if (kind === 'script') { const r = await aiService.script(p); next = { script: r.script, is_sample: r.is_sample }; }
      else if (kind === 'caption') { const r = await aiService.caption(p); next = { caption: r.caption, is_sample: r.is_sample }; }
      else if (kind === 'hashtags') { const r = await aiService.hashtags(p); next = { hashtags: r.hashtags, is_sample: r.is_sample }; }
      else { const r = await aiService.ideas(p); next = { ideas: r.ideas, is_sample: r.is_sample }; }
      setResult((cur) => (kind === 'all' ? next : { ...(cur || {}), ...next, is_sample: next.is_sample }));
      clearSaved(kind === 'all' ? Object.keys(saved) : [kind]);
      if (window.innerWidth < 1000) setTimeout(() => outRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    } catch (e) { fail(e); }
    setBusy('');
  };

  const regenerate = async (key, section, apply, extra = {}) => {
    setRegen((r) => ({ ...r, [key]: true })); setError('');
    try {
      const r = await aiService.regenerate({ section, params: params(), current: result?.[section === 'hook' ? 'hooks' : section], ...extra });
      apply(r.value);
      clearSaved([key]);
    } catch (e) { fail(e); }
    setRegen((x) => ({ ...x, [key]: false }));
  };

  const save = async (key, fn, msg) => {
    setSaving((s) => ({ ...s, [key]: true }));
    try { await fn(); setSaved((s) => ({ ...s, [key]: true })); toast.success(msg || t('toast.saved', 'Saved')); } catch (e) { toast.fromError(e); }
    setSaving((s) => ({ ...s, [key]: false }));
  };

  const common = { topic: form.topic || undefined, platform: form.platform || undefined, language: form.language };
  const scriptBody = () => ({ ...common, ...pick(result.script, ['hook', 'introduction', 'main_points', 'examples', 'cta', 'ending', 'full_script']), duration_seconds: Number(form.duration_seconds) || undefined, tone: form.tone });
  const pick = (o, ks) => Object.fromEntries(ks.filter((k) => o?.[k] != null).map((k) => [k, o[k]]));

  const saveHook = (i) => save(`hook-${i}`, () => hooksService.create({ hook_type: result.hooks[i].type, text: result.hooks[i].text, ...common }));
  const saveScript = () => save('script', () => scriptsService.create(scriptBody()));
  const scriptToContent = () => save('script-content', async () => { const row = await scriptsService.create(scriptBody()); await scriptsService.saveToContent(row.id); }, t('studio.savedContent', 'Saved to Content'));
  const saveCaption = () => save('caption', () => captionsService.create({ ...pick(result.caption, ['instagram_caption', 'youtube_description', 'short_description', 'cta']), keywords: result.caption.keywords || [], ...common }));
  const saveHashtags = () => save('hashtags', () => hashtagsService.create({ broad: result.hashtags.broad || [], medium: result.hashtags.medium || [], niche: result.hashtags.niche || [], ...common }));
  const saveIdea = (i) => save(`idea-${i}`, () => ideasService.create({ ...pick(result.ideas[i], ['title', 'topic', 'format', 'reason', 'suggested_hook']), category: form.category || undefined, platform: form.platform || undefined, language: form.language }));
  const saveAll = () => save('all', () => contentService.create({
    title: (result.title || form.topic).slice(0, 200), topic: form.topic.slice(0, 200) || undefined, content_type: form.content_type, platform: form.platform || undefined,
    category: form.category || undefined, language: form.language, status: 'draft', ai_generated: true,
    body: result.script?.full_script, caption: result.caption?.instagram_caption,
    hashtags: [...(result.hashtags?.broad || []), ...(result.hashtags?.medium || []), ...(result.hashtags?.niche || [])].map((h) => (h.startsWith('#') ? h : `#${h}`)).slice(0, 40),
  }), t('studio.savedContent', 'Saved to Content'));

  const upd = (patch) => setResult((r) => ({ ...r, ...patch }));
  const sample = !!result?.is_sample;

  /* ----- sections ----- */
  const sections = {
    title: result?.title != null && (
      <AIOutputCard key="title" title={t('studio.title', 'Title')} text={result.title} isSample={sample} rows={2} onChange={(v) => upd({ title: v })}
        onRegenerate={() => regenerate('title', 'title', (v) => upd({ title: asText(v) }))} regenerating={regen.title} />
    ),
    hooks: result?.hooks?.length > 0 && (
      <div className="stack" key="hooks">
        <div className="row row--between"><h2 className="sec-label" style={{ margin: 0 }}>{t('studio.hooks', 'Hooks')}</h2>
          <Button size="sm" variant="ghost" icon={RotateCw} loading={regen.hooks} onClick={() => regenerate('hooks', 'hooks', (v) => upd({ hooks: v }))}>{t('studio.regenAll', 'Regenerate all')}</Button></div>
        {result.hooks.map((h, i) => (
          <AIOutputCard key={`${h.type}-${i}`} title={L.hook(h.type) || h.type} meta={null} text={h.text} isSample={sample && i === 0} rows={3}
            onChange={(v) => { upd({ hooks: result.hooks.map((x, j) => (j === i ? { ...x, text: v } : x)) }); clearSaved([`hook-${i}`]); }}
            onRegenerate={() => regenerate(`hook-${i}`, 'hook', (v) => upd({ hooks: result.hooks.map((x, j) => (j === i ? { type: h.type, text: asText(v) } : x)) }), { hook_type: h.type })} regenerating={regen[`hook-${i}`]}
            onSave={() => saveHook(i)} saving={saving[`hook-${i}`]} saved={saved[`hook-${i}`]} />
        ))}
      </div>
    ),
    script: result?.script && (
      <AIOutputCard key="script" title={t('studio.script', 'Script')} text={result.script.full_script || ''} isSample={sample} rows={14}
        onChange={(v) => { upd({ script: { ...result.script, full_script: v } }); clearSaved(['script', 'script-content']); }}
        onRegenerate={() => regenerate('script', 'script', (v) => upd({ script: v }))} regenerating={regen.script}
        onSave={saveScript} saving={saving.script} saved={saved.script}>
        {(result.script.main_points?.length > 0) && (
          <div style={{ marginTop: 14 }}>
            <div className="sec-label">{t('studio.keyPoints', 'Key points')}</div>
            <ul className="checks" style={{ marginTop: 8 }}>{result.script.main_points.map((p, i) => <li key={i}><Zap size={14} color="var(--accent-text)" style={{ flex: 'none', marginTop: 3 }} /><span>{p}</span></li>)}</ul>
          </div>
        )}
        <div className="row row--wrap" style={{ marginTop: 14 }}>
          <Button size="sm" variant="secondary" icon={Layers} onClick={scriptToContent} loading={saving['script-content']} disabled={saved['script-content']}>{saved['script-content'] ? t('studio.savedContent', 'Saved to Content') : t('studio.saveToContent', 'Save to Content')}</Button>
        </div>
      </AIOutputCard>
    ),
    caption: result?.caption && (
      <div className="stack" key="caption">
        <AIOutputCard title={t('studio.caption', 'Caption')} text={result.caption.instagram_caption || ''} isSample={sample} rows={6}
          onChange={(v) => { upd({ caption: { ...result.caption, instagram_caption: v } }); clearSaved(['caption']); }}
          onRegenerate={() => regenerate('caption', 'caption', (v) => upd({ caption: v }))} regenerating={regen.caption}
          onSave={saveCaption} saving={saving.caption} saved={saved.caption} />
        {result.caption.youtube_description && <AIOutputCard title={t('studio.ytDesc', 'YouTube description')} text={result.caption.youtube_description} rows={6} onChange={(v) => upd({ caption: { ...result.caption, youtube_description: v } })} />}
        {result.caption.short_description && <AIOutputCard title={t('studio.shortDesc', 'Short description')} text={result.caption.short_description} rows={3} onChange={(v) => upd({ caption: { ...result.caption, short_description: v } })} />}
      </div>
    ),
    hashtags: result?.hashtags && (
      <AIOutputCard key="hashtags" title={t('studio.hashtags', 'Hashtags')} text={joinTags(result.hashtags)} isSample={sample} rows={4}
        onChange={(v) => {
          const toks = v.split(/\s+/).filter(Boolean).map((x) => (x.startsWith('#') ? x : `#${x}`));
          const g = (k) => toks.filter((x) => (result.hashtags[k] || []).includes(x));
          const known = new Set([...g('broad'), ...g('medium'), ...g('niche')]);
          upd({ hashtags: { broad: g('broad'), medium: g('medium'), niche: [...g('niche'), ...toks.filter((x) => !known.has(x))] } }); clearSaved(['hashtags']);
        }}
        onRegenerate={() => regenerate('hashtags', 'hashtags', (v) => upd({ hashtags: v }))} regenerating={regen.hashtags}
        onSave={saveHashtags} saving={saving.hashtags} saved={saved.hashtags}>
        {['broad', 'medium', 'niche'].map((g) => (result.hashtags[g]?.length > 0) && (
          <div key={g}><div className="sec-label">{t(`studio.tag.${g}`, g[0].toUpperCase() + g.slice(1))}</div>
            <div className="hashgroup">{result.hashtags[g].map((h) => <Tag key={h}>{h}</Tag>)}</div></div>
        ))}
      </AIOutputCard>
    ),
    cta: result?.cta != null && result.cta !== '' && (
      <AIOutputCard key="cta" title={t('studio.cta', 'Call to action')} text={asText(result.cta)} isSample={sample} rows={3} onChange={(v) => upd({ cta: v })}
        onRegenerate={() => regenerate('cta', 'cta', (v) => upd({ cta: asText(v) }))} regenerating={regen.cta} />
    ),
    ideas: result?.ideas?.length > 0 && (
      <SectionCard key="ideas" title={t('studio.ideas', 'Content Ideas')} className="ai-card"
        action={<div className="row row--sm"><CopyButton text={() => result.ideas.map((x) => `${x.title}\n${x.suggested_hook || ''}`).join('\n\n')} label={t('common.copy', 'Copy')} />
          <Button size="sm" variant="ghost" icon={RotateCw} loading={regen.ideas} onClick={() => regenerate('ideas', 'ideas', (v) => upd({ ideas: v }))}>{t('common.regenerate', 'Regenerate')}</Button></div>}>
        <div className="stack stack--sm">
          {result.ideas.map((x, i) => (
            <div className="idea" key={i}>
              <div className="row row--between row--top"><b>{x.title}</b>{x.format && <Tag>{x.format}</Tag>}</div>
              {x.reason && <p>{x.reason}</p>}
              {x.suggested_hook && <p style={{ color: 'var(--text-2)' }}>“{x.suggested_hook}”</p>}
              <div className="row row--sm">
                <Button size="sm" variant="ghost" icon={Bookmark} onClick={() => saveIdea(i)} loading={saving[`idea-${i}`]} disabled={saved[`idea-${i}`]}>{saved[`idea-${i}`] ? t('common.saved', 'Saved') : t('common.save', 'Save')}</Button>
                <Button size="sm" variant="ghost" icon={Sparkles} onClick={() => { setForm((f) => ({ ...f, topic: x.topic || x.title })); setMode('all'); window.scrollTo({ top: 0, behavior: 'smooth' }); topicRef.current?.focus(); }}>{t('studio.useIdea', 'Use this idea')}</Button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    ),
  };

  const order = mode === 'all' ? ['title', 'hooks', 'script', 'caption', 'hashtags', 'cta', 'ideas'] : [mode];
  const visible = order.filter((k) => sections[k]);
  const modeLabels = { all: t('studio.mode.all', 'Full package'), hooks: t('studio.hooks', 'Hooks'), script: t('studio.script', 'Script'), caption: t('studio.caption', 'Caption'), hashtags: t('studio.hashtags', 'Hashtags'), ideas: t('studio.ideas', 'Content Ideas') };
  const generating = !!busy;
  const modeBtn = mode === 'all' ? t('studio.generate', 'Generate Content') : `${t('common.generate', 'Generate')} ${modeLabels[mode]}`;

  return (
    <div className="page page--wide">
      <PageHeader title={t('nav.studio', 'AI Studio')} description={t('studio.sub', 'Turn an idea into ready-to-publish content.')} eyebrow={t('studio.eyebrow', 'Create')} />
      <div className="studio">
        <form className="studio__form" onSubmit={(e) => { e.preventDefault(); generate(mode); }} noValidate>
          <SectionCard title={t('studio.brief', 'Your brief')}>
            <div className="fgrid">
              <div className="full"><FormField label={t('studio.topic', 'Topic')} error={topicErr} required>
                <Input ref={topicRef} value={form.topic} onChange={set('topic')} placeholder={t('studio.topicPh', 'e.g. 3 free AI tools for students')} maxLength={200} />
              </FormField></div>
              <FormField label={t('studio.contentType', 'Content type')}><Select value={form.content_type} onChange={set('content_type')} options={CONTENT_TYPES.map((c) => ({ value: c.value, label: L.contentType(c.value) }))} /></FormField>
              <FormField label={t('studio.platform', 'Platform')}><Select value={form.platform} onChange={set('platform')} options={meta.platforms.map((p) => ({ value: p.slug, label: L.platform(p.slug) || p.name }))} /></FormField>
              <FormField label={t('studio.language', 'Language')}><LanguageSelect variant="field" value={form.language} onChange={(c) => setForm((f) => ({ ...f, language: c }))} /></FormField>
              <FormField label={t('studio.category', 'Category')}><Select value={form.category} onChange={set('category')} options={meta.categories.map((c) => ({ value: c.slug, label: L.category(c.slug) || c.name }))} /></FormField>
              <FormField label={t('studio.tone', 'Tone')}><Select value={form.tone} onChange={set('tone')} options={TONES.map((x) => ({ value: x.value, label: L.tone(x.value) }))} /></FormField>
              <FormField label={t('studio.duration', 'Duration (seconds)')}><Input type="number" min={5} max={1800} value={form.duration_seconds} onChange={set('duration_seconds')} /></FormField>
              <div className="full"><FormField label={t('studio.audience', 'Target audience')} optionalLabel={t('common.optional', 'Optional')}><Input value={form.audience} onChange={set('audience')} placeholder={t('studio.audiencePh', 'e.g. college students')} maxLength={200} /></FormField></div>
              <div className="full"><FormField label={t('studio.instructions', 'Additional instructions')} optionalLabel={t('common.optional', 'Optional')}><Textarea rows={3} value={form.instructions} onChange={set('instructions')} maxLength={1000} placeholder={t('studio.instructionsPh', 'Anything the AI should keep in mind')} /></FormField></div>
            </div>
            <div className="stack stack--sm" style={{ marginTop: 16 }}>
              <Button type="submit" variant="primary" size="lg" block icon={Sparkles} loading={generating && busy === mode}>{generating && busy === mode ? t('state.generating', 'Generating…') : modeBtn}</Button>
            </div>
          </SectionCard>
        </form>

        <div className="studio__out" ref={outRef}>
          <Tabs ariaLabel={t('studio.modes', 'Content parts')} value={mode} onChange={setMode} tabs={MODES.map((m) => ({ value: m, label: modeLabels[m], icon: MODE_ICON[m] }))} />
          {error && <ErrorState compact message={error} onRetry={() => generate(mode)} title={t('studio.failTitle', 'Generation did not finish')} />}
          {generating && (!result || busy === 'all') ? (
            <div className="stack" role="status" aria-label={t('state.generating', 'Generating…')}>
              {[0, 1, 2].map((i) => <div key={i} className="card shimmer" style={{ padding: 20 }}><Skeleton width="30%" height={14} /><div style={{ height: 12 }} /><Skeleton /><div style={{ height: 8 }} /><Skeleton /><div style={{ height: 8 }} /><Skeleton width="65%" /></div>)}
            </div>
          ) : visible.length ? (
            <>
              {mode === 'all' && (
                <div className="gen-bar">
                  <div className="title">{result.title}</div>
                  <Button icon={Layers} variant="secondary" onClick={saveAll} loading={saving.all} disabled={saved.all}>{saved.all ? t('studio.savedContent', 'Saved to Content') : t('studio.saveToContent', 'Save to Content')}</Button>
                </div>
              )}
              {generating && <div className="card shimmer" style={{ padding: 14 }}><Skeleton width="50%" /></div>}
              {visible.map((k) => sections[k])}
            </>
          ) : generating ? (
            <div className="card shimmer" style={{ padding: 20 }}><Skeleton /><div style={{ height: 8 }} /><Skeleton width="60%" /></div>
          ) : (
            <div className="studio-hero">
              <span className="studio-hero__orb"><Sparkles size={26} /></span>
              <h2>{mode === 'all' ? t('studio.emptyTitle', 'Your content will appear here') : t('studio.emptyMode', 'Nothing here yet')}</h2>
              <p className="muted" style={{ maxWidth: '46ch' }}>{mode === 'all' ? t('studio.emptyDesc', 'Add a topic, choose a tone and press Generate Content. You get hooks, a script, caption, hashtags, title and a call to action.') : t('studio.emptyModeDesc', 'Generate just this part from your brief.')}</p>
              {mode !== 'all' && <Button variant="primary" icon={Sparkles} onClick={() => generate(mode)}>{modeBtn}</Button>}
              {mode === 'all' && (
                <div className="studio-hero__chips">
                  {[t('studio.ex1', '3 free AI tools for students'), t('studio.ex2', 'Morning routine for productivity'), t('studio.ex3', 'Budget phone buying tips')].map((x) => <Tag key={x} onClick={() => { setForm((f) => ({ ...f, topic: x })); topicRef.current?.focus(); }}>{x}</Tag>)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
