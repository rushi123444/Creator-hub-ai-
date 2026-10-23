import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Plus } from 'lucide-react';
import { Avatar, Button, FormField, Input, Select, Tag, Textarea, ErrorState } from '../components';
import { useAuth } from '../context/AuthContext.jsx';
import { useMeta } from '../hooks/useMeta.js';
import { useLabels } from '../hooks/useLabels.js';
import { useAction } from '../hooks/useAction.js';
import { useI18n } from '../i18n';
import { profilesService } from '../services';
import { CREATOR_TYPES, EXPERIENCE_LEVELS, LANGUAGES } from '../utils';
import '../styles/pagesB1.css';

const URL_RE = /^https?:\/\/\S+$/i;

/** Shared creator-profile form. wizard=true shows it in 3 steps (first-run setup). */
export default function ProfileForm({ wizard = false, submitLabel, onSaved }) {
  const { t } = useI18n();
  const { user, refresh } = useAuth();
  const meta = useMeta();
  const L = useLabels();
  const p = user?.profile || {};
  const cp = user?.creator_profile || {};
  const [v, setV] = useState(() => ({
    full_name: user?.full_name || '', username: p.username || '', avatar_url: p.avatar_url || '',
    category_id: cp.category_id ? String(cp.category_id) : '', platform_id: cp.platform_id ? String(cp.platform_id) : '',
    preferred_language: p.preferred_language || 'en', creator_type: cp.creator_type || '', experience_level: cp.experience_level || '',
    interests: cp.interests || [], bio: p.bio || '',
  }));
  const [errs, setErrs] = useState({});
  const [tag, setTag] = useState('');
  const [step, setStep] = useState(0);
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const save = useAction((payload) => profilesService.updateMe(payload));

  const validate = (which) => {
    const e = {};
    if (which.includes(0)) {
      if (!v.full_name.trim()) e.full_name = t('prof.nameReq', 'Enter your name.');
      const u = v.username.trim();
      if (u.length < 3 || u.length > 30) e.username = t('prof.userReq', 'Choose a username (3 to 30 characters).');
      else if (!/^[A-Za-z0-9._]+$/.test(u)) e.username = t('prof.userBad', 'Use only letters, numbers, dots and underscores.');
      if (v.avatar_url.trim() && !URL_RE.test(v.avatar_url.trim())) e.avatar_url = t('prof.urlBad', 'Enter a link starting with http:// or https://');
    }
    setErrs(e);
    return !Object.keys(e).length;
  };

  const addTag = () => {
    const s = tag.trim().replace(/^#/, '').slice(0, 30);
    if (s && v.interests.length < 12 && !v.interests.some((x) => x.toLowerCase() === s.toLowerCase())) setV((x) => ({ ...x, interests: [...x.interests, s] }));
    setTag('');
  };

  const submit = async (e) => {
    e?.preventDefault();
    if (!validate([0])) { setStep(0); return; }
    const payload = {
      full_name: v.full_name.trim(), username: v.username.trim(), avatar_url: v.avatar_url.trim() || null, bio: v.bio.trim(),
      preferred_language: v.preferred_language, interests: v.interests,
      category_id: v.category_id ? Number(v.category_id) : null, platform_id: v.platform_id ? Number(v.platform_id) : null,
      creator_type: v.creator_type || null, experience_level: v.experience_level || null,
    };
    const res = await save.run(payload);
    if (res === undefined) { if (save.fieldErrors?.username) setStep(0); return; }
    await refresh();
    onSaved?.();
  };

  const fe = { ...save.fieldErrors, ...errs };
  const show = (n) => !wizard || step === n;
  const TOTAL = 3;
  const last = !wizard || step === TOTAL - 1;
  const next = () => { if (validate(step === 0 ? [0] : [])) setStep((s) => s + 1); };

  return (
    <form onSubmit={last ? submit : (e) => { e.preventDefault(); next(); }} className="stack" noValidate>
      {wizard && (
        <div className="stack stack--sm">
          <div className="wiz" aria-hidden="true">{[0, 1, 2].map((i) => <i key={i} className={i <= step ? 'on' : ''} />)}</div>
          <div className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
            {t('prof.step', 'Step {n} of {total}', { n: step + 1, total: TOTAL })} · {t(`prof.s${step + 1}`, ['About you', 'Your content', 'Interests and bio'][step])}
          </div>
        </div>
      )}
      {save.error && <ErrorState compact message={save.error} />}
      {show(0) && (
        <div className="pf-grid">
          <div className="full pf-head"><Avatar name={v.full_name || user?.email} src={v.avatar_url} size={56} /></div>
          <FormField label={t('prof.name', 'Full name')} required error={fe.full_name}><Input value={v.full_name} onChange={set('full_name')} maxLength={120} autoComplete="name" /></FormField>
          <FormField label={t('prof.username', 'Username')} required hint={t('prof.usernameHint', '3 to 30 letters, numbers, dots or underscores.')} error={fe.username}><Input value={v.username} onChange={set('username')} maxLength={30} autoComplete="username" /></FormField>
          <FormField className="full" label={t('prof.avatar', 'Avatar image URL')} optionalLabel={t('common.optional', 'Optional')} error={fe.avatar_url}><Input type="url" value={v.avatar_url} onChange={set('avatar_url')} placeholder="https://" /></FormField>
        </div>
      )}
      {show(1) && (
        <div className="pf-grid">
          <FormField label={t('prof.category', 'Content category')}>
            <Select value={v.category_id} onChange={set('category_id')} placeholder="—" options={meta.categories.map((c) => ({ value: String(c.id), label: L.category(c.slug) || c.name }))} />
          </FormField>
          <FormField label={t('prof.platform', 'Main platform')}>
            <Select value={v.platform_id} onChange={set('platform_id')} placeholder="—" options={meta.platforms.map((c) => ({ value: String(c.id), label: L.platform(c.slug) || c.name }))} />
          </FormField>
          <FormField label={t('prof.language', 'Preferred content language')}>
            <Select value={v.preferred_language} onChange={set('preferred_language')} options={LANGUAGES.map((l) => ({ value: l.code, label: l.native }))} />
          </FormField>
          <FormField label={t('prof.type', 'Creator type')}>
            <Select value={v.creator_type} onChange={set('creator_type')} placeholder="—" options={CREATOR_TYPES.map((o) => ({ value: o.value, label: t(`creatorType.${o.value}`, o.label) }))} />
          </FormField>
          <FormField label={t('prof.exp', 'Experience level')}>
            <Select value={v.experience_level} onChange={set('experience_level')} placeholder="—" options={EXPERIENCE_LEVELS.map((o) => ({ value: o.value, label: t(`experience.${o.value}`, o.label) }))} />
          </FormField>
        </div>
      )}
      {show(2) && (
        <div className="stack">
          <FormField label={t('prof.interests', 'Interests')} hint={t('prof.interestsHint', 'Type a topic and press Enter. Up to 12.')}>
            <Input value={tag} onChange={(e) => setTag(e.target.value)} maxLength={30}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
              suffix={<Button type="button" size="sm" variant="ghost" icon={Plus} onClick={addTag} disabled={!tag.trim()}>{t('prof.addInterest', 'Add')}</Button>} />
          </FormField>
          {v.interests.length > 0 && (
            <div className="row row--wrap row--sm">
              {v.interests.map((i) => <Tag key={i} tone="accent" onRemove={() => setV((x) => ({ ...x, interests: x.interests.filter((y) => y !== i) }))}>{i}</Tag>)}
            </div>
          )}
          <FormField label={t('prof.bio', 'Bio')} optionalLabel={t('common.optional', 'Optional')}><Textarea rows={4} value={v.bio} onChange={set('bio')} maxLength={500} /></FormField>
        </div>
      )}
      <div className="row row--between row--wrap">
        {wizard && step > 0 ? <Button type="button" variant="ghost" icon={ArrowLeft} onClick={() => setStep((s) => s - 1)}>{t('common.back', 'Back')}</Button> : <span />}
        {last
          ? <Button type="submit" icon={Check} loading={save.pending}>{submitLabel || t('common.saveChanges', 'Save changes')}</Button>
          : <Button type="submit" iconRight={ArrowRight}>{t('common.next', 'Next')}</Button>}
      </div>
    </form>
  );
}
