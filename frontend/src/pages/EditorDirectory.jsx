import { useState } from 'react';
import { Mail, Globe, Instagram, Flag, Info, Film, BadgeCheck } from 'lucide-react';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, FormField, Modal, PageHeader, SearchInput, Select, Skeleton, Tag, Textarea, useToast } from '../components';
import { useI18n } from '../i18n';
import { useAsync } from '../hooks/useAsync.js';
import { useDebounce } from '../hooks/useDebounce.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { editorsService, reportsService, getFriendlyError } from '../services';
import '../styles/pagesB2.css';

const CHIPS = [
  { k: 'Reels', type: 'spec' }, { k: 'YouTube', type: 'spec' }, { k: 'Motion Graphics', type: 'spec' }, { k: 'Thumbnail Designer', type: 'spec' }, { k: 'Gaming', type: 'spec' },
  { k: 'Marathi', type: 'lang', v: 'mr' }, { k: 'Hindi', type: 'lang', v: 'hi' }, { k: 'English', type: 'lang', v: 'en' },
];
const REASONS = ['Spam or fake profile', 'Inappropriate content', 'Misleading information', 'Harassment', 'Other'];
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : u ? `https://${u}` : '');

export default function EditorDirectory() {
  const { t } = useI18n();
  const toast = useToast();
  useDocumentTitle(t('nav.editors', 'Editor Directory'));
  const [q, setQ] = useState('');
  const [chip, setChip] = useState('');
  const dq = useDebounce(q, 350);
  const c = CHIPS.find((x) => x.k === chip);
  const { data, loading, loaded, error, reload } = useAsync(
    (signal) => editorsService.list({ q: dq.trim() || undefined, specialization: c?.type === 'spec' ? c.k : undefined, language: c?.type === 'lang' ? c.v : undefined, limit: 60 }, { signal }),
    [dq, chip],
  );
  const items = data?.items || [];
  const [target, setTarget] = useState(null);
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    setSending(true);
    try {
      await reportsService.create({ target_type: 'editor', target_id: String(target.id), reason, details: details.trim() || undefined });
      toast.success(t('ed.reported', 'Thanks, your report was sent for review'));
      setTarget(null); setDetails(''); setReason(REASONS[0]);
    } catch (e) { toast.error(getFriendlyError(e)); }
    setSending(false);
  };

  return (
    <div className="page">
      <PageHeader title={t('nav.editors', 'Editor Directory')} description={t('ed.desc', 'Find video editors and designers and contact them directly.')} />
      <div className="b2-stack">
        <Card className="b2-note"><Info size={16} /><span>{t('ed.note', 'This is a directory and contact system, not a payment marketplace. Agree on work and payment directly with the editor.')}</span></Card>
        <SearchInput value={q} onChange={setQ} placeholder={t('ed.search', 'Search by name, skill or style')} />
        <div className="b2-actions" role="group" aria-label={t('ed.filters', 'Filters')} style={{ flexWrap: 'wrap' }}>
          <Tag tone={!chip ? 'accent' : 'neutral'} onClick={() => setChip('')}>{t('common.all', 'All')}</Tag>
          {CHIPS.map((x) => <Tag key={x.k} tone={chip === x.k ? 'accent' : 'neutral'} onClick={() => setChip(chip === x.k ? '' : x.k)}>{t(`ed.chip.${x.k}`, x.k)}</Tag>)}
        </div>

        {error && !items.length ? <ErrorState message={error} onRetry={reload} />
          : !loaded && loading ? <div className="b2-grid">{[0, 1, 2].map((i) => <Card key={i}><Skeleton height={48} width={48} radius={24} /><Skeleton height={16} width="60%" style={{ marginTop: 12 }} /><Skeleton height={48} style={{ marginTop: 12 }} /></Card>)}</div>
          : !items.length ? <EmptyState icon={Film} title={t('ed.emptyTitle', 'No editors found')} description={t('ed.emptyDesc', 'Try a different search or filter.')} action={(q || chip) ? <Button variant="secondary" onClick={() => { setQ(''); setChip(''); }}>{t('ed.clear', 'Clear filters')}</Button> : null} />
          : (
            <div className="b2-grid">
              {items.map((e) => (
                <Card key={e.id}>
                  <div className="b2-stack">
                    <div className="b2-row" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <Avatar name={e.display_name} src={e.avatar_url} size={48} />
                      <div className="b2-grow" style={{ minWidth: 0 }}>
                        <strong>{e.display_name}</strong> {e.is_verified && <Badge tone="success" icon={BadgeCheck}>{t('ed.verified', 'Verified')}</Badge>}
                        <div className="b2-muted">{e.specialization}{e.experience_years != null ? ` · ${t('ed.years', '{n} yrs', { n: e.experience_years })}` : ''}</div>
                      </div>
                    </div>
                    {e.headline && <div>{e.headline}</div>}
                    {(e.skills || []).length > 0 && <div className="b2-actions" style={{ flexWrap: 'wrap' }}>{e.skills.map((s) => <Tag key={s}>{s}</Tag>)}</div>}
                    {(e.languages || []).length > 0 && <div className="b2-muted">{t('ed.languages', 'Languages')}: {e.languages.join(', ')}</div>}
                    <div className="b2-actions" style={{ flexWrap: 'wrap' }}>
                      {e.contact_email && <Button size="sm" icon={Mail} href={`mailto:${e.contact_email}`}>{t('ed.contact', 'Contact')}</Button>}
                      {e.portfolio_url && <Button size="sm" variant="secondary" icon={Globe} href={safeUrl(e.portfolio_url)} target="_blank" rel="noopener noreferrer">{t('ed.portfolio', 'Portfolio')}</Button>}
                      {e.instagram_url && <Button size="sm" variant="secondary" icon={Instagram} href={safeUrl(e.instagram_url)} target="_blank" rel="noopener noreferrer">Instagram</Button>}
                      <Button size="sm" variant="ghost" icon={Flag} onClick={() => setTarget(e)}>{t('ed.report', 'Report profile')}</Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
      </div>
      <Modal open={!!target} onClose={() => setTarget(null)} title={t('ed.reportTitle', 'Report profile')} description={target?.display_name}
        footer={<><Button variant="secondary" onClick={() => setTarget(null)}>{t('common.cancel', 'Cancel')}</Button><Button loading={sending} onClick={submit}>{t('ed.send', 'Send report')}</Button></>}>
        <div className="b2-stack">
          <FormField label={t('ed.reason', 'Reason')}><Select value={reason} onChange={(e) => setReason(e.target.value)} options={REASONS.map((r) => ({ value: r, label: t(`ed.reason.${r}`, r) }))} /></FormField>
          <FormField label={t('ed.details', 'Details')} optionalLabel={t('common.optional', 'Optional')}><Textarea rows={4} value={details} onChange={(e) => setDetails(e.target.value)} /></FormField>
        </div>
      </Modal>
    </div>
  );
}
