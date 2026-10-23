import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authService, clearToken, getToken, setToken, setUnauthorizedHandler } from '../services';
import { ROLES } from '../utils/constants.js';

const AuthContext = createContext(null);

/** Where a user lands after login, per contract section 7. */
export function redirectForRole(user) {
  if (!user) return '/login';
  if (user.role === ROLES.ADMIN) return '/admin/overview';
  if (user.role === ROLES.EDITOR) return '/app/editor-profile';
  return user.profile?.profile_completed === false ? '/app/profile/setup' : '/app/dashboard';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(() => !getToken());

  const refresh = useCallback(async () => {
    try {
      const me = await authService.me();
      setUser(me);
      return me;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!getToken()) return undefined;
    let alive = true;
    authService
      .me()
      .then((me) => alive && setUser(me))
      .catch(() => { if (alive) { clearToken(); setUser(null); } })
      .finally(() => alive && setReady(true));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    setUnauthorizedHandler?.(() => setUser(null));
  }, []);

  const finish = (res, remember) => {
    setToken(res.access_token, remember);
    setUser(res.user);
    return res.user;
  };

  const login = useCallback(async ({ email, password, remember = false }) =>
    finish(await authService.login({ email, password, remember_me: remember }), remember), []);
  const register = useCallback(async ({ full_name, email, password, role }) =>
    finish(await authService.register({ full_name, email, password, role }), false), []);
  const logout = useCallback(async () => {
    try { await authService.logout(); } catch { /* token is dropped locally either way */ }
    clearToken();
    setUser(null);
  }, []);

  const value = useMemo(() => ({
    user, ready, isAuthenticated: !!user, role: user?.role || null,
    isCreator: user?.role === ROLES.CREATOR, isEditor: user?.role === ROLES.EDITOR, isAdmin: user?.role === ROLES.ADMIN,
    login, register, logout, refresh, setUser, redirectForRole,
  }), [user, ready, login, register, logout, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** const { user, role, login, register, logout, refresh, isAdmin, redirectForRole } = useAuth() */
export function useAuth() {
  return useContext(AuthContext);
}
