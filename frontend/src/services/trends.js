import { api } from './api.js';

export const trendsService = {
  /**
   * @param {{platform?:string, category?:string, language?:string, days?:number, q?:string, sort?:'score'|'growth'|'engagement', limit?:number}} params
   * -> { items:[trend], charts:{growth[], frequency[], categories[]}, source:'live'|'sample', note, score_definition }
   */
  list: (params, opts) => api.get('/trends', { ...opts, params }),
  get: (id, opts) => api.get(`/trends/${encodeURIComponent(id)}`, opts),
  /** Always succeeds -> { source, updated } */
  refresh: () => api.post('/trends/refresh', {}, { timeout: 45000 }),
};

export default trendsService;
