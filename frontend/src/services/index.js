/**
 * Import services from here:  import { aiService, trendsService, getFriendlyError } from '../services';
 *
 *  authService            register, login, logout, forgotPassword, resetPassword, me
 *  profilesService        getMe, updateMe
 *  metaService            get                        (prefer the useMeta() hook)
 *  aiService              generateAll, hooks, script, caption, hashtags, ideas, regenerate,
 *                         assistant, longToShort, summarize, classifyTopic
 *  hooksService / captionsService / hashtagsService / ideasService / scriptsService
 *                         list, create, remove   (+ scriptsService.saveToContent)
 *  trendsService          list, get, refresh
 *  analyticsService       summary, listEntries, createEntry, updateEntry, removeEntry, analyze
 *  recommendationsService list, generate, dismiss
 *  dashboardService       get
 *  competitorsService     analyze, list, get, remove
 *  contentService         list, create, get, update, remove, duplicate, schedule
 *  calendarService        list, create, update, remove, move, setStatus
 *  editorsService         list, get, getMyProfile, saveMyProfile
 *  notificationsService   list, markRead, markAllRead
 *  reportsService         create
 *  adminService           overview, listUsers, updateUser, deleteUser, listCreators, listContent, deleteContent,
 *                         listEditors, createEditor, updateEditor, deleteEditor, moderateEditor,
 *                         listCategories, createCategory, updateCategory, deleteCategory,
 *                         listTrends, createTrend, updateTrend, deleteTrend,
 *                         listReports, updateReport, aiUsage, getSettings, updateSettings
 *
 * Errors: always show `getFriendlyError(err)`. Never show err.message / status codes yourself.
 */
export {
  api,
  request,
  ApiError,
  getFriendlyError,
  getFieldErrors,
  isUnauthorized,
  isAborted,
  getToken,
  setToken,
  clearToken,
  setUnauthorizedHandler,
  API_BASE,
  GENERIC_ERROR,
} from './api.js';

export { authService } from './auth.js';
export { profilesService } from './profiles.js';
export { metaService } from './meta.js';
export { aiService } from './ai.js';
export { hooksService, captionsService, hashtagsService, ideasService, scriptsService } from './library.js';
export { trendsService } from './trends.js';
export { analyticsService, recommendationsService, dashboardService } from './analytics.js';
export { competitorsService } from './competitors.js';
export { contentService, calendarService } from './content.js';
export { editorsService, notificationsService, reportsService } from './editors.js';
export { adminService } from './admin.js';
export { systemService } from './system.js';
