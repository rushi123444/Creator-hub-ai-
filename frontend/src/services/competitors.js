import { api } from './api.js';

export const competitorsService = {
  /**
   * Public information only. Saves and returns the analysis.
   * @param {{platform:string, handle_or_url:string}} body
   */
  analyze: (body) => api.post('/competitors/analyze', body, { timeout: 60000 }),
  list: (opts) => api.get('/competitors', opts),
  get: (id, opts) => api.get(`/competitors/${encodeURIComponent(id)}`, opts),
  remove: (id) => api.delete(`/competitors/${encodeURIComponent(id)}`),
};

export default competitorsService;
