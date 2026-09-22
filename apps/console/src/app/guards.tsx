import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useSession } from "@/shared/auth/session-context";
import { PageSpinner } from "@/shared/ui/LoadingState";

import { resolveHomePath } from "./nav-config";

export function RequireAuth() {
  const { user, bootstrapping } = useSession();
  const location = useLocation();

  if (bootstrapping) return <PageSpinner />;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { user, bootstrapping } = useSession();
  if (bootstrapping) return <PageSpinner />;
  if (user) {
    return <Navigate to={resolveHomePath(user.perms)} replace />;
  }
  return children;
}

export function HomeRedirect() {
  const { user, bootstrapping } = useSession();
  if (bootstrapping) return <PageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={resolveHomePath(user.perms)} replace />;
}
