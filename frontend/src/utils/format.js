/**
 * Number formatting helpers.
 *
 * formatCompact(1234)            -> '1.2K'
 * formatCompact(3400000)         -> '3.4M'
 * formatCompact(3400000, {indian:true}) -> '34L'
 * formatNumber(1234567)          -> '1,234,567'
 * formatNumber(1234567, {indian:true}) -> '12,34,567'
 */

const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

function trim(n, digits) {
  const fixed = n.toFixed(digits);
  return fixed.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

export function formatCompact(value, { indian = false, digits = 1 } = {}) {
  const n = Number(value);
  if (!isNum(n)) return '0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (indian) {
    if (abs >= 1e7) return `${sign}${trim(abs / 1e7, digits)}Cr`;
    if (abs >= 1e5) return `${sign}${trim(abs / 1e5, digits)}L`;
    if (abs >= 1e3) return `${sign}${trim(abs / 1e3, digits)}K`;
    return `${sign}${trim(abs, 0)}`;
  }
  if (abs >= 1e9) return `${sign}${trim(abs / 1e9, digits)}B`;
  if (abs >= 1e6) return `${sign}${trim(abs / 1e6, digits)}M`;
  if (abs >= 1e3) return `${sign}${trim(abs / 1e3, digits)}K`;
  return `${sign}${trim(abs, abs % 1 === 0 ? 0 : digits)}`;
}

export function formatNumber(value, { indian = false, maximumFractionDigits = 0 } = {}) {
  const n = Number(value);
  if (!isNum(n)) return '0';
  return new Intl.NumberFormat(indian ? 'en-IN' : 'en-US', { maximumFractionDigits }).format(n);
}

/** formatPercent(12.345) -> '12.3%'. Input is already a percentage (not 0-1). */
export function formatPercent(value, digits = 1) {
  const n = Number(value);
  if (!isNum(n)) return '0%';
  return `${trim(n, digits)}%`;
}

/** formatDelta(12.5) -> '+12.5%', formatDelta(-3) -> '-3%' */
export function formatDelta(value, digits = 1) {
  const n = Number(value);
  if (!isNum(n)) return '0%';
  return `${n > 0 ? '+' : ''}${trim(n, digits)}%`;
}

/** formatDuration(95) -> '1:35', formatDuration(3700) -> '1:01:40' */
export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (x) => String(x).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** formatMinutes(125) -> '2h 5m' */
export function formatMinutes(total) {
  const m = Math.max(0, Math.round(Number(total) || 0));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/** Initials for avatars: 'Asha Patil' -> 'AP' */
export function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = Array.from(parts[0])[0] || '';
  const last = parts.length > 1 ? Array.from(parts[parts.length - 1])[0] : '';
  return (first + last).toUpperCase();
}

export function truncate(text = '', max = 80) {
  const s = String(text);
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}
