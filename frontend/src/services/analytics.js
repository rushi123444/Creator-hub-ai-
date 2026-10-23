import { api } from './api.js';

export const analyticsService = {
  /**
   * @param {{start?:string,end?:string,platform?:string,category?:string,language?:string}} params  (dates YYYY-MM-DD)
   * -> { totals, engagement:{rate,basis,formula,label}, series:{views[],engagement[]}, by_platform[], by_category[], by_language[], by_content[], has_data }
   */
  summary: (params, opts) => api.get('/analytics/summary', { ...opts, params }),
  listEntries: (params, opts) => api.get('/analytics/entries', { ...opts, params }),
  /** fields = model columns; platform/category by slug/name */
  createEntry: (body) => api.post('/analytics/entries', body),
  updateEntry: (id, body) => api.put(`/analytics/entries/${encodeURIComponent(id)}`, body),
  removeEntry: (id) => api.delete(`/analytics/entries/${encodeURIComponent(id)}`),
  /**
   * Content Analyzer.
   * @param {{title,topic,description,duration_seconds,category,language,views,likes,comments,shares,publication_date,reach?}} body
   * -> { performance:{label,summary}, engagement, content_pattern, potential_strengths[], observations[], experiment_suggestions[], disclaimer }
   */
  analyze: (body) => api.post('/analytics/analyze', body, { timeout: 45000 }),
};

export const recommendationsService = {
  list: (opts) => api.get('/recommendations', opts),
  generate: () => api.post('/recommendations/generate', {}, { timeout: 45000 }),
  dismiss: (id) => api.post(`/recommendations/${encodeURIComponent(id)}/dismiss`, {}),
};

export const dashboardService = {
  /** -> { greeting_name, stats, trending[], recent_content[], upcoming[], recommendations[], charts:{views,engagement,platform,category}, is_sample_data } */
  get: (opts) => api.get('/dashboard', opts),
};

export default analyticsService;
