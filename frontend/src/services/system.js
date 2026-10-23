import { request, systemUrl } from './api.js';

/** Liveness helpers. Not used by normal pages. */
export const systemService = {
  health: (opts) => request('GET', systemUrl('/health'), { ...opts, auth: false, timeout: 8000 }),
  ready: (opts) => request('GET', systemUrl('/ready'), { ...opts, auth: false, timeout: 8000 }),
};

export default systemService;
