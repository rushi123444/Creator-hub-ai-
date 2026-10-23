/**
 * Low-level API client. Page authors normally never import this directly:
 * call the per-area service modules (authService, trendsService, ...) instead.
 *
 * What it does
 *  - Base URL from VITE_API_URL (default '/api/v1').
 *  - Bearer token from localStorage 'ch_token' (remember me) or sessionStorage.
 *  - JSON in / JSON out. 204 -> null.
 *  - Timeout (default 30s, AI calls use longer) and optional caller AbortSignal.
 *  - 401 on an authenticated call: clears the session and sends the user to /login once.
 *  - Errors are ApiError instances. Their `message` is ALWAYS safe to show; use getFriendlyError(err).
 */

export const API_BASE = String(import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');
export const TOKEN_KEY = 'ch_token';
export const GENERIC_ERROR = 'Something went wrong. Please try again.';

const DEFAULT_TIMEOUT = 30000;
export const AI_TIMEOUT = 60000;

/* ------------------------------ token storage ------------------------------ */

function safeStorage(kind) {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function getToken() {
  try {
    return safeStorage('local')?.getItem(TOKEN_KEY) || safeStorage('session')?.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

/** Persist a token. remember=true -> localStorage (survives restarts), else sessionStorage. */
export function setToken(token, remember = false) {
  clearToken();
  try {
    (remember ? safeStorage('local') : safeStorage('session'))?.setItem(TOKEN_KEY, token);
  } catch {
    /* storage unavailable: the in-memory session below still works for this tab */
    memoryToken = token;
  }
  unauthorizedHandled = false;
}

export function clearToken() {
  memoryToken = null;
  try {
    safeStorage('local')?.removeItem(TOKEN_KEY);
    safeStorage('session')?.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

let memoryToken = null;
const currentToken = () => getToken() || memoryToken;

/* ------------------------------ errors ------------------------------ */

export class ApiError extends Error {
  constructor({ status = 0, code = 'SERVER_ERROR', message, fields = null } = {}) {
    super(sanitizeMessage(message));
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

// Defensive: the server contract says messages are safe, but never let anything technical through.
const UNSAFE = /traceback|stack\s?trace|exception|sqlalchemy|psycopg|sqlite|postgres|supabase|openai|api[\s_-]?key|secret key|\.py\b|https?:\/\/|localhost|env(ironment)?\s+var|\b(select|insert|update|delete)\s+.*\s+(from|into|set)\b|errno|econn|status code/i;

function sanitizeMessage(message) {
  if (typeof message !== 'string') return GENERIC_ERROR;
  const m = message.trim();
  if (!m || m.length > 280 || UNSAFE.test(m)) return GENERIC_ERROR;
  return m;
}

/**
 * The ONLY way UI code should turn an error into text.
 * Returns the safe server message when there is one, else the generic message.
 * Never returns raw error text, status codes, URLs or stack traces.
 */
export function getFriendlyError(err) {
  if (err instanceof ApiError) return sanitizeMessage(err.message);
  return GENERIC_ERROR;
}

/** Per-field validation messages from a 422 (if any): { email: 'Enter a valid email.' } */
export function getFieldErrors(err) {
  if (!(err instanceof ApiError) || !err.fields) return {};
  const out = {};
  const f = err.fields;
  if (Array.isArray(f)) {
    for (const item of f) {
      const key = item?.field || item?.name || (Array.isArray(item?.loc) ? item.loc[item.loc.length - 1] : null);
      const msg = item?.message || item?.msg;
      if (key && typeof msg === 'string' && !UNSAFE.test(msg)) out[String(key)] = msg;
    }
  } else if (typeof f === 'object') {
    for (const k of Object.keys(f)) {
      const v = Array.isArray(f[k]) ? f[k][0] : f[k];
      if (typeof v === 'string' && !UNSAFE.test(v)) out[k] = v;
    }
  }
  return out;
}

export const isUnauthorized = (err) => err instanceof ApiError && err.status === 401;
export const isAborted = (err) => err?.name === 'AbortError' || err?.code === 'ABORTED';

/* ------------------------------ 401 handling ------------------------------ */

let unauthorizedHandler = null;
let unauthorizedHandled = false;

/** AuthContext registers itself here so a 401 can clear React state and navigate without a reload. */
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

function handleUnauthorized() {
  if (unauthorizedHandled) return;
  unauthorizedHandled = true;
  clearToken();
  if (typeof unauthorizedHandler === 'function') {
    unauthorizedHandler();
    return;
  }
  const path = window.location.pathname;
  if (!/^\/(login|register|forgot-password|reset-password)?$/.test(path)) {
    window.location.assign(`/login?next=${encodeURIComponent(path + window.location.search)}`);
  }
}

/* ------------------------------ request core ------------------------------ */

function buildUrl(path, params) {
  let url = /^https?:\/\//i.test(path) ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  if (params && typeof params === 'object') {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === '') continue;
      if (Array.isArray(v)) v.forEach((x) => x !== undefined && x !== null && x !== '' && qs.append(k, String(x)));
      else qs.append(k, String(v));
    }
    const s = qs.toString();
    if (s) url += (url.includes('?') ? '&' : '?') + s;
  }
  return url;
}

/**
 * request(method, path, { params, body, auth, timeout, signal })
 * auth=false for public endpoints (login, register, meta, ...): a 401 there is a normal error.
 */
export async function request(method, path, { params, body, auth = true, timeout = DEFAULT_TIMEOUT, signal } = {}) {
  const headers = { Accept: 'application/json' };
  const token = currentToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (body !== undefined && body !== null) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeout);
  const onCallerAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onCallerAbort, { once: true });
  }

  let res;
  try {
    res = await fetch(buildUrl(path, params), { method, headers, body: payload, signal: controller.signal });
  } catch (e) {
    if (!timedOut && (signal?.aborted || e?.name === 'AbortError')) {
      const err = new Error('aborted');
      err.name = 'AbortError';
      err.code = 'ABORTED';
      throw err;
    }
    throw new ApiError({ status: 0, code: timedOut ? 'TIMEOUT' : 'NETWORK_ERROR', message: GENERIC_ERROR });
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onCallerAbort);
  }

  let data = null;
  if (res.status !== 204) {
    const text = await res.text().catch(() => '');
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }
  }

  if (!res.ok) {
    const e = data && typeof data === 'object' ? data.error : null;
    const err = new ApiError({
      status: res.status,
      code: (e && e.code) || 'SERVER_ERROR',
      message: e && e.message,
      fields: (e && e.fields) || null,
    });
    if (res.status === 401 && auth && token) handleUnauthorized();
    throw err;
  }
  return data;
}

export const api = {
  get: (path, opts) => request('GET', path, opts),
  post: (path, body, opts) => request('POST', path, { ...opts, body: body ?? {} }),
  put: (path, body, opts) => request('PUT', path, { ...opts, body: body ?? {} }),
  patch: (path, body, opts) => request('PATCH', path, { ...opts, body: body ?? {} }),
  delete: (path, opts) => request('DELETE', path, opts),
};

/** Origin for system endpoints that live outside /api/v1 (/health, /ready). */
export function systemUrl(path) {
  if (/^https?:\/\//i.test(API_BASE)) {
    try {
      return new URL(path, API_BASE).toString();
    } catch {
      return path;
    }
  }
  return path;
}

export default api;
