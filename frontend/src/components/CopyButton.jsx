import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useI18n } from '../i18n/index.js';
import { copyToClipboard } from '../utils/clipboard.js';
import { useToast } from './Toast.jsx';
import Button from './Button.jsx';
import IconButton from './IconButton.jsx';

/**
 * CopyButton: copies `text`, flips to a check for 1.8s and shows a toast.
 * Props: text (string | () => string), label (button text; omit with iconOnly), iconOnly, size, variant, className.
 */
export default function CopyButton({ text, label, iconOnly, size = 'sm', variant = 'ghost', className }) {
  const { t } = useI18n();
  const toast = useToast();
  const [done, setDone] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const onClick = async () => {
    const value = typeof text === 'function' ? text() : text;
    const ok = await copyToClipboard(value ?? '');
    if (ok) {
      setDone(true);
      toast.success(t('toast.copied', 'Copied to clipboard'));
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setDone(false), 1800);
    } else toast.error(t('toast.copyFailed', "Couldn't copy. Select the text and copy it manually."));
  };
  const Icon = done ? Check : Copy;
  if (iconOnly) return <IconButton icon={Icon} label={t('common.copy', 'Copy')} size={size} onClick={onClick} className={className} />;
  return <Button variant={variant} size={size} icon={Icon} onClick={onClick} className={className}>{done ? t('common.copied', 'Copied') : label ?? t('common.copy', 'Copy')}</Button>;
}
