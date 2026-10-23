import { api } from './api.js';

export const profilesService = {
  /** Current user's profile (same shape as the `user` object from /auth/me). */
  getMe: (opts) => api.get('/profiles/me', opts),
  /**
   * Accepts the union of profile + creator_profile fields + full_name:
   * full_name, username, avatar_url, bio, preferred_language, ui_language,
   * category_id, platform_id, creator_type, experience_level, interests[], default_tone.
   * Sets profile_completed server-side.
   */
  updateMe: (payload) => api.put('/profiles/me', payload),
};

export default profilesService;
