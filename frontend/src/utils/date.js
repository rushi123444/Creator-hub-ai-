/**
 * Date helpers. Timezone-safe by design.
 *
 * Rules used across the app:
 *  - API timestamps are ISO-8601 UTC ('2026-10-01T12:00:00Z') -> shown in the viewer's local time.
 *  - API dates are 'YYYY-MM-DD' -> treated as LOCAL calendar days (never shifted by a UTC offset).
 *  - A timestamp without a zone is assumed to be UTC.
 */

const LOCALES = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' };
export const localeFor = (lang) => LOCALES[lang] || LOCALES.en;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const NAIVE_TS = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

/** Parse an API value (date, timestamp, Date, epoch) into a Date, or null. */
export function parseDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = String(value).trim();
  const m = DATE_ONLY.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(NAIVE_TS.test(s) ? `${s.replace(' ', 'T')}Z` : s);
  return Number.isNaN(d.getTime()) ? null : d;
}

const pad = (n) => String(n).padStart(2, '0');

/** Local calendar key 'YYYY-MM-DD' for a Date (or parseable value). */
export function toDateKey(value) {
  const d = parseDate(value);
  if (!d) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const todayKey = () => toDateKey(new Date());

/** UTC ISO string without milliseconds: '2026-10-01T12:00:00Z' */
export function toUtcIso(value) {
  const d = parseDate(value);
  return d ? d.toISOString().replace(/\.\d{3}Z$/, 'Z') : '';
}

/** Combine a local date key + 'HH:mm' into a UTC ISO string for the API. */
export function combineLocalToUtcIso(dateKey, time = '09:00') {
  const m = DATE_ONLY.exec(dateKey || '');
  if (!m) return '';
  const [hh, mm] = String(time || '00:00').split(':').map(Number);
  return toUtcIso(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hh || 0, mm || 0, 0));
}

/** Split an API timestamp into local { date: 'YYYY-MM-DD', time: 'HH:mm' } (for inputs). */
export function splitIsoToLocal(value) {
  const d = parseDate(value);
  if (!d) return { date: '', time: '' };
  return { date: toDateKey(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

export function addDays(value, n) {
  const d = new Date(parseDate(value) || new Date());
  d.setDate(d.getDate() + n);
  return d;
}

export function addMonths(value, n) {
  const d = new Date(parseDate(value) || new Date());
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return d;
}

export function startOfDay(value) {
  const d = new Date(parseDate(value) || new Date());
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfMonth(value) {
  const d = startOfDay(value);
  d.setDate(1);
  return d;
}

export function endOfMonth(value) {
  const d = startOfMonth(value);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return d;
}

/** Week start: weekStartsOn 0 = Sunday, 1 = Monday (default). */
export function startOfWeek(value, weekStartsOn = 1) {
  const d = startOfDay(value);
  const diff = (d.getDay() - weekStartsOn + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

export function isSameDay(a, b) {
  const x = parseDate(a);
  const y = parseDate(b);
  return !!x && !!y && toDateKey(x) === toDateKey(y);
}

export function isToday(value) {
  return isSameDay(value, new Date());
}

export function isPast(value) {
  const d = parseDate(value);
  return !!d && d.getTime() < Date.now();
}

/** Whole days from today (local) to value; negative = past. */
export function daysFromToday(value) {
  const d = parseDate(value);
  if (!d) return 0;
  return Math.round((startOfDay(d).getTime() - startOfDay(new Date()).getTime()) / 86400000);
}

/**
 * Month grid for calendar views: always 6 weeks x 7 days.
 * Returns [{ date, key, day, inMonth, isToday }] (42 cells).
 */
export function monthGrid(year, month, weekStartsOn = 1) {
  const first = new Date(year, month, 1);
  const start = startOfWeek(first, weekStartsOn);
  const todayK = todayKey();
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = toDateKey(d);
    cells.push({ date: d, key, day: d.getDate(), inMonth: d.getMonth() === month, isToday: key === todayK });
  }
  return cells;
}

/** The 7 days of the week containing `value`. */
export function weekDays(value, weekStartsOn = 1) {
  const start = startOfWeek(value, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

/** Visible range of a month grid as { start, end } date keys: pass straight to calendarService.list. */
export function monthGridRange(year, month, weekStartsOn = 1) {
  const cells = monthGrid(year, month, weekStartsOn);
  return { start: cells[0].key, end: cells[cells.length - 1].key };
}

/** Short weekday names in the UI language, starting from weekStartsOn. */
export function weekdayNames(lang = 'en', weekStartsOn = 1, style = 'short') {
  const fmt = new Intl.DateTimeFormat(localeFor(lang), { weekday: style });
  // 2024-01-07 is a Sunday
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 7 + ((weekStartsOn + i) % 7))));
}

export function monthName(year, month, lang = 'en', style = 'long') {
  return new Intl.DateTimeFormat(localeFor(lang), { month: style, year: 'numeric' }).format(new Date(year, month, 1));
}

/** formatDate('2026-10-01') -> '1 Oct 2026' */
export function formatDate(value, { lang = 'en', withYear = true, month = 'short' } = {}) {
  const d = parseDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat(localeFor(lang), {
    day: 'numeric',
    month,
    ...(withYear ? { year: 'numeric' } : {}),
  }).format(d);
}

/** formatDateTime('2026-10-01T12:00:00Z') -> '1 Oct 2026, 5:30 pm' (viewer's timezone) */
export function formatDateTime(value, { lang = 'en' } = {}) {
  const d = parseDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat(localeFor(lang), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

export function formatTime(value, { lang = 'en' } = {}) {
  const d = parseDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat(localeFor(lang), { hour: 'numeric', minute: '2-digit' }).format(d);
}

/** Short axis label for charts: 'Oct 1' */
export function formatShortDate(value, lang = 'en') {
  const d = parseDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat(localeFor(lang), { day: 'numeric', month: 'short' }).format(d);
}

/**
 * Relative time: '5 minutes ago', 'in 2 days', 'yesterday'. Uses Intl.RelativeTimeFormat
 * so it is translated automatically for hi / mr.
 */
export function formatRelative(value, { lang = 'en' } = {}) {
  const d = parseDate(value);
  if (!d) return '';
  const diffSec = Math.round((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(localeFor(lang), { numeric: 'auto' });
  if (abs < 45) return rtf.format(0, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), 'day');
  if (abs < 86400 * 365) return rtf.format(Math.round(diffSec / (86400 * 30)), 'month');
  return rtf.format(Math.round(diffSec / (86400 * 365)), 'year');
}

/** Time-of-day greeting key: 'morning' | 'afternoon' | 'evening' */
export function dayPart(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
