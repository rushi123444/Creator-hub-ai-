import { useEffect, useState } from 'react';
import { Bookmark, Pencil, RotateCw } from 'lucide-react';
import { useI18n } from '../i18n/index.js';
import { cn } from '../utils/cn.js';
import Button from './Button.jsx';
import CopyButton from './CopyButton.jsx';
import SampleBadge from './SampleBadge.jsx';
import SectionCard from './SectionCard.jsx';
import Textarea from './Textarea.jsx';
import { Skeleton } from './Skeleton.jsx';

/**
 * AIOutputCard: one piece of generated text with Copy / Regenerate / Save / Edit (edit in place).
 * Props:
 *  - title, text (string shown and copied), isSample (shows the "Sample" badge), meta (node under the title, e.g. hook type Tag)
 *  - onRegenerate() (shows button; pass `regenerating` while it runs), regenerating
 *  - onSave(text) (shows button; pass `saving`, `saved` to switch the label), saving, saved
 *  - editable (default true): Edit opens a textarea; "Save changes" calls onChange(newText) so the parent updates its state
 *  - onChange(text), rows (edit textarea rows), children (extra content under the text), className
 */
export default function AIOutputCard({ title, text = '', isSample, meta, onRegenerate, regenerating, onSave, saving, saved, editable = true, onChange, rows = 6, children, className }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  useEffect(() => { if (!editing) setDraft(text); }, [text, editing]);
  const commit = () => { onChange?.(draft); setEditing(false); };
  return (
    <SectionCard
      title={title}
      className={cn('ai-card', className)}
      action={isSample ? <SampleBadge label={t('common.sampleContent', 'Sample content')} /> : null}
      footer={editing ? null : (
        <div className="ai-card__actions">
          <CopyButton text={() => text} label={t('common.copy', 'Copy')} />
          {onRegenerate && <Button size="sm" variant="ghost" icon={RotateCw} onClick={onRegenerate} loading={regenerating}>{t('common.regenerate', 'Regenerate')}</Button>}
          {onSave && <Button size="sm" variant="ghost" icon={Bookmark} onClick={() => onSave(text)} loading={saving} disabled={saved}>{saved ? t('common.saved', 'Saved') : t('common.save', 'Save')}</Button>}
          {editable && <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(true)} disabled={regenerating}>{t('common.edit', 'Edit')}</Button>}
        </div>
      )}
    >
      {meta && <div style={{ marginBottom: 'var(--sp-3)' }}>{meta}</div>}
      {editing ? (
        <div className="ai-card__edit">
          <p className="text-xs faint">{t('ai.editHint', 'Edit the text, then save your changes.')}</p>
          <Textarea rows={rows} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={title || t('common.edit', 'Edit')} autoFocus />
          <div className="row row--end">
            <Button variant="ghost" size="sm" onClick={() => { setDraft(text); setEditing(false); }}>{t('common.cancel', 'Cancel')}</Button>
            <Button variant="primary" size="sm" onClick={commit}>{t('common.saveChanges', 'Save changes')}</Button>
          </div>
        </div>
      ) : regenerating && !text ? (
        <div className="stack stack--sm" role="status" aria-label={t('state.regenerating', 'Regenerating…')}><Skeleton /><Skeleton /><Skeleton width="60%" /></div>
      ) : (
        <div className={cn('ai-card__body', regenerating && 'is-regenerating')} aria-busy={regenerating || undefined}>{text}</div>
      )}
      {children}
    </SectionCard>
  );
}
