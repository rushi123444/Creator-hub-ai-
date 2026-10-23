import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { Dropdown, IconButton, EmptyState, ErrorState, Spinner, Button } from '../components';
import { useI18n } from '../i18n';
import { notificationsService, getFriendlyError } from '../services';
import { formatRelative } from '../utils/date.js';

/** Top-bar notifications dropdown backed by /notifications. */
export default function NotificationsMenu() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await notificationsService.list({ limit: 20 });
      setItems(res?.items || []);
      setError('');
    } catch (e) { setError(getFriendlyError(e)); }
  }, []);
  useEffect(() => { load(); const id = setInterval(load, 90000); return () => clearInterval(id); }, [load]);
  useEffect(() => { if (open) load(); }, [open, load]);

  const unread = (items || []).filter((n) => !n.is_read).length;
  const read = async (n, close) => {
    if (!n.is_read) {
      setItems((l) => l.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      notificationsService.markRead(n.id).catch(() => {});
    }
    if (n.link && n.link.startsWith('/')) { close(); nav(n.link); }
  };
  const readAll = async () => {
    setItems((l) => l.map((x) => ({ ...x, is_read: true })));
    try { await notificationsService.markAllRead(); } catch { load(); }
  };

  return (
    <Dropdown align="end" role="dialog" width="360px" open={open} onOpenChange={setOpen} panelClassName="notif"
      trigger={(
        <IconButton label={`${t('topbar.notifications', 'Notifications')}${unread ? ` (${t('topbar.unread', '{count} unread', { count: unread })})` : ''}`} className="notif__btn">
          <Bell size={18} />{unread > 0 && <span className="notif__dot" aria-hidden="true" />}
        </IconButton>
      )}>
      {(close) => (
        <div>
          <div className="notif__head">
            <strong>{t('topbar.notifications', 'Notifications')}</strong>
            {unread > 0 && <Button size="sm" variant="ghost" icon={CheckCheck} onClick={readAll}>{t('topbar.markAllRead', 'Mark all as read')}</Button>}
          </div>
          <div className="notif__list">
            {error && !items ? <ErrorState compact message={error} onRetry={load} />
              : items === null ? <div className="notif__loading"><Spinner /></div>
              : items.length === 0 ? <EmptyState compact icon={Bell} title={t('topbar.noNotifications', "You're all caught up")} description={t('topbar.noNotificationsDesc', 'New alerts will show up here.')} />
              : items.map((n) => (
                <button type="button" key={n.id} className={`notif__item${n.is_read ? '' : ' is-unread'}`} onClick={() => read(n, close)}>
                  <span className="notif__title">{n.title}</span>
                  {n.body && <span className="notif__body clamp-2">{n.body}</span>}
                  <span className="faint text-xs">{formatRelative(n.created_at, { lang })}</span>
                </button>
              ))}
          </div>
        </div>
      )}
    </Dropdown>
  );
}
