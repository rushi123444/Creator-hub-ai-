import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import { Drawer, ErrorBoundary, PageSkeleton } from '../components';
import { useI18n } from '../i18n';
import { useAuth } from '../context/AuthContext.jsx';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { STORAGE_KEYS } from '../utils/constants.js';
import Sidebar from './Sidebar.jsx';
import TopBar from './TopBar.jsx';
import HelpModal from './HelpModal.jsx';
import CommandPalette from './CommandPalette.jsx';
import { CREATOR_NAV, EDITOR_NAV, MOBILE_NAV, MOBILE_NAV_EDITOR, ADMIN_NAV } from './nav.js';

/** Authenticated shell for /app (creator + editor) and, with `admin`, /admin. */
export default function AppLayout({ admin = false }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const loc = useLocation();
  const [collapsed, setCollapsed] = useLocalStorage(STORAGE_KEYS.sidebarCollapsed, false);
  const tablet = useMediaQuery('(max-width: 1023px)');
  const mobile = useMediaQuery('(max-width: 639px)');
  const [menu, setMenu] = useState(false);
  const [help, setHelp] = useState(false);
  const [search, setSearch] = useState(false);

  useEffect(() => { setMenu(false); }, [loc.pathname]);
  useEffect(() => { if (!tablet) setMenu(false); }, [tablet]);

  const isEditor = user?.role === 'editor';
  const groups = admin ? ADMIN_NAV : isEditor ? EDITOR_NAV : CREATOR_NAV;
  const bottom = isEditor ? MOBILE_NAV_EDITOR : MOBILE_NAV;
  const side = { groups, onHelp: () => { setMenu(false); setHelp(true); }, showHelp: !admin, brandTo: admin ? '/admin/overview' : isEditor ? '/app/editor-profile' : '/app/dashboard' };

  return (
    <div className={`shell${collapsed && !tablet ? ' is-collapsed' : ''}`}>
      <a href="#main" className="skip-link">{t('common.skipToContent', 'Skip to main content')}</a>
      {!tablet && <aside className="shell__side"><Sidebar {...side} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} /></aside>}
      {tablet && (
        <Drawer open={menu} onClose={() => setMenu(false)} side="left" width="280px" hideHeader ariaLabel={t('nav.main', 'Main navigation')} className="drawer--nav">
          <Sidebar {...side} collapsed={false} onNavigate={() => setMenu(false)} onClose={() => setMenu(false)} />
        </Drawer>
      )}
      <div className="shell__main">
        <TopBar onMenu={tablet ? () => setMenu(true) : undefined} onSearch={() => setSearch(true)} accountItems={!admin} notifications={!admin} />
        <main id="main" className="shell__content" tabIndex={-1}>
          <ErrorBoundary resetKey={loc.pathname}>
            <Suspense fallback={<div className="page"><PageSkeleton /></div>}><Outlet /></Suspense>
          </ErrorBoundary>
        </main>
      </div>
      {mobile && !admin && (
        <nav className="bottomnav" aria-label={t('nav.mobile', 'Quick navigation')}>
          {bottom.map((it) => (
            <NavLink key={it.to} to={it.to} className="bottomnav__link"><it.icon size={20} aria-hidden="true" /><span>{t(it.key, it.label)}</span></NavLink>
          ))}
          <button type="button" className="bottomnav__link" onClick={() => setMenu(true)}><MoreHorizontal size={20} aria-hidden="true" /><span>{t('common.more', 'More')}</span></button>
        </nav>
      )}
      <HelpModal open={help} onClose={() => setHelp(false)} showAssistant={user?.role === 'creator'} />
      <CommandPalette open={search} onClose={() => setSearch(false)} role={user?.role} />
    </div>
  );
}

export { ADMIN_NAV };
