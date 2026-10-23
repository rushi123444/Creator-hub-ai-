import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';
import { dictionaries } from '../i18n/I18nProvider.jsx';
import { STORAGE_KEYS } from '../utils/constants.js';

function tr(key, fb) {
  let lang = 'en';
  try { lang = window.localStorage.getItem(STORAGE_KEYS.uiLang) || 'en'; } catch { /* ignore */ }
  return dictionaries[lang]?.[key] ?? dictionaries.en[key] ?? fb;
}

/**
 * ErrorBoundary: friendly fallback, never shows technical text. Props: children, compact (inline card instead of full page).
 * Resets itself when `resetKey` changes (the router passes the pathname).
 */
export default class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { if (import.meta.env.DEV) console.error(error); }
  componentDidUpdate(prev) { if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false }); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="state state--error" role="alert" style={{ minHeight: this.props.compact ? undefined : '60vh', justifyContent: 'center' }}>
        <span className="state__icon"><AlertTriangle size={24} aria-hidden="true" /></span>
        <h2 className="state__title">{tr('boundary.title', 'Something went wrong')}</h2>
        <p className="state__desc">{tr('boundary.desc', 'This page ran into a problem. Reloading usually fixes it.')}</p>
        <div className="state__action">
          <button type="button" className="btn btn--primary btn--md" onClick={() => window.location.reload()}>{tr('boundary.reload', 'Reload page')}</button>
          <a className="btn btn--secondary btn--md" href="/">{tr('boundary.home', 'Go to home')}</a>
        </div>
      </div>
    );
  }
}
