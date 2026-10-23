import { useI18n } from '../i18n/index.js';
import Button from './Button.jsx';
import Modal from './Modal.jsx';

/**
 * ConfirmDialog. Props: open, onClose, onConfirm, title, description, confirmLabel (default "Confirm"),
 * cancelLabel, danger (red confirm button), loading (disables buttons, shows spinner on confirm).
 */
export default function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel, cancelLabel, danger, loading }) {
  const { t } = useI18n();
  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onClose}
      dismissable={!loading}
      size="sm"
      title={title}
      description={description}
      initialFocus="[data-autofocus]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading} data-autofocus>{cancelLabel || t('common.cancel', 'Cancel')}</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel || t('common.confirm', 'Confirm')}</Button>
        </>
      }
    />
  );
}
