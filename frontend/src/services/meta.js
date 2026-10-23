import { api } from './api.js';

export const metaService = {
  /** Public. -> { categories[], languages[], platforms[], content_types[], tones[], statuses[] }. Prefer the useMeta() hook (cached). */
  get: (opts) => api.get('/meta', { ...opts, auth: false }),
};

export default metaService;
