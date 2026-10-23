import { Compass } from 'lucide-react';
import { EmptyState, Button } from '../components';
import { useI18n } from '../i18n';
import { useAuth, redirectForRole } from '../context/AuthContext.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

export default function NotFound() {
  const { t } = useI18n();
  const { user } = useAuth();
  useDocumentTitle(t('notFound.title', 'Page not found'));
  return (
    <div className="page page--narrow" style={{ paddingTop: 80 }}>
      <EmptyState icon={Compass} title={t('notFound.title', 'Page not found')} description={t('notFound.desc', "The page you're looking for doesn't exist or has moved.")}
        action={<Button variant="primary" to={user ? redirectForRole(user) : '/'}>{t('notFound.back', 'Back to your home')}</Button>} />
    </div>
  );
}
