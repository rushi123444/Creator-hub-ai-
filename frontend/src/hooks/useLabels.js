import { useCallback } from 'react';
import { useI18n } from '../i18n/index.js';
import { CATEGORIES, CONTENT_TYPES, EDITOR_SPECIALIZATIONS, LANGUAGES, PLATFORMS, STATUSES, TONES, labelOf } from '../utils/constants.js';

/**
 * useLabels(): translated labels for reference values (falls back to English).
 *   const L = useLabels();  L.status('draft'), L.tone('funny'), L.contentType('reel'), L.category('technology'),
 *   L.platform('youtube_shorts'), L.spec('reels'), L.language('mr'), L.hook('question'), L.role('creator')
 */
export function useLabels() {
  const { t } = useI18n();
  const make = useCallback((prefix, list) => (v) => {
    if (v == null || v === '') return '';
    const key = String(v).toLowerCase();
    return t(`${prefix}.${key}`, labelOf(list, key));
  }, [t]);
  return {
    status: make('status', STATUSES),
    tone: make('tone', TONES),
    contentType: make('contentType', CONTENT_TYPES),
    category: make('category', CATEGORIES),
    platform: make('platform', PLATFORMS),
    spec: make('spec', EDITOR_SPECIALIZATIONS),
    hook: make('hook', []),
    role: make('role', []),
    language: (c) => labelOf(LANGUAGES, c),
  };
}

export default useLabels;
