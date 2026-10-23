import { Sparkles } from 'lucide-react';
import { PageHeader, SectionCard, useToast } from '../components';
import { useI18n } from '../i18n';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import ProfileForm from './ProfileForm.jsx';

export default function Profile() {
  const { t } = useI18n();
  const toast = useToast();
  useDocumentTitle(t('nav.profile', 'Profile'));
  return (
    <div className="page page--narrow">
      <PageHeader title={t('prof.title', 'Your profile')} description={t('prof.desc', 'Keep your details current. We use them to personalise what the AI creates for you.')} />
      <SectionCard title={t('prof.personalise', 'This information personalises your AI generations: language, platform, tone and topics.')} action={<Sparkles size={16} aria-hidden="true" />}>
        <ProfileForm onSaved={() => toast.success(t('prof.saved', 'Profile saved'))} />
      </SectionCard>
    </div>
  );
}
