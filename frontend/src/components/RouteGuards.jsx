import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, redirectForRole } from '../context/AuthContext.jsx';
import { PageSkeleton } from './Skeleton.jsx';

/** Requires a signed-in user; otherwise sends them to /login and back after. Renders <Outlet/> or children. */
export function ProtectedRoute({ children }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <div className="page"><PageSkeleton /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  return children || <Outlet />;
}

/** Requires one of `roles`; wrong role goes to that role's home. Wrap inside ProtectedRoute. */
export function RoleRoute({ roles, children }) {
  const { user } = useAuth();
  if (user && !roles.includes(user.role)) return <Navigate to={redirectForRole(user)} replace />;
  return children || <Outlet />;
}

/** For /login, /register ...: signed-in users are sent to their home. */
export function GuestRoute({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="page"><PageSkeleton /></div>;
  if (user) return <Navigate to={redirectForRole(user)} replace />;
  return children || <Outlet />;
}
