# i18n

`const { t, lang, setLang } = useI18n();` then `t('key', 'English fallback', { name })` (placeholders are `{name}`).
Lookup order: active language, English, the inline fallback, the key. Language persists in `localStorage.ch_ui_lang`; `<html lang>` follows it.

## Adding strings (page agents)
Create `src/i18n/locales/<area>.js` (merged automatically via `import.meta.glob`). Keys are flat and namespaced (`dash.title`). Export `{ en, hi, mr }`:

```js
const rows = [['dash.hello', 'Hello, {name}', 'नमस्ते, {name}', 'नमस्कार, {name}']];
const pick = (i) => Object.fromEntries(rows.map((r) => [r[0], r[i]]));
export default { en: pick(1), hi: pick(2), mr: pick(3) };
```

Shared strings (buttons, states, nav, auth, statuses, tones, FAQ) already exist in `locales/common.js`: reuse `common.*`, `state.*`, `status.*`, `tone.*`. Pages without translations fall back to English.
