import { X } from 'lucide-react';
import { cn } from '../utils/cn.js';

/** Tag: small pill. Props: onRemove (shows a remove button), removeLabel, tone ('neutral'|'accent'), onClick (makes it a button), className. */
export function Tag({ onRemove, removeLabel = 'Remove', onClick, tone = 'neutral', className, children }) {
  const cls = cn('tag', `tag--${tone}`, onClick && 'tag--click', className);
  const body = (
    <>
      <span className="truncate">{children}</span>
      {onRemove && (
        <button type="button" className="tag__x" onClick={onRemove} aria-label={`${removeLabel}: ${typeof children === 'string' ? children : ''}`}>
          <X size={12} aria-hidden="true" />
        </button>
      )}
    </>
  );
  return onClick ? (
    <button type="button" className={cls} onClick={onClick}>{body}</button>
  ) : (
    <span className={cls}>{body}</span>
  );
}

/** TagList: wraps tags. Props: items (string[]), onRemove(item), onSelect(item), tone, max (collapse extras into "+N"), className. */
export function TagList({ items = [], onRemove, onSelect, tone, max, className }) {
  const list = max ? items.slice(0, max) : items;
  const extra = max ? items.length - list.length : 0;
  if (!items.length) return null;
  return (
    <ul className={cn('tag-list', className)}>
      {list.map((it) => (
        <li key={it}>
          <Tag tone={tone} onRemove={onRemove ? () => onRemove(it) : undefined} onClick={onSelect ? () => onSelect(it) : undefined}>
            {it}
          </Tag>
        </li>
      ))}
      {extra > 0 && <li><span className="tag tag--neutral">+{extra}</span></li>}
    </ul>
  );
}

export default Tag;
