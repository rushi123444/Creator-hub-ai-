import { useEffect, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { Avatar, Button, Checkbox, ErrorState, FormField, Input, PageHeader, SectionCard, Select, Skeleton, Tag, Textarea, useToast } from '../components';
import { useAsync } from '../hooks/useAsync.js';
import { useAction } from '../hooks/useAction.js';
import { useLabels } from '../hooks/useLabels.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useI18n } from '../i18n';
import { editorsService } from '../services';
import { ApiError } from '../services/api.js';
import { EDITOR_SPECIALIZATIONS, LANGUAGES } from '../utils';
import '../styles/pagesB1.css';

const URL_RE = /^https?:\/\/\S+$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPTY = { display_name: '', headline: '', specialization: '', skills: [], languages: ['en'], experience_years: '', portfolio_url: '', instagram_url: '', contact_email: '', bio: '' };

export default function EditorProfile() {
  const { t } = useI18n();
  const toast = useToast();
  const L = useLabels();
  useDocumentTitle(t('edp.title', 'My editor profile'));
  const [v, setV] = useState(EMPTY);
  const [isNew, setIsNew] = useState(false);
  const [errs, setErrs] = useState({});
  const [skill, setSkill] = useState('');
  const res = useAsync(async (signal) => {
    try { return await editorsService.getMyProfile({ signal }); }
    catch (e) { if (e instanceof ApiError && e.status === 404) return { __new: true }; throw e; }
  }, []);
  const save = useAction((body) => editorsService.saveMyProfile(body));

  useEffect(() => {
    const d = res.data;
    if (!d) return;
    if (d.__new) { setIsNew(true); setV(EMPTY); return; }
    setIsNew(false);
    setV({
      ...EMPTY, ...Object.fromEntries(Object.entries(d).filter(([k]) => k in EMPTY && d[k] != null)),
      experience_years: d.experience_years ?? '', skills: d.skills || [], languages: d.languages?.length ? d.languages : ['en'],
    });
  }, [res.data]);

  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const addSkill = () => {
    const s = skill.trim().slice(0, 40);
    if (s && v.skills.length < 20 && !v.skills.some((x) => x.toLowerCase() === s.toLowerCase())) setV((x) => ({ ...x, skills: [...x.skills, s] }));
    setSkill('');
  };
  const toggleLang = (c) => setV((x) => ({ ...x, languages: x.languages.includes(c) ? x.languages.filter((l) => l !== c) : [...x.languages, c] }));

  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (!v.display_name.trim()) er.display_name = t('edp.nameReq', 'Enter a display name.');
    if (v.contact_email.trim() && !EMAIL_RE.test(v.contact_email.trim())) er.contact_email = t('edp.emailBad', 'Enter a valid email address.');
    if (v.experience_years !== '' && !(Number(v.experience_years) >= 0 && Number(v.experience_years) <= 60)) er.experience_years = t('edp.expBad', 'Enter a number from 0 to 60.');
    ['portfolio_url', 'instagram_url'].forEach((k) => { if (v[k].trim() && !URL_RE.test(v[k].trim())) er[k] = t('prof.urlBad', 'Enter a link starting with http:// or https://'); });
    setErrs(er);
    if (Object.keys(er).length) return;
    const body = {
      display_name: v.display_name.trim(), headline: v.headline.trim(), specialization: v.specialization || null, skills: v.skills, languages: v.languages,
      experience_years: v.experience_years === '' ? null : Number(v.experience_years),
      portfolio_url: v.portfolio_url.trim() || null, instagram_url: v.instagram_url.trim() || null, contact_email: v.contact_email.trim() || null, bio: v.bio.trim(),
    };
    const r = await save.run(body);
    if (r !== undefined) { setIsNew(false); toast.success(t('edp.saved', 'Editor profile saved')); }
  };

  const fe = { ...save.fieldErrors, ...errs };
  return (
    <div className="page page--narrow">
      <PageHeader title={isNew ? t('edp.newTitle', 'Create your editor profile') : t('edp.title', 'My editor profile')} description={t('edp.desc', 'This is what creators see in the Editor Directory.')} />
      {res.error && !res.data ? <ErrorState message={res.error} onRetry={res.reload} /> : !res.loaded ? (
        <SectionCard title=" "><div className="stack"><Skeleton height={44} /><Skeleton height={44} /><Skeleton height={44} /><Skeleton height={120} /></div></SectionCard>
      ) : (
        <form onSubmit={submit} noValidate>
          <SectionCard>
            <div className="stack">
              {save.error && <ErrorState compact message={save.error} />}
              <div className="pf-grid">
                <div className="full pf-head"><Avatar name={v.display_name} size={56} /></div>
                <FormField label={t('edp.name', 'Display name')} required error={fe.display_name}><Input value={v.display_name} onChange={set('display_name')} maxLength={80} /></FormField>
                <FormField label={t('edp.spec', 'Specialization')}>
                  <Select value={v.specialization} onChange={set('specialization')} placeholder="—" options={EDITOR_SPECIALIZATIONS.map((o) => ({ value: o.value, label: L.spec(o.value) }))} />
                </FormField>
                <FormField className="full" label={t('edp.headline', 'Headline')} hint={t('edp.headlineHint', 'One line, e.g. Reels editor for coding creators.')} error={fe.headline}><Input value={v.headline} onChange={set('headline')} maxLength={120} /></FormField>
                <div className="full stack stack--sm">
                  <FormField label={t('edp.skills', 'Skills')} hint={t('edp.skillsHint', 'Type a skill and press Enter.')}>
                    <Input value={skill} onChange={(e) => setSkill(e.target.value)} maxLength={40}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSkill(); } }}
                      suffix={<Button type="button" size="sm" variant="ghost" icon={Plus} onClick={addSkill} disabled={!skill.trim()}>{t('prof.addInterest', 'Add')}</Button>} />
                  </FormField>
                  {v.skills.length > 0 && <div className="row row--wrap row--sm">{v.skills.map((s) => <Tag key={s} tone="accent" onRemove={() => setV((x) => ({ ...x, skills: x.skills.filter((y) => y !== s) }))}>{s}</Tag>)}</div>}
                </div>
                <div className="full">
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, marginBottom: 8 }}>{t('edp.langs', 'Languages')}</div>
                  <div className="row row--wrap">
                    {LANGUAGES.map((l) => <Checkbox key={l.code} label={l.native} checked={v.languages.includes(l.code)} onChange={() => toggleLang(l.code)} />)}
                  </div>
                </div>
                <FormField label={t('edp.exp', 'Years of experience')} error={fe.experience_years}><Input type="number" min="0" max="60" inputMode="numeric" value={v.experience_years} onChange={set('experience_years')} /></FormField>
                <FormField label={t('edp.email', 'Contact email')} error={fe.contact_email}><Input type="email" value={v.contact_email} onChange={set('contact_email')} autoComplete="email" /></FormField>
                <FormField label={t('edp.portfolio', 'Portfolio link')} error={fe.portfolio_url}><Input type="url" value={v.portfolio_url} onChange={set('portfolio_url')} placeholder="https://" /></FormField>
                <FormField label={t('edp.insta', 'Instagram link')} error={fe.instagram_url}><Input type="url" value={v.instagram_url} onChange={set('instagram_url')} placeholder="https://instagram.com/" /></FormField>
                <FormField className="full" label={t('edp.bio', 'About you')} error={fe.bio}><Textarea rows={5} value={v.bio} onChange={set('bio')} maxLength={1000} /></FormField>
              </div>
              <div className="row row--end"><Button type="submit" icon={Check} loading={save.pending}>{t('common.saveChanges', 'Save changes')}</Button></div>
            </div>
          </SectionCard>
        </form>
      )}
    </div>
  );
}
