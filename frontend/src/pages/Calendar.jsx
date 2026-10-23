import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, CalendarDays, Trash2 } from 'lucide-react';
import { Button, ConfirmDialog, EmptyState, ErrorState, FormField, IconButton, Input, Modal, PageHeader, PlatformIcon, SegmentedControl, Select, Skeleton, StatusPill, Textarea, useToast } from '../components';
import { useI18n } from '../i18n';
import { useAsync } from '../hooks/useAsync.js';
import { useAction } from '../hooks/useAction.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useLabels } from '../hooks/useLabels.js';
import { useMeta } from '../hooks/useMeta.js';
import { calendarService, getFriendlyError } from '../services';
import { STATUSES, addDays, addMonths, combineLocalToUtcIso, formatDate, formatTime, monthGrid, monthGridRange, monthName, splitIsoToLocal, toDateKey, todayKey, weekDays, weekdayNames } from '../utils';
import '../styles/pagesB2.css';

const WS = 1;

export default function Calendar() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const L = useLabels();
  const meta = useMeta();
  useDocumentTitle(t('nav.calendar', 'Calendar'));
  const [view, setView] = useState('month');
  const [cursor, setCursor] = useState(() => new Date());
  const [edit, setEdit] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [over, setOver] = useState('');

  const y = cursor.getFullYear(); const m = cursor.getMonth();
  const range = useMemo(() => {
    if (view === 'week') { const d = weekDays(cursor, WS); return { start: toDateKey(d[0]), end: toDateKey(d[6]) }; }
    return monthGridRange(y, m, WS);
  }, [view, cursor, y, m]);

  const { data, loading, loaded, error, reload } = useAsync((signal) => calendarService.list(range, { signal }), [range.start, range.end]);
  const items = useMemo(() => (Array.isArray(data) ? data : data?.items || []).filter((i) => i.scheduled_at), [data]);
  const byDay = useMemo(() => {
    const map = {};
    items.forEach((i) => { (map[toDateKey(i.scheduled_at)] ||= []).push(i); });
    Object.values(map).forEach((a) => a.sort((p, q) => new Date(p.scheduled_at) - new Date(q.scheduled_at)));
    return map;
  }, [items]);

  const nav = (n) => setCursor((c) => (view === 'week' ? addDays(c, 7 * n) : addMonths(c, n)));
  const title = view === 'week' ? `${formatDate(range.start, { lang, withYear: false })} – ${formatDate(range.end, { lang })}` : monthName(y, m, lang);

  const save = useAction(async (f) => {
    const body = { title: f.title.trim(), platform: f.platform || undefined, status: f.status, scheduled_at: combineLocalToUtcIso(f.date, f.time), notes: f.notes };
    return f.id ? calendarService.update(f.id, body) : calendarService.create(body);
  });
  const del = useAction((id) => calendarService.remove(id));

  const openNew = (date) => setEdit({ title: '', platform: 'instagram', status: 'scheduled', date: date || todayKey(), time: '09:00', notes: '' });
  const openEdit = (i) => setEdit({ id: i.id, title: i.title || '', platform: i.platform || 'instagram', status: i.status || 'scheduled', date: splitIsoToLocal(i.scheduled_at).date, time: splitIsoToLocal(i.scheduled_at).time, notes: i.notes || '', origStatus: i.status, origAt: i.scheduled_at });

  const onSave = async () => {
    if (!edit.title.trim() || !edit.date) return;
    const r = await save.run(edit);
    if (r) { toast.success(t('toast.saved', 'Saved')); setEdit(null); reload(); } else toast.error(save.error);
  };
  const onDelete = async () => {
    const r = await del.run(confirm.id);
    if (r !== undefined) { toast.success(t('toast.deleted', 'Deleted')); setConfirm(null); setEdit(null); reload(); } else toast.error(del.error);
  };
  const quickStatus = async (status) => {
    try { await calendarService.setStatus(edit.id, status); toast.success(t('cal.statusChanged', 'Status updated')); setEdit((s) => ({ ...s, status, origStatus: status })); reload(); } catch (e) { toast.error(getFriendlyError(e)); }
  };
  const drop = async (e, key) => {
    e.preventDefault(); setOver('');
    const id = e.dataTransfer.getData('text/plain');
    const it = items.find((x) => String(x.id) === id);
    if (!it || toDateKey(it.scheduled_at) === key) return;
    try { await calendarService.move(it.id, combineLocalToUtcIso(key, splitIsoToLocal(it.scheduled_at).time)); toast.success(t('cal.moved', 'Moved to {date}', { date: formatDate(key, { lang }) })); reload(); } catch (er) { toast.error(getFriendlyError(er)); }
  };
  const dnd = (key) => ({ onDragOver: (e) => { e.preventDefault(); setOver(key); }, onDragLeave: () => setOver(''), onDrop: (e) => drop(e, key) });
  const dragProps = (i) => ({ draggable: true, onDragStart: (e) => e.dataTransfer.setData('text/plain', String(i.id)) });
  const st = (s) => ({ '--st': `var(--st-${s})` });

  const card = (i, chip) => (
    <button key={i.id} type="button" className={chip ? 'cal-chip' : 'cal-card'} style={st(i.status)} onClick={(e) => { e.stopPropagation(); openEdit(i); }} title={i.title} {...dragProps(i)}>
      {chip ? (<><PlatformIcon platform={i.platform} size={11} /><span>{formatTime(i.scheduled_at, { lang })} {i.title}</span></>) : (<><b>{i.title}</b><span className="b2-row"><PlatformIcon platform={i.platform} size={12} /> {formatTime(i.scheduled_at, { lang })} <StatusPill status={i.status} /></span></>)}
    </button>
  );

  const first = loading && !loaded;
  const listKeys = Object.keys(byDay).sort();

  return (
    <div className="page">
      <PageHeader title={t('nav.calendar', 'Calendar')} description={t('cal.desc', 'Plan what goes live and when.')} actions={<Button icon={Plus} onClick={() => openNew()}>{t('cal.add', 'Add to calendar')}</Button>} />
      <div className="cal-head">
        <div className="b2-row">
          <IconButton icon={ChevronLeft} label={t('common.previous', 'Previous')} variant="secondary" onClick={() => nav(-1)} />
          <IconButton icon={ChevronRight} label={t('common.next', 'Next')} variant="secondary" onClick={() => nav(1)} />
          <Button variant="secondary" size="sm" onClick={() => setCursor(new Date())}>{t('cal.today', 'Today')}</Button>
        </div>
        <div className="cal-title" aria-live="polite">{title}</div>
        <SegmentedControl ariaLabel={t('cal.view', 'Calendar view')} value={view} onChange={setView} options={[{ value: 'month', label: t('cal.month', 'Month') }, { value: 'week', label: t('cal.week', 'Week') }, { value: 'list', label: t('cal.list', 'List') }]} />
      </div>

      {error && !loaded ? <ErrorState message={error} onRetry={reload} /> : first ? <Skeleton height={420} radius={16} /> : (
        <div aria-busy={loading}>
          {view === 'month' && (
            <div className="cal-month" role="grid">
              {weekdayNames(lang, WS).map((d) => <div key={d} className="cal-dow">{d}</div>)}
              {monthGrid(y, m, WS).map((c) => (
                <div key={c.key} role="gridcell" tabIndex={0} className={`cal-cell${c.inMonth ? '' : ' out'}${c.isToday ? ' today' : ''}${over === c.key ? ' over' : ''}`}
                  onClick={() => openNew(c.key)} onKeyDown={(e) => { if (e.key === 'Enter') openNew(c.key); }} aria-label={formatDate(c.key, { lang })} {...dnd(c.key)}>
                  <span className="cal-day">{c.day}</span>
                  <div className="cal-evs">
                    {(byDay[c.key] || []).slice(0, 3).map((i) => card(i, true))}
                    {(byDay[c.key] || []).length > 3 && <span className="cal-more">+{byDay[c.key].length - 3}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {view === 'week' && (
            <div className="cal-week">
              {weekDays(cursor, WS).map((d) => { const k = toDateKey(d); return (
                <div key={k} className={`cal-col${k === todayKey() ? ' today' : ''}${over === k ? ' over' : ''}`} {...dnd(k)}>
                  <h4>{formatDate(d, { lang, withYear: false })} · {weekdayNames(lang, 0)[d.getDay()]}</h4>
                  {(byDay[k] || []).map((i) => card(i, false))}
                  <Button variant="ghost" size="sm" icon={Plus} onClick={() => openNew(k)}>{t('common.add', 'Add')}</Button>
                </div>
              ); })}
            </div>
          )}
          {view === 'list' && (!listKeys.length ? (
            <EmptyState icon={CalendarDays} title={t('cal.empty', 'Nothing scheduled')} description={t('cal.emptyDesc', 'Add a post to plan this period.')} action={<Button icon={Plus} onClick={() => openNew()}>{t('cal.add', 'Add to calendar')}</Button>} />
          ) : listKeys.map((k) => (
            <div key={k}>
              <div className="cal-list-day">{formatDate(k, { lang })}</div>
              <div className="b2-stack" style={{ gap: 8 }}>{byDay[k].map((i) => card(i, false))}</div>
            </div>
          )))}
          {view !== 'list' && loaded && !items.length && <p className="b2-muted" style={{ textAlign: 'center', marginTop: 14 }}>{t('cal.emptyDesc', 'Add a post to plan this period.')}</p>}
        </div>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? t('cal.edit', 'Edit calendar item') : t('cal.add', 'Add to calendar')} size="md"
        footer={edit && <>{edit.id && <Button variant="danger" icon={Trash2} onClick={() => setConfirm(edit)}>{t('common.delete', 'Delete')}</Button>}<div className="b2-grow" /><Button variant="ghost" onClick={() => setEdit(null)}>{t('common.cancel', 'Cancel')}</Button><Button loading={save.pending} disabled={!edit.title.trim() || !edit.date} onClick={onSave}>{t('common.save', 'Save')}</Button></>}>
        {edit && (
          <div className="b2-form">
            <FormField label={t('content.title', 'Title')} required className="b2-full"><Input value={edit.title} onChange={(e) => setEdit((s) => ({ ...s, title: e.target.value }))} maxLength={200} /></FormField>
            <FormField label={t('content.platform', 'Platform')}><Select value={edit.platform} onChange={(e) => setEdit((s) => ({ ...s, platform: e.target.value }))} options={meta.platforms.map((p) => ({ value: p.slug, label: L.platform(p.slug) || p.name }))} /></FormField>
            <FormField label={t('content.status', 'Status')}>
              <Select value={edit.status} onChange={(e) => setEdit((s) => ({ ...s, status: e.target.value }))} options={STATUSES.filter((s) => s.value !== 'draft').map((s) => ({ value: s.value, label: L.status(s.value) }))} />
            </FormField>
            <FormField label={t('content.date', 'Date')}><Input type="date" value={edit.date} onChange={(e) => setEdit((s) => ({ ...s, date: e.target.value }))} /></FormField>
            <FormField label={t('content.time', 'Time')}><Input type="time" value={edit.time} onChange={(e) => setEdit((s) => ({ ...s, time: e.target.value }))} /></FormField>
            <FormField label={t('content.notes', 'Notes')} className="b2-full"><Textarea rows={3} value={edit.notes} onChange={(e) => setEdit((s) => ({ ...s, notes: e.target.value }))} /></FormField>
            {edit.id && edit.status !== edit.origStatus && <div className="b2-full"><Button size="sm" variant="secondary" onClick={() => quickStatus(edit.status)}>{t('cal.applyStatus', 'Update status only')}</Button></div>}
          </div>
        )}
      </Modal>
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={onDelete} danger loading={del.pending} title={t('cal.deleteTitle', 'Remove from calendar?')} description={t('cal.deleteDesc', '"{title}" will be removed from your calendar.', { title: confirm?.title || '' })} confirmLabel={t('common.delete', 'Delete')} />
    </div>
  );
}
