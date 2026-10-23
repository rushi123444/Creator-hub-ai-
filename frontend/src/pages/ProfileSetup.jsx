import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Button, PageHeader, SectionCard, useToast } from '../components';
import { useI18n } from '../i18n';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import ProfileForm from './ProfileForm.jsx';

export default function ProfileSetup() {
  const { t } = useI18n();
  const toast = useToast();
  const nav = useNavigate();
  useDocumentTitle(t('prof.setupTitle', 'Set up your creator profile'));
  return (
    <div className="page page--narrow">
      <PageHeader eyebrow={<Sparkles size={14} aria-hidden="true" />} title={t('prof.setupTitle', 'Set up your creator profile')} description={t('prof.setupDesc', 'A few quick details help CreatorHub AI tailor hooks, scripts and ideas to you.')}
        actions={<Button variant="ghost" to="/app/dashboard">{t('prof.skip', 'Skip for now')}</Button>} />
      <SectionCard title={t('prof.personalise', 'This information personalises your AI generations: language, platform, tone and topics.')}>
        <ProfileForm wizard submitLabel={t('prof.finish', 'Finish setup')} onSaved={() => { toast.success(t('prof.saved', 'Profile saved')); nav('/app/dashboard', { replace: true }); }} />
      </SectionCard>
    </div>
  );
}
