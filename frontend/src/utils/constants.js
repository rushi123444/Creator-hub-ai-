/**
 * Shared constants. These MUST match docs/CONTRACT.md section 1 exactly.
 * Each list is ordered the way it should appear in dropdowns.
 * `label` is the English fallback; use `useLabels()` (hooks/useLabels) for translated labels.
 */

export const PLATFORMS = [
  { slug: 'instagram', label: 'Instagram' },
  { slug: 'youtube', label: 'YouTube' },
  { slug: 'youtube_shorts', label: 'YouTube Shorts' },
  { slug: 'facebook', label: 'Facebook' },
  { slug: 'x', label: 'X' },
  { slug: 'linkedin', label: 'LinkedIn' },
  { slug: 'other', label: 'Other' },
];

export const CATEGORIES = [
  { slug: 'technology', label: 'Technology' },
  { slug: 'education', label: 'Education' },
  { slug: 'gaming', label: 'Gaming' },
  { slug: 'business', label: 'Business' },
  { slug: 'entertainment', label: 'Entertainment' },
  { slug: 'fitness', label: 'Fitness' },
];

export const STATUSES = [
  { value: 'idea', label: 'Idea' },
  { value: 'draft', label: 'Draft' },
  { value: 'script', label: 'Script' },
  { value: 'recording', label: 'Recording' },
  { value: 'editing', label: 'Editing' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
];

export const CONTENT_TYPES = [
  { value: 'reel', label: 'Reel' },
  { value: 'youtube_short', label: 'YouTube Short' },
  { value: 'youtube_video', label: 'YouTube video' },
  { value: 'educational', label: 'Educational' },
  { value: 'tutorial', label: 'Tutorial' },
  { value: 'post', label: 'Post' },
  { value: 'caption', label: 'Caption' },
  { value: 'other', label: 'Other' },
];

export const TONES = [
  { value: 'educational', label: 'Educational' },
  { value: 'professional', label: 'Professional' },
  { value: 'funny', label: 'Funny' },
  { value: 'storytelling', label: 'Storytelling' },
  { value: 'motivational', label: 'Motivational' },
  { value: 'casual', label: 'Casual' },
  { value: 'curious', label: 'Curious' },
];

export const EDITOR_SPECIALIZATIONS = [
  { value: 'reels', label: 'Reels' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'motion_graphics', label: 'Motion graphics' },
  { value: 'thumbnail', label: 'Thumbnails' },
  { value: 'gaming', label: 'Gaming' },
];

export const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
];

export const CREATOR_TYPES = [
  { value: 'solo', label: 'Solo creator' },
  { value: 'educator', label: 'Educator' },
  { value: 'student', label: 'Student creator' },
  { value: 'brand', label: 'Brand or business' },
  { value: 'agency', label: 'Agency' },
];

export const EXPERIENCE_LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

export const HOOK_TYPES = ['question', 'curiosity', 'problem', 'benefit', 'story'];

export const ROLES = { CREATOR: 'creator', EDITOR: 'editor', ADMIN: 'admin' };

export const UI_LANGS = ['en', 'hi', 'mr'];

export const REPORT_TARGET_TYPES = [
  { value: 'editor_profile', label: 'Editor profile' },
  { value: 'creator_profile', label: 'Creator profile' },
  { value: 'content', label: 'Content' },
];

export const REPORT_STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
];

export const EDITOR_MODERATION_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'suspended', label: 'Suspended' },
];

/** Storage keys (contract section 7) */
export const STORAGE_KEYS = {
  token: 'ch_token',
  uiLang: 'ch_ui_lang',
  theme: 'ch_theme',
  sidebarCollapsed: 'ch_sidebar_collapsed',
  chat: (userId) => `ch_chat_${userId}`,
};

/** Look up an item by slug/value/code, case-insensitive. */
export function findOption(list, key) {
  if (key == null) return undefined;
  const k = String(key).toLowerCase();
  return list.find((o) => String(o.slug ?? o.value ?? o.code).toLowerCase() === k);
}

/** English label for a value, falling back to a prettified version of the raw key. */
export function labelOf(list, key) {
  const hit = findOption(list, key);
  if (hit) return hit.label;
  if (key == null || key === '') return '';
  return String(key).replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

export const platformLabel = (slug) => labelOf(PLATFORMS, slug);
export const statusLabel = (v) => labelOf(STATUSES, v);
export const contentTypeLabel = (v) => labelOf(CONTENT_TYPES, v);
export const toneLabel = (v) => labelOf(TONES, v);
export const languageLabel = (code) => labelOf(LANGUAGES, code);

/** Status order index, useful for pipeline columns. */
export const STATUS_ORDER = STATUSES.map((s) => s.value);
