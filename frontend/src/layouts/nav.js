import {
  LayoutDashboard, Sparkles, TrendingUp, Layers, CalendarDays, BarChart3, Radar, Scissors, Users, Bot, User,
  Settings, Film, ScanSearch, ShieldCheck, FileText, Flag, Tags, Cpu, UserCog, Clapperboard,
} from 'lucide-react';

/** Sidebar structure. `key` is the i18n key suffix under nav.* / admin.*; `label` is the English fallback. */
export const CREATOR_NAV = [
  { group: 'main', items: [
    { to: '/app/dashboard', key: 'nav.dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/app/studio', key: 'nav.studio', label: 'AI Studio', icon: Sparkles },
    { to: '/app/trends', key: 'nav.trends', label: 'Trends', icon: TrendingUp },
    { to: '/app/content', key: 'nav.content', label: 'Content', icon: Layers },
    { to: '/app/calendar', key: 'nav.calendar', label: 'Calendar', icon: CalendarDays },
    { to: '/app/analytics', key: 'nav.analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/app/competitors', key: 'nav.competitors', label: 'Competitor Analysis', icon: Radar },
    { to: '/app/long-to-short', key: 'nav.longToShort', label: 'Long-to-Short', icon: Scissors },
    { to: '/app/editors', key: 'nav.editors', label: 'Editor Directory', icon: Clapperboard },
  ] },
  { group: 'assist', items: [{ to: '/app/assistant', key: 'nav.assistant', label: 'AI Assistant', icon: Bot }] },
  { group: 'account', items: [
    { to: '/app/profile', key: 'nav.profile', label: 'Profile', icon: User },
    { to: '/app/settings', key: 'nav.settings', label: 'Settings', icon: Settings },
  ] },
];

export const EDITOR_NAV = [
  { group: 'main', items: [
    { to: '/app/editors', key: 'nav.editors', label: 'Editor Directory', icon: Clapperboard },
    { to: '/app/editor-profile', key: 'nav.editorProfile', label: 'My Editor Profile', icon: Film },
  ] },
  { group: 'account', items: [
    { to: '/app/profile', key: 'nav.profile', label: 'Profile', icon: User },
    { to: '/app/settings', key: 'nav.settings', label: 'Settings', icon: Settings },
  ] },
];

export const ADMIN_NAV = [
  { group: 'main', items: [
    { to: '/admin/overview', key: 'admin.overview', label: 'Overview', icon: ShieldCheck },
    { to: '/admin/users', key: 'admin.users', label: 'Users', icon: Users },
    { to: '/admin/creators', key: 'admin.creators', label: 'Creators', icon: UserCog },
    { to: '/admin/editors', key: 'admin.editors', label: 'Editors', icon: Film },
    { to: '/admin/categories', key: 'admin.categories', label: 'Categories', icon: Tags },
    { to: '/admin/trends', key: 'admin.trends', label: 'Trends', icon: TrendingUp },
    { to: '/admin/content', key: 'admin.content', label: 'Content', icon: FileText },
    { to: '/admin/reports', key: 'admin.reports', label: 'Reports', icon: Flag },
    { to: '/admin/ai-usage', key: 'admin.aiUsage', label: 'AI Usage', icon: Cpu },
    { to: '/admin/settings', key: 'admin.settings', label: 'Settings', icon: Settings },
  ] },
];

/** Mobile bottom nav (5 key destinations; the last opens the full menu). */
export const MOBILE_NAV = [
  { to: '/app/dashboard', key: 'nav.dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/app/studio', key: 'nav.studio', label: 'AI Studio', icon: Sparkles },
  { to: '/app/trends', key: 'nav.trends', label: 'Trends', icon: TrendingUp },
  { to: '/app/content', key: 'nav.content', label: 'Content', icon: Layers },
];
export const MOBILE_NAV_EDITOR = [
  { to: '/app/editors', key: 'nav.editors', label: 'Editor Directory', icon: Clapperboard },
  { to: '/app/editor-profile', key: 'nav.editorProfile', label: 'My Editor Profile', icon: Film },
  { to: '/app/profile', key: 'nav.profile', label: 'Profile', icon: User },
  { to: '/app/settings', key: 'nav.settings', label: 'Settings', icon: Settings },
];

/** Extra palette-only targets. */
export const PALETTE_EXTRA = [
  { to: '/app/analyzer', key: 'nav.analyzer', label: 'Content Analyzer', icon: ScanSearch },
];
