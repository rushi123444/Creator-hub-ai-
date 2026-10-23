import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Link2 } from 'lucide-react';
import { Button, FormField, PasswordInput, useToast } from '../components';
import { authService } from '../services';
import { getFriendlyError } from '../services/api.js';
import { useI18n } from '../i18n';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import '../styles/pagesA.css';

export default function ResetPassword() {
  const { t } = useI18n();
  const toast = useToast();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  useDocumentTitle(t('auth.resetTitle', 'Choose a new password'));
  const [f, setF] = useState({ password: '', confirm: '' });
  const [errs, setErrs] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!token) {
    return (
      <div className="authform" style={{ textAlign: 'center', alignItems: 'center' }}>
        <Link2 size={34} color="var(--warning)" />
        <h1>{t('auth.resetInvalidTitle', 'Link not valid')}</h1>
        <p className="muted text-sm" style={{ marginTop: -4 }}>{t('auth.resetInvalidLink', 'This reset link is invalid or has expired.')}</p>
        <Button to="/forgot-password" variant="primary" block>{t('auth.sendLink', 'Send reset link')}</Button>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    const v = {};
    if (f.password.length < 8) v.password = t('auth.err.passwordShort', 'Use at least 8 characters.');
    if (f.confirm !== f.password) v.confirm = t('auth.err.passwordMatch', "Passwords don't match.");
    setErrs(v); setError('');
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      await authService.resetPassword({ token, new_password: f.password });
      toast.success(t('auth.resetDone', 'Password updated. You can log in now.'));
      nav('/login', { replace: true });
    } catch (x) { setError(getFriendlyError(x)); setBusy(false); }
  };

  return (
    <form className="authform" onSubmit={submit} noValidate>
      <h1>{t('auth.resetTitle', 'Choose a new password')}</h1>
      <p className="lead">{t('auth.resetSubtitle', 'Pick something you have not used before.')}</p>
      {error && <div className="auth-alert" role="alert">{error}</div>}
      <FormField label={t('auth.newPassword', 'New password')} hint={t('auth.passwordHint', 'At least 8 characters.')} error={errs.password} required>
        <PasswordInput icon={Lock} autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoFocus />
      </FormField>
      <FormField label={t('auth.confirmPassword', 'Confirm password')} error={errs.confirm} required>
        <PasswordInput icon={Lock} autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
      </FormField>
      <Button type="submit" variant="primary" size="lg" block loading={busy}>{t('auth.setPassword', 'Update password')}</Button>
      <p className="auth-foot"><Link to="/login">{t('auth.backToLogin', 'Back to log in')}</Link></p>
    </form>
  );
}
