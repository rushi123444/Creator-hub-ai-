import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CornerDownLeft, FileText } from 'lucide-react';
import { Modal, Spinner } from '../components';
import { useI18n } from '../i18n';
import { useDebounce } from '../hooks/useDebounce.js';
import { contentService } from '../services';
import { CREATOR_NAV, EDITOR_NAV, ADMIN_NAV, PALETTE_EXTRA } from './nav.js';

/** Global search: matches navigation targets and (for creators) the user's content via the API. */
export default function CommandPalette({ open, onClose, role }) {
  const { t } = useI18n();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [content, setContent] = useState([]);
  const [busy, setBusy] = useState(false);
  const [idx, setIdx] = useState(0);
  const dq = useDebounce(q.trim(), 250);
  const list = useRef(null);

  const pages = useMemo(() => {
    const groups = role === 'admin' ? ADMIN_NAV : role === 'editor' ? EDITOR_NAV : [...CREATOR_NAV, { items: PALETTE_EXTRA }];
    const all = groups.flatMap((g) => g.items).map((i) => ({ ...i, text: t(i.key, i.label) }));
    const needle = q.trim().toLowerCase();
    return needle ? all.filter((i) => i.text.toLowerCase().includes(needle) || i.label.toLowerCase().includes(needle)) : all;
  }, [q, role, t]);

  useEffect(() => { if (open) { setQ(''); setContent([]); setIdx(0); } }, [open]);
  useEffect(() => {
    if (!open || role !== 'creator' || dq.length < 2) { setContent([]); setBusy(false); return undefined; }
    let alive = true;
    setBusy(true);
    contentService.list({ q: dq, limit: 6 })
      .then((r) => alive && setContent(r?.items || []))
      .catch(() => alive && setContent([]))
      .finally(() => alive && setBusy(false));
    return () => { alive = false; };
  }, [dq, open, role]);

  const rows = [
    ...pages.map((p) => ({ id: p.to, to: p.to, label: p.text, icon: p.icon, group: 'pages' })),
    ...content.map((c) => ({ id: c.id, to: `/app/content?q=${encodeURIComponent(c.title)}`, label: c.title, icon: FileText, group: 'content', hint: t('palette.openContent', 'Open in Content') })),
  ];
  useEffect(() => { setIdx(0); }, [q, content.length]);
  useEffect(() => { list.current?.querySelector('[aria-selected=true]')?.scrollIntoView({ block: 'nearest' }); }, [idx]);

  const go = (r) => { if (!r) return; onClose(); nav(r.to); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, rows.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(rows[idx]); }
  };

  return (
    <Modal open={open} onClose={onClose} hideHeader ariaLabel={t('palette.title', 'Search')} size="md" className="palette" initialFocus="input">
      <div className="palette__input">
        <Search size={18} aria-hidden="true" />
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder={t('palette.placeholder', 'Search pages and content…')}
          aria-label={t('palette.title', 'Search')} role="combobox" aria-expanded="true" aria-controls="palette-list" aria-activedescendant={rows[idx] ? `pal-${idx}` : undefined} autoComplete="off" />
        {busy && <Spinner size={16} label={t('palette.searching', 'Searching your content…')} />}
      </div>
      <div className="palette__list" id="palette-list" role="listbox" ref={list}>
        {rows.length === 0 && !busy && <p className="palette__empty muted">{t('palette.empty', 'No matches for “{q}”', { q })}</p>}
        {rows.map((r, i) => (
          <div key={`${r.group}-${r.id}`}>
            {(i === 0 || rows[i - 1].group !== r.group) && <div className="palette__group">{r.group === 'pages' ? t('palette.pages', 'Pages') : t('palette.yourContent', 'Your content')}</div>}
            <div id={`pal-${i}`} role="option" aria-selected={i === idx} className={`palette__row${i === idx ? ' is-active' : ''}`} onMouseMove={() => setIdx(i)} onClick={() => go(r)}>
              <r.icon size={16} aria-hidden="true" /><span className="truncate grow">{r.label}</span>
              {r.hint && <span className="faint text-xs hide-mobile">{r.hint}</span>}
              {i === idx && <CornerDownLeft size={14} aria-hidden="true" />}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
