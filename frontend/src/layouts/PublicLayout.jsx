import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Button, IconButton, Logo, LanguageSelect } from '../components';
import { useI18n } from '../i18n';
import { useAuth, redirectForRole } from '../context/AuthContext.jsx';

/**
 * Landing-page nav (glass). Props: links = [{ href, label, key? }] (in-page anchors like '#features' or routes).
 */
export function PublicNav({ links = [] }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const cta = user
    ? <Button to={redirectForRole(user)} variant="primary" size="sm">{t('public.openApp', 'Open app')}</Button>
    : (<><Button to="/login" variant="ghost" size="sm">{t('public.login', 'Log in')}</Button><Button to="/register" variant="primary" size="sm">{t('public.getStarted', 'Get started')}</Button></>);
  const anchors = links.map((l) => <a key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.key ? t(l.key, l.label) : l.label}</a>);
  return (
    <header className="pubnav">
      <div className="pubnav__inner">
        <Link to="/" className="pubnav__brand" aria-label="CreatorHub AI"><Logo size={26} /></Link>
        <nav className="pubnav__links" aria-label={t('nav.main', 'Main navigation')}>{anchors}</nav>
        <div className="pubnav__cta"><LanguageSelect variant="menu" />{cta}</div>
        <IconButton className="pubnav__burger" label={open ? t('nav.closeMenu', 'Close menu') : t('public.menu', 'Menu')} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </IconButton>
      </div>
      {open && (
        <div className="pubnav__sheet">
          {anchors}
          <div className="row row--wrap"><LanguageSelect variant="menu" />{cta}</div>
        </div>
      )}
    </header>
  );
}

/** Footer. Props: links = [{ to, label }] extra links. */
export function PublicFooter({ links = [] }) {
  const { t } = useI18n();
  return (
    <footer className="pubfoot">
      <div className="pubfoot__inner">
        <div className="stack stack--sm">
          <Logo size={22} />
          <p className="muted text-sm">{t('common.tagline', 'Create Smarter. Grow With Data.')}</p>
        </div>
        <nav className="pubfoot__links" aria-label={t('public.footerAccount', 'Account')}>
          <NavLink to="/login">{t('public.login', 'Log in')}</NavLink>
          <NavLink to="/register">{t('public.getStarted', 'Get started')}</NavLink>
          {links.map((l) => <NavLink key={l.to} to={l.to}>{l.label}</NavLink>)}
        </nav>
        <p className="faint text-xs pubfoot__copy">{t('public.copyright', '© {year} CreatorHub AI', { year: new Date().getFullYear() })}</p>
      </div>
    </footer>
  );
}

/** Wrapper for public pages that want nav + footer (the Landing page may also compose them itself). */
export default function PublicLayout({ links, children }) {
  return (
    <div className="public">
      <PublicNav links={links} />
      <main id="main">{children || <Outlet />}</main>
      <PublicFooter />
    </div>
  );
}
