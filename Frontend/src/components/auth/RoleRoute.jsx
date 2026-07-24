import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

/**
 * Gate a route by capability flags or exact roles.
 *
 * @param {string[]} [roles] - exact roles allowed
 * @param {string} [capability] - AuthContext boolean flag that must be true
 * @param {boolean} [requireOrgWide] - also require organization / superadmin scope
 */
export default function RoleRoute({
  children,
  roles,
  capability,
  requireOrgWide = false,
  fallback = "/dashboard",
}) {
  const auth = useAuth();

  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary" />
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  let allowed = true;
  if (roles?.length) {
    allowed = roles.includes(auth.user?.role);
  }
  if (capability) {
    allowed = allowed && !!auth[capability];
  }
  if (requireOrgWide) {
    allowed = allowed && (auth.isSuperAdmin || auth.isOrgWide);
  }

  if (!allowed) {
    return <Navigate to={fallback} replace />;
  }

  return children;
}
