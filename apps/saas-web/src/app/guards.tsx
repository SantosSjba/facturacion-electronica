import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useSession } from "@/shared/auth/session-context";
import { PageSpinner } from "@/shared/ui/LoadingState";

import { resolveHomePath } from "./nav-config";

export function RequirePlatform() {
  const { user, bootstrapping, isPlatform } = useSession();
  const location = useLocation();

  if (bootstrapping) return <PageSpinner />;
  if (!user) {
    return (
      <Navigate to="/auth/login" replace state={{ from: location.pathname }} />
    );
  }
  if (!isPlatform) {
    return <Navigate to="/auth/login" replace />;
  }
  return <Outlet />;
}

export function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { user, bootstrapping, isPlatform } = useSession();
  if (bootstrapping) return <PageSpinner />;
  if (user && isPlatform) {
    return <Navigate to={resolveHomePath(user.perms)} replace />;
  }
  return children;
}
