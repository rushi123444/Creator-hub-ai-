import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock } from 'lucide-react';
import { Button, Checkbox, FormField, Input, PasswordInput } from '../components';
import { useAuth, redirectForRole } from '../context/AuthContext.jsx';
import { getFriendlyError } from '../services/api.js';
import { useI18n } from '../i18n';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import '../styles/pagesA.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { t } = useI18n();
  const { login } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  useDocumentTitle(t('auth.login', 'Log in'));
  const [f, setF] = useState({ email: '', password: '', remember: true });
  const [errs, setErrs] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const v = {};
    if (!EMAIL_RE.test(f.email.trim())) v.email = t('auth.err.email', 'Enter a valid email address.');
    if (!f.password) v.password = t('auth.err.required', 'This field is required.');
    setErrs(v);
    setError('');
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      const user = await login({ email: f.email.trim(), password: f.password, remember: f.remember });
      const next = params.get('next');
      nav(user.role === 'creator' && next && next.startsWith('/app') ? next : redirectForRole(user), { replace: true });
    } catch (err) {
      setError(getFriendlyError(err));
      setBusy(false);
    }
  };

  return (
    <form className="authform" onSubmit={submit} noValidate>
      <div><h1>{t('auth.welcomeBack', 'Welcome back')}</h1></div>
      <p className="lead">{t('auth.loginSubtitle', 'Log in to keep creating.')}</p>
      {error && <div className="auth-alert" role="alert">{error}</div>}
      <FormField label={t('auth.email', 'Email')} error={errs.email} required>
        <Input type="email" icon={Mail} autoComplete="email" placeholder={t('auth.emailPlaceholder', 'you@example.com')} value={f.email} onChange={set('email')} autoFocus />
      </FormField>
      <FormField label={t('auth.password', 'Password')} error={errs.password} required>
        <PasswordInput icon={Lock} autoComplete="current-password" value={f.password} onChange={set('password')} />
      </FormField>
      <div className="row row--between row--wrap">
        <Checkbox label={t('auth.remember', 'Remember me')} checked={f.remember} onChange={set('remember')} />
        <Link to="/forgot-password" className="text-sm" style={{ color: 'var(--accent-text)' }}>{t('auth.forgot', 'Forgot password?')}</Link>
      </div>
      <Button type="submit" variant="primary" size="lg" block loading={busy}>{busy ? t('auth.loggingIn', 'Logging in…') : t('auth.login', 'Log in')}</Button>
      <p className="auth-foot">{t('auth.noAccount', "Don't have an account?")} <Link to="/register">{t('auth.createAccountLink', 'Create one')}</Link></p>
    </form>
  );
}
