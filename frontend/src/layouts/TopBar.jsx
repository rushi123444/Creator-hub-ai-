import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Search, Moon, Sun, User, Settings, LogOut } from 'lucide-react';
import { IconButton, Avatar, Dropdown, LanguageSelect, Logo } from '../components';
import { useI18n } from '../i18n';
import { useAuth } from '../context/AuthContext.jsx';
import { STORAGE_KEYS } from '../utils/constants.js';
import NotificationsMenu from './NotificationsMenu.jsx';

function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(STORAGE_KEYS.theme, next); } catch { /* ignore */ }
    setTheme(next);
  };
  return [theme, toggle];
}

/** Top bar: menu button (compact), search, notifications (optional), language, theme, account menu. */
export default function TopBar({ onMenu, onSearch, notifications = true, accountItems = true }) {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [theme, toggleTheme] = useTheme();

  useEffect(() => {
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); onSearch(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSearch]);

  const items = [
    { type: 'label', label: `${t('topbar.signedInAs', 'Signed in as')} ${user?.email || ''}` },
    ...(accountItems ? [
      { label: t('nav.profile', 'Profile'), icon: User, onSelect: () => nav('/app/profile') },
      { label: t('nav.settings', 'Settings'), icon: Settings, onSelect: () => nav('/app/settings') },
      { type: 'separator' },
    ] : []),
    { label: t('nav.logout', 'Log out'), icon: LogOut, onSelect: logout, danger: true },
  ];

  return (
    <header className="topbar">
      {onMenu && <IconButton label={t('nav.openMenu', 'Open menu')} className="topbar__menu" onClick={onMenu}><Menu size={20} /></IconButton>}
      <span className="topbar__logo"><Logo size={22} showText={false} /></span>
      <button type="button" className="topbar__search" onClick={onSearch} aria-label={t('topbar.search', 'Search')}>
        <Search size={16} aria-hidden="true" />
        <span className="topbar__search-text truncate">{t('topbar.searchPlaceholder', 'Search pages and your content…')}</span>
        <kbd className="hide-mobile">Ctrl K</kbd>
      </button>
      <div className="topbar__actions">
        <LanguageSelect variant="menu" />
        <IconButton label={theme === 'dark' ? t('topbar.themeLight', 'Switch to light theme') : t('topbar.themeDark', 'Switch to dark theme')} onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </IconButton>
        {notifications && <NotificationsMenu />}
        <Dropdown items={items} width="240px" trigger={(
          <button type="button" className="topbar__avatar" aria-label={t('topbar.account', 'Account menu')}>
            <Avatar name={user?.full_name} src={user?.profile?.avatar_url} size={32} />
          </button>
        )} />
      </div>
    </header>
  );
}
