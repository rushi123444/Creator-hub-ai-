import { api } from './api.js';

export const editorsService = {
  /** Active editors only. @param {{q?:string,specialization?:string,language?:string,limit?:number}} params -> { items, total } */
  list: (params, opts) => api.get('/editors', { ...opts, params }),
  get: (id, opts) => api.get(`/editors/${encodeURIComponent(id)}`, opts),
  /** Editor role: own profile. 404 until first save. */
  getMyProfile: (opts) => api.get('/editors/me/profile', opts),
  /** Creates the row on first save. */
  saveMyProfile: (body) => api.put('/editors/me/profile', body),
};

export const notificationsService = {
  list: (params, opts) => api.get('/notifications', { ...opts, params }),
  markRead: (id) => api.post(`/notifications/${encodeURIComponent(id)}/read`, {}),
  markAllRead: () => api.post('/notifications/read-all', {}),
};

export const reportsService = {
  /** @param {{target_type:string,target_id:string,reason:string,details?:string}} body */
  create: (body) => api.post('/reports', body),
};

export default editorsService;
