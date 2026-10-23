import { api } from './api.js';

const id = encodeURIComponent;

/** Admin endpoints (role admin only; anything else gets 403). */
export const adminService = {
  /** -> { total_users,total_creators,total_editors,total_content,total_ai_requests,total_categories,reported_profiles,recent_signups[],ai_requests_by_day[],users_by_role[] } */
  overview: (opts) => api.get('/admin/overview', opts),

  /* Users */
  listUsers: (params, opts) => api.get('/admin/users', { ...opts, params }), // { q, role, active }
  /** @param {{is_active?:boolean, role?:'creator'|'editor', full_name?:string}} body */
  updateUser: (userId, body) => api.patch(`/admin/users/${id(userId)}`, body),
  /** Cannot delete self or the last admin. */
  deleteUser: (userId) => api.delete(`/admin/users/${id(userId)}`),

  /* Creators and content */
  listCreators: (params, opts) => api.get('/admin/creators', { ...opts, params }),
  listContent: (params, opts) => api.get('/admin/content', { ...opts, params }), // { q }
  deleteContent: (contentId) => api.delete(`/admin/content/${id(contentId)}`),

  /* Editors */
  listEditors: (params, opts) => api.get('/admin/editors', { ...opts, params }),
  createEditor: (body) => api.post('/admin/editors', body),
  updateEditor: (editorId, body) => api.put(`/admin/editors/${id(editorId)}`, body),
  deleteEditor: (editorId) => api.delete(`/admin/editors/${id(editorId)}`),
  /** @param {{status:'active'|'flagged'|'suspended', is_verified?:boolean}} body */
  moderateEditor: (editorId, body) => api.patch(`/admin/editors/${id(editorId)}/moderation`, body),

  /* Categories */
  listCategories: (opts) => api.get('/admin/categories', opts),
  createCategory: (body) => api.post('/admin/categories', body),
  updateCategory: (categoryId, body) => api.put(`/admin/categories/${id(categoryId)}`, body),
  deleteCategory: (categoryId) => api.delete(`/admin/categories/${id(categoryId)}`),

  /* Trends (score recomputed server-side from inputs) */
  listTrends: (params, opts) => api.get('/admin/trends', { ...opts, params }),
  createTrend: (body) => api.post('/admin/trends', body),
  updateTrend: (trendId, body) => api.put(`/admin/trends/${id(trendId)}`, body),
  deleteTrend: (trendId) => api.delete(`/admin/trends/${id(trendId)}`),

  /* Reports */
  listReports: (params, opts) => api.get('/admin/reports', { ...opts, params }), // { status }
  /** @param {{status:string, resolution_note?:string}} body */
  updateReport: (reportId, body) => api.patch(`/admin/reports/${id(reportId)}`, body),

  /* AI usage: { days } -> { total, by_feature[], by_day[], by_status[], sample_share, avg_latency_ms, top_users[] } */
  aiUsage: (params, opts) => api.get('/admin/ai-usage', { ...opts, params }),

  /* Platform settings: keys open_registration, ai_daily_limit_per_user, announcement */
  getSettings: (opts) => api.get('/admin/settings', opts),
  updateSettings: (body) => api.put('/admin/settings', body),
};

export default adminService;
