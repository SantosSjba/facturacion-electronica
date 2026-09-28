import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { fetchOnboardingStatus } from "@/modules/app/api/onboarding";
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
    return <Navigate to="/app" replace />;
  }
  return <Outlet />;
}

export function RequireOrg() {
  const { user, bootstrapping, isPlatform } = useSession();
  const location = useLocation();

  if (bootstrapping) return <PageSpinner />;
  if (!user) {
    return (
      <Navigate to="/auth/login" replace state={{ from: location.pathname }} />
    );
  }
  if (isPlatform) {
    return <Navigate to="/platform" replace />;
  }
  return <Outlet />;
}

/** Blocks /app (except onboarding) until company + legal acceptances exist. */
export function RequireOnboarded() {
  const { user, bootstrapping } = useSession();
  const location = useLocation();

  const statusQuery = useQuery({
    queryKey: ["onboarding-status", user?.organizationId],
    queryFn: fetchOnboardingStatus,
    enabled: Boolean(user) && !bootstrapping,
    staleTime: 15_000,
  });

  if (bootstrapping || (user && statusQuery.isLoading)) {
    return <PageSpinner />;
  }
  if (!user) {
    return (
      <Navigate to="/auth/login" replace state={{ from: location.pathname }} />
    );
  }
  if (statusQuery.data && !statusQuery.data.complete) {
    return <Navigate to="/app/onboarding" replace />;
  }
  return <Outlet />;
}

/** Onboarding route: if already complete, send to /app. */
export function RedirectIfOnboarded({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, bootstrapping } = useSession();
  const statusQuery = useQuery({
    queryKey: ["onboarding-status", user?.organizationId],
    queryFn: fetchOnboardingStatus,
    enabled: Boolean(user) && !bootstrapping,
    staleTime: 15_000,
  });

  if (bootstrapping || (user && statusQuery.isLoading)) {
    return <PageSpinner />;
  }
  if (statusQuery.data?.complete) {
    return <Navigate to="/app" replace />;
  }
  return children;
}

export function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { user, bootstrapping, isPlatform } = useSession();
  if (bootstrapping) return <PageSpinner />;
  if (user) {
    return (
      <Navigate
        to={resolveHomePath(user.perms, isPlatform ? "platform" : "org")}
        replace
      />
    );
  }
  return children;
}
