import { useState } from 'react';
import { LogOut, Moon, Sun, UserRound } from 'lucide-react';
import { Button, LanguageSelect, PageHeader, SectionCard, SegmentedControl, Select, Switch, useToast, FormField } from '../components';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n';
import { useLabels } from '../hooks/useLabels.js';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { profilesService } from '../services';
import { STORAGE_KEYS, TONES } from '../utils';
import '../styles/pagesB1.css';

const NOTIF_KEY = 'ch_notif_prefs';
const DEFAULT_NOTIFS = { schedule: true, trends: true, tips: false };

export default function Settings() {
  const { t, lang, setLang } = useI18n();
  const toast = useToast();
  const L = useLabels();
  const { user, logout, refresh } = useAuth();
  useDocumentTitle(t('nav.settings', 'Settings'));
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');
  const [notifs, setNotifs] = useLocalStorage(NOTIF_KEY, DEFAULT_NOTIFS);
  const [tone, setTone] = useState(user?.creator_profile?.default_tone || 'educational');
  const [busyTone, setBusyTone] = useState(false);
  const [out, setOut] = useState(false);
  const n = { ...DEFAULT_NOTIFS, ...(notifs || {}) };

  const applyTheme = (v) => {
    setTheme(v);
    document.documentElement.setAttribute('data-theme', v);
    try { localStorage.setItem(STORAGE_KEYS.theme, v); } catch { /* ignore */ }
    toast.success(t('set.saved', 'Settings saved'));
  };
  const changeLang = (code) => {
    setLang(code);
    profilesService.updateMe({ ui_language: code }).catch(() => {});
  };
  const changeTone = async (e) => {
    const prev = tone; const next = e.target.value;
    setTone(next); setBusyTone(true);
    try { await profilesService.updateMe({ default_tone: next }); await refresh(); toast.success(t('set.saved', 'Settings saved')); }
    catch (err) { setTone(prev); toast.fromError(err); }
    setBusyTone(false);
  };
  const toggle = (k) => (v) => { setNotifs({ ...n, [k]: v }); toast.success(t('set.saved', 'Settings saved')); };
  const signOut = async () => { setOut(true); await logout(); };

  return (
    <div className="page page--narrow">
      <PageHeader title={t('set.title', 'Settings')} description={t('set.desc', 'Choose how CreatorHub AI looks, sounds and keeps you updated.')} />
      <div className="stack">
        <SectionCard title={t('set.appearance', 'Appearance and language')}>
          <div className="stack">
            <div className="set-row">
              <span>{t('set.uiLang', 'Interface language')}</span>
              <LanguageSelect variant="field" value={lang} onChange={changeLang} />
            </div>
            <div className="set-row">
              <span>{t('set.theme', 'Theme')}</span>
              <SegmentedControl ariaLabel={t('set.theme', 'Theme')} value={theme} onChange={applyTheme}
                options={[{ value: 'dark', label: t('set.dark', 'Dark'), icon: Moon }, { value: 'light', label: t('set.light', 'Light'), icon: Sun }]} />
            </div>
          </div>
        </SectionCard>
        {user?.role === 'creator' && (
          <SectionCard title={t('set.ai', 'AI preferences')}>
            <FormField label={t('set.tone', 'Default tone')} hint={t('set.toneHint', 'Used by AI Studio and the Assistant when you do not choose a tone.')}>
              <Select value={tone} onChange={changeTone} disabled={busyTone} options={TONES.map((o) => ({ value: o.value, label: L.tone(o.value) }))} />
            </FormField>
          </SectionCard>
        )}
        <SectionCard title={t('set.notifs', 'Notifications')} description={t('set.notifsHint', 'Saved on this device only.')}>
          <div className="stack">
            <Switch checked={n.schedule} onChange={toggle('schedule')} label={t('set.nSchedule', 'Scheduled post reminders')} description={t('set.nScheduleD', 'A heads-up before content in your calendar goes live.')} />
            <Switch checked={n.trends} onChange={toggle('trends')} label={t('set.nTrends', 'Trending topic alerts')} description={t('set.nTrendsD', 'New topics rising in your category.')} />
            <Switch checked={n.tips} onChange={toggle('tips')} label={t('set.nTips', 'Weekly tips and insights')} description={t('set.nTipsD', 'A short weekly summary of what worked.')} />
          </div>
        </SectionCard>
        <SectionCard title={t('set.account', 'Account')} description={t('set.signedAs', 'Signed in as {email}', { email: user?.email || '' })}>
          <div className="row row--wrap">
            <Button variant="secondary" icon={UserRound} to="/app/profile">{t('set.profileLink', 'Edit profile')}</Button>
            <Button variant="danger" icon={LogOut} loading={out} onClick={signOut}>{t('set.signOut', 'Sign out')}</Button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
