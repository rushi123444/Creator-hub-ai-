import { useEffect, useMemo, useState } from 'react';
import { metaService } from '../services/meta.js';
import { PLATFORMS, CATEGORIES, STATUSES, CONTENT_TYPES, TONES, LANGUAGES } from '../utils/constants.js';

/**
 * useMeta(): cached GET /meta (one request per page load, shared by all callers).
 *   const { categories, platforms, languages, contentTypes, tones, statuses, loading,
 *           categoryId(slugOrName), categorySlug(id), categoryName(idOrSlug),
 *           platformId(slug), platformSlug(id), platformName(idOrSlug) } = useMeta();
 * Lists are always populated: until the API answers (or if it fails) they fall back to the built-in reference values,
 * so selects are never empty. Items from the API look like { id, slug, name } (languages: { code, name }).
 */
let cache = null;
let inflight = null;
const listeners = new Set();

function load() {
  if (cache || inflight) return inflight;
  inflight = metaService.get().then((d) => { cache = d; }).catch(() => { cache = { failed: true }; }).finally(() => { inflight = null; listeners.forEach((l) => l()); });
  return inflight;
}

const fallbackCats = CATEGORIES.map((c, i) => ({ id: i + 1, slug: c.slug, name: c.label }));
const fallbackPlats = PLATFORMS.map((p, i) => ({ id: i + 1, slug: p.slug, name: p.label }));

export function useMeta() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    load();
    return () => listeners.delete(l);
  }, []);
  const data = cache && !cache.failed ? cache : null;
  return useMemo(() => {
    const categories = data?.categories?.length ? data.categories : fallbackCats;
    const platforms = data?.platforms?.length ? data.platforms : fallbackPlats;
    const find = (list, v) => {
      if (v == null || v === '') return undefined;
      const k = String(v).toLowerCase();
      return list.find((x) => String(x.id) === k || String(x.slug ?? '').toLowerCase() === k || String(x.name ?? '').toLowerCase() === k);
    };
    return {
      loading: !cache,
      categories,
      platforms,
      languages: data?.languages?.length ? data.languages : LANGUAGES.map((l) => ({ code: l.code, name: l.label })),
      contentTypes: data?.content_types?.length ? data.content_types : CONTENT_TYPES,
      tones: data?.tones?.length ? data.tones : TONES,
      statuses: data?.statuses?.length ? data.statuses : STATUSES,
      categoryId: (v) => find(categories, v)?.id ?? null,
      categorySlug: (v) => find(categories, v)?.slug ?? '',
      categoryName: (v) => find(categories, v)?.name ?? '',
      platformId: (v) => find(platforms, v)?.id ?? null,
      platformSlug: (v) => find(platforms, v)?.slug ?? '',
      platformName: (v) => find(platforms, v)?.name ?? '',
    };
  }, [data]);
}

export default useMeta;
