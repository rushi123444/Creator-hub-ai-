import { useNavigate } from 'react-router-dom';
import { Bot } from 'lucide-react';
import { Modal, Button } from '../components';
import { useI18n } from '../i18n';

const FAQ_COUNT = 12;

/** Product FAQ dialog. Props: open, onClose, showAssistant (link to AI Assistant for creators). */
export default function HelpModal({ open, onClose, showAssistant = true }) {
  const { t } = useI18n();
  const nav = useNavigate();
  return (
    <Modal open={open} onClose={onClose} title={t('help.title', 'Help and FAQ')} description={t('help.intro', 'Quick answers about using CreatorHub AI.')} size="lg"
      footer={showAssistant && (
        <>
          <span className="muted text-sm grow">{t('help.stillStuck', 'Still have a question?')}</span>
          <Button icon={Bot} onClick={() => { onClose(); nav('/app/assistant'); }}>{t('help.askAssistant', 'Ask the AI Assistant')}</Button>
        </>
      )}>
      <div className="faq">
        {Array.from({ length: FAQ_COUNT }, (_, i) => i + 1).map((n) => (
          <details key={n} className="faq__item">
            <summary>{t(`help.faq${n}.q`, '')}</summary>
            <p>{t(`help.faq${n}.a`, '')}</p>
          </details>
        ))}
      </div>
    </Modal>
  );
}
