import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MailCheck } from 'lucide-react';
import { Button, FormField, Input } from '../components';
import { authService } from '../services';
import { getFriendlyError } from '../services/api.js';
import { useI18n } from '../i18n';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import '../styles/pagesA.css';

export default function ForgotPassword() {
  const { t } = useI18n();
  useDocumentTitle(t('auth.forgotTitle', 'Reset your password'));
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setErr(t('auth.err.email', 'Enter a valid email address.')); return; }
    setErr('');
    setBusy(true);
    try { await authService.forgotPassword(email.trim()); setSent(true); } catch (x) { setError(getFriendlyError(x)); }
    setBusy(false);
  };

  if (sent) {
    return (
      <div className="authform" style={{ textAlign: 'center', alignItems: 'center' }}>
        <MailCheck size={36} color="var(--success)" />
        <h1>{t('auth.linkSentTitle', 'Check your email')}</h1>
        <p className="muted text-sm" style={{ marginTop: -4 }}>{t('auth.linkSentDesc', "If an account exists for that address, a reset link is on its way.")}</p>
        <Button to="/login" variant="secondary" block>{t('auth.backToLogin', 'Back to log in')}</Button>
      </div>
    );
  }
  return (
    <form className="authform" onSubmit={submit} noValidate>
      <h1>{t('auth.forgotTitle', 'Reset your password')}</h1>
      <p className="lead">{t('auth.forgotSubtitle', "Enter your email. If an account exists, we'll send a reset link.")}</p>
      {error && <div className="auth-alert" role="alert">{error}</div>}
      <FormField label={t('auth.email', 'Email')} error={err} required>
        <Input type="email" icon={Mail} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      </FormField>
      <Button type="submit" variant="primary" size="lg" block loading={busy}>{busy ? t('auth.sendingLink', 'Sending…') : t('auth.sendLink', 'Send reset link')}</Button>
      <p className="auth-foot"><Link to="/login">{t('auth.backToLogin', 'Back to log in')}</Link></p>
    </form>
  );
}
