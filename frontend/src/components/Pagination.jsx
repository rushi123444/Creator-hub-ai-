import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '../i18n/index.js';
import { cn } from '../utils/cn.js';

function pages(page, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out = [1];
  const lo = Math.max(2, page - 1);
  const hi = Math.min(total - 1, page + 1);
  if (lo > 2) out.push('…');
  for (let i = lo; i <= hi; i++) out.push(i);
  if (hi < total - 1) out.push('…');
  out.push(total);
  return out;
}

/**
 * Pagination. 1-based `page`. Props: page, pageSize, total, onChange(page), className.
 * Renders nothing when everything fits on one page. Shows "Showing a–b of n" and page buttons (compact on mobile).
 */
export default function Pagination({ page = 1, pageSize = 20, total = 0, onChange, className }) {
  const { t } = useI18n();
  const count = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav className={cn('pagination', className)} aria-label={t('common.pagination', 'Pagination')}>
      <p className="pagination__info">{t('common.showing', 'Showing {from}–{to} of {total}', { from, to, total })}</p>
      <div className="pagination__btns">
        <button type="button" className="icon-btn icon-btn--sm" disabled={page <= 1} onClick={() => onChange?.(page - 1)} aria-label={t('common.previous', 'Previous')}><ChevronLeft size={16} aria-hidden="true" /></button>
        <span className="show-mobile pagination__info">{t('common.page', 'Page {page} of {total}', { page, total: count })}</span>
        <span className="row row--sm hide-mobile">
          {pages(page, count).map((p, i) => p === '…'
            ? <span key={`e${i}`} className="faint">…</span>
            : <button key={p} type="button" className={cn('pagination__page', p === page && 'is-active')} aria-current={p === page ? 'page' : undefined} onClick={() => onChange?.(p)}>{p}</button>)}
        </span>
        <button type="button" className="icon-btn icon-btn--sm" disabled={page >= count} onClick={() => onChange?.(page + 1)} aria-label={t('common.next', 'Next')}><ChevronRight size={16} aria-hidden="true" /></button>
      </div>
    </nav>
  );
}
