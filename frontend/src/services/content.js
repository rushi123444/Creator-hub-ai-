import { api } from './api.js';

export const contentService = {
  /**
   * @param {{status?:string,q?:string,platform?:string,limit?:number,offset?:number}} params
   * -> { items, total, counts:{all,idea,draft,script,recording,editing,scheduled,published} }
   */
  list: (params, opts) => api.get('/content', { ...opts, params }),
  create: (body) => api.post('/content', body),
  get: (id, opts) => api.get(`/content/${encodeURIComponent(id)}`, opts),
  update: (id, body) => api.put(`/content/${encodeURIComponent(id)}`, body),
  remove: (id) => api.delete(`/content/${encodeURIComponent(id)}`),
  duplicate: (id) => api.post(`/content/${encodeURIComponent(id)}/duplicate`, {}),
  /** @param {{scheduled_at:string (UTC ISO), platform?:string}} body. Also creates/updates a calendar row. */
  schedule: (id, body) => api.post(`/content/${encodeURIComponent(id)}/schedule`, body),
};

export const calendarService = {
  /** @param {{start?:string,end?:string}} params (YYYY-MM-DD) */
  list: (params, opts) => api.get('/calendar', { ...opts, params }),
  create: (body) => api.post('/calendar', body),
  update: (id, body) => api.put(`/calendar/${encodeURIComponent(id)}`, body),
  remove: (id) => api.delete(`/calendar/${encodeURIComponent(id)}`),
  /** @param {string} scheduledAt UTC ISO timestamp */
  move: (id, scheduledAt) => api.post(`/calendar/${encodeURIComponent(id)}/move`, { scheduled_at: scheduledAt }),
  /** Also syncs the linked content status. */
  setStatus: (id, status) => api.patch(`/calendar/${encodeURIComponent(id)}/status`, { status }),
};

export default contentService;
