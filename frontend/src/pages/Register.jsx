import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User } from 'lucide-react';
import { Button, FormField, Input, PasswordInput } from '../components';
import { useAuth, redirectForRole } from '../context/AuthContext.jsx';
import { getFieldErrors, getFriendlyError } from '../services/api.js';
import { useI18n } from '../i18n';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import '../styles/pagesA.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const { t } = useI18n();
  const { register } = useAuth();
  const nav = useNavigate();
  useDocumentTitle(t('auth.registerTitle', 'Create your account'));
  const [f, setF] = useState({ full_name: '', email: '', password: '', confirm: '', role: 'creator' });
  const [errs, setErrs] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const v = {};
    if (f.full_name.trim().length < 2) v.full_name = t('auth.err.name', 'Enter your name.');
    if (!EMAIL_RE.test(f.email.trim())) v.email = t('auth.err.email', 'Enter a valid email address.');
    if (f.password.length < 8) v.password = t('auth.err.passwordShort', 'Use at least 8 characters.');
    if (f.confirm !== f.password) v.confirm = t('auth.err.passwordMatch', "Passwords don't match.");
    setErrs(v);
    setError('');
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      const user = await register({ full_name: f.full_name.trim(), email: f.email.trim(), password: f.password, role: f.role });
      nav(redirectForRole(user), { replace: true });
    } catch (err) {
      const fe = getFieldErrors(err);
      setErrs({ full_name: fe.full_name, email: fe.email, password: fe.password });
      setError(getFriendlyError(err));
      setBusy(false);
    }
  };

  const roles = [
    ['creator', t('auth.roleCreator', 'Creator'), t('auth.roleCreatorDesc', 'Create content, track trends and performance.')],
    ['editor', t('auth.roleEditor', 'Editor'), t('auth.roleEditorDesc', 'Showcase your editing work to creators.')],
  ];

  return (
    <form className="authform" onSubmit={submit} noValidate>
      <h1>{t('auth.registerTitle', 'Create your account')}</h1>
      <p className="lead">{t('auth.registerSubtitle', 'Start creating smarter in a minute.')}</p>
      {error && <div className="auth-alert" role="alert">{error}</div>}
      <div>
        <div className="text-sm" style={{ fontWeight: 500, marginBottom: 6 }} id="role-label">{t('auth.accountType', 'I am a')}</div>
        <div className="role-pick" role="radiogroup" aria-labelledby="role-label">
          {roles.map(([v, l, d]) => (
            <button type="button" key={v} role="radio" aria-checked={f.role === v} onClick={() => setF((s) => ({ ...s, role: v }))}>
              <b>{l}</b><small>{d}</small>
            </button>
          ))}
        </div>
      </div>
      <FormField label={t('auth.fullName', 'Full name')} error={errs.full_name} required>
        <Input icon={User} autoComplete="name" value={f.full_name} onChange={set('full_name')} />
      </FormField>
      <FormField label={t('auth.email', 'Email')} error={errs.email} required>
        <Input type="email" icon={Mail} autoComplete="email" placeholder={t('auth.emailPlaceholder', 'you@example.com')} value={f.email} onChange={set('email')} />
      </FormField>
      <FormField label={t('auth.password', 'Password')} hint={t('auth.passwordHint', 'At least 8 characters.')} error={errs.password} required>
        <PasswordInput icon={Lock} autoComplete="new-password" value={f.password} onChange={set('password')} />
      </FormField>
      <FormField label={t('auth.confirmPassword', 'Confirm password')} error={errs.confirm} required>
        <PasswordInput icon={Lock} autoComplete="new-password" value={f.confirm} onChange={set('confirm')} />
      </FormField>
      <Button type="submit" variant="primary" size="lg" block loading={busy}>{busy ? t('auth.creatingAccount', 'Creating account…') : t('auth.createAccount', 'Create account')}</Button>
      <p className="auth-foot">{t('auth.haveAccount', 'Already have an account?')} <Link to="/login">{t('auth.login', 'Log in')}</Link></p>
    </form>
  );
}
