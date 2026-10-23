import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { STORAGE_KEYS, UI_LANGS } from '../utils/constants.js';

/**
 * Every file in ./locales/*.js is merged here. A locale module default-exports
 * `{ en: {...}, hi: {...}, mr: {...} }` (flat dot-keys, e.g. 'nav.dashboard').
 * See src/i18n/README.md.
 */
const modules = import.meta.glob('./locales/*.js', { eager: true });

export const dictionaries = { en: {}, hi: {}, mr: {} };
for (const path of Object.keys(modules).sort()) {
  const mod = modules[path];
  const source = mod.default || mod;
  for (const lang of UI_LANGS) {
    if (source && source[lang]) Object.assign(dictionaries[lang], source[lang]);
  }
}

function readStoredLang() {
  try {
    const v = window.localStorage.getItem(STORAGE_KEYS.uiLang);
    return UI_LANGS.includes(v) ? v : null;
  } catch {
    return null;
  }
}

function interpolate(text, vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined || vars[k] === null ? m : String(vars[k])));
}

const I18nContext = createContext({
  lang: 'en',
  setLang: () => {},
  t: (key, fallback) => (typeof fallback === 'string' ? fallback : key),
  hasStoredLang: false,
});

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => readStoredLang() || 'en');
  const [hasStoredLang, setHasStoredLang] = useState(() => !!readStoredLang());

  useEffect(() => {
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  const setLang = useCallback((next) => {
    if (!UI_LANGS.includes(next)) return;
    setLangState(next);
    setHasStoredLang(true);
    try {
      window.localStorage.setItem(STORAGE_KEYS.uiLang, next);
    } catch {
      /* ignore */
    }
  }, []);

  /**
   * t(key, fallback, vars): looks up the key in the active language, then English, then uses
   * `fallback` (the English text written inline), finally the key itself.
   * Placeholders: t('dash.hello', 'Hello, {name}', { name }).
   */
  const t = useCallback(
    (key, fallback, vars) => {
      let fb = fallback;
      let v = vars;
      if (fallback && typeof fallback === 'object') {
        v = fallback;
        fb = undefined;
      }
      const hit = dictionaries[lang][key] ?? dictionaries.en[key] ?? fb ?? key;
      return interpolate(String(hit), v);
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t, hasStoredLang }), [lang, setLang, t, hasStoredLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** const { t, lang, setLang } = useI18n() */
export function useI18n() {
  return useContext(I18nContext);
}
