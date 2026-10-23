import { Link, Outlet } from 'react-router-dom';
import { Logo, LanguageSelect } from '../components';
import { useI18n } from '../i18n';

/** Centered card on a soft background for login/register/forgot/reset. Props: children (or router <Outlet/>). */
export default function AuthLayout({ children }) {
  const { t } = useI18n();
  return (
    <div className="auth">
      <div className="auth__bar"><Link to="/" aria-label="CreatorHub AI"><Logo size={26} /></Link><LanguageSelect variant="menu" /></div>
      <main id="main" className="auth__main">
        <div className="auth__card">{children || <Outlet />}</div>
        <p className="faint text-xs text-center">{t('common.tagline', 'Create Smarter. Grow With Data.')}</p>
      </main>
    </div>
  );
}
