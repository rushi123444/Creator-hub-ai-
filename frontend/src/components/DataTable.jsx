import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { useI18n } from '../i18n/index.js';
import { useIsMobile } from '../hooks/useMediaQuery.js';
import { cn } from '../utils/cn.js';
import EmptyState from './EmptyState.jsx';
import { SkeletonRows } from './Skeleton.jsx';

/**
 * DataTable: table on desktop, stacked cards on mobile (<=640px).
 * Props:
 *  - columns: [{ key, header, render?(row) -> node, sortable?, sortValue?(row), align?: 'right', primary?: true (card title on mobile),
 *              hideOnMobile?, width? }]
 *  - rows: array, rowKey: field name or (row)=>key (default 'id')
 *  - loading (skeleton), emptyTitle / emptyDescription / emptyIcon / emptyAction (empty state), onRowClick(row)
 *  - defaultSort: { key, dir: 'asc'|'desc' } (client-side sort; omit `sortable` columns to keep server order)
 *  - caption (screen-reader table caption), className
 */
export default function DataTable({ columns, rows = [], rowKey = 'id', loading, emptyTitle, emptyDescription, emptyIcon, emptyAction, onRowClick, defaultSort, caption, className }) {
  const { t } = useI18n();
  const mobile = useIsMobile();
  const [sort, setSort] = useState(defaultSort || null);
  const keyOf = (r, i) => (typeof rowKey === 'function' ? rowKey(r) : r[rowKey] ?? i);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const val = (r) => (col.sortValue ? col.sortValue(r) : r[col.key]);
    const out = [...rows].sort((a, b) => {
      const x = val(a), y = val(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' });
    });
    return sort.dir === 'desc' ? out.reverse() : out;
  }, [rows, sort, columns]);

  const toggle = (key) => setSort((s) => (s?.key === key ? (s.dir === 'asc' ? { key, dir: 'desc' } : null) : { key, dir: 'asc' }));
  const cell = (c, r) => (c.render ? c.render(r) : r[c.key] ?? '–');

  if (loading && !rows.length) return <SkeletonRows rows={6} />;
  if (!rows.length) return <EmptyState icon={emptyIcon} title={emptyTitle ?? t('state.noResults', 'No results found')} description={emptyDescription ?? t('state.noResultsDesc', 'Try a different search or clear your filters.')} action={emptyAction} />;

  if (mobile) {
    const primary = columns.find((c) => c.primary) || columns[0];
    return (
      <ul className={cn('cards-list', className)} aria-busy={loading || undefined}>
        {sorted.map((r, i) => (
          <li key={keyOf(r, i)}>
            <div className={cn('card cards-list__item', onRowClick && 'card--interactive')} onClick={onRowClick ? () => onRowClick(r) : undefined}>
              <div style={{ fontWeight: 600 }}>{cell(primary, r)}</div>
              {columns.filter((c) => c !== primary && !c.hideOnMobile).map((c) => (
                <div className="cards-list__row" key={c.key}>
                  <span className="cards-list__label">{c.header}</span>
                  <span style={{ textAlign: 'right', minWidth: 0 }}>{cell(c, r)}</span>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={cn('table-wrap', className)} aria-busy={loading || undefined} style={loading ? { opacity: 0.7 } : undefined}>
      <table className="table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => {
              const active = sort?.key === c.key;
              const Icon = active ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ChevronsUpDown;
              return (
                <th key={c.key} scope="col" className={c.align === 'right' ? 'is-right' : undefined} style={c.width ? { width: c.width } : undefined} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  {c.sortable ? (
                    <button type="button" className="table__sort" onClick={() => toggle(c.key)} aria-label={t('common.sortBy', 'Sort by {column}', { column: typeof c.header === 'string' ? c.header : c.key })}>
                      {c.header}<Icon size={13} aria-hidden="true" />
                    </button>
                  ) : c.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={keyOf(r, i)} className={onRowClick ? 'is-clickable' : undefined} onClick={onRowClick ? () => onRowClick(r) : undefined}>
              {columns.map((c) => <td key={c.key} className={c.align === 'right' ? 'is-right' : undefined}>{cell(c, r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
