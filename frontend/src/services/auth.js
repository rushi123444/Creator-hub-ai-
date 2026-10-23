import { api } from './api.js';

/**
 * Auth endpoints. Token persistence is handled by AuthContext (useAuth): pages should call
 * `useAuth().login(...)` / `register(...)` rather than these directly.
 * login/register resolve to { access_token, token_type, user }.
 */
export const authService = {
  /** @param {{full_name:string,email:string,password:string,role:'creator'|'editor'}} payload */
  register: (payload) => api.post('/auth/register', payload, { auth: false }),
  /** @param {{email:string,password:string,remember_me?:boolean}} payload */
  login: (payload) => api.post('/auth/login', payload, { auth: false }),
  logout: () => api.post('/auth/logout'),
  /** Always resolves { ok: true } (no account enumeration). */
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }, { auth: false }),
  resetPassword: ({ token, new_password }) => api.post('/auth/reset-password', { token, new_password }, { auth: false }),
  me: (opts) => api.get('/auth/me', opts),
};

export default authService;
