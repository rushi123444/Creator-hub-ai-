import { NavLink } from 'react-router-dom';
import { ChevronsLeft, ChevronsRight, HelpCircle, LogOut, X } from 'lucide-react';
import { Logo, LogoMark, Avatar, IconButton, Tooltip } from '../components';
import { useI18n } from '../i18n';
import { useAuth } from '../context/AuthContext.jsx';

/** Shared sidebar body for AppLayout/AdminLayout. Props: groups, collapsed, onToggle, onNavigate, onHelp, onClose, brandTo, adminBadge */
export default function Sidebar({ groups, collapsed, onToggle, onNavigate, onHelp, onClose, brandTo = '/', showHelp = true }) {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const item = (it) => {
    const link = (
      <NavLink key={it.to} to={it.to} className="sb-link" onClick={onNavigate} aria-label={collapsed ? t(it.key, it.label) : undefined}>
        <it.icon size={18} aria-hidden="true" />
        <span className="sb-label">{t(it.key, it.label)}</span>
      </NavLink>
    );
    return collapsed ? <Tooltip key={it.to} content={t(it.key, it.label)} side="right">{link}</Tooltip> : link;
  };
  return (
    <div className="sb">
      <div className="sb-head">
        <NavLink to={brandTo} className="sb-brand" aria-label="CreatorHub AI" onClick={onNavigate}>
          {collapsed ? <LogoMark size={26} /> : <Logo size={26} />}
        </NavLink>
        {onClose && <IconButton label={t('nav.closeMenu', 'Close menu')} size="sm" onClick={onClose}><X size={16} /></IconButton>}
      </div>
      <nav className="sb-nav" aria-label={t('nav.main', 'Main navigation')}>
        {groups.map((g, i) => (
          <div className="sb-group" key={g.group}>
            {i > 0 && <div className="sb-sep" role="separator" />}
            {g.items.map(item)}
          </div>
        ))}
      </nav>
      <div className="sb-foot">
        {showHelp && (
          <button type="button" className="sb-link" onClick={onHelp} aria-label={collapsed ? t('nav.help', 'Help') : undefined}>
            <HelpCircle size={18} aria-hidden="true" /><span className="sb-label">{t('nav.help', 'Help')}</span>
          </button>
        )}
        <div className="sb-user">
          <Avatar name={user?.full_name} src={user?.profile?.avatar_url} size={32} />
          <div className="sb-user__text">
            <strong className="truncate">{user?.full_name}</strong>
            <span className="truncate faint text-xs">{t(`role.${user?.role}`, user?.role || '')}</span>
          </div>
          <IconButton label={t('nav.logout', 'Log out')} size="sm" onClick={logout}><LogOut size={16} /></IconButton>
        </div>
        {onToggle && (
          <button type="button" className="sb-link sb-toggle" onClick={onToggle} aria-label={collapsed ? t('nav.expand', 'Expand sidebar') : t('nav.collapse', 'Collapse sidebar')}>
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
            <span className="sb-label">{t('nav.collapse', 'Collapse sidebar')}</span>
          </button>
        )}
      </div>
    </div>
  );
}
