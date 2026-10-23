import { api } from './api.js';

/**
 * Saved AI output: hooks, captions, hashtags, scripts, ideas.
 * Every service has: list(params), create(body), remove(id).
 * `create` body = the stored shape (the same object the AI returned for that section).
 */
function libraryService(path) {
  return {
    list: (params, opts) => api.get(path, { ...opts, params }),
    create: (body) => api.post(path, body),
    remove: (id) => api.delete(`${path}/${encodeURIComponent(id)}`),
  };
}

export const hooksService = libraryService('/hooks');
export const captionsService = libraryService('/captions');
export const hashtagsService = libraryService('/hashtags');
export const ideasService = libraryService('/ideas');
export const scriptsService = {
  ...libraryService('/scripts'),
  /** Creates a `content` row with status `script`. -> content object */
  saveToContent: (id) => api.post(`/scripts/${encodeURIComponent(id)}/save-to-content`, {}),
};
